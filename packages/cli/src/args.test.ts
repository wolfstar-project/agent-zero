import { describe, expect, it } from 'vitest';

import { parseCliArguments } from './args.js';

describe('parseCliArguments', () => {
  it('parses typed flags and equals syntax', () => {
    expect(parseCliArguments(['review', '--feedback=check this', '--json'])).toEqual({
      command: 'review',
      feedback: 'check this',
      help: false,
      json: true,
      proactive: false,
      version: false,
    });
  });

  it('supports help and version aliases', () => {
    expect(parseCliArguments(['-h']).help).toBe(true);
    expect(parseCliArguments(['-v']).version).toBe(true);
  });

  it('defaults to the help command', () => {
    expect(parseCliArguments([]).command).toBe('help');
  });

  it('rejects unknown options and extra positionals', () => {
    expect(() => parseCliArguments(['doctor', '--wat'])).toThrow('Unknown option: --wat');
    expect(() => parseCliArguments(['doctor', 'extra'])).toThrow(
      'Unexpected positional argument: extra',
    );
  });

  it('restricts command-specific options', () => {
    expect(() => parseCliArguments(['init', '--json'])).toThrow('--json is only valid');
    expect(() => parseCliArguments(['doctor', '--feedback', 'text'])).toThrow(
      '--feedback is only valid',
    );
    expect(() => parseCliArguments(['doctor', '--proactive'])).toThrow('--proactive is only valid');
    expect(() => parseCliArguments(['review', '--proactive', '--feedback', 'text'])).toThrow(
      'cannot be combined',
    );
  });

  it('supports proactive diff review without reviewer feedback', () => {
    const parsed = parseCliArguments(['review', '--proactive']);
    expect(parsed).toMatchObject({
      command: 'review',
      proactive: true,
    });
    expect(parsed.feedback).toBeUndefined();
  });
});
