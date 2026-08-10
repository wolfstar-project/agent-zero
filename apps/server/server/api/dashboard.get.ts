import { redactSecrets } from '@agent-zero/shared';
import { defineHandler } from 'nitro';

import { dashboardOverview } from '../../src/dashboard.js';
import { json, messageOf } from '../utils/respond.js';
import { taskStore } from '../utils/store.js';

/** One aggregate read model for the dashboard; presentation never gains a wider surface. */
export default defineHandler(async () => {
  try {
    return dashboardOverview(await taskStore.list());
  } catch (error) {
    return json(500, { error: redactSecrets(messageOf(error)) });
  }
});
