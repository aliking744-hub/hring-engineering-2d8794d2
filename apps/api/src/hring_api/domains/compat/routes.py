from __future__ import annotations

from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.config import Settings, get_settings
from hring_api.db.session import get_db_session
from hring_api.domains.compat.downloads import (
    ProductDownloadError,
    ProductDownloadForbiddenError,
    create_product_download_url,
    decode_product_download_token,
)
from hring_api.domains.compat.functions import (
    BLOCKED_SENSITIVE_FUNCTIONS,
    NON_AI_SPECIAL_FUNCTIONS,
    CompatFunctionError,
    CompatFunctionUnavailableError,
    invoke_ai_function,
)
from hring_api.domains.compat.learning_email import (
    LearningEmailError,
    LearningEmailUnavailableError,
    send_learning_path_email,
)
from hring_api.domains.compat.legal_import import (
    LegalImportError,
    LegalImportForbiddenError,
    extract_document_text,
    fetch_public_legal_source,
    html_to_text,
    save_legal_text,
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
from hring_api.domains.compat.storage_policy import (
    StoragePolicyError,
    StoragePolicyForbiddenError,
    authorize_storage_list_prefix,
    authorize_storage_object,
    is_storage_admin,
    validate_storage_upload,
)
from hring_api.domains.billing.credit_service import (
    CreditConflictError,
    CreditError,
    CreditForbiddenError,
    CreditNotFoundError,
    InsufficientCreditsError,
)
from hring_api.domains.identity.dependencies import Principal, get_current_principal


router = APIRouter(prefix="/compat", tags=["compatibility"])


def _compat_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, InsufficientCreditsError):
        return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc))
    if isinstance(exc, CreditForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, CreditNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, CreditConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, CreditError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if isinstance(
        exc,
        (
            CompatForbiddenError,
            LegalImportForbiddenError,
            ProductDownloadForbiddenError,
            StoragePolicyForbiddenError,
        ),
    ):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, (CompatFunctionUnavailableError, LearningEmailUnavailableError)):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    if isinstance(exc, CompatFunctionError):
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    if isinstance(
        exc,
        (
            StorageCompatError,
            StoragePolicyError,
            LegalImportError,
            ProductDownloadError,
            LearningEmailError,
        ),
    ):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _upload_size(file: UploadFile) -> int:
    declared_size = getattr(file, "size", None)
    if isinstance(declared_size, int):
        return declared_size
    current = file.file.tell()
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(current)
    return int(size)


async def _storage_admin_for_bucket(
    db: AsyncSession,
    *,
    principal: Principal,
    logical_bucket: str,
) -> bool:
    if logical_bucket != "products":
        return False
    return await is_storage_admin(db, principal)


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
    request: Request,
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
            raw_feature_key = payload.args.get("feature_key")
            feature_key = raw_feature_key if isinstance(raw_feature_key, str) else None
            data = await deduct_user_credits(
                db,
                principal=principal,
                amount=raw_amount,
                idempotency_key=request.headers.get("x-idempotency-key"),
                feature_key=feature_key,
                request_id=str(getattr(request.state, "request_id", ""))[:160] or None,
            )
        else:
            raise CompatFunctionUnavailableError(
                f"RPC {payload.name} requires a dedicated HRing service"
            )
    except (CompatError, CompatFunctionUnavailableError, CreditError) as exc:
        raise _compat_http_error(exc) from exc
    return CompatQueryResponse(data=data, count=1)


