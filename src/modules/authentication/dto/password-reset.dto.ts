import { z } from 'zod';

/** Strict enumeration-resistant password-reset request schema. */
export const passwordResetRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) })
  .strict();

/** Strict reset-confirmation schema for a fixed-shape token and bounded password. */
export const passwordResetConfirmationSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    newPassword: z
      .string()
      .min(1)
      .max(512)
      .superRefine((password, context) => {
        if (
          [...password.normalize('NFC')].length > 128 ||
          Buffer.byteLength(password, 'utf8') > 512
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Password is too long.',
          });
        }
      }),
  })
  .strict();

/** Validated password-reset email request. */
export type PasswordResetRequestDto = z.infer<
  typeof passwordResetRequestSchema
>;
/** Validated password-reset confirmation request. */
export type PasswordResetConfirmationDto = z.infer<
  typeof passwordResetConfirmationSchema
>;
