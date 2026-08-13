/**
 * The contract every delivery backend satisfies.
 *
 * Kept free of provider SDK types so that swapping Resend for SMTP is a configuration change
 * rather than a change to callers, and so tests can substitute a recording provider without
 * pulling a network client into the process.
 */

/** A fully rendered message, ready for delivery. */
export interface OutgoingMail {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  /** Plaintext alternative. Always populated by `sendEmail`, which renders it alongside the HTML. */
  readonly text: string;
  /** Sender address. Resolved from `MAIL_FROM` unless the caller overrides it. */
  readonly from: string;
}

/**
 * Delivers a rendered message.
 *
 * Implementations must reject on failure rather than resolving quietly: a silently dropped
 * password reset or organization invitation is indistinguishable from a delivered one, and the
 * caller has no other signal to act on.
 */
export type MailProvider = (mail: OutgoingMail) => Promise<void>;
