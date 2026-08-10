import { z } from 'zod';
import { normalizeIdentityEmail } from '../../identity/application/identity-lookup';

export const createMembershipInvitationSchema = z
  .object({
    email: z
      .string()
      .transform(normalizeIdentityEmail)
      .pipe(z.email().max(254)),
    role: z.enum(['ADMIN', 'MEMBER']),
  })
  .strict();

export type CreateMembershipInvitationRequest = z.infer<
  typeof createMembershipInvitationSchema
>;

export const acceptMembershipInvitationSchema = z
  .object({ token: z.string().length(43) })
  .strict();

export type AcceptMembershipInvitationRequest = z.infer<
  typeof acceptMembershipInvitationSchema
>;
