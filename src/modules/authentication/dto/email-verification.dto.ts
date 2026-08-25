import { z } from 'zod';

/** Strict enumeration-resistant verification-link request schema. */
export const emailVerificationRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) })
  .strict();

/** Strict confirmation schema for the fixed-shape verification token. */
export const emailVerificationConfirmationSchema = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
  .strict();

/** Validated request for a replacement email-verification link. */
export type EmailVerificationRequestDto = z.infer<
  typeof emailVerificationRequestSchema
>;
/** Validated email-verification confirmation. */
export type EmailVerificationConfirmationDto = z.infer<
  typeof emailVerificationConfirmationSchema
>;
