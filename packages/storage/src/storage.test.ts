import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Storage } from './storage';
import type { StorageAdapter, UploadResult, StorageMetadata } from '@yamajs/kernel';

// Mock adapter for testing
function createMockAdapter(): StorageAdapter {
    const store = new Map<string, { data: Buffer; metadata: StorageMetadata }>();

    return {
        async upload(key: string, data: Buffer | ReadableStream<Uint8Array>, options?: any): Promise<UploadResult> {
            const buffer = data instanceof Buffer ? data : Buffer.from('mock');
            const metadata: StorageMetadata = {
                key,
                size: buffer.length,
                contentType: options?.contentType,
                lastModified: new Date(),
                etag: 'mock-etag',
            };
            store.set(key, { data: buffer, metadata });
            return {
                key,
                size: buffer.length,
                etag: 'mock-etag',
            };
        },

        async download(key: string): Promise<Buffer> {
            const item = store.get(key);
            if (!item) {
                throw new Error(`Object ${key} not found`);
            }
            return item.data;
        },

        async delete(key: string): Promise<void> {
            store.delete(key);
        },

        async exists(key: string): Promise<boolean> {
            return store.has(key);
        },

        async getUrl(key: string, expiresIn?: number): Promise<string> {
            return `https://example.com/${key}?expires=${expiresIn || 3600}`;
        },

        async list(prefix?: string): Promise<string[]> {
            const keys = Array.from(store.keys());
            if (prefix) {
                return keys.filter((k) => k.startsWith(prefix));
            }
            return keys;
        },

        async getMetadata(key: string): Promise<StorageMetadata | null> {
            const item = store.get(key);
            return item ? item.metadata : null;
        },

        async copy(sourceKey: string, destKey: string): Promise<void> {
            const item = store.get(sourceKey);
            if (!item) {
                throw new Error(`Source ${sourceKey} not found`);
            }
            store.set(destKey, { ...item });
        },
    };
}

