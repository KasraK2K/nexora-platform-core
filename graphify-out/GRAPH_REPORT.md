# Graph Report - nexora-platform-core  (2026-08-11)

## Corpus Check
- 202 files · ~69,932 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1874 nodes · 4374 edges · 148 communities (106 shown, 42 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 239 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `83260173`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- register-account.use-case.ts
- route-admission.guard.spec.ts
- switch-workspace.use-case.spec.ts
- LoginRequestGuard
- authenticated-request-context.guard.ts
- AuthenticatedRoute
- PasswordResetTokensRepository
- Nexora Platform Core - Implementation Baseline
- membership-invitation.use-cases.spec.ts
- What You Must Do When Invoked
- app.e2e-spec.ts
- authentication.controller.ts
- dependencies
- compilerOptions
- identity.module.ts
- Nexora Platform Core Repository Guidance
- SessionRecord
- ADR-0004: Propagate a trusted authenticated request context
- scripts
- smtp-membership-invitation.sender.ts
- PrismaUsersRepository
- ADR-0001: Screen new passwords against breached-password data
- ADR-0002: Keep this repository product-neutral
- ADR-0003: Rotate the current session after authenticated password change
- DatabaseContext
- MembershipRole
- ApplicationError
- registration.errors.ts
- AuthenticationRateLimitPort
- PasswordCredentialManagement
- RecordingSessionCache
- app.module.ts
- CoreInfrastructureModule
- workspaces.module.ts
- Nexora Platform Engineering
- .execute
- password-reset-delivery.ts
- membership-invitation-request.guard.ts
- ADR-XXXX: Decision title
- jest
- PrismaMembershipInvitationsRepository
- ADR-0006: Select and switch the active workspace per session
- PrismaPasswordIdentityRepository
- check-deprecated-apis.mjs
- prisma-identity-registration.repository.ts
- .constructor
- Foundation modules
- InvitableMembershipRole
- prisma-identity-lookup.repository.ts
- Nexora Platform Engineering Change Checklists
- graphify reference: extra exports and benchmark
- TransactionManager
- package.json
- exclude
- update-common-password-blocklist.mjs
- .execute
- ADR-0005: Deny routes unless admission policy is explicit
- Create a downstream product from Nexora Platform Core
- devDependencies
- Nexora Platform Core
- authentication-session-state.module.ts
- Nexora Platform Core Module Catalog
- graphify reference: query, path, explain
- nest-cli.json
- ADR-0007: Base RBAC and email-bound membership invitations
- GetCurrentSession
- .execute
- EmailVerificationConfirmationGuard
- PasswordResetConfirmationGuard
- PrismaAuthenticationSessionsRepository
- ts-loader
- .now
- Core module map
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- RecordingSessionCache
- PrismaPasswordResetTokensRepository
- RecordingSessionCache
- AppConfig
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- EmailVerificationSender
- membership-invitation-delivery.ts
- Third-party notices
- extraction-spec.md
- Product boundary
- MembershipInvitationsRepository
- @eslint/js
- eslint-plugin-prettier
- globals
- zod
- @nestjs/cli
- memberships.module.ts
- RecordingInvitations
- @nestjs/schematics
- @nestjs/testing
- Repository structure
- .transferWorkspaceOwner
- prisma
- source-map-support
- supertest
- ts-jest
- ADR-0008: Workspace membership administration and ownership safety
- ts-node
- tsconfig-paths
- @types/jest
- @types/node
- @types/nodemailer
- @types/supertest
- typescript
- typescript-eslint
- AuthenticationRateLimiter
- .create
- Q: Implement Multi-workspace selection and switching task
- .execute
- .execute
- RecordingCache
- @nestjs/common
- RecordingSessionCache
- SessionCache
- @eslint/eslintrc
- authentication.module.ts
- EmailVerificationsRepository
- pwned-passwords-compromise-checker.ts
- AuthenticatedRequestContext
- password-credential-verification.ts
- MembershipInvitationRateLimiter
- membership-invitations.controller.ts
- route-admission.guard.ts
- eslint-config-prettier
- EmailVerificationRequestGuard
- memberships.controller.ts
- PasswordResetRequestGuard
- RegistrationRequestGuard
- register
- SwitchWorkspace
- PasswordChangeRequestGuard
- AuthenticationSessionsRepository
- jest
- MembershipSessionRevocations
- IdentityRegistration
- @nestjs/core
- prettier
- IdentityModule

## God Nodes (most connected - your core abstractions)
1. `TransactionManager` - 54 edges
2. `AppConfig` - 52 edges
3. `Clock` - 50 edges
4. `IdentifierFactory` - 46 edges
5. `AuditLog` - 45 edges
6. `Users` - 44 edges
7. `ApplicationError` - 38 edges
8. `SessionCachePort` - 35 edges
9. `AuthenticationSessions` - 33 edges
10. `DatabaseContext` - 32 edges

## Surprising Connections (you probably didn't know these)
- `UnsafeDetailsError` --inherits--> `ApplicationError`  [EXTRACTED]
  test/app.e2e-spec.ts → src/shared/domain/application-error.ts
- `UnsafeWorkspaceSelectionDetailsError` --inherits--> `ApplicationError`  [EXTRACTED]
  test/app.e2e-spec.ts → src/shared/domain/application-error.ts
- `AuthenticationRateLimiter` --implements--> `AuthenticationRateLimitPort`  [EXTRACTED]
  src/core/authentication/infrastructure/authentication-rate-limiter.ts → src/core/authentication/application/authentication-rate-limiter.port.ts
- `RecordingSessionsRepository` --implements--> `AuthenticationSessionsRepository`  [EXTRACTED]
  src/core/authentication/application/change-password.use-case.spec.ts → src/core/authentication/application/authentication-sessions.ts
- `RecordingSessionsRepository` --implements--> `AuthenticationSessionsRepository`  [EXTRACTED]
  src/core/authentication/application/switch-workspace.use-case.spec.ts → src/core/authentication/application/authentication-sessions.ts

## Import Cycles
- None detected.

## Communities (148 total, 42 thin omitted)

### Community 0 - "register-account.use-case.ts"
Cohesion: 0.08
Nodes (25): EmailVerificationDelivery, Inject, Injectable, EmailVerificationToken, EmailVerificationTokenService, Injectable, EmailVerifications, Inject (+17 more)

### Community 1 - "route-admission.guard.spec.ts"
Cohesion: 0.18
Nodes (12): createAuthenticatedRequestContext(), CurrentSession, ResolvedAuthenticatedRequest, attachAuthenticatedRequestContext(), AUTHENTICATED_REQUEST_CONTEXT, CurrentAuthenticatedSession, readAuthenticatedRequestContext(), RequestWithAuthenticatedContext (+4 more)

### Community 2 - "switch-workspace.use-case.spec.ts"
Cohesion: 0.08
Nodes (35): AppendAuditLog, AccessibleWorkspaceLimitError, AccessibleWorkspaces, AccessibleWorkspaceStateError, Injectable, RevokedSession, CreatedSession, CreateSessionCommand (+27 more)

### Community 3 - "LoginRequestGuard"
Cohesion: 0.33
Nodes (3): LoginRequestGuard, Inject, Injectable

### Community 4 - "authenticated-request-context.guard.ts"
Cohesion: 0.24
Nodes (4): readCookie(), Inject, Injectable, WorkspaceSwitchRequestGuard

### Community 5 - "AuthenticatedRoute"
Cohesion: 0.11
Nodes (34): ApiAcceptedResponse, Req, Res, AuthenticationController, clearSessionCookie(), setSessionCookie(), ApiBody, ApiConflictResponse (+26 more)

### Community 6 - "PasswordResetTokensRepository"
Cohesion: 0.09
Nodes (8): RecordingResetTokensRepository, PasswordResetTokensRepository, activeUsers(), createRequestFixture(), createResetFixture(), fixedClock(), InMemoryResetTokens, sessionRepository()

### Community 7 - "Nexora Platform Core - Implementation Baseline"
Cohesion: 0.12
Nodes (16): Accepted decisions, API and observability, Architecture style, Commercial and metered capabilities, Current state, Data ownership and persistence, Deployment baseline, External provider extensions (+8 more)

### Community 8 - "membership-invitation.use-cases.spec.ts"
Cohesion: 0.22
Nodes (8): IdentityLookup, Inject, Injectable, CreatedMembershipInvitation, InvitedMembershipsWriter, Injectable, MEMBERSHIP_ROLES, MEMBERSHIPS_REPOSITORY

### Community 9 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "app.e2e-spec.ts"
Cohesion: 0.07
Nodes (12): invitationDeliveries, login(), loginBody(), readCookieHeader(), readSetCookie(), recordingEmailSender, recordingMembershipInvitationSender, recordingPasswordResetSender (+4 more)

### Community 11 - "authentication.controller.ts"
Cohesion: 0.14
Nodes (16): EmailVerificationConfirmation, emailVerificationConfirmationSchema, EmailVerificationRequest, emailVerificationRequestSchema, LoginRequest, loginRequestSchema, PasswordChangeRequest, passwordChangeSchema (+8 more)

### Community 12 - "dependencies"
Cohesion: 0.09
Nodes (23): argon2, dotenv, @nestjs/platform-express, @nestjs/swagger, nodemailer, dependencies, argon2, dotenv (+15 more)

### Community 13 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 14 - "identity.module.ts"
Cohesion: 0.17
Nodes (11): IDENTITY_LOOKUP_REPOSITORY, PASSWORD_IDENTITY_REPOSITORY, PasswordIdentityAuthentication, PasswordIdentityRecord, RecordingVerifier, Inject, Injectable, PASSWORD_VERIFIER (+3 more)

### Community 15 - "Nexora Platform Core Repository Guidance"
Cohesion: 0.10
Nodes (20): API and observability, Architecture invariants, Billing, credits, and usage, Cross-cutting correctness, Current repository commands, Delegation, Dependency and API compatibility, Development database workflow (+12 more)

### Community 16 - "SessionRecord"
Cohesion: 0.17
Nodes (3): SessionRecord, RecordingSessionsRepository, RecordingSessionsRepository

### Community 17 - "ADR-0004: Propagate a trusted authenticated request context"
Cohesion: 0.11
Nodes (17): ADR-0004: Propagate a trusted authenticated request context, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+9 more)

