import { Module } from '@nestjs/common';
import { AuthorizationPolicyService } from './authorization-policy.service';

/** Exposes the reusable product-neutral authorization policy. */
@Module({
  providers: [AuthorizationPolicyService],
  exports: [AuthorizationPolicyService],
})
export class AuthorizationPolicyModule {}
