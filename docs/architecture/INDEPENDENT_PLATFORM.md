# HRing Independent Platform Architecture

## Decision
HRing will be migrated from the current Lovable/Supabase runtime to an independent platform through incremental replacement, not a big-bang rewrite.

## Target Runtime

```text
React Web/Admin
      |
      v
HRing API (FastAPI / Pydantic)
      |
      +--> Domain services
      |      +--> PostgreSQL + pgvector
      |      +--> Redis
      |      +--> Celery workers
      |      +--> MinIO / S3-compatible private storage
      |      +--> AI Gateway -> vLLM/Ollama or approved providers
      |
      +--> Audit / metrics / logs
             +--> Prometheus
             +--> Grafana
             +--> Loki
```

## Dependency Rule
Frontend code must talk to a centralized HRing API client. It must not acquire new direct dependencies on Supabase, databases, storage providers, model providers, or payment providers.

## Migration Strategy
Use strangler migration domain by domain:

1. Inventory current UI routes, Supabase tables, RLS policies, Edge Functions, auth behavior, storage behavior and external providers.
2. Implement the equivalent independent domain behind `/api/v1`.
3. Add server-side authorization, tenant isolation, validation, audit and tests.
4. Migrate data/files needed for that domain with reconciliation.
5. Switch frontend traffic to the HRing API.
6. Observe and verify behavior in staging.
7. Remove the corresponding Supabase dependency only after rollback is available.

## Platform Components

### API
- FastAPI
- Pydantic v2 request/response contracts
- SQLAlchemy 2 async repositories
- Versioned routes
- Standard error envelope and request correlation IDs

### Database
- Independent PostgreSQL
- pgvector for vector/RAG use cases
- Alembic migrations as the only schema-change mechanism
- Backup/restore and reconciliation procedures before production cutover

### Queue / Cache
- Redis
- Celery or explicitly approved equivalent
- Idempotent background jobs, retries, dead-letter/failure visibility

### Files
- MinIO/S3-compatible private buckets
- Presigned upload/download
- MIME/type validation, size limits and malware scanning controls

### AI Platform
- Provider-neutral gateway
- OpenAI-compatible internal endpoint target using vLLM/Ollama
- Provider/model/prompt versioning
- Structured output validation before persistence
- RAG where required
- Key rotation, scopes, quotas and cost/usage telemetry

### Security
- Independent authentication/session flows
- Server-side RBAC
- Tenant isolation and IDOR tests
- MFA/reset/session controls where required
- Audit logs for sensitive operations

### Admin / Control Center
Must cover users, companies, roles, permissions, plans, credits, payments, files, models, APIs, prompts, feature flags, queues/jobs, reports, support and system health.

### Operations
- Docker Compose for reproducible local/staging setup
- CI/CD with migrations and rollback
- Separate dev/staging/production configuration
- Prometheus/Grafana/Loki observability
- Clean-server install from documentation

## Acceptance Gate: Independence
HRing is not considered independent until all of the following are true:

- No operational Lovable dependency is required to run or deploy the product.
- No operational Supabase URL, SDK, Auth, Storage, database or Edge Function dependency remains.
- Frontend uses the HRing API boundary.
- Database, files, auth and background jobs run on owned/controlled infrastructure.
- AI providers can be changed through configuration/adapters rather than page rewrites.
- A clean environment can be created from source + documented migrations/configuration.
- Data/file reconciliation, backup/restore and rollback have been demonstrated.
