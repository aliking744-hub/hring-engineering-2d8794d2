from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceOutputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    feature_key: str = Field(serialization_alias="featureKey")
    title: str
    payload_json: dict[str, object] = Field(serialization_alias="payload")
    created_at: datetime = Field(serialization_alias="createdAt")
