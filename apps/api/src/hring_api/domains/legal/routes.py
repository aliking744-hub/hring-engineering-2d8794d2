"""Legal routes are intentionally registered empty in this WIP checkpoint.

The next work session will add the authenticated search and content-admin
ingestion/reindex endpoints after the migration and service tests are complete.
"""

from fastapi import APIRouter


router = APIRouter(prefix="/legal", tags=["legal"])
