#!/usr/bin/env node
import { access, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AgentZero } from '@agent-zero/agent';
import {
  discoverChecks,
  knownLockfiles,
  loadConfig,
  mayModifyRepository,
} from '@agent-zero/config';
import {
  isModelConfigured,
  isSubscriptionModelProvider,
  isSubscriptionProviderEnabled,
  modelFromEnvironment,
  modelProviderCredentialKind,
  subscriptionProbeCommand,
  subscriptionProviderDescriptor,
  type SubscriptionModelProviderKind,
} from '@agent-zero/models';
import {
  createRunner,
  LocalRunner,
  runnerOptionsFromPolicy,
  type Runner,
} from '@agent-zero/runner';
import {
  evidenceFromResult,
  renderEvidenceMarkdown,
  version,
  type RunMode,
  type TaskResult,
} from '@agent-zero/shared';
import * as p from '@clack/prompts';

import { parseCliArguments } from './args.js';
import { claudeCodeProcessSpawner, environmentForModel } from './subscription-isolation.js';

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
    await runAgent(args.command, args.feedback, args.proactive, args.json);
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
      'zero review (--feedback <text> | --proactive) [--json]',
      'zero fix (--feedback <text> | --proactive) [--json]',
      'zero run (--feedback <text> | --proactive) [--json]',
    ].join('\n'),
    'Commands',
  );
  p.note(['0  concluded', '1  failed', '2  needs a human'].join('\n'), 'Exit codes');
  p.outro('Use --feedback or --proactive for non-interactive environments.');
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
  // Checkout inspection goes through the runner boundary like every other repository access. A
  // read-only local runner is used deliberately so doctor can still diagnose a checkout whose
  // container isolation is misconfigured.
  const inspector = new LocalRunner(cwd);
  const lockfiles: string[] = [];
  for (const lockfile of knownLockfiles)
    if (await inspector.exists(lockfile)) lockfiles.push(lockfile);
  const checks =
    config.checks.length > 0
      ? config.checks
      : discoverChecks({
          packageJson: await inspector.read('package.json').catch(() => null),
          lockfiles,
        });
  // Reflects the same refusal `runAgent` applies: under container isolation, claude-code is not
  // "configured" unless a container image for its CLI is also set, even if the enable flag is on.
  const modelEnvironment = environmentForModel(config, process.env);
  const modelConfigured = isModelConfigured(config.model.provider, modelEnvironment);
  const status = {
    node: process.version,
    gitRepository: await exists(join(cwd, '.git')),
    modelConfigured,
    modelProvider: config.model.provider,
    modelCredentialKind: modelProviderCredentialKind(config.model.provider),
    // Only probed once the operator opted this host in; an unset flag is already the answer, and
    // doctor must not be the thing that first spawns a vendor CLI.
    ...(isSubscriptionModelProvider(config.model.provider) && modelConfigured
      ? { modelCli: await probeSubscriptionCli(inspector, config.model.provider) }
      : {}),
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
  p.log.info(`Model provider: ${status.modelProvider} (${status.modelCredentialKind})`);
  if (!status.modelConfigured && isSubscriptionModelProvider(config.model.provider)) {
    if (
      config.model.provider === 'claude-code' &&
      config.runner.isolation === 'container' &&
      !process.env.AGENT_ZERO_CLAUDE_CODE_CONTAINER_IMAGE
    )
      p.log.warn(
        'Container isolation is required but no AGENT_ZERO_CLAUDE_CODE_CONTAINER_IMAGE is set, so claude-code is refused rather than run unisolated on the host.',
      );
    else
      p.log.warn(
        `Set ${subscriptionProviderDescriptor(config.model.provider).enableEnvironmentVariable}=true to enable this host's subscription session.`,
      );
  }
  if (status.modelCli) {
    logCheck(`${status.modelCli.executable} CLI installed`, status.modelCli.installed);
    if (!status.modelCli.installed)
      p.log.warn(
        `Install it and run \`${status.modelCli.loginCommand}\`, or point ${status.modelCli.pathVariable} at the executable.`,
      );
  }
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
  p.outro(
    status.gitRepository && status.modelConfigured && status.modelCli?.installed !== false
      ? 'Ready to run.'
      : 'Setup incomplete.',
  );
}

