from fastapi import APIRouter

from hring_api.api.v1.health import router as health_router
from hring_api.domains.access.routes import router as access_router
from hring_api.domains.admin.routes import router as admin_router
from hring_api.domains.ai.feature_routes import router as ai_feature_routes_router
from hring_api.domains.ai.prompt_routes import router as prompt_router
from hring_api.domains.ai.routes import router as ai_router
from hring_api.domains.ai.insight_routes import router as ai_insight_router
from hring_api.domains.billing.routes import router as billing_router
from hring_api.domains.billing.credit_routes import router as credit_router
from hring_api.domains.companies.routes import router as companies_router
from hring_api.domains.costing.routes import router as costing_router
from hring_api.domains.company_ai.routes import router as company_ai_router
from hring_api.domains.content.routes import admin_router as content_admin_router
from hring_api.domains.content.routes import router as content_router
from hring_api.domains.companies.settings_routes import router as company_settings_router
from hring_api.domains.compat.routes import router as compat_router
from hring_api.domains.development.routes import router as development_router
from hring_api.domains.hr_data.routes import router as hr_data_router
from hring_api.domains.identity.recovery_routes import router as identity_recovery_router
from hring_api.domains.identity.account_security_routes import router as account_security_router
from hring_api.domains.identity.routes import router as identity_router
from hring_api.domains.integrations.internal_routes import router as internal_integrations_router
from hring_api.domains.integrations.routes import router as integrations_router
from hring_api.domains.interview.routes import router as interview_router
from hring_api.domains.job_ads.routes import router as job_ads_router
from hring_api.domains.job_engineering.routes import router as job_engineering_router
from hring_api.domains.legal.routes import router as legal_router
from hring_api.domains.recruiting.ai_routes import router as recruiting_ai_router
from hring_api.domains.recruiting.routes import router as recruiting_router
from hring_api.domains.workspace_outputs.routes import router as workspace_outputs_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(identity_router)
api_router.include_router(identity_recovery_router)
api_router.include_router(account_security_router)
api_router.include_router(companies_router)
api_router.include_router(company_ai_router)
api_router.include_router(content_router)
api_router.include_router(content_admin_router)
api_router.include_router(company_settings_router)
api_router.include_router(access_router)
api_router.include_router(admin_router)
api_router.include_router(ai_router)
api_router.include_router(ai_insight_router)
api_router.include_router(ai_feature_routes_router)
api_router.include_router(prompt_router)
api_router.include_router(billing_router)
api_router.include_router(credit_router)
api_router.include_router(integrations_router)
api_router.include_router(internal_integrations_router)
api_router.include_router(recruiting_router)
api_router.include_router(recruiting_ai_router)
api_router.include_router(development_router)
api_router.include_router(costing_router)
api_router.include_router(hr_data_router)
api_router.include_router(job_ads_router)
api_router.include_router(job_engineering_router)
api_router.include_router(interview_router)
api_router.include_router(legal_router)
api_router.include_router(workspace_outputs_router)
api_router.include_router(compat_router)



