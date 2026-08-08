#!/usr/bin/env node
import { access, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AgentZero } from '@agent-zero/agent';
import { loadConfig } from '@agent-zero/config';
import { modelFromEnvironment } from '@agent-zero/models';
import { LocalRunner } from '@agent-zero/runner';
import { version, type RunMode } from '@agent-zero/shared';
import * as p from '@clack/prompts';

import { parseCliArguments } from './args.js';

const cwd = process.cwd();

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
  const checks = {
    node: process.version,
    gitRepository: await exists(join(cwd, '.git')),
    modelConfigured: Boolean(process.env.OPENAI_API_KEY),
    mode: config.mode,
  };

  if (asJson) {
    console.log(JSON.stringify(checks, null, 2));
    return;
  }

  p.intro('Agent Zero · doctor');
  p.log.info(`Node ${checks.node}`);
  logCheck('Git repository', checks.gitRepository);
  logCheck('Model configured', checks.modelConfigured);
  p.log.info(`Mode: ${checks.mode}`);
  p.outro(checks.gitRepository && checks.modelConfigured ? 'Ready to run.' : 'Setup incomplete.');
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

  const agent = new AgentZero({
    model: modelFromEnvironment(config.model.name, config.model.baseUrl),
    runner: new LocalRunner(cwd),
    config,
    onEvent: (event) => {
      if (asJson) console.error(`[${event.state}] ${event.message}`);
      else p.log.step(event.message);
    },
  });
  const result = await agent.run({ repository: cwd, feedback, mode });

  if (asJson) console.log(JSON.stringify(result, null, 2));
  else {
    p.note(JSON.stringify(result, null, 2), 'Result');
    if (result.state === 'failed') p.cancel('Run failed.');
    else p.outro('Run completed.');
  }

  if (result.state === 'failed') process.exitCode = 1;
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