### Community 18 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, check:deprecated, db:dev:down, db:dev:up, db:generate, db:push, db:test:down (+12 more)

### Community 19 - "smtp-membership-invitation.sender.ts"
Cohesion: 0.12
Nodes (11): Inject, SmtpPasswordResetSender, Inject, Injectable, OUTBOUND_MAIL, OutboundMail, SmtpOutboundMail, Injectable (+3 more)

### Community 20 - "PrismaUsersRepository"
Cohesion: 0.12
Nodes (6): UserAuthenticationReference, USERS_REPOSITORY, UsersRepository, UserSummary, PrismaUsersRepository, Injectable

### Community 21 - "ADR-0001: Screen new passwords against breached-password data"
Cohesion: 0.11
Nodes (17): A. Keep a manually maintained in-code list, ADR-0001: Screen new passwords against breached-password data, B. Query Pwned Passwords and fail registration when it is unavailable, C. Query Pwned Passwords with a bundled local fallback, Compatibility and migration, Consequences, Considered options, Context (+9 more)

### Community 22 - "ADR-0002: Keep this repository product-neutral"
Cohesion: 0.11
Nodes (17): A. Keep named products in this repository, ADR-0002: Keep this repository product-neutral, B. Keep one repository with multiple product modules, C. Make this repository product-neutral and create downstream repositories, Compatibility and migration, Consequences, Considered options, Context (+9 more)

