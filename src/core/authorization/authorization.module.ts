import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuthorizationPolicyModule } from './authorization-policy.module';
import { RouteAdmissionGuard } from './presentation/route-admission.guard';

@Module({
  imports: [AuthenticationModule, AuthorizationPolicyModule],
  providers: [
    RouteAdmissionGuard,
    { provide: APP_GUARD, useExisting: RouteAdmissionGuard },
  ],
})
export class AuthorizationModule {}
