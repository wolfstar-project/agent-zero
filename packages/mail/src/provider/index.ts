import { createConsoleProvider } from './console.js';
import { createResendProvider } from './resend.js';
import { createSmtpProvider } from './smtp.js';
import type { MailProvider } from './types.js';

export { createConsoleProvider } from './console.js';
export { createResendProvider, type ResendProviderOptions } from './resend.js';
export { createSmtpProvider, type SmtpProviderOptions } from './smtp.js';
export type { MailProvider, OutgoingMail } from './types.js';

/** Transports a deployment can select through `MAIL_PROVIDER`. */
export const MAIL_PROVIDER_NAMES = ['console', 'resend', 'smtp'] as const;

export type MailProviderName = (typeof MAIL_PROVIDER_NAMES)[number];

function isProviderName(value: string): value is MailProviderName {
  return (MAIL_PROVIDER_NAMES as readonly string[]).includes(value);
}

/** Missing configuration is a deployment error; a default would send through the wrong transport. */
function requireEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`missing required environment variable: ${name}`);
  return value;
}

const DECIMAL_PORT_PATTERN = /^\d+$/u;

function requirePort(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): number {
  const raw = requireEnvironmentValue(environment, name);
  // Validate the whole value: `Number.parseInt` would truncate `587abc` to a usable port.
  if (!DECIMAL_PORT_PATTERN.test(raw)) throw new Error(`invalid ${name}: expected a port number`);
  const port = Number.parseInt(raw, 10);
  if (port < 1 || port > 65_535) throw new Error(`invalid ${name}: expected a port number`);
  return port;
}

/**
 * Resolve the configured transport.
 *
 * The single place delivery backends are selected, so callers depend on {@link MailProvider}
 * rather than on any one SDK. Defaults to the console provider: a deployment that has not chosen
 * a transport should log rather than fail to deliver silently, and no error message here echoes a
 * credential.
 */
export function mailProviderFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): MailProvider {
  const configured = environment.MAIL_PROVIDER?.trim() ?? 'console';
  if (!isProviderName(configured))
    throw new Error(
      `invalid MAIL_PROVIDER: expected one of ${MAIL_PROVIDER_NAMES.join(', ')}, received ${configured}`,
    );

  if (configured === 'resend')
    return createResendProvider({
      apiKey: requireEnvironmentValue(environment, 'RESEND_API_KEY'),
    });

  if (configured === 'smtp')
    return createSmtpProvider({
      host: requireEnvironmentValue(environment, 'SMTP_HOST'),
      port: requirePort(environment, 'SMTP_PORT'),
      secure: environment.SMTP_SECURE === 'true',
      ...(environment.SMTP_USER?.trim() ? { user: environment.SMTP_USER.trim() } : {}),
      ...(environment.SMTP_PASSWORD ? { password: environment.SMTP_PASSWORD } : {}),
    });

  // The only remaining member of MailProviderName, narrowed by isProviderName above.
  return createConsoleProvider();
}
