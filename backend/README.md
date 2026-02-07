# QHacks 2026 — Backend

FastAPI backend with a layered controller architecture.

## Architecture

```
app/
├── config/        # Settings, env loading
├── controllers/   # Request handling logic (thin — delegates to services)
├── services/      # Business logic
├── models/        # Pydantic request/response schemas
├── routes/        # FastAPI route definitions
└── middleware/     # CORS, error handling, auth guards
```

**Request flow:** `Route → Controller → Service → (Model)`

## Setup

```bash
cd backend

# Create & activate virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env and configure
cp .env.example .env

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at [http://localhost:8000/docs](http://localhost:8000/docs).

## Adding a New Feature

1. **Model** — Define request/response schemas in `app/models/`
2. **Service** — Write business logic in `app/services/`
3. **Controller** — Wire service calls in `app/controllers/`
4. **Route** — Expose endpoints in `app/routes/`, then register in `app/routes/router.py`
