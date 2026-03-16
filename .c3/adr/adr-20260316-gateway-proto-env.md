---
id: adr-20260316-gateway-proto-env
status: accepted
created: 2026-03-16
approved-files:
  - src/server/routes/board.ts
  - src/server/board-queue.ts
---

# ADR: Add OPENCLAW_GATEWAY_PROTO env var

## Decision

Add `OPENCLAW_GATEWAY_PROTO` env var (default `http`) to the gateway URL construction so HTTPS endpoints like DeepSeek can be used via env config alone.

## Affected Files

- `src/server/routes/board.ts` — `generateAIResponse()`
- `src/server/board-queue.ts` — `BoardQueueProcessor` constructor + `processTask()`
