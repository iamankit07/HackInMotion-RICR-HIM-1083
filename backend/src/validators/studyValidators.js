import { z } from 'zod';

import { SESSION_STATUSES } from '../models/Plan.js';

export const createQuizSchema = z.object({
  questionCount: z.coerce.number().int().min(3).max(15).default(8),
  topicKeys: z.array(z.string()).max(10).optional(),
});

export const submitAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionIndex: z.coerce.number().int().min(0),
        selectedIndex: z.coerce.number().int().min(0),
      }),
    )
    .min(1, 'Answer at least one question before submitting'),
});

export const updateSessionSchema = z.object({
  status: z.enum(SESSION_STATUSES, {
    errorMap: () => ({ message: 'A session can be pending, completed or skipped' }),
  }),
});

export const replanSchema = z.object({
  reason: z.string().trim().max(60).optional(),
});

/** A doubt asked from the dashboard: just the question, no topic to scope it. */
export const askDoubtSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Ask a question and the tutor will answer it')
    .max(2000, 'That question is longer than the tutor can take in one go'),
});

export const askTutorSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Ask a question and the tutor will answer it')
    .max(2000, 'That question is longer than the tutor can take in one go'),
  topicKey: z.string().trim().optional(),
});
