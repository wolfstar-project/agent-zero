import type { MailProvider, OutgoingMail } from './types.js';

/**
 * Development provider: logs the message instead of delivering it.
 *
 * This is the default so that a deployment which has not configured a transport cannot silently
 * attempt real delivery, and so the test suite never opens a socket. The body is deliberately not
 * logged: invitation and password-reset messages carry single-use tokens in their links, and this
 * output routinely lands in shared terminal scrollback and CI logs.
 */
export function createConsoleProvider(log: (message: string) => void = console.info): MailProvider {
  return (mail: OutgoingMail) => {
    log(`[mail] would deliver "${mail.subject}" from ${mail.from} to ${mail.to}`);
    return Promise.resolve();
  };
}
