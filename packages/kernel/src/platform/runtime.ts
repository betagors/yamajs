
/**
 * Yama Runtime Adapter Interface
 * 
 * Defines the strict boundary between the Yama Kernel (pure logic)
 * and the underlying Runtime Environment (Node, Deno, Bun, Edge).
 * 
 * The Kernel MUST NOT use global process, fs, or crypto directly.
 * It must access them through this adapter.
 */

export interface RuntimeAdapter {
    env: EnvAdapter;
    path: PathAdapter;
    fs: FileSystemAdapter;
    crypto: CryptoAdapter;
}

export interface EnvAdapter {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    getAll(): Record<string, string | undefined>;
    cwd(): string;
}

export interface PathAdapter {
    join(...paths: string[]): string;
    resolve(...paths: string[]): string;
    dirname(path: string): string;
    basename(path: string, ext?: string): string;
    extname(path: string): string;
    isAbsolute(path: string): boolean;
    sep: string;
}

export interface FileSystemAdapter {
    /**
     * Read a text file. Throws if not found or no permission.
     */
    readTextFile(path: string): Promise<string>;

    /**
     * Check if a file exists.
     */
    exists(path: string): Promise<boolean>;

    /**
     * Read a directory.
     * Returns minimal info needed for scanning configs/plugins.
     */
    readDir(path: string): Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>;

    /**
     * Read a file as binary.
     */
    readFile(path: string): Promise<Uint8Array>;

    /**
     * Write binary data to a file. Creates parent directories.
     */
    writeFile(path: string, content: Uint8Array): Promise<void>;

    /**
     * Write text to a file. Creates parent directories if needed.
     */
    writeTextFile(path: string, content: string): Promise<void>;

    /**
     * Create a directory (recursive).
     */
    mkdir(path: string): Promise<void>;

    /**
     * Remove a file or directory.
     */
    remove(path: string): Promise<void>;

    /**
     * Get file statistics. Returns null if not found.
     */
    stat(path: string): Promise<{ size: number; mtime: Date } | null>;
}

export interface CryptoAdapter {
    /**
     * Generate a random UUID (v4)
     */
    randomUUID(): string;

    /**
     * Generate cryptographically strong random values
     */
    randomBytes(size: number): Uint8Array;

    /**
     * Hash a value (SHA-256, etc)
     */
    hash(algorithm: 'SHA-256' | 'SHA-512', data: string | Uint8Array): Promise<string>;

    /**
     * Create HMAC signature
     */
    hmac(algorithm: 'SHA-256' | 'SHA-512', key: string | Uint8Array, data: string | Uint8Array): Promise<Uint8Array>;

    /**
     * Timing safe comparison
     */
    timingSafeEqual(a: string | Uint8Array, b: string | Uint8Array): boolean;

    /**
     * Hash a password (e.g. using bcrypt)
     */
    hashPassword(password: string, saltRounds?: number): Promise<string>;

    /**
     * Verify a password against a hash
     */
    verifyPassword(password: string, hash: string): Promise<boolean>;
}
