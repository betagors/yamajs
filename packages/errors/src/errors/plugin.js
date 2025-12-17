import { YamaError } from '../base.js';
/**
 * Error thrown when a plugin operation fails.
 *
 * Default status code: 500 Internal Server Error
 *
 * @example
 * ```typescript
 * throw new PluginError('Plugin initialization failed', {
 *   code: ErrorCodes.PLUGIN_INIT_FAILED,
 *   context: { pluginName: '@yamajs/postgres' },
 *   cause: originalError,
 *   suggestions: [
 *     'Check that the plugin is installed correctly',
 *     'Verify the plugin configuration in yama.yaml'
 *   ]
 * });
 * ```
 */
export class PluginError extends YamaError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: options.code || 'PLUGIN_ERROR',
            statusCode: 500,
        });
    }
}
//# sourceMappingURL=plugin.js.map