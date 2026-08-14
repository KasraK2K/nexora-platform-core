import { Module } from '@nestjs/common';
import { AuthorizationPolicy } from './application/authorization-policy';

/** Exposes the reusable product-neutral authorization policy. */
@Module({
  providers: [AuthorizationPolicy],
  exports: [AuthorizationPolicy],
})
export class AuthorizationPolicyModule {}
