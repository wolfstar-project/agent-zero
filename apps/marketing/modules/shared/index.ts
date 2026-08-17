import { addComponentsDir, addImportsDir, createResolver, defineNuxtModule } from 'nuxt/kit';

/**
 * Registers `shared/components` (header, footer, locale switcher, color-mode toggle, error page):
 * elements every page uses, so — unlike `home` and `contact` — this module registers them without
 * a prefix. `shared/utils` (landmarks, error-status helpers, site navigation) is registered for
 * auto-import the same way, so call sites don't need path imports back into this module.
 */
export default defineNuxtModule({
  meta: {
    name: 'marketing-shared',
  },
  setup() {
    const { resolve } = createResolver(import.meta.url);

    addComponentsDir({ path: resolve('./components') });
    addImportsDir(resolve('./utils'));
  },
});
