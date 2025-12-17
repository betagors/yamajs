# @yamajs/yama

> Yama â€” backend as config (main convenience package)

[![npm version](https://img.shields.io/npm/v/@yamajs/yama.svg)](https://www.npmjs.com/package/@yamajs/yama)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

The main Yama package that re-exports everything from `@yamajs/core` for convenience. This is the recommended entry point for most users.

## Installation

```bash
npm install @yamajs/yama
```

## Usage

This package simply re-exports all exports from `@yamajs/core`, so you can use it as a drop-in replacement:

```typescript
// Instead of:
import { createSchemaValidator } from '@yamajs/core';

// You can use:
import { createSchemaValidator } from '@yamajs/yama';
```

All the same APIs are available. See [`@yamajs/core`](../core/README.md) for full documentation.

## Why This Package?

This package provides a cleaner import path for the main Yama functionality. Instead of importing from `@yamajs/core`, you can import from `@yamajs/yama` for a simpler, more intuitive API.

## Requirements

- Node.js >= 18

## License

MPL-2.0


