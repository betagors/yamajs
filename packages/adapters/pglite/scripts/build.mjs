import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const outDir = join(rootDir, 'dist');

// Find all TypeScript files
function findTsFiles(dir, baseDir = dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findTsFiles(fullPath, baseDir, files);
    } else if (extname(entry) === '.ts' && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      files.push(relative(baseDir, fullPath));
    }
  }
  return files;
}

const tsFiles = findTsFiles(srcDir, srcDir);

// Build all TypeScript files with esbuild
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
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});

// Transform .ts extensions to .js in all output files
// Only transform actual import/export statements, not template strings
function transformImports(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      transformImports(fullPath);
    } else if (extname(entry) === '.js') {
      let content = readFileSync(fullPath, 'utf-8');
      // Replace .ts extensions with .js in import/export statements
      // Only transform actual import/export statements, not template strings
      // Simple approach: transform all imports, but check if we're inside a template string
      // by counting backticks before each match
      let transformed = content;
      let lastIndex = 0;
      
      // Find all import/export statements with .ts extensions
      const importPattern = /(from|import\s*\(|export\s+[^"']*from)\s+["'](\.\/[^"']+\.ts)["']/g;
      const matches = [];
      let match;
      
      while ((match = importPattern.exec(content)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          fullMatch: match[0],
          path: match[2]
        });
      }
      
      // Process matches in reverse order to preserve indices
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        // Check if we're inside a template string by counting backticks before this position
        const beforeMatch = content.substring(0, m.start);
        const backtickCount = (beforeMatch.match(/`/g) || []).length;
        const isInTemplate = backtickCount % 2 !== 0;
        
        if (!isInTemplate) {
          // Transform .ts to .js
          const newPath = m.path.replace(/\.ts$/, '.js');
          const newMatch = m.fullMatch.replace(m.path, newPath);
          transformed = transformed.substring(0, m.start) + newMatch + transformed.substring(m.end);
        }
      }
      
      content = transformed;
      writeFileSync(fullPath, content, 'utf-8');
    }
  }
}

transformImports(outDir);

// Generate .d.ts files with tsc (declaration only)
import { execSync } from 'child_process';
try {
  execSync('tsc -p tsconfig.build.json --emitDeclarationOnly --declaration', { 
    cwd: rootDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.warn('⚠️  Type declaration generation failed, continuing...');
}

console.log('✅ Build complete');

