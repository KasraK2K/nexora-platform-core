import { z } from 'zod';

/** Strict transport validation for an active-workspace rename payload. */
export const renameCurrentWorkspaceSchema = z
  .object({ name: z.string().trim().min(1).max(120) })
  .strict();

/** Validated request shape inferred from {@link renameCurrentWorkspaceSchema}. */
export type RenameCurrentWorkspaceRequest = z.infer<
  typeof renameCurrentWorkspaceSchema
>;
