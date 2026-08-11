export {
  createMailer,
  sendEmail,
  type MailerOptions,
  type SendEmail,
  type SendEmailOptions,
} from './mail.js';
export {
  createConsoleProvider,
  createResendProvider,
  createSmtpProvider,
  MAIL_PROVIDER_NAMES,
  mailProviderFromEnvironment,
  type MailProvider,
  type MailProviderName,
  type OutgoingMail,
  type ResendProviderOptions,
  type SmtpProviderOptions,
} from './provider/index.js';
export { mailTemplates, type MailTemplateContext, type MailTemplateId } from './util/templates.js';
