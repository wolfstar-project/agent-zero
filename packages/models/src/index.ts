import type { AgentDecision, ReviewInput } from '@agent-zero/shared';

export interface ModelContext {
  input: ReviewInput;
  repositoryContext: string;
  previousFailure?: string;
}
export interface ModelProvider {
  decide(context: ModelContext): Promise<AgentDecision>;
}

export class OpenAICompatibleProvider implements ModelProvider {
  constructor(private readonly options: { apiKey: string; model: string; baseUrl?: string }) {}

  async decide(context: ModelContext): Promise<AgentDecision> {
    const response = await fetch(
      `${this.options.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You validate code-review feedback. Return JSON with finding, plan, and changes. Never invent evidence. Each change has path, full content, and reason.',
            },
            { role: 'user', content: JSON.stringify(context) },
          ],
        }),
      },
    );
    if (!response.ok)
      throw new Error(`Model request failed (${response.status}): ${await response.text()}`);
    const body: unknown = await response.json();
    const content = getMessageContent(body);
    if (!content) throw new Error('Model returned no decision');
    const decision: unknown = JSON.parse(content);
    if (!isAgentDecision(decision)) throw new Error('Model returned an invalid decision');
    return decision;
  }
}

export class HeuristicObserveProvider implements ModelProvider {
  async decide({ input }: ModelContext): Promise<AgentDecision> {
    return {
      finding: {
        title: 'Unverified review feedback',
        explanation: input.feedback,
        severity: 'medium',
        confidence: 0.5,
        valid: false,
        evidence: ['No model provider configured; manual validation required'],
        files: input.files ?? [],
      },
      plan: ['Configure OPENAI_API_KEY or inspect this feedback manually'],
      changes: [],
    };
  }
}

export function modelFromEnvironment(model: string, baseUrl?: string): ModelProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey
    ? new OpenAICompatibleProvider({ apiKey, model, ...(baseUrl ? { baseUrl } : {}) })
    : new HeuristicObserveProvider();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getMessageContent(value: unknown): string | undefined {
  if (!isRecord(value) || !Array.isArray(value.choices)) return undefined;
  const choice: unknown = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return undefined;
  return typeof choice.message.content === 'string' ? choice.message.content : undefined;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAgentDecision(value: unknown): value is AgentDecision {
  if (!isRecord(value) || !isRecord(value.finding)) return false;
  const finding = value.finding;
  const validFinding =
    typeof finding.title === 'string' &&
    typeof finding.explanation === 'string' &&
    ['critical', 'high', 'medium', 'low'].includes(String(finding.severity)) &&
    typeof finding.confidence === 'number' &&
    typeof finding.valid === 'boolean' &&
    isStringArray(finding.evidence) &&
    isStringArray(finding.files);
  const validChanges =
    Array.isArray(value.changes) &&
    value.changes.every(
      (change) =>
        isRecord(change) &&
        typeof change.path === 'string' &&
        typeof change.content === 'string' &&
        typeof change.reason === 'string',
    );
  return validFinding && isStringArray(value.plan) && validChanges;
}
