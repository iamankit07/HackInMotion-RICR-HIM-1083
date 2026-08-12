import { addDays, startOfDay } from '../utils/dates.js';

/**
 * SM-2, the SuperMemo scheduling algorithm, adapted for topic-level recall
 * rather than individual flashcards.
 *
 * The idea it is built on: the right moment to revise something is just before
 * you would have forgotten it, and that moment gets later every time you
 * successfully recall it. Each topic carries an ease factor that grows when
 * recall is easy and shrinks when it is not, and the gap to the next revision
 * is multiplied by it.
 *
 * A wrong answer resets the ladder — the topic goes back to being revised
 * tomorrow — which is what makes a failed re-test visibly reshape the plan.
 */

const MIN_EASE_FACTOR = 1.3;
const FIRST_INTERVAL_DAYS = 1;
const SECOND_INTERVAL_DAYS = 6;

/**
 * @param state    current { repetitions, easeFactor, intervalDays }
 * @param accuracy proportion of questions answered correctly, 0–1
 */
export function review(state, accuracy, today = new Date()) {
  const quality = Math.round(clamp(accuracy, 0, 1) * 5);
  const recalled = quality >= 3;

  const easeFactor = Math.max(
    MIN_EASE_FACTOR,
    (state.easeFactor ?? 2.5) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  if (!recalled) {
    return {
      repetitions: 0,
      easeFactor,
      intervalDays: FIRST_INTERVAL_DAYS,
      dueAt: addDays(today, FIRST_INTERVAL_DAYS),
    };
  }

  const repetitions = (state.repetitions ?? 0) + 1;
  const intervalDays = nextInterval(repetitions, state.intervalDays ?? 0, easeFactor);

  return {
    repetitions,
    easeFactor,
    intervalDays,
    dueAt: addDays(today, intervalDays),
  };
}

function nextInterval(repetitions, previousInterval, easeFactor) {
  if (repetitions === 1) {
    return FIRST_INTERVAL_DAYS;
  }

  if (repetitions === 2) {
    return SECOND_INTERVAL_DAYS;
  }

  return Math.max(1, Math.round(previousInterval * easeFactor));
}

/**
 * Revision days for a topic that has just been learned, used when there is no
 * review history to work from yet. Expanding gaps, clipped to the horizon.
 */
export function initialReviewDays(learnedOn, horizonEnd) {
  return [2, 6, 14]
    .map((gap) => addDays(learnedOn, gap))
    .filter((day) => day <= startOfDay(horizonEnd));
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
