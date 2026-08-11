# Graph Report - nexora-platform-core  (2026-08-11)

## Corpus Check
- 218 files · ~75,608 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1992 nodes · 4790 edges · 143 communities (104 shown, 39 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 263 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b2e26ab3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Clock
- get-current-session.use-case.ts
- change-password.use-case.ts
- AuthenticationSessionsRepository
- PasswordChangeRequestGuard
- .selectWorkspace
- InMemoryResetTokens
- Nexora Platform Core - Implementation Baseline
- InvitableMembershipRole
- What You Must Do When Invoked
- app.e2e-spec.ts
- authentication.controller.ts
- dependencies
- compilerOptions
- password-identity-authentication.ts
- Nexora Platform Core Repository Guidance
- SessionRecord
- ADR-0004: Propagate a trusted authenticated request context
- scripts
- OutboundMail
- UsersRepository
- ADR-0001: Screen new passwords against breached-password data
- ADR-0002: Keep this repository product-neutral
- ADR-0003: Rotate the current session after authenticated password change
- DatabaseContext
- MembershipRole
- ApplicationError
- PasswordPolicy
- registration.errors.ts
- switch-workspace.use-case.spec.ts
- RecordingSessionCache
- app.module.ts
- organizations.ts
- WorkspacesRepository
- Nexora Platform Engineering
- .execute
- authentication.module.ts
- membership-invitation-request.guard.ts
- ADR-XXXX: Decision title
- jest
- membership-role.ts
- ADR-0006: Select and switch the active workspace per session
- identity.module.ts
- check-deprecated-apis.mjs
- prisma-identity-registration.repository.ts
- users.ts
- Foundation modules
- .create
- identity-lookup.ts
- Nexora Platform Engineering Change Checklists
- graphify reference: extra exports and benchmark
- membership-administration.use-cases.spec.ts
- package.json
- exclude
- update-common-password-blocklist.mjs
- .execute
- ADR-0005: Deny routes unless admission policy is explicit
- Create a downstream product from Nexora Platform Core
- devDependencies
- Nexora Platform Core
- audit.module.ts
- Nexora Platform Core Module Catalog
- graphify reference: query, path, explain
- nest-cli.json
- ADR-0007: Base RBAC and email-bound membership invitations
- GetCurrentSession
- .listForUser
- EmailVerificationConfirmationGuard
- PasswordResetConfirmationGuard
- ADR-0009: Bounded user and workspace lifecycle
- ts-loader
- .execute
- Core module map
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- workspaces.module.ts
- PasswordResetTokensRepository
- RecordingSessionCache
- AppConfig
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- IdentifierFactory
- AuthenticatedRoute
- Third-party notices
- extraction-spec.md
- Product boundary
- .now
- @eslint/js
- eslint-plugin-prettier
- globals
- TransactionManager
- @nestjs/cli
- membership-ownership-transfer-request.guard.ts
- RecordingInvitations
- @nestjs/schematics
- @nestjs/testing
- Repository structure
- .leave
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
- AuthenticatedRequestContext
- Q: Implement Multi-workspace selection and switching task
- .execute
- membership-invitations.controller.ts
- RecordingCache
- workspaces.controller.ts
- RecordingSessionCache
- SessionCache
- route-admission.guard.ts
- MembershipInvitationsRepository
- AuthenticationUnavailableError
- pwned-passwords-compromise-checker.ts
- WorkspaceSwitchRequestGuard
- password-credential-verification.ts
- users.controller.ts
- change-password.use-case.spec.ts
- eslint-config-prettier
- reset-password.use-case.ts
- memberships.controller.ts
- @nestjs/common
- reflect-metadata
- memberships.module.ts
- jest
- IdentityRegistration
- @nestjs/core
- prettier
- dotenv-cli

## God Nodes (most connected - your core abstractions)
1. `TransactionManager` - 61 edges
2. `Clock` - 59 edges
3. `IdentifierFactory` - 56 edges
4. `AppConfig` - 54 edges
5. `AuditLog` - 53 edges
6. `ApplicationError` - 45 edges
7. `Users` - 44 edges
8. `SessionCachePort` - 35 edges
9. `AuthorizationPolicy` - 34 edges
10. `Memberships` - 34 edges

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

## Communities (143 total, 39 thin omitted)

### Community 0 - "Clock"
Cohesion: 0.09
Nodes (28): AuditLog, Inject, Injectable, EmailVerificationDelivery, Inject, Injectable, EmailVerificationToken, EmailVerificationTokenService (+20 more)

### Community 1 - "get-current-session.use-case.ts"
Cohesion: 0.21
Nodes (13): createAuthenticatedRequestContext(), CurrentSession, ResolvedAuthenticatedRequest, AuthenticationRequiredError, attachAuthenticatedRequestContext(), AUTHENTICATED_REQUEST_CONTEXT, CurrentAuthenticatedSession, readAuthenticatedRequestContext() (+5 more)

### Community 2 - "change-password.use-case.ts"
Cohesion: 0.12
Nodes (23): AppendAuditLog, AuthenticationSessions, Inject, Injectable, ChangedPasswordSession, PasswordChangeContext, Inject, CreatedSession (+15 more)

### Community 3 - "AuthenticationSessionsRepository"
Cohesion: 0.12
Nodes (6): AuthenticationSessionsRepository, SessionContext, MembershipSessionRevocationsRepository, PrismaAuthenticationSessionsRepository, revokedSessionSelect, Injectable

### Community 4 - "PasswordChangeRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordChangeRequestGuard, Inject, Injectable

### Community 5 - ".selectWorkspace"
Cohesion: 0.19
Nodes (25): ApiAcceptedResponse, Req, AuthenticationController, setSessionCookie(), ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse (+17 more)

### Community 6 - "InMemoryResetTokens"
Cohesion: 0.22
Nodes (6): activeUsers(), createRequestFixture(), createResetFixture(), fixedClock(), InMemoryResetTokens, sessionRepository()

### Community 7 - "Nexora Platform Core - Implementation Baseline"
Cohesion: 0.12
Nodes (16): Accepted decisions, API and observability, Architecture style, Commercial and metered capabilities, Current state, Data ownership and persistence, Deployment baseline, External provider extensions (+8 more)

### Community 8 - "InvitableMembershipRole"
Cohesion: 0.21
Nodes (6): Inject, MEMBERSHIP_INVITATION_SENDER, MembershipInvitationSender, InvitableMembershipRole, SmtpMembershipInvitationSender, Injectable

### Community 9 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "app.e2e-spec.ts"
Cohesion: 0.07
Nodes (16): confirmEmail(), invitationDeliveries, login(), loginBody(), readCookieHeader(), readSetCookie(), readVerificationToken(), recordingEmailSender (+8 more)

### Community 11 - "authentication.controller.ts"
Cohesion: 0.09
Nodes (26): CreateSession, Injectable, RegisterAccount, Injectable, RequestEmailVerification, Injectable, RevokeAllSessions, Injectable (+18 more)

### Community 12 - "dependencies"
Cohesion: 0.09
Nodes (23): argon2, dotenv, @nestjs/platform-express, @nestjs/swagger, nodemailer, dependencies, argon2, dotenv (+15 more)

### Community 13 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 14 - "password-identity-authentication.ts"
Cohesion: 0.15
Nodes (10): PasswordIdentityAuthentication, PasswordIdentityRecord, PasswordIdentityRepository, RecordingVerifier, Inject, Injectable, PASSWORD_VERIFIER, PasswordVerifier (+2 more)

### Community 15 - "Nexora Platform Core Repository Guidance"
Cohesion: 0.10
Nodes (20): API and observability, Architecture invariants, Billing, credits, and usage, Cross-cutting correctness, Current repository commands, Delegation, Dependency and API compatibility, Development database workflow (+12 more)

### Community 16 - "SessionRecord"
Cohesion: 0.14
Nodes (4): RevokedSession, SessionRecord, RecordingSessionsRepository, RecordingSessionsRepository

### Community 17 - "ADR-0004: Propagate a trusted authenticated request context"
Cohesion: 0.11
Nodes (17): ADR-0004: Propagate a trusted authenticated request context, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+9 more)

