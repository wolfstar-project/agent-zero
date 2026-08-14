import { defineConfig } from '@maizzle/framework';

/**
 * Baseline render settings shared by every template.
 *
 * `sendEmail` merges the per-message context over this object, so anything declared here is
 * available to templates through `useConfig()`.
 */
export default defineConfig({
  build: {
    content: ['emails/**/*.vue'],
  },
  css: {
    inline: true,
    purge: true,
  },
});
