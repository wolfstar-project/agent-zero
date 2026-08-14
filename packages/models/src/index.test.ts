import type { AgentDecision, ReviewInput } from '@agent-zero/shared';
import { describe, expect, it } from 'vitest';

import {
  AISdkModelProvider,
  FallbackModelProvider,
  isModelConfigured,
  isAgentDecision,
  modelCredentialEnvironmentVariables,
  modelFromEnvironment,
  OpenAICompatibleProvider,
  renderPrompt,
  SubscriptionProviderUnavailableError,
  UnconfiguredModelProvider,
  type ModelContext,
  type ModelProvider,
} from './index.js';

const decision: AgentDecision = {
  finding: {
    title: 'Null return',
    explanation: 'load() returns null.',
    severity: 'high',
    confidence: 0.9,
    valid: true,
    evidence: ['`return null;`'],
    files: ['src/user.ts'],
  },
  changeRisk: 'mechanical',
  plan: ['Guard the null return'],
  changes: [{ path: 'src/user.ts', content: 'export const load = () => ({});\n', reason: 'guard' }],
};

const REDACTED_MARKER = /\[redacted]/;
const INCOMPLETE_FALLBACK = /must be set together/;
const SUBSCRIPTION_FALLBACK = /must be an API-key provider/;
const UNKNOWN_FALLBACK = /Invalid AGENT_ZERO_MODEL_FALLBACK_PROVIDER/;

const input: ReviewInput = {
  repository: '/checkout',
  feedback: 'load() can return null',
  mode: 'observe',
};

