import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

/** Creates sortable UUIDv7 identifiers without coupling callers to a UUID library. */
@Injectable()
export class IdentifierFactory {
  /** Returns a new UUIDv7 string. */
  create(): string {
    return uuidv7();
  }
}
