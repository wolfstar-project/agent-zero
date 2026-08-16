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
 * Frontmatter every blog post declares. `date` is the publication date (ISO 8601) the listing
 * sorts by; `tag` is a single lowercase category the listing can filter on; `authorInitials`
 * feeds the same initials-tile avatar the testimonials use — this site ships no portrait images.
 */
const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.string(),
  author: z.string(),
  authorInitials: z.string(),
  tag: z.string(),
});

/**
 * A single `legal` and a single `blog` collection, sourced from `en/` only: this site's long-form
 * content ships in English regardless of the visitor's UI locale. `packages/i18n` remains the
 * source of UI copy (nav labels, buttons, page titles for the other pages); these collections
 * exist because document and post bodies are prose too long to live as i18n string values, not
 * because the two systems compete for the same content.
 */
export default defineContentConfig({
  collections: {
    legal: defineCollection({
      type: 'page',
      source: { include: 'en/legal/**', prefix: '/legal' },
      schema: legalSchema,
    }),
    blog: defineCollection({
      type: 'page',
      source: { include: 'en/blog/**', prefix: '/blog' },
      schema: blogSchema,
    }),
  },
});
