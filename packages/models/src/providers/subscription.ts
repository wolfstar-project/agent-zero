import { access, constants } from 'node:fs/promises';
import { delimiter, join, sep } from 'node:path';

import {
  truncateTail,
  type ModelProviderCredentialKind,
  type ModelProviderKind,
} from '@agent-zero/shared';
import { APICallError, type LanguageModel } from 'ai';

/**
 * Model transports that spawn a locally authenticated vendor CLI instead of calling a metered API.
 *
 * These carry no credential Agent Zero can read, rotate, or redact: the session lives in the CLI's
 * own on-disk state, established interactively by the operator. That makes them single-tenant by
 * construction, which is why they stay behind an explicit operator flag.
 */
export type SubscriptionModelProviderKind = 'claude-code' | 'codex-cli';

export interface SubscriptionProviderDescriptor {
  /** Operator flag that must be exactly `true` before the CLI may be spawned. */
  enableEnvironmentVariable: string;
  /** Operator override used when the CLI is not on `PATH`. */
  executableEnvironmentVariable: string;
  /** Executable resolved from `PATH` when no override is set. */
  executable: string;
  /** Command an operator runs to re-establish the CLI session. */
  loginCommand: string;
  /** Flag that makes the CLI prove it is runnable and exit. Never starts a session. */
  probeArgument: string;
}

const descriptors = {
  'claude-code': {
    enableEnvironmentVariable: 'AGENT_ZERO_ENABLE_CLAUDE_CODE_PROVIDER',
    executableEnvironmentVariable: 'AGENT_ZERO_CLAUDE_CODE_PATH',
    executable: 'claude',
    loginCommand: 'claude login',
    probeArgument: '--version',
  },
  'codex-cli': {
    enableEnvironmentVariable: 'AGENT_ZERO_ENABLE_CODEX_CLI_PROVIDER',
    executableEnvironmentVariable: 'AGENT_ZERO_CODEX_PATH',
    executable: 'codex',
    loginCommand: 'codex login',
    probeArgument: '--version',
  },
} as const satisfies Record<SubscriptionModelProviderKind, SubscriptionProviderDescriptor>;

/**
 * A subscription transport that cannot serve this run.
 *
 * Raised for the two failures an operator can actually fix — the CLI is missing, or its session
 * expired — so the message names the command instead of surfacing a spawn or protocol error.
 */
export class SubscriptionProviderUnavailableError extends Error {
  readonly provider: SubscriptionModelProviderKind;

  constructor(provider: SubscriptionModelProviderKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SubscriptionProviderUnavailableError';
    this.provider = provider;
  }
}

export function isSubscriptionModelProvider(
  provider: ModelProviderKind,
): provider is SubscriptionModelProviderKind {
  return provider === 'claude-code' || provider === 'codex-cli';
}

export function modelProviderCredentialKind(
  provider: ModelProviderKind,
): ModelProviderCredentialKind {
  return isSubscriptionModelProvider(provider) ? 'subscription' : 'api-key';
}

export function subscriptionProviderDescriptor(
  provider: SubscriptionModelProviderKind,
): SubscriptionProviderDescriptor {
  return descriptors[provider];
}

/**
 * Whether the operator opted this host into spawning the vendor CLI.
 *
 * The comparison is exact so an unset, empty, or accidentally truthy value ("0", "false") leaves
 * the provider off: a CI runner that never installed the CLI must not start subprocesses.
 */
export function isSubscriptionProviderEnabled(
  provider: SubscriptionModelProviderKind,
  environment: NodeJS.ProcessEnv,
): boolean {
  return environment[descriptors[provider].enableEnvironmentVariable] === 'true';
}

/**
 * The command that proves the CLI is installed and runnable.
 *
 * Returned rather than executed: `packages/models` never spawns anything itself, so a composition
 * root runs this through the runner boundary like every other command.
 */