### Community 18 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, check:deprecated, db:dev:down, db:dev:up, db:generate, db:push, db:test:down (+12 more)

### Community 19 - "OutboundMail"
Cohesion: 0.10
Nodes (14): EMAIL_VERIFICATION_SENDER, EmailVerificationSender, RecordingEmailSender, SmtpEmailVerificationSender, Inject, Injectable, Inject, OUTBOUND_MAIL (+6 more)

### Community 20 - "UsersRepository"
Cohesion: 0.05
Nodes (12): EmailVerificationRecord, EmailVerificationsRepository, RecordingEmailVerifications, PrismaEmailVerificationsRepository, recordSelection, Injectable, users(), UserAuthenticationReference (+4 more)

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
Cohesion: 0.17
Nodes (7): DatabaseContext, Injectable, PrismaService, Injectable, PrismaTransactionManager, Injectable, TransactionWriteConflictError

### Community 25 - "MembershipRole"
Cohesion: 0.08
Nodes (9): MembershipAdministrationRecord, MembershipAdministrationRepository, MembershipRole, LoginWorkspaceResolution, MembershipsRepository, MembershipSummary, membershipAdministrationSelect, PrismaMembershipsRepository (+1 more)

### Community 26 - "ApplicationError"
Cohesion: 0.08
Nodes (14): AuthenticationInvalidError, EmailAlreadyRegisteredError, PasswordChangeInvalidCurrentPasswordError, WorkspaceAccessDeniedError, WorkspaceSelectionRequiredError, EmailVerificationRequiredError, RouteAccessDeniedError, UserLifecycleInvalidError (+6 more)

