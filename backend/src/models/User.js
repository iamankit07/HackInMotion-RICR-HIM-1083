import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please tell us your name'],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'An email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);

userSchema.statics.hashPassword = (plainText) => bcrypt.hash(plainText, SALT_ROUNDS);

userSchema.methods.verifyPassword = function verifyPassword(plainText) {
  return bcrypt.compare(plainText, this.passwordHash);
};

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, output) {
    delete output._id;
    delete output.passwordHash;
    return output;
  },
});

export const User = mongoose.model('User', userSchema);
