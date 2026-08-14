import { Injectable } from '@nestjs/common';

/** Supplies the small root-endpoint response independently of HTTP concerns. */
@Injectable()
export class AppService {
  /** Returns the fixed text exposed by the public root endpoint. */
  getHello(): string {
    return 'Hello World!';
  }
}
