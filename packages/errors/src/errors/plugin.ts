import { YamaError, YamaErrorOptions } from '../base.js';

/**
 * Error thrown when a plugin operation fails.
 * 
 * Default status code: 500 Internal Server Error
 * 
 * @example
 * ```typescript
 * throw new PluginError('Plugin initialization failed', {
 *   code: ErrorCodes.PLUGIN_INIT_FAILED,
 *   context: { pluginName: '@betagors/yama-postgres' },
 *   cause: originalError,
 *   suggestions: [
 *     'Check that the plugin is installed correctly',
 *     'Verify the plugin configuration in yama.yaml'
 *   ]
 * });
 * ```
 */
export class PluginError extends YamaError {
  constructor(message: string, options: Omit<YamaErrorOptions, 'statusCode'> = {}) {
    super(message, {
      ...options,
      code: options.code || 'PLUGIN_ERROR',
      statusCode: 500,
    });
  }
}
