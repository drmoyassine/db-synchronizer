# DB Synchronizer

A standalone FastAPI microservice for multi-source database synchronization with master/slave architecture, field mapping, and conflict resolution.

## Features

- **Multi-source sync**: Supabase ↔ PostgreSQL ↔ WordPress ↔ Neon
- **Jinja2 Expression Engine**: Map columns using powerful templates (e.g., `{{ master.price * 1.2 }}`) and `@field` shorthands
- **Redis-Backed State Management**: High-performance, on-demand sync flow with TTL-based state tracking
- **Conflict resolution**: 5 strategies (source wins, target wins, manual, merge, webhook)
- **Async job orchestration**: Background sync with standardized error handling
- **Admin Web UI**: Visual management for datasources, sync configs, and active syncs with a "n8n-style" expression editor

## Project Structure

```
db-synchronizer/
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── adapters/  # Database adapters (SQLAdapter base, WordPress meta-joins)
│   │   ├── engine/    # Sync engine (field mapper, conflict resolver, executor)
│   │   ├── services/  # Core logic (ExpressionEngine, StateManager)
│   │   ├── models/    # SQLAlchemy models
│   │   ├── routers/   # API endpoints
│   │   └── middleware/# Global exception handling
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/          # React admin UI
│   ├── src/
│   │   ├── api/       # Modular API clients (client, sync, datasources, settings)
│   │   ├── components/# Reusable UI (ExpressionEditor, DataPreviewModal)
│   │   ├── types/     # Centralized TypeScript interfaces
│   │   └── pages/     # Dashboard, Datasources, SyncConfigs, Conflicts, Jobs
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── .agent/            # Persistent agent context (memory, instructions)
```

## Key Components

| Component | File | Description |
|-----------|------|-------------|
| State Manager | `backend/app/services/state_manager.py` | Redis-backed sync state & TTL management |
| Expression Engine | `backend/app/services/expression_engine.py` | Jinja2 template evaluation for transforms |
| SQLAdapter | `backend/app/adapters/base.py` | Shared base for sanitized SQL operations |
| Global Errors | `backend/app/middleware/error_handler.py` | Standardized JSON error responses |
| Expression Editor | `frontend/src/components/ExpressionEditor.tsx` | n8n-style field mapping UI |

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

Create a `.env` file (see `.env.example` for details):

```env
# Backend
DATABASE_URL=sqlite+aiosqlite:///./data/config.db
SECRET_KEY=your-secret-key-change-in-production
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
REDIS_URL=redis://localhost:6379/0
SYNC_STATE_TTL=14400

# Frontend
VITE_API_URL=http://localhost:8001
```

## Architecture & Design Notes

### Redis-Powered Sync Workflow
The system follows a "Capture-Resolve-Flush" strategy using Redis:
- **In-Memory Caching**: Records from the master are captured to Redis with a TTL.
- **Resolution Cycle**: Data remains in Redis during conflict resolution, ensuring no source/target database bloat.
- **Atomic Flush**: Once resolved, the record is upserted to the target and the Redis state is cleared.

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
