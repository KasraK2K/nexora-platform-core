# Graph Report - nexora-platform-core  (2026-08-17)

## Corpus Check
- 274 files · ~111,729 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2380 nodes · 5330 edges · 171 communities (129 shown, 42 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 289 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a81a65ed`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Clock
- MembershipRole
- MembershipOwnershipTransferRateLimiter
- prisma-authentication-sessions.repository.ts
- TransactionManager
- PublicRoute
- AuthenticatedRoute
- Nexora Platform Core - Implementation Baseline
- api-exception.filter.ts
- What You Must Do When Invoked
- app.e2e-spec.ts
- authentication.controller.ts
- dependencies
- compilerOptions
- identity.module.ts
- Nexora Platform Core Repository Guidance
- ADR-0010: Retain the single-package modular monolith with executable foundation gates
- ADR-0004: Propagate a trusted authenticated request context
- scripts
- mail-outbox.ts
- UsersRepository
- ADR-0001: Screen new passwords against breached-password data
- ADR-0002: Keep this repository product-neutral
- ADR-0003: Rotate the current session after authenticated password change
- DatabaseContext
- .execute
- architecture.spec.ts
- core-infrastructure.module.ts
- authentication.module.ts
- JsonLogger
- RecordingSessionCache
- check-source-documentation.mjs
- PrismaOrganizationsRepository
- WorkspacesRepository
- Nexora Platform Engineering
- .execute
- registration.errors.ts
- membership-invitations.controller.ts
- ADR-XXXX: Decision title
- jest
- membership-role.ts
- ADR-0006: Select and switch the active workspace per session
- password-reset.use-cases.spec.ts
- check-deprecated-apis.mjs
- prisma-identity-registration.repository.ts
- DependencyHealthService
- Foundation modules
- .create
- AuthorizationPolicy
- Nexora Platform Engineering Change Checklists
- graphify reference: extra exports and benchmark
- ApplicationError
- package.json
- exclude
- update-common-password-blocklist.mjs
- .error
- ADR-0005: Deny routes unless admission policy is explicit
- Create a downstream product from Nexora Platform Core
- AuthenticatedRequestContext
- Nexora Platform Core
- isTransactionWriteConflict
- graphify reference: query, path, explain
- nest-cli.json
- ADR-0007: Base RBAC and email-bound membership invitations
- database-context.ts
- SessionRecord
- presentation/authenticated-request-context.ts
- PrismaPasswordResetTokensRepository
- ADR-0009: Bounded user and workspace lifecycle
- ts-loader
- .now
- Core module map
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- local-mutation-target.policy.ts
- generate-openapi.ts
- register-account.use-case.spec.ts
- AppConfig
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- LoginRequestGuard
- MembershipInvitationRateLimiter
- Third-party notices
- extraction-spec.md
- IdentifierFactory
- PasswordResetRequestGuard
- EmailVerificationsRepository
- devDependencies
- globals
- MailOutboxRepository
- EmailVerificationRequestGuard
- audit.module.ts
- RecordingInvitations
- @nestjs/schematics
- @nestjs/testing
- Nexora Platform Engineering
- CurrentAuthenticatedContext
- prisma
- source-map-support
- supertest
- ListWorkspaceMemberships
- ADR-0008: Workspace membership administration and ownership safety
- ts-node
- tsconfig-paths
- @types/jest
- @types/node
- @types/nodemailer
- @types/supertest
- typescript
- route-admission.guard.spec.ts
- ts-jest
- Q: Implement Multi-workspace selection and switching task
- ListSessionWorkspaces
- authenticated-request-context.guard.ts
- Argon2PasswordHasher
- workspaces.controller.ts
- switch-workspace.use-case.spec.ts
- eslint
- security-headers.middleware.ts
- MailModule
- AuthenticationRateLimiter
- pwned-passwords-compromise-checker.ts
- ADR-0011: Production runtime and operations baseline
- Nexora Platform Core Module Catalog
- update-own-profile.use-case.ts
- users.controller.ts
- memberships.module.ts
- .execute
- ADR-0012: Durable encrypted Core email outbox
- memberships.controller.ts
- GetCurrentSession
- @eslint/js
- Tenant isolation matrices
- Production operations runbook
- Session 22:59
- check-operations-docs.mjs
- jest
- @compodoc/compodoc
- SessionCache
- prettier
- eslint-config-prettier
- PasswordResetTokensRepository
- docs/README.md
- RecordingSessionCache
- @eslint/eslintrc
- PasswordResetConfirmationGuard
- How to change a Core capability safely
- 2026-08-13.md
- Authentication module
- Nexora Platform Core documentation
- tsconfig.doc.json
- Architecture overview
- Easily confused pairs
- Protected-request admission flow
- Registration flow
- Project tour
- .execute
- RecordingEmailVerifications
- OpenAPI reference workflow
- settings.json
- Nexora Platform Core — Claude Code
- @types/express
- typescript-eslint

## God Nodes (most connected - your core abstractions)
1. `AppConfig` - 67 edges
2. `TransactionManager` - 61 edges
3. `Clock` - 59 edges
4. `IdentifierFactory` - 56 edges
5. `AuditLog` - 53 edges
6. `ApplicationError` - 45 edges
7. `Users` - 42 edges
8. `DatabaseContext` - 36 edges
9. `scripts` - 35 edges
10. `SessionCachePort` - 35 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `assertSafeLocalMutationTargets()`  [EXTRACTED]
  prisma/seed.ts → src/core/configuration/local-mutation-target.policy.ts
- `UnsafeDetailsError` --inherits--> `ApplicationError`  [EXTRACTED]
  test/app.e2e-spec.ts → src/shared/domain/application-error.ts
- `UnsafeWorkspaceSelectionDetailsError` --inherits--> `ApplicationError`  [EXTRACTED]
  test/app.e2e-spec.ts → src/shared/domain/application-error.ts
- `main()` --calls--> `createOpenApiDocument()`  [EXTRACTED]
  scripts/generate-openapi.ts → src/configure-app.ts
- `bootstrap()` --calls--> `configureApp()`  [EXTRACTED]
  src/main.ts → src/configure-app.ts

## Import Cycles
- None detected.

## Communities (171 total, 42 thin omitted)

### Community 0 - "Clock"
Cohesion: 0.07
Nodes (37): AppendAuditLog, AuditLog, Inject, Injectable, EmailVerificationDelivery, Injectable, EmailVerificationToken, EmailVerificationTokenService (+29 more)

### Community 1 - "MembershipRole"
Cohesion: 0.07
Nodes (13): Inject, MEMBERSHIP_ADMINISTRATION_REPOSITORY, MembershipAdministration, MembershipAdministrationRecord, MembershipAdministrationRepository, Inject, Injectable, MembershipRole (+5 more)

### Community 2 - "MembershipOwnershipTransferRateLimiter"
Cohesion: 0.53
Nodes (3): MembershipOwnershipTransferRateLimitDecision, MembershipOwnershipTransferRateLimiter, Injectable

### Community 3 - "prisma-authentication-sessions.repository.ts"
Cohesion: 0.14
Nodes (5): SessionContext, MembershipSessionRevocationsRepository, PrismaAuthenticationSessionsRepository, revokedSessionSelect, Injectable

### Community 4 - "TransactionManager"
Cohesion: 0.10
Nodes (10): InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, Inject (+2 more)

### Community 5 - "PublicRoute"
Cohesion: 0.11
Nodes (33): ApiAcceptedResponse, AppController, Controller, Get, AppService, Injectable, AuthenticationController, setSessionCookie() (+25 more)

### Community 6 - "AuthenticatedRoute"
Cohesion: 0.15
Nodes (9): Permission, ApplicationAuthenticatedRoute(), ApplicationAuthenticatedRouteOptions, AuthenticatedRoute(), AuthenticatedRouteOptions, RouteAdmissionExamples, PublicRouteOptions, RouteAdmission (+1 more)

### Community 7 - "Nexora Platform Core - Implementation Baseline"
Cohesion: 0.09
Nodes (22): A downstream product repository owns, Accepted decisions, API and observability, Architecture style, Commercial and metered capabilities, Current state, Current structure, Data ownership and persistence (+14 more)

### Community 8 - "api-exception.filter.ts"
Cohesion: 0.13
Nodes (18): Catch, currentRequestContext(), RequestContext, runWithRequestContext(), storage, ApiExceptionFilter, applicationErrorStatus(), isSafeErrorBody() (+10 more)

### Community 9 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "app.e2e-spec.ts"
Cohesion: 0.05
Nodes (21): confirmEmail(), invitationDeliveries, login(), loginBody(), readCookieHeader(), readSetCookie(), readVerificationToken(), recordingEmailSender (+13 more)

### Community 11 - "authentication.controller.ts"
Cohesion: 0.11
Nodes (20): CreateSession, Injectable, RevokeCurrentSession, Injectable, EmailVerificationConfirmation, emailVerificationConfirmationSchema, EmailVerificationRequest, emailVerificationRequestSchema (+12 more)

### Community 12 - "dependencies"
Cohesion: 0.07
Nodes (29): argon2, dotenv, @nestjs/common, @nestjs/core, @nestjs/platform-express, @nestjs/swagger, nodemailer, dependencies (+21 more)

### Community 13 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+18 more)

### Community 14 - "identity.module.ts"
Cohesion: 0.05
Nodes (30): RecordingCredentialRepository, IDENTITY_LOOKUP_REPOSITORY, IdentityLookupRepository, IdentitySummary, IDENTITY_REGISTRATION_REPOSITORY, PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY, PasswordCredentialManagementRepository, PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY (+22 more)

### Community 15 - "Nexora Platform Core Repository Guidance"
Cohesion: 0.10
Nodes (20): API and observability, Architecture invariants, Billing, credits, and usage, Cross-cutting correctness, Current repository commands, Delegation, Dependency and API compatibility, Development database workflow (+12 more)

### Community 16 - "ADR-0010: Retain the single-package modular monolith with executable foundation gates"
Cohesion: 0.11
Nodes (17): Adopt pnpm workspaces and Turborepo now, Adopt pnpm workspaces without Turborepo, ADR-0010: Retain the single-package modular monolith with executable foundation gates, Compatibility and migration, Consequences, Considered options, Context, Decision (+9 more)

### Community 17 - "ADR-0004: Propagate a trusted authenticated request context"
Cohesion: 0.11
Nodes (17): ADR-0004: Propagate a trusted authenticated request context, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+9 more)

### Community 18 - "scripts"
Cohesion: 0.06
Nodes (35): scripts, build, check:deprecated, check:operations, check:production, contract:check, contract:generate, db:dev:down (+27 more)

### Community 19 - "mail-outbox.ts"
Cohesion: 0.07
Nodes (17): LeaseHeartbeat, MailOutbox, ProtectedMailPayload, readPayload(), MAIL_OUTBOX_REPOSITORY, Inject, Injectable, MAIL_PAYLOAD_PROTECTOR (+9 more)

### Community 20 - "UsersRepository"
Cohesion: 0.11
Nodes (6): users(), UserAuthenticationReference, UsersRepository, UserSummary, PrismaUsersRepository, Injectable

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
Cohesion: 0.24
Nodes (4): DatabaseContext, Injectable, PrismaTransactionManager, Injectable

### Community 26 - "architecture.spec.ts"
Cohesion: 0.17
Nodes (16): APPROVED_CROSS_MODULE_EXCEPTIONS, collectTypeScriptFiles(), DELEGATE_OWNERS, Dependency, dependencyViolation(), isApprovedException(), isLayer(), Layer (+8 more)

### Community 27 - "core-infrastructure.module.ts"
Cohesion: 0.11
Nodes (18): CoreInfrastructureModule, Module, HealthModule, Module, increment(), OperationalTelemetry, Injectable, HttpTelemetryMiddleware (+10 more)

### Community 28 - "authentication.module.ts"
Cohesion: 0.13
Nodes (15): AUTHENTICATION_RATE_LIMITER, AuthenticationRateLimitPort, EMAIL_VERIFICATIONS_REPOSITORY, PASSWORD_RESET_TOKENS_REPOSITORY, EmailVerificationUnavailableError, PasswordResetUnavailableError, EmailVerificationConfirmationGuard, Inject (+7 more)

### Community 29 - "JsonLogger"
Cohesion: 0.30
Nodes (4): isRecord(), JsonLogger, normalizeMessage(), redact()

### Community 31 - "check-source-documentation.mjs"
Cohesion: 0.25
Nodes (8): collectSourceFiles(), hasPlainLanguageJsDoc(), isIncludedSourcePath(), missing, reportMissing(), sourceFiles, sourceRoot, verifyScannerContract()

### Community 32 - "PrismaOrganizationsRepository"
Cohesion: 0.21
Nodes (4): OrganizationsRepository, OrganizationSummary, PrismaOrganizationsRepository, Injectable

### Community 33 - "WorkspacesRepository"
Cohesion: 0.16
Nodes (5): createFixture(), WorkspacesRepository, WorkspaceSummary, PrismaWorkspacesRepository, Injectable

### Community 34 - "Nexora Platform Engineering"
Cohesion: 0.14
Nodes (14): Apply cross-cutting controls, Architecture debt guards, Classify the repository boundary first, Classify the request, Define and implement the slice, Delegate when useful, Downstream product repository, Load the right context (+6 more)

### Community 36 - "registration.errors.ts"
Cohesion: 0.11
Nodes (18): ChangedPasswordSession, PasswordChangeContext, EXPIRES_AT, NOW, RAW_TOKEN, Inject, PASSWORD_COMPROMISE_CHECKER, PasswordCompromiseChecker (+10 more)

### Community 37 - "membership-invitations.controller.ts"
Cohesion: 0.15
Nodes (13): normalizeIdentityEmail(), MEMBERSHIP_INVITATION_RATE_LIMITER, MembershipInvitationRateLimiterPort, AcceptMembershipInvitationRequest, acceptMembershipInvitationSchema, CreateMembershipInvitationRequest, createMembershipInvitationSchema, enforceDecision() (+5 more)

### Community 38 - "ADR-XXXX: Decision title"
Cohesion: 0.12
Nodes (16): ADR-XXXX: Decision title, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+8 more)

### Community 39 - "jest"
Cohesion: 0.15
Nodes (13): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+5 more)

### Community 40 - "membership-role.ts"
Cohesion: 0.08
Nodes (10): MembershipInvitationDelivery, Injectable, MEMBERSHIP_INVITATIONS_REPOSITORY, MembershipInvitationRecord, MembershipInvitationsRepository, InvitableMembershipRole, isInvitableMembershipRole(), MEMBERSHIP_ROLES (+2 more)

### Community 41 - "ADR-0006: Select and switch the active workspace per session"
Cohesion: 0.11
Nodes (17): ADR-0006: Select and switch the active workspace per session, Choose the most recent workspace automatically, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers (+9 more)

### Community 42 - "password-reset.use-cases.spec.ts"
Cohesion: 0.09
Nodes (24): PasswordResetToken, PasswordResetTokenService, Injectable, PasswordResetTokens, Inject, Injectable, activeUsers(), createRequestFixture() (+16 more)

### Community 43 - "check-deprecated-apis.mjs"
Cohesion: 0.27
Nodes (8): addFinding(), configPath, deprecatedMessage(), findDeprecatedSymbol(), flattenUnion(), isImportName(), projectRoot, visit()

### Community 44 - "prisma-identity-registration.repository.ts"
Cohesion: 0.24
Nodes (5): IdentityRegistrationRepository, IdentityAlreadyExistsError, isUniqueConstraintError(), PrismaIdentityRegistrationRepository, Injectable

### Community 45 - "DependencyHealthService"
Cohesion: 0.12
Nodes (9): HealthController, Controller, Get, Res, HealthLifecycleService, Injectable, check(), DependencyHealthService (+1 more)

### Community 46 - "Foundation modules"
Cohesion: 0.18
Nodes (11): Audit, Authentication, Authorization and roles, Configuration and persistence, Foundation modules, Identity, Mail, Memberships (+3 more)

### Community 47 - ".create"
Cohesion: 0.22
Nodes (3): readSafeErrorCode(), readSafeErrorCode(), readSafeErrorCode()

### Community 48 - "AuthorizationPolicy"
Cohesion: 0.12
Nodes (15): AuditModule, Module, AuthorizationPolicy, PERMISSIONS, Injectable, AuthorizationPolicyModule, Module, MembershipsModule (+7 more)

### Community 49 - "Nexora Platform Engineering Change Checklists"
Cohesion: 0.22
Nodes (9): ADR triggers, Change design and layering, Commercial and metered capabilities, Current-state and boundary gate, Data, authentication, and tenancy, External providers and automated output, Jobs, files, API, and operations, Nexora Platform Engineering Change Checklists (+1 more)

### Community 50 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 51 - "ApplicationError"
Cohesion: 0.07
Nodes (28): RevokedMembershipSession, AuthorizationDeniedError, LeaveCurrentWorkspace, MembershipWriteConflictError, Injectable, MembershipAdministrationStateError, WorkspaceMembershipListItem, WorkspaceMembershipPage (+20 more)

### Community 52 - "package.json"
Cohesion: 0.20
Nodes (9): author, description, engines, node, license, name, packageManager, private (+1 more)

### Community 53 - "exclude"
Cohesion: 0.22
Nodes (8): **/*spec.ts, test, exclude, extends, dist, documentation, node_modules, ./tsconfig.json

### Community 54 - "update-common-password-blocklist.mjs"
Cohesion: 0.29
Nodes (7): hashes, OUTPUT_PATH, sha256(), sourceBytes, sourcePasswords, sourceSha256, sourceText

### Community 55 - ".error"
Cohesion: 0.30
Nodes (4): ChangePassword, isWriteConflict(), readSafeErrorCode(), Injectable

### Community 56 - "ADR-0005: Deny routes unless admission policy is explicit"
Cohesion: 0.11
Nodes (17): ADR-0005: Deny routes unless admission policy is explicit, Compatibility and migration, Consequences, Considered options, Context, Continue attaching guards to individual routes, Decision, Decision drivers (+9 more)

### Community 57 - "Create a downstream product from Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Create a downstream product from Nexora Platform Core, Define the product boundary, Minimum product repository guidance, Protect Core boundaries, Review inherited runtime identity, Start from a reviewed base

### Community 58 - "AuthenticatedRequestContext"
Cohesion: 0.17
Nodes (17): AuthenticatedRequestContext, MembershipInvitationsController, ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse (+9 more)

### Community 59 - "Nexora Platform Core"
Cohesion: 0.22
Nodes (8): Documentation, Implemented, Local development, Nexora Platform Core, Prerequisites, Product extension model, Production-readiness controls, Verification

### Community 60 - "isTransactionWriteConflict"
Cohesion: 0.16
Nodes (12): ChangeMembershipRole, isWriteConflict(), MembershipWriteConflictError, readSafeErrorCode(), Inject, Injectable, isWriteConflict(), isWriteConflict() (+4 more)

### Community 62 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 63 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 64 - "ADR-0007: Base RBAC and email-bound membership invitations"
Cohesion: 0.11
Nodes (17): Add base roles with transactional grant checks and email-bound tokens, ADR-0007: Base RBAC and email-bound membership invitations, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers (+9 more)

### Community 65 - "database-context.ts"
Cohesion: 0.18
Nodes (5): ClaimedMail, MailPurpose, ensureUpdated(), PrismaMailOutboxRepository, Injectable

### Community 66 - "SessionRecord"
Cohesion: 0.12
Nodes (5): AuthenticationSessionsRepository, RevokedSession, SessionRecord, RecordingSessionsRepository, RecordingSessionsRepository

### Community 67 - "presentation/authenticated-request-context.ts"
Cohesion: 0.16
Nodes (12): createAuthenticatedRequestContext(), ResolvedAuthenticatedRequest, AUTHENTICATED_REQUEST_CONTEXT, CurrentAuthenticatedSession, readAuthenticatedRequestContext(), RequestWithAuthenticatedContext, requireAuthenticatedRequestContext(), MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER (+4 more)

### Community 68 - "PrismaPasswordResetTokensRepository"
Cohesion: 0.20
Nodes (3): PrismaPasswordResetTokensRepository, recordSelection, Injectable

### Community 69 - "ADR-0009: Bounded user and workspace lifecycle"
Cohesion: 0.11
Nodes (17): Add bounded renames plus protected self-leave, Add user deactivation and workspace archival now, ADR-0009: Bounded user and workspace lifecycle, Compatibility and migration, Consequences, Considered options, Context, Decision (+9 more)

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

### Community 76 - "local-mutation-target.policy.ts"
Cohesion: 0.23
Nodes (8): main(), SEED, assertSafeLocalMutationTargets(), LocalMutationPurpose, LOOPBACK_HOSTS, MutationEnvironment, parseUrl(), developmentEnvironment

### Community 77 - "generate-openapi.ts"
Cohesion: 0.24
Nodes (11): compareObjectKeys(), contractPath, isRecord(), main(), sortObjectKeys(), validateSecurityReferences(), AppModule, Module (+3 more)

### Community 78 - "register-account.use-case.spec.ts"
Cohesion: 0.11
Nodes (9): RecordingEmailSender, RecordingHasher, RecordingPasswordCompromiseChecker, RecordingSessionCache, RegistrationUnavailableError, CreatePasswordIdentity, IdentityRegistration, Inject (+1 more)

### Community 79 - "AppConfig"
Cohesion: 0.09
Nodes (15): approvalSchema, CachedSession, AppConfig, environmentSchema, isHostname(), isIpOrCidr(), MANAGED_KEYS, TRUST_PROXY_NAMES (+7 more)

### Community 82 - "LoginRequestGuard"
Cohesion: 0.33
Nodes (3): LoginRequestGuard, Inject, Injectable

### Community 83 - "MembershipInvitationRateLimiter"
Cohesion: 0.57
Nodes (3): MembershipInvitationRateLimitDecision, MembershipInvitationRateLimiter, Injectable

### Community 86 - "IdentifierFactory"
Cohesion: 0.08
Nodes (31): AUTHENTICATION_SESSIONS_REPOSITORY, AuthenticationSessions, Inject, Injectable, CreatedSession, CreateSessionCommand, LoginContextChangedError, Inject (+23 more)

### Community 87 - "PasswordResetRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordResetRequestGuard, Inject, Injectable

### Community 88 - "EmailVerificationsRepository"
Cohesion: 0.12
Nodes (5): EmailVerificationRecord, EmailVerificationsRepository, PrismaEmailVerificationsRepository, recordSelection, Injectable

### Community 89 - "devDependencies"
Cohesion: 0.29
Nodes (7): dotenv-cli, eslint-plugin-prettier, @nestjs/cli, devDependencies, dotenv-cli, eslint-plugin-prettier, @nestjs/cli

### Community 92 - "EmailVerificationRequestGuard"
Cohesion: 0.33
Nodes (3): EmailVerificationRequestGuard, Inject, Injectable

### Community 93 - "audit.module.ts"
Cohesion: 0.28
Nodes (4): AUDIT_LOG_REPOSITORY, AuditLogRepository, PrismaAuditLogRepository, Injectable

### Community 94 - "RecordingInvitations"
Cohesion: 0.17
Nodes (5): createAcceptanceFixture(), createIssueFixture(), fixedClock(), inlineTransactions(), RecordingInvitations

### Community 97 - "Nexora Platform Engineering"
Cohesion: 0.14
Nodes (14): Apply cross-cutting controls, Architecture debt guards, Classify the repository boundary first, Classify the request, Define and implement the slice, Delegate when useful, Downstream product repository, Load the right context (+6 more)

### Community 98 - "CurrentAuthenticatedContext"
Cohesion: 0.15
Nodes (23): ApiBadRequestResponse, ApiQuery, Query, CurrentAuthenticatedContext, MembershipsController, ApiBody, ApiConflictResponse, ApiCookieAuth (+15 more)

### Community 102 - "ListWorkspaceMemberships"
Cohesion: 0.33
Nodes (4): ListWorkspaceMemberships, readSafeErrorCode(), Inject, Injectable

### Community 103 - "ADR-0008: Workspace membership administration and ownership safety"
Cohesion: 0.11
Nodes (18): ADR-0008: Workspace membership administration and ownership safety, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+10 more)

### Community 112 - "route-admission.guard.spec.ts"
Cohesion: 0.11
Nodes (18): AuthenticationModule, Module, attachAuthenticatedRequestContext(), AuthenticatedRequestContextGuard, Injectable, TrustedOriginGuard, Injectable, isPermission() (+10 more)

### Community 116 - "Q: Implement Multi-workspace selection and switching task"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement Multi-workspace selection and switching task, Source Nodes

### Community 118 - "authenticated-request-context.guard.ts"
Cohesion: 0.11
Nodes (9): PasswordChangeUnavailableError, WorkspaceSwitchUnavailableError, PasswordChangeRequestGuard, Inject, Injectable, readCookie(), Inject, Injectable (+1 more)

### Community 119 - "Argon2PasswordHasher"
Cohesion: 0.19
Nodes (6): Argon2PasswordHasher, Injectable, OrganizationsModule, Module, Module, UsersModule

### Community 120 - "workspaces.controller.ts"
Cohesion: 0.15
Nodes (12): RenameCurrentWorkspaceRequest, renameCurrentWorkspaceSchema, ApiBody, ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags (+4 more)

### Community 121 - "switch-workspace.use-case.spec.ts"
Cohesion: 0.08
Nodes (19): AccessibleWorkspaceLimitError, AccessibleWorkspaces, AccessibleWorkspaceStateError, Injectable, EXPECTED_CONTEXT, EXPIRES_AT, NOW, RAW_TOKEN (+11 more)

### Community 123 - "security-headers.middleware.ts"
Cohesion: 0.29
Nodes (5): SECURITY_POLICY, SecurityPolicy, SecurityHeadersMiddleware, Inject, Injectable

### Community 125 - "AuthenticationRateLimiter"
Cohesion: 0.37
Nodes (3): RateLimitDecision, AuthenticationRateLimiter, Injectable

### Community 126 - "pwned-passwords-compromise-checker.ts"
Cohesion: 0.23
Nodes (7): COMMON_PASSWORD_SHA256_HASHES, CONTEXT_SPECIFIC_PASSWORDS, findSuffix(), localHash(), PwnedPasswordsCompromiseChecker, readBoundedText(), Injectable

### Community 127 - "ADR-0011: Production runtime and operations baseline"
Cohesion: 0.17
Nodes (11): ADR-0011: Production runtime and operations baseline, Alternatives considered, Consequences, Context, Contracts and data, Decision, Open operator decisions, Reliability and observability (+3 more)

### Community 128 - "Nexora Platform Core Module Catalog"
Cohesion: 0.40
Nodes (5): Downstream product modules, Nexora Platform Core Module Catalog, Optional reusable capability packs, Ownership rules, Shared kernel and contracts

### Community 129 - "update-own-profile.use-case.ts"
Cohesion: 0.12
Nodes (11): MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY, MembershipSessionRevocations, Inject, Injectable, AuthenticationSessionStateModule, Module, isWriteConflict(), readSafeErrorCode() (+3 more)

### Community 130 - "users.controller.ts"
Cohesion: 0.12
Nodes (13): UpdateOwnProfileRequest, updateOwnProfileSchema, ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags, Body (+5 more)

### Community 131 - "memberships.module.ts"
Cohesion: 0.08
Nodes (25): AcceptMembershipInvitation, isUniqueConflict(), isWriteConflict(), readSafeErrorCode(), Injectable, CreatedMembershipInvitation, CreateMembershipInvitation, isUniqueConflict() (+17 more)

### Community 133 - "ADR-0012: Durable encrypted Core email outbox"
Cohesion: 0.18
Nodes (10): ADR-0012: Durable encrypted Core email outbox, Compatibility and schema impact, Context, Decision, Ownership and transaction boundaries, Reliability and observability, Residual risks and follow-up, Rollout and rollback (+2 more)

### Community 134 - "memberships.controller.ts"
Cohesion: 0.29
Nodes (8): ChangeMembershipRoleRequest, changeMembershipRoleSchema, LeaveCurrentWorkspaceBody, leaveCurrentWorkspaceBodySchema, ListWorkspaceMembershipsRequest, listWorkspaceMembershipsSchema, TransferWorkspaceOwnershipRequest, transferWorkspaceOwnershipSchema

### Community 137 - "Tenant isolation matrices"
Cohesion: 0.33
Nodes (5): Completion rule, HTTP endpoint matrix, Repository matrix, Scope models, Tenant isolation matrices

### Community 138 - "Production operations runbook"
Cohesion: 0.20
Nodes (9): Backup and restore drill, Deployment, Incident response, Objectives, capacity, quotas, and alerts, Production operations runbook, Retention, deletion, and privacy, Rollback, Runtime configuration reference (+1 more)

### Community 140 - "check-operations-docs.mjs"
Cohesion: 0.25
Nodes (7): configKeys, configSource, example, headings, missingHeadings, missingKeys, runbook

### Community 148 - "PasswordResetTokensRepository"
Cohesion: 0.11
Nodes (3): RecordingResetTokensRepository, PasswordResetTokensRepository, InMemoryResetTokens

### Community 149 - "docs/README.md"
Cohesion: 0.31
Nodes (3): Core module catalog, Module guide checklist, Ownership rules

### Community 154 - "PasswordResetConfirmationGuard"
Cohesion: 0.33
Nodes (3): PasswordResetConfirmationGuard, Inject, Injectable

### Community 155 - "How to change a Core capability safely"
Cohesion: 0.22
Nodes (8): 1. Establish current truth, 2. Classify ownership, 3. Trace the vertical slice, 4. Handle schema changes in development, 5. Update contracts and documentation, 6. Verify, 7. Review the result, How to change a Core capability safely

### Community 156 - "2026-08-13.md"
Cohesion: 0.22
Nodes (8): 17:01, 17:13, Session 16:53, Session 17:01, Session 17:12, Session 17:13, Session 17:55, Session 17:56

### Community 157 - "Authentication module"
Cohesion: 0.25
Nodes (8): Authentication module, Behavioral evidence, Dependencies, Owned data, Public HTTP contract, Responsibilities, Security and tenancy invariants, Source map

### Community 158 - "Nexora Platform Core documentation"
Cohesion: 0.25
Nodes (8): Documentation map, Generated references, HTTP contract, NestJS code navigation, Nexora Platform Core documentation, Sources of truth, Start here, Writing and maintenance rules

### Community 159 - "tsconfig.doc.json"
Cohesion: 0.22
Nodes (8): src/generated/**, src/**/*.generated.ts, src/**/*.spec.ts, src/**/*.ts, exclude, extends, include, ./tsconfig.json

### Community 161 - "Architecture overview"
Cohesion: 0.29
Nodes (7): Architecture overview, Authentication, admission, and authorization, Data ownership, Layers inside a capability, Platform boundary, Stable boundaries worth protecting, Transactions and side effects

### Community 162 - "Easily confused pairs"
Cohesion: 0.29
Nodes (6): Core glossary, Easily confused pairs, Identity versus user, Organization versus workspace, Role versus permission, Session versus request context

### Community 163 - "Protected-request admission flow"
Cohesion: 0.29
Nodes (7): Code and tests, Invariants to preserve, Protected-request admission flow, Sequence, The three policy types, Trusted context, Why PostgreSQL is read on authenticated requests

### Community 164 - "Registration flow"
Cohesion: 0.29
Nodes (7): After commit, Before the transaction, Code and tests, Inside the transaction, Invariants to preserve, Registration flow, Sequence

### Community 165 - "Project tour"
Cohesion: 0.29
Nodes (7): Directory map, How modules communicate, Project tour, Request lifecycle, Run the project and references, The shortest useful reading path, Where to answer common questions

### Community 166 - ".execute"
Cohesion: 0.18
Nodes (5): isWriteConflict(), isWriteConflict(), readSafeErrorCode(), SwitchWorkspace, Injectable

### Community 172 - "OpenAPI reference workflow"
Cohesion: 0.40
Nodes (4): Committed contract, Documentation ownership, Live documentation, OpenAPI reference workflow

### Community 173 - "settings.json"
Cohesion: 0.50
Nodes (3): hooks, PreToolUse, $schema

## Knowledge Gaps
- **619 isolated node(s):** `$schema`, `PreToolUse`, `$schema`, `collection`, `sourceRoot` (+614 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppConfig` connect `AppConfig` to `Clock`, `presentation/authenticated-request-context.ts`, `memberships.module.ts`, `memberships.controller.ts`, `membership-role.ts`, `password-reset.use-cases.spec.ts`, `authentication.controller.ts`, `generate-openapi.ts`, `register-account.use-case.spec.ts`, `route-admission.guard.spec.ts`, `mail-outbox.ts`, `ApplicationError`, `IdentifierFactory`, `authenticated-request-context.guard.ts`, `core-infrastructure.module.ts`, `pwned-passwords-compromise-checker.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `PublicRoute()` connect `PublicRoute` to `AuthenticatedRoute`, `app.e2e-spec.ts`, `authentication.controller.ts`, `DependencyHealthService`, `route-admission.guard.spec.ts`, `core-infrastructure.module.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `TransactionManager` connect `TransactionManager` to `Clock`, `update-own-profile.use-case.ts`, `memberships.module.ts`, `registration.errors.ts`, `ListWorkspaceMemberships`, `password-reset.use-cases.spec.ts`, `register-account.use-case.spec.ts`, `AuthorizationPolicy`, `ApplicationError`, `IdentifierFactory`, `DatabaseContext`, `switch-workspace.use-case.spec.ts`, `isTransactionWriteConflict`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `$schema`, `PreToolUse`, `$schema` to the rest of the system?**
  _619 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Clock` be split into smaller, more focused modules?**
  _Cohesion score 0.06944444444444445 - nodes in this community are weakly interconnected._
- **Should `MembershipRole` be split into smaller, more focused modules?**
  _Cohesion score 0.06659619450317125 - nodes in this community are weakly interconnected._
- **Should `prisma-authentication-sessions.repository.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._