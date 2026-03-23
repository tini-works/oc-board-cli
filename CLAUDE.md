# CLAUDE.md — Derived Repo Agent Guide

This is the **derived repo** for `prev-cli` (fork). All architectural decisions
are governed by the SOT repository.

## Local Development

```bash
bun run src/cli.ts dev -p 6863   # Start dev server (board mode)
```

## Rules

- Don't use `process.env.*` directly in code, define a config object.

## SOT Location

```
../prev-cli-sot
```

## Before Making Changes

1. **Query architecture**: `/c3 query` — ask where things live before touching code
2. **Impact assessment**: `/c3 sweep` — understand what breaks before refactoring
3. **Feature changes**: Use `sot-manager` skill to draft → approve → merge via SOT first

## C3 Commands (run from SOT dir: `../prev-cli-sot`)

```bash
# What is X? Where is it?
c3x query "approval webhook"

# What breaks if I change Y?
c3x sweep "approval-store"

# Coverage check
c3x coverage --c3-dir .c3

# Full validation
c3x check --c3-dir .c3
```

## Fork Delta

This fork adds three capabilities on top of upstream prev-cli:

| Component             | What                                      | Files                                                    |
| --------------------- | ----------------------------------------- | -------------------------------------------------------- |
| c3-801 approval-store | File-based approval CRUD + webhook emit   | `src/server/routes/approval.ts`                          |
| c3-802 cr-context     | `/__prev/cr-context` endpoint + CR banner | `src/server/routes/approval.ts`, `src/theme/CRPanel.tsx` |

## Key Refs

- `ref-approval-flow` — approval lifecycle from UI → webhook → merge gate
- `ref-cr-lifecycle` — CR state machine and data contracts
- `ref-prev-approval-webhook` — `prev-approval.v1` webhook schema

## Do Not

- Merge upstream changes into fork without updating SOT first
- Add new routes/features to `src/server/routes/` without a SOT component doc
- Change the `prev-approval.v1` schema without updating `ref-prev-approval-webhook`
