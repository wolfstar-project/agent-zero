import type { StoredTask } from './control-plane.js';
import type { DashboardOverview } from './types.js';

export type { DashboardOverview } from './types.js';

export function dashboardOverview(tasks: StoredTask[]): DashboardOverview {
  return {
    tasks,
    active: tasks.filter((task) => task.status === 'running').length,
    queued: tasks.filter((task) => task.status === 'queued').length,
    awaitingApproval: tasks.filter(
      (task) => task.status === 'needs-human' && task.approval === undefined,
    ).length,
    totalTokens: tasks.reduce((total, task) => total + (task.result?.usage.totalTokens ?? 0), 0),
    costUsd: tasks.reduce((total, task) => total + (task.result?.usage.costUsd ?? 0), 0),
  };
}
