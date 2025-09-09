# Publishing Guide

Quick reference for publishing Trokky packages to GitHub Packages.

## Prerequisites

1. **GitHub Personal Access Token** with the following permissions:
   - `write:packages` - to publish packages
   - `read:packages` - to download packages
   - `repo` - if repository is private

2. **Token Configuration** in `~/.zshrc`:
   ```bash
   NODE_AUTH_TOKEN=your_github_token_here
   ```

## Publishing Process

### 1. Build the Package
```bash
cd packages/[package-name]
npm run build
```

### 2. Configure Authentication
```bash
# Set environment variable
export NODE_AUTH_TOKEN=your_github_token_here

# Create package-specific .npmrc
echo "registry=https://npm.pkg.github.com/@trokky" > .npmrc
echo "//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}" >> .npmrc
```

### 3. Publish to GitHub Packages
```bash
NODE_AUTH_TOKEN=your_github_token_here npm publish
```

## Package Configuration

Each package should have the following in `package.json`:

```json
{
  "name": "@trokky/package-name",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  }
}
```

## Installing Published Packages

To install packages from GitHub Packages:

1. **Configure npm** to use GitHub Packages for `@trokky` scope:
   ```bash
   npm config set @trokky:registry https://npm.pkg.github.com
   npm config set //npm.pkg.github.com/:_authToken YOUR_TOKEN
   ```

2. **Install the package**:
   ```bash
   npm install @trokky/package-name
   ```

## Troubleshooting

### Authentication Issues
- Verify token has correct permissions
- Check token hasn't expired
- Ensure token is properly exported as environment variable

### Workspace Warnings
- Ignore `npm warn config ignoring workspace config` warnings
- These are normal in monorepo setups

### Version Conflicts
- If version already exists, increment version in `package.json`
- Use semantic versioning: major.minor.patch

## Example: Publishing @trokky/fields

```bash
# Navigate to package
cd packages/fields

# Build
npm run build

# Set token and publish
NODE_AUTH_TOKEN=your_token_here npm publish
```

## Notes

- Packages are published to GitHub Packages, not npm registry
- Access is restricted to repository collaborators
- Always build before publishing
- Commit and push changes to Git before/after publishing