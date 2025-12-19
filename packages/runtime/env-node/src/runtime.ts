
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { RuntimeAdapter } from '@yamajs/kernel';
// @ts-ignore
import bcrypt from 'bcryptjs';

export class NodeRuntime implements RuntimeAdapter {
    env = {
        get: (key: string) => process.env[key],
        set: (key: string, value: string) => { process.env[key] = value; },
        delete: (key: string) => { delete process.env[key]; },
        getAll: () => process.env,
        cwd: () => process.cwd(),
    };

    path = {
        join: path.join,
        resolve: path.resolve,
        dirname: path.dirname,
        basename: path.basename,
        extname: path.extname,
        isAbsolute: path.isAbsolute,
        sep: path.sep,
    };

    fs = {
        readTextFile: async (filePath: string) => fs.promises.readFile(filePath, 'utf8'),
        exists: async (filePath: string) => {
            try {
                await fs.promises.access(filePath);
                return true;
            } catch {
                return false;
            }
        },
        readDir: async (dirPath: string) => {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            return entries.map(e => ({
                name: e.name,
                isDirectory: e.isDirectory(),
                isFile: e.isFile(),
            }));
        },
        writeTextFile: async (filePath: string, content: string) => {
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            await fs.promises.writeFile(filePath, content, 'utf8');
        },
        readFile: async (filePath: string) => {
            return await fs.promises.readFile(filePath);
        },
        writeFile: async (filePath: string, content: Uint8Array) => {
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            await fs.promises.writeFile(filePath, content);
        },
        mkdir: async (dirPath: string) => {
            await fs.promises.mkdir(dirPath, { recursive: true });
        },
        remove: async (filePath: string) => {
            await fs.promises.rm(filePath, { recursive: true, force: true });
        },
        stat: async (filePath: string) => {
            try {
                const stat = await fs.promises.stat(filePath);
                return { size: stat.size, mtime: stat.mtime };
            } catch {
                return null;
            }
        },
    };

    crypto = {
        randomUUID: () => crypto.randomUUID(),
        randomBytes: (size: number) => new Uint8Array(crypto.randomBytes(size)),
        hash: async (algorithm: 'SHA-256' | 'SHA-512', data: string | Uint8Array) => {
            const algoMap = {
                'SHA-256': 'sha256',
                'SHA-512': 'sha512'
            };
            const hash = crypto.createHash(algoMap[algorithm]);
            hash.update(data);
            return hash.digest('hex');
        },
        hmac: async (algorithm: 'SHA-256' | 'SHA-512', key: string | Uint8Array, data: string | Uint8Array) => {
            const algoMap = {
                'SHA-256': 'sha256',
                'SHA-512': 'sha512'
            };
            const hmac = crypto.createHmac(algoMap[algorithm], key);
            hmac.update(data);
            return new Uint8Array(hmac.digest());
        },
        timingSafeEqual: (a: string | Uint8Array, b: string | Uint8Array) => {
            const bufA = typeof a === 'string' ? Buffer.from(a) : a;
            const bufB = typeof b === 'string' ? Buffer.from(b) : b;

            if (bufA.length !== bufB.length) return false;

            // @ts-ignore - Node crypto types vs Kernel types mismatch handling
            return crypto.timingSafeEqual(bufA, bufB);
        },
        hashPassword: async (password: string, saltRounds: number = 10) => {
            return bcrypt.hash(password, saltRounds);
        },
        verifyPassword: async (password: string, hash: string) => {
            return bcrypt.compare(password, hash);
        }
    };
}
