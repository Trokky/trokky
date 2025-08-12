# Trokky Client CLI Usage

The Trokky Client CLI provides powerful tools for generating TypeScript types and test documents from your schemas.

## Quick Access Methods

### From Project Root
```bash
cd /Users/amen/Projects/labs/Trokky/trokky-v2

# Access CLI
npm run client -- --help

# Generate types
npm run generate-types -- -o ./types

# Generate test documents  
npm run generate-docs -- -c 20 -f json -o ./generated

# Generate both types and documents
npm run generate-all -- --count 50
```

### From Demo Directory (with defaults)
```bash
cd examples/demo

# Access CLI (with API URL pre-configured)
npm run client -- --help

# Generate types (targets local API automatically)
npm run generate-types

# Generate test documents (targets local API automatically)
npm run generate-docs -- -c 50

# Generate everything (targets local API automatically)
npm run generate-all
```

### Direct Node Execution
```bash
# From anywhere in the project
node packages/client/dist/cli/index.js --help
node packages/client/dist/cli/index.js generate-types -u http://localhost:3000/api/v1/schemas
```

### Global Installation (after npm link)
```bash
cd packages/client
npm link

# Then from anywhere
trokky-client --help
trokky-client generate-types -u http://localhost:3000/api/v1/schemas
```

## Common Usage Patterns

### 1. Basic Type Generation
```bash
# From root - specify output directory
npm run generate-types -- -u http://localhost:3000/api/v1/schemas -o ./src/types

# From demo - uses defaults
npm run generate-types
```

### 2. Test Data Generation
```bash
# Generate 100 documents per schema in JSON format
npm run generate-docs -- -c 100 -f json -o ./test-data

# Generate with consistent seed for reproducible data
npm run generate-docs -- -s 12345 -c 50
```

### 3. Complete Setup
```bash
# Generate types and test data in one command
npm run generate-all -- --count 25 --types-dir ./src/types --docs-dir ./test-data
```

## CLI Options Reference

### generate-types
- `-u, --schema-url <url>` - Schema URL to fetch from
- `-o, --output-dir <dir>` - Output directory (default: ./src/types/trokky)
- `-n, --namespace <name>` - TypeScript namespace (default: Trokky)
- `-e, --extension <ext>` - File extension: ts|d.ts (default: ts)
- `--no-validation` - Skip validation schema generation

### generate-documents
- `-u, --schema-url <url>` - Schema URL to fetch from
- `-o, --output-dir <dir>` - Output directory (default: ./generated)
- `-c, --count <number>` - Documents per schema (default: 10)
- `-l, --locale <locale>` - Faker locale (default: en)
- `-s, --seed <number>` - Random seed for consistent generation
- `-f, --format <format>` - Output format: json|typescript|both (default: json)
- `--no-references` - Skip reference field generation

### generate-all
- `-u, --schema-url <url>` - Schema URL to fetch from
- `--types-dir <dir>` - Types output directory (default: ./src/types/trokky)
- `--docs-dir <dir>` - Documents output directory (default: ./generated)
- `-c, --count <number>` - Documents per schema (default: 10)
- `-l, --locale <locale>` - Faker locale (default: en)
- `-s, --seed <number>` - Random seed for consistent generation

## Prerequisites

1. **Build the client package first:**
   ```bash
   cd packages/client
   npm run build
   ```

2. **Start your Trokky API server:**
   ```bash
   npm run dev  # or cd examples/demo && npm run dev
   ```

3. **Ensure your API is accessible at the specified URL (default: http://localhost:3000)**

## Examples

```bash
# Quick development setup
npm run dev &  # Start API server
npm run generate-all  # Generate types and test data

# Production-ready type generation
npm run generate-types -- -u https://your-api.com/api/v1/schemas -o ./src/types

# Large test dataset
npm run generate-docs -- -c 1000 -f both -o ./massive-test-data
```