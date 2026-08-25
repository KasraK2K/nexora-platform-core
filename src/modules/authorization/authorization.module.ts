import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuthorizationPolicyModule } from './policy/authorization-policy.module';
import { RouteAdmissionGuard } from './guards/route-admission.guard';

/** Installs deny-by-default route admission as the application-wide guard. */
@Module({
  imports: [AuthenticationModule, AuthorizationPolicyModule],
  providers: [
    RouteAdmissionGuard,
    { provide: APP_GUARD, useExisting: RouteAdmissionGuard },
  ],
})
export class AuthorizationModule {}
