export interface FileSystem {
  readFileSync(path: string, options?: BufferEncoding | { encoding?: BufferEncoding }): string;
  writeFileSync(path: string, data: string | Uint8Array, options?: BufferEncoding | { encoding?: BufferEncoding }): void;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readdirSync?(path: string): string[];
  statSync?(path: string): { isDirectory(): boolean; isFile(): boolean; size?: number };
  rmSync?(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  unlinkSync?(path: string): void;
}

export interface PathModule {
  join(...paths: string[]): string;
  dirname(path: string): string;
  resolve(...paths: string[]): string;
  extname?(path: string): string;
  basename?(path: string, ext?: string): string;
}

let fileSystem: FileSystem | null = null;
let pathModule: PathModule | null = null;

export function setFileSystem(fs: FileSystem | null): void {
  fileSystem = fs;
}

export function setPathModule(path: PathModule | null): void {
  pathModule = path;
}

export function getFileSystem(): FileSystem {
  if (!fileSystem) {
    throw new Error(
      "File system provider not configured for @betagors/yama-core. Supply one via setFileSystem (e.g., from @betagors/yama-node)."
    );
  }
  return fileSystem;
}

export function getPathModule(): PathModule {
  if (!pathModule) {
    throw new Error(
      "Path provider not configured for @betagors/yama-core. Supply one via setPathModule (e.g., from @betagors/yama-node)."
    );
  }
  return pathModule;
}

export function tryGetFileSystem(): FileSystem | null {
  return fileSystem;
}

export function tryGetPathModule(): PathModule | null {
  return pathModule;
}

