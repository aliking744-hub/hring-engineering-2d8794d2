"""Import all ORM models so Alembic can discover complete metadata."""

from hring_api.domains.identity import models as identity_models
from hring_api.domains.identity import sms_models as identity_sms_models


__all__ = ["identity_models", "identity_sms_models"]
