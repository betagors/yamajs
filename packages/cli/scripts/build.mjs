import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const outDir = join(rootDir, 'dist', 'cli', 'src');

// Find all TypeScript files (including .tsx)
function findTsFiles(dir, baseDir = dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findTsFiles(fullPath, baseDir, files);
    } else if (extname(entry) === '.ts' || extname(entry) === '.tsx') {
      files.push(relative(baseDir, fullPath));
    }
  }
  return files;
}

const tsFiles = findTsFiles(srcDir, srcDir);
console.log(`Found ${tsFiles.length} TypeScript files to build`);

// Build all TypeScript files with esbuild
// esbuild handles .ts extensions in imports and transforms them correctly
const entryPoints = tsFiles.map(file => join(srcDir, file));

console.log('Starting esbuild...');
console.log(`Building ${entryPoints.length} files (${entryPoints.filter(p => p.endsWith('.tsx')).length} TSX files)`);

try {
  const result = await build({
    entryPoints,
    bundle: false,
    outdir: outDir,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    sourcemap: true,
    sourcesContent: false,
    allowOverwrite: true,
    jsx: 'automatic',
    jsxImportSource: 'react',
    logLevel: 'info',
    // Note: external is not needed when bundle: false
    // Dependencies will be left as imports naturally
    // esbuild will transform .ts imports to .js in output
    // but preserve the module structure
  });
  console.log('✅ esbuild completed successfully');
  if (result.errors && result.errors.length > 0) {
    console.error('❌ Build errors:', JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }
  if (result.warnings && result.warnings.length > 0) {
    console.warn('⚠️  Build warnings:', JSON.stringify(result.warnings, null, 2));
  }
} catch (error) {
  console.error('❌ Build failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// Transform .ts/.tsx extensions to .js in all output files
console.log('Transforming imports...');
function transformImports(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      transformImports(fullPath);
    } else if (extname(entry) === '.js') {
      let content = readFileSync(fullPath, 'utf-8');
      // Replace .ts/.tsx extensions with .js in import/export statements (both relative and absolute)
      // Handle: from "./path/file.ts" or "./path/file.tsx"
      content = content.replace(/from\s+["'](\.\/[^"']+\.tsx?)["']/g, (match, path) => {
        return match.replace(path, path.replace(/\.tsx?$/, '.js'));
      });
      // Handle: import("./path/file.ts") or import("./path/file.tsx")
      content = content.replace(/import\s*\(["'](\.\/[^"']+\.tsx?)["']\)/g, (match, path) => {
        return match.replace(path, path.replace(/\.tsx?$/, '.js'));
      });
      // Handle: import "./path/file.ts" or import "./path/file.tsx"
      content = content.replace(/import\s+["'](\.\/[^"']+\.tsx?)["']/g, (match, path) => {
        return match.replace(path, path.replace(/\.tsx?$/, '.js'));
      });
      // Handle: import ... from "../utils/file-utils.ts" or "../utils/file-utils.tsx"
      content = content.replace(/from\s+["'](\.\.\/[^"']+\.tsx?)["']/g, (match, path) => {
        return match.replace(path, path.replace(/\.tsx?$/, '.js'));
      });
      writeFileSync(fullPath, content, 'utf-8');
    }
  }
}

transformImports(outDir);

// Copy schema file
const srcPath = join(rootDir, 'src', 'yama.schema.json');
const destPath = join(rootDir, 'dist', 'cli', 'src', 'yama.schema.json');

try {
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(srcPath, destPath);
  console.log('✅ Copied yama.schema.json to dist');
} catch (error) {
  console.error('❌ Failed to copy schema file:', error);
  process.exit(1);
}

console.log('✅ Build complete');

