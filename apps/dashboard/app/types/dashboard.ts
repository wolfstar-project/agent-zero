export type DashboardTaskStatus = 'queued' | 'running' | 'completed' | 'needs-human' | 'failed';

interface DashboardTaskEvent {
  state: string;
  message: string;
  timestamp: string;
}

interface DashboardTaskResult {
  attempts: number;
  verified: boolean;
  summary: string;
  usage: {
    totalTokens: number;
  };
}

export interface DashboardTask {
  id: string;
  repository: string;
  status: DashboardTaskStatus;
  createdAt: string;
  updatedAt: string;
  events: DashboardTaskEvent[];
  result?: DashboardTaskResult;
}

export interface DashboardOverview {
  tasks: DashboardTask[];
  active: number;
  queued: number;
  awaitingApproval: number;
  totalTokens: number;
  costUsd: number;
}
