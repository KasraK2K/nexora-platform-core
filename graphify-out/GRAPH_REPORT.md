# Graph Report - nexora-platform-core  (2026-08-14)

## Corpus Check
- 272 files · ~109,944 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2374 nodes · 5317 edges · 170 communities (128 shown, 42 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 289 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `106e8511`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- authentication.module.ts
- MembershipRole
- membership-ownership-transfer-request.guard.ts
- SessionRecord
- TransactionManager
- PublicRoute
- PrismaPasswordResetTokensRepository
- Nexora Platform Core - Implementation Baseline
- .enqueue
- What You Must Do When Invoked
- app.e2e-spec.ts
- authentication.controller.ts
- dependencies
- compilerOptions
- password-identity-authentication.ts
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
- .listForUser
- architecture.spec.ts
- OperationalTelemetry
- AuthenticationRateLimitPort
- PrismaPasswordIdentityRepository
- RecordingSessionCache
- check-source-documentation.mjs
- organizations.ts
- WorkspacesRepository
- Nexora Platform Engineering
- .execute
- request-password-reset.use-case.ts
- membership-invitations.controller.ts
- ADR-XXXX: Decision title
- jest
- membership-role.ts
- ADR-0006: Select and switch the active workspace per session
- identity.module.ts
- check-deprecated-apis.mjs
- prisma-identity-registration.repository.ts
- dependency-health.service.ts
- Foundation modules
- .create
- identity-lookup.ts
- Nexora Platform Engineering Change Checklists
- graphify reference: extra exports and benchmark
- transfer-workspace-ownership.use-case.ts
- package.json
- exclude
- update-common-password-blocklist.mjs
- .error
- ADR-0005: Deny routes unless admission policy is explicit
- Create a downstream product from Nexora Platform Core
- eslint
- Nexora Platform Core
- prisma-audit-log.repository.ts
- graphify reference: query, path, explain
- nest-cli.json
- ADR-0007: Base RBAC and email-bound membership invitations
- PrismaMailOutboxRepository
- IdentifierFactory
- EmailVerificationConfirmationGuard
- PasswordCredentialVerificationRepository
- ADR-0009: Bounded user and workspace lifecycle
- ts-loader
- .now
- Core module map
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- local-mutation-target.policy.ts
- api-exception.filter.ts
- RecordingSessionCache
- AppConfig
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- SmtpOutboundMail
- dotenv-cli
- Third-party notices
- extraction-spec.md
- AuditLog
- PrismaEmailVerificationsRepository
- devDependencies
- globals
- AuthenticatedRequestContext
- UnsafeDetailsError
- memberships.module.ts
- RecordingInvitations
- @nestjs/schematics
- @nestjs/testing
- Nexora Platform Engineering
- .leave
- prisma
- source-map-support
- supertest
- UnsafeWorkspaceSelectionDetailsError
- ADR-0008: Workspace membership administration and ownership safety
- ts-node
- tsconfig-paths
- @types/jest
- @types/node
- @types/nodemailer
- @types/supertest
- typescript
- app.module.ts
- AuthenticatedRoute
- ts-jest
- Q: Implement Multi-workspace selection and switching task
- MembershipInvitations
- registration.errors.ts
- RecordingCache
- workspaces.controller.ts
- RecordingSessionCache
- HealthController
- security-headers.middleware.ts
- MailOutboxRepository
- AuthenticationRateLimiter
- pwned-passwords-compromise-checker.ts
- ADR-0011: Production runtime and operations baseline
- password-credential-verification.ts
- users.controller.ts
- Clock
- MailOutboxWorker
- ADR-0012: Durable encrypted Core email outbox
- memberships.controller.ts
- GetCurrentSession
- @eslint/js
- Tenant isolation matrices
- Production operations runbook
- check-operations-docs.mjs
- jest
- SessionCache
- prettier
- eslint-config-prettier
- PasswordResetTokensRepository
- docs/README.md
- RecordingSessionCache
- @eslint/eslintrc
- MailPayloadProtector
- WorkspaceSwitchRequestGuard
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
- EmailVerificationsRepository
- register
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
8. `scripts` - 35 edges
9. `SessionCachePort` - 35 edges
10. `DatabaseContext` - 35 edges

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

## Communities (170 total, 42 thin omitted)

### Community 0 - "authentication.module.ts"
Cohesion: 0.07
Nodes (30): EmailVerificationDelivery, Injectable, EmailVerificationToken, EmailVerificationTokenService, Injectable, EMAIL_VERIFICATIONS_REPOSITORY, EmailVerifications, Inject (+22 more)

### Community 1 - "MembershipRole"
Cohesion: 0.06
Nodes (10): Inject, MembershipAdministrationRecord, MembershipAdministrationRepository, MembershipRole, LoginWorkspaceResolution, MembershipsRepository, MembershipSummary, membershipAdministrationSelect (+2 more)

### Community 2 - "membership-ownership-transfer-request.guard.ts"
Cohesion: 0.18
Nodes (8): MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER, MembershipOwnershipTransferRateLimitDecision, MembershipOwnershipTransferRateLimiterPort, MembershipOwnershipTransferRateLimiter, Injectable, MembershipOwnershipTransferRequestGuard, Inject, Injectable

### Community 3 - "SessionRecord"
Cohesion: 0.07
Nodes (9): AuthenticationSessionsRepository, RevokedSession, SessionContext, SessionRecord, RecordingSessionsRepository, MembershipSessionRevocationsRepository, RecordingSessionsRepository, PrismaAuthenticationSessionsRepository (+1 more)

### Community 4 - "TransactionManager"
Cohesion: 0.06
Nodes (17): InlineTransactionManager, InlineTransactionManager, MembershipSessionRevocations, Inject, Injectable, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager (+9 more)

### Community 5 - "PublicRoute"
Cohesion: 0.22
Nodes (23): ApiAcceptedResponse, AuthenticationController, setSessionCookie(), ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse (+15 more)

### Community 6 - "PrismaPasswordResetTokensRepository"
Cohesion: 0.20
Nodes (4): PasswordResetTokenRecord, PrismaPasswordResetTokensRepository, recordSelection, Injectable

### Community 7 - "Nexora Platform Core - Implementation Baseline"
Cohesion: 0.09
Nodes (22): A downstream product repository owns, Accepted decisions, API and observability, Architecture style, Commercial and metered capabilities, Current state, Current structure, Data ownership and persistence (+14 more)

### Community 8 - ".enqueue"
Cohesion: 0.33
Nodes (3): currentRequestContext(), RequestContext, storage

### Community 9 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "app.e2e-spec.ts"
Cohesion: 0.06
Nodes (13): invitationDeliveries, login(), loginBody(), readCookieHeader(), readSetCookie(), recordingEmailSender, recordingMembershipInvitationSender, recordingOutboundMail (+5 more)

### Community 11 - "authentication.controller.ts"
Cohesion: 0.10
Nodes (22): RequestPasswordReset, Injectable, ResetPassword, Injectable, Injectable, VerifyEmail, EmailVerificationConfirmation, emailVerificationConfirmationSchema (+14 more)

### Community 12 - "dependencies"
Cohesion: 0.07
Nodes (29): argon2, dotenv, @nestjs/common, @nestjs/core, @nestjs/platform-express, @nestjs/swagger, nodemailer, dependencies (+21 more)

### Community 13 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+18 more)

### Community 14 - "password-identity-authentication.ts"
Cohesion: 0.16
Nodes (10): PASSWORD_IDENTITY_REPOSITORY, PasswordIdentityAuthentication, PasswordIdentityRecord, RecordingVerifier, Inject, Injectable, PASSWORD_VERIFIER, PasswordVerifier (+2 more)

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
Cohesion: 0.28
Nodes (7): ProtectedMailPayload, MAIL_OUTBOX_REPOSITORY, MAIL_PAYLOAD_PROTECTOR, OUTBOUND_MAIL, OutboundMail, MailModule, Module

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
Cohesion: 0.15
Nodes (8): revokedSessionSelect, DatabaseContext, Injectable, PrismaService, Injectable, PrismaTransactionManager, Injectable, TransactionWriteConflictError

### Community 25 - ".listForUser"
Cohesion: 0.23
Nodes (3): ListSessionWorkspaces, Injectable, WorkspaceSelectionOption

### Community 26 - "architecture.spec.ts"
Cohesion: 0.17
Nodes (16): APPROVED_CROSS_MODULE_EXCEPTIONS, collectTypeScriptFiles(), DELEGATE_OWNERS, Dependency, dependencyViolation(), isApprovedException(), isLayer(), Layer (+8 more)

### Community 27 - "OperationalTelemetry"
Cohesion: 0.15
Nodes (11): increment(), OperationalTelemetry, Injectable, HttpTelemetryMiddleware, Injectable, MetricsController, safeEqual(), Controller (+3 more)

### Community 28 - "AuthenticationRateLimitPort"
Cohesion: 0.07
Nodes (23): AUTHENTICATION_RATE_LIMITER, AuthenticationRateLimitPort, EmailVerificationUnavailableError, PasswordResetUnavailableError, EmailVerificationRequestGuard, Inject, Injectable, LoginRequestGuard (+15 more)

### Community 29 - "PrismaPasswordIdentityRepository"
Cohesion: 0.22
Nodes (3): PasswordIdentityRepository, PrismaPasswordIdentityRepository, Injectable

### Community 31 - "check-source-documentation.mjs"
Cohesion: 0.25
Nodes (8): collectSourceFiles(), hasPlainLanguageJsDoc(), isIncludedSourcePath(), missing, reportMissing(), sourceFiles, sourceRoot, verifyScannerContract()

### Community 32 - "organizations.ts"
Cohesion: 0.18
Nodes (7): ORGANIZATIONS_REPOSITORY, OrganizationsRepository, OrganizationSummary, PrismaOrganizationsRepository, Injectable, OrganizationsModule, Module

### Community 33 - "WorkspacesRepository"
Cohesion: 0.16
Nodes (5): createFixture(), WorkspacesRepository, WorkspaceSummary, PrismaWorkspacesRepository, Injectable

### Community 34 - "Nexora Platform Engineering"
Cohesion: 0.14
Nodes (14): Apply cross-cutting controls, Architecture debt guards, Classify the repository boundary first, Classify the request, Define and implement the slice, Delegate when useful, Downstream product repository, Load the right context (+6 more)

### Community 35 - ".execute"
Cohesion: 0.22
Nodes (3): readSafeErrorCode(), SwitchWorkspace, Injectable

### Community 36 - "request-password-reset.use-case.ts"
Cohesion: 0.15
Nodes (9): PasswordResetDelivery, Injectable, PasswordResetToken, PasswordResetTokenService, Injectable, PASSWORD_RESET_TOKENS_REPOSITORY, PasswordResetTokens, Inject (+1 more)

### Community 37 - "membership-invitations.controller.ts"
Cohesion: 0.06
Nodes (39): AcceptMembershipInvitation, Injectable, CreateMembershipInvitation, isUniqueConflict(), readSafeErrorCode(), Injectable, MEMBERSHIP_INVITATION_RATE_LIMITER, MembershipInvitationRateLimitDecision (+31 more)

### Community 38 - "ADR-XXXX: Decision title"
Cohesion: 0.12
Nodes (16): ADR-XXXX: Decision title, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+8 more)

