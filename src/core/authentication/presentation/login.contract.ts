import { z } from 'zod';

/** Strict login schema with an optional accessible-workspace selector. */
export const loginRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
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
    workspaceId: z.uuid().optional(),
  })
  .strict();

/** Validated login request accepted by the controller. */
export type LoginRequest = z.infer<typeof loginRequestSchema>;