@router.post("/public-functions/hring-support", response_model=CompatQueryResponse)
async def public_support(
    payload: CompatFunctionRequest,
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> CompatQueryResponse:
    try:
        data = await invoke_ai_function(
            name="hring-support",
            body=payload.body,
            principal=None,
            settings=settings,
            session=db,
        )
    except CompatFunctionError as exc:
        raise _compat_http_error(exc) from exc
    return CompatQueryResponse(data=data, count=1)


@router.post("/files/extract-document-text")
async def import_legal_document(
    file: UploadFile = File(...),
    category: str = Form(...),
    source_url: str = Form("uploaded-document", alias="sourceUrl"),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    try:
        raw = await file.read(10 * 1024 * 1024 + 1)
        text = extract_document_text(file.filename or "document", raw)
        result = await save_legal_text(
            db,
            principal=principal,
            text=text,
            category=category,
            source_url=source_url,
            source_type="upload",
        )
    except (LegalImportError, LegalImportForbiddenError) as exc:
        raise _compat_http_error(exc) from exc
    return result.as_payload()


@router.get("/downloads/{token}")
async def download_product_file(
    token: str,
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    try:
        file_path, file_name = decode_product_download_token(token, settings)
        stream, content_type = read_object(
            settings,
            logical_bucket="product-files",
            path=file_path,
        )
    except (ProductDownloadError, StorageCompatError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Download link is invalid, expired, or unavailable",
        ) from exc
    encoded_name = quote(file_name, safe="")
    return StreamingResponse(
        stream,
        media_type=content_type or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f"attachment; filename=download; filename*=UTF-8''{encoded_name}"
            ),
            "Cache-Control": "private, no-store",
        },
    )


@router.post("/functions/{name}", response_model=CompatQueryResponse)
async def execute_compat_function(
    name: str,
    payload: CompatFunctionRequest,
    request: Request,
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
        query_request = CompatQueryRequest(
            table="site_feedback",
            operation="insert",
            values=payload.body if isinstance(payload.body, dict) else {"feedback": payload.body},
            single=True,
        )
        try:
            data = await execute_query(db, request=query_request, principal=principal)
        except CompatError as exc:
            raise _compat_http_error(exc) from exc
        return CompatQueryResponse(data={"success": True, "record": data}, count=1)
    if name == "download-product":
        if not isinstance(payload.body, dict) or not isinstance(payload.body.get("productId"), str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="productId is required"
            )
        try:
            url = await create_product_download_url(
                db,
                principal=principal,
                product_id=payload.body["productId"],
                settings=settings,
            )
        except (ProductDownloadError, ProductDownloadForbiddenError) as exc:
            raise _compat_http_error(exc) from exc
        return CompatQueryResponse(data={"url": url}, count=1)
    if name == "send-learning-path-email":
        try:
            data = await send_learning_path_email(
                body=payload.body,
                settings=settings,
                session=db,
            )
        except (LearningEmailError, LearningEmailUnavailableError) as exc:
            raise _compat_http_error(exc) from exc
        return CompatQueryResponse(data=data, count=1)
    if name in {"process-legal-html", "scrape-legal-docs"}:
        if not isinstance(payload.body, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid legal import payload",
            )
        category = payload.body.get("category")
        source_url = payload.body.get("sourceUrl")
        if not isinstance(category, str) or not isinstance(source_url, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="category and sourceUrl are required",
            )
        try:
            if name == "process-legal-html":
                raw_html = payload.body.get("htmlContent")
                if not isinstance(raw_html, str):
                    raise LegalImportError("htmlContent is required")
                text = html_to_text(raw_html)
                source_type = "manual-html"
            else:
                text, source_type = await fetch_public_legal_source(source_url)
            result = await save_legal_text(
                db,
                principal=principal,
                text=text,
                category=category,
                source_url=source_url,
                source_type=source_type,
            )
        except (LegalImportError, LegalImportForbiddenError) as exc:
            raise _compat_http_error(exc) from exc
        return CompatQueryResponse(data=result.as_payload(), count=result.saved_count)
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
            session=db,
            request_id=str(getattr(request.state, "request_id", ""))[:160] or None,
            idempotency_key=request.headers.get("x-idempotency-key"),
        )
    except (CompatFunctionError, CreditError) as exc:
        raise _compat_http_error(exc) from exc
    return CompatQueryResponse(data=data, count=1)


@router.post("/storage/{logical_bucket}/upload/{object_path:path}")
async def upload_compat_object(
    logical_bucket: str,
    object_path: str,
    file: UploadFile = File(...),
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    try:
        is_admin = await _storage_admin_for_bucket(
            db,
            principal=principal,
            logical_bucket=logical_bucket,
        )
        safe_path = authorize_storage_object(
            logical_bucket=logical_bucket,
            object_path=object_path,
            user_id=principal.user_id,
            is_admin=is_admin,
        )
        validate_storage_upload(
            logical_bucket=logical_bucket,
            object_path=safe_path,
            content_type=file.content_type,
            size_bytes=_upload_size(file),
        )
        key = put_object(
            settings,
            logical_bucket=logical_bucket,
            path=safe_path,
            stream=file.file,
            content_type=file.content_type,
        )
    except (StorageCompatError, StoragePolicyError) as exc:
        raise _compat_http_error(exc) from exc
    return {"path": safe_path, "key": key}


@router.post("/storage/{logical_bucket}/remove")
async def remove_compat_objects(
    logical_bucket: str,
    payload: StorageDeleteRequest,
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    try:
        is_admin = await _storage_admin_for_bucket(
            db,
            principal=principal,
            logical_bucket=logical_bucket,
        )
        safe_paths = [
            authorize_storage_object(
                logical_bucket=logical_bucket,
                object_path=path,
                user_id=principal.user_id,
                is_admin=is_admin,
            )
            for path in payload.paths
        ]
        delete_objects(settings, logical_bucket=logical_bucket, paths=safe_paths)
    except (StorageCompatError, StoragePolicyError) as exc:
        raise _compat_http_error(exc) from exc
    return {"removed": len(safe_paths)}


@router.post("/storage/{logical_bucket}/list")
async def list_compat_objects(
    logical_bucket: str,
    payload: StorageListRequest,
    principal: Principal = Depends(get_current_principal),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    try:
        is_admin = await _storage_admin_for_bucket(
            db,
            principal=principal,
            logical_bucket=logical_bucket,
        )
        safe_prefix = authorize_storage_list_prefix(
            logical_bucket=logical_bucket,
            prefix=payload.prefix,
            user_id=principal.user_id,
            is_admin=is_admin,
        )
        rows = list_objects(
            settings,
            logical_bucket=logical_bucket,
            prefix=safe_prefix,
            limit=payload.limit,
        )
    except (StorageCompatError, StoragePolicyError) as exc:
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Object not found"
        ) from exc
    return StreamingResponse(stream, media_type=content_type)


@router.get("/storage/private/{logical_bucket}/{object_path:path}")
async def read_private_compat_object(
    logical_bucket: str,
    object_path: str,
    _principal: Principal = Depends(get_current_principal),
) -> StreamingResponse:
    _ = (logical_bucket, object_path)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Private storage requires a dedicated HRing download endpoint",
    )
