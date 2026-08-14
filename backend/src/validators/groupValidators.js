import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'That is not a valid goal');

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Give the group a name').max(80),
  goalId: objectId,
});

export const joinGroupSchema = z.object({
  // Codes are read off a screen and typed by hand, so case and stray spaces
  // are forgiven rather than rejected.
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'A join code is six letters and numbers'),
  goalId: objectId,
});