export function subscriptionProbeCommand(
  provider: SubscriptionModelProviderKind,
  environment: NodeJS.ProcessEnv,
): string {
  const descriptor = descriptors[provider];
  const executable = environment[descriptor.executableEnvironmentVariable] ?? descriptor.executable;
  // An override is an operator-supplied absolute path, so quote it: the runner tokenizes the
  // command itself and a directory containing a space would otherwise split into two arguments.
  const program = WHITESPACE.test(executable) ? `"${executable}"` : executable;
  return `${program} ${descriptor.probeArgument}`;
}

const WHITESPACE = /\s/u;

/**
 * Build the language model lazily.
 *
 * The vendor SDKs are several megabytes and are irrelevant to every run that uses an API-key
 * transport, so they are imported on first use rather than at module load.
 */
export function subscriptionLanguageModel(
  provider: SubscriptionModelProviderKind,
  model: string,
  environment: NodeJS.ProcessEnv,
): () => Promise<LanguageModel> {
  const executable = environment[descriptors[provider].executableEnvironmentVariable];
  return async () => {
    await assertExecutableResolves(provider, executable, environment);
    return provider === 'claude-code'
      ? claudeCodeLanguageModel(model, executable)
      : codexCliLanguageModel(model, executable);
  };
}

/**
 * Refuse the transport before the vendor SDK tries to spawn a CLI that is not there.
 *
 * This is not defensive tidiness. `ai-sdk-provider-codex-cli@2` throws its spawn failure from a
 * `child.on('error')` handler, so an `ENOENT` never reaches the awaited promise and takes the host
 * process down as an uncaught exception instead — a misconfigured `model.provider` would stop the
 * control plane rather than fail one run. Resolving the executable first turns that into an
 * ordinary, actionable error.
 *
 * Looking up an executable is not repository access: it reads `PATH`, never a checkout, and starts
 * no process, so it does not belong behind the runner boundary.
 */
async function assertExecutableResolves(
  provider: SubscriptionModelProviderKind,
  override: string | undefined,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const descriptor = descriptors[provider];
  const executable = override ?? descriptor.executable;
  const candidates =
    executable.includes(sep) || executable.includes('/')
      ? [executable]
      : (environment.PATH ?? '')
          .split(delimiter)
          .filter(Boolean)
          .map((entry) => join(entry, executable));
  // An empty PATH with no override leaves nothing to check; let the spawn decide rather than
  // refusing a transport this cannot actually rule out.
  if (candidates.length === 0) return;
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return;
    } catch {
      continue;
    }
  }
  throw new SubscriptionProviderUnavailableError(
    provider,
    `The ${executable} CLI is not installed or not on PATH. Install it, or set ${descriptor.executableEnvironmentVariable} to its absolute path.`,
  );
}

async function claudeCodeLanguageModel(
  model: string,
  executable: string | undefined,
): Promise<LanguageModel> {
  const { createClaudeCode } = await import('ai-sdk-provider-claude-code');
  return createClaudeCode({
    defaultSettings: {
      // Agent Zero owns every repository read and write through the runner boundary. Disabling the
      // CLI's built-in tools and every MCP server keeps it a text generator: it cannot read outside
      // the supplied context, and it cannot edit a checkout behind the runner's back. The provider
      // already pins `settingSources: []`, so nothing on disk can add tools back.
      tools: [],
      mcpServers: {},
      permissionMode: 'default',
      ...(executable ? { pathToClaudeCodeExecutable: executable } : {}),
    },
  })(model);
}

async function codexCliLanguageModel(
  model: string,
  executable: string | undefined,
): Promise<LanguageModel> {
  const { createCodexCli } = await import('ai-sdk-provider-codex-cli');
  return createCodexCli({
    defaultSettings: {
      // Same boundary as Claude Code: read-only sandbox, no MCP tools, no approval prompts to
      // answer, and no dependency on the process happening to sit inside a Git checkout.
      sandboxMode: 'read-only',
      approvalMode: 'never',
      mcpServers: {},
      skipGitRepoCheck: true,
      webSearch: false,
      ...(executable ? { codexPath: executable } : {}),
    },
  })(model);
}

