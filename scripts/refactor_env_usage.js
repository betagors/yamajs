
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../packages/kernel/src');

function traverse(currentDir) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            traverse(fullPath);
        } else if (file.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Fix Imports
    if (content.includes('from "../platform/env.js"') || content.includes('from "./platform/env.js"')) {
        // Handle various import depths
        content = content.replace(/from "(\.\.?\/)+platform\/env\.js"/g, (match) => {
            // Try to keep relative path structure pointing to platform/index.js
            return match.replace('env.js', 'index.js');
        });
        content = content.replace(/getEnvProvider,?/g, 'getRuntime');

        // Remove empty imports if any (unlikely to be perfect but helps)
        modified = true;
    }

    // 2. Fix Usage
    // getEnvProvider().getEnv(X) -> getRuntime().env.get(X)
    if (content.includes('getEnvProvider().getEnv')) {
        content = content.replace(/getEnvProvider\(\)\.getEnv/g, 'getRuntime().env.get');
        modified = true;
    }

    // getEnvProvider().cwd() -> getRuntime().env.cwd()
    if (content.includes('getEnvProvider().cwd')) {
        content = content.replace(/getEnvProvider\(\)\.cwd/g, 'getRuntime().env.cwd');
        modified = true;
    }

    if (modified) {
        console.log(`Updated ${filePath}`);
        fs.writeFileSync(filePath, content);
    }
}

console.log('Refactoring EnvProvider usages...');
traverse(dir);
console.log('Done.');
