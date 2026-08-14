import { z } from 'zod';

/** Strict authenticated password-change transport schema. */
export const passwordChangeSchema = z
  .object({
    currentPassword: passwordInput(),
    newPassword: passwordInput(),
  })
  .strict();

/** Validated password-change request accepted by the controller. */
export type PasswordChangeRequest = z.infer<typeof passwordChangeSchema>;

/** Bounds raw password transport input before domain normalization and policy checks. */
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
