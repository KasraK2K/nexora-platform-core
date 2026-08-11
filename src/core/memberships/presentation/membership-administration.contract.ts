import { z } from 'zod';

export const listWorkspaceMembershipsSchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type ListWorkspaceMembershipsRequest = z.infer<
  typeof listWorkspaceMembershipsSchema
>;

export const changeMembershipRoleSchema = z
  .object({ role: z.enum(['ADMIN', 'MEMBER']) })
  .strict();

export type ChangeMembershipRoleRequest = z.infer<
  typeof changeMembershipRoleSchema
>;

export const leaveCurrentWorkspaceBodySchema = z.object({}).strict().optional();

export type LeaveCurrentWorkspaceBody = z.infer<
  typeof leaveCurrentWorkspaceBodySchema
>;

export const transferWorkspaceOwnershipSchema = z
  .object({
    membershipId: z.uuid(),
    currentPassword: passwordInput(),
  })
  .strict();

export type TransferWorkspaceOwnershipRequest = z.infer<
  typeof transferWorkspaceOwnershipSchema
>;

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
