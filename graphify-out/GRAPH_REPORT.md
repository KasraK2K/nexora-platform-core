# Graph Report - nexora-platform-core  (2026-08-13)

## Corpus Check
- 251 files · ~91,091 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2234 nodes · 5171 edges · 157 communities (119 shown, 38 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 289 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cfe1495c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- identifier-factory.ts
- PrismaMembershipsRepository
- membership-ownership-transfer-rate-limiter.ts
- SessionRecord
- PasswordChangeRequestGuard
- PublicRoute
- PasswordResetTokensRepository
- Nexora Platform Core - Implementation Baseline
- MembershipInvitationDelivery
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
- MembershipRole
- architecture.spec.ts
- OperationalTelemetry
- AuthenticationRateLimitPort
- PrismaPasswordIdentityRepository
- RecordingSessionCache
- api-exception.filter.ts
- organizations.ts
- WorkspacesRepository
- Nexora Platform Engineering
- .execute
- authentication.module.ts
- memberships.module.ts
- ADR-XXXX: Decision title
- jest
- PrismaMembershipInvitationsRepository
- ADR-0006: Select and switch the active workspace per session
- PasswordCredentialManagement
- check-deprecated-apis.mjs
- prisma-identity-registration.repository.ts
- dependency-health.service.ts
- Foundation modules
- .execute
- identity-lookup.ts
- Nexora Platform Engineering Change Checklists
- graphify reference: extra exports and benchmark
- AuthorizationPolicy
- package.json
- exclude
- update-common-password-blocklist.mjs
- .error
- ADR-0005: Deny routes unless admission policy is explicit
- Create a downstream product from Nexora Platform Core
- devDependencies
- Nexora Platform Core
- prisma-audit-log.repository.ts
- Nexora Platform Core Module Catalog
- graphify reference: query, path, explain
- nest-cli.json
- ADR-0007: Base RBAC and email-bound membership invitations
- MailOutboxRepository
- ApplicationError
- EmailVerificationConfirmationGuard
- PasswordResetConfirmationGuard
- ADR-0009: Bounded user and workspace lifecycle
- ts-loader
- .now
- Core module map
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- local-mutation-target.policy.ts
- generate-openapi.ts
- RecordingSessionCache
- AppConfig
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- create-membership-invitation.use-case.ts
- AuthenticatedRoute
- Third-party notices
- extraction-spec.md
- Product boundary
- EmailVerificationsRepository
- eslint-plugin-prettier
- globals
- RouteAdmissionProbeController
- @nestjs/cli
- workspaces.module.ts
- RecordingInvitations
- @nestjs/schematics
- @nestjs/testing
- Repository structure
- AuthenticatedRequestContext
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
- app.module.ts
- get-current-session.use-case.ts
- membership-invitations.controller.ts
- Q: Implement Multi-workspace selection and switching task
- MembershipInvitations
- Organizations
- RecordingCache
- workspaces.controller.ts
- RecordingSessionCache
- HealthController
- security-headers.middleware.ts
- authorization.module.ts
- AuthenticationRateLimiter
- pwned-passwords-compromise-checker.ts
- ADR-0011: Production runtime and operations baseline
- password-credential-verification.ts
- JsonLogger
- users.controller.ts
- TransactionManager
- MailOutboxWorker
- ADR-0012: Durable encrypted Core email outbox
- memberships.controller.ts
- .listForUser
- @eslint/js
- Tenant isolation matrices
- Production operations runbook
- MembershipsRepository
- check-operations-docs.mjs
- jest
- PasswordResetRequestGuard
- IdentityRegistration
- SessionCache
- EmailVerificationRequestGuard
- prettier
- eslint-config-prettier
- InMemoryResetTokens
- .constructor
- RecordingSessionCache
- @eslint/eslintrc
- LoginRequestGuard
- RegistrationRequestGuard
- WorkspaceSwitchRequestGuard
- .getMetrics
- dotenv-cli

## God Nodes (most connected - your core abstractions)
1. `AppConfig` - 67 edges
2. `TransactionManager` - 61 edges
3. `Clock` - 59 edges
4. `IdentifierFactory` - 56 edges
5. `AuditLog` - 53 edges
6. `ApplicationError` - 45 edges
7. `Users` - 42 edges
8. `SessionCachePort` - 35 edges
9. `DatabaseContext` - 35 edges
10. `AuthorizationPolicy` - 34 edges

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

## Communities (157 total, 38 thin omitted)

### Community 0 - "identifier-factory.ts"
Cohesion: 0.10
Nodes (18): EmailVerificationDelivery, Injectable, EmailVerificationToken, EmailVerificationTokenService, Injectable, EMAIL_VERIFICATIONS_REPOSITORY, EmailVerifications, Inject (+10 more)

### Community 1 - "PrismaMembershipsRepository"
Cohesion: 0.15
Nodes (6): MembershipAdministrationRecord, LoginWorkspaceResolution, MembershipSummary, membershipAdministrationSelect, PrismaMembershipsRepository, Injectable

### Community 2 - "membership-ownership-transfer-rate-limiter.ts"
Cohesion: 0.19
Nodes (8): MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER, MembershipOwnershipTransferRateLimitDecision, MembershipOwnershipTransferRateLimiterPort, MembershipOwnershipTransferRateLimiter, Injectable, MembershipOwnershipTransferRequestGuard, Inject, Injectable

### Community 3 - "SessionRecord"
Cohesion: 0.07
Nodes (10): AuthenticationSessionsRepository, RevokedSession, SessionContext, SessionRecord, RecordingSessionsRepository, MembershipSessionRevocationsRepository, RecordingSessionsRepository, PrismaAuthenticationSessionsRepository (+2 more)

### Community 4 - "PasswordChangeRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordChangeRequestGuard, Inject, Injectable

### Community 5 - "PublicRoute"
Cohesion: 0.19
Nodes (25): ApiAcceptedResponse, AuthenticationController, setSessionCookie(), ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse (+17 more)

### Community 6 - "PasswordResetTokensRepository"
Cohesion: 0.09
Nodes (6): RecordingResetTokensRepository, PasswordResetTokenRecord, PasswordResetTokensRepository, PrismaPasswordResetTokensRepository, recordSelection, Injectable

### Community 7 - "Nexora Platform Core - Implementation Baseline"
Cohesion: 0.12
Nodes (16): Accepted decisions, API and observability, Architecture style, Commercial and metered capabilities, Current state, Data ownership and persistence, Deployment baseline, External provider extensions (+8 more)

### Community 8 - "MembershipInvitationDelivery"
Cohesion: 0.14
Nodes (6): readPayload(), MembershipInvitationDelivery, Injectable, currentRequestContext(), RequestContext, storage

### Community 9 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "app.e2e-spec.ts"
Cohesion: 0.06
Nodes (21): confirmEmail(), invitationDeliveries, login(), loginBody(), readCookieHeader(), readSetCookie(), readVerificationToken(), recordingEmailSender (+13 more)

### Community 11 - "authentication.controller.ts"
Cohesion: 0.14
Nodes (16): EmailVerificationConfirmation, emailVerificationConfirmationSchema, EmailVerificationRequest, emailVerificationRequestSchema, LoginRequest, loginRequestSchema, PasswordChangeRequest, passwordChangeSchema (+8 more)

### Community 12 - "dependencies"
Cohesion: 0.07
Nodes (29): argon2, dotenv, @nestjs/common, @nestjs/core, @nestjs/platform-express, @nestjs/swagger, nodemailer, dependencies (+21 more)

### Community 13 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 14 - "identity.module.ts"
Cohesion: 0.16
Nodes (12): PASSWORD_IDENTITY_REPOSITORY, PasswordIdentityAuthentication, PasswordIdentityRecord, RecordingVerifier, Inject, Injectable, PASSWORD_VERIFIER, PasswordVerifier (+4 more)

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
Nodes (32): scripts, build, check:deprecated, check:operations, check:production, contract:check, contract:generate, db:dev:down (+24 more)

### Community 19 - "mail-outbox.ts"
Cohesion: 0.10
Nodes (15): MailOutbox, ProtectedMailPayload, ClaimedMail, MAIL_OUTBOX_REPOSITORY, MailPurpose, Inject, Injectable, MAIL_PAYLOAD_PROTECTOR (+7 more)

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
Cohesion: 0.18
Nodes (8): recordSelection, DatabaseContext, Injectable, PrismaService, Injectable, PrismaTransactionManager, Injectable, TransactionWriteConflictError

### Community 26 - "architecture.spec.ts"
Cohesion: 0.17
Nodes (16): APPROVED_CROSS_MODULE_EXCEPTIONS, collectTypeScriptFiles(), DELEGATE_OWNERS, Dependency, dependencyViolation(), isApprovedException(), isLayer(), Layer (+8 more)

### Community 27 - "OperationalTelemetry"
Cohesion: 0.21
Nodes (7): increment(), OperationalTelemetry, Injectable, HttpTelemetryMiddleware, Injectable, MetricsController, Controller

### Community 28 - "AuthenticationRateLimitPort"
Cohesion: 0.28
Nodes (5): AUTHENTICATION_RATE_LIMITER, AuthenticationRateLimitPort, EmailVerificationUnavailableError, PasswordResetUnavailableError, readNormalizedEmail()

### Community 29 - "PrismaPasswordIdentityRepository"
Cohesion: 0.18
Nodes (5): PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY, PasswordCredentialManagementRepository, PasswordIdentityRepository, PrismaPasswordIdentityRepository, Injectable

### Community 31 - "api-exception.filter.ts"
Cohesion: 0.16
Nodes (15): Catch, runWithRequestContext(), ApiExceptionFilter, applicationErrorStatus(), isSafeErrorBody(), isSafeMembershipRole(), isUnknownRecord(), readApplicationErrorDetails() (+7 more)

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
Cohesion: 0.16
Nodes (3): readSafeErrorCode(), readSafeErrorCode(), readSafeErrorCode()

### Community 36 - "authentication.module.ts"
Cohesion: 0.05
Nodes (45): ChangedPasswordSession, PasswordChangeContext, EXPIRES_AT, InlineTransactionManager, NOW, RAW_TOKEN, PASSWORD_COMPROMISE_CHECKER, PasswordCompromiseChecker (+37 more)

### Community 37 - "memberships.module.ts"
Cohesion: 0.15
Nodes (14): MailModule, Module, MEMBERSHIP_ADMINISTRATION_REPOSITORY, MEMBERSHIP_INVITATION_RATE_LIMITER, MembershipInvitationRateLimitDecision, MembershipInvitationRateLimiterPort, MembershipInvitationRateLimiter, Injectable (+6 more)

### Community 38 - "ADR-XXXX: Decision title"
Cohesion: 0.12
Nodes (16): ADR-XXXX: Decision title, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+8 more)