### Community 39 - "jest"
Cohesion: 0.15
Nodes (13): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+5 more)

### Community 40 - "membership-role.ts"
Cohesion: 0.08
Nodes (13): InvitedMembershipsWriter, Injectable, MembershipInvitationDelivery, Injectable, MEMBERSHIP_INVITATIONS_REPOSITORY, MembershipInvitationRecord, MembershipInvitationsRepository, InvitableMembershipRole (+5 more)

### Community 41 - "ADR-0006: Select and switch the active workspace per session"
Cohesion: 0.11
Nodes (17): ADR-0006: Select and switch the active workspace per session, Choose the most recent workspace automatically, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers (+9 more)

### Community 42 - "identity.module.ts"
Cohesion: 0.19
Nodes (8): IDENTITY_REGISTRATION_REPOSITORY, PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY, PasswordCredentialManagement, PasswordCredentialManagementRepository, Inject, Injectable, IdentityModule, Module

### Community 43 - "check-deprecated-apis.mjs"
Cohesion: 0.27
Nodes (8): addFinding(), configPath, deprecatedMessage(), findDeprecatedSymbol(), flattenUnion(), isImportName(), projectRoot, visit()

### Community 44 - "prisma-identity-registration.repository.ts"
Cohesion: 0.24
Nodes (5): IdentityRegistrationRepository, IdentityAlreadyExistsError, isUniqueConstraintError(), PrismaIdentityRegistrationRepository, Injectable

