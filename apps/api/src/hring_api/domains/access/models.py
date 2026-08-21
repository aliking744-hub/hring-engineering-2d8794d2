from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from hring_api.db.base import Base


class PlatformRoleAssignment(Base):
    __tablename__ = "platform_role_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "role", name="platform_role_assignments_user_role"),
        CheckConstraint(
            "role IN ('super_admin','platform_admin','content_admin','support_admin')",
            name="platform_role_assignments_role",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class CompanyRolePermission(Base):
    __tablename__ = "company_role_permissions"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "role",
            "permission_key",
            name="company_role_permissions_company_role_permission",
        ),
        CheckConstraint(
            "role IN ('ceo','deputy','manager','employee')",
            name="company_role_permissions_role",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    permission_key: Mapped[str] = mapped_column(String(120), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
