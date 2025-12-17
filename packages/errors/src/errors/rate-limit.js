import { YamaError } from '../base.js';
/**
 * Error thrown when rate limit is exceeded.
 *
 * Default status code: 429 Too Many Requests
 *
 * @example
 * ```typescript
 * throw new RateLimitError('Too many requests', {
 *   retryAfter: 60,
 *   limit: 100,
 *   remaining: 0,
 *   resetAt: '2024-01-01T00:01:00.000Z'
 * });
 * ```
 */
export class RateLimitError extends YamaError {
    constructor(message, options = {}) {
        super(message, {
            ...options,
            code: 'RATE_LIMIT_EXCEEDED',
            statusCode: 429,
            context: {
                ...options.context,
                retryAfter: options.retryAfter,
                limit: options.limit,
                remaining: options.remaining,
                resetAt: options.resetAt,
            },
        });
        this.retryAfter = options.retryAfter;
        this.limit = options.limit;
        this.remaining = options.remaining;
        this.resetAt = options.resetAt;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter,
            limit: this.limit,
            remaining: this.remaining,
            resetAt: this.resetAt,
        };
    }
}
//# sourceMappingURL=rate-limit.js.map