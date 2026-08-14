import type { MailProvider, OutgoingMail } from './types.js';

/** Options the Resend transport needs. */
export interface ResendProviderOptions {
  readonly apiKey: string;
}

/**
 * Resend transport.
 *
 * `resend` is an optional peer dependency, so the module is imported lazily: a deployment using
 * SMTP or the console provider must not need the package installed to boot.
 */
export function createResendProvider(options: ResendProviderOptions): MailProvider {
  return async (mail: OutgoingMail) => {
    const { Resend } = await import('resend');
    const client = new Resend(options.apiKey);

    const { error } = await client.emails.send({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    // The SDK reports delivery failures in the payload rather than by throwing, so an unchecked
    // call would treat a rejected message as sent.
    if (error) throw new Error(`resend rejected the message: ${error.message}`);
  };
}
