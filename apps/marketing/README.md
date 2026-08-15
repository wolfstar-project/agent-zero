# @agent-zero/marketing

The public marketing site: the landing page, pricing, contact routes, and the legal documents.

Frontend only. It owns no persistence, holds no credentials, and imports no runtime package — the
same boundary `apps/dashboard` keeps, with one difference: this site is server-rendered and
prerendered, because it exists to be crawled.

## Boundaries

| Rule                             | Why                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| No runtime-package imports       | Nothing here may reach `packages/agent`, `packages/runner`, or any other runtime package. |
| No persistence, no auth handlers | Sign-in links out to the dashboard origin; this app never sees a session.                 |
| No secrets                       | Everything in `config/` is public by construction and ships in the client bundle.         |
| Nitro is for rendering only      | The only server routes are the ones `@nuxtjs/seo` generates (`/robots.txt`, sitemaps).    |

## Layout

```
app/
  app.vue                     title template, hreflang, site-wide OG defaults
  error.vue                   fatal-error shell
  layouts/default.vue         skip link, header, main landmark, footer
  pages/                      /, /pricing, /contact, /legal/privacy, /legal/terms
  modules/marketing/          landing-page sections and their composables
  modules/shared/             header, footer, locale switcher, color-mode toggle
config/
  app.ts                      identity, outbound links, origin resolution
  content.ts                  page structure: cards, plans, prices, FAQ order
  legal.ts                    revision date of the shipped legal documents
```

Copy is **not** in this app. Every string lives in `@agent-zero/i18n` under
`locales/<locale>/marketing.json`, so translators work from one place and Lunaria can report
staleness. `config/content.ts` holds only what is not language — ordering, icons, prices, and link
targets — and `test/unit/content.test.ts` asserts that the two agree for every shipped locale.

## Environment

| Variable                  | Default                 | Purpose                                                      |
| ------------------------- | ----------------------- | ------------------------------------------------------------ |
| `MARKETING_SITE_URL`      | `http://localhost:3001` | Public origin for canonical URLs, hreflang, and the sitemap. |
| `MARKETING_DASHBOARD_URL` | `http://localhost:3000` | Where "Sign in" and the primary CTAs point.                  |

`MARKETING_SITE_URL` deliberately does **not** reuse `NUXT_PUBLIC_SITE_URL`: the dashboard already
claims that name for the auth adapter's origin, and a shared `.env` would otherwise point this
site's canonical URLs at the auth server. Both are read at build time, so rebuild after changing
them.

## Commands

```bash
aube --filter @agent-zero/marketing run dev        # http://localhost:3001
aube --filter @agent-zero/marketing run build      # prerenders every route into .output/public
aube --filter @agent-zero/marketing run test
aube --filter @agent-zero/marketing run typecheck
aube --filter @agent-zero/marketing run lint
```

## SEO

`@nuxtjs/seo` supplies the sitemap, `robots.txt`, canonical URLs, and the OG/Twitter defaults;
`@nuxtjs/i18n` runs on `prefix_except_default`, so `/pricing` and `/it/pricing` are separate
indexable documents cross-linked by `hreflang`. Pages declare their own metadata with
`useSeoMeta`, and `app.vue` supplies the title template and the site-wide fallbacks.

Two deliberate exclusions:

- **Legal pages are `noindex, follow`.** They ship placeholder text that is explicitly not legal
  advice, and it has no business in search results. A deployment that replaces the body should drop
  the `robots` line from `app/pages/legal/*.vue` at the same time; the sitemap picks them up
  automatically once it does.
- **`nuxt-og-image` is disabled.** It resolves fonts over the network at build time, which a build
  that must succeed offline cannot depend on, so the site ships one static card at
  `public/og-image.svg`. Most social platforms only rasterise PNG, so a deployment that cares about
  link previews should export that SVG to `public/og-image.png`, point `ogImage` in `app/app.vue`
  at it, or re-enable the module in `nuxt.config.ts` if its build has network access.

## Adding a section

1. Add its id (and icon, price, or order) to `config/content.ts`.
2. Add the strings to `locales/en/marketing.json` **and** `locales/it/marketing.json` in
   `packages/i18n`, then run `aube run i18n:schema`.
3. Add the component under `app/modules/marketing/components/` and render it from a page.
4. Run `aube --filter @agent-zero/marketing run test`; the content contract test fails loudly if a
   locale is missing a key.

Icons reached through a `:name` binding cannot be found by the icon scanner. When a new icon comes
from `config/content.ts`, add its list to `icon.clientBundle.icons` in `nuxt.config.ts` the way
`featureCards` and `logoCloud` already are, or it will silently render as an empty box.
