import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');

// Fix relative imports to include .js extension for ES modules
function fixImports(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      fixImports(fullPath);
    } else if (extname(entry) === '.ts' && !entry.endsWith('.d.ts') && !entry.endsWith('.test.ts')) {
      let content = readFileSync(fullPath, 'utf-8');
      let modified = false;
      
      // Fix relative imports without extensions (./something or ../something)
      // Match: from "./path" or from "../path" or import "./path"
      // But exclude: from "./path.js" (already correct) or from "./path.json" (intentional)
      const importPattern = /(from\s+["']|import\s+["'])(\.\.?\/[^"']+?)(["'])/g;
      content = content.replace(importPattern, (match, prefix, path, suffix) => {
        // Skip if already has an extension or is a special import (like .json, .css, etc.)
        if (/\.(js|ts|json|css|scss|sass|less|svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot)$/.test(path)) {
          return match;
        }
        // Add .js extension for ES modules
        modified = true;
        return `${prefix}${path}.js${suffix}`;
      });
      
      if (modified) {
        writeFileSync(fullPath, content, 'utf-8');
        console.log(`Fixed imports in: ${fullPath.replace(rootDir, '.')}`);
      }
    }
  }
}

fixImports(srcDir);
console.log('✅ Fixed all relative imports in core package');

