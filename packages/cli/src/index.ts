#!/usr/bin/env node
import { access, copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AgentZero } from '@agent-zero/agent';
import {
  discoverChecks,
  knownLockfiles,
  loadConfig,
  mayModifyRepository,
} from '@agent-zero/config';
import { modelFromEnvironment } from '@agent-zero/models';
import { createRunner, runnerOptionsFromPolicy } from '@agent-zero/runner';
import {
  evidenceFromResult,
  renderEvidenceMarkdown,
  version,
  type RunMode,
  type TaskResult,
} from '@agent-zero/shared';
import * as p from '@clack/prompts';

import { parseCliArguments } from './args.js';

const cwd = process.cwd();

/**
 * Exit codes are part of the contract.
 *
 * `0` means the run reached a clean conclusion, `1` means it failed, and `2` means a human has to
 * look. A run whose verification did not pass never exits `0`, so CI cannot mistake it for success.
 */
const exitCodes = { completed: 0, failed: 1, 'needs-human': 2 } as const;

await main().catch((error: unknown) => {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const args = parseCliArguments(process.argv.slice(2));

  if (args.version) {
    console.log(version);
    return;
  }

  if (args.help || args.command === 'help') {
    showHelp();
    return;
  }

  if (args.command === 'init') {
    await initializeProject();
    return;
  }

  if (args.command === 'doctor') {
    await runDoctor(args.json);
    return;
  }

  if (args.command === 'review' || args.command === 'fix' || args.command === 'run') {
    await runAgent(args.command, args.feedback, args.json);
    return;
  }

  throw new Error(
    `Unknown command: ${args.command}. Run zero --help to see the available commands.`,
  );
}

function showHelp(): void {
  p.intro(`Agent Zero v${version}`);
  p.note(
    [
      'zero init',
      'zero --version',
      'zero doctor [--json]',
      'zero review [--feedback <text>] [--json]',
      'zero fix [--feedback <text>] [--json]',
      'zero run [--feedback <text>] [--json]',
    ].join('\n'),
    'Commands',
  );
  p.note(['0  concluded', '1  failed', '2  needs a human'].join('\n'), 'Exit codes');
  p.outro('Use --feedback for non-interactive environments.');
}

async function initializeProject(): Promise<void> {
  p.intro('Agent Zero · init');
  const target = join(cwd, '.agent-zero.yml');

  if (await exists(target)) {
    throw new Error('.agent-zero.yml already exists');
  }

  await copyFile(join(import.meta.dirname, '../../../.agent-zero.example.yml'), target);
  p.log.success(`Created ${target}`);
  p.outro('Configuration ready.');
}

async function runDoctor(asJson: boolean): Promise<void> {
  const config = await loadConfig(cwd);
  const lockfiles: string[] = [];
  for (const lockfile of knownLockfiles)
    if (await exists(join(cwd, lockfile))) lockfiles.push(lockfile);
  const checks =
    config.checks.length > 0
      ? config.checks
      : discoverChecks({ packageJson: await readOptional(join(cwd, 'package.json')), lockfiles });
  const status = {
    node: process.version,
    gitRepository: await exists(join(cwd, '.git')),
    modelConfigured: Boolean(process.env.OPENAI_API_KEY),
    mode: config.mode,
    isolation: config.runner.isolation,
    network: config.permissions.network,
    checks,
  };

  if (asJson) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  p.intro('Agent Zero · doctor');
  p.log.info(`Node ${status.node}`);
  logCheck('Git repository', status.gitRepository);
  logCheck('Model configured', status.modelConfigured);
  logCheck(
    `Isolated runner (${status.isolation}, network ${status.network})`,
    status.isolation === 'container',
  );
  logCheck(
    checks.length > 0
      ? `Verification checks: ${checks.join(', ')}`
      : 'No verification checks found',
    checks.length > 0,
  );
  p.log.info(`Mode: ${status.mode}`);
  p.outro(status.gitRepository && status.modelConfigured ? 'Ready to run.' : 'Setup incomplete.');
}

async function runAgent(
  command: 'review' | 'fix' | 'run',
  providedFeedback: string | undefined,
  asJson: boolean,
): Promise<void> {
  const feedback = providedFeedback ?? (await promptForFeedback(command, asJson));
  if (feedback === undefined) return;

  const config = await loadConfig(cwd);
  const mode: RunMode = command === 'review' ? 'observe' : command === 'fix' ? 'fix' : config.mode;

  if (!asJson && providedFeedback !== undefined) p.intro(`Agent Zero · ${command}`);

  // The boundary is created read-only unless both the mode and repository policy allow writing, so
  // a mistake in the runtime cannot turn a review into an edit.
  const runner = createRunner(
    cwd,
    runnerOptionsFromPolicy(config, mayModifyRepository(config, mode)),
  );

  const agent = new AgentZero({
    model: modelFromEnvironment(config.model.name, config.model.baseUrl),
    runner,
    config,
    onEvent: (event) => {
      if (asJson) console.error(`[${event.state}] ${event.message}`);
      else p.log.step(event.message);
    },
  });
  const result = await agent.run({ repository: cwd, feedback, mode });

  if (asJson) console.log(JSON.stringify(result, null, 2));
  else report(result, mode);

  process.exitCode = exitCodes[result.state];
}

function report(result: TaskResult, mode: RunMode): void {
  p.note(renderEvidenceMarkdown(evidenceFromResult(result, { mode })), 'Evidence');
  if (result.state === 'failed') p.cancel(result.summary);
  else if (result.state === 'needs-human') p.log.warn(result.summary);
  else p.outro(result.summary);
}

async function promptForFeedback(
  command: 'review' | 'fix' | 'run',
  asJson: boolean,
): Promise<string | undefined> {
  if (asJson || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Missing --feedback <text> in a non-interactive environment');
  }

  p.intro(`Agent Zero · ${command}`);
  const feedback = await p.text({
    message: 'What should Agent Zero work on?',
    placeholder: 'Describe the feedback or requested change',
    validate: (value) => ((value ?? '').trim().length === 0 ? 'Feedback is required.' : undefined),
  });

  if (p.isCancel(feedback) || feedback === undefined) {
    p.cancel('Operation cancelled.');
    return undefined;
  }

  return feedback.trim();
}

function logCheck(label: string, passed: boolean): void {
  if (passed) p.log.success(label);
  else p.log.warn(label);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}
