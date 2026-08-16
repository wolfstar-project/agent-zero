import { defineConfig } from '@maizzle/framework';

/**
 * Baseline render settings shared by every template.
 *
 * `sendEmail` merges the per-message context over this object, so anything declared here is
 * available to templates through `useConfig()`.
 */
export default defineConfig({
  // Only the top-level files are messages. Layouts and components live one level deeper and are
  // imported by templates, so a recursive glob would build each of them as a standalone email.
  // `content` is top-level: nesting it under a `build` key type-checks but is silently ignored.
  content: ['emails/*.vue'],
  css: {
    inline: true,
    purge: true,
  },
});
