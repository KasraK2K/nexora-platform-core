# Nexora Platform Core — Claude Code

Repository guidance lives in `AGENTS.md` and is shared with every agent
toolchain. Read it before planning or editing.

@AGENTS.md

## Claude-specific assets

- Skill `nexora-platform-engineering` (`.claude/skills/`) — invoke for
  architecture-sensitive planning, implementation, diagnosis, or review. It
  mirrors the Codex skill in `.agents/skills/` and shares the same reference
  documents under `.agents/skills/nexora-platform-engineering/references/`.
- Subagents (`.claude/agents/`), all read-only and delegated only when the user
  asks for a delegated or parallel review:
  - `nexora-architect` — boundaries, ownership, contracts, data, ADR impact.
  - `nexora-security-reviewer` — auth, tenancy, secrets, providers, privacy.
  - `nexora-quality-reviewer` — correctness, concurrency, tests, maintainability.
- `.claude/settings.json` registers the graphify pre-Bash staleness check, the
  Claude equivalent of `.codex/hooks.json`.
- Keep `.claude/` and `.codex/` in sync when the shared guidance changes.
