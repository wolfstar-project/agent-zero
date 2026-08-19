import { mailProviderFromEnvironment } from './provider/index.js';
import type { MailProvider } from './provider/types.js';
import compiledTemplates from './util/compiled-templates.json' with { type: 'json' };
import {
  escapeMailHtml,
  interpolateMailTemplate,
  mailTemplateVariantKey,
  type CompiledMailTemplates,
} from './util/compiled.js';
import {
  mailTemplateConditionalFields,
  mailTemplates,
  type MailTemplateContext,
  type MailTemplateId,
} from './util/templates.js';

/**
 * The templates as they were rendered at build time by `scripts/compile-templates.ts`.
 *
 * Imported rather than read from disk so the markup travels inside the module: the deployments
 * that send mail bundle this package into a single server file, where a path resolved from
 * `import.meta.url` no longer points anywhere near `emails/`.
 */
const compiled = compiledTemplates as CompiledMailTemplates;

/** Plaintext is already plain: a value goes in exactly as the recipient should read it. */
function asPlaintext(value: string): string {
  return value;
}

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
 * Fill in a template and hand it to the configured provider.
 *
 * Rendering happened at build time (`scripts/compile-templates.ts`), because Maizzle's pipeline —
 * Vue SSR, CSS inlining, plaintext — runs a bundler, and the deployments that send mail are
 * serverless functions with neither a writable working directory nor the platform-native binary
 * that bundler needs. What is left per message is the part that genuinely varies: choosing the
 * variant whose branches match this context, and substituting the values into it.
 */
export async function sendEmail<Id extends MailTemplateId>(
  options: SendEmailOptions<Id>,
  mailer: MailerOptions = {},
): Promise<void> {
  const template = mailTemplates[options.templateId];
  const variantKey = mailTemplateVariantKey(
    mailTemplateConditionalFields(options.templateId),
    options.context,
  );
  const variant = compiled[options.templateId][variantKey];
  if (!variant) {
    // Only reachable when the checked-in artifact was rendered from a different registry than the
    // one this build ships, which `aube run mail:compile` repairs and `mail.test.ts` catches.
    throw new Error(
      `mail template ${options.templateId} has no compiled variant ${JSON.stringify(variantKey)}`,
    );
  }

  const context = options.context as Readonly<Record<string, string>>;
  const provider = mailer.provider ?? mailProviderFromEnvironment();

  await provider({
    to: options.to,
    subject: options.subject ?? template.subject,
    html: interpolateMailTemplate(variant.html, context, escapeMailHtml),
    text: interpolateMailTemplate(variant.text, context, asPlaintext),
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
