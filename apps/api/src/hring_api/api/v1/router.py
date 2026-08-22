from fastapi import APIRouter

from hring_api.api.v1.health import router as health_router
from hring_api.domains.access.routes import router as access_router
from hring_api.domains.admin.routes import router as admin_router
from hring_api.domains.ai.routes import router as ai_router
from hring_api.domains.billing.routes import router as billing_router
from hring_api.domains.companies.routes import router as companies_router
from hring_api.domains.companies.settings_routes import router as company_settings_router
from hring_api.domains.compat.routes import router as compat_router
from hring_api.domains.identity.recovery_routes import router as identity_recovery_router
from hring_api.domains.identity.routes import router as identity_router
from hring_api.domains.recruiting.ai_routes import router as recruiting_ai_router
from hring_api.domains.recruiting.routes import router as recruiting_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(identity_router)
api_router.include_router(identity_recovery_router)
api_router.include_router(companies_router)
api_router.include_router(company_settings_router)
api_router.include_router(access_router)
api_router.include_router(admin_router)
api_router.include_router(ai_router)
api_router.include_router(billing_router)
api_router.include_router(recruiting_router)
api_router.include_router(recruiting_ai_router)
api_router.include_router(compat_router)
