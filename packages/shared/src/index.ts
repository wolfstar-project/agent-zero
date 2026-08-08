import { randomUUID } from 'node:crypto';

/** Package version injected from package.json by tsdown at build time. */
export const version: string = '[VI]{{inject}}[/VI]';

export type RunMode = 'observe' | 'suggest' | 'fix' | 'autonomous';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type TaskState =
  | 'queued'
  | 'discovering'
  | 'understanding'
  | 'validating'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'reviewing'
  | 'completed'
  | 'needs-human'
  | 'failed';

export interface ReviewInput {
  repository: string;
  feedback: string;
  mode: RunMode;
  source?: string;
  files?: string[];
}

export interface Finding {
  id: string;
  title: string;
  explanation: string;
  severity: Severity;
  confidence: number;
  valid: boolean;
  evidence: string[];
  files: string[];
}

export interface ProposedChange {
  path: string;
  content: string;
  reason: string;
}
export interface CheckResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}
export interface TaskEvent {
  state: TaskState;
  message: string;
  timestamp: string;
  attempt?: number;
}
export interface TaskResult {
  id: string;
  state: Extract<TaskState, 'completed' | 'needs-human' | 'failed'>;
  finding: Finding | null;
  checks: CheckResult[];
  changedFiles: string[];
  events: TaskEvent[];
  summary: string;
}

export interface AgentDecision {
  finding: Omit<Finding, 'id'>;
  plan: string[];
  changes: ProposedChange[];
}

export const now = (): string => new Date().toISOString();
export const taskId = (): string => `az_${randomUUID()}`;
