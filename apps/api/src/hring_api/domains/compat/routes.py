from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.compat.functions import (
    BLOCKED_SENSITIVE_FUNCTIONS,
    NON_AI_SPECIAL_FUNCTIONS,
    CompatFunctionError,
    CompatFunctionUnavailableError,
    invoke_ai_function,
)
from hring_api.domains.compat.schemas import (
    CompatFunctionRequest,
    CompatQueryRequest,
    CompatQueryResponse,
    CompatRpcRequest,
    StorageDeleteRequest,
    StorageListRequest,
)
from hring_api.domains.compat.service import (
    CompatError,
    CompatForbiddenError,
    deduct_user_credits,
    execute_query,
    get_user_credits,
)
from hring_api.domains.compat.storage import (
    PUBLIC_LOGICAL_BUCKETS,
    StorageCompatError,
    delete_objects,
    list_objects,
    put_object,
    read_object,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(prefix="/compat", tags=["compatibility"])


def _compat_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, CompatForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, CompatFunctionUnavailableError):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    if isinstance(exc, CompatFunctionError):
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    if isinstance(exc, StorageCompatError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/query", response_model=CompatQueryResponse)
async def query_compat_store(
    payload: CompatQueryRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompatQueryResponse:
    try:
        data = await execute_query(db, request=payload, principal=principal)
    except CompatError as exc:
        raise _compat_http_error(exc) from exc
    count = len(data) if isinstance(data, list) else (0 if data is None else 1)
    return CompatQueryResponse(data=data, count=count)


@router.post("/public/query", response_model=CompatQueryResponse)
async def query_public_compat_store(
    payload: CompatQueryRequest,
    db: AsyncSession = Depends(get_db_session),
) -> CompatQueryResponse:
    try:
        data = await execute_query(db, request=payload, principal=None, public=True)
    except CompatError as exc:
        raise _compat_http_error(exc) from exc
    count = len(data) if isinstance(data, list) else (0 if data is None else 1)
    return CompatQueryResponse(data=data, count=count)


@router.post("/rpc", response_model=CompatQueryResponse)
async def execute_compat_rpc(
    payload: CompatRpcRequest,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> CompatQueryResponse:
    try:
        if payload.name == "get_user_credits":
            data: Any = await get_user_credits(db, principal=principal)
        elif payload.name == "deduct_credits":
            raw_amount = payload.args.get("amount")
            if isinstance(raw_amount, bool) or not isinstance(raw_amount, int):
                raise CompatError("amount must be an integer")
            data = await deduct_user_credits(db, principal=principal, amount=raw_amount)
        else:
            raise CompatFunctionUnavailableError(
                f"RPC {payload.name} requires a dedicated HRing service"
            )
    except (CompatError, CompatFunctionUnavailableError) as exc:
        raise _compat_http_error(exc) from exc
    return CompatQueryResponse(data=data, count=1)


@router.post("/public-functions/hring-support", response_model=CompatQueryResponse)
async def public_support(
    payload: CompatFunctionRequest,
    settings: Settings = Depends(get_settings),
) -> CompatQueryResponse:
    try:
        data = await invoke_ai_function(
            name="hring-support",
            body=payload.body,
            principal=None,
            settings=settings,
        )
    except CompatFunctionError as exc:
        raise _compat_http_error(exc) from exc
    return CompatQueryResponse(data=data, count=1)


@router.post("/functions/{name}", response_model=CompatQueryResponse)
async def execute_compat_function(
    name: str,
    payload: CompatFunctionRequest,
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> CompatQueryResponse:
    if name in BLOCKED_SENSITIVE_FUNCTIONS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{name} must use a dedicated security-sensitive HRing API",
        )
    if name == "submit-feedback":
        request = CompatQueryRequest(
            table="site_feedback",
            operation="insert",
            values=payload.body if isinstance(payload.body, dict) else {"feedback": payload.body},
            single=True,
        )
        try:
            data = await execute_query(db, request=request, principal=principal)
        except CompatError as exc:
            raise _compat_http_error(exc) from exc
        return CompatQueryResponse(data={"success": True, "record": data}, count=1)
    if name in NON_AI_SPECIAL_FUNCTIONS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{name} requires its dedicated independent HRing adapter",
        )
    try:
        data = await invoke_ai_function(
            name=name,
            body=payload.body,
            principal=principal,
            settings=settings,
        )
    except CompatFunctionError as exc:
        raise _compat_http_error(exc) from exc
    return CompatQueryResponse(data=data, count=1)


@router.post("/storage/{logical_bucket}/upload/{object_path:path}")
async def upload_compat_object(
    logical_bucket: str,
    object_path: str,
    file: UploadFile = File(...),
    _principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    try:
        key = put_object(
            settings,
            logical_bucket=logical_bucket,
            path=object_path,
            stream=file.file,
            content_type=file.content_type,
        )
    except StorageCompatError as exc:
        raise _compat_http_error(exc) from exc
    return {"path": object_path, "key": key}


@router.post("/storage/{logical_bucket}/remove")
async def remove_compat_objects(
    logical_bucket: str,
    payload: StorageDeleteRequest,
    _principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    try:
        delete_objects(settings, logical_bucket=logical_bucket, paths=payload.paths)
    except StorageCompatError as exc:
        raise _compat_http_error(exc) from exc
    return {"removed": len(payload.paths)}


@router.post("/storage/{logical_bucket}/list")
async def list_compat_objects(
    logical_bucket: str,
    payload: StorageListRequest,
    _principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    try:
        rows = list_objects(
            settings,
            logical_bucket=logical_bucket,
            prefix=payload.prefix,
            limit=payload.limit,
        )
    except StorageCompatError as exc:
        raise _compat_http_error(exc) from exc
    return {"data": rows}


@router.get("/storage/public/{logical_bucket}/{object_path:path}")
async def read_public_compat_object(
    logical_bucket: str,
    object_path: str,
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    if logical_bucket not in PUBLIC_LOGICAL_BUCKETS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object not found")
    try:
        stream, content_type = read_object(
            settings,
            logical_bucket=logical_bucket,
            path=object_path,
        )
    except StorageCompatError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object not found") from exc
    return StreamingResponse(stream, media_type=content_type)


@router.get("/storage/private/{logical_bucket}/{object_path:path}")
async def read_private_compat_object(
    logical_bucket: str,
    object_path: str,
    _principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    try:
        stream, content_type = read_object(
            settings,
            logical_bucket=logical_bucket,
            path=object_path,
        )
    except StorageCompatError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Object not found") from exc
    return StreamingResponse(stream, media_type=content_type)
