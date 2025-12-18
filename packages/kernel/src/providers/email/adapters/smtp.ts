
/**
 * Email Provider - SMTP Adapter
 * 
 * Provides email sending via SMTP with dev capture mode.
 * Uses getRuntime() for FS and Crypto.
 * Uses node:net/tls for SMTP (Node-specific, will fail in non-Node edge).
 */

// @ts-ignore
import { createConnection } from 'node:net';
// @ts-ignore
import { connect as tlsConnect } from 'node:tls';
import { getRuntime } from '../../../platform/index.js';
import type {
  Provider,
  ProviderContext,
  EmailProviderConfig,
  EmailAPI,
  EmailOptions,
  EmailResult,
  CapturedEmail,
} from '../../types.js';
import { registerAdapter } from '../../registry.js';

// Helper for base64
function base64Encode(str: string): string {
  // Universal base64 encode
  if ((globalThis as any).Buffer) {
    return (globalThis as any).Buffer.from(str).toString('base64');
  }
  return btoa(str);
}

// ============================================================================
// Template Engine
// ============================================================================

/**
 * Simple template engine for {{variable}} substitution
 */
function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Extract links from HTML content
 */
function extractLinks(html: string): string[] {
  const links: string[] = [];
  const regex = /href=["']([^"']+)["']/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    // Filter to only http/https links
    if (href.startsWith('http://') || href.startsWith('https://')) {
      links.push(href);
    }
  }

  return links;
}

// ============================================================================
// Built-in Email Templates
// ============================================================================