### Community 39 - "jest"
Cohesion: 0.15
Nodes (13): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+5 more)

### Community 40 - "PrismaMembershipInvitationsRepository"
Cohesion: 0.11
Nodes (6): MEMBERSHIP_INVITATIONS_REPOSITORY, MembershipInvitationRecord, MembershipInvitationsRepository, isInvitableMembershipRole(), PrismaMembershipInvitationsRepository, Injectable

### Community 41 - "ADR-0006: Select and switch the active workspace per session"
Cohesion: 0.11
Nodes (17): ADR-0006: Select and switch the active workspace per session, Choose the most recent workspace automatically, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers (+9 more)

### Community 42 - "PasswordCredentialManagement"
Cohesion: 0.40
Nodes (3): PasswordCredentialManagement, Inject, Injectable

### Community 43 - "check-deprecated-apis.mjs"
Cohesion: 0.27
Nodes (8): addFinding(), configPath, deprecatedMessage(), findDeprecatedSymbol(), flattenUnion(), isImportName(), projectRoot, visit()

### Community 44 - "prisma-identity-registration.repository.ts"
Cohesion: 0.21
Nodes (7): CreatePasswordIdentity, IDENTITY_REGISTRATION_REPOSITORY, IdentityRegistrationRepository, IdentityAlreadyExistsError, isUniqueConstraintError(), PrismaIdentityRegistrationRepository, Injectable

