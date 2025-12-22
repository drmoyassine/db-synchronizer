# DB Synchronizer

A standalone FastAPI microservice for multi-source database synchronization with master/slave architecture, field mapping, and conflict resolution.

## Features

- **Multi-source sync**: Supabase ↔ PostgreSQL ↔ WordPress ↔ Neon
- **Field mapping engine**: Map columns between different schemas with transforms
- **Conflict resolution**: 5 strategies (source wins, target wins, manual, merge, webhook)
- **Async job orchestration**: Background sync with progress tracking
- **Admin Web UI**: Visual management for datasources and sync configs
- **Webhook triggers**: n8n, Zapier, ActivePieces integration

## Project Structure

```
db-synchronizer/
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── adapters/  # Database adapters (Supabase, Postgres, WordPress, Neon)
│   │   ├── engine/    # Sync engine (field mapper, conflict resolver, executor)
│   │   ├── models/    # SQLAlchemy models
│   │   ├── routers/   # API endpoints
│   │   ├── schemas/   # Pydantic schemas
│   │   └── tests/     # pytest tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/          # React admin UI
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── components/
│   │   └── pages/     # Dashboard, Datasources, SyncConfigs, Conflicts, Jobs
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Key Components

| Component | File | Description |
|-----------|------|-------------|
| FastAPI App | `backend/app/main.py` | Application entrypoint with routers |
| Postgres Adapter | `backend/app/adapters/postgres_adapter.py` | asyncpg-based PostgreSQL adapter |
| WordPress Adapter | `backend/app/adapters/wordpress_adapter.py` | MySQL adapter with wp_posts support |
| Supabase Adapter | `backend/app/adapters/supabase_adapter.py` | Extends Postgres with REST API |
| Neon Adapter | `backend/app/adapters/neon_adapter.py` | Serverless Postgres adapter |
| Field Mapper | `backend/app/engine/field_mapper.py` | Column mapping with transforms |
| Conflict Resolver | `backend/app/engine/conflict_resolver.py` | 5 resolution strategies + webhook |
| Sync Executor | `backend/app/engine/sync_executor.py` | Batch processing with progress |
| Admin Dashboard | `frontend/src/pages/Dashboard.tsx` | Stats and recent jobs |
| Datasources UI | `frontend/src/pages/Datasources.tsx` | Connection management |
| Conflicts UI | `frontend/src/pages/Conflicts.tsx` | Side-by-side resolution |

## Quick Start

### Docker (Recommended)

```bash
docker-compose up -d

# Access admin UI at http://localhost:5173
# Access API docs at http://localhost:8001/docs
```

### Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

Access interactive docs at http://localhost:8001/docs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/datasources` | Register datasource |
| GET | `/api/datasources` | List all datasources |
| POST | `/api/datasources/{id}/test` | Test connection |
| POST | `/api/sync-configs` | Create sync config |
| GET | `/api/sync-configs` | List sync configs |
| POST | `/api/sync/{configId}` | Execute sync |
| GET | `/api/sync/{jobId}/status` | Check job status |
| GET | `/api/sync/{configId}/conflicts` | Get conflicts |
| POST | `/api/sync/{configId}/resolve/{conflictId}` | Resolve conflict |
| POST | `/webhooks/n8n/{configId}` | n8n trigger |
| POST | `/webhooks/zapier/{configId}` | Zapier trigger |

## Configuration

Create a `.env` file:

```env
# Backend
DATABASE_URL=sqlite+aiosqlite:///./data/config.db
SECRET_KEY=your-secret-key-change-in-production
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Frontend
VITE_API_URL=http://localhost:8001

## Architecture & Design Notes

### Redis-Powered Sync Workflow
To maintain high performance and avoid database bloat during complex operations, the system follows a "Redis-first" sync strategy:
- **User-Provided Redis**: Users connect their own Redis instance via the Admin UI.
- **In-Memory Caching**: Active sync operations are handled entirely within Redis memory.
- **Resolution Cycle**: Data remains in the Redis cache during conflict resolution and is only committed to the target database once all conflicts are resolved or skipped.
- **Persistence**: Final sync results and audit logs are moved to the primary configuration database after the job completes.
```

## Usage Flow

1. **Add Datasources**: Register your master (e.g., Supabase) and slave (e.g., WordPress) databases
2. **Create Sync Config**: Define which tables to sync and map fields between schemas
3. **Set Conflict Strategy**: Choose how to handle data conflicts
4. **Execute Sync**: Run manually or trigger via webhook
5. **Resolve Conflicts**: Review and resolve any data conflicts in the UI

## Testing

```bash
cd backend
pytest tests/ -v --cov=app
```

## License

MIT