### Community 23 - "ADR-0003: Rotate the current session after authenticated password change"
Cohesion: 0.11
Nodes (17): ADR-0003: Rotate the current session after authenticated password change, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+9 more)

### Community 24 - "DatabaseContext"
Cohesion: 0.11
Nodes (9): AUDIT_LOG_REPOSITORY, AuditLogRepository, PrismaAuditLogRepository, Injectable, recordSelection, DatabaseContext, Injectable, PrismaService (+1 more)

### Community 25 - "MembershipRole"
Cohesion: 0.07
Nodes (10): Inject, MembershipAdministrationRecord, MembershipAdministrationRepository, MembershipRole, LoginWorkspaceResolution, MembershipsRepository, MembershipSummary, membershipAdministrationSelect (+2 more)

### Community 26 - "ApplicationError"
Cohesion: 0.11
Nodes (11): PasswordChangeUnavailableError, EmailVerificationRequiredError, RouteAccessDeniedError, MembershipAdministrationUnavailableError, MembershipOwnershipProtectedError, MembershipOwnershipTransferInvalidError, MembershipPageCursorInvalidError, MembershipInvitationConflictError (+3 more)

### Community 27 - "registration.errors.ts"
Cohesion: 0.07
Nodes (34): AuthenticationSessions, Inject, Injectable, ChangedPasswordSession, PasswordChangeContext, EXPIRES_AT, InlineTransactionManager, NOW (+26 more)

