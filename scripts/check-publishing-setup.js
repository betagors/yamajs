#!/usr/bin/env node

/**
 * Diagnostic script to check publishing setup
 */

import { readFileSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function check(condition, message, fix = null) {
  if (condition) {
    log(`✓ ${message}`, 'green');
    return true;
  } else {
    log(`✗ ${message}`, 'red');
    if (fix) {
      log(`  → Fix: ${fix}`, 'yellow');
    }
    return false;
  }
}

async function main() {
  log('\n🔍 Checking Publishing Setup...\n', 'blue');

  const results = {
    changesets: false,
    workflow: false,
    packages: false,
    config: false,
  };

  // Check 1: Changesets exist
  log('1. Checking for changesets...', 'blue');
  try {
    const changesetDir = '.changeset';
    if (existsSync(changesetDir)) {
      const files = await readdir(changesetDir);
      const changesetFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');
      results.changesets = check(
        changesetFiles.length > 0,
        `Found ${changesetFiles.length} changeset(s)`,
        'Run: pnpm changeset'
      );
      if (changesetFiles.length === 0) {
        log('  → No changeset files found. Create one with: pnpm changeset', 'yellow');
      }
    } else {
      check(false, 'Changeset directory exists', 'Run: pnpm changeset');
    }
  } catch (error) {
    check(false, 'Could not read changeset directory', 'Run: pnpm changeset');
  }

  // Check 2: Workflow file
  log('\n2. Checking workflow configuration...', 'blue');
  const workflowPath = '.github/workflows/publish.yml';
  if (existsSync(workflowPath)) {
    const workflow = readFileSync(workflowPath, 'utf-8');
    results.workflow = check(
      workflow.includes('changesets/action'),
      'Workflow uses changesets action',
      'Check .github/workflows/publish.yml'
    );
    
    const hasMainBranch = workflow.includes('branches:\n      - main');
    check(
      hasMainBranch,
      'Workflow triggers on main branch',
      hasMainBranch ? null : 'Update workflow to trigger on your branch'
    );
  } else {
    check(false, 'Workflow file exists', 'Create .github/workflows/publish.yml');
  }

  // Check 3: Package.json files have publishConfig
  log('\n3. Checking package configurations...', 'blue');
  try {
    const packagesDir = 'packages';
    const packages = await readdir(packagesDir);
    let packagesWithConfig = 0;
    
    for (const pkg of packages) {
      const pkgPath = join(packagesDir, pkg, 'package.json');
      if (existsSync(pkgPath)) {
        const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkgJson.publishConfig?.access === 'public') {
          packagesWithConfig++;
        }
      }
    }
    
    results.packages = check(
      packagesWithConfig > 0,
      `${packagesWithConfig} package(s) have publishConfig`,
      'Add "publishConfig": { "access": "public" } to package.json files'
    );
  } catch (error) {
    check(false, 'Could not check packages', 'Check packages directory');
  }

  // Check 4: Changeset config
  log('\n4. Checking changeset configuration...', 'blue');
  const configPath = '.changeset/config.json';
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    results.config = check(
      config.access === 'public',
      'Changeset config has public access',
      'Set "access": "public" in .changeset/config.json'
    );
  } else {
    check(false, 'Changeset config exists', 'Create .changeset/config.json');
  }

  // Summary
  log('\n📊 Summary:', 'blue');
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    log('\n✅ All checks passed! Publishing should work.', 'green');
    log('\nNext steps:', 'blue');
    log('1. If you have changesets, push to main branch');
    log('2. Wait for version PR to be created');
    log('3. Merge the version PR');
    log('4. Publishing will happen automatically');
  } else {
    log('\n⚠️  Some checks failed. Fix the issues above.', 'yellow');
    log('\nQuick start:', 'blue');
    log('1. Create a changeset: pnpm changeset');
    log('2. Commit and push to main: git push origin main');
    log('3. Check GitHub Actions for version PR');
    log('4. Merge the version PR to trigger publishing');
  }

  log('\n');
}

main().catch(console.error);


