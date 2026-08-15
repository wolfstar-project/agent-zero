import { addComponentsDir, createResolver, defineNuxtModule } from 'nuxt/kit';

/**
 * Registers `shared/components` (header, footer, locale switcher, color-mode toggle, error page):
 * elements every page uses, so — unlike `home` and `contact` — this module registers them without
 * a prefix.
 */
export default defineNuxtModule({
  meta: {
    name: 'marketing-shared',
  },
  setup() {
    const { resolve } = createResolver(import.meta.url);

    addComponentsDir({ path: resolve('./components') });
  },
});