### Community 28 - "AuthenticationRateLimitPort"
Cohesion: 0.32
Nodes (5): AUTHENTICATION_RATE_LIMITER, AuthenticationRateLimitPort, EmailVerificationUnavailableError, PasswordResetUnavailableError, readNormalizedEmail()

### Community 29 - "PasswordCredentialManagement"
Cohesion: 0.40
Nodes (3): PasswordCredentialManagement, Inject, Injectable

### Community 31 - "app.module.ts"
Cohesion: 0.07
Nodes (29): Catch, AppController, Controller, Get, AppModule, Module, AppService, Injectable (+21 more)

### Community 32 - "CoreInfrastructureModule"
Cohesion: 0.14
Nodes (9): CoreInfrastructureModule, Module, ORGANIZATIONS_REPOSITORY, OrganizationsRepository, OrganizationSummary, PrismaOrganizationsRepository, Injectable, OrganizationsModule (+1 more)

### Community 33 - "workspaces.module.ts"
Cohesion: 0.16
Nodes (7): WORKSPACES_REPOSITORY, WorkspacesRepository, WorkspaceSummary, PrismaWorkspacesRepository, Injectable, Module, WorkspacesModule

### Community 34 - "Nexora Platform Engineering"
Cohesion: 0.14
Nodes (14): Apply cross-cutting controls, Architecture debt guards, Classify the repository boundary first, Classify the request, Define and implement the slice, Delegate when useful, Downstream product repository, Load the right context (+6 more)

### Community 35 - ".execute"
Cohesion: 0.14
Nodes (3): isWriteConflict(), isWriteConflict(), isWriteConflict()

### Community 36 - "password-reset-delivery.ts"
Cohesion: 0.24
Nodes (5): PasswordResetDelivery, Inject, Injectable, PASSWORD_RESET_SENDER, PasswordResetSender

### Community 37 - "membership-invitation-request.guard.ts"
Cohesion: 0.22
Nodes (8): MEMBERSHIP_INVITATION_RATE_LIMITER, MembershipInvitationRateLimiterPort, enforceDecision(), MembershipInvitationAcceptRequestGuard, MembershipInvitationCreateRequestGuard, readNormalizedEmail(), Inject, Injectable

### Community 38 - "ADR-XXXX: Decision title"
Cohesion: 0.12
Nodes (16): ADR-XXXX: Decision title, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+8 more)

### Community 39 - "jest"
Cohesion: 0.15
Nodes (13): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+5 more)

### Community 40 - "PrismaMembershipInvitationsRepository"
Cohesion: 0.18
Nodes (5): MEMBERSHIP_INVITATIONS_REPOSITORY, MembershipInvitationRecord, isInvitableMembershipRole(), PrismaMembershipInvitationsRepository, Injectable

### Community 41 - "ADR-0006: Select and switch the active workspace per session"
Cohesion: 0.11
Nodes (17): ADR-0006: Select and switch the active workspace per session, Choose the most recent workspace automatically, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers (+9 more)

### Community 42 - "PrismaPasswordIdentityRepository"
Cohesion: 0.18
Nodes (5): PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY, PasswordCredentialManagementRepository, PasswordIdentityRepository, PrismaPasswordIdentityRepository, Injectable

### Community 43 - "check-deprecated-apis.mjs"
Cohesion: 0.27
Nodes (8): addFinding(), configPath, deprecatedMessage(), findDeprecatedSymbol(), flattenUnion(), isImportName(), projectRoot, visit()

### Community 44 - "prisma-identity-registration.repository.ts"
Cohesion: 0.21
Nodes (7): CreatePasswordIdentity, IDENTITY_REGISTRATION_REPOSITORY, IdentityRegistrationRepository, IdentityAlreadyExistsError, isUniqueConstraintError(), PrismaIdentityRegistrationRepository, Injectable