### Community 45 - "dependency-health.service.ts"
Cohesion: 0.17
Nodes (9): HealthLifecycleService, Injectable, HealthModule, Module, DependencyHealthService, ReadinessResult, Injectable, ObservabilityModule (+1 more)

### Community 46 - "Foundation modules"
Cohesion: 0.13
Nodes (15): Audit, Authentication, Authorization and roles, Configuration and persistence, Downstream product modules, Foundation modules, Identity, Memberships (+7 more)

### Community 47 - ".create"
Cohesion: 0.14
Nodes (3): readSafeErrorCode(), readSafeErrorCode(), readSafeErrorCode()

### Community 48 - "identity-lookup.ts"
Cohesion: 0.24
Nodes (5): IDENTITY_LOOKUP_REPOSITORY, IdentityLookupRepository, IdentitySummary, PrismaIdentityLookupRepository, Injectable

### Community 49 - "Nexora Platform Engineering Change Checklists"
Cohesion: 0.22
Nodes (9): ADR triggers, Change design and layering, Commercial and metered capabilities, Current-state and boundary gate, Data, authentication, and tenancy, External providers and automated output, Jobs, files, API, and operations, Nexora Platform Engineering Change Checklists (+1 more)

### Community 50 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 51 - "transfer-workspace-ownership.use-case.ts"
Cohesion: 0.08
Nodes (36): isWriteConflict(), RevokedMembershipSession, isWriteConflict(), isWriteConflict(), isWriteConflict(), AuthorizationDeniedError, PERMISSIONS, isWriteConflict() (+28 more)

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
Nodes (4): ChangePassword, readSafeErrorCode(), Injectable, VerifiedPasswordCredential

