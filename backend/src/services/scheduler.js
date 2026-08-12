import { addDays, daysBetween, startOfDay, studyDaysBetween, toDateKey } from '../utils/dates.js';
import { MASTERED_THRESHOLD } from './mastery.js';
import { initialReviewDays } from './spacedRepetition.js';

/**
 * Turns a topic graph plus what we know about the student into an actual
 * timetable.
 *
 * This is deliberately not done by the language model. The model is good at
 * knowing that paging comes before virtual memory; it is bad at arithmetic,
 * inconsistent between calls, and cannot be re-run for free every time a student
 * misses an evening. So the model produces the graph once, and this function —
 * plain, deterministic, testable code — decides who studies what and when.
 *
 * The shape of the algorithm:
 *
 *   1. Work out which calendar days are actually available.
 *   2. Order topics so prerequisites come first, and among topics that are
 *      ready, put the weakest and most heavily weighted ones first.
 *   3. Give each topic an amount of time based on how far the student is from
 *      knowing it and how hard it is.
 *   4. If the syllabus needs more time than the student has, compress every
 *      allocation proportionally rather than quietly dropping the tail.
 *   5. Pack the sessions into days, never moving backwards, which keeps
 *      prerequisites ahead of the topics that depend on them.
 *   6. Add spaced revision for what has been learned, and mock tests near
 *      the end.
 */

const MAX_SESSION_MINUTES = 50;
const MIN_SESSION_MINUTES = 15;
const REVISION_MINUTES = 20;
const REFRESH_MINUTES = 20;
const MOCK_TEST_MINUTES = 30;

// Share of the available time held back for revision and mock tests, so the
// plan does not spend every minute on first-pass learning.
const RESERVED_RATIO = 0.18;

// Below this, a topic is not worth a compressed allocation — it gets dropped
// instead of being given a token five minutes.
const MIN_USEFUL_ALLOCATION = 20;

export function generateSchedule({
  topics,
  progressByTopic = new Map(),
  from = new Date(),
  deadline,
  dailyMinutes,
  studyDays,
}) {
  const start = startOfDay(from);
  const lastStudyDay = resolveLastStudyDay(start, deadline);
  const days = studyDaysBetween(start, lastStudyDay, studyDays);

  if (days.length === 0 || topics.length === 0) {
    return {
      startDate: start,
      endDate: lastStudyDay,
      sessions: [],
      unscheduledTopicKeys: topics.map((topic) => topic.key),
      diagnostics: { capacityMinutes: 0, demandMinutes: 0, compression: 1, availableDays: 0 },
    };
  }

  const masteryOf = (key) => progressByTopic.get(key)?.mastery ?? 0;

  const capacityMinutes = days.length * dailyMinutes;
  const learningBudget = Math.round(capacityMinutes * (1 - RESERVED_RATIO));

  const ordered = orderByPrerequisitesThenPriority(topics, masteryOf);

  // Time already spent on a topic counts. Without this, re-planning after a
  // missed day would send the student back to the beginning of material they
  // have already worked through.
  const requested = ordered
    .map((topic) => {
      const mastery = masteryOf(topic.key);
      const invested = progressByTopic.get(topic.key)?.minutesStudied ?? 0;

      return {
        topic,
        minutes: Math.max(0, minutesFor(topic, mastery) - invested),
        reason: explain(topic, mastery),
      };
    })
    .filter((item) => item.minutes > 0);

  const demandMinutes = requested.reduce((sum, item) => sum + item.minutes, 0);
  const compression = demandMinutes > learningBudget ? learningBudget / demandMinutes : 1;

  const allocations = requested
    .map((item) => ({ ...item, minutes: Math.round(item.minutes * compression) }))
    .filter((item) => item.minutes >= MIN_USEFUL_ALLOCATION);

  const droppedByCompression = requested
    .filter((item) => Math.round(item.minutes * compression) < MIN_USEFUL_ALLOCATION)
    .map((item) => item.topic.key);

  const book = new DayBook(days, dailyMinutes);

  // A student with ten free days and four hours of material should not study
  // for four hours a day and then stop. Learning is capped at the pace that
  // spreads the work evenly, so the plan stays sustainable and the reserved
  // time for revision survives.
  const learningDemand = allocations.reduce((sum, item) => sum + item.minutes, 0);
  book.setCap(pacePerDay(learningDemand, days.length, dailyMinutes));

  const { unplaced, lastDayByTopic } = placeLearningSessions(book, allocations);

  // Revision and tests may use the whole day, including time learning left free.
  book.setCap(dailyMinutes);

  placeRevisionSessions(book, lastDayByTopic, topics, progressByTopic, days);
  placeMockTests(book, topics, masteryOf);

  return {
    startDate: days[0],
    endDate: days[days.length - 1],
    sessions: book.finalise(),
    unscheduledTopicKeys: [...new Set([...droppedByCompression, ...unplaced])],
    diagnostics: {
      capacityMinutes,
      demandMinutes,
      compression: Number(compression.toFixed(3)),
      availableDays: days.length,
    },
  };
}

