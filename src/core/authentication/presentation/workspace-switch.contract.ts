import { z } from 'zod';

export const workspaceSwitchSchema = z
  .object({ workspaceId: z.uuid() })
  .strict();

export type WorkspaceSwitchRequest = z.infer<typeof workspaceSwitchSchema>;
