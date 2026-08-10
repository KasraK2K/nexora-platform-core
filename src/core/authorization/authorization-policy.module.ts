import { Module } from '@nestjs/common';
import { AuthorizationPolicy } from './application/authorization-policy';

@Module({
  providers: [AuthorizationPolicy],
  exports: [AuthorizationPolicy],
})
export class AuthorizationPolicyModule {}
