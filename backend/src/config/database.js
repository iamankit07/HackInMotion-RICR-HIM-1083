import mongoose from 'mongoose';
import { env, isProduction } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Mongoose will keep retrying.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected.');
  });

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error.message);
  });

  await mongoose.connect(env.MONGODB_URI, {
    // Atlas's free tier allows a few hundred connections across the whole
    // cluster. Mongoose would otherwise open up to a hundred per process, so a
    // couple of instances could exhaust it on their own. Ten is plenty for an
    // API that spends most of its time waiting on an AI provider rather than
    // on the database.
    maxPoolSize: isProduction ? 10 : 5,
    minPoolSize: 1,

    // Fail a request in ten seconds rather than hanging on a cluster that is
    // asleep, unreachable, or behind an IP allowlist nobody updated.
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,

    // Drop connections that have been idle long enough that the platform's
    // network has probably already forgotten about them.
    maxIdleTimeMS: 60_000,

    retryWrites: true,
  });

  const { host, name } = mongoose.connection;
  console.log(`MongoDB connected — ${host}/${name}`);

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
}

/** 1 is connected. Anything else means we cannot serve a request that needs data. */
export const isDatabaseReady = () => mongoose.connection.readyState === 1;
