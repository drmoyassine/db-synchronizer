# Agent Overview

This project is a high-performance database synchronization microservice. It uses a master/slave architecture with a specialized focus on multi-source syncing (Postgres, WordPress/MySQL, Supabase, Neon).

## Current Status
- **Phase**: core refactoring complete.
- **Key Features**: Redis-backed sync state, Jinja2 expression engine, modular frontend API.
- **Tech Stack**: FastAPI, React (Vite), Redis, SQLite (for config).

## Architectural Guidelines
1. **Adapters**: All SQL-based adapters must inherit from `SQLAdapter` in `backend/app/adapters/base.py`.
2. **State**: Business logic state (captured records) belongs in `StateManager` (Redis).
3. **Mappers**: Field mapping uses the `ExpressionEngine` (Jinja2). Do not implement ad-hoc string formatting for transforms.
4. **Types**: Frontend types must be centralized in `frontend/src/types/index.ts`.
5. **API**: Modular API clients are located in `frontend/src/api/`.

## Working with this Repository
- **Backend Port**: 8001 (default)
- **Frontend Port**: 5173 (default)
- **Environment**: Use `.env.example` as a template.
