import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

/**
 * SMTP configuration options
 */
export interface SMTPConfig {
  /**
   * SMTP server hostname
   */
  host: string;
  
  /**
   * SMTP server port
   * @default 587
   */
  port?: number;
  
  /**
   * Use TLS/SSL
   * @default false
   */
  secure?: boolean;
  
  /**
   * Authentication credentials
   */
  auth?: {
    user: string;
    pass: string;
  };
  
  /**
   * Default sender email address
   */
  from?: string;
  
  /**
   * TLS options
   */
  tls?: {
    rejectUnauthorized?: boolean;
    ciphers?: string;
  };
  
  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout?: number;
  
  /**
   * Socket timeout in milliseconds
   */
  socketTimeout?: number;
  
  /**
   * Greeting timeout in milliseconds
   */
  greetingTimeout?: number;
}

/**
 * Check if the configuration is for Mailpit (local development)
 */
export function isMailpitConfig(config: SMTPConfig): boolean {
  return (
    (config.host === "localhost" || config.host === "127.0.0.1") &&
    config.port === 1025
  );
}

/**
 * Create SMTP transport with Mailpit auto-detection
 */
export function createSMTPTransport(config: SMTPConfig): Transporter {
  // Auto-detect Mailpit for local development
  const isMailpit = isMailpitConfig(config);
  
  if (isMailpit) {
    // Mailpit doesn't require authentication and uses plain connection
    return nodemailer.createTransport({
      host: config.host,
      port: config.port || 1025,
      secure: false, // Mailpit uses plain SMTP
      // No auth needed for Mailpit
      tls: {
        rejectUnauthorized: false, // Accept self-signed certs for local dev
      },
      connectionTimeout: config.connectionTimeout || 2000,
      socketTimeout: config.socketTimeout || 5000,
      greetingTimeout: config.greetingTimeout || 2000,
    });
  }
  
  // Production SMTP configuration
  const transportConfig: nodemailer.TransportOptions = {
    host: config.host,
    port: config.port || 587,
    secure: config.secure ?? false,
    auth: config.auth,
    tls: config.tls,
    connectionTimeout: config.connectionTimeout || 2000,
    socketTimeout: config.socketTimeout || 5000,
    greetingTimeout: config.greetingTimeout || 2000,
  };
  
  return nodemailer.createTransport(transportConfig);
}

/**
 * Verify SMTP connection
 */
export async function verifySMTPConnection(
  transport: Transporter
): Promise<boolean> {
  try {
    await transport.verify();
    return true;
  } catch (error) {
    return false;
  }
}

