import { z } from 'zod';

export const registrationRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z
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
    displayName: z.string().trim().min(1).max(100),
    organizationName: z.string().trim().min(1).max(120),
    workspaceName: z.string().trim().min(1).max(120),
  })
  .strict();

export type RegistrationRequest = z.infer<typeof registrationRequestSchema>;
