/**
 * Email Provider
 * 
 * Provides email sending with dev capture mode and templates.
 */

// Re-export types
export type {
    EmailProviderConfig,
    EmailAPI,
    EmailOptions,
    EmailAttachment,
    EmailResult,
    CapturedEmail,
} from './types.js';

// Adapters are now in separate packages (e.g. @yamajs/mail-smtp)
