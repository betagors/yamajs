import { YamaError, YamaErrorOptions } from '../base.js';

/**
 * Options specific to rate limit errors
 */
export interface RateLimitErrorOptions extends Omit<YamaErrorOptions, 'statusCode' | 'code'> {
  /** Seconds until the rate limit resets */
  retryAfter?: number;
  /** Maximum requests allowed in the window */
  limit?: number;
  /** Remaining requests in the current window */
  remaining?: number;
  /** Timestamp when the rate limit resets */
  resetAt?: string;
}

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
  /** Seconds until the rate limit resets */
  readonly retryAfter?: number;
  
  /** Maximum requests allowed in the window */
  readonly limit?: number;
  
  /** Remaining requests in the current window */
  readonly remaining?: number;
  
  /** Timestamp when the rate limit resets */
  readonly resetAt?: string;

  constructor(message: string, options: RateLimitErrorOptions = {}) {
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

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
      limit: this.limit,
      remaining: this.remaining,
      resetAt: this.resetAt,
    };
  }
}