### Community 56 - "ADR-0005: Deny routes unless admission policy is explicit"
Cohesion: 0.11
Nodes (17): ADR-0005: Deny routes unless admission policy is explicit, Compatibility and migration, Consequences, Considered options, Context, Continue attaching guards to individual routes, Decision, Decision drivers (+9 more)

### Community 57 - "Create a downstream product from Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Create a downstream product from Nexora Platform Core, Define the product boundary, Minimum product repository guidance, Protect Core boundaries, Review inherited runtime identity, Start from a reviewed base

### Community 59 - "Nexora Platform Core"
Cohesion: 0.22
Nodes (8): Documentation, Implemented, Local development, Nexora Platform Core, Prerequisites, Product extension model, Production-readiness controls, Verification

### Community 60 - "prisma-audit-log.repository.ts"
Cohesion: 0.33
Nodes (3): AuditLogRepository, PrismaAuditLogRepository, Injectable

### Community 62 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 63 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 64 - "ADR-0007: Base RBAC and email-bound membership invitations"
Cohesion: 0.11
Nodes (17): Add base roles with transactional grant checks and email-bound tokens, ADR-0007: Base RBAC and email-bound membership invitations, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers (+9 more)

### Community 65 - "PrismaMailOutboxRepository"
Cohesion: 0.20
Nodes (5): ClaimedMail, MailPurpose, ensureUpdated(), PrismaMailOutboxRepository, Injectable