### Community 45 - "dependency-health.service.ts"
Cohesion: 0.20
Nodes (7): HealthLifecycleService, Injectable, DependencyHealthService, ReadinessResult, Injectable, ObservabilityModule, Module

### Community 46 - "Foundation modules"
Cohesion: 0.20
Nodes (10): Audit, Authentication, Authorization and roles, Configuration and persistence, Foundation modules, Identity, Memberships, Organizations (+2 more)

### Community 48 - "identity-lookup.ts"
Cohesion: 0.24
Nodes (5): IDENTITY_LOOKUP_REPOSITORY, IdentityLookupRepository, IdentitySummary, PrismaIdentityLookupRepository, Injectable

### Community 49 - "Nexora Platform Engineering Change Checklists"
Cohesion: 0.22
Nodes (9): ADR triggers, Change design and layering, Commercial and metered capabilities, Current-state and boundary gate, Data, authentication, and tenancy, External providers and automated output, Jobs, files, API, and operations, Nexora Platform Engineering Change Checklists (+1 more)

### Community 50 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 51 - "AuthorizationPolicy"
Cohesion: 0.06
Nodes (45): isWriteConflict(), MembershipSessionRevocations, RevokedMembershipSession, Inject, Injectable, isWriteConflict(), isWriteConflict(), isWriteConflict() (+37 more)

