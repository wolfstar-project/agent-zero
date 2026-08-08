import type { AgentZeroConfig } from '@agent-zero/config';
import type { ModelProvider } from '@agent-zero/models';
import type { Runner } from '@agent-zero/runner';
import {
  now,
  taskId,
  type CheckResult,
  type Finding,
  type ReviewInput,
  type TaskEvent,
  type TaskResult,
  type TaskState,
} from '@agent-zero/shared';

export interface AgentDependencies {
  model: ModelProvider;
  runner: Runner;
  config: AgentZeroConfig;
  onEvent?: (event: TaskEvent) => void;
}

export class AgentZero {
  constructor(private readonly dependencies: AgentDependencies) {}

  async run(input: ReviewInput): Promise<TaskResult> {
    const id = taskId();
    const events: TaskEvent[] = [];
    const checks: CheckResult[] = [];
    const emit = (state: TaskState, message: string, attempt?: number): void => {
      const event: TaskEvent = {
        state,
        message,
        timestamp: now(),
        ...(attempt === undefined ? {} : { attempt }),
      };
      events.push(event);
      this.dependencies.onEvent?.(event);
    };
    try {
      emit('discovering', 'Collecting repository files and diff');
      const repositoryContext = await this.dependencies.runner.context();
      emit('understanding', 'Interpreting review feedback in repository context');
      emit('validating', 'Validating the claim and gathering evidence');
      let previousFailure: string | undefined;
      let finding: Finding | null = null;
      for (let attempt = 1; attempt <= this.dependencies.config.agent.maxAttempts; attempt++) {
        emit('planning', 'Producing an evidence-backed plan', attempt);
        const decision = await this.dependencies.model.decide({
          input,
          repositoryContext,
          ...(previousFailure ? { previousFailure } : {}),
        });
        finding = { id: `${id}_finding`, ...decision.finding };
        if (!finding.valid)
          return finish(
            id,
            'needs-human',
            finding,
            checks,
            [],
            events,
            'Feedback could not be validated; no files changed.',
          );
        const mayWrite = input.mode === 'fix' || input.mode === 'autonomous';
        const policyAllows =
          this.dependencies.config.autofix.enabled &&
          finding.confidence >= this.dependencies.config.autofix.minConfidence;
        if (!mayWrite || !policyAllows)
          return finish(
            id,
            'completed',
            finding,
            checks,
            [],
            events,
            'Validated finding reported without modifying files.',
          );
        emit('executing', `Applying ${decision.changes.length} planned change(s)`, attempt);
        for (const change of decision.changes)
          await this.dependencies.runner.write(change.path, change.content);
        emit(
          'verifying',
          `Running ${this.dependencies.config.checks.length} repository check(s)`,
          attempt,
        );
        checks.length = 0;
        for (const command of this.dependencies.config.checks)
          checks.push(
            await this.dependencies.runner.check(command, this.dependencies.config.agent.timeoutMs),
          );
        const failures = checks.filter((check) => check.exitCode !== 0);
        if (failures.length === 0) {
          emit('reviewing', 'Inspecting the final changed-file set');
          const changedFiles = await this.dependencies.runner.changedFiles();
          emit('completed', 'All configured checks passed');
          return finish(
            id,
            'completed',
            finding,
            checks,
            changedFiles,
            events,
            `Fixed and verified: ${finding.title}`,
          );
        }
        previousFailure = failures
          .map((check) => `${check.command}\n${check.stderr || check.stdout}`)
          .join('\n\n');
      }
      emit('needs-human', 'Repair budget exhausted');
      return finish(
        id,
        'needs-human',
        finding,
        checks,
        await this.dependencies.runner.changedFiles(),
        events,
        'Verification still fails after the configured repair budget.',
      );
    } catch (error) {
      emit('failed', error instanceof Error ? error.message : String(error));
      return finish(
        id,
        'failed',
        null,
        checks,
        [],
        events,
        'Task failed before a verified result was produced.',
      );
    }
  }
}

function finish(
  id: string,
  state: TaskResult['state'],
  finding: Finding | null,
  checks: CheckResult[],
  changedFiles: string[],
  events: TaskEvent[],
  summary: string,
): TaskResult {
  return { id, state, finding, checks: [...checks], changedFiles, events, summary };
}