### Community 66 - "IdentifierFactory"
Cohesion: 0.12
Nodes (15): AppendAuditLog, EmailVerificationInvalidError, Injectable, UpdateOwnProfile, UserWriteConflictError, USERS_REPOSITORY, UserStatus, UserLifecycleInvalidError (+7 more)

### Community 67 - "EmailVerificationConfirmationGuard"
Cohesion: 0.33
Nodes (3): EmailVerificationConfirmationGuard, Inject, Injectable

### Community 69 - "ADR-0009: Bounded user and workspace lifecycle"
Cohesion: 0.11
Nodes (17): Add bounded renames plus protected self-leave, Add user deactivation and workspace archival now, ADR-0009: Bounded user and workspace lifecycle, Compatibility and migration, Consequences, Considered options, Context, Decision (+9 more)

### Community 71 - ".now"
Cohesion: 0.09
Nodes (4): readSafeErrorCode(), createFixture(), normalizeIdentityEmail(), readPayload()

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

### Community 77 - "api-exception.filter.ts"
Cohesion: 0.07
Nodes (30): Catch, compareObjectKeys(), contractPath, isRecord(), main(), sortObjectKeys(), validateSecurityReferences(), AppModule (+22 more)

### Community 79 - "AppConfig"
Cohesion: 0.10
Nodes (14): approvalSchema, AppConfig, environmentSchema, isHostname(), isIpOrCidr(), MANAGED_KEYS, TRUST_PROXY_NAMES, Injectable (+6 more)

### Community 86 - "AuditLog"
Cohesion: 0.07
Nodes (41): AuditLog, Inject, Injectable, AuthenticationSessions, Inject, Injectable, ChangedPasswordSession, PasswordChangeContext (+33 more)

### Community 88 - "PrismaEmailVerificationsRepository"
Cohesion: 0.20
Nodes (4): EmailVerificationRecord, PrismaEmailVerificationsRepository, recordSelection, Injectable

### Community 89 - "devDependencies"
Cohesion: 0.29
Nodes (7): @compodoc/compodoc, eslint-plugin-prettier, @nestjs/cli, devDependencies, @compodoc/compodoc, eslint-plugin-prettier, @nestjs/cli

### Community 91 - "AuthenticatedRequestContext"
Cohesion: 0.14
Nodes (15): AuthenticatedRequestContext, createAuthenticatedRequestContext(), CurrentSession, ResolvedAuthenticatedRequest, AUTHENTICATED_REQUEST_CONTEXT, CurrentAuthenticatedContext, CurrentAuthenticatedSession, readAuthenticatedRequestContext() (+7 more)

### Community 93 - "memberships.module.ts"
Cohesion: 0.16
Nodes (18): AUDIT_LOG_REPOSITORY, AuditModule, Module, AUTHENTICATION_SESSIONS_REPOSITORY, MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY, AuthenticationSessionStateModule, Module, AuthorizationPolicyModule (+10 more)

### Community 94 - "RecordingInvitations"
Cohesion: 0.17
Nodes (5): createAcceptanceFixture(), createIssueFixture(), fixedClock(), inlineTransactions(), RecordingInvitations

### Community 97 - "Nexora Platform Engineering"
Cohesion: 0.14
Nodes (14): Apply cross-cutting controls, Architecture debt guards, Classify the repository boundary first, Classify the request, Define and implement the slice, Delegate when useful, Downstream product repository, Load the right context (+6 more)

### Community 98 - ".leave"
Cohesion: 0.15
Nodes (22): ApiBadRequestResponse, ApiQuery, Query, MembershipsController, ApiBody, ApiConflictResponse, ApiCookieAuth, ApiForbiddenResponse (+14 more)

