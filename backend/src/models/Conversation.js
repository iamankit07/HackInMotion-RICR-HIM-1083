import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },

    // Which topic the student was looking at when they asked. Lets the tutor
    // stay on subject and lets us show doubts alongside the topic later.
    topicKey: { type: String, default: null },

    // Set when the answer came from the offline fallback rather than a model.
    degraded: { type: Boolean, default: false },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
);

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Null for a one-off doubt asked from the dashboard. Not every question a
    // student has belongs to a syllabus they have set up.
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null, index: true },

    title: { type: String, default: 'New conversation', trim: true, maxlength: 120 },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true },
);

conversationSchema.index({ user: 1, goal: 1, updatedAt: -1 });

conversationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, output) {
    delete output._id;
    return output;
  },
});

export const Conversation = mongoose.model('Conversation', conversationSchema);
