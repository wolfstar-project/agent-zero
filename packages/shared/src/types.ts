/** How much authority a run has over the target checkout. */
export type RunMode = 'observe' | 'suggest' | 'fix' | 'autonomous';

/** Reported impact of a finding. */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Outcome of validating review feedback against the repository.
 *
 * `accepted` means the claim is supported by repository evidence, `rejected` means it is
 * contradicted or unsupported, and `inconclusive` means the evidence was insufficient to
 * decide either way. Feedback is never accepted merely because a reviewer asserted it.
 */
export type Verdict = 'accepted' | 'rejected' | 'inconclusive';

/** Egress policy applied to runtime command execution. */
export type NetworkPolicy = 'none' | 'restricted' | 'full';

/** Every state of the discover to review lifecycle, including terminal states. */
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

/** States a task can finish in. A run always ends in exactly one of them. */
export type TerminalState = Extract<TaskState, 'completed' | 'needs-human' | 'failed'>;

/** Where a single piece of untrusted feedback came from. */
export type FeedbackKind = 'review-comment' | 'review-body' | 'manual';

/** One untrusted feedback item, normalized away from any provider payload shape. */
export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  body: string;
  author: string;
  /** True when the reviewer formally requested changes rather than commenting. */
  requestedChanges: boolean;
  path?: string;
  line?: number;
}

/** Identifies the pull request a run reports against. */
export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
  headSha: string;
}

/** A single unit of work for the runtime. */
export interface ReviewInput {
  repository: string;
  feedback: string;
  mode: RunMode;
  source?: string;
  files?: string[];
  items?: FeedbackItem[];
  pullRequest?: PullRequestRef;
}

/** The part of a finding a model provider is allowed to author. */
export interface ModelFinding {
  title: string;
  explanation: string;
  severity: Severity;
  /** Model self-reported confidence in `[0, 1]`. Never treated as proof on its own. */
  confidence: number;
  /** Whether the model could support the claim with repository evidence. */
  valid: boolean;
  evidence: string[];
  files: string[];
}

/** A model finding after the runtime validated it against the repository. */
export interface Finding extends ModelFinding {
  id: string;
  /** Decided by the runtime validation policy, never by the model or the reviewer. */
  verdict: Verdict;
  /** Why the finding was not accepted. Empty when the verdict is `accepted`. */
  rejectionReasons: string[];
}

/** A full-content file replacement proposed by a model provider. */
export interface ProposedChange {
  path: string;
  content: string;
  reason: string;
}

/** Captured evidence for one repository-native check invocation. */
export interface CheckResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/** One observed lifecycle transition. */
export interface TaskEvent {
  state: TaskState;
  message: string;
  timestamp: string;
  attempt?: number;
}

/** What the execution boundary of a run was actually allowed to do. */
export interface RunnerDescription {
  kind: 'local' | 'container';
  /** True only when repository commands ran inside an isolated sandbox. */
  isolated: boolean;
  writable: boolean;
  network: NetworkPolicy;
}

/** The complete, self-describing outcome of a run. */
export interface TaskResult {
  id: string;
  state: TerminalState;
  verdict: Verdict;
  /**
   * True only when changes were applied and every configured check passed. A run that skipped,
   * failed, or could not execute verification is never verified.
   */
  verified: boolean;
  finding: Finding | null;
  plan: string[];
  checks: CheckResult[];
  changedFiles: string[];
  attempts: number;
  events: TaskEvent[];
  runner: RunnerDescription;
  summary: string;
}

/** What a model provider returns for one planning step. */
export interface AgentDecision {
  finding: ModelFinding;
  plan: string[];
  changes: ProposedChange[];
}

/** True when at least one check ran and all of them succeeded. */
export function allChecksPassed(checks: readonly CheckResult[]): boolean {
  return checks.length > 0 && checks.every((check) => check.exitCode === 0);
}

/**
 * Whether a path may address a file inside a target checkout.
 *
 * Rejects absolute paths, parent traversal, NUL bytes, and any path reaching into `.git`. This is
 * a cheap pre-check for untrusted model and reviewer input; the runner still enforces the
 * boundary before touching the filesystem.
 */
const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:[/\\]/;
const PATH_SEPARATORS = /[/\\]/;

export function isRepositoryRelativePath(path: string): boolean {
  if (path.length === 0 || path.includes('\0')) return false;
  if (path.startsWith('/') || path.startsWith('\\') || WINDOWS_DRIVE_PREFIX.test(path))
    return false;
  const segments = path.split(PATH_SEPARATORS);
  return !segments.includes('..') && !segments.includes('.git');
}
