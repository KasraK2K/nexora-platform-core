import { z } from 'zod';

export const passwordChangeSchema = z
  .object({
    currentPassword: passwordInput(),
    newPassword: passwordInput(),
  })
  .strict();

export type PasswordChangeRequest = z.infer<typeof passwordChangeSchema>;

function passwordInput() {
  return z
    .string()
    .min(1)
    .max(512)
    .superRefine((password, context) => {
      const normalized = password.normalize('NFC');
      if (
        [...normalized].length > 128 ||
        Buffer.byteLength(normalized, 'utf8') > 512
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Password is too long.',
        });
      }
    });
}
