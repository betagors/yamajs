
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

    // Replace platform/fs.js imports
    if (content.includes('from "../platform/fs.js"') || content.includes('from "./platform/fs.js"')) {
        content = content.replace(/import .* from "\.\.?\/platform\/fs\.js";?/g, `import { getRuntime } from "../platform/index.js";`);
        modified = true;
    }

    // Replace getFileSystem() -> getRuntime().fs
    if (content.includes('getFileSystem()')) {
        content = content.replace(/getFileSystem\(\)/g, 'getRuntime().fs');
        modified = true;
    }
    // Replace tryGetFileSystem() -> getRuntime().fs
    if (content.includes('tryGetFileSystem()')) {
        content = content.replace(/tryGetFileSystem\(\)/g, 'getRuntime().fs');
        modified = true;
    }

    // Replace tryGetPathModule() -> getRuntime().path
    if (content.includes('tryGetPathModule()')) {
        content = content.replace(/tryGetPathModule\(\)/g, 'getRuntime().path');
        modified = true;
    }

    // Replace getPathModule() -> getRuntime().path
    if (content.includes('getPathModule()')) {
        content = content.replace(/getPathModule\(\)/g, 'getRuntime().path');
        modified = true;
    }


    if (modified) {
        console.log(`Updated ${filePath}`);
        // Deduplicate imports if needed, but basic replacement first
        // Simple hack to fix double imports:
        const importLines = content.match(/import { getRuntime } from "\.\.\/platform\/index\.js";/g);
        if (importLines && importLines.length > 1) {
            content = content.replace(/import { getRuntime } from "\.\.\/platform\/index\.js";\n/g, ''); // removed all
            content = `import { getRuntime } from "../platform/index.js";\n` + content; // Add one at top
        }

        fs.writeFileSync(filePath, content);
    }
}

console.log('Fixing remaining platform imports...');
traverse(dir);
console.log('Done.');
