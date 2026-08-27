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

/** Accepts no self-leave payload beyond an optional empty object. */
export const leaveCurrentWorkspaceBodySchema = z.object({}).strict().optional();

/** Empty body accepted by the self-leave endpoint. */
export type LeaveCurrentWorkspaceDto = z.infer<
  typeof leaveCurrentWorkspaceBodySchema
>;
