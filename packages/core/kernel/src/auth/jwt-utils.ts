
import { getRuntime } from "../platform/index.js";

function base64UrlEncode(data: Uint8Array | string): string {
    const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    // Basic base64 implementation (polyfilled if needed in browser, but node supports Buffer)
    // Kernel relies on generic JS.
    let str = "";
    for (let i = 0; i < buffer.length; i++) {
        str += String.fromCharCode(buffer[i]);
    }
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    const decoded = atob(str);
    // return as string
    return decoded;
}

export class JsonWebTokenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JsonWebTokenError';
    }
}

export class TokenExpiredError extends JsonWebTokenError {
    public expiredAt: Date;
    constructor(message: string, expiredAt: Date) {
        super(message);
        this.name = 'TokenExpiredError';
        this.expiredAt = expiredAt;
    }
}

export interface SignOptions {
    expiresIn?: string | number;
    issuer?: string;
    audience?: string | string[];
    algorithm?: string;
}

export interface VerifyOptions {
    algorithms?: string[];
    issuer?: string;
    audience?: string | string[];
}

export async function getTokenSigner() {
    return {
        sign: async (payload: any, secret: string, options: SignOptions = {}) => {
            const header = {
                alg: 'HS256',
                typ: 'JWT',
            };

            const now = Math.floor(Date.now() / 1000);

            // Clone payload
            const claims = { ...payload };

            // Handle exp
            if (options.expiresIn) {
                let seconds = 0;
                if (typeof options.expiresIn === 'number') {
                    seconds = options.expiresIn;
                } else {
                    // Simple parser or assume seconds if number-like, fail for now if complex string
                    // Reusing parseDuration logic from jwt.ts effectively requires duplication or moving it here.
                    // For now, let's assume caller handles duration parsing OR we support basic s/m/h
                    const match = options.expiresIn.match(/^(\d+)(s|m|h|d)?$/);
                    if (match) {
                        const val = parseInt(match[1]);
                        const unit = match[2] || 's';
                        if (unit === 's') seconds = val;
                        if (unit === 'm') seconds = val * 60;
                        if (unit === 'h') seconds = val * 3600;
                        if (unit === 'd') seconds = val * 86400;
                    }
                }
                claims.exp = now + seconds;
            }

            if (options.issuer) claims.iss = options.issuer;
            if (options.audience) claims.aud = options.audience;

            const encodedHeader = base64UrlEncode(JSON.stringify(header));
            const encodedPayload = base64UrlEncode(JSON.stringify(claims));

            const signatureInput = `${encodedHeader}.${encodedPayload}`;
            const signatureBytes = await getRuntime().crypto.hmac('SHA-256', secret, signatureInput);
            const encodedSignature = base64UrlEncode(signatureBytes);

            return `${signatureInput}.${encodedSignature}`;
        },

        verify: async (token: string, secret: string, options: VerifyOptions = {}) => {
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new JsonWebTokenError('jwt malformed');
            }

            const [encodedHeader, encodedPayload, encodedSignature] = parts;

            // Verify signature
            const signatureInput = `${encodedHeader}.${encodedPayload}`;
            const expectedSignatureBytes = await getRuntime().crypto.hmac('SHA-256', secret, signatureInput);
            const expectedSignature = base64UrlEncode(expectedSignatureBytes);

            // Timing safe check? 
            // We compare base64 strings. It's mostly safe against timing if lengths match.
            // Ideally we compare bytes.
            // Let's rely on RuntimeAdapter.crypto.timingSafeEqual?
            // But timingSafeEqual takes string or Uint8Array. 
            // We have encodedSignature (string from user) and expectedSignature (string).

            // To be strict, convert encodedSignature back to bytes? Or strict compare expectedSignatureBytes vs decoded user sig.
            // For now, simply comparing strings via strict quality logic (not timing safe explicitly in JS without help).
            // But wait, RuntimeAdapter HAS timingSafeEqual.
            if (!getRuntime().crypto.timingSafeEqual(encodedSignature, expectedSignature)) {
                throw new JsonWebTokenError('invalid signature');
            }

            // Decode payload
            let payloadStr;
            try {
                payloadStr = base64UrlDecode(encodedPayload);
            } catch {
                throw new JsonWebTokenError('invalid token');
            }

            const payload = JSON.parse(payloadStr);

            // Verify claims
            const now = Math.floor(Date.now() / 1000);

            if (payload.exp && payload.exp < now) {
                throw new TokenExpiredError('jwt expired', new Date(payload.exp * 1000));
            }

            if (options.issuer && payload.iss !== options.issuer) {
                throw new JsonWebTokenError(`jwt issuer invalid. expected: ${options.issuer}`);
            }

            if (options.audience) {
                const aud = payload.aud;
                const audiences = Array.isArray(options.audience) ? options.audience : [options.audience];
                const tokenAudiences = Array.isArray(aud) ? aud : [aud];

                const hasMatch = tokenAudiences.some(a => audiences.includes(a));
                if (!hasMatch) {
                    throw new JsonWebTokenError(`jwt audience invalid. expected: ${audiences.join(', ')}`);
                }
            }

            return payload;
        }
    };
}
