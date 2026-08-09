import {
  knownLockfiles,
  mayModifyRepository,
  resolveChecks,
  type AgentZeroConfig,
  type RepositoryProbe,
} from '@agent-zero/config';
import type { ModelProvider } from '@agent-zero/models';
import type { Runner } from '@agent-zero/runner';
import {
  allChecksPassed,
  isRepositoryRelativePath,
  now,
  taskId,
  truncateTail,
  type CheckResult,
  type Finding,
  type ModelFinding,
  type ProposedChange,
  type ReviewInput,
  type TaskEvent,
  type TaskResult,
  type TaskState,
  type TerminalState,
} from '@agent-zero/shared';

import { LifecycleMachine } from './state.js';
import { validateFinding } from './validation.js';

export interface AgentDependencies {
  model: ModelProvider;
  runner: Runner;
  config: AgentZeroConfig;
  onEvent?: (event: TaskEvent) => void;
}

/** How much failing output is fed back into the next repair attempt. */
const MAX_FAILURE_CONTEXT = 8_000;

/**
 * The find, fix, and verify loop.
 *
 * A run walks `discover -> understand -> validate -> plan -> execute -> verify -> review`, repairing
 * from `verify` back to `plan` until the repair budget is spent. Reviewer feedback is never trusted
 * on arrival: it is validated against the checkout first, and a claim that is not supported is
 * rejected with its reasons kept as evidence. Changes are applied only through the runner boundary,
 * only inside the validated scope, and only when both the run mode and repository policy allow it.
 */
export class AgentZero {
  constructor(private readonly dependencies: AgentDependencies) {}

  async run(input: ReviewInput): Promise<TaskResult> {
    const run = new Run(this.dependencies, input);
    try {
      return await this.execute(run, input);
    } catch (error) {
      run.emit('failed', error instanceof Error ? error.message : String(error));
      return run.finish('failed', 'The run failed before a verified result was produced.');
    }
  }

  private async execute(run: Run, input: ReviewInput): Promise<TaskResult> {
    const { config, model, runner } = this.dependencies;

    run.emit('discovering', 'Collecting the checkout, its diff, and its native checks');
    const probe = await this.probeRepository();
    const checks = resolveChecks(config.checks, probe);
    const repositoryContext = await runner.context();

    run.emit('understanding', `Interpreting ${describeFeedback(input)} against the checkout`);
    let decision = await model.decide({ input, repositoryContext });

    run.emit('validating', 'Testing the claim against repository evidence');
    const outcome = await validateFinding(decision.finding, config.validation, runner);
    const finding = run.recordFinding(decision.finding, outcome.verdict, outcome.reasons);

    if (outcome.verdict === 'rejected')
      return run.finish(
        'completed',
        `Rejected the feedback with evidence: ${outcome.reasons.join(' ')}`,
      );
    if (outcome.verdict === 'inconclusive')
      return run.finish('needs-human', `Evidence is inconclusive. ${outcome.reasons.join(' ')}`);

    run.emit('planning', 'Recording an evidence-backed plan', 1);
    run.plan = [...decision.plan];

    const refusal = this.authorize(input, finding, checks);
    if (refusal) return run.finish(refusal.state, refusal.summary);

    let previousFailure: string | undefined;
    for (let attempt = 1; attempt <= config.agent.maxAttempts; attempt++) {
      run.attempts = attempt;
      if (attempt > 1) {
        run.emit('planning', 'Replanning after failed verification', attempt);
        decision = await model.decide({
          input,
          repositoryContext,
          ...(previousFailure === undefined ? {} : { previousFailure }),
        });
        run.plan = [...decision.plan];
      }

      const scoped = scopeChanges(decision.changes, finding, input, config.agent.maxChangedFiles);
      if ('reason' in scoped) return run.finish('needs-human', scoped.reason);

      run.emit('executing', `Applying ${String(scoped.changes.length)} planned change(s)`, attempt);
      for (const change of scoped.changes) await runner.write(change.path, change.content);

      run.emit('verifying', `Running ${String(checks.length)} repository check(s)`, attempt);
      run.checks = [];
      for (const command of checks)
        run.checks.push(await runner.check(command, config.agent.timeoutMs));

      const failures = run.checks.filter((check) => check.exitCode !== 0);
      if (failures.length === 0) {
        run.emit('reviewing', 'Inspecting the resulting diff');
        run.changedFiles = await runner.changedFiles();
        if (run.changedFiles.length === 0)
          return run.finish(
            'needs-human',
            'Every check passed but the checkout is unchanged, so nothing was actually fixed.',
          );
        return run.finish('completed', `Fixed and verified: ${finding.title}`);
      }
      previousFailure = summarizeFailures(failures);
    }

    run.changedFiles = await runner.changedFiles();
    return run.finish(
      'needs-human',
      `Verification still fails after ${String(config.agent.maxAttempts)} attempt(s); the changes were left in place for review.`,
    );
  }

