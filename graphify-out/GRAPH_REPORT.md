# Graph Report - nexora-platform-core  (2026-08-09)

## Corpus Check
- 147 files · ~46,438 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1294 nodes · 2734 edges · 115 communities (76 shown, 39 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 135 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fc5b23fb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- register-account.use-case.spec.ts
- register-account.use-case.ts
- create-session.use-case.ts
- app.module.ts
- presentation/authenticated-request-context.ts
- authentication.module.ts
- PasswordResetTokensRepository
- Nexora Platform Core - Implementation Baseline
- EmailVerificationsRepository
- What You Must Do When Invoked
- app.e2e-spec.ts
- authentication.controller.ts
- dependencies
- compilerOptions
- password-identity-authentication.ts
- Nexora Platform Core Repository Guidance
- AuthenticationSessionsRepository
- ADR-0004: Propagate a trusted authenticated request context
- scripts
- AppConfig
- PrismaUsersRepository
- ADR-0001: Screen new passwords against breached-password data
- ADR-0002: Keep this repository product-neutral
- ADR-0003: Rotate the current session after authenticated password change
- DatabaseContext
- memberships.ts
- .execute
- PasswordChangeRequestGuard
- AuthenticationRateLimitPort
- .execute
- TransactionManager
- organizations.ts
- workspaces.ts
- Nexora Platform Engineering
- .execute
- password-reset.use-cases.spec.ts
- PasswordCredentialManagement
- ADR-XXXX: Decision title
- jest
- CoreInfrastructureModule
- api-exception.filter.ts
- PrismaPasswordIdentityRepository
- check-deprecated-apis.mjs
- prisma-identity-registration.repository.ts
- password-credential-verification.ts
- Foundation modules
- identity.module.ts
- identity-lookup.ts
- Nexora Platform Engineering Change Checklists
- graphify reference: extra exports and benchmark
- change-password.use-case.spec.ts
- package.json
- exclude
- update-common-password-blocklist.mjs
- GetCurrentSession
- pwned-passwords-compromise-checker.ts
- Create a downstream product from Nexora Platform Core
- devDependencies
- Nexora Platform Core
- InMemoryResetTokens
- Nexora Platform Core Module Catalog
- graphify reference: query, path, explain
- nest-cli.json
- eslint-config-prettier
- AuthenticationRateLimiter
- configure-app.ts
- EmailVerificationConfirmationGuard
- PasswordResetConfirmationGuard
- PasswordResetRequestGuard
- ts-loader
- RecordingResetTokensRepository
- Core module map
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- RecordingSessionCache
- RecordingSessionCache
- RecordingSessionCache
- SessionCache
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- RecordingCache
- PasswordResetTokenService
- Third-party notices
- extraction-spec.md
- Product boundary
- @eslint/eslintrc
- @eslint/js
- eslint-plugin-prettier
- globals
- jest
- @nestjs/cli
- zod
- @nestjs/core
- @nestjs/schematics
- @nestjs/testing
- Repository structure
- prettier
- prisma
- source-map-support
- supertest
- ts-jest
- ts-node
- tsconfig-paths
- @types/jest
- @types/node
- @types/nodemailer
- @types/supertest
- typescript
- typescript-eslint
- @prisma/adapter-pg

## God Nodes (most connected - your core abstractions)
1. `AppConfig` - 40 edges
2. `TransactionManager` - 34 edges
3. `Clock` - 32 edges
4. `Users` - 31 edges
5. `AuthenticationSessions` - 30 edges
6. `DatabaseContext` - 30 edges
7. `SessionCachePort` - 29 edges
8. `AuditLog` - 28 edges
9. `IdentifierFactory` - 28 edges
10. `AuthenticationRateLimitPort` - 24 edges

## Surprising Connections (you probably didn't know these)
- `AuthenticationRateLimiter` --implements--> `AuthenticationRateLimitPort`  [EXTRACTED]
  src/core/authentication/infrastructure/authentication-rate-limiter.ts → src/core/authentication/application/authentication-rate-limiter.port.ts
- `RecordingResetTokensRepository` --implements--> `PasswordResetTokensRepository`  [EXTRACTED]
  src/core/authentication/application/change-password.use-case.spec.ts → src/core/authentication/application/password-reset-tokens.ts
- `RecordingSessionCache` --implements--> `SessionCachePort`  [EXTRACTED]
  src/core/authentication/application/change-password.use-case.spec.ts → src/core/authentication/application/session-cache.port.ts
- `RecordingSessionCache` --implements--> `SessionCachePort`  [EXTRACTED]
  src/core/authentication/application/create-session.use-case.spec.ts → src/core/authentication/application/session-cache.port.ts
- `SmtpEmailVerificationSender` --implements--> `EmailVerificationSender`  [EXTRACTED]
  src/core/authentication/infrastructure/smtp-email-verification.sender.ts → src/core/authentication/application/email-verification-sender.port.ts

## Import Cycles
- None detected.

## Communities (115 total, 39 thin omitted)

### Community 0 - "register-account.use-case.spec.ts"
Cohesion: 0.10
Nodes (25): EmailVerificationDelivery, Inject, Injectable, EmailVerificationToken, EmailVerificationTokenService, Injectable, EmailVerifications, Inject (+17 more)

### Community 1 - "register-account.use-case.ts"
Cohesion: 0.14
Nodes (11): Inject, PASSWORD_COMPROMISE_CHECKER, PasswordCompromiseChecker, PASSWORD_HASHER, PasswordHasher, RegisterAccountCommand, RegisteredAccount, RecordingHasher (+3 more)

### Community 2 - "create-session.use-case.ts"
Cohesion: 0.08
Nodes (36): AppendAuditLog, AuditLog, Inject, Injectable, AuthenticationSessions, Inject, Injectable, CreatedSession (+28 more)

### Community 3 - "app.module.ts"
Cohesion: 0.24
Nodes (7): AppController, Controller, Get, AppService, Injectable, AuthenticationModule, Module

### Community 4 - "presentation/authenticated-request-context.ts"
Cohesion: 0.10
Nodes (36): ApiAcceptedResponse, ApiBody, ApiCookieAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags (+28 more)

### Community 5 - "authentication.module.ts"
Cohesion: 0.17
Nodes (10): AUTHENTICATION_SESSIONS_REPOSITORY, EMAIL_VERIFICATIONS_REPOSITORY, PasswordResetDelivery, Inject, Injectable, PASSWORD_RESET_SENDER, PasswordResetSender, PASSWORD_RESET_TOKENS_REPOSITORY (+2 more)

### Community 6 - "PasswordResetTokensRepository"
Cohesion: 0.13
Nodes (5): PasswordResetTokenRecord, PasswordResetTokensRepository, PrismaPasswordResetTokensRepository, recordSelection, Injectable

### Community 7 - "Nexora Platform Core - Implementation Baseline"
Cohesion: 0.12
Nodes (16): Accepted decisions, API and observability, Architecture style, Commercial and metered capabilities, Current state, Data ownership and persistence, Deployment baseline, External provider extensions (+8 more)

### Community 8 - "EmailVerificationsRepository"
Cohesion: 0.09
Nodes (5): EmailVerificationRecord, EmailVerificationsRepository, RecordingEmailVerifications, PrismaEmailVerificationsRepository, Injectable

### Community 9 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 10 - "app.e2e-spec.ts"
Cohesion: 0.11
Nodes (17): EMAIL_VERIFICATION_SENDER, EmailVerificationSender, RecordingEmailSender, confirmEmail(), login(), loginBody(), readCookieHeader(), readSetCookie() (+9 more)

### Community 11 - "authentication.controller.ts"
Cohesion: 0.12
Nodes (16): EmailVerificationConfirmation, emailVerificationConfirmationSchema, EmailVerificationRequest, emailVerificationRequestSchema, LoginRequest, loginRequestSchema, PasswordChangeRequest, passwordChangeSchema (+8 more)

### Community 12 - "dependencies"
Cohesion: 0.09
Nodes (23): argon2, dotenv, @nestjs/common, @nestjs/platform-express, @nestjs/swagger, nodemailer, dependencies, argon2 (+15 more)

### Community 13 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 14 - "password-identity-authentication.ts"
Cohesion: 0.15
Nodes (10): PasswordIdentityAuthentication, PasswordIdentityRecord, PasswordIdentityRepository, RecordingVerifier, Inject, Injectable, PASSWORD_VERIFIER, PasswordVerifier (+2 more)

### Community 15 - "Nexora Platform Core Repository Guidance"
Cohesion: 0.10
Nodes (20): API and observability, Architecture invariants, Billing, credits, and usage, Cross-cutting correctness, Current repository commands, Delegation, Dependency and API compatibility, Development database workflow (+12 more)

### Community 16 - "AuthenticationSessionsRepository"
Cohesion: 0.10
Nodes (8): AuthenticationSessionsRepository, RevokedSession, SessionContext, SessionRecord, RecordingSessionsRepository, PrismaAuthenticationSessionsRepository, revokedSessionSelect, Injectable

### Community 17 - "ADR-0004: Propagate a trusted authenticated request context"
Cohesion: 0.11
Nodes (17): ADR-0004: Propagate a trusted authenticated request context, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+9 more)

