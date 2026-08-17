# Deployment

The dashboard is the single deployable artifact: one Nuxt app serving the UI, the control plane, and authentication from one origin.

## Build and run

```bash
aube run build
node apps/dashboard/.output/server/index.mjs
```

`nuxt build` emits a self-contained `.output/` bundle — no `node_modules` needed at runtime. The server listens on port 3000 by default; override with `PORT`.

## Production checklist

- [ ] **Session secret** — set `NUXT_BETTER_AUTH_SECRET` (this exact name; the development fallback is ignored in production). Generate with `openssl rand -base64 32`.
- [ ] **Postgres** — point `DATABASE_URL` at a managed database and apply the schema once with `aube run db:migrate`. See [Database](/guide/database).
- [ ] **Auth policy** — decide `AUTH_ENABLE_SIGNUP`, GitHub OAuth credentials, and organization flags, then **build with them set**: the auth pages capture capabilities at build time. See [Authentication](/guide/authentication/overview).
- [ ] **Mail** — set `MAIL_PROVIDER` to `resend` or `smtp`; the default `console` only logs. Required if organizations are enabled. See [Mails](/guide/mails).
- [ ] **Control plane** — issue bearer tokens via `AGENT_ZERO_CONTROL_PLANE_TOKENS`, allow-list repositories via `AGENT_ZERO_CONTROL_PLANE_REPOSITORIES`, and grant modes via `AGENT_ZERO_CONTROL_PLANE_MODES`. Without them, mutations are rejected. See [Protect endpoints](/guide/api/protect-endpoints).
- [ ] **Webhooks** — set `GITHUB_WEBHOOK_SECRET` and `AGENT_ZERO_CHECKOUT_PATH`; the webhook route fails closed (503) until both are set. Configure the webhook on the source-control side per [Source-control providers](/reference/source-control-providers).
- [ ] **Isolated execution** — production runs that write require `runner.isolation: container` in repository policy, with an image and resource limits. The included `LocalRunner` is for trusted local development only. See the [Safety model](/guide/safety).
- [ ] **Model provider** — select the provider in repository policy and set its credential environment variable. See [Model providers](/reference/model-providers).

## Task history storage

Task history uses the ViteHub KV Runtime Helper: filesystem-backed `fs-lite` by default (`.data/agent-zero`), with Cloudflare KV, Deno KV, or Upstash available as driver configuration without touching application code. Records are redacted before they are written.

## Hosted sandboxes

For hosted execution, the provider-neutral `RunnerPool` supports vendor adapters (ViteHub, Cloudflare Sandbox, Vercel Sandbox were evaluated — see [Sandbox providers](/reference/sandbox-providers)). Quota checks run before provisioning, leases are bounded, and expired sandboxes are stopped.

## Rebuild triggers

Rebuild the app whenever you change:

- `AUTH_ENABLE_SIGNUP`, `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, or organization flags (login-page capabilities are captured at build time);
- anything in `packages/*` (the server bundle inlines them).

## Documentation site

`apps/docs` is not deployed with the dashboard. It ships its own `vercel.json` so it can be
deployed as a separate Vercel project with **Root Directory** set to `apps/docs`: the install and
build commands `cd` back to the workspace root so `pnpm` and Turborepo resolve the monorepo
correctly, and the build output is `.vitepress/dist`.
