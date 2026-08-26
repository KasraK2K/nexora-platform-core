import 'dotenv/config';
import { environmentSchema } from './environment.schema';
import { validateEnvironment } from './environment-validation';

const validatedEnvironmentSchema =
  environmentSchema.superRefine(validateEnvironment);

export type { Environment } from './environment.schema';

/** Parses process environment and applies field and cross-field safety rules. */
export function loadEnvironment() {
  return validatedEnvironmentSchema.parse(process.env);
}
