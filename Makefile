# Trokky Package Publication Makefile
# Usage: make publish PACKAGE=package-name

# Default values
PACKAGE ?= 
VERSION_TYPE ?= patch
GITHUB_REGISTRY = https://npm.pkg.github.com
ORG = trokky

# Colors for output
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[1;33m
BLUE = \033[0;34m
NC = \033[0m # No Color

# Help target
.PHONY: help
help:
	@echo "$(BLUE)Trokky Package Publication Helper$(NC)"
	@echo ""
	@echo "$(YELLOW)Available targets:$(NC)"
	@echo "  publish PACKAGE=<name>           Publish a specific package"
	@echo "  publish-all                      Publish all packages"
	@echo "  replace-version PACKAGE=<name>   Replace existing version (same version number)"
	@echo "  version PACKAGE=<name>           Bump version for a package"
	@echo "  check-auth                       Check GitHub Packages authentication"
	@echo "  list-packages                    List all available packages"
	@echo "  clean PACKAGE=<name>             Clean build artifacts for a package"
	@echo "  clean-all                        Clean build artifacts for all packages"
	@echo ""
	@echo "$(YELLOW)Options:$(NC)"
	@echo "  VERSION_TYPE=<type>              Version bump type: patch, minor, major (default: patch)"
	@echo ""
	@echo "$(YELLOW)Examples:$(NC)"
	@echo "  make publish PACKAGE=fields"
	@echo "  make replace-version PACKAGE=fields"
	@echo "  make version PACKAGE=core VERSION_TYPE=minor"
	@echo "  make publish-all"

# Check if NODE_AUTH_TOKEN is set
.PHONY: check-auth
check-auth:
	@echo "$(BLUE)Checking GitHub Packages authentication...$(NC)"
	@if [ -z "$$NODE_AUTH_TOKEN" ]; then \
		echo "$(RED)ERROR: NODE_AUTH_TOKEN not set$(NC)"; \
		echo "$(YELLOW)Set it in your shell:$(NC)"; \
		echo "export NODE_AUTH_TOKEN=your_github_token_here"; \
		exit 1; \
	else \
		echo "$(GREEN)✓ NODE_AUTH_TOKEN is set$(NC)"; \
	fi

# List all packages
.PHONY: list-packages
list-packages:
	@echo "$(BLUE)Available packages:$(NC)"
	@find packages -name "package.json" -not -path "*/node_modules/*" | \
		xargs grep -l '"name".*"@$(ORG)/' | \
		xargs grep '"name"' | \
		sed 's/.*"name": *"\([^"]*\)".*/  \1/' | \
		sed 's/@$(ORG)\///'

# Validate package parameter
validate-package:
	@if [ -z "$(PACKAGE)" ]; then \
		echo "$(RED)ERROR: PACKAGE parameter is required$(NC)"; \
		echo "$(YELLOW)Usage: make publish PACKAGE=package-name$(NC)"; \
		make list-packages; \
		exit 1; \
	fi
	@if [ ! -d "packages/$(PACKAGE)" ]; then \
		echo "$(RED)ERROR: Package 'packages/$(PACKAGE)' not found$(NC)"; \
		make list-packages; \
		exit 1; \
	fi

# Clean build artifacts for a specific package
.PHONY: clean
clean: validate-package
	@echo "$(BLUE)Cleaning build artifacts for $(PACKAGE)...$(NC)"
	@cd packages/$(PACKAGE) && \
		rm -rf dist && \
		rm -f .npmrc && \
		echo "$(GREEN)✓ Cleaned $(PACKAGE)$(NC)"

# Clean build artifacts for all packages
.PHONY: clean-all
clean-all:
	@echo "$(BLUE)Cleaning build artifacts for all packages...$(NC)"
	@find packages -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
	@find packages -name ".npmrc" -type f -delete 2>/dev/null || true
	@echo "$(GREEN)✓ Cleaned all packages$(NC)"

# Build a specific package
.PHONY: build
build: validate-package
	@echo "$(BLUE)Building $(PACKAGE)...$(NC)"
	@cd packages/$(PACKAGE) && \
		npm run build && \
		echo "$(GREEN)✓ Built $(PACKAGE)$(NC)"

# Configure npm for GitHub Packages
.PHONY: configure-npm
configure-npm: validate-package check-auth
	@echo "$(BLUE)Configuring npm for GitHub Packages...$(NC)"
	@cd packages/$(PACKAGE) && \
		echo "registry=$(GITHUB_REGISTRY)/@$(ORG)" > .npmrc && \
		echo "//npm.pkg.github.com/:_authToken=\$${NODE_AUTH_TOKEN}" >> .npmrc && \
		echo "$(GREEN)✓ Configured npm for $(PACKAGE)$(NC)"

# Bump version for a package
.PHONY: version
version: validate-package
	@echo "$(BLUE)Bumping $(VERSION_TYPE) version for $(PACKAGE)...$(NC)"
	@cd packages/$(PACKAGE) && \
		npm version $(VERSION_TYPE) --no-git-tag-version && \
		echo "$(GREEN)✓ Version bumped for $(PACKAGE)$(NC)"

# Publish a specific package
.PHONY: publish
publish: validate-package build configure-npm
	@echo "$(BLUE)Publishing $(PACKAGE) to GitHub Packages...$(NC)"
	@cd packages/$(PACKAGE) && \
		NODE_AUTH_TOKEN=$$NODE_AUTH_TOKEN npm publish && \
		echo "$(GREEN)✓ Successfully published @$(ORG)/$(PACKAGE)$(NC)" && \
		rm -f .npmrc

# Replace existing version (same version number)
.PHONY: replace-version
replace-version: validate-package build configure-npm
	@echo "$(YELLOW)⚠ Replacing existing version for $(PACKAGE)$(NC)"
	@echo "$(BLUE)Current version: $$(cd packages/$(PACKAGE) && node -p "require('./package.json').version")$(NC)"
	@echo "$(RED)This will OVERWRITE the existing version in GitHub Packages.$(NC)"
	@echo "$(RED)Only use this if no apps are consuming the package yet!$(NC)"
	@echo "$(YELLOW)Continue? (y/N)$(NC)"
	@read -r confirm && [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "$(RED)Aborted$(NC)" && exit 1)
	@cd packages/$(PACKAGE) && \
		NODE_AUTH_TOKEN=$$NODE_AUTH_TOKEN npm publish --force && \
		echo "$(GREEN)✓ Replaced version for @$(ORG)/$(PACKAGE)$(NC)" && \
		rm -f .npmrc

# Get package version
.PHONY: get-version
get-version: validate-package
	@cd packages/$(PACKAGE) && \
		node -p "require('./package.json').version"

# Publish with version bump
.PHONY: publish-bump
publish-bump: validate-package version publish
	@echo "$(GREEN)✓ Published $(PACKAGE) with version bump$(NC)"

# Check if package has publishConfig
.PHONY: check-publish-config
check-publish-config: validate-package
	@echo "$(BLUE)Checking publish configuration for $(PACKAGE)...$(NC)"
	@cd packages/$(PACKAGE) && \
		if grep -q "publishConfig" package.json; then \
			echo "$(GREEN)✓ Package has publishConfig$(NC)"; \
			node -p "JSON.stringify(require('./package.json').publishConfig, null, 2)"; \
		else \
			echo "$(RED)⚠ Package missing publishConfig$(NC)"; \
			echo "$(YELLOW)Add this to package.json:$(NC)"; \
			echo '  "publishConfig": {'; \
			echo '    "registry": "$(GITHUB_REGISTRY)",'; \
			echo '    "access": "restricted"'; \
			echo '  }'; \
		fi

# Publish all packages (be careful with this!)
.PHONY: publish-all
publish-all: check-auth
	@echo "$(YELLOW)⚠ Publishing ALL packages to GitHub Packages$(NC)"
	@echo "$(RED)This will publish ALL packages. Continue? (y/N)$(NC)"
	@read confirm && [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "Aborted" && exit 1)
	@for pkg in $$(find packages -name "package.json" -not -path "*/node_modules/*" | \
		xargs grep -l '"name".*"@$(ORG)/' | \
		sed 's|packages/\([^/]*\)/package.json|\1|'); do \
		echo "$(BLUE)Publishing $$pkg...$(NC)"; \
		$(MAKE) publish PACKAGE=$$pkg || echo "$(RED)Failed to publish $$pkg$(NC)"; \
	done

# Status check for all packages
.PHONY: status
status:
	@echo "$(BLUE)Package Status:$(NC)"
	@for pkg in $$(find packages -name "package.json" -not -path "*/node_modules/*" | \
		xargs grep -l '"name".*"@$(ORG)/' | \
		sed 's|packages/\([^/]*\)/package.json|\1|'); do \
		echo -n "  $$pkg: "; \
		cd packages/$$pkg && node -p "require('./package.json').version" && cd ../..; \
	done

# Create release commit
.PHONY: release-commit
release-commit: validate-package
	@echo "$(BLUE)Creating release commit for $(PACKAGE)...$(NC)"
	@VERSION=$$(cd packages/$(PACKAGE) && node -p "require('./package.json').version") && \
		git add packages/$(PACKAGE)/package.json && \
		git commit -m "Release @$(ORG)/$(PACKAGE) v$$VERSION" && \
		echo "$(GREEN)✓ Created release commit for $(PACKAGE) v$$VERSION$(NC)"

# Full release workflow: version bump, commit, publish
.PHONY: release
release: validate-package version release-commit publish
	@echo "$(GREEN)✓ Full release completed for $(PACKAGE)$(NC)"

.DEFAULT_GOAL := help