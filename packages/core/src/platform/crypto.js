let cryptoProvider = detectWebCryptoProvider();
let passwordHasher = null;
export function setCryptoProvider(provider) {
    cryptoProvider = provider;
}
export function setPasswordHasher(hasher) {
    passwordHasher = hasher;
}
export function getCryptoProvider() {
    const provider = cryptoProvider ?? detectWebCryptoProvider();
    if (!provider) {
        throw new Error("Crypto provider not configured for @yamajs/core. Supply one via setCryptoProvider (e.g., from @yamajs/node or a Web Crypto host).");
    }
    cryptoProvider = provider;
    return provider;
}
export async function getPasswordHasher() {
    if (passwordHasher) {
        return passwordHasher;
    }
    passwordHasher = await createBcryptPasswordHasher();
    return passwordHasher;
}
function detectWebCryptoProvider() {
    const crypto = globalThis.crypto;
    if (!crypto || typeof crypto.getRandomValues !== "function") {
        return null;
    }
    return {
        randomBytes: (length) => {
            const buf = new Uint8Array(length);
            crypto.getRandomValues(buf);
            return buf;
        },
        randomInt: (min, max) => {
            if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min) {
                throw new Error("randomInt expects integer min < max");
            }
            const range = max - min;
            const buf = new Uint32Array(1);
            crypto.getRandomValues(buf);
            return min + (buf[0] % range);
        },
        timingSafeEqual: (a, b) => {
            if (a.length !== b.length) {
                return false;
            }
            let result = 0;
            for (let i = 0; i < a.length; i++) {
                result |= a[i] ^ b[i];
            }
            return result === 0;
        },
    };
}
// Standardized Auth Errors for the platform to use
export class TokenExpiredError extends Error {
    constructor(message, expiredAt) {
        super(message);
        this.expiredAt = expiredAt;
        this.name = "TokenExpiredError";
    }
}
export class JsonWebTokenError extends Error {
    constructor(message) {
        super(message);
        this.name = "JsonWebTokenError";
    }
}
let tokenSigner = null;
export function setTokenSigner(signer) {
    tokenSigner = signer;
}
export async function getTokenSigner() {
    if (tokenSigner) {
        return tokenSigner;
    }
    tokenSigner = await createJwtTokenSigner();
    return tokenSigner;
}
async function createJwtTokenSigner() {
    try {
        const jwt = await import("jsonwebtoken");
        return {
            async sign(payload, secret, options) {
                // Cast options to jwt types implicitly by passing them through
                return new Promise((resolve, reject) => {
                    jwt.default.sign(payload, secret, options, (err, token) => {
                        if (err)
                            reject(err);
                        else
                            resolve(token);
                    });
                });
            },
            async verify(token, secret, options) {
                return new Promise((resolve, reject) => {
                    jwt.default.verify(token, secret, options, (err, decoded) => {
                        if (err) {
                            if (err instanceof jwt.TokenExpiredError) {
                                reject(new TokenExpiredError(err.message, err.expiredAt));
                            }
                            else if (err instanceof jwt.JsonWebTokenError) {
                                reject(new JsonWebTokenError(err.message));
                            }
                            else {
                                reject(err);
                            }
                        }
                        else {
                            resolve(decoded);
                        }
                    });
                });
            },
            decode(token) {
                const decoded = jwt.default.decode(token);
                return typeof decoded === 'object' ? decoded : null;
            }
        };
    }
    catch (error) {
        throw new Error("Token signing requires jsonwebtoken. Provide a signer via setTokenSigner() or install jsonwebtoken in your runtime.");
    }
}
async function createBcryptPasswordHasher() {
    try {
        const bcrypt = await import("bcryptjs");
        return {
            hash: (password, saltRounds = 12) => bcrypt.default ? bcrypt.default.hash(password, saltRounds) : bcrypt.hash(password, saltRounds),
            verify: (password, hash) => bcrypt.default ? bcrypt.default.compare(password, hash) : bcrypt.compare(password, hash),
        };
    }
    catch (error) {
        throw new Error("Password hashing requires bcryptjs. Provide a password hasher via setPasswordHasher() or install bcryptjs in your runtime.");
    }
}
//# sourceMappingURL=crypto.js.map