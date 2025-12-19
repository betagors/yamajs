/**
 * Email Provider Contract
 */

export interface EmailProviderConfig {
    adapter: 'smtp' | 'resend' | 'sendgrid' | 'capture';
    /** Default from address */
    from: string;
    /** Default reply-to address */
    replyTo?: string;

    /** SMTP configuration */
    smtp?: {
        host: string;
        port: number;
        secure?: boolean;
        auth?: {
            user: string;
            pass: string;
        };
    };

    /** Resend API key */
    resendApiKey?: string;

    /** SendGrid API key */
    sendgridApiKey?: string;

    /** Dev mode settings */
    dev?: {
        /** Save emails to .yama/emails/ */
        capture?: boolean;
        /** Log to console */
        console?: boolean;
        /** Enable /__yama/emails UI */
        ui?: boolean;
    };

    /** Custom templates directory */
    templates?: string;
}

export interface EmailAttachment {
    filename: string;
    content: string | Uint8Array;
    contentType?: string;
}

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: EmailAttachment[];
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface CapturedEmail {
    id: string;
    to: string[];
    from: string;
    subject: string;
    html?: string;
    text?: string;
    sentAt: Date;
    /** Extracted links for testing */
    links: string[];
}

export interface EmailAPI {
    /** Send an email */
    send(options: EmailOptions): Promise<EmailResult>;

    /** Send using a template */
    sendTemplate(
        template: string,
        to: string | string[],
        data: Record<string, unknown>,
        options?: Partial<EmailOptions>
    ): Promise<EmailResult>;

    /** Check if email is in dev capture mode */
    readonly isDevMode: boolean;

    /** Get captured emails (dev mode only) */
    getCapturedEmails(): Promise<CapturedEmail[]>;

    /** Clear captured emails (dev mode only) */
    clearCapturedEmails(): Promise<void>;
}
