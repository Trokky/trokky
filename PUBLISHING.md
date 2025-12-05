# Publishing Packages Guide

This guide explains how to publish new versions of Trokky packages to GitHub Packages.

## Prerequisites

- Push access to the Trokky repository
- GitHub Personal Access Token with `write:packages` permission
- Node.js 18+ installed

## Publishing Methods

There are three ways to publish packages. Choose based on your situation:

| Method | When to Use | Automation Level |
|--------|-------------|------------------|
| **Automated (Recommended)** | Regular releases, new features, bug fixes | Full CI/CD |
| **Manual GitHub Action** | Quick fixes, re-publishing failed releases | Semi-automated |
| **Local CLI** | Debugging, emergencies, offline publishing | Manual |

### Recommended: Automated Publishing via GitHub Actions

This is the preferred method for most releases. The CI/CD pipeline handles versioning and publishing automatically.

```bash
# Automated workflow (RECOMMENDED)
1. Edit code in packages/*/src/
2. npm run build
3. npm test
4. Create .changeset/fix-name.md
5. git commit (code changes + changeset file)
6. git push origin main
7. Wait for "Release PR" to be created by GitHub Actions
8. Review and merge the Release PR
9. GitHub Actions automatically publishes the packages
```

**How it works:**
- Push triggers `.github/workflows/release-changesets.yml`
- Pipeline detects changeset files and creates a "Release PR"
- The Release PR contains version bumps and CHANGELOG updates
- Merging the PR triggers automatic publishing to GitHub Packages

### Alternative: Manual GitHub Action

Use this when you need to publish without going through the Release PR flow.

1. Go to GitHub repo > Actions > "Manual Publish"
2. Click "Run workflow"
3. Select package(s) to publish: `all` or specific package name
4. Click "Run workflow"

**When to use:**
- Re-publishing after a failed automated release
- Publishing a hotfix quickly
- Publishing packages that were versioned locally

### Alternative: Local CLI Publishing

Use this as a last resort or for debugging.

```bash
# Local workflow
1. Edit code in packages/*/src/
2. npm run build
3. Create .changeset/fix-name.md
4. git commit (code changes + changeset file)
5. npm run version-packages
6. git commit (version bumps)
7. npm run build
8. git push origin main
9. cd packages/[package-name]
10. NODE_AUTH_TOKEN=ghp_XXX npm publish
```

## Quick Reference (Local Publishing)

```bash
# Complete workflow for LOCAL publishing (use only when CI/CD is not available)
1. Edit code in packages/*/src/
2. npm run build
3. Create .changeset/fix-name.md
4. git commit (code changes + changeset file)
5. npm run version-packages
6. git commit (version bumps)
7. npm run build
8. git push origin main
9. NODE_AUTH_TOKEN=ghp_XXX npm publish (in package directory)

# IMPORTANT: Never manually edit package.json versions - let version-packages handle it
# IMPORTANT: Always commit before publishing
```

## GitHub Actions Workflows

### release-changesets.yml (Automatic)

**Triggers:** Push to `main` when `.changeset/**` or `packages/**` files change

**Behavior:**
1. Checks if any changeset files exist (`.changeset/*.md`)
2. If changesets found: Creates a "Release PR" with version bumps
3. When Release PR is merged: Publishes all affected packages

**File:** `.github/workflows/release-changesets.yml`

### manual-publish.yml (Manual)

**Triggers:** Manual dispatch from GitHub Actions UI

**Options:**
- `all` - Publish all packages
- Individual packages: `client`, `core`, `routes`, `fields`, `studio`, `express`, `adapter-filesystem`, etc.

**File:** `.github/workflows/manual-publish.yml`

## Detailed Workflow (Local Publishing)

The following steps detail the local publishing workflow. For automated publishing, simply push your changeset and let GitHub Actions handle the rest.

### Step 1: Make Your Code Changes

Edit the necessary files in the appropriate package:

```bash
vim packages/adapter-filesystem/src/filesystem-adapter.ts
```

