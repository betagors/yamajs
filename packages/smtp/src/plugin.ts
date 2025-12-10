import type { YamaPlugin, PluginContext } from "@betagors/yama-core";
import { createSMTPTransport, verifySMTPConnection, type SMTPConfig } from "./client.js";
import { createEmailService, type EmailService } from "./service.js";

/**
 * SMTP email plugin for Yama
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-smtp",
  category: "email",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(opts: Record<string, unknown>, context: PluginContext) {
    // Validate and extract SMTP configuration
    const config = opts as SMTPConfig;
    
    if (!config.host) {
      throw new Error("SMTP host is required");
    }
    
    // Create SMTP transport
    const transport = createSMTPTransport(config);
    
    // Verify connection (optional, but recommended)
    // Skip verification for Mailpit to avoid blocking startup
    const isMailpit = (config.host === "localhost" || config.host === "127.0.0.1") && config.port === 1025;
    
    if (!isMailpit) {
      try {
        const isValid = await verifySMTPConnection(transport);
        if (!isValid) {
          context.logger.warn("SMTP connection verification failed, but continuing anyway");
        } else {
          context.logger.info("SMTP connection verified successfully");
        }
      } catch (error) {
        context.logger.warn(
          `SMTP connection verification failed: ${error instanceof Error ? error.message : String(error)}`
        );
        // Don't throw - allow plugin to load even if verification fails
        // This allows for lazy connection initialization
      }
    } else {
      context.logger.info("Mailpit detected - skipping connection verification");
    }
    
    // Create email service
    const emailService = createEmailService(transport, config.from);
    
    // Register email service in context
    context.registerService("email", emailService);
    context.logger.info(`Registered email service for @betagors/yama-smtp`);
    
    // Return plugin API
    const pluginApi = {
      transport,
      service: emailService,
      send: emailService.send.bind(emailService),
      sendBatch: emailService.sendBatch.bind(emailService),
      getDefaultFrom: emailService.getDefaultFrom.bind(emailService),
    };
    
    return pluginApi;
  },

  async onHealthCheck() {
    // Basic health check - in a real implementation, test SMTP connection
    return {
      healthy: true,
      details: {
        service: "smtp",
      },
    };
  },
};

export default plugin;



















