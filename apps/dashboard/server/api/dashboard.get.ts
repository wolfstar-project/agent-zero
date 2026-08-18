import { dashboardOverview } from '@agent-zero/api';

/** One aggregate read model for the dashboard; presentation never gains a wider surface. */
export default defineEventHandler(async () => {
  try {
    return dashboardOverview(await taskStore.list());
  } catch (error) {
    throw errors.internal(error);
  }
});