/**
 * Prove the vendor CLI is installed and runnable before a run depends on it.
 *
 * The probe goes through the runner like every other command execution, and asks only for a
 * version, so a diagnostic can never start a session or touch the checkout. It cannot tell whether
 * the session is still authenticated — only a real call can, and that failure is translated into
 * the matching `login` instruction by the models package.
 */
async function probeSubscriptionCli(
  inspector: Runner,
  provider: SubscriptionModelProviderKind,
): Promise<{
  executable: string;
  installed: boolean;
  pathVariable: string;
  loginCommand: string;
}> {
  const descriptor = subscriptionProviderDescriptor(provider);
  // The configured override itself, read the same way `subscriptionProbeCommand` resolves it
  // before quoting — not derived from the quoted command string below, which may wrap the path in
  // single or double quotes and can contain embedded spaces; splitting that string on the first
  // space would report a truncated, quote-mangled path instead of the real one.
  const executable = process.env[descriptor.executableEnvironmentVariable] ?? descriptor.executable;
  let command: string;
  try {
    command = subscriptionProbeCommand(provider, process.env);
  } catch {
    // An executable override that cannot be expressed as a single probe token (it contains both
    // quote characters) is not "installed" from doctor's point of view — report the same
    // diagnostic shape a failed probe would, rather than letting doctor itself throw and skip its
    // JSON document entirely.
    return {
      executable,
      installed: false,
      pathVariable: descriptor.executableEnvironmentVariable,
      loginCommand: descriptor.loginCommand,
    };
  }
  const result = await inspector.check(command, 15_000).catch(() => undefined);
  return {
    executable,
    installed: result?.exitCode === 0,
    pathVariable: descriptor.executableEnvironmentVariable,
    loginCommand: descriptor.loginCommand,
  };
}

async function runAgent(
  command: 'review' | 'fix' | 'run',
  providedFeedback: string | undefined,
  proactive: boolean,
  asJson: boolean,
): Promise<void> {
  const feedback = proactive
    ? undefined
    : (providedFeedback ?? (await promptForFeedback(command, asJson)));
  if (!proactive && feedback === undefined) return;

  const config = await loadConfig(cwd);
  const mode: RunMode = command === 'review' ? 'observe' : command === 'fix' ? 'fix' : config.mode;

  if (!asJson && providedFeedback !== undefined) p.intro(`Agent Zero · ${command}`);

  // The boundary is created read-only unless both the mode and repository policy allow writing, so
  // a mistake in the runtime cannot turn a review into an edit.
  const runner = createRunner(
    cwd,
    runnerOptionsFromPolicy(config, mayModifyRepository(config, mode)),
  );

  // Refuses claude-code under container isolation when no CLI container image is configured,
  // rather than silently spawning it unisolated on the host.
  const modelEnvironment = environmentForModel(config, process.env);
  const spawnClaudeCodeProcess =
    config.model.provider === 'claude-code' &&
    isSubscriptionProviderEnabled('claude-code', modelEnvironment)
      ? claudeCodeProcessSpawner(config, modelEnvironment)
      : undefined;

  const agent = new AgentZero({
    model: modelFromEnvironment(config.model, modelEnvironment, spawnClaudeCodeProcess),
    runner,
    config,
    onEvent: (event) => {
      if (asJson) console.error(`[${event.state}] ${event.message}`);
      else p.log.step(event.message);
    },
  });
  const result = await agent.run({
    repository: cwd,
    mode,
    trigger: proactive ? 'proactive' : 'feedback',
    ...(feedback === undefined ? {} : { feedback }),
  });

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
