export class IdentityAlreadyExistsError extends Error {
  constructor() {
    super('Identity already exists.');
    this.name = 'IdentityAlreadyExistsError';
  }
}
