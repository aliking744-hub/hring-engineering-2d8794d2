from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


FilterOperator = Literal["eq", "neq", "in", "is", "gt", "gte", "lt", "lte", "contains"]
QueryOperation = Literal["select", "insert", "update", "delete", "upsert"]


class QueryFilter(BaseModel):
    column: str = Field(min_length=1, max_length=120)
    operator: FilterOperator
    value: Any = None

    @field_validator("column")
    @classmethod
    def normalize_column(cls, value: str) -> str:
        return value.strip()


class QueryOrder(BaseModel):
    column: str = Field(min_length=1, max_length=120)
    ascending: bool = True


class CompatQueryRequest(BaseModel):
    table: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9_]+$")
    operation: QueryOperation
    columns: str | None = Field(default="*", max_length=4000)
    values: dict[str, Any] | list[dict[str, Any]] | None = None
    filters: list[QueryFilter] = Field(default_factory=list, max_length=30)
    order: QueryOrder | None = None
    limit: int | None = Field(default=None, ge=1, le=2000)
    single: bool = False
    maybe_single: bool = False
    on_conflict: str | None = Field(default=None, max_length=120)


class CompatQueryResponse(BaseModel):
    data: Any = None
    count: int | None = None


class CompatFunctionRequest(BaseModel):
    body: Any = None


class CompatRpcRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9_]+$")
    args: dict[str, Any] = Field(default_factory=dict)


class StorageDeleteRequest(BaseModel):
    paths: list[str] = Field(min_length=1, max_length=100)


class StorageListRequest(BaseModel):
    prefix: str = Field(default="", max_length=1000)
    limit: int = Field(default=100, ge=1, le=1000)
