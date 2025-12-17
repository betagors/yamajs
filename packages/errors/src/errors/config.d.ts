import { YamaError, YamaErrorOptions } from '../base.js';
/**
 * Error thrown when configuration is invalid or missing.
 *
 * Default status code: 500 Internal Server Error
 *
 * @example
 * ```typescript
 * throw new ConfigurationError('Database configuration missing', {
 *   code: ErrorCodes.CONFIG_MISSING,
 *   context: { configKey: 'database.host' },
 *   suggestions: [
 *     'Add database.host to your yama.yaml configuration',
 *     'Set the DATABASE_HOST environment variable'
 *   ]
 * });
 * ```
 */
export declare class ConfigurationError extends YamaError {
    constructor(message: string, options?: Omit<YamaErrorOptions, 'statusCode'>);
}
//# sourceMappingURL=config.d.ts.map