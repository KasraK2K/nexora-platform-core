export abstract class ApplicationError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