### Community 46 - "Foundation modules"
Cohesion: 0.20
Nodes (10): Audit, Authentication, Authorization and roles, Configuration and persistence, Foundation modules, Identity, Memberships, Organizations (+2 more)

### Community 47 - "InvitableMembershipRole"
Cohesion: 0.14
Nodes (7): isWriteConflict(), readSafeErrorCode(), InvitableMembershipRole, isWriteConflict(), readSafeErrorCode(), isWriteConflict(), readSafeErrorCode()

### Community 48 - "prisma-identity-lookup.repository.ts"
Cohesion: 0.27
Nodes (4): IdentityLookupRepository, IdentitySummary, PrismaIdentityLookupRepository, Injectable

### Community 49 - "Nexora Platform Engineering Change Checklists"
Cohesion: 0.22
Nodes (9): ADR triggers, Change design and layering, Commercial and metered capabilities, Current-state and boundary gate, Data, authentication, and tenancy, External providers and automated output, Jobs, files, API, and operations, Nexora Platform Engineering Change Checklists (+1 more)

### Community 50 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 51 - "TransactionManager"
Cohesion: 0.07
Nodes (37): AuditLog, Inject, Injectable, InlineTransactionManager, Inject, Inject, Inject, InlineTransactionManager (+29 more)

### Community 52 - "package.json"
Cohesion: 0.25
Nodes (7): author, description, license, name, packageManager, private, version

### Community 53 - "exclude"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 54 - "update-common-password-blocklist.mjs"
Cohesion: 0.29
Nodes (7): hashes, OUTPUT_PATH, sha256(), sourceBytes, sourcePasswords, sourceSha256, sourceText

### Community 55 - ".execute"
Cohesion: 0.26
Nodes (4): ChangePassword, isWriteConflict(), readSafeErrorCode(), Injectable

### Community 56 - "ADR-0005: Deny routes unless admission policy is explicit"
Cohesion: 0.11
Nodes (17): ADR-0005: Deny routes unless admission policy is explicit, Compatibility and migration, Consequences, Considered options, Context, Continue attaching guards to individual routes, Decision, Decision drivers (+9 more)

### Community 57 - "Create a downstream product from Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Create a downstream product from Nexora Platform Core, Define the product boundary, Minimum product repository guidance, Protect Core boundaries, Review inherited runtime identity, Start from a reviewed base

### Community 58 - "devDependencies"
Cohesion: 0.29
Nodes (7): dotenv-cli, eslint, devDependencies, dotenv-cli, eslint, @types/express, @types/express

### Community 59 - "Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Implemented, Local development, Nexora Platform Core, Prerequisites, Product extension model, Verification

### Community 60 - "authentication-session-state.module.ts"
Cohesion: 0.23
Nodes (7): AUTHENTICATION_SESSIONS_REPOSITORY, MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY, MembershipSessionRevocationsRepository, RevokedMembershipSession, AuthenticationSessionStateModule, Module, revokedSessionSelect

### Community 61 - "Nexora Platform Core Module Catalog"
Cohesion: 0.20
Nodes (5): Downstream product modules, Nexora Platform Core Module Catalog, Optional reusable capability packs, Ownership rules, Shared kernel and contracts

### Community 62 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 63 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 64 - "ADR-0007: Base RBAC and email-bound membership invitations"
Cohesion: 0.11
Nodes (17): Add base roles with transactional grant checks and email-bound tokens, ADR-0007: Base RBAC and email-bound membership invitations, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers (+9 more)

### Community 66 - ".execute"
Cohesion: 0.15
Nodes (4): CreateSession, readSafeErrorCode(), Injectable, WorkspaceSelectionOption

### Community 67 - "EmailVerificationConfirmationGuard"
Cohesion: 0.33
Nodes (3): EmailVerificationConfirmationGuard, Inject, Injectable

### Community 68 - "PasswordResetConfirmationGuard"
Cohesion: 0.33
Nodes (3): PasswordResetConfirmationGuard, Inject, Injectable

### Community 69 - "PrismaAuthenticationSessionsRepository"
Cohesion: 0.18
Nodes (3): SessionContext, PrismaAuthenticationSessionsRepository, Injectable

### Community 72 - "Core module map"
Cohesion: 0.50
Nodes (4): Core module map, Implemented foundation, Optional reusable capability packs, Planned foundation

