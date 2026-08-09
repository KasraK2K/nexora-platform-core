import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationModule } from '../authentication/authentication.module';
import { RouteAdmissionGuard } from './presentation/route-admission.guard';

@Module({
  imports: [AuthenticationModule],
  providers: [
    RouteAdmissionGuard,
    { provide: APP_GUARD, useExisting: RouteAdmissionGuard },
  ],
})
export class AuthorizationModule {}
