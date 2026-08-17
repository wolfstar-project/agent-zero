# analytics module (reserved)

Not built yet. No analytics provider is configured anywhere in this app, and none should be added
silently — the site has no cookie or consent UI, so any tracking script needs that conversation
first, not just an implementation.

If a provider is approved, this is where its integration belongs: a `useAnalytics()` composable in
`composables/` that no-ops when its provider environment variable is unset (matching the pattern
`config/app.ts` already uses for `MARKETING_SITE_URL`/`MARKETING_DASHBOARD_URL`), loaded from
`app.vue` behind that same check. Keep it a thin wrapper over the provider's script — this module
should never grow enough logic to need its own tests beyond the no-op path.
