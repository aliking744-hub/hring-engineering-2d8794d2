"""Import all ORM models so Alembic can discover complete metadata."""

from hring_api.domains.access import models as access_models
from hring_api.domains.admin import models as admin_models
from hring_api.domains.ai import models as ai_models
from hring_api.domains.billing import models as billing_models
from hring_api.domains.compat import models as compat_models
from hring_api.domains.identity import models as identity_models
from hring_api.domains.identity import security_models as identity_security_models
from hring_api.domains.identity import sms_models as identity_sms_models
from hring_api.domains.integrations import models as integration_models
from hring_api.domains.recruiting import models as recruiting_models


__all__ = [
    "access_models",
    "admin_models",
    "ai_models",
    "billing_models",
    "compat_models",
    "identity_models",
    "identity_security_models",
    "identity_sms_models",
    "integration_models",
    "recruiting_models",
]
