import { z } from 'zod';

/** Strict transport schema for selecting an accessible workspace by UUID. */
export const workspaceSwitchSchema = z
  .object({ workspaceId: z.uuid() })
  .strict();

/** Validated workspace-switch request accepted by the controller. */
export type WorkspaceSwitchDto = z.infer<typeof workspaceSwitchSchema>;
