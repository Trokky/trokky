#!/bin/bash

# Script to publish remaining packages that weren't published in initial release

echo "Publishing remaining Trokky packages..."

# Set npm auth token if provided
if [ -n "$NODE_AUTH_TOKEN" ]; then
  echo "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}" >> ~/.npmrc
fi

# Function to publish package if not already published
publish_if_not_exists() {
  PACKAGE_NAME=$1
  PACKAGE_PATH=$2
  
  echo "Checking $PACKAGE_NAME..."
  
  if npm view "${PACKAGE_NAME}@0.1.0" 2>/dev/null; then
    echo "✓ $PACKAGE_NAME already published"
  else
    echo "Publishing $PACKAGE_NAME..."
    cd "$PACKAGE_PATH"
    npm publish
    cd -
    echo "✓ $PACKAGE_NAME published"
  fi
}

# Publish remaining packages in dependency order
publish_if_not_exists "@trokky/structure" "packages/structure"
publish_if_not_exists "@trokky/client" "packages/client"
publish_if_not_exists "@trokky/adapter-filesystem" "packages/adapters/filesystem"
publish_if_not_exists "@trokky/adapter-filesystem-data" "packages/adapters/filesystem-data"
publish_if_not_exists "@trokky/adapter-filesystem-media" "packages/adapters/filesystem-media"
publish_if_not_exists "@trokky/studio" "packages/studio"
publish_if_not_exists "@trokky/express" "packages/integrations/express"

echo "Done!"