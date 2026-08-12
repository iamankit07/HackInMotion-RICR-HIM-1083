import mongoose from 'mongoose';

export const SESSION_KINDS = ['learn', 'revise', 'practice', 'test'];
export const SESSION_STATUSES = ['pending', 'completed', 'skipped'];

const sessionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },

    // Position within that day, so the student always has a clear "next thing".
    order: { type: Number, required: true },

    topicKey: { type: String, required: true },
    title: { type: String, required: true },
    kind: { type: String, enum: SESSION_KINDS, default: 'learn' },
    minutes: { type: Number, required: true, min: 5 },

    // Shown in the interface so the plan explains itself: "you scored 2/5 here"
    // reads very differently from an unexplained block of time.
    reason: { type: String, default: '' },

    status: { type: String, enum: SESSION_STATUSES, default: 'pending' },
    completedAt: { type: Date },
  },
  { _id: true },
);

const planSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },

    // Bumped every time the plan is rebuilt, so earlier versions stay readable
    // and we can show that the plan genuinely adapted.
    version: { type: Number, default: 1 },
    isCurrent: { type: Boolean, default: true, index: true },

    // Why this version exists: first build, student fell behind, re-test failed.
    reason: { type: String, default: 'initial' },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    sessions: { type: [sessionSchema], default: [] },

    // Topics the timetable could not fit before the deadline. Surfaced honestly
    // in the interface instead of silently dropped.
    unscheduledTopicKeys: { type: [String], default: [] },
  },
  { timestamps: true },
);

planSchema.index({ goal: 1, version: -1 });

planSchema.virtual('totalMinutes').get(function totalMinutes() {
  return this.sessions.reduce((sum, session) => sum + session.minutes, 0);
});

planSchema.virtual('completedMinutes').get(function completedMinutes() {
  return this.sessions
    .filter((session) => session.status === 'completed')
    .reduce((sum, session) => sum + session.minutes, 0);
});

planSchema.virtual('completionPercent').get(function completionPercent() {
  if (this.sessions.length === 0) {
    return 0;
  }

  const done = this.sessions.filter((session) => session.status === 'completed').length;
  return Math.round((done / this.sessions.length) * 100);
});

planSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, output) {
    delete output._id;
    return output;
  },
});

export const Plan = mongoose.model('Plan', planSchema);
