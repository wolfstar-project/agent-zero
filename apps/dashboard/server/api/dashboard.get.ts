import { dashboardOverview } from '@agent-zero/api';
import { defineEventHandler } from 'h3';

import { errorResponse } from '../utils/respond.js';
import { taskStore } from '../utils/store.js';

/** One aggregate read model for the dashboard; presentation never gains a wider surface. */
export default defineEventHandler(async () => {
  try {
    return dashboardOverview(await taskStore.list());
  } catch (error) {
    return errorResponse(error);
  }
});
