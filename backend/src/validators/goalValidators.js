import { z } from 'zod';

import { CONFIDENCE_LEVELS } from '../models/Goal.js';

const deadline = z.coerce
  .date({ invalid_type_error: 'Pick a valid date' })
  .refine((value) => value.getTime() > Date.now(), 'Your deadline needs to be in the future');

export const createGoalSchema = z.object({
  subject: z.string().trim().min(2, 'What are you studying?').max(120),
  examType: z.string().trim().max(120).default(''),
  notes: z.string().trim().max(1000).default(''),
  deadline,
  dailyMinutes: z.coerce
    .number()
    .int()
    .min(15, 'Give yourself at least 15 minutes a day')
    .max(960, 'That is more than 16 hours a day'),
  studyDays: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, 'Pick at least one day you can study')
    .max(7)
    .default([0, 1, 2, 3, 4, 5, 6]),
  confidence: z.enum(CONFIDENCE_LEVELS, {
    errorMap: () => ({ message: 'Choose beginner, intermediate or advanced' }),
  }),
});

export const updateGoalSchema = createGoalSchema.partial();

export const manualTopicsSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(120),
        summary: z.string().trim().max(400).default(''),
        difficulty: z.coerce.number().int().min(1).max(5).default(3),
        weight: z.coerce.number().int().min(1).max(5).default(3),
        estimatedMinutes: z.coerce.number().int().min(10).max(600).default(60),
        prerequisites: z.array(z.string()).default([]),
      }),
    )
    .min(1, 'Add at least one topic')
    .max(30, 'That is more topics than a plan can use'),
});
