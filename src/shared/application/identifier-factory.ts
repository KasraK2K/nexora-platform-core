import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class IdentifierFactory {
  create(): string {
    return uuidv7();
  }
}
