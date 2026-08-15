# Frontend

`apps/dashboard` is a [Nuxt](https://nuxt.com) 4 app and the single deployable artifact: it serves the UI, the control plane, and authentication from one origin.

## Module-per-feature layout

Application code lives under `app/modules/<feature>/` rather than Nuxt's default flat directories, registered explicitly in `nuxt.config.ts`:

```text
apps/dashboard/app/
├── app.vue
├── pages/
│   ├── (auth)/login.vue
│   ├── (dashboard)/index.vue
│   └── (organizations)/…
├── layouts/
├── plugins/
├── types/
├── assets/css/
└── modules/
    ├── shared/          # cross-feature components and composables
    ├── auth/            # login and session UI
    ├── dashboard/       # task history, queue, approvals
    └── organizations/   # organization management
```

Route groups — `(auth)`, `(dashboard)`, `(organizations)` — organize pages without affecting URLs. Pages are gated through `routeRules` with `auth: { only: 'user' | 'guest' }` and a layout assignment.

## Styling and icons

- **[UnoCSS](https://unocss.dev)** with `preset-wind4` — utility classes, not Tailwind. The CSS entry is `app/assets/css/main.css`.
- **[@nuxt/icon](https://github.com/nuxt/icon)** with the Lucide collection, fully client-bundled (`provider: 'none'`) so no icon request leaves the app.
- **[@nuxtjs/color-mode](https://color-mode.nuxtjs.org)** drives theming (`dataValue: 'theme'`).

## Server composition

The `server/` directory hosts the API transports, webhook ingress, and the Better Auth mount — see [API overview](/guide/api/overview) and [Authentication](/guide/authentication/overview).

A local Nuxt module, `modules/vitehub.ts`, composes the ViteHub KV Runtime Helper into Nuxt's own Nitro build (`preset: 'node'`), giving the server a `KeyValueStorage` backed by `fs-lite` on the filesystem by default, with Cloudflare KV, Deno KV, or Upstash as drop-in driver configuration.

## Internationalization

The interface ships English and Italian through `@nuxtjs/i18n` (`strategy: 'no_prefix'`), with dictionaries split by scope. See [Internationalization](/guide/internationalization).

## Auth capability flags

The login page's capabilities (signup enabled, GitHub button) are published via `appConfig` — captured at **build time**, deliberately not runtime-overridable. Rebuild after changing auth policy variables. See [Authentication overview](/guide/authentication/overview).

## Testing

- Unit and component tests live in `test/unit/` and `test/nuxt/`.
- `aube run test:e2e` builds the dashboard, starts the production preview on port 5678, and runs the [Playwright](https://playwright.dev) suite against the real `/api/auth/**` endpoints with an in-memory Better Auth adapter (`AUTH_E2E_MEMORY=true`, set only for that preview server) — the suite creates and signs in its own throwaway account instead of using a live database.
- Use `aube --filter @agent-zero/dashboard run test:e2e:ui` for Playwright UI mode.
