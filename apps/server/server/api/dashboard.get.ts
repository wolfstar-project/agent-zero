import { defineEventHandler } from 'h3';
import { useStorage } from 'nitropack/runtime';

import { PersistentTaskStore } from '../../src/control-plane.js';
import { dashboardOverview } from '../../src/dashboard.js';

export default defineEventHandler(async () => {
  const tasks = await new PersistentTaskStore(useStorage('agent-zero')).list();
  return dashboardOverview(tasks);
});