### Community 103 - "ADR-0008: Workspace membership administration and ownership safety"
Cohesion: 0.11
Nodes (18): ADR-0008: Workspace membership administration and ownership safety, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+10 more)

### Community 111 - "app.module.ts"
Cohesion: 0.20
Nodes (9): AppController, Controller, Get, AppService, Injectable, AuthenticationModule, Module, AuthorizationModule (+1 more)

### Community 112 - "AuthenticatedRoute"
Cohesion: 0.09
Nodes (23): attachAuthenticatedRequestContext(), AuthenticatedRequestContextGuard, Injectable, TrustedOriginGuard, Injectable, isPermission(), Permission, EmailVerificationRequiredError (+15 more)

### Community 116 - "Q: Implement Multi-workspace selection and switching task"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement Multi-workspace selection and switching task, Source Nodes

### Community 117 - "MembershipInvitations"
Cohesion: 0.11
Nodes (8): isUniqueConflict(), readSafeErrorCode(), MembershipInvitationTokenService, Injectable, MembershipInvitations, Inject, Injectable, readSafeErrorCode()

### Community 118 - "registration.errors.ts"
Cohesion: 0.07
Nodes (26): AccessibleWorkspaceLimitError, AccessibleWorkspaces, AccessibleWorkspaceStateError, Injectable, CreatedSession, CreateSessionCommand, LoginContextChangedError, EXPECTED_CONTEXT (+18 more)

### Community 120 - "workspaces.controller.ts"
Cohesion: 0.14
Nodes (14): RenameCurrentWorkspace, Injectable, RenameCurrentWorkspaceRequest, renameCurrentWorkspaceSchema, ApiBody, ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse (+6 more)

### Community 122 - "HealthController"
Cohesion: 0.22
Nodes (5): HealthController, Controller, Get, Res, check()

### Community 123 - "security-headers.middleware.ts"
Cohesion: 0.29
Nodes (5): SECURITY_POLICY, SecurityPolicy, SecurityHeadersMiddleware, Inject, Injectable

### Community 125 - "AuthenticationRateLimiter"
Cohesion: 0.37
Nodes (3): RateLimitDecision, AuthenticationRateLimiter, Injectable

### Community 126 - "pwned-passwords-compromise-checker.ts"
Cohesion: 0.22
Nodes (7): COMMON_PASSWORD_SHA256_HASHES, CONTEXT_SPECIFIC_PASSWORDS, findSuffix(), localHash(), PwnedPasswordsCompromiseChecker, readBoundedText(), Injectable

### Community 127 - "ADR-0011: Production runtime and operations baseline"
Cohesion: 0.17
Nodes (11): ADR-0011: Production runtime and operations baseline, Alternatives considered, Consequences, Context, Contracts and data, Decision, Open operator decisions, Reliability and observability (+3 more)

### Community 128 - "password-credential-verification.ts"
Cohesion: 0.20
Nodes (6): PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY, PasswordCredentialRecord, PasswordCredentialVerification, Inject, Injectable, VERIFIED_PASSWORD_HASH

### Community 130 - "users.controller.ts"
Cohesion: 0.12
Nodes (13): UpdateOwnProfileRequest, updateOwnProfileSchema, ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags, Body (+5 more)

### Community 131 - "Clock"
Cohesion: 0.10
Nodes (19): Inject, AuthorizationPolicy, Injectable, IdentityLookup, Inject, Injectable, Inject, CreatedMembershipInvitation (+11 more)

### Community 133 - "ADR-0012: Durable encrypted Core email outbox"
Cohesion: 0.18
Nodes (10): ADR-0012: Durable encrypted Core email outbox, Compatibility and schema impact, Context, Decision, Ownership and transaction boundaries, Reliability and observability, Residual risks and follow-up, Rollout and rollback (+2 more)

### Community 134 - "memberships.controller.ts"
Cohesion: 0.09
Nodes (23): ChangeMembershipRole, readSafeErrorCode(), Injectable, LeaveCurrentWorkspace, Injectable, ListWorkspaceMemberships, readSafeErrorCode(), Injectable (+15 more)

