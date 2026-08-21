# HRing API

Independent backend for HRing.

## Local development

1. Copy `.env.example` to `.env`.
2. From `infra/compose`, run `docker compose -f docker-compose.dev.yml up --build`.
3. API: `http://localhost:8000`
4. Health: `GET /api/v1/health`
5. OpenAPI docs in development: `/docs`

## Quality

```bash
python -m pip install -e ".[dev]"
ruff check src tests
mypy src
pytest
```

## Architecture constraints

Read `AGENTS.md` before changing this service. This backend must remain independent from Supabase/Lovable runtime dependencies.