### Step 2: Build the Package(s)

Build your changes to ensure they compile correctly:

```bash
# Build specific package
cd packages/adapter-filesystem && npm run build

# OR build all packages (recommended)
npm run build
```

### Step 3: Test Your Changes

Run tests to verify your changes work correctly:

```bash
# Run tests for specific package
cd packages/core && npm test

# OR run all tests
npm test
```

### Step 4: Create a Changeset

Create a changeset file to document your changes. This will generate CHANGELOG entries and determine version bumps.

#### Manual Method (Recommended)

Create a file in `.changeset/` with a descriptive name:

```bash
cat > .changeset/fix-media-deletion.md << 'EOF'
---
"@trokky/adapter-filesystem": patch
"@trokky/trokky": patch
---

Fix media deletion bug in filesystem adapter

The deleteFile method was silently catching all errors during file deletion,
making it impossible to detect when deletions failed. Now only ENOENT errors
are ignored, while all other errors (permissions, I/O issues) are properly reported.
EOF
```

#### Interactive Method (If Terminal Supports It)

```bash
npm run changeset
# Follow the prompts to select packages and describe changes
```

#### Version Types

- `patch` (0.1.0 → 0.1.1) - Bug fixes, minor improvements
- `minor` (0.1.0 → 0.2.0) - New features, backward compatible
- `major` (0.1.0 → 1.0.0) - Breaking changes

### Step 5: Commit Your Code Changes

Commit your code changes (not the version bumps yet):

```bash
git add packages/adapter-filesystem/src/filesystem-adapter.ts
git commit --no-verify -m "Fix media deletion bug in filesystem adapter

The deleteFile method was silently catching all errors during file deletion,
making it impossible to detect when deletions failed. This caused the clean
command to report success even when files remained on disk.

Changes:
- Only ignore ENOENT (file not found) errors
- Throw all other errors (permissions, I/O issues, etc.)
- Ensures proper error reporting for failed deletions"
```

### Step 6: Version the Packages

Run the version-packages script to update package versions and generate CHANGELOGs:

```bash
npm run version-packages
```

This command will:
- Update `package.json` versions in affected packages
- Generate or update `CHANGELOG.md` files
- Remove the consumed changeset file

### Step 7: Commit Version Bumps

Commit the version bump changes separately from your code changes:

```bash
git add packages/adapter-filesystem/package.json packages/adapter-filesystem/CHANGELOG.md packages/trokky/package.json packages/trokky/CHANGELOG.md
git commit --no-verify -m "Bump @trokky/adapter-filesystem to v0.1.1 and @trokky/trokky to v0.1.1"
```

### Step 8: Build Again

Rebuild to ensure the dist/ directories contain the latest versioned code:

```bash
npm run build
```

### Step 9: Push to GitHub

Push your commits to the main branch:

```bash
git push origin main
```

### Step 10: Publish to GitHub Packages

Publish the updated packages using your GitHub Personal Access Token:

```bash
# Publish a specific package
cd packages/adapter-filesystem
NODE_AUTH_TOKEN=ghp_YOUR_TOKEN_HERE npm publish

# Publish another affected package
cd ../trokky
NODE_AUTH_TOKEN=ghp_YOUR_TOKEN_HERE npm publish
```

#### Using the Release Script

Alternatively, you can use the release script to build and publish all changed packages:

```bash
NODE_AUTH_TOKEN=ghp_YOUR_TOKEN_HERE npm run release
```

Note: This may attempt to publish packages that haven't changed, which will fail harmlessly.

## Package Dependency Order

When publishing multiple interdependent packages, publish in this order to avoid dependency issues:

```
1. @trokky/types (no dependencies)
2. @trokky/core (depends on types)
3. @trokky/routes (depends on core)
4. @trokky/adapter-filesystem (depends on core)
5. @trokky/adapter-filesystem-data (depends on core)
6. @trokky/adapter-filesystem-media (depends on core)
7. @trokky/adapter-postgres-data (depends on core)
8. @trokky/express (depends on routes, core)
9. @trokky/client (depends on core)
10. @trokky/fields (minimal dependencies)
11. @trokky/studio (depends on fields)
12. @trokky/trokky (CLI - depends on client, core)
```

