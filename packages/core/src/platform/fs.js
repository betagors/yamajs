let fileSystem = null;
let pathModule = null;
export function setFileSystem(fs) {
    fileSystem = fs;
}
export function setPathModule(path) {
    pathModule = path;
}
export function getFileSystem() {
    if (!fileSystem) {
        throw new Error("File system provider not configured for @yamajs/core. Supply one via setFileSystem (e.g., from @yamajs/node).");
    }
    return fileSystem;
}
export function getPathModule() {
    if (!pathModule) {
        throw new Error("Path provider not configured for @yamajs/core. Supply one via setPathModule (e.g., from @yamajs/node).");
    }
    return pathModule;
}
export function tryGetFileSystem() {
    return fileSystem;
}
export function tryGetPathModule() {
    return pathModule;
}
//# sourceMappingURL=fs.js.map