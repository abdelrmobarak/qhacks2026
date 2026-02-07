# Sandbox Backend

FastAPI API + Redis-backed job queue (RQ) for Gmail/Calendar snapshot ingestion.

## Local Development

### 1) Prerequisites

- Python 3.11+
- PostgreSQL (local or via Docker)
- Redis (local or via Docker)

### 2) Create a virtualenv and install deps

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3) Start PostgreSQL (required for data storage)

```bash
docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sandbox postgres:15
```

### 4) Start Redis (required for the worker)

```bash
docker run --rm -p 6379:6379 redis:7
```

### 5) Configure environment

```bash
cp .env.example .env
# Edit .env with your values (Google OAuth credentials, etc.)
```

Generate secrets using:
```bash
# Session/OAuth secrets
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Token encryption key (Fernet)
python -c "import os,base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

LLM configuration (default: OpenAI):
```bash
export LLM_PROVIDER=openai
export LLM_MODEL=gpt-4o-mini
export OPENAI_API_KEY=...

# Optional: disable the verification/fix agents to reduce latency
export STORY_VERIFICATION_ENABLED=false
```

### 6) Run database migrations

```bash
alembic upgrade head
```

### 7) Run the API

```bash
uvicorn app.main:app --reload --port 8000
```

### 8) Run the worker (in a separate terminal)

```bash
source .venv/bin/activate
rq worker --url redis://localhost:6379/0 sandbox
```

### 9) Run the scheduler (in a separate terminal, for cleanup jobs)

```bash
source .venv/bin/activate
rqscheduler --host localhost --port 6379 --db 0
```

The scheduler handles periodic tasks like:
- Daily cleanup of expired snapshots (runs at 3 AM UTC)

## API Endpoints

### Auth
- `POST /auth/google/start` - Start OAuth flow, returns auth URL
- `GET /auth/google/callback` - OAuth callback (redirects to frontend)
- `GET /auth/status` - Check authentication status
- `POST /auth/logout` - Log out

### Snapshot
- `GET /snapshot/status` - Get snapshot status and progress
- `GET /snapshot/current` - Get current snapshot details

### Wrapped
- `GET /wrapped` - Get Wrapped metrics

### CRM
- `GET /crm/top` - Get Top 5 entities
- `GET /crm/top-orgs` - Get Top organizations
- `GET /crm/graph` - Get relationship graph
- `GET /crm/story/{entity_id}` - Get relationship story

### Billing
- `POST /billing/checkout` - Create Stripe checkout session
- `POST /billing/webhook` - Stripe webhook handler
- `GET /billing/status` - Get billing/entitlement status

### Privacy
- `DELETE /v1/me` - Delete all user data

## Architecture

```
app/
├── api/
│   ├── router.py          # Route configuration
│   └── routes/            # Endpoint implementations
├── core/
│   ├── env.py             # Settings/configuration
│   └── security.py        # Token encryption, sessions
├── db/
│   ├── engine.py          # Database connection
│   └── models.py          # SQLAlchemy models
├── jobs/
│   ├── ingest_snapshot.py # Main ingestion pipeline
│   └── cleanup.py         # Expired snapshot cleanup
├── services/
│   ├── gmail.py           # Gmail API client
│   ├── calendar.py        # Calendar API client
│   └── google_oauth.py    # OAuth flow
└── main.py                # FastAPI app
```

## Data Model

- **users** - User accounts
- **sessions** - User sessions (HttpOnly cookies)
- **snapshots** - Gmail/Calendar snapshots (90-day window)
- **evidence_items** - Emails and calendar events
- **entities** - People/orgs extracted from evidence
- **entity_evidence** - Links entities to evidence
- **artifacts** - Computed outputs (wrapped cards, stories, etc.)
- **entitlements** - Story unlock status

## Ingestion Pipeline

1. **Stage A: Init** - Create snapshot, set status=running
2. **Stage B: Gmail List** - List messages matching query
3. **Stage C: Gmail Fetch** - Fetch message details
4. **Stage D: Calendar Fetch** - Fetch calendar events
5. **Stage E: Wrapped Compute** - Calculate metrics
6. **Stage F: Entities Compute** - Extract and rank entities
7. **Stage G: Story Generate** - Generate relationship story for #1
8. **Stage H: Finalize** - Delete tokens, set expires_at
