import { addComponentsDir, addImportsDir, createResolver, defineNuxtModule } from 'nuxt/kit';

/**
 * Registers `changelog/components` (ChangelogEntry) and `changelog/composables`
 * (useGithubReleases). Prefixed for the same reason as `home`, `blog`, and `contact`.
 */
export default defineNuxtModule({
  meta: {
    name: 'marketing-changelog',
  },
  setup() {
    const { resolve } = createResolver(import.meta.url);

    addComponentsDir({ path: resolve('./components'), prefix: 'Changelog' });
    addImportsDir(resolve('./composables'));
  },
});