/**
 * Minutes of new material per day: enough to finish everything by the deadline,
 * rounded to a tidy five minutes, and never more than the student offered.
 */
function pacePerDay(demandMinutes, dayCount, dailyMinutes) {
  const even = Math.ceil(demandMinutes / dayCount / 5) * 5;
  return Math.min(dailyMinutes, Math.max(MIN_SESSION_MINUTES, even));
}

/**
 * The deadline is usually the exam itself, so the last day of study is the day
 * before it. If that leaves nothing, the student is cramming today and we use
 * the deadline day.
 */
function resolveLastStudyDay(start, deadline) {
  const dayBefore = addDays(deadline, -1);
  return daysBetween(start, dayBefore) >= 0 ? dayBefore : startOfDay(deadline);
}

/**
 * Kahn's algorithm, but instead of taking any ready topic it always takes the
 * most urgent one — highest exam weight, lowest mastery. Prerequisites are still
 * respected absolutely; priority only decides between topics that are all
 * equally unblocked.
 */
function orderByPrerequisitesThenPriority(topics, masteryOf) {
  const byKey = new Map(topics.map((topic) => [topic.key, topic]));
  const blockedCount = new Map();
  const unlocks = new Map();

  for (const topic of topics) {
    const prerequisites = (topic.prerequisites ?? []).filter(
      (key) => byKey.has(key) && key !== topic.key,
    );

    blockedCount.set(topic.key, prerequisites.length);

    for (const prerequisite of prerequisites) {
      if (!unlocks.has(prerequisite)) {
        unlocks.set(prerequisite, []);
      }
      unlocks.get(prerequisite).push(topic.key);
    }
  }

  const urgency = (topic) => topic.weight * (1 - masteryOf(topic.key));

  const ready = topics.filter((topic) => blockedCount.get(topic.key) === 0);
  const ordered = [];

  while (ready.length > 0) {
    ready.sort((a, b) => urgency(b) - urgency(a));

    const next = ready.shift();
    ordered.push(next);

    for (const dependent of unlocks.get(next.key) ?? []) {
      const remaining = blockedCount.get(dependent) - 1;
      blockedCount.set(dependent, remaining);

      if (remaining === 0) {
        ready.push(byKey.get(dependent));
      }
    }
  }

  // Anything still unvisited sits in a prerequisite cycle. The graph is
  // sanitised before it reaches here, so this is a safety net rather than an
  // expected path — append by urgency so nothing is silently lost.
  if (ordered.length < topics.length) {
    const placed = new Set(ordered.map((topic) => topic.key));

    ordered.push(
      ...topics.filter((topic) => !placed.has(topic.key)).sort((a, b) => urgency(b) - urgency(a)),
    );
  }

  return ordered;
}

/**
 * A topic the student already knows still deserves a look, but not the full
 * hour. A topic they have never met gets its whole estimate, adjusted for how
 * hard it is.
 */
function minutesFor(topic, mastery) {
  if (mastery >= MASTERED_THRESHOLD) {
    return REFRESH_MINUTES;
  }

  const gapFactor = 0.3 + 0.7 * (1 - mastery);
  const difficultyFactor = 0.85 + (topic.difficulty - 1) * 0.075;

  return Math.round(topic.estimatedMinutes * gapFactor * difficultyFactor);
}