Turbo handles build order automatically, but manual publishing should follow this sequence.

## Best Practices

### 1. Always Build Before Publishing

Ensures the `dist/` directory contains the latest compiled code:

```bash
npm run build
```

### 2. Commit Code Changes Separately from Version Bumps

This creates a cleaner git history and makes it easier to review changes:

```bash
# First commit: code changes
git commit -m "Fix: media deletion bug"

# Second commit: version bumps
git commit -m "Bump @trokky/adapter-filesystem to v0.1.1"
```

### 3. Use Descriptive Changeset Messages

Your changeset description becomes the CHANGELOG entry, so make it clear and informative:

```markdown
---
"@trokky/routes": patch
---

Add backup and restore endpoints with pre-flight checks

- Validate schema compatibility before restore
- Support singleton document ID preservation
- Add media variant compatibility checks
```

### 4. Test Locally First

Run tests before publishing to catch issues early:

```bash
npm test
```

### 5. Check Package Dependencies

If package A depends on package B, and both are being updated:
- List both packages in the changeset
- Publish package B first, then package A

### 6. Use --no-verify Flag

Skip pre-commit hooks when committing (as per project guidelines):

```bash
git commit --no-verify -m "Your commit message"
```

## Common Issues and Solutions

### Issue: Changeset not consumed after version-packages

**Cause**: The version-packages script removes changeset files after processing.

**Solution**: This is expected behavior. Your changeset has been converted into package version bumps and CHANGELOG entries.

### Issue: Publishing fails with 401 Unauthorized

**Cause**: Invalid or missing GitHub Personal Access Token.

**Solution**: Ensure your token has `write:packages` permission and is correctly set:

```bash
NODE_AUTH_TOKEN=ghp_YOUR_ACTUAL_TOKEN npm publish
```

### Issue: Package shows as "up to date" after publish

**Cause**: The version in package.json matches what's already published.

**Solution**: Make sure you ran `npm run version-packages` to bump the version before publishing.

### Issue: npm publish fails with "version already exists"

**Cause**: Trying to publish a version that's already in the registry.

**Solution**: Bump the version again or check if someone else already published:

```bash
npm view @trokky/package-name versions
```

### Issue: Turbo build cache issues

**Cause**: Turbo is using cached build outputs that may be outdated.

**Solution**: Clean and rebuild:

```bash
npx turbo clean
npm run build
```

### Issue: Package A can't find dependency B after publishing

**Cause**: Package B wasn't published yet or version mismatch.

**Solution**: Publish dependencies first, following the dependency order listed above.

## Environment Setup

### Setting Up GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `write:packages` permission
3. Store it securely (it won't be shown again)
4. Use it in publish commands:

```bash
export NODE_AUTH_TOKEN=ghp_YOUR_TOKEN
npm publish
```

### .npmrc Configuration

Packages are configured to publish to GitHub Packages via publishConfig in package.json:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  }
}
```

This is already set up in each package's configuration.

## Troubleshooting

### Verify Package Published Successfully

```bash
npm view @trokky/package-name
```

### Check Published Version

```bash
npm view @trokky/package-name version
```

### List All Published Versions

```bash
npm view @trokky/package-name versions
```

### Test Installation

```bash
# In a test directory
npm install @trokky/package-name@latest
```

## Additional Resources

- [Changesets Documentation](https://github.com/changesets/changesets)
- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Semantic Versioning](https://semver.org/)
- [Turbo Documentation](https://turbo.build/)

## Questions?

If you encounter issues not covered in this guide, check:
- The main [README.md](./README.md) for project setup
- The [the contributor guide](./the contributor guide) for development guidelines
- Open an issue in the repository for assistance
