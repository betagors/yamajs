# Contributing to Yama

Thank you for your interest in contributing to Yama! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **pnpm**: Version 9.0.0 or higher (we use pnpm workspaces)
- **Git**: For version control

### Setting Up Your Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/yama.git
   cd yama
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build all packages**
   ```bash
   pnpm build
   ```

4. **Run tests to verify everything works**
   ```bash
   pnpm test
   ```

### Development Workflow

#### Running the Project Locally

- **Start all packages in development mode:**
  ```bash
  pnpm dev
  ```

- **Start only the core packages:**
  ```bash
  pnpm dev:packages
  ```

- **Start the documentation site:**
  ```bash
  pnpm dev:docs
  ```

- **Run the example app:**
  ```bash
  pnpm dev:example
  ```

#### Building

- **Build all packages:**
  ```bash
  pnpm build
  ```

- **Build only packages (not examples):**
  ```bash
  pnpm build:packages
  ```

- **Build documentation:**
  ```bash
  pnpm build:docs
  ```

#### Testing

- **Run all tests:**
  ```bash
  pnpm test
  ```

- **Run linting:**
  ```bash
  pnpm lint
  ```

### Project Structure

Yama is a monorepo managed with pnpm workspaces and Turborepo:

```
yama/
├── packages/          # Core packages
│   ├── cli/          # CLI tool
│   ├── core/         # Core runtime and types
│   ├── pglite/       # PGLite adapter
│   ├── postgres/     # PostgreSQL adapter
│   └── ...
├── apps/             # Applications
│   └── docs/         # Documentation site
├── examples/         # Example projects
└── test-app/         # Test application
```

## Making Changes

### Code Style

- Use modern TypeScript patterns
- Follow existing code style and conventions
- Use clear, descriptive function and variable names
- Break down complex functions into smaller, focused utilities
- Don't hesitate to refactor for better structure and readability

### Package Naming

When creating new packages, follow our [Naming Conventions](docs/NAMING_CONVENTIONS.md). Key rules:

- All packages use the format `@betagors/yama-{descriptor}`
- Use single words or compound words (no hyphens after `yama-`)
- For vendor services with generic names, use abbreviated prefixes (e.g., `yama-supaauth`)

### Commit Messages

Write clear, descriptive commit messages. We follow a loose convention:

- Use present tense ("Add feature" not "Added feature")
- Start with a capital letter
- Keep the first line under 72 characters
- Add more details in the body if needed

Example:
```
Add support for environment variable interpolation

This allows users to use ${VAR_NAME} syntax in yama.yaml
config files, which will be resolved from environment
variables or .env files.
```

### Testing Your Changes

Before submitting a pull request:

1. **Run the test suite:**
   ```bash
   pnpm test
   ```

2. **Run linting:**
   ```bash
   pnpm lint
   ```

3. **Build all packages:**
   ```bash
   pnpm build
   ```

4. **Test your changes manually** if applicable (e.g., test CLI commands, test the example app)

## Opening a Pull Request

1. **Create a branch** from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit them with clear messages

3. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a Pull Request** on GitHub:
   - Target the `develop` branch
   - Provide a clear title and description
   - Reference any related issues
   - Include screenshots or examples if applicable

### Pull Request Guidelines

- **Keep PRs focused**: One feature or fix per PR
- **Keep PRs small**: Easier to review and merge
- **Add tests**: Include tests for new features or bug fixes
- **Update documentation**: Update relevant docs if you change behavior
- **Be responsive**: Address review comments promptly

### What to Include in Your PR Description

- **What changed**: Brief summary of changes
- **Why**: Motivation or problem being solved
- **How**: Implementation approach (if relevant)
- **Testing**: How you tested the changes
- **Screenshots/Examples**: If applicable

## Reporting Issues

If you find a bug or have a feature request:

1. **Check existing issues** to see if it's already reported
2. **Create a new issue** with:
   - Clear title and description
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Code examples or error messages if applicable

## Getting Help

- Check the [documentation](https://yamajs.org) (if available)
- Search existing issues and discussions
- Open a new issue for questions or problems

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). We're committed to providing a welcoming and inclusive environment for all contributors.

## License

By contributing to Yama, you agree that your contributions will be licensed under the Mozilla Public License 2.0 (MPL-2.0).

Thank you for contributing to Yama! 🎉