### Community 27 - "PasswordPolicy"
Cohesion: 0.21
Nodes (4): PasswordPolicy, InvalidPasswordChangePasswordError, InvalidPasswordResetPasswordError, InvalidRegistrationError

### Community 28 - "registration.errors.ts"
Cohesion: 0.08
Nodes (20): AUTHENTICATION_RATE_LIMITER, AuthenticationRateLimitPort, EmailVerificationUnavailableError, PasswordChangeUnavailableError, PasswordResetUnavailableError, RegistrationUnavailableError, WorkspaceSwitchUnavailableError, EmailVerificationRequestGuard (+12 more)

### Community 29 - "switch-workspace.use-case.spec.ts"
Cohesion: 0.14
Nodes (12): AccessibleWorkspaceLimitError, AccessibleWorkspaces, AccessibleWorkspaceStateError, Injectable, EXPECTED_CONTEXT, EXPIRES_AT, NOW, RAW_TOKEN (+4 more)

### Community 31 - "app.module.ts"
Cohesion: 0.08
Nodes (27): Catch, AppController, Controller, Get, AppModule, Module, AppService, Injectable (+19 more)

### Community 32 - "organizations.ts"
Cohesion: 0.18
Nodes (7): ORGANIZATIONS_REPOSITORY, OrganizationsRepository, OrganizationSummary, PrismaOrganizationsRepository, Injectable, OrganizationsModule, Module

### Community 33 - "WorkspacesRepository"
Cohesion: 0.16
Nodes (5): createFixture(), WorkspacesRepository, WorkspaceSummary, PrismaWorkspacesRepository, Injectable

### Community 34 - "Nexora Platform Engineering"
Cohesion: 0.14
Nodes (14): Apply cross-cutting controls, Architecture debt guards, Classify the repository boundary first, Classify the request, Define and implement the slice, Delegate when useful, Downstream product repository, Load the right context (+6 more)

### Community 36 - "authentication.module.ts"
Cohesion: 0.12
Nodes (20): EMAIL_VERIFICATIONS_REPOSITORY, PasswordResetDelivery, Inject, Injectable, PASSWORD_RESET_SENDER, PasswordResetSender, PasswordResetToken, PasswordResetTokenService (+12 more)

### Community 37 - "membership-invitation-request.guard.ts"
Cohesion: 0.16
Nodes (11): MEMBERSHIP_INVITATION_RATE_LIMITER, MembershipInvitationRateLimitDecision, MembershipInvitationRateLimiterPort, MembershipInvitationRateLimiter, Injectable, enforceDecision(), MembershipInvitationAcceptRequestGuard, MembershipInvitationCreateRequestGuard (+3 more)

### Community 38 - "ADR-XXXX: Decision title"
Cohesion: 0.12
Nodes (16): ADR-XXXX: Decision title, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+8 more)

### Community 39 - "jest"
Cohesion: 0.15
Nodes (13): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+5 more)

### Community 40 - "membership-role.ts"
Cohesion: 0.18
Nodes (5): MembershipInvitationRecord, isInvitableMembershipRole(), MEMBERSHIP_ROLES, PrismaMembershipInvitationsRepository, Injectable

### Community 41 - "ADR-0006: Select and switch the active workspace per session"
Cohesion: 0.11
Nodes (17): ADR-0006: Select and switch the active workspace per session, Choose the most recent workspace automatically, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers (+9 more)