### Community 73 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 74 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 75 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 77 - "PrismaPasswordResetTokensRepository"
Cohesion: 0.20
Nodes (4): PasswordResetTokenRecord, PrismaPasswordResetTokensRepository, recordSelection, Injectable

### Community 79 - "AppConfig"
Cohesion: 0.16
Nodes (8): CachedSession, AppConfig, environmentSchema, Injectable, PrismaTransactionManager, Injectable, RedisService, Injectable

### Community 82 - "EmailVerificationSender"
Cohesion: 0.22
Nodes (5): EMAIL_VERIFICATION_SENDER, EmailVerificationSender, RecordingEmailSender, SmtpEmailVerificationSender, Injectable

### Community 83 - "membership-invitation-delivery.ts"
Cohesion: 0.31
Nodes (5): MembershipInvitationDelivery, Inject, Injectable, MEMBERSHIP_INVITATION_SENDER, MembershipInvitationSender

### Community 86 - "Product boundary"
Cohesion: 0.67
Nodes (3): A downstream product repository owns, Platform Core owns, Product boundary

### Community 93 - "memberships.module.ts"
Cohesion: 0.13
Nodes (17): AuditModule, Module, MailModule, Module, MEMBERSHIP_ADMINISTRATION_REPOSITORY, MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER, MembershipOwnershipTransferRateLimitDecision, MembershipOwnershipTransferRateLimiterPort (+9 more)

### Community 94 - "RecordingInvitations"
Cohesion: 0.17
Nodes (5): createAcceptanceFixture(), createIssueFixture(), fixedClock(), inlineTransactions(), RecordingInvitations

### Community 97 - "Repository structure"
Cohesion: 0.67
Nodes (3): Current structure, Repository structure, Target structure

### Community 98 - ".transferWorkspaceOwner"
Cohesion: 0.14
Nodes (21): ApiBadRequestResponse, ApiQuery, Patch, Query, MembershipsController, ApiBody, ApiConflictResponse, ApiCookieAuth (+13 more)

### Community 103 - "ADR-0008: Workspace membership administration and ownership safety"
Cohesion: 0.11
Nodes (18): ADR-0008: Workspace membership administration and ownership safety, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+10 more)

### Community 112 - "AuthenticationRateLimiter"
Cohesion: 0.37
Nodes (3): RateLimitDecision, AuthenticationRateLimiter, Injectable

### Community 115 - ".create"
Cohesion: 0.17
Nodes (16): MembershipInvitationsController, ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiOperation (+8 more)

### Community 116 - "Q: Implement Multi-workspace selection and switching task"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement Multi-workspace selection and switching task, Source Nodes

### Community 117 - ".execute"
Cohesion: 0.08
Nodes (14): normalizeIdentityEmail(), CreateMembershipInvitation, isUniqueConflict(), isWriteConflict(), readSafeErrorCode(), Injectable, MembershipInvitationTokenService, Injectable (+6 more)

### Community 118 - ".execute"
Cohesion: 0.24
Nodes (5): AcceptMembershipInvitation, isUniqueConflict(), isWriteConflict(), readSafeErrorCode(), Injectable

### Community 124 - "authentication.module.ts"
Cohesion: 0.10
Nodes (20): EMAIL_VERIFICATIONS_REPOSITORY, ListSessionWorkspaces, Injectable, PASSWORD_RESET_TOKENS_REPOSITORY, RegisterAccount, Injectable, RequestEmailVerification, Injectable (+12 more)

### Community 125 - "EmailVerificationsRepository"
Cohesion: 0.09
Nodes (5): EmailVerificationRecord, EmailVerificationsRepository, RecordingEmailVerifications, PrismaEmailVerificationsRepository, Injectable

### Community 126 - "pwned-passwords-compromise-checker.ts"
Cohesion: 0.23
Nodes (7): COMMON_PASSWORD_SHA256_HASHES, CONTEXT_SPECIFIC_PASSWORDS, findSuffix(), localHash(), PwnedPasswordsCompromiseChecker, readBoundedText(), Injectable

### Community 127 - "AuthenticatedRequestContext"
Cohesion: 0.33
Nodes (5): AuthenticatedRequestContext, CurrentAuthenticatedContext, RouteAdmissionProbeController, Controller, Get

