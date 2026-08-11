import { describe, expect, it, vi } from 'vitest';

import { createConsoleProvider, mailProviderFromEnvironment } from './index.js';

/**
 * Provider selection is deployment configuration, so the failure modes that matter are the
 * misconfigured ones: they must fail loudly rather than fall back to a transport the operator did
 * not choose.
 */
describe('mailProviderFromEnvironment', () => {
  it('defaults to the console provider when nothing is configured', () => {
    expect(() => mailProviderFromEnvironment({})).not.toThrow();
  });

  it('rejects an unknown provider name instead of silently defaulting', () => {
    expect(() => mailProviderFromEnvironment({ MAIL_PROVIDER: 'carrier-pigeon' })).toThrow(
      /invalid MAIL_PROVIDER/,
    );
  });

  it('requires an API key before selecting Resend', () => {
    expect(() => mailProviderFromEnvironment({ MAIL_PROVIDER: 'resend' })).toThrow(
      /RESEND_API_KEY/,
    );
  });

  it('requires host and port before selecting SMTP', () => {
    expect(() => mailProviderFromEnvironment({ MAIL_PROVIDER: 'smtp' })).toThrow(/SMTP_HOST/);
    expect(() =>
      mailProviderFromEnvironment({ MAIL_PROVIDER: 'smtp', SMTP_HOST: 'localhost' }),
    ).toThrow(/SMTP_PORT/);
  });

  it('rejects a port that is not a whole number in range', () => {
    for (const port of ['587abc', '0', '70000']) {
      expect(() =>
        mailProviderFromEnvironment({
          MAIL_PROVIDER: 'smtp',
          SMTP_HOST: 'localhost',
          SMTP_PORT: port,
        }),
      ).toThrow(/SMTP_PORT/);
    }
  });

  it('never echoes a credential in its error messages', () => {
    // A thrown connection string or key routinely ends up in a crash log.
    expect(() =>
      mailProviderFromEnvironment({ MAIL_PROVIDER: 'smtp', SMTP_PASSWORD: 'hunter2' }),
    ).toThrow(expect.not.stringMatching(/hunter2/) as unknown as string);
  });
});

describe('createConsoleProvider', () => {
  it('reports the message without logging its body', async () => {
    const log = vi.fn();
    await createConsoleProvider(log)({
      to: 'operator@example.com',
      subject: 'Reset your password',
      html: '<a href="https://example.com/reset?token=secret-token">Reset</a>',
      text: 'https://example.com/reset?token=secret-token',
      from: 'noreply@example.com',
    });

    expect(log).toHaveBeenCalledOnce();
    const [message] = log.mock.calls[0] as [string];
    expect(message).toContain('operator@example.com');
    // Invitation and reset links are single-use credentials; they must not reach the log.
    expect(message).not.toContain('secret-token');
  });
});
