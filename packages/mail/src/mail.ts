import { fileURLToPath } from 'node:url';

import { render } from '@maizzle/framework';

import { mailProviderFromEnvironment } from './provider/index.js';
import type { MailProvider } from './provider/types.js';
import { mailTemplates, type MailTemplateContext, type MailTemplateId } from './util/templates.js';

/** Templates ship beside the compiled output, so resolve them relative to this module. */
const emailsDirectory = fileURLToPath(new URL('../emails/', import.meta.url));

/** A message to deliver, addressed by template id rather than by file path. */
export interface SendEmailOptions<Id extends MailTemplateId = MailTemplateId> {
  readonly to: string;
  readonly templateId: Id;
  /** Values the template interpolates. Typed per template by {@link MailTemplateContext}. */
  readonly context: MailTemplateContext[Id];
  /** Overrides the registered subject when a caller needs to localise it. */
  readonly subject?: string;
}

/** Everything `sendEmail` needs that is not the message itself. */
export interface MailerOptions {
  /** Delivery backend. Defaults to the one selected by `MAIL_PROVIDER`. */
  readonly provider?: MailProvider;
  /** Sender address. Defaults to `MAIL_FROM`. */
  readonly from?: string;
}

function resolveFrom(from: string | undefined): string {
  const address = from ?? process.env.MAIL_FROM?.trim();
  if (!address) throw new Error('missing required environment variable: MAIL_FROM');
  return address;
}

/**
 * Render a template and hand it to the configured provider.
 *
 * Rendering happens per send rather than at build time: the templates carry per-recipient tokens,
 * so there is no reusable compiled artifact to cache, and Maizzle's pipeline (SSR, CSS inlining,
 * plaintext) is what turns the Vue source into something a mail client renders.
 */
export async function sendEmail<Id extends MailTemplateId>(
  options: SendEmailOptions<Id>,
  mailer: MailerOptions = {},
): Promise<void> {
  const template = mailTemplates[options.templateId];
  const { html, plaintext } = await render(`${emailsDirectory}${template.file}`, {
    ...options.context,
    plaintext: true,
  });

  const provider = mailer.provider ?? mailProviderFromEnvironment();

  await provider({
    to: options.to,
    subject: options.subject ?? template.subject,
    html,
    text: plaintext ?? '',
    from: resolveFrom(mailer.from),
  });
}

/**
 * Bind a provider and sender once.
 *
 * Composition roots build one of these at startup and inject it, which keeps the packages that
 * need to send mail free of any dependency on this one.
 */
export function createMailer(mailer: MailerOptions = {}) {
  return <Id extends MailTemplateId>(options: SendEmailOptions<Id>) => sendEmail(options, mailer);
}

/** The injectable shape a consumer depends on, so no caller has to import this package's internals. */
export type SendEmail = ReturnType<typeof createMailer>;