### Community 128 - "password-credential-verification.ts"
Cohesion: 0.18
Nodes (6): RecordingCredentialRepository, PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY, PasswordCredentialRecord, PasswordCredentialVerificationRepository, VERIFIED_PASSWORD_HASH, VerifiedPasswordCredential

### Community 129 - "MembershipInvitationRateLimiter"
Cohesion: 0.57
Nodes (3): MembershipInvitationRateLimitDecision, MembershipInvitationRateLimiter, Injectable

### Community 130 - "membership-invitations.controller.ts"
Cohesion: 0.27
Nodes (6): AcceptMembershipInvitationRequest, acceptMembershipInvitationSchema, CreateMembershipInvitationRequest, createMembershipInvitationSchema, Injectable, ZodValidationPipe

### Community 131 - "route-admission.guard.ts"
Cohesion: 0.19
Nodes (8): AuthenticatedRequestContextGuard, Injectable, TrustedOriginGuard, Injectable, isPermission(), isRouteAdmissionPolicy(), RouteAdmissionGuard, Injectable

### Community 133 - "EmailVerificationRequestGuard"
Cohesion: 0.33
Nodes (3): EmailVerificationRequestGuard, Inject, Injectable

### Community 134 - "memberships.controller.ts"
Cohesion: 0.15
Nodes (15): ChangeMembershipRole, Injectable, ListWorkspaceMemberships, readSafeErrorCode(), Injectable, RemoveMembership, Injectable, TransferWorkspaceOwnership (+7 more)

### Community 135 - "PasswordResetRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordResetRequestGuard, Inject, Injectable

### Community 136 - "RegistrationRequestGuard"
Cohesion: 0.33
Nodes (3): RegistrationRequestGuard, Inject, Injectable

### Community 137 - "register"
Cohesion: 0.47
Nodes (6): confirmEmail(), readVerificationToken(), register(), registerUnverified(), registerWithPassword(), registrationBody()

### Community 138 - "SwitchWorkspace"
Cohesion: 0.40
Nodes (3): readSafeErrorCode(), SwitchWorkspace, Injectable

### Community 139 - "PasswordChangeRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordChangeRequestGuard, Inject, Injectable

### Community 142 - "MembershipSessionRevocations"
Cohesion: 0.33
Nodes (3): MembershipSessionRevocations, Inject, Injectable

### Community 143 - "IdentityRegistration"
Cohesion: 0.40
Nodes (3): IdentityRegistration, Inject, Injectable

## Knowledge Gaps
- **422 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+417 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppConfig` connect `AppConfig` to `register-account.use-case.ts`, `route-admission.guard.spec.ts`, `switch-workspace.use-case.spec.ts`, `route-admission.guard.ts`, `authenticated-request-context.guard.ts`, `membership-invitation.use-cases.spec.ts`, `authentication.controller.ts`, `PasswordChangeRequestGuard`, `AuthenticationRateLimitPort`, `TransactionManager`, `smtp-membership-invitation.sender.ts`, `DatabaseContext`, `registration.errors.ts`, `authentication.module.ts`, `pwned-passwords-compromise-checker.ts`, `app.module.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `AuthenticationRateLimitPort` connect `AuthenticationRateLimitPort` to `LoginRequestGuard`, `EmailVerificationConfirmationGuard`, `EmailVerificationRequestGuard`, `PasswordResetConfirmationGuard`, `PasswordResetRequestGuard`, `RegistrationRequestGuard`, `authenticated-request-context.guard.ts`, `PasswordChangeRequestGuard`, `AppConfig`, `AuthenticationRateLimiter`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `MembershipRole` connect `MembershipRole` to `register-account.use-case.ts`, `GetCurrentSession`, `switch-workspace.use-case.spec.ts`, `.execute`, `membership-invitation.use-cases.spec.ts`, `InvitableMembershipRole`, `TransactionManager`, `.execute`, `registration.errors.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _422 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `register-account.use-case.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0783673469387755 - nodes in this community are weakly interconnected._
- **Should `switch-workspace.use-case.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07598371777476255 - nodes in this community are weakly interconnected._
- **Should `AuthenticatedRoute` be split into smaller, more focused modules?**
  _Cohesion score 0.10971348707197764 - nodes in this community are weakly interconnected._