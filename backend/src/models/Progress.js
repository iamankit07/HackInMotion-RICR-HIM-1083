import mongoose from 'mongoose';

export const PROGRESS_STATES = ['not_started', 'learning', 'review', 'mastered'];

/**
 * What we believe the student knows about one topic, and when they should see
 * it again. One document per topic per goal.
 *
 * `mastery` is a 0–1 estimate blended from their self-rating and their actual
 * quiz results — see services/mastery.js for how the two are combined.
 */
const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    topicKey: { type: String, required: true },

    mastery: { type: Number, min: 0, max: 1, default: 0 },

    questionsAnswered: { type: Number, default: 0 },
    questionsCorrect: { type: Number, default: 0 },

    minutesStudied: { type: Number, default: 0 },
    sessionsCompleted: { type: Number, default: 0 },

    status: { type: String, enum: PROGRESS_STATES, default: 'not_started' },

    // SM-2 spaced repetition state. `dueAt` is what the scheduler reads when it
    // decides which topics need a revision session.
    repetitions: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 },
    intervalDays: { type: Number, default: 0 },
    dueAt: { type: Date },

    lastStudiedAt: { type: Date },
  },
  { timestamps: true },
);

progressSchema.index({ goal: 1, topicKey: 1 }, { unique: true });

progressSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, output) {
    delete output._id;
    return output;
  },
});

export const Progress = mongoose.model('Progress', progressSchema);
