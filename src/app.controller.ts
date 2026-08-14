import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PublicRoute } from './core/authorization/presentation/route-admission';

/** Provides the public root endpoint used as a simple application greeting. */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Returns the root response without requiring an authenticated session. */
  @Get()
  @PublicRoute()
  getHello(): string {
    return this.appService.getHello();
  }
}
