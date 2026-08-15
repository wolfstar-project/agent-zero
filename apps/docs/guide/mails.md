# Mails

`packages/mail` owns transactional email: [Maizzle](https://maizzle.com)-based templates plus a small provider layer. The dashboard uses it for organization invitations and other auth-driven messages.

## Providers

`MAIL_PROVIDER` selects the transport. The default is `console`, which logs instead of delivering — an unconfigured deployment cannot silently attempt real delivery.

| Provider  | Configuration                                                         |
| --------- | --------------------------------------------------------------------- |
| `console` | None. Logs the rendered message. The default; not for production.     |
| `resend`  | `RESEND_API_KEY`                                                      |
| `smtp`    | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` |

`MAIL_FROM` sets the sender address for every provider.

`SMTP_SECURE` selects implicit TLS: `true` on port 465, `false` on port 587 (STARTTLS).

## Templates

Templates are authored with Maizzle and rendered through the package's template registry:

- `mailTemplates` maps a `MailTemplateId` to its renderer;
- `MailTemplateContext` types the data each template needs;
- `maizzle.config.ts` is discovered by Maizzle's own `render()` call by filesystem convention.

Adding a template means adding it to the registry with a typed context, keeping delivery and content concerns separate: providers never know what a template says, and templates never know how mail is sent.

::: tip Organizations depend on mail
Organization invitations are delivered by email, so enabling [organizations](/guide/organizations) requires a real transport (`resend` or `smtp`).
:::