### Community 42 - "identity.module.ts"
Cohesion: 0.15
Nodes (8): IDENTITY_LOOKUP_REPOSITORY, PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY, PasswordCredentialManagementRepository, PASSWORD_IDENTITY_REPOSITORY, IdentityModule, Module, PrismaPasswordIdentityRepository, Injectable

### Community 43 - "check-deprecated-apis.mjs"
Cohesion: 0.27
Nodes (8): addFinding(), configPath, deprecatedMessage(), findDeprecatedSymbol(), flattenUnion(), isImportName(), projectRoot, visit()

### Community 44 - "prisma-identity-registration.repository.ts"
Cohesion: 0.21
Nodes (7): CreatePasswordIdentity, IDENTITY_REGISTRATION_REPOSITORY, IdentityRegistrationRepository, IdentityAlreadyExistsError, isUniqueConstraintError(), PrismaIdentityRegistrationRepository, Injectable

### Community 45 - "users.ts"
Cohesion: 0.21
Nodes (6): Inject, Injectable, UpdateOwnProfile, UserWriteConflictError, USERS_REPOSITORY, UserStatus

### Community 46 - "Foundation modules"
Cohesion: 0.20
Nodes (10): Audit, Authentication, Authorization and roles, Configuration and persistence, Foundation modules, Identity, Memberships, Organizations (+2 more)

### Community 47 - ".create"
Cohesion: 0.10
Nodes (6): readSafeErrorCode(), ListWorkspaceMemberships, readSafeErrorCode(), Injectable, readSafeErrorCode(), readSafeErrorCode()

### Community 48 - "identity-lookup.ts"
Cohesion: 0.27
Nodes (4): IdentityLookupRepository, IdentitySummary, PrismaIdentityLookupRepository, Injectable

### Community 49 - "Nexora Platform Engineering Change Checklists"
Cohesion: 0.22
Nodes (9): ADR triggers, Change design and layering, Commercial and metered capabilities, Current-state and boundary gate, Data, authentication, and tenancy, External providers and automated output, Jobs, files, API, and operations, Nexora Platform Engineering Change Checklists (+1 more)

### Community 50 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 51 - "membership-administration.use-cases.spec.ts"
Cohesion: 0.05
Nodes (48): isWriteConflict(), MembershipSessionRevocations, RevokedMembershipSession, Inject, Injectable, isWriteConflict(), isWriteConflict(), isWriteConflict() (+40 more)

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
Cohesion: 0.32
Nodes (3): ChangePassword, readSafeErrorCode(), Injectable

### Community 56 - "ADR-0005: Deny routes unless admission policy is explicit"
Cohesion: 0.11
Nodes (17): ADR-0005: Deny routes unless admission policy is explicit, Compatibility and migration, Consequences, Considered options, Context, Continue attaching guards to individual routes, Decision, Decision drivers (+9 more)

### Community 57 - "Create a downstream product from Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Create a downstream product from Nexora Platform Core, Define the product boundary, Minimum product repository guidance, Protect Core boundaries, Review inherited runtime identity, Start from a reviewed base

### Community 58 - "devDependencies"
Cohesion: 0.29
Nodes (7): eslint, @eslint/eslintrc, devDependencies, eslint, @eslint/eslintrc, @types/express, @types/express

### Community 59 - "Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Implemented, Local development, Nexora Platform Core, Prerequisites, Product extension model, Verification

### Community 60 - "audit.module.ts"
Cohesion: 0.22
Nodes (6): AUDIT_LOG_REPOSITORY, AuditLogRepository, AuditModule, Module, PrismaAuditLogRepository, Injectable

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

### Community 67 - "EmailVerificationConfirmationGuard"
Cohesion: 0.33
Nodes (3): EmailVerificationConfirmationGuard, Inject, Injectable

### Community 68 - "PasswordResetConfirmationGuard"
Cohesion: 0.33
Nodes (3): PasswordResetConfirmationGuard, Inject, Injectable

### Community 69 - "ADR-0009: Bounded user and workspace lifecycle"
Cohesion: 0.11
Nodes (17): Add bounded renames plus protected self-leave, Add user deactivation and workspace archival now, ADR-0009: Bounded user and workspace lifecycle, Compatibility and migration, Consequences, Considered options, Context, Decision (+9 more)

### Community 71 - ".execute"
Cohesion: 0.15
Nodes (5): readSafeErrorCode(), readSafeErrorCode(), SwitchWorkspace, Injectable, createFixture()

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

