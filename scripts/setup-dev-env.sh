#!/bin/bash

# Trokky Development Environment Setup
# Run this after cloning the repository to set up git hooks and dev tools

set -e  # Exit on any error

echo "🚀 Setting up Trokky development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_error "This script must be run from the root of a git repository"
    exit 1
fi

# Check if we're in the Trokky repository
if [ ! -f "package.json" ] || ! grep -q "trokky-v2" package.json; then
    print_warning "This doesn't appear to be the Trokky v2 repository"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_status "Setting up git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-push hook to protect main branch
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash

protected_branch='main'
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')

if [ $current_branch = $protected_branch ]; then
    echo "🚫 Direct push to main branch is not allowed"
    echo "📝 Create a feature branch instead:"
    echo "   git checkout -b feature/your-feature-name"
    echo "   git push -u origin feature/your-feature-name"
    echo ""
    echo "💡 Or use the helper alias:"
    echo "   git new-feature your-feature-name"
    exit 1
fi

exit 0
EOF

# Make hook executable
chmod +x .git/hooks/pre-push
print_success "Pre-push hook installed (protects main branch)"

# Install pre-commit hook for code quality
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 Running pre-commit checks..."

# Check for TypeScript compilation errors
if command -v npm >/dev/null 2>&1; then
    if ! npm run type-check >/dev/null 2>&1; then
        echo "❌ TypeScript compilation failed"
        echo "Fix type errors before committing"
        exit 1
    fi
fi

# Check for .js extensions in TypeScript imports (common mistake)
if grep -r "from.*\.js['\"]" packages/*/src/ 2>/dev/null; then
    echo "❌ Found .js extensions in TypeScript imports"
    echo "Remove .js extensions from import statements in TypeScript files"
    exit 1
fi

echo "✅ Pre-commit checks passed"
exit 0
EOF

chmod +x .git/hooks/pre-commit
print_success "Pre-commit hook installed (type checking + import validation)"

print_status "Setting up git aliases..."

# Set up helpful git aliases
git config alias.new-feature '!f() { git checkout main && git pull && git checkout -b feature/$1; }; f'
git config alias.finish-feature '!f() { git push -u origin HEAD && gh pr create --fill; }; f'
git config alias.sync-main '!git checkout main && git pull origin main'
git config alias.cleanup-branches '!git branch --merged main | grep -v main | xargs -n 1 git branch -d'

print_success "Git aliases configured:"
echo "  • git new-feature <name>    - Create and switch to new feature branch"
echo "  • git finish-feature        - Push branch and create PR"
echo "  • git sync-main             - Switch to main and pull latest"
echo "  • git cleanup-branches      - Delete merged feature branches"

print_status "Checking development dependencies..."

# Check for required tools
missing_tools=()

if ! command -v node >/dev/null 2>&1; then
    missing_tools+=("node")
fi

if ! command -v npm >/dev/null 2>&1; then
    missing_tools+=("npm")
fi

if ! command -v gh >/dev/null 2>&1; then
    print_warning "GitHub CLI (gh) not found - PR creation will require manual setup"
fi

if [ ${#missing_tools[@]} -gt 0 ]; then
    print_error "Missing required tools: ${missing_tools[*]}"
    print_error "Please install them before continuing development"
    exit 1
fi

print_status "Installing npm dependencies..."
if npm install; then
    print_success "Dependencies installed"
else
    print_error "Failed to install dependencies"
    exit 1
fi

print_status "Building packages..."
if npm run build; then
    print_success "All packages built successfully"
else
    print_error "Build failed - check for errors above"
    exit 1
fi

print_status "Running type check..."
if npm run type-check; then
    print_success "Type checking passed"
else
    print_error "Type checking failed - fix errors before continuing"
    exit 1
fi

echo
print_success "🎉 Development environment setup complete!"
echo
echo "📝 Next steps:"
echo "  1. Start development server: cd examples/demo && npm run dev"
echo "  2. Create your first feature: git new-feature my-awesome-feature"
echo "  3. Check out the docs: README.md and the contributor guide"
echo
echo "💡 Useful commands:"
echo "  • npm run dev              - Start demo with hot reload"
echo "  • npm run build            - Build all packages"
echo "  • npm run type-check       - Verify TypeScript"
echo "  • npm test                 - Run all tests"
echo
print_success "Happy coding! 🚀"