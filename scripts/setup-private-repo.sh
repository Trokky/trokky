#!/bin/bash

# Trokky v2 Private Repository Setup Script
set -e

echo "🚀 Setting up Trokky v2 private repository..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ORG_NAME="trokky"
REPO_NAME="trokky"
CURRENT_DIR=$(pwd)

echo -e "${BLUE}📋 Repository Configuration:${NC}"
echo "  Organization: $ORG_NAME"
echo "  Repository: $REPO_NAME"
echo "  Current Directory: $CURRENT_DIR"
echo ""

# Check if gh CLI is installed and authenticated
echo -e "${BLUE}🔍 Checking GitHub CLI...${NC}"
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed.${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI is not authenticated.${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI is ready${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] || ! grep -q "trokky-v2" package.json; then
    echo -e "${RED}❌ Not in the trokky-v2 project root directory${NC}"
    exit 1
fi

echo -e "${GREEN}✅ In correct project directory${NC}"

# Clean the repository
echo -e "${BLUE}🧹 Cleaning repository...${NC}"
npm run clean
rm -rf node_modules
rm -rf examples/*/node_modules
rm -rf packages/*/node_modules
rm -rf packages/*/dist
rm -rf .turbo
find . -name "*.tsbuildinfo" -delete
find . -name "*.log" -delete

echo -e "${GREEN}✅ Repository cleaned${NC}"

# Create the repository on GitHub
echo -e "${BLUE}📝 Creating private repository on GitHub...${NC}"
if gh repo view "$ORG_NAME/$REPO_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Repository $ORG_NAME/$REPO_NAME already exists${NC}"
    read -p "Do you want to continue and push to existing repo? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 1
    fi
else
    gh repo create "$ORG_NAME/$REPO_NAME" \
        --private \
        --description "Modern, composable CMS for developers - Private Beta" \
        --homepage "https://trokky.dev" \
        --add-readme=false
    echo -e "${GREEN}✅ Repository created${NC}"
fi

# Initialize git if not already done
if [ ! -d ".git" ]; then
    echo -e "${BLUE}🔧 Initializing git repository...${NC}"
    git init
    git branch -M main
    echo -e "${GREEN}✅ Git initialized${NC}"
fi

# Add remote if not exists
if ! git remote get-url origin &> /dev/null; then
    git remote add origin "https://github.com/$ORG_NAME/$REPO_NAME.git"
    echo -e "${GREEN}✅ Remote origin added${NC}"
fi

# Configure package.json files for GitHub Packages
echo -e "${BLUE}📦 Configuring packages for GitHub Packages...${NC}"
find packages -name "package.json" -not -path "*/node_modules/*" | while read -r package_file; do
    if [ -f "$package_file" ]; then
        echo "  Configuring: $package_file"
        # Add publishConfig using jq if available, otherwise use sed
        if command -v jq &> /dev/null; then
            tmp=$(mktemp)
            jq '. + {
                "publishConfig": {
                    "registry": "https://npm.pkg.github.com",
                    "access": "restricted"
                },
                "repository": {
                    "type": "git",
                    "url": "git+https://github.com/trokky/trokky.git"
                }
            }' "$package_file" > "$tmp" && mv "$tmp" "$package_file"
        else
            echo -e "${YELLOW}⚠️  jq not found, manually add publishConfig to package.json files${NC}"
        fi
    fi
done

echo -e "${GREEN}✅ Packages configured${NC}"

# Create .npmrc for GitHub Packages
echo -e "${BLUE}🔧 Creating .npmrc for GitHub Packages...${NC}"
cat > .npmrc << EOF
@trokky:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
EOF

echo -e "${GREEN}✅ .npmrc created${NC}"

# Stage and commit all changes
echo -e "${BLUE}📝 Committing repository setup...${NC}"
git add .
git commit -m "feat: initial private repository setup

- Configure packages for GitHub Packages private distribution
- Add CI/CD pipeline for automated publishing
- Set up repository structure for beta deployment
- Add .npmrc for private package installation"

echo -e "${GREEN}✅ Changes committed${NC}"

# Push to GitHub
echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
git push -u origin main

echo -e "${GREEN}✅ Repository pushed to GitHub${NC}"

# Set up GitHub Packages permissions
echo -e "${BLUE}🔐 Setting up repository settings...${NC}"

# Enable GitHub Packages
gh api --method PUT "/repos/$ORG_NAME/$REPO_NAME" --field has_packages=true

echo -e "${GREEN}✅ GitHub Packages enabled${NC}"

echo ""
echo -e "${GREEN}🎉 Repository setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Repository URL: https://github.com/$ORG_NAME/$REPO_NAME"
echo "2. To install packages in client projects:"
echo "   - Add .npmrc file with GitHub token"
echo "   - Run: npm install @trokky/core @trokky/express"
echo ""
echo -e "${BLUE}🔑 For client installations, they need:${NC}"
echo "1. A GitHub personal access token with packages:read permission"
echo "2. Access to the trokky organization"
echo "3. .npmrc configuration (see installation guide)"
echo ""
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo "- Add collaborators to the repository"
echo "- Create releases to trigger package publishing"
echo "- Set up team access in GitHub organization settings"
echo ""