### Community 76 - "workspaces.module.ts"
Cohesion: 0.16
Nodes (12): AUTHENTICATION_SESSIONS_REPOSITORY, MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY, AuthenticationSessionStateModule, Module, AuthorizationPolicyModule, Module, CoreInfrastructureModule, Module (+4 more)

### Community 77 - "PasswordResetTokensRepository"
Cohesion: 0.13
Nodes (5): PasswordResetTokenRecord, PasswordResetTokensRepository, PrismaPasswordResetTokensRepository, recordSelection, Injectable

### Community 79 - "AppConfig"
Cohesion: 0.22
Nodes (5): AppConfig, environmentSchema, Injectable, RedisService, Injectable

### Community 82 - "IdentifierFactory"
Cohesion: 0.10
Nodes (23): AuthorizationDeniedError, AuthorizationPolicy, PERMISSIONS, Injectable, IdentityLookup, Inject, Injectable, Inject (+15 more)

### Community 83 - "AuthenticatedRoute"
Cohesion: 0.17
Nodes (9): Permission, ApplicationAuthenticatedRoute(), ApplicationAuthenticatedRouteOptions, AuthenticatedRoute(), AuthenticatedRouteOptions, RouteAdmissionExamples, PublicRouteOptions, RouteAdmission (+1 more)

### Community 86 - "Product boundary"
Cohesion: 0.67
Nodes (3): A downstream product repository owns, Platform Core owns, Product boundary

### Community 91 - "TransactionManager"
Cohesion: 0.12
Nodes (8): InlineTransactionManager, Inject, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, Inject, TransactionManager

### Community 93 - "membership-ownership-transfer-request.guard.ts"
Cohesion: 0.18
Nodes (8): MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER, MembershipOwnershipTransferRateLimitDecision, MembershipOwnershipTransferRateLimiterPort, MembershipOwnershipTransferRateLimiter, Injectable, MembershipOwnershipTransferRequestGuard, Inject, Injectable

### Community 94 - "RecordingInvitations"
Cohesion: 0.17
Nodes (5): createAcceptanceFixture(), createIssueFixture(), fixedClock(), inlineTransactions(), RecordingInvitations

### Community 97 - "Repository structure"
Cohesion: 0.67
Nodes (3): Current structure, Repository structure, Target structure

### Community 98 - ".leave"
Cohesion: 0.15
Nodes (22): ApiBadRequestResponse, ApiQuery, Query, MembershipsController, ApiBody, ApiConflictResponse, ApiCookieAuth, ApiForbiddenResponse (+14 more)

### Community 103 - "ADR-0008: Workspace membership administration and ownership safety"
Cohesion: 0.11
Nodes (18): ADR-0008: Workspace membership administration and ownership safety, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+10 more)

### Community 112 - "AuthenticationRateLimiter"
Cohesion: 0.37
Nodes (3): RateLimitDecision, AuthenticationRateLimiter, Injectable

### Community 115 - "AuthenticatedRequestContext"
Cohesion: 0.12
Nodes (21): AuthenticatedRequestContext, CurrentAuthenticatedContext, MembershipInvitationsController, ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse (+13 more)

### Community 116 - "Q: Implement Multi-workspace selection and switching task"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement Multi-workspace selection and switching task, Source Nodes

### Community 117 - ".execute"
Cohesion: 0.11
Nodes (6): MembershipInvitationTokenService, Injectable, MembershipInvitations, Inject, Injectable, readSafeErrorCode()

### Community 118 - "membership-invitations.controller.ts"
Cohesion: 0.14
Nodes (14): AcceptMembershipInvitation, isUniqueConflict(), readSafeErrorCode(), Injectable, CreateMembershipInvitation, isUniqueConflict(), readSafeErrorCode(), Injectable (+6 more)

### Community 120 - "workspaces.controller.ts"
Cohesion: 0.14
Nodes (14): RenameCurrentWorkspace, Injectable, RenameCurrentWorkspaceRequest, renameCurrentWorkspaceSchema, ApiBody, ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse (+6 more)

### Community 122 - "SessionCache"
Cohesion: 0.31
Nodes (3): CachedSession, SessionCache, Injectable

### Community 123 - "route-admission.guard.ts"
Cohesion: 0.19
Nodes (8): AuthenticatedRequestContextGuard, Injectable, TrustedOriginGuard, Injectable, isPermission(), isRouteAdmissionPolicy(), RouteAdmissionGuard, Injectable

