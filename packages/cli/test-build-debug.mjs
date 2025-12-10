import { build } from 'esbuild';
import { readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

const srcDir = './src';
const outDir = './test-dist';

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
const tsxFiles = tsFiles.filter(f => f.endsWith('.tsx'));
console.log(`Found ${tsFiles.length} total files, ${tsxFiles.length} TSX files`);

// Test building just one TSX file
const testFile = tsxFiles[0];
if (testFile) {
  console.log(`Testing build of: ${testFile}`);
  try {
    const result = await build({
      entryPoints: [join(srcDir, testFile)],
      bundle: false,
      outdir: outDir,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      jsx: 'automatic',
      jsxImportSource: 'react',
      external: ['react'],
      logLevel: 'verbose',
    });
    console.log('✅ Test build succeeded');
    if (result.errors && result.errors.length > 0) {
      console.error('Errors:', result.errors);
    }
  } catch (error) {
    console.error('❌ Test build failed:', error.message);
    console.error(error.stack);
  }
} else {
  console.log('No TSX files found!');
}

