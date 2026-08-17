import { addComponentsDir, createResolver, defineNuxtModule } from 'nuxt/kit';

/**
 * Registers `dashboard/components` (runner metrics and the task table, timeline, status, and
 * inspector). Unprefixed, because the scanner already derives one from the nested directory:
 * `components/task/Table.vue` is `<TaskTable>`.
 *
 * `dashboard/types` stays a path import (`~~/modules/dashboard/types/dashboard`): it carries types
 * only, so auto-importing it would register nothing at runtime.
 */
export default defineNuxtModule({
  meta: {
    name: 'dashboard-overview',
  },
  setup() {
    const resolver = createResolver(import.meta.url);

    addComponentsDir({ path: resolver.resolve('./components') });
  },
});
