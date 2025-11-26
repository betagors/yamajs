import type { AuthProviderHandler, AuthResult } from "../types.js";
import type { ApiKeyAuthProvider, AuthContext } from "../../schemas.js";

/**
 * API key auth provider handler
 */
const apiKeyHandler: AuthProviderHandler = {
  async validate(
    headers: Record<string, string | undefined>,
    config: ApiKeyAuthProvider
  ): Promise<AuthResult> {
    const apiKey = headers[config.header.toLowerCase()];
    if (!apiKey) {
      return {
        valid: false,
        context: { authenticated: false },
        error: `No API key provided in ${config.header} header`,
      };
    }

    // If custom validator is provided, use it
    if (config.validate) {
      try {
        const isValid = await config.validate(apiKey);
        if (isValid) {
          return {
            valid: true,
            context: {
              authenticated: true,
              provider: "api-key",
            },
          };
        }
        return {
          valid: false,
          context: { authenticated: false },
          error: "Invalid API key",
        };
      } catch (error) {
        return {
          valid: false,
          context: { authenticated: false },
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // If no custom validator, accept any non-empty key
    // In production, you should always provide a validator
    if (apiKey.length > 0) {
      return {
        valid: true,
        context: {
          authenticated: true,
          provider: "api-key",
        },
      };
    }

    return {
      valid: false,
      context: { authenticated: false },
      error: "Empty API key provided",
    };
  },
};

export default apiKeyHandler;

