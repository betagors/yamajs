import type { Transporter } from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";

/**
 * Email attachment options
 */
export interface EmailAttachment {
  /**
   * Filename
   */
  filename?: string;
  
  /**
   * File path
   */
  path?: string;
  
  /**
   * File content as buffer
   */
  content?: Buffer | string;
  
  /**
   * Content type
   */
  contentType?: string;
  
  /**
   * Content ID for inline attachments
   */
  cid?: string;
}

/**
 * Email sending options
 */
export interface EmailOptions {
  /**
   * Recipient email address(es)
   */
  to: string | string[];
  
  /**
   * CC recipient(s)
   */
  cc?: string | string[];
  
  /**
   * BCC recipient(s)
   */
  bcc?: string | string[];
  
  /**
   * Email subject
   */
  subject: string;
  
  /**
   * Plain text content
   */
  text?: string;
  
  /**
   * HTML content
   */
  html?: string;
  
  /**
   * Attachments
   */
  attachments?: EmailAttachment[];
  
  /**
   * Reply-to address
   */
  replyTo?: string | string[];
  
  /**
   * From address (overrides default)
   */
  from?: string;
  
  /**
   * Additional headers
   */
  headers?: Record<string, string>;
}

/**
 * Email sending result
 */
export interface EmailResult {
  /**
   * Message ID
   */
  messageId: string;
  
  /**
   * Accepted recipient addresses
   */
  accepted: string[];
  
  /**
   * Rejected recipient addresses
   */
  rejected: string[];
  
  /**
   * Response from SMTP server
   */
  response?: string;
}

/**
 * Email service interface
 */
export interface EmailService {
  /**
   * Send a single email
   */
  send(options: EmailOptions): Promise<EmailResult>;
  
  /**
   * Send multiple emails in batch
   */
  sendBatch(emails: EmailOptions[]): Promise<EmailResult[]>;
  
  /**
   * Get the default sender address
   */
  getDefaultFrom(): string | undefined;
}

/**
 * Create email service from SMTP transport
 */
export function createEmailService(
  transport: Transporter,
  defaultFrom?: string
): EmailService {
  return {
    async send(options: EmailOptions): Promise<EmailResult> {
      const mailOptions: any = {
        from: options.from || defaultFrom,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        headers: options.headers,
      };
      
      // Convert attachments to nodemailer format
      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map((att) => {
          const nodemailerAtt: Attachment = {};
          if (att.filename) nodemailerAtt.filename = att.filename;
          if (att.path) nodemailerAtt.path = att.path;
          if (att.content) nodemailerAtt.content = att.content;
          if (att.contentType) nodemailerAtt.contentType = att.contentType;
          if (att.cid) nodemailerAtt.cid = att.cid;
          return nodemailerAtt;
        });
      }
      
      const info = await transport.sendMail(mailOptions);
      
      return {
        messageId: info.messageId,
        accepted: Array.isArray(info.accepted) ? info.accepted : [],
        rejected: Array.isArray(info.rejected) ? info.rejected : [],
        response: info.response,
      };
    },
    
    async sendBatch(emails: EmailOptions[]): Promise<EmailResult[]> {
      const results: EmailResult[] = [];
      
      for (const email of emails) {
        try {
          const result = await this.send(email);
          results.push(result);
        } catch (error) {
          // If sending fails, add error result
          results.push({
            messageId: "",
            accepted: [],
            rejected: Array.isArray(email.to) ? email.to : [email.to],
            response: error instanceof Error ? error.message : String(error),
          });
        }
      }
      
      return results;
    },
    
    getDefaultFrom(): string | undefined {
      return defaultFrom;
    },
  };
}



















