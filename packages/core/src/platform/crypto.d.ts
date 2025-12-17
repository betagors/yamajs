export interface CryptoProvider {
    randomBytes(length: number): Uint8Array;
    randomInt(min: number, max: number): number;
    timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}
export interface PasswordHasher {
    hash(password: string, saltRounds?: number): Promise<string>;
    verify(password: string, hash: string): Promise<boolean>;
}
export declare function setCryptoProvider(provider: CryptoProvider | null): void;
export declare function setPasswordHasher(hasher: PasswordHasher | null): void;
export declare function getCryptoProvider(): CryptoProvider;
export declare function getPasswordHasher(): Promise<PasswordHasher>;
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
export declare class TokenExpiredError extends Error {
    expiredAt: Date;
    constructor(message: string, expiredAt: Date);
}
export declare class JsonWebTokenError extends Error {
    constructor(message: string);
}
export declare function setTokenSigner(signer: TokenSigner | null): void;
export declare function getTokenSigner(): Promise<TokenSigner>;
//# sourceMappingURL=crypto.d.ts.map