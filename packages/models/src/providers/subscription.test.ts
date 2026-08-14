import { APICallError } from 'ai';
import { describe, expect, it } from 'vitest';

import {
  isSubscriptionModelProvider,
  isSubscriptionProviderEnabled,
  modelProviderCredentialKind,
  providerStderr,
  subscriptionLanguageModel,
  subscriptionProbeCommand,
  subscriptionProviderDescriptor,
  SubscriptionProviderUnavailableError,
  translateSubscriptionError,
} from './subscription.js';

/** The shape a CLI-backed transport raises when its subprocess exits non-zero. */
function cliExit(stderr: string): APICallError {
  return new APICallError({
    message: 'Codex CLI exited with code 1',
    url: 'codex-cli://exec',
    requestBodyValues: {},
    data: { exitCode: 1, stderr },
  });
}

describe('modelProviderCredentialKind', () => {
  it('separates CLI-backed transports from metered ones', () => {
    expect(modelProviderCredentialKind('claude-code')).toBe('subscription');
    expect(modelProviderCredentialKind('codex-cli')).toBe('subscription');
    for (const provider of [
      'ai-gateway',
      'anthropic',
      'google',
      'openai',
      'openai-compatible',
    ] as const)
      expect(modelProviderCredentialKind(provider)).toBe('api-key');
  });

  it('agrees with the type guard', () => {
    expect(isSubscriptionModelProvider('claude-code')).toBe(true);
    expect(isSubscriptionModelProvider('anthropic')).toBe(false);
  });
});

describe('isSubscriptionProviderEnabled', () => {
  it('spawns a CLI only for an exact opt-in', () => {
    const flag = subscriptionProviderDescriptor('claude-code').enableEnvironmentVariable;
    expect(isSubscriptionProviderEnabled('claude-code', { [flag]: 'true' })).toBe(true);
    for (const value of ['', '1', 'TRUE', 'yes', 'false', ' true'])
      expect(isSubscriptionProviderEnabled('claude-code', { [flag]: value })).toBe(false);
    expect(isSubscriptionProviderEnabled('claude-code', {})).toBe(false);
  });

  it('gates each provider on its own flag', () => {
    const claude = subscriptionProviderDescriptor('claude-code').enableEnvironmentVariable;
    expect(isSubscriptionProviderEnabled('codex-cli', { [claude]: 'true' })).toBe(false);
  });
});

describe('subscriptionProbeCommand', () => {
  it('probes the PATH executable and only asks it for a version', () => {
    expect(subscriptionProbeCommand('claude-code', {})).toBe('claude --version');
    expect(subscriptionProbeCommand('codex-cli', {})).toBe('codex --version');
  });

  it('quotes an operator override so a path with spaces stays one argument', () => {
    expect(subscriptionProbeCommand('codex-cli', { AGENT_ZERO_CODEX_PATH: '/opt/bin/codex' })).toBe(
      '/opt/bin/codex --version',
    );
    expect(
      subscriptionProbeCommand('codex-cli', { AGENT_ZERO_CODEX_PATH: '/opt/my tools/codex' }),
    ).toBe('"/opt/my tools/codex" --version');
  });
});

describe('subscriptionLanguageModel', () => {
  // `ai-sdk-provider-codex-cli@2` throws its spawn ENOENT from a `child.on('error')` handler, so
  // it escapes the awaited promise and kills the process. Resolving the executable first is what
  // keeps a misconfigured provider from taking the control plane down with it.
  it('refuses a missing executable instead of letting the vendor SDK spawn it', async () => {
    const build = subscriptionLanguageModel('codex-cli', 'gpt-5.2-codex', {
      AGENT_ZERO_CODEX_PATH: '/nonexistent/codex',
    });
    await expect(build()).rejects.toBeInstanceOf(SubscriptionProviderUnavailableError);
    await expect(build()).rejects.toThrow('not installed or not on PATH');
  });

  it('refuses a name that resolves nowhere on PATH', async () => {
    const build = subscriptionLanguageModel('claude-code', 'opus', { PATH: '/nonexistent/bin' });
    await expect(build()).rejects.toThrow('not installed or not on PATH');
  });

  it('accepts an executable that exists and is runnable', async () => {
    // `node` is guaranteed present wherever this suite runs, and is never spawned here: the
    // factory only builds the model.
    const build = subscriptionLanguageModel('claude-code', 'opus', {
      AGENT_ZERO_CLAUDE_CODE_PATH: process.execPath,
    });
    await expect(build()).resolves.toBeDefined();
  });
});

