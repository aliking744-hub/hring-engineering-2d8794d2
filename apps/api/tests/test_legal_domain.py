import asyncio
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from hring_api.db.session import SessionFactory
from hring_api.domains.access.models import PlatformRoleAssignment
from hring_api.domains.admin.models import AuditLog
from hring_api.domains.identity.mfa_security import generate_totp_code
from hring_api.domains.legal.embedding import cosine_similarity, embed_text
from hring_api.domains.legal.ingestion import (
    LegalIngestionError,
    chunk_legal_text,
    extract_upload,
    html_to_text,
    validate_public_url,
)


PASSWORD = "correct horse battery staple"


def _register(client: TestClient, prefix: str) -> dict[str, Any]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{prefix}-{uuid4()}@example.com",
            "password": PASSWORD,
            "full_name": prefix,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _auth(account: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {account['tokens']['access_token']}"}


async def _grant_platform_role(user_id: UUID, role: str) -> None:
    async with SessionFactory() as session:
        async with session.begin():
            session.add(
                PlatformRoleAssignment(
                    user_id=user_id,
                    role=role,
                    created_by=user_id,
                )
            )


def _content_admin(client: TestClient) -> dict[str, Any]:
    account = _register(client, "legal-content-admin")
    asyncio.run(_grant_platform_role(UUID(account["user"]["id"]), "content_admin"))
    enrollment = client.post("/api/v1/auth/mfa/enroll", headers=_auth(account))
    assert enrollment.status_code == 200, enrollment.text
    confirmation = client.post(
        "/api/v1/auth/mfa/confirm",
        headers=_auth(account),
        json={"code": generate_totp_code(enrollment.json()["secret"])},
    )
    assert confirmation.status_code == 200, confirmation.text
    return account


async def _audit_actions(resource_id: str) -> set[str]:
    async with SessionFactory() as session:
        result = await session.scalars(
            select(AuditLog.action).where(
                AuditLog.resource_type == "legal_source",
                AuditLog.resource_id == resource_id,
            )
        )
        return set(result.all())


def test_local_embedding_is_deterministic_and_normalizes_persian_variants() -> None:
    first = embed_text("كارگر مشمول قانون كار است")
    second = embed_text("کارگر مشمول قانون کار است")
    unrelated = embed_text("بیمه بازنشستگی و سابقه پرداخت")

    assert first == second
    assert len(first) == 384
    assert cosine_similarity(first, second) == pytest.approx(1.0)
    assert cosine_similarity(first, unrelated) < 0.8


def test_ingestion_sanitizes_html_and_preserves_article_boundaries() -> None:
    raw_html = """
    <html><head><title>ignored</title></head><body>
      <nav>فهرست ناوبری</nav><script>ignore_instructions()</script>
      <h1>قانون کار</h1>
      <p>ماده ۱ این متن قانونی برای آزمون ایندکس نوشته شده است.</p>
      <p>ماده ۲ این ماده دوم و دارای محتوای معتبر و قابل استناد است.</p>
    </body></html>
    """

    text = html_to_text(raw_html)
    chunks = chunk_legal_text(text, chunk_size=400, overlap=40)

    assert "ignore_instructions" not in text
    assert "فهرست ناوبری" not in text
    assert [chunk.article_number for chunk in chunks] == ["۱", "۲"]


def test_plain_text_upload_is_utf8_safe() -> None:
    text = "ماده ۱ این متن فارسی برای آزمون استخراج سند نوشته شده است."
    document = asyncio.run(extract_upload("law.txt", text.encode(), "text/plain"))

    assert document.text == text
    assert document.source_type == "upload-text"
    assert document.ocr_used is False


@pytest.mark.asyncio
async def test_remote_import_rejects_ssrf_and_embedded_credentials() -> None:
    with pytest.raises(LegalIngestionError, match="Private|Local|reserved"):
        await validate_public_url("http://127.0.0.1/internal")
    with pytest.raises(LegalIngestionError, match="credentials"):
        await validate_public_url("https://user:password@example.com/legal")


def test_native_legal_sources_are_authenticated_versioned_and_audited() -> None:
    from hring_api.main import app

    marker = uuid4().hex
    source_url = f"https://example.com/law/{marker}"
    first_html = f"""
      <main><h1>قانون آزمایشی {marker}</h1>
      <p>ماده ۱ کارفرما باید شناسه {marker} را در قرارداد ثبت کند.</p>
      <p>ماده ۲ سند این آزمون باید قابل استناد و نسخه‌بندی باشد.</p></main>
    """
    second_html = first_html.replace(
        "نسخه‌بندی باشد.",
        "نسخه‌بندی باشد و ویرایش دوم آن معتبر است.",
    )

    with TestClient(app) as client:
        ordinary = _register(client, "legal-reader")
        admin = _content_admin(client)
        ordinary_headers = _auth(ordinary)
        admin_headers = _auth(admin)

        assert client.post(
            "/api/v1/legal/search",
            json={"query": marker},
        ).status_code == 401
        assert client.get("/api/v1/legal/admin/stats").status_code == 401
        assert client.get(
            "/api/v1/legal/admin/stats",
            headers=ordinary_headers,
        ).status_code == 403
        assert client.post(
            "/api/v1/legal/search",
            headers=ordinary_headers,
            json={"query": marker, "match_threshold": 0},
        ).status_code == 200

        payload = {
            "title": f"قانون آزمایشی {marker}",
            "category": "labor_law",
            "source_url": source_url,
            "html_content": first_html,
        }
        created = client.post(
            "/api/v1/legal/admin/sources/html",
            headers=admin_headers,
            json=payload,
        )
        assert created.status_code == 201, created.text
        first_source = created.json()["source"]
        assert created.json()["duplicate"] is False
        assert first_source["version"] == 1
        assert first_source["chunk_count"] >= 2

        duplicate = client.post(
            "/api/v1/legal/admin/sources/html",
            headers=admin_headers,
            json=payload,
        )
        assert duplicate.status_code == 201, duplicate.text
        assert duplicate.json()["duplicate"] is True
        assert duplicate.json()["source"]["id"] == first_source["id"]

        next_version = client.post(
            "/api/v1/legal/admin/sources/html",
            headers=admin_headers,
            json={**payload, "html_content": second_html},
        )
        assert next_version.status_code == 201, next_version.text
        second_source = next_version.json()["source"]
        assert second_source["id"] != first_source["id"]
        assert second_source["version"] == 2

        sources = client.get(
            "/api/v1/legal/admin/sources?include_deleted=true",
            headers=admin_headers,
        )
        assert sources.status_code == 200, sources.text
        relevant = {row["id"]: row for row in sources.json() if marker in row["title"]}
        assert relevant[first_source["id"]]["status"] == "superseded"
        assert relevant[second_source["id"]]["status"] == "active"

        found = client.post(
            "/api/v1/legal/search",
            headers=ordinary_headers,
            json={"query": marker, "match_threshold": 0},
        )
        assert found.status_code == 200, found.text
        matching = [row for row in found.json() if row["source_id"] == second_source["id"]]
        assert matching
        assert all(row["source_version"] == 2 for row in matching)
        assert all(row["title"] == payload["title"] for row in matching)

        forbidden_delete = client.delete(
            f"/api/v1/legal/admin/sources/{second_source['id']}",
            headers=ordinary_headers,
        )
        assert forbidden_delete.status_code == 403

        reindexed = client.post(
            f"/api/v1/legal/admin/sources/{second_source['id']}/reindex",
            headers=admin_headers,
            json={},
        )
        assert reindexed.status_code == 200, reindexed.text
        assert reindexed.json()["chunk_count"] == second_source["chunk_count"]

        removed = client.delete(
            f"/api/v1/legal/admin/sources/{second_source['id']}",
            headers=admin_headers,
        )
        assert removed.status_code == 204, removed.text

        after_delete = client.post(
            "/api/v1/legal/search",
            headers=ordinary_headers,
            json={"query": marker, "match_threshold": 0},
        )
        assert after_delete.status_code == 200, after_delete.text
        assert all(row["source_id"] != second_source["id"] for row in after_delete.json())

        restored = client.post(
            "/api/v1/legal/admin/sources/html",
            headers=admin_headers,
            json={**payload, "html_content": second_html},
        )
        assert restored.status_code == 201, restored.text
        assert restored.json()["duplicate"] is True
        assert restored.json()["source"]["id"] == second_source["id"]
        assert restored.json()["source"]["status"] == "active"

        actions = asyncio.run(_audit_actions(second_source["id"]))
        assert {
            "legal.source.ingest",
            "legal.source.reindex",
            "legal.source.delete",
            "legal.source.restore",
        } <= actions
