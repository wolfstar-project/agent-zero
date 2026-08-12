---
name: orpc-server
description: Use when changing apps/server routes, oRPC contracts, handlers, middleware, transport setup, or typed clients.
---

# oRPC server

`packages/api` owns the router and its runtime delegation; `apps/server` is the transport adapter and composition root that serves it.

## Rules

- Keep procedure contracts and router composition in `packages/api/src/orpc/router.ts`, and the
  control-plane operations they delegate to in `packages/api/src/operations.ts`,
  `control-plane.ts`, `access.ts`, and `dashboard.ts`. `packages/api` holds no HTTP host of its
  own — it only exports `rpcRouter`, `createAuthApp`, and the plain functions those depend on.
- The HTTP host is Nitro v3 registered as a Vite plugin next to ViteHub (`apps/server/vite.config.ts`,
  `apps/server/nitro.config.ts`). HTTP routes live in `apps/server/server/`:
  - `routes/rpc/[...].ts` mounts `rpcRouter` over `RPCHandler` (the typed RPC transport).
  - `api/v1/[...].ts` mounts the same `rpcRouter` over `OpenAPIHandler` (REST + docs at `/api/v1/docs`).
  - `api/auth/[...].ts` mounts `createAuthApp`'s Hono app (the only route with a database credential).
  - `api/dashboard.get.ts` serves the aggregate dashboard view.
  `apps/server/src/` stays a thin transport-neutral leftover (currently just `port.ts`).
- `.route({ method, path, tags, summary })` on a procedure in `router.ts` only affects the OpenAPI
  transport; the RPC transport ignores it. Add it whenever a procedure should be reachable over
  `/api/v1/**`, which today means every procedure.
- Infer client types from the router; do not duplicate request or response interfaces.
- Validate inputs at the procedure boundary and return stable domain-shaped results.
- Procedures call the agent runtime through typed APIs. They do not execute shell commands or
  mutate checkouts directly.
- Persist through the `KeyValueStorage` contract, adapted over the ViteHub KV Runtime Helper in
  `apps/server/server/utils/store.ts`, so KV drivers stay interchangeable; never store review
  input or checkout paths.
- Keep transport-specific headers, status mapping, and request objects out of runtime packages.
- Nitro v3 plus ViteHub is the only top-level HTTP host; do not introduce Express or a second one.
  Hono exists only inside `packages/api/src/auth-app.ts`, as the fetch-compatible shape Better
  Auth already expects — it is mounted by one Nitro route, not a competing server.

## Workflow

1. Read the router, its tests, and the runtime method being exposed.
2. Define or adjust the oRPC procedure contract in `packages/api/src/orpc/router.ts`, including its
   `.route()` metadata.
3. Keep the handler thin: validate, authorize, delegate, translate.
4. Add router tests with `createRouterClient`, without opening a real network port.
5. Update the README client example when the public router shape changes.
6. Run `aube run test --filter @agent-zero/api`, then `--filter @agent-zero/server`, typecheck, and build.
