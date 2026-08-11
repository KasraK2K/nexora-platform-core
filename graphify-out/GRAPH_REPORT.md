# Graph Report - nexora-platform-core  (2026-08-11)

## Corpus Check
- 228 files · ~83,772 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2067 nodes · 4863 edges · 150 communities (110 shown, 40 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 249 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a94b7e3c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- register-account.use-case.ts
- membership-administration.use-cases.spec.ts
- change-password.use-case.spec.ts
- authentication-session-state.module.ts
- PasswordChangeRequestGuard
- .selectWorkspace
- PasswordResetTokensRepository
- Nexora Platform Core - Implementation Baseline
- membership-role.ts
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
- OutboundMail
- update-own-profile.use-case.ts
- ADR-0001: Screen new passwords against breached-password data
- ADR-0002: Keep this repository product-neutral
- ADR-0003: Rotate the current session after authenticated password change
- DatabaseContext
- MembershipRole
- architecture.spec.ts
- RecordingEmailVerifications
- AuthenticationRateLimitPort
- PrismaPasswordIdentityRepository
- RecordingSessionCache
- app.module.ts
- organizations.ts
- WorkspacesRepository
- Nexora Platform Engineering
- authentication.module.ts
- membership-invitation-request.guard.ts
- ADR-XXXX: Decision title
- jest
- PrismaMembershipInvitationsRepository
- ADR-0006: Select and switch the active workspace per session
- identity.module.ts
- check-deprecated-apis.mjs
- prisma-identity-registration.repository.ts
- registration.errors.ts
- Foundation modules
- leave-current-workspace.use-case.ts
- identity-lookup.ts
- Nexora Platform Engineering Change Checklists
- graphify reference: extra exports and benchmark
- ApplicationError
- package.json
- exclude
- update-common-password-blocklist.mjs
- .execute
- ADR-0005: Deny routes unless admission policy is explicit
- Create a downstream product from Nexora Platform Core
- devDependencies
- Nexora Platform Core
- prisma-audit-log.repository.ts
- Nexora Platform Core Module Catalog
- graphify reference: query, path, explain
- nest-cli.json
- ADR-0007: Base RBAC and email-bound membership invitations
- memberships.module.ts
- workspaces.module.ts
- EmailVerificationConfirmationGuard
- PasswordResetConfirmationGuard
- ADR-0009: Bounded user and workspace lifecycle
- ts-loader
- .execute
- Core module map
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- local-mutation-target.policy.ts
- AuthenticatedRequestContext
- RecordingSessionCache
- AppConfig
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- TransactionManager
- AuthenticatedRoute
- Third-party notices
- extraction-spec.md
- Product boundary
- .execute
- EmailVerificationsRepository
- eslint-plugin-prettier
- globals
- CurrentAuthenticatedContext
- @nestjs/cli
- membership-ownership-transfer-rate-limiter.ts
- membership-invitation.use-cases.spec.ts
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
- AuthorizationPolicy
- .create
- Q: Implement Multi-workspace selection and switching task
- .now
- membership-invitations.controller.ts
- RecordingCache
- .rename
- RecordingSessionCache
- .execute
- isTransactionWriteConflict
- change-membership-role.use-case.ts
- MembershipsRepository
- pwned-passwords-compromise-checker.ts
- readCookie
- password-credential-verification.ts
- SessionCache
- users.controller.ts
- switch-workspace.use-case.spec.ts
- .listForUser
- transfer-workspace-ownership.use-case.ts
- memberships.controller.ts
- GetCurrentSession
- @eslint/js
- Tenant isolation matrices
- rename-current-workspace.use-case.ts
- create-membership-invitation.use-case.ts
- list-workspace-memberships.use-case.ts
- jest
- audit-log.ts
- IdentityRegistration
- @nestjs/platform-express
- PasswordIdentityAuthentication
- prettier
- eslint-config-prettier
- RecordingSessionCache
- @eslint/eslintrc

## God Nodes (most connected - your core abstractions)
1. `TransactionManager` - 61 edges
2. `Clock` - 59 edges
3. `IdentifierFactory` - 56 edges
4. `AuditLog` - 53 edges
5. `AppConfig` - 53 edges
6. `ApplicationError` - 45 edges
7. `Users` - 42 edges
8. `SessionCachePort` - 35 edges
9. `AuthorizationPolicy` - 34 edges
10. `Memberships` - 34 edges

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

## Communities (150 total, 40 thin omitted)

### Community 0 - "register-account.use-case.ts"
Cohesion: 0.08
Nodes (20): EmailVerificationDelivery, Inject, Injectable, EMAIL_VERIFICATION_SENDER, EmailVerificationSender, PasswordCompromiseChecker, PasswordHasher, RegisterAccount (+12 more)

### Community 1 - "membership-administration.use-cases.spec.ts"
Cohesion: 0.12
Nodes (12): MembershipSessionRevocations, RevokedMembershipSession, Inject, Injectable, createFixture(), membership(), MembershipWriteConflictError, readSafeErrorCode() (+4 more)

### Community 2 - "change-password.use-case.spec.ts"
Cohesion: 0.09
Nodes (31): AuthenticationSessions, RevokedSession, Inject, Injectable, ChangedPasswordSession, PasswordChangeContext, EXPIRES_AT, NOW (+23 more)

### Community 3 - "authentication-session-state.module.ts"
Cohesion: 0.06
Nodes (11): AUTHENTICATION_SESSIONS_REPOSITORY, AuthenticationSessionsRepository, SessionContext, SessionRecord, RecordingSessionsRepository, MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY, MembershipSessionRevocationsRepository, RecordingSessionsRepository (+3 more)

### Community 4 - "PasswordChangeRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordChangeRequestGuard, Inject, Injectable

### Community 5 - ".selectWorkspace"
Cohesion: 0.22
Nodes (23): ApiAcceptedResponse, Req, AuthenticationController, setSessionCookie(), ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse (+15 more)

### Community 6 - "PasswordResetTokensRepository"
Cohesion: 0.07
Nodes (10): RecordingResetTokensRepository, PasswordResetTokensRepository, activeUsers(), createRequestFixture(), createResetFixture(), fixedClock(), InMemoryResetTokens, sessionRepository() (+2 more)

### Community 7 - "Nexora Platform Core - Implementation Baseline"
Cohesion: 0.12
Nodes (16): Accepted decisions, API and observability, Architecture style, Commercial and metered capabilities, Current state, Data ownership and persistence, Deployment baseline, External provider extensions (+8 more)

### Community 8 - "membership-role.ts"
Cohesion: 0.14
Nodes (12): MembershipInvitationDelivery, Inject, Injectable, MEMBERSHIP_INVITATION_SENDER, MembershipInvitationSender, MembershipInvitations, Inject, Injectable (+4 more)

### Community 9 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "app.e2e-spec.ts"
Cohesion: 0.06
Nodes (21): RateLimitDecision, AuthenticationRateLimiter, Injectable, confirmEmail(), invitationDeliveries, login(), loginBody(), readCookieHeader() (+13 more)

### Community 11 - "authentication.controller.ts"
Cohesion: 0.14
Nodes (16): EmailVerificationConfirmation, emailVerificationConfirmationSchema, EmailVerificationRequest, emailVerificationRequestSchema, LoginRequest, loginRequestSchema, PasswordChangeRequest, passwordChangeSchema (+8 more)

### Community 12 - "dependencies"
Cohesion: 0.07
Nodes (27): argon2, dotenv, @nestjs/common, @nestjs/core, @nestjs/swagger, nodemailer, dependencies, argon2 (+19 more)

### Community 13 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 14 - "password-identity-authentication.ts"
Cohesion: 0.15
Nodes (9): Inject, PASSWORD_IDENTITY_REPOSITORY, PasswordIdentityRecord, PasswordIdentityRepository, RecordingVerifier, PASSWORD_VERIFIER, PasswordVerifier, Argon2PasswordVerifier (+1 more)

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
Cohesion: 0.07
Nodes (30): scripts, build, check:deprecated, contract:check, contract:generate, db:dev:down, db:dev:up, db:generate (+22 more)

### Community 19 - "OutboundMail"
Cohesion: 0.11
Nodes (13): SmtpEmailVerificationSender, Inject, Injectable, SmtpPasswordResetSender, Inject, Injectable, OUTBOUND_MAIL, OutboundMail (+5 more)

### Community 20 - "update-own-profile.use-case.ts"
Cohesion: 0.08
Nodes (13): isWriteConflict(), readSafeErrorCode(), users(), Injectable, UpdateOwnProfile, UserWriteConflictError, UserAuthenticationReference, UsersRepository (+5 more)

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
Nodes (6): DatabaseContext, Injectable, PrismaService, Injectable, PrismaTransactionManager, Injectable

### Community 25 - "MembershipRole"
Cohesion: 0.09
Nodes (8): MembershipAdministrationRecord, MembershipAdministrationRepository, MembershipRole, LoginWorkspaceResolution, MembershipSummary, membershipAdministrationSelect, PrismaMembershipsRepository, Injectable

### Community 26 - "architecture.spec.ts"
Cohesion: 0.17
Nodes (16): APPROVED_CROSS_MODULE_EXCEPTIONS, collectTypeScriptFiles(), DELEGATE_OWNERS, Dependency, dependencyViolation(), isApprovedException(), isLayer(), Layer (+8 more)

### Community 28 - "AuthenticationRateLimitPort"
Cohesion: 0.11
Nodes (15): AUTHENTICATION_RATE_LIMITER, AuthenticationRateLimitPort, EmailVerificationRequestGuard, Inject, Injectable, LoginRequestGuard, Inject, Injectable (+7 more)

### Community 31 - "app.module.ts"
Cohesion: 0.06
Nodes (36): Catch, compareObjectKeys(), contractPath, isRecord(), main(), sortObjectKeys(), validateSecurityReferences(), AppController (+28 more)

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
Cohesion: 0.08
Nodes (32): PASSWORD_COMPROMISE_CHECKER, PASSWORD_HASHER, PasswordResetDelivery, Inject, Injectable, PASSWORD_RESET_SENDER, PasswordResetSender, PasswordResetToken (+24 more)

### Community 37 - "membership-invitation-request.guard.ts"
Cohesion: 0.16
Nodes (11): MEMBERSHIP_INVITATION_RATE_LIMITER, MembershipInvitationRateLimitDecision, MembershipInvitationRateLimiterPort, MembershipInvitationRateLimiter, Injectable, enforceDecision(), MembershipInvitationAcceptRequestGuard, MembershipInvitationCreateRequestGuard (+3 more)

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

### Community 42 - "identity.module.ts"
Cohesion: 0.21
Nodes (7): PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY, PasswordCredentialManagement, PasswordCredentialManagementRepository, Inject, Injectable, IdentityModule, Module

### Community 43 - "check-deprecated-apis.mjs"
Cohesion: 0.27
Nodes (8): addFinding(), configPath, deprecatedMessage(), findDeprecatedSymbol(), flattenUnion(), isImportName(), projectRoot, visit()

### Community 44 - "prisma-identity-registration.repository.ts"
Cohesion: 0.21
Nodes (7): CreatePasswordIdentity, IDENTITY_REGISTRATION_REPOSITORY, IdentityRegistrationRepository, IdentityAlreadyExistsError, isUniqueConstraintError(), PrismaIdentityRegistrationRepository, Injectable

### Community 45 - "registration.errors.ts"
Cohesion: 0.09
Nodes (18): EmailVerificationToken, EmailVerificationTokenService, Injectable, EMAIL_VERIFICATIONS_REPOSITORY, EmailVerifications, Inject, Injectable, InlineTransactionManager (+10 more)

### Community 46 - "Foundation modules"
Cohesion: 0.20
Nodes (10): Audit, Authentication, Authorization and roles, Configuration and persistence, Foundation modules, Identity, Memberships, Organizations (+2 more)

### Community 47 - "leave-current-workspace.use-case.ts"
Cohesion: 0.14
Nodes (9): isWriteConflict(), LeaveCurrentWorkspace, MembershipWriteConflictError, readSafeErrorCode(), Inject, Injectable, MembershipAdministration, Inject (+1 more)

### Community 48 - "identity-lookup.ts"
Cohesion: 0.27
Nodes (5): IDENTITY_LOOKUP_REPOSITORY, IdentityLookupRepository, IdentitySummary, PrismaIdentityLookupRepository, Injectable

### Community 49 - "Nexora Platform Engineering Change Checklists"
Cohesion: 0.22
Nodes (9): ADR triggers, Change design and layering, Commercial and metered capabilities, Current-state and boundary gate, Data, authentication, and tenancy, External providers and automated output, Jobs, files, API, and operations, Nexora Platform Engineering Change Checklists (+1 more)

### Community 50 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 51 - "ApplicationError"
Cohesion: 0.13
Nodes (10): EmailVerificationRequiredError, RouteAccessDeniedError, MembershipAdministrationUnavailableError, MembershipLastWorkspaceProtectedError, MembershipOwnershipTransferInvalidError, MembershipPageCursorInvalidError, MembershipInvitationConflictError, MembershipInvitationInvalidError (+2 more)

### Community 52 - "package.json"
Cohesion: 0.20
Nodes (9): author, description, engines, node, license, name, packageManager, private (+1 more)

### Community 53 - "exclude"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 54 - "update-common-password-blocklist.mjs"
Cohesion: 0.29
Nodes (7): hashes, OUTPUT_PATH, sha256(), sourceBytes, sourcePasswords, sourceSha256, sourceText

### Community 55 - ".execute"
Cohesion: 0.23
Nodes (5): ChangePassword, readSafeErrorCode(), Injectable, PasswordCredentialVerification, Injectable

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

### Community 65 - "memberships.module.ts"
Cohesion: 0.17
Nodes (10): AcceptMembershipInvitation, isUniqueConflict(), readSafeErrorCode(), Injectable, InvitedMembershipsWriter, Injectable, MEMBERSHIP_ADMINISTRATION_REPOSITORY, MembershipInvitationTokenService (+2 more)

### Community 66 - "workspaces.module.ts"
Cohesion: 0.13
Nodes (14): AuthenticationSessionStateModule, Module, CoreInfrastructureModule, Module, MembershipsModule, Module, RenameCurrentWorkspace, Injectable (+6 more)

### Community 67 - "EmailVerificationConfirmationGuard"
Cohesion: 0.33
Nodes (3): EmailVerificationConfirmationGuard, Inject, Injectable

### Community 68 - "PasswordResetConfirmationGuard"
Cohesion: 0.33
Nodes (3): PasswordResetConfirmationGuard, Inject, Injectable

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

### Community 77 - "AuthenticatedRequestContext"
Cohesion: 0.16
Nodes (12): AuthenticatedRequestContext, createAuthenticatedRequestContext(), CurrentSession, ResolvedAuthenticatedRequest, AUTHENTICATED_REQUEST_CONTEXT, CurrentAuthenticatedSession, RequestWithAuthenticatedContext, requireAuthenticatedRequestContext() (+4 more)

### Community 79 - "AppConfig"
Cohesion: 0.14
Nodes (9): attachAuthenticatedRequestContext(), AuthenticatedRequestContextGuard, Injectable, createFixture(), AppConfig, environmentSchema, Injectable, RedisService (+1 more)

### Community 82 - "TransactionManager"
Cohesion: 0.09
Nodes (28): AuditLog, Inject, Injectable, InlineTransactionManager, Inject, Inject, Inject, Inject (+20 more)

### Community 83 - "AuthenticatedRoute"
Cohesion: 0.17
Nodes (9): Permission, ApplicationAuthenticatedRoute(), ApplicationAuthenticatedRouteOptions, AuthenticatedRoute(), AuthenticatedRouteOptions, RouteAdmissionExamples, PublicRouteOptions, RouteAdmission (+1 more)

### Community 86 - "Product boundary"
Cohesion: 0.67
Nodes (3): A downstream product repository owns, Platform Core owns, Product boundary

### Community 88 - "EmailVerificationsRepository"
Cohesion: 0.12
Nodes (5): EmailVerificationRecord, EmailVerificationsRepository, PrismaEmailVerificationsRepository, recordSelection, Injectable

### Community 91 - "CurrentAuthenticatedContext"
Cohesion: 0.36
Nodes (4): CurrentAuthenticatedContext, RouteAdmissionProbeController, Controller, Get

### Community 93 - "membership-ownership-transfer-rate-limiter.ts"
Cohesion: 0.18
Nodes (9): readAuthenticatedRequestContext(), MEMBERSHIP_OWNERSHIP_TRANSFER_RATE_LIMITER, MembershipOwnershipTransferRateLimitDecision, MembershipOwnershipTransferRateLimiterPort, MembershipOwnershipTransferRateLimiter, Injectable, MembershipOwnershipTransferRequestGuard, Inject (+1 more)

### Community 94 - "membership-invitation.use-cases.spec.ts"
Cohesion: 0.20
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

### Community 112 - "AuthorizationPolicy"
Cohesion: 0.18
Nodes (11): TrustedOriginGuard, Injectable, AuthorizationPolicy, isPermission(), PERMISSIONS, Injectable, isRouteAdmissionPolicy(), RouteAdmissionGuard (+3 more)

### Community 115 - ".create"
Cohesion: 0.17
Nodes (16): MembershipInvitationsController, ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiOperation (+8 more)

### Community 116 - "Q: Implement Multi-workspace selection and switching task"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement Multi-workspace selection and switching task, Source Nodes

### Community 118 - "membership-invitations.controller.ts"
Cohesion: 0.27
Nodes (6): AcceptMembershipInvitationRequest, acceptMembershipInvitationSchema, CreateMembershipInvitationRequest, createMembershipInvitationSchema, Injectable, ZodValidationPipe

### Community 120 - ".rename"
Cohesion: 0.25
Nodes (7): ApiBody, ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, Body, Patch

### Community 122 - ".execute"
Cohesion: 0.19
Nodes (4): CreateSession, readSafeErrorCode(), Injectable, readSafeErrorCode()

### Community 123 - "isTransactionWriteConflict"
Cohesion: 0.19
Nodes (11): isWriteConflict(), isWriteConflict(), isWriteConflict(), isWriteConflict(), isWriteConflict(), isWriteConflict(), isWriteConflict(), isWriteConflict() (+3 more)

### Community 124 - "change-membership-role.use-case.ts"
Cohesion: 0.18
Nodes (6): ChangeMembershipRole, isWriteConflict(), MembershipWriteConflictError, readSafeErrorCode(), Inject, Injectable

### Community 126 - "pwned-passwords-compromise-checker.ts"
Cohesion: 0.23
Nodes (7): COMMON_PASSWORD_SHA256_HASHES, CONTEXT_SPECIFIC_PASSWORDS, findSuffix(), localHash(), PwnedPasswordsCompromiseChecker, readBoundedText(), Injectable

### Community 127 - "readCookie"
Cohesion: 0.18
Nodes (5): WorkspaceSwitchUnavailableError, readCookie(), Inject, Injectable, WorkspaceSwitchRequestGuard

### Community 128 - "password-credential-verification.ts"
Cohesion: 0.18
Nodes (6): RecordingCredentialRepository, PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY, PasswordCredentialRecord, PasswordCredentialVerificationRepository, VERIFIED_PASSWORD_HASH, VerifiedPasswordCredential

### Community 129 - "SessionCache"
Cohesion: 0.31
Nodes (3): CachedSession, SessionCache, Injectable

### Community 130 - "users.controller.ts"
Cohesion: 0.16
Nodes (11): UpdateOwnProfileRequest, updateOwnProfileSchema, ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags, Body (+3 more)

### Community 131 - "switch-workspace.use-case.spec.ts"
Cohesion: 0.08
Nodes (21): AccessibleWorkspaceLimitError, AccessibleWorkspaces, AccessibleWorkspaceStateError, Injectable, InlineTransactionManager, Inject, Inject, EXPECTED_CONTEXT (+13 more)

### Community 132 - ".listForUser"
Cohesion: 0.23
Nodes (3): ListSessionWorkspaces, Injectable, WorkspaceSelectionOption

### Community 133 - "transfer-workspace-ownership.use-case.ts"
Cohesion: 0.21
Nodes (6): CurrentPasswordProof, isWriteConflict(), MembershipWriteConflictError, readSafeErrorCode(), TransferWorkspaceOwnership, Injectable

### Community 134 - "memberships.controller.ts"
Cohesion: 0.29
Nodes (8): ChangeMembershipRoleRequest, changeMembershipRoleSchema, LeaveCurrentWorkspaceBody, leaveCurrentWorkspaceBodySchema, ListWorkspaceMembershipsRequest, listWorkspaceMembershipsSchema, TransferWorkspaceOwnershipRequest, transferWorkspaceOwnershipSchema

### Community 137 - "Tenant isolation matrices"
Cohesion: 0.33
Nodes (5): Completion rule, HTTP endpoint matrix, Repository matrix, Scope models, Tenant isolation matrices

### Community 138 - "rename-current-workspace.use-case.ts"
Cohesion: 0.33
Nodes (4): AuthorizationDeniedError, WorkspaceWriteConflictError, WorkspaceLifecycleInvalidError, WorkspaceLifecycleUnavailableError

### Community 139 - "create-membership-invitation.use-case.ts"
Cohesion: 0.24
Nodes (7): CreatedMembershipInvitation, CreateMembershipInvitation, isUniqueConflict(), readSafeErrorCode(), Injectable, RevokeMembershipInvitation, Injectable

### Community 140 - "list-workspace-memberships.use-case.ts"
Cohesion: 0.22
Nodes (7): ListWorkspaceMemberships, MembershipAdministrationStateError, readSafeErrorCode(), Inject, Injectable, WorkspaceMembershipListItem, WorkspaceMembershipPage

### Community 142 - "audit-log.ts"
Cohesion: 0.40
Nodes (4): AppendAuditLog, AUDIT_LOG_REPOSITORY, AuditModule, Module

### Community 143 - "IdentityRegistration"
Cohesion: 0.40
Nodes (3): IdentityRegistration, Inject, Injectable

### Community 145 - "PasswordIdentityAuthentication"
Cohesion: 0.40
Nodes (3): PasswordIdentityAuthentication, Inject, Injectable

## Knowledge Gaps
- **480 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+475 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppConfig` connect `AppConfig` to `register-account.use-case.ts`, `change-password.use-case.spec.ts`, `switch-workspace.use-case.spec.ts`, `PasswordChangeRequestGuard`, `memberships.controller.ts`, `membership-role.ts`, `authentication.controller.ts`, `create-membership-invitation.use-case.ts`, `OutboundMail`, `DatabaseContext`, `AuthenticationRateLimitPort`, `app.module.ts`, `authentication.module.ts`, `membership-invitation-request.guard.ts`, `registration.errors.ts`, `leave-current-workspace.use-case.ts`, `TransactionManager`, `membership-ownership-transfer-rate-limiter.ts`, `AuthorizationPolicy`, `pwned-passwords-compromise-checker.ts`, `readCookie`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `IdentifierFactory` connect `TransactionManager` to `register-account.use-case.ts`, `memberships.module.ts`, `change-password.use-case.spec.ts`, `switch-workspace.use-case.spec.ts`, `authentication.module.ts`, `membership-administration.use-cases.spec.ts`, `transfer-workspace-ownership.use-case.ts`, `workspaces.module.ts`, `rename-current-workspace.use-case.ts`, `create-membership-invitation.use-case.ts`, `registration.errors.ts`, `leave-current-workspace.use-case.ts`, `AuthorizationPolicy`, `update-own-profile.use-case.ts`, `.now`, `change-membership-role.use-case.ts`, `membership-invitation.use-cases.spec.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `AuthenticatedRequestContext` connect `AuthenticatedRequestContext` to `change-password.use-case.spec.ts`, `authentication-session-state.module.ts`, `switch-workspace.use-case.spec.ts`, `.selectWorkspace`, `memberships.controller.ts`, `.leave`, `users.controller.ts`, `app.e2e-spec.ts`, `authentication.controller.ts`, `.create`, `membership-invitations.controller.ts`, `.rename`, `.execute`, `CurrentAuthenticatedContext`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _480 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `register-account.use-case.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07827260458839407 - nodes in this community are weakly interconnected._
- **Should `membership-administration.use-cases.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1225296442687747 - nodes in this community are weakly interconnected._
- **Should `change-password.use-case.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09427609427609428 - nodes in this community are weakly interconnected._