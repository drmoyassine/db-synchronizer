# Project Memory

## Technical Decisions

### Redis as State Manager (2025-12-22)
- **Reason**: Handling large sync jobs with conflict resolution in-memory (config DB) was not scalable.
- **Implementation**: Records are "captured" to Redis with a TTL (default 4 hours).
- **Benefit**: Faster resolution, zero bloat in the persistent config DB.

### Jinja2 Expression Engine (2025-12-22)
- **Reason**: Needed an "n8n-style" dynamic mapping capability.
- **Implementation**: `ExpressionEngine` handles `{{ master.field }}` and `@field` shorthands.
- **Benefit**: Users can perform complex transformations (math, string concat) without code changes.

### SQLAdapter Consolidation (2025-12-22)
- **Reason**: Repetitive SQL sanitization and WHERE clause building across 4+ adapters.
- **Implementation**: Abstracted `_build_where_clause` and `_sanitize_host` into `SQLAdapter`.
- **Benefit**: Unified query building and easier maintenance of SQL sources.

### Modular Frontend API (2025-12-22)
- **Reason**: `api/index.ts` was becoming a monolith (200+ lines).
- **Implementation**: Split into `client.ts`, `datasources.ts`, `sync.ts`, `settings.ts`.
- **Benefit**: Better readability and easier testing.

## Unresolved Items / Roadmap
- [ ] Decrypt datasource passwords in adapters (currently using `TODO: decrypt`).
- [ ] Implement Redis Settings UI for TTL and URL management.
- [ ] Add unit tests for the Expression Engine's edge cases.
- [ ] Enhance Data Inspector for more interactive view mapping.
