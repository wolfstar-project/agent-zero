import { describe, expect, it, vi } from 'vitest';

import { createMailer, sendEmail } from './mail.js';
import type { OutgoingMail } from './provider/types.js';

const INLINE_STYLE_PATTERN = /style="/;
const LEAKED_CLASS_ATTRIBUTE_PATTERN = /class="/;
const MISSING_MAIL_FROM_PATTERN = /MAIL_FROM/;

/**
 * These render through the real Maizzle pipeline rather than a stub. Rendering is local and
 * deterministic, and the failure this guards against — a template that compiles but drops its
 * interpolated values — is invisible to a mocked renderer.
 */
function recordingProvider() {
  const sent: OutgoingMail[] = [];
  return {
    sent,
    provider: (mail: OutgoingMail) => {
      sent.push(mail);
      return Promise.resolve();
    },
  };
}

/** Narrows `OutgoingMail | undefined` without an unsafe cast, failing the test with a clear message. */
function assertSent(mail: OutgoingMail | undefined): asserts mail is OutgoingMail {
  if (!mail) throw new Error('expected a message to have been recorded');
}

describe('sendEmail', () => {
  it('renders the invitation template with its context in both HTML and plaintext', async () => {
    const { sent, provider } = recordingProvider();

    await sendEmail(
      {
        to: 'invitee@example.com',
        templateId: 'organizationInvitation',
        context: {
          organizationName: 'Acme Ops',
          inviterName: 'Dana',
          acceptUrl: 'https://dashboard.example.com/accept?token=abc',
        },
      },
      { provider, from: 'noreply@example.com' },
    );

    expect(sent).toHaveLength(1);
    const [mail] = sent;
    assertSent(mail);
    expect(mail.to).toBe('invitee@example.com');
    expect(mail.from).toBe('noreply@example.com');
    expect(mail.subject).toBe('You have been invited to an organization');
    expect(mail.html).toContain('Acme Ops');
    expect(mail.html).toContain('Dana');
    expect(mail.html).toContain('https://dashboard.example.com/accept?token=abc');
    // Clients that refuse HTML still have to be able to act on the invitation.
    expect(mail.text).toContain('Acme Ops');
    expect(mail.text).toContain('https://dashboard.example.com/accept?token=abc');
  });

  it('inlines styles so the message survives clients that drop stylesheets', async () => {
    const { sent, provider } = recordingProvider();

    await sendEmail(
      {
        to: 'invitee@example.com',
        templateId: 'passwordReset',
        context: { name: 'Dana', resetUrl: 'https://dashboard.example.com/reset?token=abc' },
      },
      { provider, from: 'noreply@example.com' },
    );

    const [mail] = sent;
    assertSent(mail);
    expect(mail.html).toMatch(INLINE_STYLE_PATTERN);
    // Utility classes are inlined and purged; a leftover class attribute means the CSS step
    // silently did nothing and the message would arrive unstyled.
    expect(mail.html).not.toMatch(LEAKED_CLASS_ATTRIBUTE_PATTERN);
  });

  it('lets the caller override the registered subject', async () => {
    const { sent, provider } = recordingProvider();

    await sendEmail(
      {
        to: 'invitee@example.com',
        templateId: 'emailVerification',
        context: { name: 'Dana', verifyUrl: 'https://dashboard.example.com/verify?token=abc' },
        subject: 'Conferma il tuo indirizzo email',
      },
      { provider, from: 'noreply@example.com' },
    );

    const [mail] = sent;
    assertSent(mail);
    expect(mail.subject).toBe('Conferma il tuo indirizzo email');
  });

  it('refuses to send without a sender address rather than inventing one', async () => {
    const { provider } = recordingProvider();
    vi.stubEnv('MAIL_FROM', '');

    await expect(
      sendEmail(
        {
          to: 'invitee@example.com',
          templateId: 'emailVerification',
          context: { name: 'Dana', verifyUrl: 'https://dashboard.example.com/verify' },
        },
        { provider },
      ),
    ).rejects.toThrow(MISSING_MAIL_FROM_PATTERN);

    vi.unstubAllEnvs();
  });
});

describe('createMailer', () => {
  it('binds the provider and sender once for injection', async () => {
    const { sent, provider } = recordingProvider();
    const mailer = createMailer({ provider, from: 'ops@example.com' });

    await mailer({
      to: 'invitee@example.com',
      templateId: 'emailVerification',
      context: { name: 'Dana', verifyUrl: 'https://dashboard.example.com/verify?token=abc' },
    });

    const [mail] = sent;
    assertSent(mail);
    expect(mail.from).toBe('ops@example.com');
  });
});
