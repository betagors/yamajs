/**
 * Storage Provider Contract
 */

export interface StorageProviderConfig {
    adapter: 'local' | 's3';
    /** Base path for local storage */
    path?: string;
    /** Maximum file size (e.g., '10MB', '1GB') */
    maxFileSize?: string;
    /** Allowed MIME types (e.g., ['image/*', 'application/pdf']) */
    allowedTypes?: string[];

    /** Static file serving */
    serve?: {
        enabled?: boolean;
        path?: string;
    };

    /** S3 configuration */
    s3?: {
        bucket: string;
        region: string;
        accessKeyId?: string;
        secretAccessKey?: string;
        endpoint?: string;
    };
}

export interface UploadOptions {
    contentType?: string;
    contentDisposition?: string;
    metadata?: Record<string, string>;
    overwrite?: boolean;
}

export interface UploadResult {
    path: string;
    url: string;
    size: number;
    contentType?: string;
}

export interface FileInfo {
    path: string;
    size: number;
    isDirectory: boolean;
    modifiedAt: Date;
}

export interface FileMetadata {
    path: string;
    size: number;
    contentType?: string;
    modifiedAt: Date;
    metadata?: Record<string, string>;
}

export interface StorageAPI {
    /** Upload a file */
    upload(
        data: Uint8Array | ReadableStream<Uint8Array> | string,
        path: string,
        options?: UploadOptions
    ): Promise<UploadResult>;

    /** Download a file */
    download(path: string): Promise<Uint8Array>;

    /** Stream a file */
    stream(path: string): Promise<ReadableStream<Uint8Array>>;

    /** Get a URL for a file */
    getUrl(path: string, expiresIn?: number): Promise<string>;

    /** Delete a file */
    delete(path: string): Promise<void>;

    /** Check if a file exists */
    exists(path: string): Promise<boolean>;

    /** List files with optional prefix */
    list(prefix?: string): Promise<FileInfo[]>;

    /** Get file metadata */
    getMetadata(path: string): Promise<FileMetadata | null>;

    /** Copy a file */
    copy(source: string, dest: string): Promise<void>;

    /** Move a file */
    move(source: string, dest: string): Promise<void>;
}
