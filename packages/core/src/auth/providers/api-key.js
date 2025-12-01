/**
 * API key auth provider handler
 */
const apiKeyHandler = {
    async validate(headers, config) {
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
            }
            catch (error) {
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
//# sourceMappingURL=api-key.js.map