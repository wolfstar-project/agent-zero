import { defineCollection, defineContentConfig, z } from '@nuxt/content';

/**
 * Frontmatter every legal document declares. `lastUpdated` is per document rather than one date
 * for the whole site (`config/legal.ts` used to hold a single hardcoded value for both privacy
 * and terms) — a change to one document should not silently backdate the other's history.
 */
const legalSchema = z.object({
  title: z.string(),
  description: z.string(),
  lastUpdated: z.string(),
});

/**
 * One collection per locale rather than a single collection with a `locale` field: `@nuxt/content`
 * resolves a collection's `source` at build time, so per-locale directories under `content/` give
 * each translation its own indexable set of files without a runtime filter, and a missing
 * translation fails at the query site instead of silently falling back to the wrong language.
 *
 * `packages/i18n` remains the source of UI copy (nav labels, buttons, page titles for the other
 * pages); this collection exists because legal document *bodies* are prose too long to live as
 * i18n string values, not because the two systems compete for the same content.
 */
export default defineContentConfig({
  collections: {
    legal_en: defineCollection({
      type: 'page',
      source: { include: 'en/legal/**', prefix: '/legal' },
      schema: legalSchema,
    }),
    legal_it: defineCollection({
      type: 'page',
      source: { include: 'it/legal/**', prefix: '/legal' },
      schema: legalSchema,
    }),
  },
});
