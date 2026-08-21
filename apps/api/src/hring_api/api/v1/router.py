from fastapi import APIRouter

from hring_api.api.v1.health import router as health_router
from hring_api.domains.identity.routes import router as identity_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(identity_router)