### Community 52 - "package.json"
Cohesion: 0.20
Nodes (9): author, description, engines, node, license, name, packageManager, private (+1 more)

### Community 53 - "exclude"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 54 - "update-common-password-blocklist.mjs"
Cohesion: 0.29
Nodes (7): hashes, OUTPUT_PATH, sha256(), sourceBytes, sourcePasswords, sourceSha256, sourceText

### Community 55 - ".error"
Cohesion: 0.24
Nodes (5): ChangePassword, readSafeErrorCode(), Injectable, PasswordCredentialVerification, Injectable

### Community 56 - "ADR-0005: Deny routes unless admission policy is explicit"
Cohesion: 0.11
Nodes (17): ADR-0005: Deny routes unless admission policy is explicit, Compatibility and migration, Consequences, Considered options, Context, Continue attaching guards to individual routes, Decision, Decision drivers (+9 more)

### Community 57 - "Create a downstream product from Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Create a downstream product from Nexora Platform Core, Define the product boundary, Minimum product repository guidance, Protect Core boundaries, Review inherited runtime identity, Start from a reviewed base

### Community 58 - "devDependencies"
Cohesion: 0.29
Nodes (7): eslint, devDependencies, eslint, @types/express, typescript-eslint, @types/express, typescript-eslint

### Community 59 - "Nexora Platform Core"
Cohesion: 0.25
Nodes (7): Implemented, Local development, Nexora Platform Core, Prerequisites, Product extension model, Production-readiness controls, Verification

### Community 60 - "prisma-audit-log.repository.ts"
Cohesion: 0.33
Nodes (3): AuditLogRepository, PrismaAuditLogRepository, Injectable

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

### Community 65 - "MailOutboxRepository"
Cohesion: 0.12
Nodes (4): MailOutboxRepository, ensureUpdated(), PrismaMailOutboxRepository, Injectable

### Community 66 - "ApplicationError"
Cohesion: 0.08
Nodes (18): AppendAuditLog, AuthenticationInvalidError, WorkspaceAccessDeniedError, WorkspaceSelectionRequiredError, WorkspaceSwitchUnavailableError, isWriteConflict(), Injectable, UpdateOwnProfile (+10 more)

### Community 67 - "EmailVerificationConfirmationGuard"
Cohesion: 0.33
Nodes (3): EmailVerificationConfirmationGuard, Inject, Injectable

### Community 68 - "PasswordResetConfirmationGuard"
Cohesion: 0.33
Nodes (3): PasswordResetConfirmationGuard, Inject, Injectable

### Community 69 - "ADR-0009: Bounded user and workspace lifecycle"
Cohesion: 0.11
Nodes (17): Add bounded renames plus protected self-leave, Add user deactivation and workspace archival now, ADR-0009: Bounded user and workspace lifecycle, Compatibility and migration, Consequences, Considered options, Context, Decision (+9 more)

### Community 71 - ".now"
Cohesion: 0.09
Nodes (3): readSafeErrorCode(), createFixture(), normalizeIdentityEmail()

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

### Community 79 - "AppConfig"
Cohesion: 0.11
Nodes (12): approvalSchema, CachedSession, AppConfig, environmentSchema, isHostname(), isIpOrCidr(), MANAGED_KEYS, TRUST_PROXY_NAMES (+4 more)

### Community 82 - "create-membership-invitation.use-case.ts"
Cohesion: 0.10
Nodes (17): AccessibleWorkspaceLimitError, AccessibleWorkspaceStateError, IdentityLookup, Inject, Injectable, Inject, CreatedMembershipInvitation, InvitedMembershipsWriter (+9 more)

### Community 83 - "AuthenticatedRoute"
Cohesion: 0.17
Nodes (9): Permission, ApplicationAuthenticatedRoute(), ApplicationAuthenticatedRouteOptions, AuthenticatedRoute(), AuthenticatedRouteOptions, RouteAdmissionExamples, PublicRouteOptions, RouteAdmission (+1 more)

### Community 86 - "Product boundary"
Cohesion: 0.67
Nodes (3): A downstream product repository owns, Platform Core owns, Product boundary

