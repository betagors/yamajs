import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const outDir = join(rootDir, 'dist');

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
      // Replace .ts extensions with .js in import/export statements
      content = content.replace(/from\s+["'](\.\/[^"']+\.ts)["']/g, (match, path) => {
        return match.replace(path, path.replace(/\.ts$/, '.js'));
      });
      content = content.replace(/import\s+\(["'](\.\/[^"']+\.ts)["']\)/g, (match, path) => {
        return match.replace(path, path.replace(/\.ts$/, '.js'));
      });
      writeFileSync(fullPath, content, 'utf-8');
    }
  }
}

transformImports(outDir);
console.log('✅ Transformed .ts imports to .js in dist files');