function explain(topic, mastery) {
  if (mastery >= MASTERED_THRESHOLD) {
    return 'You already know this — a quick refresh is enough.';
  }

  if (mastery < 0.35) {
    return topic.weight >= 4
      ? 'Weakest area, and it carries a lot of marks. This gets the most time.'
      : 'One of your weaker areas, so it comes early while you are fresh.';
  }

  if (mastery < 0.6) {
    return 'You have the basics — this session is to make them solid.';
  }

  return topic.weight >= 4 ? 'Heavily weighted in the exam, so worth a full pass.' : 'Steady progress on a topic you are close to.';
}

function placeLearningSessions(book, allocations) {
  const unplaced = [];
  const lastDayByTopic = new Map();
  let cursor = 0;

  for (const { topic, minutes, reason } of allocations) {
    let remaining = minutes;
    let placedAnything = false;

    while (remaining > 0) {
      const wanted = Math.min(remaining, MAX_SESSION_MINUTES);
      const acceptable = Math.min(wanted, MIN_SESSION_MINUTES);
      const dayIndex = book.firstDayWithRoom(acceptable, cursor);

      if (dayIndex === -1) {
        break;
      }

      let chunk = Math.min(wanted, book.roomOn(dayIndex));
      const leftover = remaining - chunk;

      // Never leave a stub too short to be worth opening a book for. Fold it
      // into this session if the day can genuinely take it — the pacing cap can
      // be nudged, the student's stated daily limit cannot — and otherwise give
      // up the last few minutes rather than schedule a one-minute session.
      if (leftover > 0 && leftover < MIN_SESSION_MINUTES) {
        if (book.hardRoomOn(dayIndex) >= chunk + leftover) {
          chunk += leftover;
        } else {
          remaining = chunk;
        }
      }

      book.book(dayIndex, {
        topicKey: topic.key,
        title: topic.title,
        kind: 'learn',
        minutes: chunk,
        reason,
      });

      remaining -= chunk;
      // Staying on this day until it is full keeps prerequisites ahead of the
      // topics that depend on them.
      cursor = dayIndex;
      placedAnything = true;
      lastDayByTopic.set(topic.key, book.dayAt(dayIndex));
    }

    if (!placedAnything) {
      unplaced.push(topic.key);
    }
  }

  return { unplaced, lastDayByTopic };
}

/**
 * Two sources of revision: topics learned inside this plan, which get expanding
 * gaps after their last session, and topics already carrying a due date from an
 * earlier round of study.
 */
function placeRevisionSessions(book, lastDayByTopic, topics, progressByTopic, days) {
  const horizonEnd = days[days.length - 1];
  const titleOf = new Map(topics.map((topic) => [topic.key, topic.title]));
  const wanted = [];

  for (const [topicKey, learnedOn] of lastDayByTopic) {
    for (const day of initialReviewDays(learnedOn, horizonEnd)) {
      wanted.push({ topicKey, day, reason: 'Spaced revision so this does not fade before the exam.' });
    }
  }

  for (const [topicKey, progress] of progressByTopic) {
    if (!progress.dueAt || lastDayByTopic.has(topicKey) || !titleOf.has(topicKey)) {
      continue;
    }

    const due = startOfDay(progress.dueAt);

    if (due >= days[0] && due <= horizonEnd) {
      wanted.push({ topicKey, day: due, reason: 'Due for revision today under your recall schedule.' });
    }
  }

  for (const { topicKey, day, reason } of wanted) {
    const dayIndex = book.indexOfDayOnOrAfter(day, REVISION_MINUTES);

    if (dayIndex === -1) {
      continue;
    }

    book.book(dayIndex, {
      topicKey,
      title: titleOf.get(topicKey) ?? topicKey,
      kind: 'revise',
      minutes: REVISION_MINUTES,
      reason,
    });
  }
}

/**
 * One mock test roughly two thirds of the way through, and one on the last
 * study day. Both are pinned to the topic the student is weakest on, which is
 * what the generator will build questions from.
 */
