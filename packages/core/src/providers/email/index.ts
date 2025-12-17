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
} from '../types.js';

// Re-export adapter utilities
export {
    SMTPEmailProvider,
    SMTPEmailAPI,
    renderTemplate,
    extractLinks,
    BUILT_IN_TEMPLATES,
} from './adapters/smtp.js';

// Register adapters (side effect)
import './adapters/smtp.js';
