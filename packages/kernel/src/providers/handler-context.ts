/**
 * Provider Handler Context Integration
 * 
 * Creates request-scoped handler context with all provider APIs injected.
 * This is used by the HTTP server to provide ctx.db, ctx.log, ctx.auth, etc.
 */
import type {
    ConfigAPI,
    DatabaseAPI,
    CacheAPI,
    EmailAPI,
    AuthAPI,
    StorageAPI,
    ProviderAPIs,
    JWTPayload,
} from './types.js';
import { getProviders } from './config-parser.js';
import { getSystemLogger } from './registry.js';
import { createContextLogger } from '@yamajs/logging';

// ============================================================================
// Handler Context Provider Interface
// ============================================================================

/**
 * Provider APIs available in handler context
 * These are the clean, request-scoped APIs injected into ctx
 */
export interface HandlerContextProviders {
    /** Configuration access */
    config: ConfigAPI;

    /** Request-scoped logger (with requestId bound) */
    log: import('@yamajs/logging').Logger;

    /** Database access */
    db: DatabaseAPI;

    /** Cache access */
    cache: CacheAPI;

    /** Email sending */
    email: EmailAPI;

    /** Authentication & authorization */
    auth: AuthAPI;

    /** File storage */
    storage: StorageAPI;
}

// ============================================================================
// Request Context Creation
// ============================================================================

/**
 * Create request-scoped provider context for a handler
 * This creates child loggers with request context
 * 
 * @param requestId - Unique request identifier for tracing
 */
export function createRequestContext(
    requestId: string
): HandlerContextProviders | null {
    const providers = getProviders();
    if (!providers) {
        return null;
    }

    // Create child logger with request context
    const requestLogger = createContextLogger(getSystemLogger(), { requestId });

    return {
        config: providers.config,
        log: requestLogger,
        db: providers.db,
        cache: providers.cache,
        email: providers.email,
        auth: providers.auth,
        storage: providers.storage,
    };
}

// ============================================================================
// Auth Middleware Helper
// ============================================================================

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | undefined {
    if (!authHeader) return undefined;

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match?.[1];
}

/**
 * Create auth middleware that validates tokens and sets user context
 */
export function createAuthMiddleware(providers: ProviderAPIs) {
    return async (
        headers: Record<string, string | undefined>,
        setUser: (user: JWTPayload) => void
    ): Promise<{ authenticated: boolean; user?: JWTPayload; error?: string }> => {
        const token = extractBearerToken(headers.authorization);

        if (!token) {
            return { authenticated: false };
        }

        try {
            const payload = await providers.auth.verifyAccessToken(token);

            if (!payload) {
                return { authenticated: false, error: 'Invalid token' };
            }

            // Set user in callback (for ctx.auth.user access)
            setUser(payload);

            return { authenticated: true, user: payload };
        } catch (error) {
            return {
                authenticated: false,
                error: error instanceof Error ? error.message : 'Token verification failed'
            };
        }
    };
}

// ============================================================================
// Provider Health Check Middleware
// ============================================================================

/**
 * Create a health check handler that reports provider status
 */
export async function createProviderHealthHandler() {
    const providers = getProviders();

    if (!providers) {
        return {
            status: 'error',
            error: 'Providers not initialized',
        };
    }

    const { getProvidersHealth } = await import('./registry.js');
    const health = await getProvidersHealth();

    const allHealthy = Object.values(health).every(h => h.healthy);

    return {
        status: allHealthy ? 'healthy' : 'degraded',
        providers: health,
    };
}

// Note: HandlerContextProviders is already exported via interface declaration above