/**
 * Rewrite the failures an operator can act on.
 *
 * `message` arrives already redacted; anything this returns is published in the same places, so it
 * only ever adds text this module wrote itself.
 */
export function translateSubscriptionError(
  provider: SubscriptionModelProviderKind,
): (error: unknown, message: string) => Promise<Error | undefined> {
  const descriptor = descriptors[provider];
  return async (error, message) => {
    // Already stated in operator terms by the pre-spawn check; re-wrapping would bury it.
    if (error instanceof SubscriptionProviderUnavailableError) return error;
    if (isMissingExecutable(error))
      return new SubscriptionProviderUnavailableError(
        provider,
        `The ${descriptor.executable} CLI is not installed or not on PATH. Install it, or set ${descriptor.executableEnvironmentVariable} to its absolute path.\n${message}`,
        { cause: error },
      );
    if (await isSessionExpired(provider, error))
      return new SubscriptionProviderUnavailableError(
        provider,
        `The ${descriptor.executable} CLI session is not authenticated. Run \`${descriptor.loginCommand}\` on this host.\n${message}`,
        { cause: error },
      );
    return undefined;
  };
}

/**
 * Both vendor packages ship an `isAuthenticationError` predicate; ask it first, since it is the
 * only stable contract. It is not sufficient on its own: the Codex predicate reads a structured
 * error code the CLI does not always set, so a genuinely expired session can arrive as a bare
 * non-zero exit whose only evidence is the stderr the transport captured.
 *
 * Reaching here means a call was already attempted, so the dynamic import resolves from cache —
 * unless that import is itself what failed, in which case the original error is the useful one and
 * must not be replaced by a second import failure.
 */
async function isSessionExpired(
  provider: SubscriptionModelProviderKind,
  error: unknown,
): Promise<boolean> {
  try {
    const { isAuthenticationError } =
      provider === 'claude-code'
        ? await import('ai-sdk-provider-claude-code')
        : await import('ai-sdk-provider-codex-cli');
    if (isAuthenticationError(error)) return true;
  } catch {
    return false;
  }
  return AUTHENTICATION_STDERR.test(providerStderr(error));
}

/**
 * Phrases that only an authentication failure produces.
 *
 * Deliberately narrow: a false positive would tell an operator to log in again while the real
 * fault was something else, and would hand a run to the fallback transport for a reason that
 * fallback cannot fix. A bare `401` is not enough, because a CLI echoes upstream status codes for
 * failures that have nothing to do with its own session.
 */
const AUTHENTICATION_STDERR =
  /token[_ ]expired|invalid[_ ]api[_ ]key|401 unauthorized|not (?:logged in|authenticated)|(?:run|use) `?(?:claude|codex) login/iu;

/**
 * The diagnostics a CLI-backed transport captured from the subprocess.
 *
 * A CLI reports why it exited on stderr, not in an HTTP body, so without this an expired session
 * reaches an operator as nothing but "exited with code 1". Callers fold it into the same redacted
 * detail as a response body; it is never surfaced raw.
 */
export function providerStderr(error: unknown): string {
  if (!APICallError.isInstance(error)) return '';
  const data: unknown = error.data;
  if (typeof data !== 'object' || data === null || !('stderr' in data)) return '';
  const { stderr } = data;
  return typeof stderr === 'string' ? truncateTail(stderr, MAX_PROVIDER_STDERR) : '';
}

const MAX_PROVIDER_STDERR = 4_000;

/** A spawn that never produced a process, however deep the vendor SDK wrapped it. */
function isMissingExecutable(error: unknown): boolean {
  for (let current = error, depth = 0; current !== undefined && depth < 8; depth += 1) {
    if (typeof current !== 'object' || current === null) return false;
    if ((current as { code?: unknown }).code === 'ENOENT') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
