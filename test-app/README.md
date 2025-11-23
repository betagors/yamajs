# test-app

A Yama API project.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The server will start on [http://localhost:4000](http://localhost:4000).

## Project Structure

- `yama.yaml` - API configuration (schemas, endpoints, plugins)
- `src/handlers/` - Request handlers (your business logic)
- `.yama/` - Generated files (types, SDK)

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Generate types and SDK
- `pnpm start` - Start production server

## Learn More

- [Yama Documentation](https://github.com/betagors/yama)
- Edit `yama.yaml` to define your API schemas and endpoints
- Add handlers in `src/handlers/` to implement your business logic
