# Environment variables

Agent Zero reads credentials and deployment policy exclusively from the environment. Endpoint URLs and credentials can never be named or embedded in `.agent-zero.yml`, so untrusted repository policy cannot redirect a secret.

## One env file per process

Each process reads exactly one `.env`, and that file sits next to the process that reads it. Nothing is shared implicitly: a file is loaded only by the process it belongs to, by that process's own tooling.

| File                     | Read by                                                | Loaded by                                             | Holds                                                                          |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `.env`                   | the `zero` CLI (`aube run zero …`)                     | Node's `--env-file-if-exists=.env` in the root script | Model providers, subscription transports, `GITHUB_TOKEN`                       |
| `apps/dashboard/.env`    | the dashboard: UI, control plane, webhooks, auth, mail | Nuxt, from beside `nuxt.config.ts`                    | Control plane, webhook ingress, `DATABASE_URL`, authentication, mail, site URL |
| `apps/docs/.env`         | the documentation site                                 | VitePress, from beside `.vitepress/config.ts`         | `DOCS_BASE`                                                                    |
| `packages/database/.env` | `drizzle-kit` (`db:generate`, `db:migrate`)            | drizzle-kit, from its own working directory           | `DATABASE_URL`                                                                 |

Each has a checked-in `.env.example` next to it; copy the ones you need:

```bash
cp .env.example .env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/docs/.env.example apps/docs/.env
cp packages/database/.env.example packages/database/.env
```

Every file is optional. A deployment that sets real environment variables ships no `.env` at all, and real variables always win over the file.

A variable two processes both read is written in both files on purpose, rather than one process inheriting the other's configuration:

- `DATABASE_URL` is read by the dashboard (the only process that opens the database) and by drizzle-kit when migrating. Point both at the same database — `drizzle.config.ts` and the server resolve it through the same function precisely so migrations cannot target one store while the dashboard opens another.
- The model-provider keys are read by the CLI and, when the hosted control plane executes runs, by the dashboard.

`server/auth.config.ts` resolves `DATABASE_URL` at module load, so a dashboard started without it fails on the first request (`missing required environment variable: DATABASE_URL`) rather than degrading quietly.

## Model providers

| Variable                       | Purpose                                                               |
| ------------------------------ | --------------------------------------------------------------------- |
| `OPENAI_API_KEY`               | Credential for `openai` (and legacy fallback for `openai-compatible`) |
| `ANTHROPIC_API_KEY`            | Credential for `anthropic`                                            |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Credential for `google`                                               |
| `AI_GATEWAY_API_KEY`           | Credential for `ai-gateway` (or Vercel OIDC)                          |
| `OPENAI_COMPATIBLE_API_KEY`    | Credential for `openai-compatible`                                    |
| `AGENT_ZERO_MODEL`             | Default model name                                                    |
| `AGENT_ZERO_MODEL_BASE_URL`    | Operator-owned base URL for custom gateways and self-hosted endpoints |

Each provider reads only its documented variable. See [Model providers](/reference/model-providers) for the full matrix.

## Control plane

The control-plane API (`/rpc/**` and `/api/v1/**`) fails closed: without `AGENT_ZERO_CONTROL_PLANE_TOKENS` every mutation is rejected while reads stay open.

| Variable                                | Purpose                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AGENT_ZERO_CONTROL_PLANE_TOKENS`       | Comma-separated `name:token` bearer credentials                                                                                                  |
| `AGENT_ZERO_CONTROL_PLANE_REPOSITORIES` | Comma-separated repository paths `tasks.create` may target                                                                                       |
| `AGENT_ZERO_CONTROL_PLANE_MODES`        | Comma-separated `name:mode\|mode` execution-mode grants; without one a principal may only request the non-writable `observe` and `suggest` modes |
| `AGENT_ZERO_CONTROL_PLANE_ORIGINS`      | Comma-separated origins allowed to read `/api/v1/**` cross-origin via CORS; empty by default                                                     |

See [Protect endpoints](/guide/api/protect-endpoints) for how these are enforced.

## Webhooks

`POST /webhooks/github` fails closed (503, nothing ingested) until both variables are set.

| Variable                   | Purpose                                             |
| -------------------------- | --------------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET`    | HMAC secret for GitHub webhook authentication       |
| `AGENT_ZERO_CHECKOUT_PATH` | Checkout the webhook route binds incoming events to |

Status publishing reads one fixed variable per provider (`GITHUB_TOKEN`, `GITLAB_TOKEN`, `BITBUCKET_CLOUD_TOKEN`, `BITBUCKET_DATA_CENTER_TOKEN`, `GITEA_TOKEN`) — see [Source-control providers](/reference/source-control-providers).

## Authentication

Registration and GitHub OAuth are off until you turn them on, so a fresh deployment cannot be signed up for by a stranger.

| Variable                                    | Required | Default | Purpose                                                                                                             |
| ------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `NUXT_BETTER_AUTH_SECRET`                   | yes      | –       | Session signing secret. Required under this name in production; `BETTER_AUTH_SECRET` is a development-only fallback |
| `DATABASE_URL`                              | yes      | –       | Postgres connection string; the pre-split `AUTH_DATABASE_URL` is still read when this is unset                      |
| `AUTH_ENABLE_SIGNUP`                        | no       | `false` | Set to `true` to allow self-registration                                                                            |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | no       | –       | Enables the GitHub button when both are set                                                                         |
| `AUTH_ENABLE_ORGANIZATIONS`                 | no       | `false` | Enables organizations; requires a working mail transport                                                            |
| `AUTH_ALLOW_ORGANIZATION_CREATION`          | no       | `false` | Whether any signed-in user may create an organization                                                               |
| `NUXT_PUBLIC_SITE_URL`                      | no       | –       | Base URL override for a custom domain or deterministic OAuth callbacks; auto-detected from the request otherwise    |

::: warning Build-time capture
The sign-in methods the login page offers are derived at build time from the same policy variables the server reads at runtime. Whenever you change `AUTH_ENABLE_SIGNUP` or the GitHub OAuth credentials, rebuild the app, or the login page will keep advertising the old capabilities (the server still enforces its own policy either way).
:::

## Mail

`console` logs instead of delivering and is the default, so an unconfigured deployment cannot silently attempt real delivery.

| Variable                                                  | Purpose                                     |
| --------------------------------------------------------- | ------------------------------------------- |
| `MAIL_PROVIDER`                                           | `console` (default), `resend`, or `smtp`    |
| `MAIL_FROM`                                               | Sender address                              |
| `RESEND_API_KEY`                                          | Required when `MAIL_PROVIDER=resend`        |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Required when `MAIL_PROVIDER=smtp`          |
| `SMTP_SECURE`                                             | Implicit TLS: `true` on 465, `false` on 587 |

See [Mails](/guide/mails).

## Dashboard

| Variable | Purpose                       |
| -------- | ----------------------------- |
| `PORT`   | Dashboard port (default 3000) |

## Documentation

| Variable    | Purpose                                                          |
| ----------- | ---------------------------------------------------------------- |
| `DOCS_BASE` | VitePress base path (default `/`; use `/<repository>/` on Pages) |
