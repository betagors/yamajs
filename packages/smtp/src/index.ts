// Export plugin (default export)
export { default as plugin } from "./plugin.js";
export { default } from "./plugin.js";

// Export types
export type {
  SMTPConfig,
} from "./client.js";

export type {
  EmailOptions,
  EmailResult,
  EmailAttachment,
  EmailService,
} from "./service.js";

// Export functions
export {
  createSMTPTransport,
  verifySMTPConnection,
} from "./client.js";

export {
  createEmailService,
} from "./service.js";



















