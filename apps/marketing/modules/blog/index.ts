import { addComponentsDir, createResolver, defineNuxtModule } from 'nuxt/kit';

/**
 * Registers `blog/components` (PostCard). Prefixed for the same reason as `home` and `contact`: a
 * generic name here shouldn't collide with another module's component.
 */
export default defineNuxtModule({
  meta: {
    name: 'marketing-blog',
  },
  setup() {
    const { resolve } = createResolver(import.meta.url);

    addComponentsDir({ path: resolve('./components'), prefix: 'Blog' });
  },
});
