export {
  createTask,
  decideApproval,
  getStoredTask,
  getTask,
  getTaskEvidence,
  githubTokenFromEnvironment,
  health,
  ingestWebhook,
  listTasks,
  publishEvidence,
  runTask,
  taskInput,
  tasks,
  type PublishOptions,
  type RunTaskOptions,
  type WebhookOptions,
  type WebhookOutcome,
  type WebhookRequest,
} from './router.js';
export {
  MemoryTaskStore,
  PersistentTaskStore,
  TaskQueueQuotaError,
  TaskScheduler,
  type ApprovalDecision,
  type ControlPlaneTaskStatus,
  type KeyValueStorage,
  type SchedulerOptions,
  type SchedulerSnapshot,
  type StoredTask,
  type TaskApproval,
  type TaskStore,
} from './control-plane.js';
export { dashboardOverview, type DashboardOverview } from './dashboard.js';
export { createControlPlane, startControlPlane, type ControlPlaneOptions } from './http.js';
export { rpcRouter, type RpcContext, type RpcRouter } from './rpc.js';
export { FileKeyValueStorage } from './storage.js';

import { startControlPlane } from './http.js';

// 3000 belongs to the Nuxt dashboard, so `aube run dev` can start both without a port collision.
const DEFAULT_PORT = 3001;

/** Resolve the listen port, refusing a malformed value rather than silently picking a default. */
export function portFromEnvironment(value = process.env.PORT): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535)
    throw new Error('PORT must be an integer between 0 and 65535');
  return port;
}

// Importing the package must stay side-effect free; only direct execution starts a listener.
if (import.meta.main) {
  const port = portFromEnvironment();
  await startControlPlane(port);
  process.stdout.write(`Agent Zero control plane listening on port ${String(port)}\n`);
}
