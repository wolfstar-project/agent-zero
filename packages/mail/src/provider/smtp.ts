import type { MailProvider, OutgoingMail } from './types.js';

/** Connection details for a self-hosted SMTP relay. */
export interface SmtpProviderOptions {
  readonly host: string;
  readonly port: number;
  /** Implicit TLS. Conventionally true on 465 and false on 587, which upgrades via STARTTLS. */
  readonly secure: boolean;
  readonly user?: string;
  readonly password?: string;
}

/**
 * Nodemailer SMTP transport, for deployments that relay through their own infrastructure.
 *
 * `nodemailer` is an optional peer dependency and is imported lazily for the same reason as the
 * Resend client: only the configured transport should have to be installed.
 */
export function createSmtpProvider(options: SmtpProviderOptions): MailProvider {
  return async (mail: OutgoingMail) => {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      // Anonymous relays are legitimate on an internal network, so credentials stay optional
      // rather than being forced into a half-configured auth block.
      ...(options.user && options.password
        ? { auth: { user: options.user, pass: options.password } }
        : {}),
    });

    await transport.sendMail({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
  };
}