### Community 137 - "Tenant isolation matrices"
Cohesion: 0.33
Nodes (5): Completion rule, HTTP endpoint matrix, Repository matrix, Scope models, Tenant isolation matrices

### Community 138 - "Production operations runbook"
Cohesion: 0.20
Nodes (9): Backup and restore drill, Deployment, Incident response, Objectives, capacity, quotas, and alerts, Production operations runbook, Retention, deletion, and privacy, Rollback, Runtime configuration reference (+1 more)

### Community 140 - "check-operations-docs.mjs"
Cohesion: 0.25
Nodes (7): configKeys, configSource, example, headings, missingHeadings, missingKeys, runbook

### Community 144 - "SessionCache"
Cohesion: 0.31
Nodes (3): CachedSession, SessionCache, Injectable

### Community 148 - "PasswordResetTokensRepository"
Cohesion: 0.09
Nodes (8): RecordingResetTokensRepository, PasswordResetTokensRepository, activeUsers(), createRequestFixture(), createResetFixture(), fixedClock(), InMemoryResetTokens, sessionRepository()

### Community 149 - "docs/README.md"
Cohesion: 0.31
Nodes (3): Core module catalog, Module guide checklist, Ownership rules

### Community 153 - "MailPayloadProtector"
Cohesion: 0.24
Nodes (3): MailPayloadProtector, AesGcmMailPayloadProtector, Injectable

### Community 154 - "WorkspaceSwitchRequestGuard"
Cohesion: 0.33
Nodes (3): Inject, Injectable, WorkspaceSwitchRequestGuard

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
Cohesion: 0.27
Nodes (3): CreateSession, readSafeErrorCode(), Injectable

### Community 171 - "register"
Cohesion: 0.47
Nodes (6): confirmEmail(), readVerificationToken(), register(), registerUnverified(), registerWithPassword(), registrationBody()

### Community 172 - "OpenAPI reference workflow"
Cohesion: 0.40
Nodes (4): Committed contract, Documentation ownership, Live documentation, OpenAPI reference workflow

### Community 173 - "settings.json"
Cohesion: 0.50
Nodes (3): hooks, PreToolUse, $schema

## Knowledge Gaps
- **616 isolated node(s):** `$schema`, `PreToolUse`, `$schema`, `collection`, `sourceRoot` (+611 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppConfig` connect `AppConfig` to `authentication.module.ts`, `membership-ownership-transfer-request.guard.ts`, `Clock`, `memberships.controller.ts`, `GetCurrentSession`, `authentication.controller.ts`, `mail-outbox.ts`, `DatabaseContext`, `MailPayloadProtector`, `WorkspaceSwitchRequestGuard`, `OperationalTelemetry`, `AuthenticationRateLimitPort`, `request-password-reset.use-case.ts`, `membership-role.ts`, `dependency-health.service.ts`, `api-exception.filter.ts`, `SmtpOutboundMail`, `AuditLog`, `AuthenticatedRequestContext`, `memberships.module.ts`, `AuthenticatedRoute`, `registration.errors.ts`, `pwned-passwords-compromise-checker.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `PublicRoute()` connect `PublicRoute` to `app.e2e-spec.ts`, `authentication.controller.ts`, `AuthenticatedRequestContext`, `dependency-health.service.ts`, `app.module.ts`, `AuthenticatedRoute`, `HealthController`, `OperationalTelemetry`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `TransactionManager` connect `TransactionManager` to `authentication.module.ts`, `IdentifierFactory`, `Clock`, `request-password-reset.use-case.ts`, `transfer-workspace-ownership.use-case.ts`, `registration.errors.ts`, `AuditLog`, `DatabaseContext`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `$schema`, `PreToolUse`, `$schema` to the rest of the system?**
  _616 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `authentication.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06988120195667366 - nodes in this community are weakly interconnected._
- **Should `MembershipRole` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `SessionRecord` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._