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
      
      // First, transform .ts/.tsx extensions to .js
      // Match any relative path (starts with .) followed by .ts or .tsx
      // The pattern (\.\.?\/)+ matches one or more occurrences of ./ or ../
      const tsImportRegex = /(["'])((?:\.\.?\/)+[^"']+\.tsx?)(["'])/g;
      content = content.replace(tsImportRegex, (match, quote1, path, quote2) => {
        return quote1 + path.replace(/\.tsx?$/, '.js') + quote2;
      });
      
      // Second, add .js extension to relative imports without any extension
      // This handles cases like: import ... from './DevServer' or import('./utils/file')
      // Match relative imports that don't have a file extension
      // Pattern: quote + relative path (./ or ../) + path without extension + quote
      // Negative lookahead ensures we don't match paths that already have extensions
      const noExtRegex = /(["'])((?:\.\.?\/)+[^"'\s?/#]+?)(["'])(?![^"']*\.(js|json|mjs|cjs|node|wasm|ts|tsx|d\.ts))/g;
      content = content.replace(noExtRegex, (match, quote1, path, quote2) => {
        // Skip if it's a directory import (ends with /)
        if (path.endsWith('/')) {
          return match;
        }
        // Skip if it has query strings or hashes (these are handled differently)
        if (path.includes('?') || path.includes('#')) {
          return match;
        }
        // Only process relative imports (must start with .)
        if (!path.startsWith('.')) {
          return match;
        }
        // Skip if it already looks like it has an extension (safety check)
        if (/\.(js|json|mjs|cjs|node|wasm|ts|tsx|d\.ts)$/.test(path)) {
          return match;
        }
        // Add .js extension
        return quote1 + path + '.js' + quote2;
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