### Community 18 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, check:deprecated, db:dev:down, db:dev:up, db:generate, db:push, db:test:down (+12 more)

### Community 19 - "AppConfig"
Cohesion: 0.09
Nodes (14): CachedSession, SmtpEmailVerificationSender, Injectable, SmtpMailTransport, Injectable, SmtpPasswordResetSender, Injectable, TrustedOriginGuard (+6 more)

### Community 20 - "PrismaUsersRepository"
Cohesion: 0.11
Nodes (8): UserAuthenticationReference, USERS_REPOSITORY, UsersRepository, UserSummary, PrismaUsersRepository, Injectable, Module, UsersModule

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
Nodes (7): recordSelection, DatabaseContext, Injectable, PrismaService, Injectable, PrismaTransactionManager, Injectable

### Community 25 - "memberships.ts"
Cohesion: 0.17
Nodes (8): LoginWorkspaceResolution, MEMBERSHIPS_REPOSITORY, MembershipsRepository, MembershipSummary, PrismaMembershipsRepository, Injectable, MembershipsModule, Module

### Community 27 - "PasswordChangeRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordChangeRequestGuard, Inject, Injectable

### Community 28 - "AuthenticationRateLimitPort"
Cohesion: 0.12
Nodes (14): AUTHENTICATION_RATE_LIMITER, AuthenticationRateLimitPort, EmailVerificationUnavailableError, PasswordResetUnavailableError, EmailVerificationRequestGuard, Inject, Injectable, LoginRequestGuard (+6 more)