describe('translateSubscriptionError', () => {
  it('names the install fix when the CLI is not on PATH', async () => {
    const spawnFailure = Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' });
    const translated = await translateSubscriptionError('codex-cli')(
      new Error('wrapped', { cause: spawnFailure }),
      'redacted detail',
    );
    expect(translated).toBeInstanceOf(SubscriptionProviderUnavailableError);
    expect(translated?.message).toContain('codex CLI is not installed');
    expect(translated?.message).toContain('AGENT_ZERO_CODEX_PATH');
    expect(translated?.message).toContain('redacted detail');
  });

  it('names the login command when the session expired', async () => {
    // The vendor predicate is the contract, so build the shape it recognizes rather than a
    // message this test invented.
    const { createAuthenticationError } = await import('ai-sdk-provider-claude-code');
    const translated = await translateSubscriptionError('claude-code')(
      createAuthenticationError({ message: 'not logged in' }),
      'redacted detail',
    );
    expect(translated).toBeInstanceOf(SubscriptionProviderUnavailableError);
    expect(translated?.message).toContain('claude login');
  });

  it('recognizes an expired session the vendor predicate misses', async () => {
    // Captured from a real expired `codex login`: the CLI exits non-zero with no structured error
    // code, which is exactly the shape `isAuthenticationError` returns false for.
    const translated = await translateSubscriptionError('codex-cli')(
      cliExit(
        'failed to refresh available models: unexpected status 401 Unauthorized: Provided authentication token is expired.\nauth error code: token_expired\n',
      ),
      'redacted detail',
    );
    expect(translated).toBeInstanceOf(SubscriptionProviderUnavailableError);
    expect(translated?.message).toContain('codex login');
  });

  it('leaves every other failure to the default error path', async () => {
    expect(
      await translateSubscriptionError('claude-code')(new Error('rate limited'), 'detail'),
    ).toBeUndefined();
  });

  it('does not blame the session for an upstream failure that merely mentions a status', async () => {
    // Also captured live: a model the account cannot use. Telling an operator to log in again
    // here would send them to fix the one thing that is not broken.
    expect(
      await translateSubscriptionError('codex-cli')(
        cliExit(
          '{"type":"error","status":400,"error":{"message":"The \'gpt-5.2-codex\' model is not supported when using Codex with a ChatGPT account."}}',
        ),
        'detail',
      ),
    ).toBeUndefined();
  });

  it('reads stderr only from the transport, never from an arbitrary error', () => {
    expect(providerStderr(new Error('spawn failed'))).toBe('');
    expect(providerStderr(cliExit('boom'))).toBe('boom');
  });

  it('keeps the tail of an overlong stderr, where the failure is reported', () => {
    const stderr = `${'noise\n'.repeat(2_000)}auth error code: token_expired`;
    const captured = providerStderr(cliExit(stderr));
    expect(captured).toContain('token_expired');
    expect(captured).toContain('[truncated');
    expect(captured.length).toBeLessThan(stderr.length);
  });

  it('stops walking a self-referential cause chain', async () => {
    const looping: { cause?: unknown } = {};
    looping.cause = looping;
    expect(await translateSubscriptionError('codex-cli')(looping, 'detail')).toBeUndefined();
  });
});
