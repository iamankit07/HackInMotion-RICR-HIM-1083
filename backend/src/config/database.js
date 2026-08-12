import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Mongoose will keep retrying.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected.');
  });

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const { host, name } = mongoose.connection;
  console.log(`MongoDB connected — ${host}/${name}`);

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
}
