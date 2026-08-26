import { Injectable } from '@nestjs/common';

/** Provides the current time through an injectable boundary for deterministic tests. */
@Injectable()
export class Clock {
  /** Returns the current wall-clock time. */
  now(): Date {
    return new Date();
  }
}
