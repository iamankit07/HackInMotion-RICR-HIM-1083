import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80, 'That name is too long'),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(128, 'That password is too long')
    .regex(/[a-zA-Z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});
