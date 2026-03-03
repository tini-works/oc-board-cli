## Communication

When asking clarifying questions, always use the AskUserQuestion tool instead of typing questions directly.

## Runtime

Bun only. `bun test`, `bun install`, `bun run <script>`. No node/npm/yarn/pnpm/dotenv.
Prefer `Bun.file` over `node:fs`, `Bun.$` over execa.
Bun API docs: `node_modules/bun-types/docs/**.md`.

## Releasing

```bash
git tag v0.x.x && git push origin v0.x.x
```

CI runs tests, builds, publishes to npm, creates GitHub Release. Secret: `NPM_TOKEN`.

## Architecture

This project uses C3 architecture docs in `.c3/`.
For architecture questions, changes, audits, file context → `/c3`.
Operations: query, audit, change, ref, sweep.
File lookup: `c3x lookup <file-or-glob>` maps files/directories to components + refs.
