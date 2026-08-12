import mongoose from 'mongoose';

export const ASSESSMENT_KINDS = ['diagnostic', 'mock'];

const questionSchema = new mongoose.Schema(
  {
    topicKey: { type: String, required: true },
    prompt: { type: String, required: true },
    options: {
      type: [String],
      required: true,
      validate: [(value) => value.length >= 2, 'a question needs at least two options'],
    },
    correctIndex: { type: Number, required: true, min: 0 },
    explanation: { type: String, default: '' },
    difficulty: { type: Number, min: 1, max: 5, default: 3 },

    // Filled in when the student answers.
    selectedIndex: { type: Number, default: null },
  },
  { _id: false },
);

const assessmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },

    kind: { type: String, enum: ASSESSMENT_KINDS, required: true },
    title: { type: String, default: '' },

    questions: { type: [questionSchema], default: [] },

    submittedAt: { type: Date },
    score: { type: Number, default: 0 },

    // True when the questions came from the offline fallback rather than the AI.
    fromFallback: { type: Boolean, default: false },
  },
  { timestamps: true },
);

assessmentSchema.index({ user: 1, goal: 1, createdAt: -1 });

assessmentSchema.virtual('isSubmitted').get(function isSubmitted() {
  return Boolean(this.submittedAt);
});

/**
 * The version safe to send before the student has answered — the correct answer
 * and explanation are held back so they cannot be read out of the response.
 */
assessmentSchema.methods.toQuestionPaper = function toQuestionPaper() {
  return {
    id: this.id,
    kind: this.kind,
    title: this.title,
    createdAt: this.createdAt,
    submittedAt: this.submittedAt,
    questions: this.questions.map((question, index) => ({
      index,
      topicKey: question.topicKey,
      prompt: question.prompt,
      options: question.options,
      difficulty: question.difficulty,
    })),
  };
};

/**
 * The full version, including answers, shown after submission.
 */
assessmentSchema.methods.toResultSheet = function toResultSheet() {
  return {
    id: this.id,
    kind: this.kind,
    title: this.title,
    score: this.score,
    total: this.questions.length,
    submittedAt: this.submittedAt,
    questions: this.questions.map((question, index) => ({
      index,
      topicKey: question.topicKey,
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correctIndex,
      selectedIndex: question.selectedIndex,
      wasCorrect: question.selectedIndex === question.correctIndex,
      explanation: question.explanation,
    })),
  };
};

assessmentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, output) {
    delete output._id;
    return output;
  },
});

export const Assessment = mongoose.model('Assessment', assessmentSchema);
