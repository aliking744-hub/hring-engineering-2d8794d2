"""Import all ORM models so Alembic can discover complete metadata."""

from hring_api.domains.identity import models as identity_models


__all__ = ["identity_models"]
