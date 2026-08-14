import { Module } from '@nestjs/common';
import { CoreInfrastructureModule } from '../core-infrastructure.module';
import {
  AUTHENTICATION_SESSIONS_REPOSITORY,
  AuthenticationSessions,
} from './application/authentication-sessions';
import {
  MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY,
  MembershipSessionRevocations,
} from './application/membership-session-revocations';
import { SESSION_CACHE } from './application/session-cache.port';
import { PrismaAuthenticationSessionsRepository } from './infrastructure/prisma-authentication-sessions.repository';
import { SessionCache } from './infrastructure/session-cache';

/**
 * Shares Authentication-owned durable session access and disposable cache
 * boundaries with modules that must verify or revoke membership sessions.
 */
@Module({
  imports: [CoreInfrastructureModule],
  providers: [
    AuthenticationSessions,
    MembershipSessionRevocations,
    PrismaAuthenticationSessionsRepository,
    SessionCache,
    { provide: SESSION_CACHE, useExisting: SessionCache },
    {
      provide: AUTHENTICATION_SESSIONS_REPOSITORY,
      useExisting: PrismaAuthenticationSessionsRepository,
    },
    {
      provide: MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY,
      useExisting: PrismaAuthenticationSessionsRepository,
    },
  ],
  exports: [
    AuthenticationSessions,
    MembershipSessionRevocations,
    SESSION_CACHE,
  ],
})
export class AuthenticationSessionStateModule {}