### Community 31 - "TransactionManager"
Cohesion: 0.14
Nodes (7): InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, InlineTransactionManager, TransactionManager

### Community 32 - "organizations.ts"
Cohesion: 0.20
Nodes (7): ORGANIZATIONS_REPOSITORY, OrganizationsRepository, OrganizationSummary, PrismaOrganizationsRepository, Injectable, OrganizationsModule, Module

### Community 33 - "workspaces.ts"
Cohesion: 0.20
Nodes (7): WORKSPACES_REPOSITORY, WorkspacesRepository, WorkspaceSummary, PrismaWorkspacesRepository, Injectable, Module, WorkspacesModule

### Community 34 - "Nexora Platform Engineering"
Cohesion: 0.14
Nodes (14): Apply cross-cutting controls, Architecture debt guards, Classify the repository boundary first, Classify the request, Define and implement the slice, Delegate when useful, Downstream product repository, Load the right context (+6 more)

### Community 35 - ".execute"
Cohesion: 0.26
Nodes (5): ChangePassword, isWriteConflict(), readSafeErrorCode(), Injectable, VerifiedPasswordCredential

### Community 36 - "password-reset.use-cases.spec.ts"
Cohesion: 0.14
Nodes (16): PasswordResetToken, PasswordResetTokens, Inject, Injectable, StoredReset, RequestPasswordReset, Inject, Injectable (+8 more)

