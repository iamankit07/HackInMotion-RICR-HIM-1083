import mongoose from 'mongoose';

/**
 * A few students working towards the same thing.
 *
 * Membership pairs a person with one of *their own* goals — the group compares
 * progress across separate plans rather than sharing one. Nothing about a goal
 * is stored here: the group only ever holds references, and what members can
 * see of each other is assembled at read time as a deliberately narrow summary.
 */

// No O/0 or I/1: these get read aloud and typed in by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Which of their goals they are comparing. A student preparing for two
    // exams joins with the one this group is about.
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true },

    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const studyGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },

    // What people share to invite each other. Indexed because joining looks a
    // group up by nothing else.
    joinCode: { type: String, required: true, unique: true, index: true, uppercase: true },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true },
);

// Every read is "which groups am I in", so the members' user ids are the index.
studyGroupSchema.index({ 'members.user': 1 });

studyGroupSchema.methods.hasMember = function hasMember(userId) {
  return this.members.some((member) => member.user.equals(userId));
};

studyGroupSchema.methods.memberFor = function memberFor(userId) {
  return this.members.find((member) => member.user.equals(userId));
};

studyGroupSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, output) {
    delete output._id;
    return output;
  },
});

/**
 * Codes are random rather than sequential so one group's code tells you nothing
 * about another's. Collisions are retried rather than assumed away.
 */
export async function generateJoinCode(Model, attempts = 8) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = Array.from(
      { length: CODE_LENGTH },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');

    const taken = await Model.exists({ joinCode: code });
    if (!taken) return code;
  }

  throw new Error('Could not allocate an unused join code');
}

export const StudyGroup = mongoose.model('StudyGroup', studyGroupSchema);
