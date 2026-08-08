import { z } from 'zod';

export const emailVerificationRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) })
  .strict();

export const emailVerificationConfirmationSchema = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
  .strict();

export type EmailVerificationRequest = z.infer<
  typeof emailVerificationRequestSchema
>;
export type EmailVerificationConfirmation = z.infer<
  typeof emailVerificationConfirmationSchema
>;
