import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const outDir = join(rootDir, 'dist', 'cli', 'src');

// Find all TypeScript files
function findTsFiles(dir, baseDir = dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findTsFiles(fullPath, baseDir, files);
    } else if (extname(entry) === '.ts') {
      files.push(relative(baseDir, fullPath));
    }
  }
  return files;
}

const tsFiles = findTsFiles(srcDir, srcDir);

// Build all TypeScript files with esbuild
// esbuild handles .ts extensions in imports and transforms them correctly
const entryPoints = tsFiles.map(file => join(srcDir, file));

await build({
  entryPoints,
  bundle: false,
  outdir: outDir,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: true,
  sourcesContent: false,
  allowOverwrite: true,
  // esbuild will transform .ts imports to .js in output
  // but preserve the module structure
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});

// Transform .ts extensions to .js in all output files
function transformImports(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      transformImports(fullPath);
    } else if (extname(entry) === '.js') {
      let content = readFileSync(fullPath, 'utf-8');
      // Replace .ts extensions with .js in import/export statements (both relative and absolute)
      content = content.replace(/from\s+["'](\.\/[^"']+\.ts)["']/g, (match, path) => {
        return match.replace(path, path.replace(/\.ts$/, '.js'));
      });
      content = content.replace(/import\s+\(["'](\.\/[^"']+\.ts)["']\)/g, (match, path) => {
        return match.replace(path, path.replace(/\.ts$/, '.js'));
      });
      // Also handle import statements without 'from'
      content = content.replace(/import\s+["'](\.\/[^"']+\.ts)["']/g, (match, path) => {
        return match.replace(path, path.replace(/\.ts$/, '.js'));
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