### Community 37 - "PasswordCredentialManagement"
Cohesion: 0.40
Nodes (3): PasswordCredentialManagement, Inject, Injectable

### Community 38 - "ADR-XXXX: Decision title"
Cohesion: 0.12
Nodes (16): ADR-XXXX: Decision title, Compatibility and migration, Consequences, Considered options, Context, Decision, Decision drivers, Follow-up work (+8 more)

### Community 39 - "jest"
Cohesion: 0.15
Nodes (13): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, rootDir, testEnvironment, testRegex, transform (+5 more)

### Community 40 - "CoreInfrastructureModule"
Cohesion: 0.18
Nodes (8): AUDIT_LOG_REPOSITORY, AuditLogRepository, AuditModule, Module, PrismaAuditLogRepository, Injectable, CoreInfrastructureModule, Module

### Community 41 - "api-exception.filter.ts"
Cohesion: 0.21
Nodes (8): Catch, ApiExceptionFilter, applicationErrorStatus(), isSafeErrorBody(), SafeErrorBody, RequestIdMiddleware, RequestWithId, Injectable

### Community 42 - "PrismaPasswordIdentityRepository"
Cohesion: 0.13
Nodes (6): RecordingCredentialRepository, PASSWORD_CREDENTIAL_MANAGEMENT_REPOSITORY, PasswordCredentialManagementRepository, PasswordCredentialVerificationRepository, PrismaPasswordIdentityRepository, Injectable

### Community 43 - "check-deprecated-apis.mjs"
Cohesion: 0.27
Nodes (8): addFinding(), configPath, deprecatedMessage(), findDeprecatedSymbol(), flattenUnion(), isImportName(), projectRoot, visit()

### Community 44 - "prisma-identity-registration.repository.ts"
Cohesion: 0.23
Nodes (6): CreatePasswordIdentity, IdentityRegistrationRepository, IdentityAlreadyExistsError, isUniqueConstraintError(), PrismaIdentityRegistrationRepository, Injectable

### Community 45 - "password-credential-verification.ts"
Cohesion: 0.20
Nodes (6): PASSWORD_CREDENTIAL_VERIFICATION_REPOSITORY, PasswordCredentialRecord, PasswordCredentialVerification, Inject, Injectable, VERIFIED_PASSWORD_HASH

### Community 46 - "Foundation modules"
Cohesion: 0.20
Nodes (10): Audit, Authentication, Authorization and roles, Configuration and persistence, Foundation modules, Identity, Memberships, Organizations (+2 more)

### Community 47 - "identity.module.ts"
Cohesion: 0.22
Nodes (7): IDENTITY_REGISTRATION_REPOSITORY, IdentityRegistration, Inject, Injectable, PASSWORD_IDENTITY_REPOSITORY, IdentityModule, Module

### Community 48 - "identity-lookup.ts"
Cohesion: 0.29
Nodes (5): IDENTITY_LOOKUP_REPOSITORY, IdentityLookupRepository, IdentitySummary, PrismaIdentityLookupRepository, Injectable

### Community 49 - "Nexora Platform Engineering Change Checklists"
Cohesion: 0.22
Nodes (9): ADR triggers, Change design and layering, Commercial and metered capabilities, Current-state and boundary gate, Data, authentication, and tenancy, External providers and automated output, Jobs, files, API, and operations, Nexora Platform Engineering Change Checklists (+1 more)

### Community 50 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 51 - "change-password.use-case.spec.ts"
Cohesion: 0.11
Nodes (16): ChangedPasswordSession, PasswordChangeContext, EXPIRES_AT, NOW, RAW_TOKEN, AuthenticationInvalidError, AuthenticationRequiredError, EmailAlreadyRegisteredError (+8 more)

### Community 52 - "package.json"
Cohesion: 0.25
Nodes (7): author, description, license, name, packageManager, private, version

### Community 53 - "exclude"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 54 - "update-common-password-blocklist.mjs"
Cohesion: 0.29
Nodes (7): hashes, OUTPUT_PATH, sha256(), sourceBytes, sourcePasswords, sourceSha256, sourceText

