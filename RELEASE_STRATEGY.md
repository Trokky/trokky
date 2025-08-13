# Trokky Release Strategy

## Overview
Trokky uses [Changesets](https://github.com/changesets/changesets) for version management and GitHub Package Registry for hosting private packages.

## Release Workflows

### 1. **Automated Releases** (`release-changesets.yml`)
- **Triggers**: On push to `main` branch
- **Purpose**: Standard release flow using changesets
- **Process**:
  1. When changesets are detected, creates a "Version Packages" PR
  2. When the PR is merged, automatically publishes packages to GitHub Package Registry
  3. Updates CHANGELOGs and package versions

### 2. **Manual Publish** (`manual-publish.yml`)
- **Triggers**: Manual workflow dispatch from GitHub Actions UI
- **Purpose**: Emergency pCublishing or republishing specific packages
- **Options**: Can publish individual packages or all packages

### 3. **Initial Release** (`release.yml`)
- **Triggers**: Push to main (only for package changes) or manual
- **Purpose**: Initial package publishing and recovery
- **Note**: This is a fallback workflow

## How to Create a Release

### Standard Release Process

1. **Make your changes** in a feature branch
2. **Create a changeset** before committing:
   ```bash
   npx changeset
   # Select packages that changed
   # Choose version bump type (patch/minor/major)
   # Write a description of changes
   ```

3. **Commit and push** your changes with the changeset:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin your-branch
   ```

4. **Create a PR** to main branch

5. **When PR is merged**, the workflow will:
   - Detect the changeset
   - Create a "Version Packages" PR automatically
   - This PR will contain all version bumps and CHANGELOG updates

6. **Merge the Version Packages PR** to trigger the actual publish

### Quick Patch Release

For urgent fixes:
```bash
# Create changeset for patch
npx changeset add --patch

# Commit and push to main
git add .
git commit -m "fix: urgent bug fix"
git push origin main
```

### Manual Publishing

If a package fails to publish:
1. Go to GitHub Actions tab
2. Select "Manual Publish" workflow
3. Click "Run workflow"
4. Select the package to publish (or "all")
5. Run the workflow

## Version Guidelines

- **Patch (0.1.x)**: Bug fixes, documentation, internal changes
- **Minor (0.x.0)**: New features, non-breaking changes
- **Major (x.0.0)**: Breaking changes (we're pre-1.0, so use minor for breaking changes)

## Package Dependencies

When updating packages, remember the dependency order:
1. `@trokky/fields` (no dependencies)
2. `@trokky/core` (depends on fields)
3. `@trokky/routes` (depends on core)
4. Other packages depend on the above

## Current Package Versions

All packages are currently at `0.1.0` in the GitHub Package Registry.

## Troubleshooting

### Package won't publish
- Check GitHub Actions logs for authentication errors
- Ensure package.json has correct `publishConfig`
- Try manual publish workflow

### Changeset not creating PR
- Ensure changeset files are in `.changeset/` directory
- Check that changeset has valid format
- Verify GitHub Actions has correct permissions

### Version conflicts
- Run `npx changeset status` to check current state
- Ensure all inter-package dependencies use `^0.1.0` format
- Build all packages before publishing: `npm run build`