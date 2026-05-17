# Setup and Running Guide

## Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager
- Git (for repository analysis)

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Project

```bash
npm run build
```

This compiles TypeScript files to JavaScript in the `dist/` directory.

### 3. Link for Global Usage (Optional)

To use the CLI globally on your system:

```bash
npm link
```

Now you can run `bobopensource` from anywhere.

## Running the Project

### Option 1: Using npm scripts

```bash
# Build and run
npm run cli -- analyze https://github.com/owner/repo/issues/123

# Or with specific commands
npm run cli -- repo
npm run cli -- issue https://github.com/owner/repo/issues/123
npm run cli -- plan https://github.com/owner/repo/issues/123
```

### Option 2: Direct execution (after build)

```bash
node dist/cli.js analyze https://github.com/owner/repo/issues/123
```

### Option 3: Global command (after npm link)

```bash
bobopensource analyze https://github.com/owner/repo/issues/123
```

## Available Commands

### 1. Full Analysis
Analyze issue and generate complete implementation plan:

```bash
bobopensource analyze https://github.com/owner/repo/issues/123
```

Options:
- `-r, --repo <path>` - Repository path (default: current directory)
- `-o, --output <file>` - Save output to file
- `--json` - Output in JSON format
- `--no-deps` - Skip dependency analysis
- `--no-plan` - Skip implementation plan

### 2. Repository Analysis
Analyze repository structure only:

```bash
bobopensource repo
```

Options:
- `-r, --repo <path>` - Repository path
- `-o, --output <file>` - Save output to file
- `--json` - Output in JSON format
- `--graph` - Generate dependency graph (DOT format)

### 3. Issue Analysis
Analyze GitHub issue only:

```bash
bobopensource issue https://github.com/owner/repo/issues/123
```

Options:
- `-r, --repo <path>` - Repository path for context
- `-o, --output <file>` - Save output to file
- `--json` - Output in JSON format

### 4. Implementation Plan
Generate implementation plan:

```bash
bobopensource plan https://github.com/owner/repo/issues/123
```

Options:
- `-r, --repo <path>` - Repository path
- `-o, --output <file>` - Save output to file
- `--json` - Output in JSON format

### 5. Dependency Analysis
Analyze file dependencies:

```bash
bobopensource deps src/app.ts src/utils.ts
```

Options:
- `-r, --repo <path>` - Repository path
- `--affected` - Show files affected by changes
- `--graph` - Generate dependency graph

## Examples

### Example 1: Analyze an issue and save plan to file

```bash
bobopensource analyze https://github.com/facebook/react/issues/12345 -o plan.md
```

### Example 2: Analyze repository and generate dependency graph

```bash
bobopensource repo --graph -o dependencies.dot
```

Then visualize with Graphviz:
```bash
dot -Tpng dependencies.dot -o dependencies.png
```

### Example 3: Check what files are affected by changes

```bash
bobopensource deps src/utils/helpers.ts --affected
```

### Example 4: Get JSON output for programmatic use

```bash
bobopensource analyze https://github.com/owner/repo/issues/123 --json > analysis.json
```

## Development

### Watch mode (auto-rebuild on changes)

```bash
npm run dev
```

### Run tests

```bash
npm test
```

### Lint code

```bash
npm run lint
```

### Format code

```bash
npm run format
```

## Configuration

Create a `.bobopensourcerc.json` file in your repository root:

```json
{
  "ignorePatterns": [
    "node_modules",
    "dist",
    "build",
    ".git"
  ],
  "maxFileSize": 1048576,
  "includeTests": true
}
```

## Troubleshooting

### Issue: "Command not found"

**Solution:** Make sure you've built the project and linked it:
```bash
npm run build
npm link
```

### Issue: "Cannot find module"

**Solution:** Install dependencies:
```bash
npm install
```

### Issue: "TypeScript compilation errors"

**Solution:** Check your TypeScript version and rebuild:
```bash
npm run build
```

### Issue: "Permission denied"

**Solution:** On Unix systems, you may need to make the CLI executable:
```bash
chmod +x dist/cli.js
```

## Next Steps

1. Try analyzing your first issue:
   ```bash
   bobopensource analyze <your-issue-url>
   ```

2. Explore the examples:
   ```bash
   node examples/basic-usage.ts
   ```

3. Read the full documentation in README.md

4. Configure the tool for your project with `.bobopensourcerc.json`

## Support

For issues and questions:
- Check the README.md for detailed documentation
- Review examples in `examples/basic-usage.ts`
- Open an issue on GitHub