  /**
   * Decide whether this run may modify the checkout.
   *
   * Each refusal is a distinct, reportable outcome rather than a silent downgrade, so the evidence
   * always says why nothing was written.
   */
  private authorize(
    input: ReviewInput,
    finding: Finding,
    checks: readonly string[],
  ): { state: TerminalState; summary: string } | undefined {
    const { config, runner } = this.dependencies;
    if (!mayModifyRepository(config, input.mode))
      return {
        state: 'completed',
        summary:
          input.mode === 'observe' || input.mode === 'suggest'
            ? `Validated and reported without modifying files: ${finding.title}`
            : `Repository policy disables automatic fixes, so ${finding.title} was reported only.`,
      };
    if (finding.confidence < config.autofix.minConfidence)
      return {
        state: 'needs-human',
        summary: `Confidence ${finding.confidence.toFixed(2)} is below the ${config.autofix.minConfidence.toFixed(2)} required to change files.`,
      };
    if (!runner.describe().writable)
      return {
        state: 'needs-human',
        summary: 'The execution boundary is read-only, so no change could be applied.',
      };
    if (checks.length === 0)
      return {
        state: 'needs-human',
        summary:
          'No repository-native checks were found, so a change could not be verified. Configure `checks` in .agent-zero.yml.',
      };
    return undefined;
  }

  /** Read what the checkout says about its own tooling, through the runner boundary. */
  private async probeRepository(): Promise<RepositoryProbe> {
    const { runner } = this.dependencies;
    let packageJson: string | null = null;
    try {
      packageJson = await runner.read('package.json');
    } catch {
      packageJson = null;
    }
    const lockfiles: string[] = [];
    for (const lockfile of knownLockfiles)
      if (await runner.exists(lockfile)) lockfiles.push(lockfile);
    return { packageJson, lockfiles };
  }
}

/** Mutable bookkeeping for one run, kept separate from the decisions the agent makes. */
class Run {
  readonly id = taskId();
  readonly events: TaskEvent[] = [];
  private readonly machine = new LifecycleMachine();
  plan: string[] = [];
  checks: CheckResult[] = [];
  changedFiles: string[] = [];
  attempts = 0;
  private finding: Finding | null = null;

  constructor(
    private readonly dependencies: AgentDependencies,
    private readonly input: ReviewInput,
  ) {}

  emit(state: TaskState, message: string, attempt?: number): void {
    this.machine.to(state);
    const event: TaskEvent = {
      state,
      message,
      timestamp: now(),
      ...(attempt === undefined ? {} : { attempt }),
    };
    this.events.push(event);
    try {
      this.dependencies.onEvent?.(event);
    } catch {
      // Observation must never change the outcome of a run.
    }
  }

  recordFinding(
    finding: ModelFinding,
    verdict: Finding['verdict'],
    rejectionReasons: readonly string[],
  ): Finding {
    this.finding = {
      ...finding,
      id: `${this.id}_finding`,
      verdict,
      rejectionReasons: [...rejectionReasons],
    };
    return this.finding;
  }

  /**
   * Produce the terminal result.
   *
   * `verified` is derived here and nowhere else: a run is verified only when it completed, applied a
   * change, and every executed check passed. No branch above can assert verification it did not
   * earn.
   */
  finish(state: TerminalState, summary: string): TaskResult {
    const settled = this.machine.finish(state);
    const verified =
      settled === 'completed' && this.changedFiles.length > 0 && allChecksPassed(this.checks);
    return {
      id: this.id,
      state: settled,
      verdict: this.finding?.verdict ?? 'inconclusive',
      verified,
      finding: this.finding,
      plan: [...this.plan],
      checks: [...this.checks],
      changedFiles: [...this.changedFiles],
      attempts: this.attempts,
      events: [...this.events],
      runner: this.dependencies.runner.describe(),
      summary: this.input.source ? `${summary} (${this.input.source})` : summary,
    };
  }
}

/**
 * Restrict a change set to the scope the validated finding established.
 *
 * A fix is only narrow if it touches the files the evidence pointed at. Anything else, including a
 * plausible-looking refactor of an unrelated file, is refused and handed to a human.
 */
export function scopeChanges(
  changes: readonly ProposedChange[],
  finding: Finding,
  input: ReviewInput,
  maxChangedFiles: number,
): { changes: ProposedChange[] } | { reason: string } {
  if (changes.length === 0)
    return { reason: 'The plan produced no file changes, so there is nothing to verify.' };
  if (changes.length > maxChangedFiles)
    return {
      reason: `The plan changes ${String(changes.length)} files, above the ${String(maxChangedFiles)} allowed for a narrow fix.`,
    };

  const scope = new Set(
    [...finding.files, ...(input.files ?? [])]
      .filter((path) => isRepositoryRelativePath(path))
      .map(normalizePath),
  );
  const accepted: ProposedChange[] = [];
  for (const change of changes) {
    if (!isRepositoryRelativePath(change.path))
      return { reason: `Change path is not inside the checkout: ${change.path}` };
    const path = normalizePath(change.path);
    if (!scope.has(path))
      return {
        reason: `Change to ${change.path} is outside the validated scope (${[...scope].join(', ')}).`,
      };
    accepted.push({ ...change, path });
  }
  return { changes: accepted };
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function describeFeedback(input: ReviewInput): string {
  const items = input.items?.length ?? 0;
  if (items === 0) return '1 feedback item';
  return `${String(items)} feedback item(s)`;
}

function summarizeFailures(failures: readonly CheckResult[]): string {
  const perCheck = Math.max(1, Math.floor(MAX_FAILURE_CONTEXT / failures.length));
  return failures
    .map((check) => `${check.command}\n${truncateTail(check.stderr || check.stdout, perCheck)}`)
    .join('\n\n');
}