function placeMockTests(book, topics, masteryOf) {
  if (topics.length === 0 || book.dayCount < 2) {
    return;
  }

  const focus = [...topics].sort(
    (a, b) => b.weight * (1 - masteryOf(b.key)) - a.weight * (1 - masteryOf(a.key)),
  )[0];

  const checkpoints = [
    { index: Math.floor(book.dayCount * 0.66), reason: 'Checkpoint test — find out what has actually stuck.' },
    { index: book.dayCount - 1, reason: 'Final mock test before the deadline.' },
  ];

  for (const { index, reason } of checkpoints) {
    const dayIndex = book.firstDayWithRoom(MOCK_TEST_MINUTES, index);

    if (dayIndex === -1) {
      continue;
    }

    book.book(dayIndex, {
      topicKey: focus.key,
      title: 'Mock test',
      kind: 'test',
      minutes: MOCK_TEST_MINUTES,
      reason,
    });
  }
}

/**
 * Tracks how much of each day is still free and collects the sessions booked
 * into it. Keeping the bookkeeping in one place is what stops the placement
 * functions from having to think about capacity at all.
 */
class DayBook {
  constructor(days, dailyMinutes) {
    this.days = days;
    this.dailyMinutes = dailyMinutes;
    this.used = days.map(() => 0);
    this.cap = dailyMinutes;
    this.indexByDate = new Map(days.map((day, index) => [toDateKey(day), index]));
    this.entries = [];
  }

  get dayCount() {
    return this.days.length;
  }

  /**
   * The working ceiling for the current phase. Learning runs under a lower cap
   * so the work spreads out; revision then opens the day back up.
   */
  setCap(minutes) {
    this.cap = Math.min(this.dailyMinutes, minutes);
  }

  dayAt(index) {
    return this.days[index];
  }

  roomOn(index) {
    return Math.max(0, this.cap - this.used[index]);
  }

  /** Room left against the student's actual daily limit, ignoring the pacing cap. */
  hardRoomOn(index) {
    return Math.max(0, this.dailyMinutes - this.used[index]);
  }

  firstDayWithRoom(minutes, fromIndex = 0) {
    for (let index = Math.max(0, fromIndex); index < this.days.length; index += 1) {
      if (this.roomOn(index) >= minutes) {
        return index;
      }
    }

    return -1;
  }

  indexOfDayOnOrAfter(day, minutes) {
    const target = toDateKey(day);
    const exact = this.indexByDate.get(target);

    // The requested day may not be one the student studies on, so fall forward
    // to the next day they do — never backwards to the start of the plan.
    const from = exact ?? this.days.findIndex((candidate) => toDateKey(candidate) >= target);

    return from === -1 ? -1 : this.firstDayWithRoom(minutes, from);
  }

  book(index, session) {
    this.used[index] += session.minutes;
    this.entries.push({ ...session, dayIndex: index, sequence: this.entries.length });
  }

  /**
   * Groups by day and numbers the sessions within each one, so the interface
   * can show "session 2 of 4 today" without recomputing anything.
   */
  finalise() {
    const byDay = new Map();

    for (const entry of this.entries) {
      if (!byDay.has(entry.dayIndex)) {
        byDay.set(entry.dayIndex, []);
      }
      byDay.get(entry.dayIndex).push(entry);
    }

    const sessions = [];

    for (const dayIndex of [...byDay.keys()].sort((a, b) => a - b)) {
      const entriesForDay = byDay.get(dayIndex).sort((a, b) => rank(a) - rank(b) || a.sequence - b.sequence);

      entriesForDay.forEach((entry, position) => {
        sessions.push({
          date: this.days[dayIndex],
          order: position + 1,
          topicKey: entry.topicKey,
          title: entry.title,
          kind: entry.kind,
          minutes: entry.minutes,
          reason: entry.reason,
          status: 'pending',
        });
      });
    }

    return sessions;
  }
}

// Within a day: revise first as a warm-up, then new material, then practice.
const KIND_ORDER = { revise: 0, learn: 1, practice: 2, test: 3 };
const rank = (entry) => KIND_ORDER[entry.kind] ?? 9;
