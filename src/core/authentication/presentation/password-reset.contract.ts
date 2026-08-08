import { z } from 'zod';

export const passwordResetRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) })
  .strict();

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

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmation = z.infer<
  typeof passwordResetConfirmationSchema
>;
