# Gobun

A Bun workspace monorepo with backend, frontend, and shared packages.

## Structure

- `packages/backend/` - Backend services
  - `core/` - Backend business logic and domain code
  - `server/` - Backend server application (Fastify, Express, etc.)
- `packages/frontend/` - Frontend applications
  - `app/` - Frontend application (React, Vue, etc.)
  - `core/` - Frontend business logic and domain code
- `packages/shared/` - Shared utilities
  - `core/` - Shared utility functions

## Architecture

- **Core packages** (`backend/core`, `frontend/core`) contain the bulk of business logic and domain code
- **App/Server packages** are thin layers that tie business logic into delivery frameworks (React, Fastify, etc.)
- **Shared packages** provide common utilities across the entire application

## Development

```bash
# Install dependencies
bun install

# Run both frontend and backend in development mode
bun run dev

# Run frontend only
bun run dev:frontend

# Run backend only
bun run dev:backend

# Type check all packages
bun run typecheck

# Format code
bun run format
```
