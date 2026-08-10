---
name: orpc-server
description: Use when changing apps/server procedures, oRPC contracts, handlers, middleware, transport setup, or typed clients.
---

# oRPC server

`apps/server` is a transport adapter and composition root built with oRPC.

## Rules

- Keep procedure contracts and router composition in `apps/server/src/rpc.ts`, and the runtime
  operations they delegate to in `apps/server/src/router.ts`.
- The HTTP host is Nitro v3 registered as a Vite plugin next to ViteHub (`vite.config.ts`,
  `nitro.config.ts`). HTTP routes live in `apps/server/server/` (`routes/rpc/[...].ts` mounts the
  oRPC fetch handler; `api/dashboard.get.ts` serves the aggregate view); `src/` stays
  transport-neutral.
- Infer client types from the router; do not duplicate request or response interfaces.
- Validate inputs at the procedure boundary and return stable domain-shaped results.
- Procedures call the agent runtime through typed APIs. They do not execute shell commands or
  mutate checkouts directly.
- Persist through the `KeyValueStorage` contract, adapted over the ViteHub KV Runtime Helper in
  `apps/server/server/utils/store.ts`, so KV drivers stay interchangeable; never store review
  input or checkout paths.
- Keep transport-specific headers, status mapping, and request objects out of runtime packages.
- Nitro v3 plus ViteHub is the only HTTP host; do not introduce Hono, Express, or a second HTTP
  framework.

## Workflow

1. Read the router, its tests, and the runtime method being exposed.
2. Define or adjust the oRPC procedure contract.
3. Keep the handler thin: validate, authorize, delegate, translate.
4. Add router tests with `createRouterClient`, without opening a real network port.
5. Update the README client example when the public router shape changes.
6. Run `aube run test --filter @agent-zero/server`, typecheck, and build.
