import { addComponentsDir, createResolver, defineNuxtModule } from 'nuxt/kit';

/**
 * Registers `contact/components` (the contact page's channel list). Prefixed for the same reason
 * as `home`: a generic name here shouldn't collide with another module's component.
 */
export default defineNuxtModule({
  meta: {
    name: 'marketing-contact',
  },
  setup() {
    const { resolve } = createResolver(import.meta.url);

    addComponentsDir({ path: resolve('./components'), prefix: 'Contact' });
  },
});
