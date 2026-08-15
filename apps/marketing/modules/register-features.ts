import { addComponentsDir, addImportsDir, createResolver, defineNuxtModule } from 'nuxt/kit';

/**
 * Registers this site's feature directories with Nuxt, the way `apps/dashboard/modules/vitehub.ts`
 * composes its own local module rather than configuring everything inline in `nuxt.config.ts`.
 *
 * `modules/` sits at the project root — not under `app/` — matching wolfstar.rocks, which reserves
 * that top-level location for real Nuxt modules. `home`, `contact`, and `shared` hold this site's
 * components and composables; `blog`, `changelog`, and `analytics` are reserved (see their own
 * README.md) and have nothing to register yet.
 */
export default defineNuxtModule({
  meta: {
    name: 'register-features',
  },
  setup() {
    const { resolve } = createResolver(import.meta.url);

    addComponentsDir({ path: resolve('./shared/components') });
    // Prefixed so each module's generic names (Hero, Faq, Channels) cannot collide with a
    // component another module — or Nuxt itself — already registers.
    addComponentsDir({ path: resolve('./home/components'), prefix: 'Home' });
    addComponentsDir({ path: resolve('./contact/components'), prefix: 'Contact' });

    addImportsDir(resolve('./home/composables'));
  },
});