### Community 88 - "EmailVerificationsRepository"
Cohesion: 0.09
Nodes (5): EmailVerificationRecord, EmailVerificationsRepository, RecordingEmailVerifications, PrismaEmailVerificationsRepository, Injectable

### Community 91 - "RouteAdmissionProbeController"
Cohesion: 0.47
Nodes (3): RouteAdmissionProbeController, Controller, Get

### Community 93 - "workspaces.module.ts"
Cohesion: 0.15
Nodes (15): AUDIT_LOG_REPOSITORY, AuditModule, Module, AUTHENTICATION_SESSIONS_REPOSITORY, MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY, AuthenticationSessionStateModule, Module, CoreInfrastructureModule (+7 more)

### Community 94 - "RecordingInvitations"
Cohesion: 0.17
Nodes (5): createAcceptanceFixture(), createIssueFixture(), fixedClock(), inlineTransactions(), RecordingInvitations

### Community 97 - "Repository structure"
Cohesion: 0.67
Nodes (3): Current structure, Repository structure, Target structure

### Community 98 - "AuthenticatedRequestContext"
Cohesion: 0.14
Nodes (24): ApiBadRequestResponse, ApiQuery, Query, AuthenticatedRequestContext, CurrentAuthenticatedContext, MembershipsController, ApiBody, ApiConflictResponse (+16 more)

### Community 103 - "ADR-0008: Workspace membership administration and ownership safety"
Cohesion: 0.11
Nodes (18): ADR-0008: Workspace membership administration and ownership safety, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+10 more)

### Community 111 - "app.module.ts"
Cohesion: 0.24
Nodes (7): AppController, Controller, Get, AppService, Injectable, HealthModule, Module

### Community 112 - "get-current-session.use-case.ts"
Cohesion: 0.10
Nodes (25): createAuthenticatedRequestContext(), CurrentSession, GetCurrentSession, ResolvedAuthenticatedRequest, Injectable, AuthenticationRequiredError, attachAuthenticatedRequestContext(), AUTHENTICATED_REQUEST_CONTEXT (+17 more)

### Community 115 - "membership-invitations.controller.ts"
Cohesion: 0.10
Nodes (26): AcceptMembershipInvitation, Injectable, CreateMembershipInvitation, Injectable, RevokeMembershipInvitation, Injectable, AcceptMembershipInvitationRequest, acceptMembershipInvitationSchema (+18 more)

### Community 116 - "Q: Implement Multi-workspace selection and switching task"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement Multi-workspace selection and switching task, Source Nodes

### Community 117 - "MembershipInvitations"
Cohesion: 0.09
Nodes (11): isUniqueConflict(), readSafeErrorCode(), isUniqueConflict(), readSafeErrorCode(), MembershipInvitationTokenService, Injectable, MembershipInvitations, Inject (+3 more)

### Community 118 - "Organizations"
Cohesion: 0.15
Nodes (6): Organizations, Inject, Injectable, Inject, Injectable, Workspaces

### Community 120 - "workspaces.controller.ts"
Cohesion: 0.14
Nodes (14): RenameCurrentWorkspace, Injectable, RenameCurrentWorkspaceRequest, renameCurrentWorkspaceSchema, ApiBody, ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse (+6 more)

### Community 122 - "HealthController"
Cohesion: 0.22
Nodes (5): HealthController, Controller, Get, Res, check()

### Community 123 - "security-headers.middleware.ts"
Cohesion: 0.29
Nodes (5): SECURITY_POLICY, SecurityPolicy, SecurityHeadersMiddleware, Inject, Injectable

### Community 124 - "authorization.module.ts"
Cohesion: 0.29
Nodes (6): AuthenticationModule, Module, AuthorizationModule, Module, AuthorizationPolicyModule, Module

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
Cohesion: 0.18
Nodes (6): RecordingCredentialRepository, PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY, PasswordCredentialRecord, PasswordCredentialVerificationRepository, VERIFIED_PASSWORD_HASH, VerifiedPasswordCredential

### Community 129 - "JsonLogger"
Cohesion: 0.30
Nodes (4): isRecord(), JsonLogger, normalizeMessage(), redact()

### Community 130 - "users.controller.ts"
Cohesion: 0.12
Nodes (13): UpdateOwnProfileRequest, updateOwnProfileSchema, ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags, Body (+5 more)

### Community 131 - "TransactionManager"
Cohesion: 0.06
Nodes (55): AuditLog, Inject, Injectable, AccessibleWorkspaces, Injectable, AuthenticationSessions, Inject, Injectable (+47 more)

