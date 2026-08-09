---
name: orpc-server
description: Use when changing apps/server procedures, oRPC contracts, handlers, middleware, transport setup, or typed clients.
---

# oRPC server

`apps/server` is a transport adapter and composition root built with oRPC.

## Rules

- Keep procedure contracts and router composition in `apps/server/src/router.ts`.
- Keep Node HTTP startup in `apps/server/src/index.ts`.
- Infer client types from the router; do not duplicate request or response interfaces.
- Validate inputs at the procedure boundary and return stable domain-shaped results.
- Procedures call the agent runtime through typed APIs. They do not execute shell commands or mutate checkouts directly.
- Keep transport-specific headers, status mapping, and request objects out of runtime packages.
- Do not introduce Hono or a second HTTP framework.

## Workflow

1. Read the router, its tests, and the runtime method being exposed.
2. Define or adjust the oRPC procedure contract.
3. Keep the handler thin: validate, authorize, delegate, translate.
4. Add router tests without opening a real network port.
5. Update the README client example when the public router shape changes.
6. Run `aube run test --filter @agent-zero/server`, typecheck, and build.
