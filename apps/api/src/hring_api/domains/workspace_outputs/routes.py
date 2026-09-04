from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.db.session import get_db_session
from hring_api.domains.identity.dependencies import Principal, get_current_principal
from hring_api.domains.workspace_outputs.schemas import WorkspaceOutputResponse
from hring_api.domains.workspace_outputs.service import (
    delete_workspace_output,
    list_workspace_outputs,
)


router = APIRouter(prefix="/workspace/outputs", tags=["workspace-outputs"])


@router.get("", response_model=list[WorkspaceOutputResponse])
async def workspace_output_history(
    feature_key: str = Query(alias="featureKey", max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[WorkspaceOutputResponse]:
    rows = await list_workspace_outputs(
        db,
        principal=principal,
        feature_key=feature_key,
        limit=limit,
    )
    return [WorkspaceOutputResponse.model_validate(row) for row in rows]


@router.delete("/{output_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_workspace_output(
    output_id: UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    deleted = await delete_workspace_output(
        db,
        principal=principal,
        output_id=output_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="خروجی یافت نشد")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
