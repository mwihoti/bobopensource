# Bob Open Source - AI-Powered GitHub Issue Analyzer

An intelligent tool that analyzes GitHub issues and generates comprehensive implementation plans by understanding your repository structure, dependencies, and code patterns.

## Features

- 🔍 **Issue Analysis**: Automatically extracts requirements, acceptance criteria, and affected components from GitHub issues
- 🏗️ **Repository Analysis**: Understands your codebase structure, patterns, and dependencies
- 🗺️ **Dependency Mapping**: Builds a complete dependency graph to identify impact of changes
- 📋 **Implementation Planning**: Generates step-by-step implementation plans with time estimates
- ⚠️ **Risk Assessment**: Identifies potential risks and suggests mitigation strategies
- 🧪 **Test Strategy**: Creates comprehensive testing strategies for your changes
- 📊 **Multiple Output Formats**: Supports Markdown, JSON, and DOT graph formats

## Installation

```bash
npm install -g bobopensource
```

Or install locally in your project:

```bash
npm install --save-dev bobopensource
```

## Quick Start

### Analyze an Issue and Generate Implementation Plan

```bash
bobopensource analyze https://github.com/owner/repo/issues/123
```

This will:
1. Analyze your repository structure
2. Parse the GitHub issue
3. Build a dependency map
4. Generate a complete implementation plan

### Analyze Repository Only

```bash
bobopensource repo
```

### Analyze Issue Only

```bash
bobopensource issue https://github.com/owner/repo/issues/123
```

### Generate Implementation Plan

```bash
bobopensource plan https://github.com/owner/repo/issues/123
```

### Analyze File Dependencies

```bash
bobopensource deps src/components/Button.tsx src/utils/helpers.ts
```

## Usage

### Full Analysis

```bash
# Analyze issue with full context
bobopensource analyze https://github.com/owner/repo/issues/123

# Specify repository path
bobopensource analyze https://github.com/owner/repo/issues/123 -r /path/to/repo

# Save output to file
bobopensource analyze https://github.com/owner/repo/issues/123 -o plan.md

# Output as JSON
bobopensource analyze https://github.com/owner/repo/issues/123 --json

# Skip dependency analysis
bobopensource analyze https://github.com/owner/repo/issues/123 --no-deps

# Skip implementation plan
bobopensource analyze https://github.com/owner/repo/issues/123 --no-plan
```

### Repository Analysis

```bash
# Analyze current directory
bobopensource repo

# Analyze specific repository
bobopensource repo -r /path/to/repo

# Generate dependency graph (DOT format)
bobopensource repo --graph -o dependencies.dot

# Output as JSON
bobopensource repo --json -o analysis.json
```

### Issue Analysis

```bash
# Analyze issue
bobopensource issue https://github.com/owner/repo/issues/123

# With repository context
bobopensource issue https://github.com/owner/repo/issues/123 -r /path/to/repo

# Save to file
bobopensource issue https://github.com/owner/repo/issues/123 -o issue-analysis.md
```

### Implementation Plan

```bash
# Generate plan
bobopensource plan https://github.com/owner/repo/issues/123

# Save to file
bobopensource plan https://github.com/owner/repo/issues/123 -o implementation-plan.md

# Output as JSON
bobopensource plan https://github.com/owner/repo/issues/123 --json
```

### Dependency Analysis

```bash
# Show dependencies of files
bobopensource deps src/app.ts src/utils.ts

# Show affected files (reverse dependencies)
bobopensource deps src/utils.ts --affected

# Generate dependency graph
bobopensource deps src/app.ts src/utils.ts --graph
```

## Configuration

Create a configuration file in your repository root:

### `.bobopensourcerc.json`

```json
{
  "ignorePatterns": [
    "node_modules",
    "dist",
    "build",
    ".git",
    "coverage"
  ],
  "maxFileSize": 1048576,
  "includeTests": true
}
```

### Supported Configuration Files

- `.bobopensourcerc`
- `.bobopensourcerc.json`
- `.bobopensourcerc.js`
- `bobopensource.config.js`
- `bobopensource.config.json`

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ignorePatterns` | `string[]` | `['node_modules', 'dist', 'build', '.git', 'coverage']` | Patterns to ignore during analysis |
| `maxFileSize` | `number` | `1048576` (1MB) | Maximum file size to analyze (in bytes) |
| `includeTests` | `boolean` | `true` | Whether to include test files in analysis |

## Output Examples

### Implementation Plan

The tool generates a comprehensive implementation plan including:

- **Prerequisites**: What needs to be done before starting
- **Implementation Steps**: Detailed step-by-step instructions
- **Test Strategy**: Unit, integration, and E2E test recommendations
- **Risk Assessment**: Potential risks and mitigation strategies
- **Time Estimates**: Estimated hours for completion
- **Review Points**: When to pause for code review
- **Rollback Strategy**: How to safely revert changes if needed

### Dependency Report

```
# Dependency Analysis Report

## Overview
- Total Components: 45
- Total Dependencies: 123
- Average Complexity: 3.2
- High Impact Components: 8
- Circular Dependencies: 0

## Critical Components (High Change Impact)
- **src/core/engine.ts**
  - Dependents: 15
  - Complexity: 8.5

## Most Complex Components
- **src/core/engine.ts** (Complexity: 8.5)
  - Dependencies: 12
  - Dependents: 15
```

## How It Works

1. **Repository Analysis**: Scans your codebase to understand structure, patterns, and tech stack
2. **Issue Parsing**: Extracts requirements, acceptance criteria, and affected components from the issue
3. **Dependency Mapping**: Builds a complete dependency graph of your codebase
4. **Impact Analysis**: Identifies all files that will be affected by the changes
5. **Plan Generation**: Creates a step-by-step implementation plan with time estimates
6. **Risk Assessment**: Identifies potential risks and suggests mitigation strategies
7. **Test Strategy**: Recommends comprehensive testing approach

## Supported Project Types

- React / React Native
- Vue.js / Nuxt.js
- Angular
- Node.js / Express
- TypeScript / JavaScript
- And more...

## Requirements

- Node.js 14 or higher
- Git repository
- GitHub issue URL (for issue analysis)

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/bobopensource.git

# Install dependencies
cd bobopensource
npm install

# Build
npm run build

# Run locally
npm link
bobopensource --help
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

- 📖 [Documentation](https://github.com/yourusername/bobopensource/wiki)
- 🐛 [Issue Tracker](https://github.com/yourusername/bobopensource/issues)
- 💬 [Discussions](https://github.com/yourusername/bobopensource/discussions)

## Roadmap

- [ ] GitHub API integration for automatic issue fetching
- [ ] Support for GitLab and Bitbucket
- [ ] AI-powered code generation
- [ ] Integration with project management tools
- [ ] VS Code extension
- [ ] Web interface

## Credits

Built with ❤️ by the Bob Open Source team# bobopensource
