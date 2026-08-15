import type { ParseOptions } from './contracts.js';

/** Untrusted comment bodies are bounded before they reach a prompt or an evidence report. */
export const MAX_BODY = 8_000;
export const COMMIT_SHA = /^[0-9a-f]{7,64}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** A positive integer, as required for change-request numbers and line numbers. */
export function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function readSha(value: unknown): string | undefined {
  return typeof value === 'string' && COMMIT_SHA.test(value) ? value : undefined;
}

export function readBody(body: unknown): string | null {
  if (typeof body !== 'string') return null;
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_BODY);
}

export function readLine(value: unknown): number | undefined {
  return readPositiveInteger(value);
}

export function readId(value: unknown, prefix: string): string {
  if (typeof value === 'number' || typeof value === 'string') return `${prefix}:${String(value)}`;
  return prefix;
}

/**
 * Accept or reject a feedback author.
 *
 * `isBot` is only meaningful on providers whose payloads mark bot accounts; adapters on other
 * providers pass `false`, so `allowBots: false` cannot filter what the payload does not reveal.
 */
export function acceptAuthor(
  login: string | undefined,
  isBot: boolean,
  options: ParseOptions,
): string | null {
  if (!login) return null;
  const ignored = options.ignoreAuthors ?? [];
  if (ignored.some((ignore) => ignore.toLowerCase() === login.toLowerCase())) return null;
  if (options.allowBots === false && isBot) return null;
  return login;
}

/** Case-insensitive header lookup; webhook hosts disagree on header-name casing. */
export function readHeader(
  headers: Readonly<Record<string, string | undefined>>,
  name: string,
): string | undefined {
  const direct = headers[name];
  if (direct !== undefined) return direct;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}
