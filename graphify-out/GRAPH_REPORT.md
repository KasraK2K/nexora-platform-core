# Graph Report - nexora-platform-core  (2026-08-11)

## Corpus Check
- 219 files · ~78,428 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1998 nodes · 4801 edges · 152 communities (111 shown, 41 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 263 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b8238902`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- authentication.module.ts
- route-admission.guard.spec.ts
- change-password.use-case.ts
- authentication-session-state.module.ts
- PasswordChangeRequestGuard
- .selectWorkspace
- PasswordResetTokensRepository
- Nexora Platform Core - Implementation Baseline
- memberships.module.ts
- What You Must Do When Invoked
- app.e2e-spec.ts
- authentication.controller.ts
- dependencies
- compilerOptions
- password-identity-authentication.ts
- Nexora Platform Core Repository Guidance
- .execute
- ADR-0004: Propagate a trusted authenticated request context
- scripts
- OutboundMail
- UsersRepository
- ADR-0001: Screen new passwords against breached-password data
- ADR-0002: Keep this repository product-neutral
- ADR-0003: Rotate the current session after authenticated password change
- DatabaseContext
- MembershipRole
- api-exception.filter.ts
- EmailVerificationsRepository
- AuthenticationRateLimitPort
- PrismaPasswordIdentityRepository
- RecordingSessionCache
- app.module.ts
- PrismaOrganizationsRepository
- rename-current-workspace.use-case.ts
- Nexora Platform Engineering
- AuthenticatedRequestContext
- registration.errors.ts
- membership-invitation-request.guard.ts
- ADR-XXXX: Decision title
- jest
- membership-role.ts
- ADR-0006: Select and switch the active workspace per session
- identity.module.ts
- check-deprecated-apis.mjs
- prisma-identity-registration.repository.ts
- Users
- Foundation modules
- MembershipAdministration
- prisma-identity-lookup.repository.ts
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
- AuthorizationPolicy
- PrismaPasswordResetTokensRepository
- RecordingSessionCache
- AppConfig
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- TransactionManager
- AuthenticatedRoute
- Third-party notices
- extraction-spec.md
- Product boundary
- .now
- PrismaEmailVerificationsRepository
- eslint-plugin-prettier
- globals
- CurrentAuthenticatedContext
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
- membership-invitations.controller.ts
- Q: Implement Multi-workspace selection and switching task
- .execute
- .execute
- RecordingCache
- workspaces.controller.ts
- RecordingSessionCache
- .execute
- isTransactionWriteConflict
- MembershipInvitationsRepository
- configure-app.ts
- pwned-passwords-compromise-checker.ts
- workspace-switch-request.guard.ts
- password-credential-verification.ts
- .create
- users.controller.ts
- change-password.use-case.spec.ts
- eslint-config-prettier
- MembershipInvitationRateLimiter
- memberships.controller.ts
- @nestjs/common
- reflect-metadata
- Tenant isolation matrices
- LoginRequestGuard
- PasswordResetRequestGuard
- RegistrationRequestGuard
- jest
- PasswordCredentialVerification
- IdentityRegistration
- change-membership-role.use-case.ts
- @nestjs/core
- prettier
- register
- dotenv-cli
- request-id.middleware.ts
- RecordingSessionCache
- @eslint/eslintrc

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
- `InlineTransactionManager` --implements--> `TransactionManager`  [EXTRACTED]
  src/core/authentication/application/change-password.use-case.spec.ts → src/shared/application/transaction-manager.port.ts
- `RecordingSessionCache` --implements--> `SessionCachePort`  [EXTRACTED]
  src/core/authentication/application/change-password.use-case.spec.ts → src/core/authentication/application/session-cache.port.ts

## Import Cycles
- None detected.

## Communities (152 total, 41 thin omitted)

### Community 0 - "authentication.module.ts"
Cohesion: 0.07
Nodes (37): EmailVerificationDelivery, Inject, Injectable, EMAIL_VERIFICATION_SENDER, EmailVerificationSender, EmailVerificationToken, EmailVerificationTokenService, Injectable (+29 more)

### Community 1 - "route-admission.guard.spec.ts"
Cohesion: 0.11
Nodes (21): createAuthenticatedRequestContext(), ResolvedAuthenticatedRequest, attachAuthenticatedRequestContext(), AUTHENTICATED_REQUEST_CONTEXT, CurrentAuthenticatedSession, AuthenticatedRequestContextGuard, Injectable, readAuthenticatedRequestContext() (+13 more)

### Community 2 - "change-password.use-case.ts"
Cohesion: 0.07
Nodes (45): AccessibleWorkspaceLimitError, AccessibleWorkspaces, AccessibleWorkspaceStateError, Injectable, AuthenticationSessions, RevokedSession, Inject, Injectable (+37 more)

### Community 3 - "authentication-session-state.module.ts"
Cohesion: 0.05
Nodes (17): AUTHENTICATION_SESSIONS_REPOSITORY, AuthenticationSessionsRepository, SessionContext, SessionRecord, RecordingSessionsRepository, MEMBERSHIP_SESSION_REVOCATIONS_REPOSITORY, MembershipSessionRevocationsRepository, RevokedMembershipSession (+9 more)

### Community 4 - "PasswordChangeRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordChangeRequestGuard, Inject, Injectable

### Community 5 - ".selectWorkspace"
Cohesion: 0.18
Nodes (26): ApiAcceptedResponse, Req, CurrentSession, AuthenticationController, setSessionCookie(), ApiBody, ApiConflictResponse, ApiCookieAuth (+18 more)

### Community 6 - "PasswordResetTokensRepository"
Cohesion: 0.09
Nodes (8): RecordingResetTokensRepository, PasswordResetTokensRepository, activeUsers(), createRequestFixture(), createResetFixture(), fixedClock(), InMemoryResetTokens, sessionRepository()

### Community 7 - "Nexora Platform Core - Implementation Baseline"
Cohesion: 0.12
Nodes (16): Accepted decisions, API and observability, Architecture style, Commercial and metered capabilities, Current state, Data ownership and persistence, Deployment baseline, External provider extensions (+8 more)

### Community 8 - "memberships.module.ts"
Cohesion: 0.15
Nodes (15): MailModule, Module, InvitedMembershipsWriter, Injectable, MembershipInvitationDelivery, Inject, Injectable, MEMBERSHIP_INVITATION_SENDER (+7 more)

### Community 9 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "app.e2e-spec.ts"
Cohesion: 0.06
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

### Community 14 - "password-identity-authentication.ts"
Cohesion: 0.18
Nodes (7): PASSWORD_IDENTITY_REPOSITORY, PasswordIdentityAuthentication, PasswordIdentityRecord, PasswordIdentityRepository, RecordingVerifier, Inject, Injectable

### Community 15 - "Nexora Platform Core Repository Guidance"
Cohesion: 0.10
Nodes (20): API and observability, Architecture invariants, Billing, credits, and usage, Cross-cutting correctness, Current repository commands, Delegation, Dependency and API compatibility, Development database workflow (+12 more)

### Community 16 - ".execute"
Cohesion: 0.16
Nodes (7): LeaveCurrentWorkspace, readSafeErrorCode(), Injectable, isWriteConflict(), readSafeErrorCode(), RemoveMembership, Injectable

### Community 17 - "ADR-0004: Propagate a trusted authenticated request context"
Cohesion: 0.11
Nodes (17): ADR-0004: Propagate a trusted authenticated request context, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+9 more)

### Community 18 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, check:deprecated, db:dev:down, db:dev:up, db:generate, db:push, db:test:down (+12 more)

### Community 19 - "OutboundMail"
Cohesion: 0.12
Nodes (11): SmtpEmailVerificationSender, Inject, Injectable, SmtpPasswordResetSender, Inject, Injectable, OUTBOUND_MAIL, OutboundMail (+3 more)

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
Cohesion: 0.19
Nodes (6): DatabaseContext, Injectable, PrismaService, Injectable, PrismaTransactionManager, Injectable

### Community 25 - "MembershipRole"
Cohesion: 0.07
Nodes (10): Inject, MembershipAdministrationRecord, MembershipAdministrationRepository, MembershipRole, LoginWorkspaceResolution, MembershipsRepository, MembershipSummary, membershipAdministrationSelect (+2 more)

### Community 26 - "api-exception.filter.ts"
Cohesion: 0.24
Nodes (11): Catch, ApiExceptionFilter, applicationErrorStatus(), isSafeErrorBody(), isSafeMembershipRole(), isUnknownRecord(), readApplicationErrorDetails(), readIdAndName() (+3 more)

### Community 28 - "AuthenticationRateLimitPort"
Cohesion: 0.27
Nodes (6): AUTHENTICATION_RATE_LIMITER, AuthenticationRateLimitPort, EmailVerificationRequestGuard, Inject, Injectable, readNormalizedEmail()

### Community 29 - "PrismaPasswordIdentityRepository"
Cohesion: 0.15
Nodes (4): RecordingCredentialRepository, PasswordCredentialVerificationRepository, PrismaPasswordIdentityRepository, Injectable

### Community 31 - "app.module.ts"
Cohesion: 0.20
Nodes (9): AppController, Controller, Get, AppService, Injectable, AuthenticationModule, Module, AuthorizationModule (+1 more)

### Community 32 - "PrismaOrganizationsRepository"
Cohesion: 0.21
Nodes (4): OrganizationsRepository, OrganizationSummary, PrismaOrganizationsRepository, Injectable

### Community 33 - "rename-current-workspace.use-case.ts"
Cohesion: 0.08
Nodes (20): AuditModule, Module, MembershipsModule, Module, RenameCurrentWorkspace, createFixture(), Injectable, WorkspaceWriteConflictError (+12 more)

### Community 34 - "Nexora Platform Engineering"
Cohesion: 0.14
Nodes (14): Apply cross-cutting controls, Architecture debt guards, Classify the repository boundary first, Classify the request, Define and implement the slice, Delegate when useful, Downstream product repository, Load the right context (+6 more)

### Community 35 - "AuthenticatedRequestContext"
Cohesion: 0.19
Nodes (5): AuthenticatedRequestContext, isWriteConflict(), readSafeErrorCode(), SwitchWorkspace, Injectable

### Community 36 - "registration.errors.ts"
Cohesion: 0.06
Nodes (34): PasswordResetDelivery, Inject, Injectable, PASSWORD_RESET_SENDER, PasswordResetSender, PasswordResetToken, PasswordResetTokenService, Injectable (+26 more)

### Community 37 - "membership-invitation-request.guard.ts"
Cohesion: 0.19
Nodes (9): normalizeIdentityEmail(), MEMBERSHIP_INVITATION_RATE_LIMITER, MembershipInvitationRateLimiterPort, enforceDecision(), MembershipInvitationAcceptRequestGuard, MembershipInvitationCreateRequestGuard, readNormalizedEmail(), Inject (+1 more)

### Community 38 - "ADR-XXXX: Decision title"
Cohesion: 0.12
Nodes (16): ADR-XXXX: Decision title, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+8 more)

### Community 39 - "jest"
Cohesion: 0.15
Nodes (13): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+5 more)

### Community 40 - "membership-role.ts"
Cohesion: 0.16
Nodes (6): MEMBERSHIP_INVITATIONS_REPOSITORY, MembershipInvitationRecord, isInvitableMembershipRole(), MEMBERSHIP_ROLES, PrismaMembershipInvitationsRepository, Injectable

### Community 41 - "ADR-0006: Select and switch the active workspace per session"
Cohesion: 0.11
Nodes (17): ADR-0006: Select and switch the active workspace per session, Choose the most recent workspace automatically, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers (+9 more)

### Community 42 - "identity.module.ts"
Cohesion: 0.19
Nodes (8): IDENTITY_LOOKUP_REPOSITORY, PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY, PasswordCredentialManagement, PasswordCredentialManagementRepository, Inject, Injectable, IdentityModule, Module

### Community 43 - "check-deprecated-apis.mjs"
Cohesion: 0.27
Nodes (8): addFinding(), configPath, deprecatedMessage(), findDeprecatedSymbol(), flattenUnion(), isImportName(), projectRoot, visit()

### Community 44 - "prisma-identity-registration.repository.ts"
Cohesion: 0.21
Nodes (7): CreatePasswordIdentity, IDENTITY_REGISTRATION_REPOSITORY, IdentityRegistrationRepository, IdentityAlreadyExistsError, isUniqueConstraintError(), PrismaIdentityRegistrationRepository, Injectable

### Community 45 - "Users"
Cohesion: 0.11
Nodes (15): AppendAuditLog, MembershipSessionRevocations, Inject, Injectable, MembershipWriteConflictError, Inject, Inject, Injectable (+7 more)

### Community 46 - "Foundation modules"
Cohesion: 0.20
Nodes (10): Audit, Authentication, Authorization and roles, Configuration and persistence, Foundation modules, Identity, Memberships, Organizations (+2 more)

### Community 47 - "MembershipAdministration"
Cohesion: 0.10
Nodes (12): isWriteConflict(), ListWorkspaceMemberships, readSafeErrorCode(), Inject, Injectable, MembershipAdministration, Inject, Injectable (+4 more)

### Community 48 - "prisma-identity-lookup.repository.ts"
Cohesion: 0.27
Nodes (4): IdentityLookupRepository, IdentitySummary, PrismaIdentityLookupRepository, Injectable

### Community 49 - "Nexora Platform Engineering Change Checklists"
Cohesion: 0.22
Nodes (9): ADR triggers, Change design and layering, Commercial and metered capabilities, Current-state and boundary gate, Data, authentication, and tenancy, External providers and automated output, Jobs, files, API, and operations, Nexora Platform Engineering Change Checklists (+1 more)

### Community 50 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 51 - "membership-administration.use-cases.spec.ts"
Cohesion: 0.12
Nodes (14): AuthorizationDeniedError, MembershipWriteConflictError, MembershipAdministrationStateError, WorkspaceMembershipListItem, WorkspaceMembershipPage, MEMBERSHIP_ADMINISTRATION_REPOSITORY, createFixture(), membership() (+6 more)

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
Nodes (7): eslint, @eslint/js, devDependencies, eslint, @eslint/js, @types/express, @types/express

### Community 59 - "Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Implemented, Local development, Nexora Platform Core, Prerequisites, Product extension model, Verification

### Community 60 - "audit.module.ts"
Cohesion: 0.15
Nodes (9): AUDIT_LOG_REPOSITORY, AuditLogRepository, PrismaAuditLogRepository, Injectable, CoreInfrastructureModule, Module, ORGANIZATIONS_REPOSITORY, OrganizationsModule (+1 more)

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

### Community 66 - ".listForUser"
Cohesion: 0.23
Nodes (3): ListSessionWorkspaces, Injectable, WorkspaceSelectionOption

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

### Community 76 - "AuthorizationPolicy"
Cohesion: 0.28
Nodes (5): AuthorizationPolicy, PERMISSIONS, Injectable, AuthorizationPolicyModule, Module

### Community 77 - "PrismaPasswordResetTokensRepository"
Cohesion: 0.20
Nodes (4): PasswordResetTokenRecord, PrismaPasswordResetTokensRepository, recordSelection, Injectable

### Community 79 - "AppConfig"
Cohesion: 0.22
Nodes (5): AppConfig, environmentSchema, Injectable, RedisService, Injectable

### Community 82 - "TransactionManager"
Cohesion: 0.07
Nodes (29): AuditLog, Inject, Injectable, Inject, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager (+21 more)

### Community 83 - "AuthenticatedRoute"
Cohesion: 0.17
Nodes (9): Permission, ApplicationAuthenticatedRoute(), ApplicationAuthenticatedRouteOptions, AuthenticatedRoute(), AuthenticatedRouteOptions, RouteAdmissionExamples, PublicRouteOptions, RouteAdmission (+1 more)

### Community 86 - "Product boundary"
Cohesion: 0.67
Nodes (3): A downstream product repository owns, Platform Core owns, Product boundary

### Community 88 - "PrismaEmailVerificationsRepository"
Cohesion: 0.20
Nodes (4): EmailVerificationRecord, PrismaEmailVerificationsRepository, recordSelection, Injectable

### Community 91 - "CurrentAuthenticatedContext"
Cohesion: 0.36
Nodes (4): CurrentAuthenticatedContext, RouteAdmissionProbeController, Controller, Get

### Community 93 - "membership-ownership-transfer-request.guard.ts"
Cohesion: 0.20
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

### Community 115 - "membership-invitations.controller.ts"
Cohesion: 0.14
Nodes (20): AcceptMembershipInvitationRequest, acceptMembershipInvitationSchema, CreateMembershipInvitationRequest, createMembershipInvitationSchema, MembershipInvitationsController, ApiBody, ApiConflictResponse, ApiCookieAuth (+12 more)

### Community 116 - "Q: Implement Multi-workspace selection and switching task"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement Multi-workspace selection and switching task, Source Nodes

### Community 117 - ".execute"
Cohesion: 0.10
Nodes (11): CreateMembershipInvitation, isUniqueConflict(), isWriteConflict(), readSafeErrorCode(), Injectable, MembershipInvitationTokenService, Injectable, MembershipInvitations (+3 more)

### Community 118 - ".execute"
Cohesion: 0.18
Nodes (7): AcceptMembershipInvitation, isUniqueConflict(), isWriteConflict(), readSafeErrorCode(), Injectable, RevokeMembershipInvitation, Injectable

### Community 120 - "workspaces.controller.ts"
Cohesion: 0.14
Nodes (11): RenameCurrentWorkspaceRequest, renameCurrentWorkspaceSchema, ApiBody, ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, Body (+3 more)

### Community 123 - "isTransactionWriteConflict"
Cohesion: 0.36
Nodes (6): isWriteConflict(), isWriteConflict(), isWriteConflict(), isTransactionWriteConflict(), isUnknownRecord(), TransactionWriteConflictError

### Community 125 - "configure-app.ts"
Cohesion: 0.38
Nodes (4): AppModule, Module, configureApp(), bootstrap()

### Community 126 - "pwned-passwords-compromise-checker.ts"
Cohesion: 0.23
Nodes (7): COMMON_PASSWORD_SHA256_HASHES, CONTEXT_SPECIFIC_PASSWORDS, findSuffix(), localHash(), PwnedPasswordsCompromiseChecker, readBoundedText(), Injectable

### Community 127 - "workspace-switch-request.guard.ts"
Cohesion: 0.25
Nodes (3): Inject, Injectable, WorkspaceSwitchRequestGuard

### Community 128 - "password-credential-verification.ts"
Cohesion: 0.21
Nodes (8): PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY, PasswordCredentialRecord, VERIFIED_PASSWORD_HASH, VerifiedPasswordCredential, PASSWORD_VERIFIER, PasswordVerifier, Argon2PasswordVerifier, Injectable

### Community 129 - ".create"
Cohesion: 0.18
Nodes (4): isWriteConflict(), readSafeErrorCode(), isWriteConflict(), readSafeErrorCode()

### Community 130 - "users.controller.ts"
Cohesion: 0.16
Nodes (11): UpdateOwnProfileRequest, updateOwnProfileSchema, ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags, Body (+3 more)

### Community 131 - "change-password.use-case.spec.ts"
Cohesion: 0.22
Nodes (5): EXPIRES_AT, InlineTransactionManager, NOW, RAW_TOKEN, PasswordChangeInvalidCurrentPasswordError

### Community 133 - "MembershipInvitationRateLimiter"
Cohesion: 0.57
Nodes (3): MembershipInvitationRateLimitDecision, MembershipInvitationRateLimiter, Injectable

### Community 134 - "memberships.controller.ts"
Cohesion: 0.27
Nodes (9): ChangeMembershipRoleRequest, changeMembershipRoleSchema, LeaveCurrentWorkspaceBody, leaveCurrentWorkspaceBodySchema, ListWorkspaceMembershipsRequest, listWorkspaceMembershipsSchema, TransferWorkspaceOwnershipRequest, transferWorkspaceOwnershipSchema (+1 more)

### Community 137 - "Tenant isolation matrices"
Cohesion: 0.33
Nodes (5): Completion rule, HTTP endpoint matrix, Repository matrix, Scope models, Tenant isolation matrices

### Community 138 - "LoginRequestGuard"
Cohesion: 0.33
Nodes (3): LoginRequestGuard, Inject, Injectable

### Community 139 - "PasswordResetRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordResetRequestGuard, Inject, Injectable

### Community 140 - "RegistrationRequestGuard"
Cohesion: 0.33
Nodes (3): RegistrationRequestGuard, Inject, Injectable

### Community 142 - "PasswordCredentialVerification"
Cohesion: 0.33
Nodes (3): PasswordCredentialVerification, Inject, Injectable

### Community 143 - "IdentityRegistration"
Cohesion: 0.40
Nodes (3): IdentityRegistration, Inject, Injectable

### Community 144 - "change-membership-role.use-case.ts"
Cohesion: 0.40
Nodes (4): ChangeMembershipRole, MembershipWriteConflictError, readSafeErrorCode(), Injectable

### Community 147 - "register"
Cohesion: 0.47
Nodes (6): confirmEmail(), readVerificationToken(), register(), registerUnverified(), registerWithPassword(), registrationBody()

### Community 149 - "request-id.middleware.ts"
Cohesion: 0.40
Nodes (3): RequestIdMiddleware, RequestWithId, Injectable

## Knowledge Gaps
- **443 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+438 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppConfig` connect `AppConfig` to `authentication.module.ts`, `route-admission.guard.spec.ts`, `change-password.use-case.ts`, `GetCurrentSession`, `registration.errors.ts`, `PasswordChangeRequestGuard`, `memberships.controller.ts`, `memberships.module.ts`, `authentication.controller.ts`, `.execute`, `TransactionManager`, `OutboundMail`, `DatabaseContext`, `AuthenticationRateLimitPort`, `configure-app.ts`, `pwned-passwords-compromise-checker.ts`, `workspace-switch-request.guard.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `PrismaUsersRepository` connect `UsersRepository` to `Users`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Clock` connect `authentication.module.ts` to `rename-current-workspace.use-case.ts`, `change-password.use-case.ts`, `change-password.use-case.spec.ts`, `registration.errors.ts`, `memberships.module.ts`, `Users`, `TransactionManager`, `membership-administration.use-cases.spec.ts`, `.now`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _443 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `authentication.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06990622335890878 - nodes in this community are weakly interconnected._
- **Should `route-admission.guard.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10931174089068826 - nodes in this community are weakly interconnected._
- **Should `change-password.use-case.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06660006660006661 - nodes in this community are weakly interconnected._