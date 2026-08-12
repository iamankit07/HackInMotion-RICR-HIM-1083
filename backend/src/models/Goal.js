import mongoose from 'mongoose';

export const CONFIDENCE_LEVELS = ['beginner', 'intermediate', 'advanced'];
export const GOAL_STATUSES = ['draft', 'assessing', 'active', 'completed', 'archived'];

/**
 * One node of the topic graph the AI produces for a subject. Topics reference
 * each other by `key` rather than by id so the whole graph can be regenerated
 * or hand-edited without repairing object references.
 */
const topicSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '', trim: true },

    // 1 = straightforward, 5 = the thing everyone loses marks on.
    difficulty: { type: Number, min: 1, max: 5, default: 3 },

    // How much this topic is worth in the exam, relative to its siblings.
    weight: { type: Number, min: 1, max: 5, default: 3 },

    estimatedMinutes: { type: Number, min: 10, max: 600, default: 60 },

    // Keys of topics that should be studied first.
    prerequisites: { type: [String], default: [] },
  },
  { _id: false },
);

const goalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    subject: { type: String, required: true, trim: true, maxlength: 120 },
    examType: { type: String, trim: true, maxlength: 120, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },

    deadline: { type: Date, required: true },
    dailyMinutes: { type: Number, required: true, min: 15, max: 960 },

    // Weekdays the student can actually study, 0 = Sunday. Defaults to every day.
    studyDays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },

    confidence: { type: String, enum: CONFIDENCE_LEVELS, required: true },

    status: { type: String, enum: GOAL_STATUSES, default: 'draft', index: true },

    topics: { type: [topicSchema], default: [] },
    topicsGeneratedAt: { type: Date },

    // Set when the topic graph had to be built without a working AI provider.
    topicsFromFallback: { type: Boolean, default: false },
  },
  { timestamps: true },
);

goalSchema.index({ user: 1, createdAt: -1 });

goalSchema.virtual('daysRemaining').get(function daysRemaining() {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((this.deadline - Date.now()) / msPerDay));
});

goalSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, output) {
    delete output._id;
    return output;
  },
});

export const Goal = mongoose.model('Goal', goalSchema);