const BUILT_IN_TEMPLATES: Record<string, string> = {
  'verify-link': `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your email</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f6f9fc; padding: 20px; margin: 0; }
    .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; color: #333; line-height: 1.6; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .link-box { word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 6px; font-size: 14px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify your email</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>Click the button below to verify your email address and activate your account:</p>
      <p style="text-align: center;">
        <a href="{{verifyLink}}" class="button">Verify Email</a>
      </p>
      <p>Or copy and paste this link:</p>
      <p class="link-box">{{verifyLink}}</p>
      <p>This link expires in {{expiresIn}}.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; {{year}} {{appName}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim(),

  'verify-code': `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your verification code</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f6f9fc; padding: 20px; margin: 0; }
    .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; color: #333; line-height: 1.6; text-align: center; }
    .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; font-family: monospace; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your verification code</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>Use this code to verify your email address:</p>
      <div class="code">{{code}}</div>
      <p>This code expires in {{expiresIn}}.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; {{year}} {{appName}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim(),

  'password-reset': `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your password</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f6f9fc; padding: 20px; margin: 0; }
    .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; color: #333; line-height: 1.6; }
    .button { display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .link-box { word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 6px; font-size: 14px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset your password</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align: center;">
        <a href="{{resetLink}}" class="button">Reset Password</a>
      </p>
      <p>Or copy and paste this link:</p>
      <p class="link-box">{{resetLink}}</p>
      <p>This link expires in {{expiresIn}}.</p>
      <p>If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>
    <div class="footer">
      <p>&copy; {{year}} {{appName}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim(),

  'welcome': `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome!</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f6f9fc; padding: 20px; margin: 0; }
    .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; color: #333; line-height: 1.6; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to {{appName}}! 🎉</h1>
    </div>
    <div class="content">
      <p>Hi {{userName}},</p>
      <p>Welcome aboard! We're thrilled to have you with us.</p>
      <p>Your account has been successfully created. You can now start exploring all the features we have to offer.</p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Best,<br>The {{appName}} Team</p>
    </div>
    <div class="footer">
      <p>&copy; {{year}} {{appName}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim(),

  'account-locked': `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Account Security Alert</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f6f9fc; padding: 20px; margin: 0; }
    .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; color: #333; line-height: 1.6; }
    .alert-box { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Account Security Alert</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <div class="alert-box">
        Your account has been temporarily locked due to multiple failed login attempts.
      </div>
      <p>Your account will be automatically unlocked in <strong>{{unlockTime}}</strong>.</p>
      <p>If this wasn't you, we recommend:</p>
      <ul>
        <li>Resetting your password as soon as possible</li>
        <li>Enabling two-factor authentication</li>
        <li>Reviewing your recent account activity</li>
      </ul>
      <p>If you need help, please contact our support team.</p>
    </div>
    <div class="footer">
      <p>&copy; {{year}} {{appName}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim(),
};

// ============================================================================
// Dev Capture Mode
// ============================================================================

interface DevEmailCapture {
  projectDir: string;
  emailsDir: string;
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void };
}

function createDevCapture(options: DevEmailCapture) {
  const { emailsDir, logger } = options;
  const fs = getRuntime().fs;
  const path = getRuntime().path;

  return {
    async capture(email: CapturedEmail): Promise<void> {
      // Ensure emails directory exists
      if (!await fs.exists(emailsDir)) {
        await fs.mkdir(emailsDir);
      }

      const filename = `${email.id}.json`;
      const filepath = path.join(emailsDir, filename);

      await fs.writeTextFile(filepath, JSON.stringify(email, null, 2));

      // Log to console with extracted links
      logger.info(`📧 Email captured: ${email.subject}`, {
        to: email.to.join(', '),
        from: email.from,
        links: email.links.length > 0 ? email.links : undefined,
      });

      if (email.links.length > 0) {
        console.log('   Links:');
        for (const link of email.links) {
          console.log(`   → ${link}`);
        }
      }
    },

    async getAll(): Promise<CapturedEmail[]> {
      if (!await fs.exists(emailsDir)) {
        return [];
      }

      const files = await fs.readDir(emailsDir);
      const jsonFiles = files.filter((f: any) => f.name.endsWith('.json'));
      const emails: CapturedEmail[] = [];

      for (const file of jsonFiles) {
        try {
          const content = await fs.readTextFile(path.join(emailsDir, file.name));
          const email = JSON.parse(content) as CapturedEmail;
          emails.push(email);
        } catch {
          // Skip invalid files
        }
      }

      // Sort by date, newest first
      emails.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

      return emails;
    },

    async clear(): Promise<void> {
      if (!await fs.exists(emailsDir)) {
        return;
      }

      const files = await fs.readDir(emailsDir);
      const jsonFiles = files.filter((f: any) => f.name.endsWith('.json'));
      for (const file of jsonFiles) {
        await fs.remove(path.join(emailsDir, file.name));
      }
    },
  };
}

// ============================================================================
// SMTP Client (Minimal Implementation)
// ============================================================================

interface SMTPConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

async function sendSMTP(
  config: SMTPConfig,
  from: string,
  to: string[],
  subject: string,
  html: string,
  text?: string
): Promise<{ messageId: string }> {
  return new Promise((resolve, reject) => {
    const { host, port, secure, auth } = config;

    // Create connection
    const socket = secure
      ? // @ts-ignore
      tlsConnect(port, host, { rejectUnauthorized: false })
      : // @ts-ignore
      createConnection(port, host);

    let buffer = '';
    let step = 0;
    const messageId = `${getRuntime().crypto.randomUUID()}@yama`;

    // Build email content
    const boundary = `----=_Part_${getRuntime().crypto.randomUUID().replace(/-/g, '')}`;
    const emailContent = [
      `From: ${from}`,
      `To: ${to.join(', ')}`,
      `Subject: ${subject}`,
      `Message-ID: <${messageId}>`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      text || html.replace(/<[^>]+>/g, ''),
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      '',
      html,
      '',
      `--${boundary}--`,
    ].join('\r\n');

    const commands = [
      `EHLO localhost`,
      ...(auth ? [`AUTH LOGIN`] : []),
      ...(auth ? [base64Encode(auth.user)] : []),
      ...(auth ? [base64Encode(auth.pass)] : []),
      `MAIL FROM:<${from.match(/<([^>]+)>/)?.[1] || from}>`,
      ...to.map(addr => `RCPT TO:<${addr.match(/<([^>]+)>/)?.[1] || addr}>`),
      `DATA`,
    ];

    const send = (data: string) => {
      socket.write(data + '\r\n');
    };

    socket.on('data', (data: any) => {
      buffer += data.toString();

      // Wait for complete response
      if (!buffer.includes('\r\n')) return;

      const lines = buffer.split('\r\n');
      const lastLine = lines[lines.length - 2] || '';
      buffer = '';

      // Check for error responses
      if (lastLine.startsWith('4') || lastLine.startsWith('5')) {
        socket.end();
        reject(new Error(`SMTP Error: ${lastLine}`));
        return;
      }

      // Process next command
      if (step < commands.length) {
        send(commands[step++]);
      } else if (lastLine.startsWith('354')) {
        // Ready for data
        send(emailContent);
        send('.');
      } else if (lastLine.startsWith('250') && step >= commands.length) {
        // Email sent successfully
        send('QUIT');
        socket.end();
        resolve({ messageId });
      }
    });

    socket.on('error', (err: any) => {
      reject(err);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP connection timeout'));
    });

    socket.setTimeout(30000);
  });
}

// ============================================================================
// SMTP Email API Implementation
// ============================================================================

class SMTPEmailAPI implements EmailAPI {
  private config: EmailProviderConfig;
  private context: ProviderContext;
  private devCapture: ReturnType<typeof createDevCapture> | null = null;
  private templatesDir: string;

  get isDevMode(): boolean {
    return this.devCapture !== null;
  }

  constructor(config: EmailProviderConfig, context: ProviderContext) {
    this.config = config;
    this.context = context;
    this.templatesDir = config.templates
      ? getRuntime().path.join(context.projectDir, config.templates)
      : '';

    // Initialize dev capture if enabled
    if (context.isDev && (config.dev?.capture !== false)) {
      const emailsDir = getRuntime().path.join(context.projectDir, '.yama', 'emails');
      this.devCapture = createDevCapture({
        projectDir: context.projectDir,
        emailsDir,
        logger: context.log,
      });
    }
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const from = options.from || this.config.from;
    const to = Array.isArray(options.to) ? options.to : [options.to];
    const { subject, html, text } = options;

    if (!html && !text) {
      return { success: false, error: 'Email must have html or text content' };
    }

    // Dev capture mode
    if (this.devCapture) {
      const capturedEmail: CapturedEmail = {
        id: getRuntime().crypto.randomUUID(),
        to,
        from,
        subject,
        html,
        text,
        sentAt: new Date(),
        links: html ? extractLinks(html) : [],
      };

      await this.devCapture.capture(capturedEmail);

      return { success: true, messageId: capturedEmail.id };
    }

    // Production: Send via SMTP
    if (!this.config.smtp) {
      return { success: false, error: 'SMTP configuration required for sending emails' };
    }

    try {
      const result = await sendSMTP(
        this.config.smtp,
        from,
        to,
        subject,
        html || '',
        text
      );

      return { success: true, messageId: result.messageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async sendTemplate(
    template: string,
    to: string | string[],
    data: Record<string, unknown>,
    options?: Partial<EmailOptions>
  ): Promise<EmailResult> {
    // Get template content
    let templateContent = BUILT_IN_TEMPLATES[template];

    // Check for custom template file
    if (this.templatesDir) {
      const customPath = getRuntime().path.join(this.templatesDir, `${template}.html`);
      if (await getRuntime().fs.exists(customPath)) {
        templateContent = await getRuntime().fs.readTextFile(customPath);
      }
    }

    if (!templateContent) {
      return { success: false, error: `Template '${template}' not found` };
    }

    // Add default data
    const fullData = {
      year: new Date().getFullYear(),
      appName: 'App',
      expiresIn: '15 minutes',
      ...data,
    };

    // Render template
    const html = renderTemplate(templateContent, fullData);

    // Determine subject based on template
    const defaultSubjects: Record<string, string> = {
      'verify-link': 'Verify your email address',
      'verify-code': 'Your verification code',
      'password-reset': 'Reset your password',
      'welcome': `Welcome to ${fullData.appName}!`,
      'account-locked': 'Account Security Alert',
    };

    return this.send({
      to,
      subject: options?.subject || defaultSubjects[template] || 'Email from App',
      html,
      ...options,
    });
  }

  async getCapturedEmails(): Promise<CapturedEmail[]> {
    if (!this.devCapture) {
      return [];
    }
    return this.devCapture.getAll();
  }

  async clearCapturedEmails(): Promise<void> {
    if (this.devCapture) {
      await this.devCapture.clear();
    }
  }
}

// ============================================================================
// SMTP Email Provider
// ============================================================================

class SMTPEmailProvider implements Provider<EmailProviderConfig, EmailAPI> {
  readonly type = 'email' as const;
  readonly adapter = 'smtp';
  readonly version = '1.0.0';

  private api: SMTPEmailAPI | null = null;

  async init(config: EmailProviderConfig, context: ProviderContext): Promise<EmailAPI> {
    this.api = new SMTPEmailAPI(config, context);

    // Wait for async init if needed (API constructor is sync but setup was async in devCapture)
    // DevCapture creation in constructor used async calls? NO. constructor must be sync.
    // Ah, `createDevCapture` in constructor used `fs.existsSync` previously. 
    // Now I updated `createDevCapture` to be logical wrapper, but the *constructor* called it.
    // The `createDevCapture` now returns an object with async methods. Constructor is fine.

    if (context.isDev && (config.dev?.capture !== false)) {
      context.log.info('Email capture enabled', {
        path: getRuntime().path.join(context.projectDir, '.yama', 'emails'),
        ui: config.dev?.ui !== false ? '/__yama/emails' : 'disabled',
      });
    } else {
      context.log.info('Email provider initialized', {
        from: config.from,
        smtpHost: config.smtp?.host,
      });
    }

    return this.api;
  }

  getAPI(): EmailAPI {
    if (!this.api) {
      throw new Error('Email provider not initialized. Call init() first.');
    }
    return this.api;
  }

  isInitialized(): boolean {
    return this.api !== null;
  }

  async healthCheck() {
    if (!this.api) {
      return { healthy: false, error: 'Not initialized' };
    }

    return {
      healthy: true,
      details: {
        devMode: this.api.isDevMode,
        adapter: 'smtp',
      },
    };
  }
}

// ============================================================================
// Register Adapter
// ============================================================================

registerAdapter('email', 'smtp', () => new SMTPEmailProvider());

// ============================================================================
// Exports
// ============================================================================

export { SMTPEmailProvider, SMTPEmailAPI };
export { renderTemplate, extractLinks };
export { BUILT_IN_TEMPLATES };