### Community 55 - "GetCurrentSession"
Cohesion: 0.19
Nodes (3): readSafeErrorCode(), GetCurrentSession, Injectable

### Community 56 - "pwned-passwords-compromise-checker.ts"
Cohesion: 0.23
Nodes (7): COMMON_PASSWORD_SHA256_HASHES, CONTEXT_SPECIFIC_PASSWORDS, findSuffix(), localHash(), PwnedPasswordsCompromiseChecker, readBoundedText(), Injectable

### Community 57 - "Create a downstream product from Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Create a downstream product from Nexora Platform Core, Define the product boundary, Minimum product repository guidance, Protect Core boundaries, Review inherited runtime identity, Start from a reviewed base

### Community 58 - "devDependencies"
Cohesion: 0.29
Nodes (7): dotenv-cli, eslint, devDependencies, dotenv-cli, eslint, @types/express, @types/express

### Community 59 - "Nexora Platform Core"
Cohesion: 0.29
Nodes (6): Implemented, Local development, Nexora Platform Core, Prerequisites, Product extension model, Verification

### Community 60 - "InMemoryResetTokens"
Cohesion: 0.22
Nodes (6): activeUsers(), createRequestFixture(), createResetFixture(), fixedClock(), InMemoryResetTokens, sessionRepository()

### Community 61 - "Nexora Platform Core Module Catalog"
Cohesion: 0.20
Nodes (5): Downstream product modules, Nexora Platform Core Module Catalog, Optional reusable capability packs, Ownership rules, Shared kernel and contracts

### Community 62 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 63 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 65 - "AuthenticationRateLimiter"
Cohesion: 0.38
Nodes (3): RateLimitDecision, AuthenticationRateLimiter, Injectable

### Community 66 - "configure-app.ts"
Cohesion: 0.38
Nodes (4): AppModule, Module, configureApp(), bootstrap()

### Community 67 - "EmailVerificationConfirmationGuard"
Cohesion: 0.33
Nodes (3): EmailVerificationConfirmationGuard, Inject, Injectable

### Community 68 - "PasswordResetConfirmationGuard"
Cohesion: 0.33
Nodes (3): PasswordResetConfirmationGuard, Inject, Injectable

### Community 69 - "PasswordResetRequestGuard"
Cohesion: 0.33
Nodes (3): PasswordResetRequestGuard, Inject, Injectable

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

### Community 86 - "Product boundary"
Cohesion: 0.67
Nodes (3): A downstream product repository owns, Platform Core owns, Product boundary

### Community 97 - "Repository structure"
Cohesion: 0.67
Nodes (3): Current structure, Repository structure, Target structure

## Knowledge Gaps
- **339 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+334 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DatabaseContext` connect `DatabaseContext` to `organizations.ts`, `workspaces.ts`, `PasswordResetTokensRepository`, `CoreInfrastructureModule`, `EmailVerificationsRepository`, `PrismaPasswordIdentityRepository`, `prisma-identity-registration.repository.ts`, `AuthenticationSessionsRepository`, `identity-lookup.ts`, `PrismaUsersRepository`, `memberships.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `PasswordCredentialVerification` connect `password-credential-verification.ts` to `register-account.use-case.ts`, `app.e2e-spec.ts`, `change-password.use-case.spec.ts`, `identity.module.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `SessionCachePort` connect `create-session.use-case.ts` to `register-account.use-case.spec.ts`, `register-account.use-case.ts`, `password-reset.use-cases.spec.ts`, `RecordingSessionCache`, `RecordingSessionCache`, `RecordingSessionCache`, `SessionCache`, `RecordingCache`, `change-password.use-case.spec.ts`, `AppConfig`, `.execute`, `.execute`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _339 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `register-account.use-case.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1014799154334038 - nodes in this community are weakly interconnected._
- **Should `register-account.use-case.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14210526315789473 - nodes in this community are weakly interconnected._
- **Should `create-session.use-case.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07948568088836938 - nodes in this community are weakly interconnected._