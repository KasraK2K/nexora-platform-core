/** Signals that canonical identity uniqueness rejected a registration write. */
export class IdentityAlreadyExistsError extends Error {
  constructor() {
    super('Identity already exists.');
    this.name = 'IdentityAlreadyExistsError';
  }
}
