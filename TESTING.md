# Testing Guide

## Setup

This project uses [Vitest](https://vitest.dev/) for testing. Vitest is a modern, fast testing framework that works great with TypeScript and ES modules.

## Running Tests

### Run all tests
```bash
pnpm test
```

### Run tests in watch mode (for development)
```bash
pnpm test:watch
```

### Run tests with coverage
```bash
# Run coverage for all packages
pnpm test:coverage

# Run coverage for a specific package
cd packages/core
pnpm test:coverage
```

Coverage reports are generated in each package's `coverage/` directory with:
- Text summary in the terminal
- JSON report (`coverage/coverage-final.json`)
- HTML report (`coverage/index.html`) - open in browser for detailed view

### Run tests for a specific package
```bash
cd packages/core
pnpm test
```

## Test Structure

Tests are located alongside source files with the `.test.ts` extension:

```
packages/
  core/
    src/
      infrastructure/
        database.test.ts
        server.test.ts
      plugins/
        validator.test.ts
  node/
    src/
      server/
        fastify-adapter.test.ts
  postgres/
    src/
      adapter.test.ts
```

## Writing Tests

### Basic Test Example

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./my-module.js";

describe("myFunction", () => {
  it("should return expected value", () => {
    const result = myFunction("input");
    expect(result).toBe("expected");
  });
});
```

### Testing Async Code

```typescript
import { describe, it, expect } from "vitest";
import { asyncFunction } from "./my-module.js";

describe("asyncFunction", () => {
  it("should handle async operations", async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
  });
});
```

### Testing Adapters

When testing adapters, focus on:
- Interface compliance
- Error handling
- Input/output transformation
- Edge cases

Example:
```typescript
import { describe, it, expect } from "vitest";
import { myAdapter } from "./adapter.js";

describe("MyAdapter", () => {
  it("should implement all required methods", () => {
    expect(myAdapter.init).toBeDefined();
    expect(myAdapter.getClient).toBeDefined();
    expect(myAdapter.close).toBeDefined();
  });

  it("should throw error when used before init", () => {
    expect(() => myAdapter.getClient()).toThrow("not initialized");
  });
});
```

## Test Categories

### Unit Tests
- Test individual functions and classes in isolation
- Use mocks for dependencies
- Fast execution
- Located in `*.test.ts` files

### Integration Tests
- Test multiple components working together
- May require external services (database, etc.)
- Slower execution
- Consider separate `*.integration.test.ts` files

## Best Practices

1. **Test one thing at a time** - Each test should verify a single behavior
2. **Use descriptive test names** - Test names should clearly describe what they test
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Mock external dependencies** - Don't rely on external services in unit tests
5. **Test edge cases** - Include tests for error conditions and boundary cases
6. **Keep tests fast** - Unit tests should run quickly

## Coverage Goals

- Aim for >80% code coverage
- Focus on critical paths and error handling
- Don't obsess over 100% coverage (it's often not worth it)

## Running Tests in CI

The test commands are configured in `package.json`:
```json
{
  "scripts": {
    "test": "turbo run test",
    "test:coverage": "turbo run test:coverage"
  }
}
```

These commands will run tests across all packages in the monorepo using Turbo for parallel execution.

## Coverage Configuration

All packages using Vitest have coverage configured with:
- **Provider**: v8 (fast, native coverage)
- **Reporters**: text (terminal), json (for CI), html (for detailed viewing)
- **Exclusions**: `node_modules/`, `dist/`, and test files are excluded from coverage

Each package has a `vitest.config.ts` file that configures coverage settings. Coverage reports are generated in each package's `coverage/` directory.

