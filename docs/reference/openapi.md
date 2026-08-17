# OpenAPI reference workflow

OpenAPI is the authority for the public HTTP contract. It complements the
human-written architecture and flow guides; it does not explain internal
transactions or rationale.

## Live documentation

When the application is running with API documentation enabled, Swagger UI is
served at `/docs`. Production disables Swagger through validated configuration.

`src/configure-app.ts` owns the document factory used by both runtime Swagger
and deterministic generation. Controllers and transport contracts supply tags,
operations, request schemas, response schemas, cookies, and error descriptions.

## Committed contract

[`openapi.json`](openapi.json) is a stable, key-sorted artifact committed for
review and downstream consumption. It is generated without connecting to
PostgreSQL, Redis, Resend, or a running HTTP server.

Generate an intentional change:

```bash
pnpm run contract:generate
```

Verify that source annotations and the committed artifact agree:

```bash
pnpm run contract:check
```

Check mode generates the document in memory and fails on drift. Always review
the JSON diff as a public compatibility change; successful generation does not
prove the contract is backward-compatible or complete.

## Documentation ownership

- Controllers own operation summaries, admission/security decorators, and
  HTTP status mapping.
- Presentation contract files own request/response schemas and examples.
- Stable application errors are mapped centrally by the API exception filter.
- The OpenAPI generator owns deterministic serialization only; do not duplicate
  application behavior in the script.

Known follow-up from ADR-0010: some operations still need richer response and
stable-error schemas. Improve them in bounded endpoint changes rather than
inventing schemas only in prose.
