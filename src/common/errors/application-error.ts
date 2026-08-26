/**
 * Base class for expected business failures that may cross into presentation.
 * Subclasses provide a stable machine code and tell callers whether retrying is
 * meaningful; transports decide how to represent them.
 */
export abstract class ApplicationError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