describe('Storage', () => {
    let adapter: StorageAdapter;
    let storage: Storage;

    beforeEach(() => {
        adapter = createMockAdapter();
        storage = new Storage(adapter);
    });

    describe('Core API', () => {
        it('should upload a file', async () => {
            const data = Buffer.from('test data');
            const result = await storage.put('test.txt', data, {
                contentType: 'text/plain',
            });

            expect(result.key).toBe('test.txt');
            expect(result.size).toBe(data.length);
        });

        it('should download a file', async () => {
            const data = Buffer.from('test data');
            await storage.put('test.txt', data);

            const downloaded = await storage.get('test.txt');
            expect(downloaded).toBeInstanceOf(Buffer);
            expect((downloaded as Buffer).toString()).toBe('test data');
        });

        it('should delete a file', async () => {
            const data = Buffer.from('test data');
            await storage.put('test.txt', data);

            await storage.delete('test.txt');

            const exists = await storage.exists('test.txt');
            expect(exists).toBe(false);
        });

        it('should check if file exists', async () => {
            const data = Buffer.from('test data');
            await storage.put('test.txt', data);

            const exists = await storage.exists('test.txt');
            expect(exists).toBe(true);

            const notExists = await storage.exists('nonexistent.txt');
            expect(notExists).toBe(false);
        });

        it('should get file metadata', async () => {
            const data = Buffer.from('test data');
            await storage.put('test.txt', data, { contentType: 'text/plain' });

            const meta = await storage.stat('test.txt');
            expect(meta).not.toBeNull();
            expect(meta!.key).toBe('test.txt');
            expect(meta!.size).toBe(data.length);
            expect(meta!.contentType).toBe('text/plain');
        });

        it('should generate a URL', async () => {
            const url = await storage.url('test.txt');
            expect(url).toContain('test.txt');
        });

        it('should list files', async () => {
            await storage.put('file1.txt', Buffer.from('test'));
            await storage.put('file2.txt', Buffer.from('test'));
            await storage.put('dir/file3.txt', Buffer.from('test'));

            const keys: string[] = [];
            for await (const key of storage.list()) {
                keys.push(key);
            }

            expect(keys).toContain('file1.txt');
            expect(keys).toContain('file2.txt');
            expect(keys).toContain('dir/file3.txt');
        });

        it('should list files with prefix', async () => {
            await storage.put('dir/file1.txt', Buffer.from('test'));
            await storage.put('dir/file2.txt', Buffer.from('test'));
            await storage.put('other/file3.txt', Buffer.from('test'));

            const keys: string[] = [];
            for await (const key of storage.list({ prefix: 'dir/' })) {
                keys.push(key);
            }

            expect(keys).toHaveLength(2);
            expect(keys).toContain('dir/file1.txt');
            expect(keys).toContain('dir/file2.txt');
            expect(keys).not.toContain('other/file3.txt');
        });

        it('should copy a file', async () => {
            const data = Buffer.from('test data');
            await storage.put('source.txt', data);

            await storage.copy('source.txt', 'dest.txt');

            const sourceExists = await storage.exists('source.txt');
            const destExists = await storage.exists('dest.txt');

            expect(sourceExists).toBe(true);
            expect(destExists).toBe(true);

            const destData = await storage.get('dest.txt');
            expect((destData as Buffer).toString()).toBe('test data');
        });
    });

    describe('Configuration', () => {
        it('should merge default options with put options', async () => {
            const uploadSpy = vi.spyOn(adapter, 'upload');

            const storage = new Storage(adapter, {
                defaults: {
                    cacheControl: 'max-age=3600',
                },
            });

            await storage.put('test.txt', Buffer.from('test'), {
                contentType: 'text/plain',
            });

            expect(uploadSpy).toHaveBeenCalledWith(
                'test.txt',
                expect.any(Buffer),
                expect.objectContaining({
                    cacheControl: 'max-age=3600',
                    contentType: 'text/plain',
                })
            );
        });

        it('should use CDN URL for public files', async () => {
            const storage = new Storage(adapter, {
                publicUrl: 'https://cdn.example.com',
            });

            const url = await storage.url('test.txt', { public: true });
            expect(url).toBe('https://cdn.example.com/test.txt');
        });

        it('should use signed URL when not public', async () => {
            const storage = new Storage(adapter, {
                publicUrl: 'https://cdn.example.com',
            });

            const url = await storage.url('test.txt', { expires: 3600 });
            expect(url).toContain('example.com/test.txt');
            expect(url).toContain('expires=3600');
        });

        it('should use default expiry for signed URLs', async () => {
            const getUrlSpy = vi.spyOn(adapter, 'getUrl');

            const storage = new Storage(adapter, {
                defaultExpiry: 7200,
            });

            await storage.url('test.txt');
            expect(getUrlSpy).toHaveBeenCalledWith('test.txt', 7200);
        });
    });

    describe('Hooks', () => {
        it('should call before:put hook', async () => {
            const hook = vi.fn();
            storage.on('before:put', hook);

            const data = Buffer.from('test');
            await storage.put('test.txt', data);

            expect(hook).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: 'test.txt',
                    data,
                })
            );
        });

        it('should call after:put hook', async () => {
            const hook = vi.fn();
            storage.on('after:put', hook);

            await storage.put('test.txt', Buffer.from('test'));

            expect(hook).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: 'test.txt',
                    result: expect.objectContaining({
                        key: 'test.txt',
                    }),
                })
            );
        });

        it('should call before:get hook', async () => {
            const hook = vi.fn();
            await storage.put('test.txt', Buffer.from('test'));

            storage.on('before:get', hook);
            await storage.get('test.txt');

            expect(hook).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: 'test.txt',
                })
            );
        });

        it('should call after:get hook', async () => {
            const hook = vi.fn();
            await storage.put('test.txt', Buffer.from('test'));

            storage.on('after:get', hook);
            await storage.get('test.txt');

            expect(hook).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: 'test.txt',
                    result: expect.any(Buffer),
                })
            );
        });

        it('should call before:delete hook', async () => {
            const hook = vi.fn();
            await storage.put('test.txt', Buffer.from('test'));

            storage.on('before:delete', hook);
            await storage.delete('test.txt');

            expect(hook).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: 'test.txt',
                })
            );
        });

        it('should call after:delete hook', async () => {
            const hook = vi.fn();
            await storage.put('test.txt', Buffer.from('test'));

            storage.on('after:delete', hook);
            await storage.delete('test.txt');

            expect(hook).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: 'test.txt',
                })
            );
        });

        it('should call multiple hooks in order', async () => {
            const calls: number[] = [];

            storage.on('before:put', async () => {
                calls.push(1);
            });
            storage.on('before:put', async () => {
                calls.push(2);
            });

            await storage.put('test.txt', Buffer.from('test'));

            expect(calls).toEqual([1, 2]);
        });

        it('should support async hooks', async () => {
            let hookCalled = false;

            storage.on('after:put', async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                hookCalled = true;
            });

            await storage.put('test.txt', Buffer.from('test'));

            expect(hookCalled).toBe(true);
        });
    });

    describe('Extensions', () => {
        it('should register an extension', () => {
            const extension = {
                name: 'test-extension',
                customMethod() {
                    return 'custom';
                },
            };

            storage.use(extension);

            // TypeScript doesn't know about dynamic methods, so we cast
            expect((storage as any).customMethod()).toBe('custom');
        });

        it('should call extension setup', () => {
            const setupFn = vi.fn();
            const extension = {
                setup: setupFn,
            };

            storage.use(extension);

            expect(setupFn).toHaveBeenCalledWith(storage);
        });

        it('should allow extensions to register hooks', async () => {
            let purged = false;

            const cdnExtension = {
                purgeCache(key: string) {
                    purged = true;
                    return Promise.resolve();
                },
                setup(storage: Storage) {
                    storage.on('after:put', async ({ key }) => {
                        await this.purgeCache(key!);
                    });
                },
            };

            storage.use(cdnExtension);
            await storage.put('test.txt', Buffer.from('test'));

            expect(purged).toBe(true);
        });

        it('should allow calling extension methods', () => {
            const extension = {
                getMessage() {
                    return 'Hello from extension';
                },
            };

            storage.use(extension);

            expect((storage as any).getMessage()).toBe('Hello from extension');
        });

        it('should support chaining', () => {
            const ext1 = { name: 'ext1' };
            const ext2 = { name: 'ext2' };

            const result = storage.use(ext1).use(ext2);

            expect(result).toBe(storage);
        });
    });

    describe('Smart URL Generation', () => {
        it('should return CDN URL for public files when publicUrl is set', async () => {
            const storage = new Storage(adapter, {
                publicUrl: 'https://cdn.example.com',
            });

            const url = await storage.url('test.txt', { public: true });
            expect(url).toBe('https://cdn.example.com/test.txt');
        });

        it('should return signed URL when expires is set even with publicUrl', async () => {
            const storage = new Storage(adapter, {
                publicUrl: 'https://cdn.example.com',
            });

            const url = await storage.url('test.txt', {
                public: true,
                expires: 3600,
            });

            expect(url).not.toBe('https://cdn.example.com/test.txt');
            expect(url).toContain('expires=3600');
        });

        it('should call url hooks', async () => {
            const beforeHook = vi.fn();
            const afterHook = vi.fn();

            storage.on('before:url', beforeHook);
            storage.on('after:url', afterHook);

            await storage.url('test.txt');

            expect(beforeHook).toHaveBeenCalled();
            expect(afterHook).toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty list', async () => {
            const keys: string[] = [];
            for await (const key of storage.list()) {
                keys.push(key);
            }

            expect(keys).toHaveLength(0);
        });

        it('should return null for non-existent file metadata', async () => {
            const meta = await storage.stat('nonexistent.txt');
            expect(meta).toBeNull();
        });

        it('should handle buffer data in put', async () => {
            const buffer = Buffer.from('test data');
            const result = await storage.put('test.txt', buffer);

            expect(result.key).toBe('test.txt');
        });

        it('should preserve hook context modifications', async () => {
            let capturedContext: any;

            storage.on('before:put', async (context) => {
                capturedContext = { ...context };
            });

            const data = Buffer.from('test');
            await storage.put('test.txt', data, { contentType: 'text/plain' });

            expect(capturedContext.key).toBe('test.txt');
            expect(capturedContext.options.contentType).toBe('text/plain');
        });
    });
});
