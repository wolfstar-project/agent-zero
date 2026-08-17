import { addComponentsDir, addImportsDir, createResolver, defineNuxtModule } from 'nuxt/kit';

/**
 * Registers `home/components` (Hero, Faq, PricingTable, ...) and `home/composables`: the landing
 * page's own sections. Prefixed so these generic names (Hero, Faq) cannot collide with a component
 * another module — or Nuxt itself — already registers.
 */
export default defineNuxtModule({
  meta: {
    name: 'marketing-home',
  },
  setup() {
    const { resolve } = createResolver(import.meta.url);

    addComponentsDir({ path: resolve('./components'), prefix: 'Home' });
    addImportsDir(resolve('./composables'));
  },
});