### Community 125 - "AuthenticationUnavailableError"
Cohesion: 0.29
Nodes (3): ListSessionWorkspaces, Injectable, AuthenticationUnavailableError

### Community 126 - "pwned-passwords-compromise-checker.ts"
Cohesion: 0.23
Nodes (7): COMMON_PASSWORD_SHA256_HASHES, CONTEXT_SPECIFIC_PASSWORDS, findSuffix(), localHash(), PwnedPasswordsCompromiseChecker, readBoundedText(), Injectable

### Community 127 - "WorkspaceSwitchRequestGuard"
Cohesion: 0.33
Nodes (3): Inject, Injectable, WorkspaceSwitchRequestGuard

### Community 128 - "password-credential-verification.ts"
Cohesion: 0.20
Nodes (7): PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY, PasswordCredentialRecord, PasswordCredentialVerification, Inject, Injectable, VERIFIED_PASSWORD_HASH, VerifiedPasswordCredential

### Community 130 - "users.controller.ts"
Cohesion: 0.12
Nodes (13): UpdateOwnProfileRequest, updateOwnProfileSchema, ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags, Body (+5 more)

### Community 131 - "change-password.use-case.spec.ts"
Cohesion: 0.09
Nodes (8): EXPIRES_AT, InlineTransactionManager, NOW, RAW_TOKEN, RecordingCredentialRepository, RecordingResetTokensRepository, RecordingSessionCache, PasswordCredentialVerificationRepository

### Community 133 - "reset-password.use-case.ts"
Cohesion: 0.10
Nodes (15): PASSWORD_COMPROMISE_CHECKER, PasswordCompromiseChecker, PASSWORD_HASHER, PasswordHasher, RecordingHasher, RecordingPasswordCompromiseChecker, ResetPassword, Inject (+7 more)

### Community 134 - "memberships.controller.ts"
Cohesion: 0.27
Nodes (9): ChangeMembershipRoleRequest, changeMembershipRoleSchema, LeaveCurrentWorkspaceBody, leaveCurrentWorkspaceBodySchema, ListWorkspaceMembershipsRequest, listWorkspaceMembershipsSchema, TransferWorkspaceOwnershipRequest, transferWorkspaceOwnershipSchema (+1 more)

### Community 137 - "memberships.module.ts"
Cohesion: 0.22
Nodes (8): InvitedMembershipsWriter, Inject, Injectable, MEMBERSHIP_ADMINISTRATION_REPOSITORY, MEMBERSHIP_INVITATIONS_REPOSITORY, MEMBERSHIPS_REPOSITORY, Module, UsersModule

### Community 143 - "IdentityRegistration"
Cohesion: 0.40
Nodes (3): IdentityRegistration, Inject, Injectable

## Knowledge Gaps
- **439 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+434 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppConfig` connect `AppConfig` to `Clock`, `get-current-session.use-case.ts`, `change-password.use-case.ts`, `PasswordChangeRequestGuard`, `memberships.controller.ts`, `InvitableMembershipRole`, `authentication.controller.ts`, `OutboundMail`, `DatabaseContext`, `registration.errors.ts`, `app.module.ts`, `authentication.module.ts`, `membership-invitation-request.guard.ts`, `membership-administration.use-cases.spec.ts`, `IdentifierFactory`, `TransactionManager`, `membership-ownership-transfer-request.guard.ts`, `route-admission.guard.ts`, `pwned-passwords-compromise-checker.ts`, `WorkspaceSwitchRequestGuard`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `PrismaUsersRepository` connect `UsersRepository` to `users.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Clock` connect `Clock` to `change-password.use-case.ts`, `change-password.use-case.spec.ts`, `authentication.module.ts`, `reset-password.use-case.ts`, `InvitableMembershipRole`, `memberships.module.ts`, `workspaces.module.ts`, `users.ts`, `IdentifierFactory`, `membership-administration.use-cases.spec.ts`, `.now`, `TransactionManager`, `switch-workspace.use-case.spec.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _439 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Clock` be split into smaller, more focused modules?**
  _Cohesion score 0.09306122448979592 - nodes in this community are weakly interconnected._
- **Should `change-password.use-case.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12403100775193798 - nodes in this community are weakly interconnected._
- **Should `AuthenticationSessionsRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.12280701754385964 - nodes in this community are weakly interconnected._