export interface CryptoProvider {
  randomBytes(length: number): Uint8Array;
  randomInt(min: number, max: number): number;
  timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}

export interface PasswordHasher {
  hash(password: string, saltRounds?: number): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

let cryptoProvider: CryptoProvider | null = detectWebCryptoProvider();
let passwordHasher: PasswordHasher | null = null;

export function setCryptoProvider(provider: CryptoProvider | null): void {
  cryptoProvider = provider;
}

export function setPasswordHasher(hasher: PasswordHasher | null): void {
  passwordHasher = hasher;
}

export function getCryptoProvider(): CryptoProvider {
  const provider = cryptoProvider ?? detectWebCryptoProvider();
  if (!provider) {
    throw new Error(
      "Crypto provider not configured for @betagors/yama-core. Supply one via setCryptoProvider (e.g., from @betagors/yama-node or a Web Crypto host)."
    );
  }
  cryptoProvider = provider;
  return provider;
}

export async function getPasswordHasher(): Promise<PasswordHasher> {
  if (passwordHasher) {
    return passwordHasher;
  }
  passwordHasher = await createBcryptPasswordHasher();
  return passwordHasher;
}

function detectWebCryptoProvider(): CryptoProvider | null {
  const crypto = globalThis.crypto;
  if (!crypto || typeof crypto.getRandomValues !== "function") {
    return null;
  }

  return {
    randomBytes: (length: number): Uint8Array => {
      const buf = new Uint8Array(length);
      crypto.getRandomValues(buf);
      return buf;
    },
    randomInt: (min: number, max: number): number => {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min) {
        throw new Error("randomInt expects integer min < max");
      }
      const range = max - min;
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return min + (buf[0] % range);
    },
    timingSafeEqual: (a: Uint8Array, b: Uint8Array): boolean => {
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

// Token Signing Abstraction
export interface TokenSigner {
  sign(payload: object, secret: string, options?: SignOptions): Promise<string>;
  verify(token: string, secret: string, options?: VerifyOptions): Promise<object>;
  decode(token: string): object | null;
}

export interface SignOptions {
  expiresIn?: string | number;
  issuer?: string;
  audience?: string | string[];
  algorithm?: string;
  [key: string]: any;
}

export interface VerifyOptions {
  algorithms?: string[];
  issuer?: string | string[];
  audience?: string | string[];
  [key: string]: any;
}

// Standardized Auth Errors for the platform to use
export class TokenExpiredError extends Error {
  constructor(message: string, public expiredAt: Date) {
    super(message);
    this.name = "TokenExpiredError";
  }
}

export class JsonWebTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonWebTokenError";
  }
}

let tokenSigner: TokenSigner | null = null;

export function setTokenSigner(signer: TokenSigner | null): void {
  tokenSigner = signer;
}

export async function getTokenSigner(): Promise<TokenSigner> {
  if (tokenSigner) {
    return tokenSigner;
  }
  tokenSigner = await createJwtTokenSigner();
  return tokenSigner;
}

async function createJwtTokenSigner(): Promise<TokenSigner> {
  try {
    const jwt = await import("jsonwebtoken");

    return {
      async sign(payload: object, secret: string, options?: SignOptions): Promise<string> {
        // Cast options to jwt types implicitly by passing them through
        return new Promise((resolve, reject) => {
          jwt.default.sign(payload, secret, options as any, (err: Error | null, token: string | undefined) => {
            if (err) reject(err);
            else resolve(token!);
          });
        });
      },

      async verify(token: string, secret: string, options?: VerifyOptions): Promise<object> {
        return new Promise((resolve, reject) => {
          jwt.default.verify(token, secret, options as any, (err: Error | null, decoded: any) => {
            if (err) {
              if (err instanceof jwt.TokenExpiredError) {
                reject(new TokenExpiredError(err.message, err.expiredAt));
              } else if (err instanceof jwt.JsonWebTokenError) {
                reject(new JsonWebTokenError(err.message));
              } else {
                reject(err);
              }
            } else {
              resolve(decoded);
            }
          });
        });
      },

      decode(token: string): object | null {
        const decoded = jwt.default.decode(token);
        return typeof decoded === 'object' ? decoded : null;
      }
    };
  } catch (error) {
    throw new Error(
      "Token signing requires jsonwebtoken. Provide a signer via setTokenSigner() or install jsonwebtoken in your runtime."
    );
  }
}

async function createBcryptPasswordHasher(): Promise<PasswordHasher> {
  try {
    const bcrypt = await import("bcryptjs");
    return {
      hash: (password: string, saltRounds = 12) => bcrypt.default ? bcrypt.default.hash(password, saltRounds) : bcrypt.hash(password, saltRounds),
      verify: (password: string, hash: string) => bcrypt.default ? bcrypt.default.compare(password, hash) : bcrypt.compare(password, hash),
    };
  } catch (error) {
    throw new Error(
      "Password hashing requires bcryptjs. Provide a password hasher via setPasswordHasher() or install bcryptjs in your runtime."
    );
  }
}