### Community 133 - "ADR-0012: Durable encrypted Core email outbox"
Cohesion: 0.18
Nodes (10): ADR-0012: Durable encrypted Core email outbox, Compatibility and schema impact, Context, Decision, Ownership and transaction boundaries, Reliability and observability, Residual risks and follow-up, Rollout and rollback (+2 more)

### Community 134 - "memberships.controller.ts"
Cohesion: 0.10
Nodes (20): ChangeMembershipRole, readSafeErrorCode(), Injectable, LeaveCurrentWorkspace, Injectable, ListWorkspaceMemberships, readSafeErrorCode(), Injectable (+12 more)

### Community 135 - ".listForUser"
Cohesion: 0.15
Nodes (4): readSafeErrorCode(), ListSessionWorkspaces, Injectable, WorkspaceSelectionOption

### Community 137 - "Tenant isolation matrices"
Cohesion: 0.33
Nodes (5): Completion rule, HTTP endpoint matrix, Repository matrix, Scope models, Tenant isolation matrices

### Community 138 - "Production operations runbook"
Cohesion: 0.20
Nodes (9): Backup and restore drill, Deployment, Incident response, Objectives, capacity, quotas, and alerts, Production operations runbook, Retention, deletion, and privacy, Rollback, Runtime configuration reference (+1 more)

### Community 140 - "check-operations-docs.mjs"
Cohesion: 0.25
Nodes (7): configKeys, configSource, example, headings, missingHeadings, missingKeys, runbook

### Community 142 - "PasswordResetRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordResetRequestGuard, Inject, Injectable

### Community 143 - "IdentityRegistration"
Cohesion: 0.40
Nodes (3): IdentityRegistration, Inject, Injectable

### Community 145 - "EmailVerificationRequestGuard"
Cohesion: 0.33
Nodes (3): EmailVerificationRequestGuard, Inject, Injectable

### Community 148 - "InMemoryResetTokens"
Cohesion: 0.22
Nodes (6): activeUsers(), createRequestFixture(), createResetFixture(), fixedClock(), InMemoryResetTokens, sessionRepository()

### Community 152 - "LoginRequestGuard"
Cohesion: 0.33
Nodes (3): LoginRequestGuard, Inject, Injectable

### Community 153 - "RegistrationRequestGuard"
Cohesion: 0.33
Nodes (3): RegistrationRequestGuard, Inject, Injectable

### Community 154 - "WorkspaceSwitchRequestGuard"
Cohesion: 0.33
Nodes (3): Inject, Injectable, WorkspaceSwitchRequestGuard

### Community 155 - ".getMetrics"
Cohesion: 0.33
Nodes (4): safeEqual(), Get, Req, Res

## Knowledge Gaps
- **524 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+519 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppConfig` connect `AppConfig` to `identifier-factory.ts`, `membership-ownership-transfer-rate-limiter.ts`, `TransactionManager`, `PasswordChangeRequestGuard`, `MailOutboxWorker`, `memberships.controller.ts`, `MembershipInvitationDelivery`, `authentication.controller.ts`, `mail-outbox.ts`, `DatabaseContext`, `WorkspaceSwitchRequestGuard`, `OperationalTelemetry`, `AuthenticationRateLimitPort`, `authentication.module.ts`, `memberships.module.ts`, `dependency-health.service.ts`, `generate-openapi.ts`, `create-membership-invitation.use-case.ts`, `get-current-session.use-case.ts`, `pwned-passwords-compromise-checker.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `Users` connect `TransactionManager` to `identifier-factory.ts`, `ApplicationError`, `.execute`, `authentication.module.ts`, `.now`, `.listForUser`, `get-current-session.use-case.ts`, `create-membership-invitation.use-case.ts`, `AuthorizationPolicy`, `.error`, `workspaces.module.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `PublicRoute()` connect `PublicRoute` to `app.e2e-spec.ts`, `authentication.controller.ts`, `.getMetrics`, `dependency-health.service.ts`, `RouteAdmissionProbeController`, `app.module.ts`, `get-current-session.use-case.ts`, `AuthenticatedRoute`, `HealthController`, `OperationalTelemetry`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _524 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `identifier-factory.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1028225806451613 - nodes in this community are weakly interconnected._
- **Should `SessionRecord` be split into smaller, more focused modules?**
  _Cohesion score 0.07152496626180836 - nodes in this community are weakly interconnected._
- **Should `PasswordResetTokensRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.09486166007905138 - nodes in this community are weakly interconnected._