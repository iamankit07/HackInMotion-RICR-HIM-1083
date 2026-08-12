import { Progress } from '../models/Progress.js';
import { estimateMastery, priorFor, rankWeakTopics, statusFor } from './mastery.js';
import { review } from './spacedRepetition.js';

/**
 * Keeps the per-topic picture of the student up to date: what they know, how
 * much time they have put in, and when each topic is next due for revision.
 */

/**
 * Every topic in the graph gets a record the moment the graph exists, seeded
 * with the student's self-rating. That way the first plan can be built before
 * they have answered a single question.
 */
export async function ensureProgressRecords(goal) {
  const prior = priorFor(goal.confidence);

  const operations = goal.topics.map((topic) => ({
    updateOne: {
      filter: { goal: goal._id, topicKey: topic.key },
      update: {
        $setOnInsert: {
          user: goal.user,
          goal: goal._id,
          topicKey: topic.key,
          mastery: prior,
          status: 'not_started',
        },
      },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await Progress.bulkWrite(operations);
  }

  return progressMapFor(goal);
}

export async function progressMapFor(goal) {
  const records = await Progress.find({ goal: goal._id }).lean();
  return new Map(records.map((record) => [record.topicKey, record]));
}

/**
 * Folds a graded assessment back into what we believe about the student.
 *
 * Each topic's mastery is recomputed from its full history rather than nudged,
 * so results stay consistent no matter what order tests were taken in, and the
 * spaced repetition ladder advances or resets based on how they did.
 */
export async function applyAssessmentResults(goal, assessment) {
  const prior = priorFor(goal.confidence);
  const perTopic = new Map();

  for (const question of assessment.questions) {
    if (question.selectedIndex === null || question.selectedIndex === undefined) {
      continue;
    }

    const tally = perTopic.get(question.topicKey) ?? { answered: 0, correct: 0 };

    tally.answered += 1;
    tally.correct += question.selectedIndex === question.correctIndex ? 1 : 0;

    perTopic.set(question.topicKey, tally);
  }

  const updated = [];

  for (const [topicKey, tally] of perTopic) {
    const record =
      (await Progress.findOne({ goal: goal._id, topicKey })) ??
      new Progress({ user: goal.user, goal: goal._id, topicKey });

    record.questionsAnswered += tally.answered;
    record.questionsCorrect += tally.correct;

    record.mastery = estimateMastery({
      prior,
      questionsCorrect: record.questionsCorrect,
      questionsAnswered: record.questionsAnswered,
    });

    const recall = review(record, tally.correct / tally.answered);

    record.repetitions = recall.repetitions;
    record.easeFactor = recall.easeFactor;
    record.intervalDays = recall.intervalDays;
    record.dueAt = recall.dueAt;

    record.status = statusFor(record.mastery, record.questionsAnswered);

    await record.save();
    updated.push(record);
  }

  return updated;
}

/**
 * Called when a study session is ticked off. Time spent is recorded so the
 * scheduler does not send the student back over ground they have covered.
 * Mastery deliberately does not move here — sitting through a session is not
 * evidence of understanding, only a quiz is.
 */
export async function recordSessionCompleted(goal, session) {
  await Progress.updateOne(
    { goal: goal._id, topicKey: session.topicKey },
    {
      $inc: { minutesStudied: session.minutes, sessionsCompleted: 1 },
      $set: { lastStudiedAt: new Date() },
      $setOnInsert: { user: goal.user, goal: goal._id, topicKey: session.topicKey },
    },
    { upsert: true },
  );
}

export async function summariseProgress(goal) {
  const progressByTopic = await progressMapFor(goal);

  const mastery = goal.topics.map((topic) => progressByTopic.get(topic.key)?.mastery ?? 0);
  const average = mastery.length
    ? mastery.reduce((sum, value) => sum + value, 0) / mastery.length
    : 0;

  return {
    topicsTotal: goal.topics.length,
    topicsMastered: [...progressByTopic.values()].filter((record) => record.status === 'mastered').length,
    averageMastery: Number(average.toFixed(3)),
    weakestTopics: rankWeakTopics(goal.topics, progressByTopic),
    byTopic: goal.topics.map((topic) => {
      const record = progressByTopic.get(topic.key);

      return {
        topicKey: topic.key,
        title: topic.title,
        mastery: record?.mastery ?? 0,
        status: record?.status ?? 'not_started',
        questionsAnswered: record?.questionsAnswered ?? 0,
        minutesStudied: record?.minutesStudied ?? 0,
        dueAt: record?.dueAt ?? null,
      };
    }),
  };
}
