import { dashboardOverview } from '@agent-zero/api';
import { redactSecrets } from '@agent-zero/shared';
import { defineHandler } from 'nitro';
import type { EventHandlerWithFetch } from 'nitro/h3';

import { json, messageOf } from '../utils/respond.js';
import { taskStore } from '../utils/store.js';

/** One aggregate read model for the dashboard; presentation never gains a wider surface. */
const handler: EventHandlerWithFetch = defineHandler(async () => {
  try {
    return dashboardOverview(await taskStore.list());
  } catch (error) {
    return json(500, { error: redactSecrets(messageOf(error)) });
  }
});

export default handler;
