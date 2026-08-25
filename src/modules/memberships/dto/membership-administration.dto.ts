import { z } from 'zod';

/** Validates bounded, cursor-based membership-list queries. */
export const listWorkspaceMembershipsSchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

/** Query accepted by the active-workspace membership list endpoint. */
export type ListWorkspaceMembershipsDto = z.infer<
  typeof listWorkspaceMembershipsSchema
>;

/** Restricts ordinary role changes to non-owner roles. */
export const changeMembershipRoleSchema = z
  .object({ role: z.enum(['ADMIN', 'MEMBER']) })
  .strict();

/** Body accepted by the non-owner role-change endpoint. */
export type ChangeMembershipRoleDto = z.infer<
  typeof changeMembershipRoleSchema
>;

/** Accepts no self-leave payload beyond an optional empty object. */
export const leaveCurrentWorkspaceBodySchema = z.object({}).strict().optional();

/** Empty body accepted by the self-leave endpoint. */
export type LeaveCurrentWorkspaceDto = z.infer<
  typeof leaveCurrentWorkspaceBodySchema
>;

/** Validates the target membership and current-password step-up proof. */
export const transferWorkspaceOwnershipSchema = z
  .object({
    membershipId: z.uuid(),
    currentPassword: passwordInput(),
  })
  .strict();

/** Body accepted by the operational ownership-transfer endpoint. */
export type TransferWorkspaceOwnershipDto = z.infer<
  typeof transferWorkspaceOwnershipSchema
>;

/** Applies the same Unicode code-point and UTF-8 byte limits as password flows. */
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
