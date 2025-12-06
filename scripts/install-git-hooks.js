#!/usr/bin/env node

/**
 * Install Git Hooks for Trokky Development
 *
 * This script sets up git hooks and aliases to enforce development best practices
 * and streamline the contribution workflow.
 *
 * Usage:
 *   node scripts/install-git-hooks.js
 *
 * What it installs:
 *
 * 1. Git Hooks:
 *    - pre-push: Prevents direct pushes to the main branch, enforcing the use
 *                of feature branches and pull requests.
 *    - pre-commit: Placeholder for pre-commit checks (currently passes through).
 *
 * 2. Git Aliases:
 *    - git new-feature <name>
 *      Creates a new feature branch from an updated main branch.
 *      Example: git new-feature add-user-auth
 *      Equivalent to: git checkout main && git pull && git checkout -b feature/<name>
 *
 *    - git finish-feature
 *      Pushes the current branch and opens a pull request on GitHub.
 *      Requires: GitHub CLI (gh) to be installed and authenticated.
 *      Equivalent to: git push -u origin HEAD && gh pr create --fill
 *
 *    - git sync-main
 *      Updates the local main branch with the latest changes from origin.
 *      Equivalent to: git checkout main && git pull origin main
 *
 * Requirements:
 *   - Must be run from the root of a git repository
 *   - GitHub CLI (gh) for the finish-feature alias (optional)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const hooksDir = path.join(process.cwd(), '.git', 'hooks');

// Ensure hooks directory exists
if (!fs.existsSync(hooksDir)) {
  console.log('[SKIP] Not a git repository - skipping hook installation');
  process.exit(0);
}

console.log('[INFO] Installing git hooks...');

// Pre-push hook to protect main branch
const prePushHook = `#!/bin/bash

protected_branch='main'
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\\(.*\\),\\1,')

if [ $current_branch = $protected_branch ]; then
    echo "[ERROR] Direct push to main branch is not allowed"
    echo ""
    echo "Create a feature branch instead:"
    echo "  git checkout -b feature/your-feature-name"
    echo "  git push -u origin feature/your-feature-name"
    exit 1
fi

exit 0`;

// Pre-commit hook disabled - .js extensions are required for ESM compatibility
const preCommitHook = `#!/bin/bash

echo "[INFO] Running pre-commit checks..."

# Note: .js extensions in TypeScript imports are REQUIRED for ESM compatibility
# This is correct syntax for "type": "module" packages

echo "[OK] Pre-commit checks passed"
exit 0`;

try {
  // Write hooks
  fs.writeFileSync(path.join(hooksDir, 'pre-push'), prePushHook);
  fs.writeFileSync(path.join(hooksDir, 'pre-commit'), preCommitHook);

  // Make hooks executable (Unix/Linux/macOS)
  if (process.platform !== 'win32') {
    fs.chmodSync(path.join(hooksDir, 'pre-push'), 0o755);
    fs.chmodSync(path.join(hooksDir, 'pre-commit'), 0o755);
  }

  console.log('[OK] Git hooks installed successfully');

  // Install git aliases
  try {
    execSync('git config alias.new-feature "!f() { git checkout main && git pull && git checkout -b feature/$1; }; f"', { stdio: 'ignore' });
    execSync('git config alias.finish-feature "!f() { git push -u origin HEAD && gh pr create --fill; }; f"', { stdio: 'ignore' });
    execSync('git config alias.sync-main "!git checkout main && git pull origin main"', { stdio: 'ignore' });
    console.log('[OK] Git aliases configured');
  } catch (error) {
    console.log('[WARN] Could not configure git aliases (non-fatal)');
  }

} catch (error) {
  console.error('[ERROR] Failed to install git hooks:', error.message);
  process.exit(1);
}

console.log('');
console.log('Helpful commands:');
console.log('  git new-feature <name>  - Create new feature branch');
console.log('  git finish-feature      - Push and create PR');
console.log('  git sync-main           - Update main branch');
