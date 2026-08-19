import { fileURLToPath } from 'node:url';

import { render } from '@maizzle/framework';
import { describe, expect, it } from 'vitest';

import { compileMailTemplates } from '../../scripts/compile-templates.ts';
import { sendEmail } from '../mail.js';
import type { OutgoingMail } from '../provider/types.js';
import compiledTemplates from './compiled-templates.json' with { type: 'json' };

const emailsDirectory = fileURLToPath(new URL('../../emails/', import.meta.url));

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

/**
 * The guards the compiled artifact needs. The first two render through the real Maizzle pipeline,
 * because the checked-in markup is only trustworthy while it still matches what the templates
 * produce, and substitution is only correct if a filled-in message is indistinguishable from one
 * rendered with those values in the first place.
 *
 * They are slow — every render starts a Vite SSR server — which is the whole reason sending does
 * none of this.
 */
describe('compiled mail templates', () => {
  it('match what the templates render today', async () => {
    // Fails when a template under emails/ changed without `aube run mail:compile` being run.
    await expect(compileMailTemplates()).resolves.toEqual(compiledTemplates);
  }, 120_000);

  it('fill in exactly what a live render of the same values produces', async () => {
    const context = {
      name: 'Ada',
      inviterName: 'Grace',
      organizationName: 'Acme Ops',
      acceptUrl: 'https://dashboard.example.com/invite?token=abc',
    };

    const { sent, provider } = recordingProvider();
    await sendEmail(
      { to: 'ada@example.com', templateId: 'privateInvitation', context },
      { provider, from: 'noreply@example.com' },
    );

    const live = await render(`${emailsDirectory}PrivateInvitation.vue`, {
      ...context,
      plaintext: true,
    });

    const [mail] = sent;
    expect(mail?.html).toBe(live.html);
    expect(mail?.text).toBe(live.plaintext ?? '');
  }, 120_000);

  it('escapes the values it substitutes rather than letting them close a tag or an attribute', async () => {
    // Organization names are typed by whoever created the organization, and the accept URL carries
    // query separators: both are substituted into markup nothing else escapes for them.
    const { sent, provider } = recordingProvider();
    await sendEmail(
      {
        to: 'ada@example.com',
        templateId: 'privateInvitation',
        context: {
          name: 'Ada',
          inviterName: 'Grace',
          organizationName: '<script>alert("x")</script> & Co',
          acceptUrl: 'https://dashboard.example.com/invite?token=abc&source=mail',
        },
      },
      { provider, from: 'noreply@example.com' },
    );

    const [mail] = sent;
    expect(mail?.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co');
    expect(mail?.html).not.toContain('<script>');
    // The whole URL has to stay inside the attribute it was substituted into.
    expect(mail?.html).toContain(
      'href="https://dashboard.example.com/invite?token=abc&amp;source=mail"',
    );
    // Plaintext has no markup to escape for, so the recipient reads the values as they are.
    expect(mail?.text).toContain('<script>alert("x")</script> & Co');
    expect(mail?.text).toContain('https://dashboard.example.com/invite?token=abc&source=mail');
  });
});
