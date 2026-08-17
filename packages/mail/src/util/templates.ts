/**
 * Template registry.
 *
 * Every message the product can send is declared here with its Maizzle template and subject, so
 * that adding a template is one edit and callers address messages by id rather than by file path.
 */

/** Data each template interpolates. Keyed by template id so `sendEmail` can check the context. */
export interface MailTemplateContext {
  readonly organizationInvitation: {
    /** Display name of the organization the recipient is being invited to. */
    readonly organizationName: string;
    /** Who sent the invitation, shown so the recipient can judge whether it is expected. */
    readonly inviterName: string;
    /** Absolute URL that accepts the invitation. Carries a single-use token. */
    readonly acceptUrl: string;
  };
  readonly privateInvitation: {
    /** The invitee's name when the inviter supplied one, otherwise empty. */
    readonly name: string;
    /** Who sent the invitation, shown so the recipient can judge whether it is expected. */
    readonly inviterName: string;
    /** The organization the invitation grants access to, or empty for an app-wide invitation. */
    readonly organizationName: string;
    /**
     * Absolute URL that redeems the invitation. Carries the only copy of the token, which is why
     * this message is the sole place it ever appears.
     */
    readonly acceptUrl: string;
  };
  readonly publicInvitation: {
    /** The person who created the link and receives this durable copy. */
    readonly inviterName: string;
    /** The organization the link grants access to, or empty for an app-wide invitation. */
    readonly organizationName: string;
    /** Absolute public URL the inviter can share with recipients. */
    readonly shareUrl: string;
    /** Human-readable use cap, or "Unlimited" when no cap was configured. */
    readonly maxUses: string;
    /** ISO timestamp, or "Never" when the invitation has no expiry. */
    readonly expiresAt: string;
  };
  readonly emailVerification: {
    readonly name: string;
    readonly verifyUrl: string;
  };
  readonly passwordReset: {
    readonly name: string;
    readonly resetUrl: string;
  };
}

export type MailTemplateId = keyof MailTemplateContext;

interface MailTemplateDefinition {
  /** Path relative to this package's `emails/` directory. */
  readonly file: string;
  readonly subject: string;
}

export const mailTemplates: Readonly<Record<MailTemplateId, MailTemplateDefinition>> = {
  organizationInvitation: {
    file: 'OrganizationInvitation.vue',
    subject: 'You have been invited to an organization',
  },
  privateInvitation: {
    file: 'PrivateInvitation.vue',
    subject: 'You have been invited to Agent Zero',
  },
  publicInvitation: {
    file: 'PublicInvitation.vue',
    subject: 'Your public Agent Zero invitation is ready',
  },
  emailVerification: {
    file: 'EmailVerification.vue',
    subject: 'Confirm your email address',
  },
  passwordReset: {
    file: 'PasswordReset.vue',
    subject: 'Reset your password',
  },
};