function context(overrides: Partial<ModelContext> = {}): ModelContext {
  return { input, repositoryContext: 'FILES\nsrc/user.ts\n\nDIFF\n', ...overrides };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function chatResponse(
  content: string,
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
): Response {
  return jsonResponse({
    choices: [{ message: { content }, finish_reason: 'stop' }],
    ...(usage ? { usage } : {}),
  });
}

describe('renderPrompt', () => {
  it('fences untrusted feedback instead of concatenating it into instructions', () => {
    const prompt = renderPrompt(context());
    expect(prompt).toContain('<untrusted-review-feedback>');
    expect(prompt).toContain('load() can return null');
    expect(prompt.indexOf('<repository-context>')).toBeLessThan(
      prompt.indexOf('<untrusted-review-feedback>'),
    );
  });

  it('renders structured review items with their author and location', () => {
    const prompt = renderPrompt(
      context({
        input: {
          ...input,
          items: [
            {
              id: '1',
              kind: 'review-comment',
              body: 'This can be null',
              author: 'alice',
              requestedChanges: true,
              path: 'src/user.ts',
              line: 2,
            },
          ],
        },
      }),
    );
    expect(prompt).toContain('[review-comment (changes requested) by alice on src/user.ts:2]');
  });

  it('requests independent diff analysis without inventing feedback for a proactive review', () => {
    const prompt = renderPrompt(
      context({ input: { repository: '/checkout', mode: 'observe', trigger: 'proactive' } }),
    );
    expect(prompt).toContain('<review-trigger>');
    expect(prompt).toContain('inspect the supplied pull-request or working-tree diff');
    expect(prompt).not.toContain('<untrusted-review-feedback>');
  });

  it('includes the previous failure only when repairing', () => {
    expect(renderPrompt(context())).not.toContain('<previous-verification-failure>');
    expect(renderPrompt(context({ previousFailure: 'assertion failed' }))).toContain(
      'assertion failed',
    );
  });

  it('never sends a credential to the provider', () => {
    const prompt = renderPrompt(
      context({ repositoryContext: 'export const token = "ghp_0123456789abcdefghijklmnop";' }),
    );
    expect(prompt).not.toContain('ghp_0123456789');
  });
});

describe('OpenAICompatibleProvider', () => {
  it('returns a decision that matches the expected shape', async () => {
    const provider = new OpenAICompatibleProvider({
      apiKey: 'test-key-value',
      model: 'gpt-5',
      fetch: async () => chatResponse(JSON.stringify(decision)),
    });
    await expect(provider.decide(context())).resolves.toMatchObject({
      ...decision,
      usage: {
        provider: 'openai-compatible',
        model: 'gpt-5',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
      },
    });
  });

  it('sends the key as a bearer header and nothing else', async () => {
    let seen: RequestInit | undefined;
    const provider = new OpenAICompatibleProvider({
      apiKey: 'test-key-value',
      model: 'gpt-5',
      baseUrl: 'https://example.invalid/v1',
      fetch: async (_url, init) => {
        seen = init;
        return chatResponse(JSON.stringify(decision));
      },
    });
    await provider.decide(context());
    expect(seen?.body).not.toContain('test-key-value');
    expect(seen?.signal).toBeDefined();
  });

  it('records provider usage and computes cost only from configured rates', async () => {
    const provider = new OpenAICompatibleProvider({
      apiKey: 'test-key-value',
      model: 'gpt-5',
      inputCostPerMillionTokens: 2,
      outputCostPerMillionTokens: 10,
      fetch: async () =>
        chatResponse(JSON.stringify(decision), {
          prompt_tokens: 1_000,
          completion_tokens: 500,
          total_tokens: 1_500,
        }),
    });
    await expect(provider.decide(context())).resolves.toMatchObject({
      usage: {
        inputTokens: 1_000,
        outputTokens: 500,
        totalTokens: 1_500,
        costUsd: 0.007,
      },
    });
  });

  it('rejects output that does not match the decision contract', async () => {
    const provider = new OpenAICompatibleProvider({
      apiKey: 'test-key-value',
      model: 'gpt-5',
      fetch: async () => chatResponse('{"finding":{"title":"x"}}'),
    });
    await expect(provider.decide(context())).rejects.toThrow('invalid decision');
  });

  it('rejects output that is not JSON at all', async () => {
    const provider = new OpenAICompatibleProvider({
      apiKey: 'test-key-value',
      model: 'gpt-5',
      fetch: async () => chatResponse('sure thing!'),
    });
    await expect(provider.decide(context())).rejects.toThrow('not valid JSON');
  });

  it('redacts a failing response body before it becomes an error', async () => {
    const provider = new OpenAICompatibleProvider({
      apiKey: 'test-key-value',
      model: 'gpt-5',
      fetch: async () =>
        new Response('rejected authorization: Bearer ghp_0123456789abcdefghijkl', { status: 401 }),
    });
    await expect(provider.decide(context())).rejects.toThrow(REDACTED_MARKER);
  });
});

describe('UnconfiguredModelProvider', () => {
  it('reports the feedback as unvalidated instead of inventing a finding', async () => {
    const result = await new UnconfiguredModelProvider().decide(context());
    expect(result.finding.valid).toBe(false);
    expect(result.finding.confidence).toBe(0);
    expect(result.changes).toEqual([]);
  });
});

describe('modelFromEnvironment', () => {
  it('selects each native provider with its dedicated credential', () => {
    const cases = [
      ['ai-gateway', 'AI_GATEWAY_API_KEY'],
      ['anthropic', 'ANTHROPIC_API_KEY'],
      ['google', 'GOOGLE_GENERATIVE_AI_API_KEY'],
      ['openai', 'OPENAI_API_KEY'],
      ['openai-compatible', 'OPENAI_COMPATIBLE_API_KEY'],
    ] as const;

    for (const [provider, key] of cases) {
      const configured = modelFromEnvironment(
        { provider, name: 'test-model' },
        { [key]: 'test-key-value' },
      );
      expect(configured).toBeInstanceOf(AISdkModelProvider);
      expect(configured).toMatchObject({ provider, model: 'test-model' });
    }
  });

  it('preserves OPENAI_API_KEY compatibility for openai-compatible endpoints', () => {
    expect(
      modelFromEnvironment(
        { provider: 'openai-compatible', name: 'legacy-model' },
        { OPENAI_API_KEY: 'legacy-key-value' },
      ),
    ).toMatchObject({ provider: 'openai-compatible', model: 'legacy-model' });
  });

  it('stays unconfigured when the selected provider credential is absent', () => {
    expect(modelFromEnvironment({ provider: 'anthropic', name: 'claude-test' }, {})).toBeInstanceOf(
      UnconfiguredModelProvider,
    );
    expect(isModelConfigured('anthropic', {})).toBe(false);
  });

  it('documents every accepted credential source', () => {
    expect(modelCredentialEnvironmentVariables('ai-gateway')).toEqual([
      'AI_GATEWAY_API_KEY',
      'VERCEL_OIDC_TOKEN',
    ]);
    expect(modelCredentialEnvironmentVariables('openai-compatible')).toEqual([
      'OPENAI_COMPATIBLE_API_KEY',
      'OPENAI_API_KEY',
    ]);
  });

  it('reports no credential variable for a subscription transport', () => {
    expect(modelCredentialEnvironmentVariables('claude-code')).toEqual([]);
    expect(modelCredentialEnvironmentVariables('codex-cli')).toEqual([]);
  });
});

describe('subscription transports', () => {
  const claudeCode = { provider: 'claude-code', name: 'opus' } as const;

  it('stays inert until the host opts in, so no CLI is ever spawned by default', () => {
    expect(modelFromEnvironment(claudeCode, {})).toBeInstanceOf(UnconfiguredModelProvider);
    expect(isModelConfigured('claude-code', {})).toBe(false);
    expect(
      modelFromEnvironment({ provider: 'codex-cli', name: 'gpt-5.2-codex' }, {}),
    ).toBeInstanceOf(UnconfiguredModelProvider);
  });

  it('ignores an API key: the flag is the only thing that enables the transport', () => {
    expect(
      modelFromEnvironment(claudeCode, { ANTHROPIC_API_KEY: 'test-key-value' }),
    ).toBeInstanceOf(UnconfiguredModelProvider);
  });

  it('selects the transport once the flag is exactly true', () => {
    const configured = modelFromEnvironment(claudeCode, {
      AGENT_ZERO_ENABLE_CLAUDE_CODE_PROVIDER: 'true',
    });
    expect(configured).toBeInstanceOf(AISdkModelProvider);
    expect(configured).toMatchObject({ provider: 'claude-code', model: 'opus' });
    expect(
      isModelConfigured('claude-code', { AGENT_ZERO_ENABLE_CLAUDE_CODE_PROVIDER: 'true' }),
    ).toBe(true);
  });

  it('wraps the transport when an operator configured a credentialed fallback', () => {
    expect(
      modelFromEnvironment(claudeCode, {
        AGENT_ZERO_ENABLE_CLAUDE_CODE_PROVIDER: 'true',
        AGENT_ZERO_MODEL_FALLBACK_PROVIDER: 'anthropic',
        AGENT_ZERO_MODEL_FALLBACK_MODEL: 'claude-sonnet-4-5',
        ANTHROPIC_API_KEY: 'test-key-value',
      }),
    ).toBeInstanceOf(FallbackModelProvider);
  });

  it('keeps the actionable CLI error when the fallback has no credential of its own', () => {
    expect(
      modelFromEnvironment(claudeCode, {
        AGENT_ZERO_ENABLE_CLAUDE_CODE_PROVIDER: 'true',
        AGENT_ZERO_MODEL_FALLBACK_PROVIDER: 'anthropic',
        AGENT_ZERO_MODEL_FALLBACK_MODEL: 'claude-sonnet-4-5',
      }),
    ).toBeInstanceOf(AISdkModelProvider);
  });

  it('rejects a fallback that cannot degrade anything', () => {
    const base = {
      AGENT_ZERO_ENABLE_CLAUDE_CODE_PROVIDER: 'true',
      AGENT_ZERO_MODEL_FALLBACK_MODEL: 'gpt-5',
    };
    expect(() => modelFromEnvironment(claudeCode, base)).toThrow(INCOMPLETE_FALLBACK);
    expect(() =>
      modelFromEnvironment(claudeCode, {
        ...base,
        AGENT_ZERO_MODEL_FALLBACK_PROVIDER: 'codex-cli',
      }),
    ).toThrow(SUBSCRIPTION_FALLBACK);
    expect(() =>
      modelFromEnvironment(claudeCode, {
        ...base,
        AGENT_ZERO_MODEL_FALLBACK_PROVIDER: 'not-a-provider',
      }),
    ).toThrow(UNKNOWN_FALLBACK);
  });
});

describe('FallbackModelProvider', () => {
  const succeeding: ModelProvider = { decide: async () => decision };

  it('degrades only when the host cannot reach the primary transport', async () => {
    const unreachable: ModelProvider = {
      decide: async () => {
        throw new SubscriptionProviderUnavailableError('claude-code', 'run `claude login`');
      },
    };
    await expect(
      new FallbackModelProvider(unreachable, succeeding).decide(context()),
    ).resolves.toMatchObject({ finding: { title: 'Null return' } });
  });

  it('never swaps transports because it disliked the answer', async () => {
    const failing: ModelProvider = {
      decide: async () => {
        throw new Error('Model returned an invalid decision');
      },
    };
    await expect(new FallbackModelProvider(failing, succeeding).decide(context())).rejects.toThrow(
      'Model returned an invalid decision',
    );
  });
});

describe('isAgentDecision', () => {
  it('accepts a well-formed decision', () => {
    expect(isAgentDecision(decision)).toBe(true);
  });

  it('rejects malformed model output', () => {
    for (const candidate of [
      null,
      'text',
      { finding: decision.finding, plan: 'not a list', changes: [] },
      { finding: { ...decision.finding, severity: 'catastrophic' }, plan: [], changes: [] },
      { finding: { ...decision.finding, confidence: Number.NaN }, plan: [], changes: [] },
      { finding: decision.finding, plan: [], changes: [{ path: 'a.ts' }] },
      { ...decision, changeRisk: 'anything-goes' },
    ])
      expect(isAgentDecision(candidate)).toBe(false);
  });
});
