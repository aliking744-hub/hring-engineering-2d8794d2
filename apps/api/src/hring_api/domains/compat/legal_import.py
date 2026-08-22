from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
from collections.abc import Callable
from dataclasses import dataclass
from io import BytesIO
from typing import cast
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
from bs4 import BeautifulSoup
from docx import Document
from pypdf import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession
from striprtf.striprtf import rtf_to_text

from hring_api.domains.access.repository import list_platform_roles
from hring_api.domains.compat.models import CompatRecord
from hring_api.domains.identity.dependencies import Principal


MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_ADMIN_ROLES = frozenset({"super_admin", "platform_admin", "content_admin"})
ARTICLE_PATTERN = re.compile(r"(?=ماده\s+[\u06F0-\u06F9۰-۹0-9]+)")
ARTICLE_NUMBER_PATTERN = re.compile(r"^ماده\s+([\u06F0-\u06F9۰-۹0-9]+)")
_typed_rtf_to_text = cast(Callable[[str], str], rtf_to_text)


class LegalImportError(RuntimeError):
    pass


class LegalImportForbiddenError(LegalImportError):
    pass


@dataclass(frozen=True)
class LegalChunk:
    content: str
    article_number: str


@dataclass(frozen=True)
class LegalImportResult:
    total_chunks: int
    saved_count: int
    content_length: int
    logs: list[str]

    def as_payload(self) -> dict[str, object]:
        return {
            "success": True,
            "logs": self.logs,
            "stats": {
                "totalChunks": self.total_chunks,
                "savedCount": self.saved_count,
                "contentLength": self.content_length,
            },
        }


async def ensure_legal_import_admin(db: AsyncSession, principal: Principal) -> None:
    roles = set(await list_platform_roles(db, principal.user_id))
    if not roles.intersection(ALLOWED_ADMIN_ROLES):
        raise LegalImportForbiddenError("Legal knowledge import requires content-admin access")


def html_to_text(html: str) -> str:
    if len(html.encode("utf-8")) > MAX_DOCUMENT_BYTES:
        raise LegalImportError("HTML content exceeds the 10 MB limit")
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "head", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    text = soup.get_text("\n")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def extract_document_text(filename: str, raw: bytes) -> str:
    if not raw:
        raise LegalImportError("Uploaded document is empty")
    if len(raw) > MAX_DOCUMENT_BYTES:
        raise LegalImportError("Document exceeds the 10 MB limit")

    suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        if suffix == ".pdf":
            reader = PdfReader(BytesIO(raw))
            return "\n\n".join((page.extract_text() or "").strip() for page in reader.pages).strip()
        if suffix == ".docx":
            document = Document(BytesIO(raw))
            return "\n".join(
                paragraph.text.strip()
                for paragraph in document.paragraphs
                if paragraph.text.strip()
            )
        if suffix == ".txt":
            return raw.decode("utf-8-sig", errors="replace").strip()
        if suffix == ".rtf":
            return _typed_rtf_to_text(raw.decode("utf-8", errors="replace")).strip()
        if suffix == ".doc":
            raise LegalImportError(
                "Legacy .doc is not safely parseable; save it as .docx and upload again"
            )
    except LegalImportError:
        raise
    except Exception as exc:
        raise LegalImportError("Could not extract text from the uploaded document") from exc
    raise LegalImportError("Unsupported document type")


def smart_chunk(content: str) -> list[LegalChunk]:
    normalized = content.replace("\r\n", "\n").replace("\r", "\n").strip()
    if len(normalized) < 50:
        raise LegalImportError("Not enough textual content was found")

    chunks: list[LegalChunk] = []
    for part in ARTICLE_PATTERN.split(normalized):
        text = part.strip()
        if len(text) < 20:
            continue
        match = ARTICLE_NUMBER_PATTERN.match(text)
        if match:
            chunks.append(LegalChunk(content=text, article_number=match.group(1)))
        elif not chunks and len(text) > 50:
            chunks.append(LegalChunk(content=text, article_number="مقدمه"))

    if chunks:
        return chunks

    paragraphs = [item.strip() for item in re.split(r"\n{2,}", normalized) if item.strip()]
    if len(paragraphs) == 1:
        paragraphs = [item.strip() for item in normalized.split("\n") if item.strip()]

    current: list[str] = []
    current_length = 0
    section = 1
    for paragraph in paragraphs:
        projected = current_length + len(paragraph) + (2 if current else 0)
        if current and projected > 2000:
            chunks.append(
                LegalChunk(content="\n\n".join(current), article_number=f"بخش {section}")
            )
            section += 1
            current = [paragraph]
            current_length = len(paragraph)
        else:
            current.append(paragraph)
            current_length = projected
    if current:
        chunks.append(
            LegalChunk(content="\n\n".join(current), article_number=f"بخش {section}")
        )
    return chunks


async def save_legal_text(
    db: AsyncSession,
    *,
    principal: Principal,
    text: str,
    category: str,
    source_url: str,
    source_type: str,
) -> LegalImportResult:
    await ensure_legal_import_admin(db, principal)
    category = category.strip()
    if not category:
        raise LegalImportError("Category is required")
    chunks = smart_chunk(text)
    logs = [
        f"متن استخراج شده: {len(text):,} کاراکتر",
        f"تعداد {len(chunks)} بخش/ماده یافت شد",
    ]
    for chunk in chunks:
        record_id = str(uuid4())
        db.add(
            CompatRecord(
                table_name="legal_docs",
                record_id=record_id,
                owner_user_id=None,
                company_id=None,
                data={
                    "id": record_id,
                    "content": chunk.content,
                    "category": category,
                    "source_url": source_url,
                    "article_number": chunk.article_number,
                    "embedding": None,
                    "source_type": source_type,
                    "created_by": str(principal.user_id),
                },
            )
        )
        logs.append(f"{chunk.article_number} ذخیره شد ✓")
    await db.commit()
    logs.append(f"پردازش کامل شد: {len(chunks)} از {len(chunks)} بخش ذخیره شد")
    return LegalImportResult(
        total_chunks=len(chunks),
        saved_count=len(chunks),
        content_length=len(text),
        logs=logs,
    )


def _forbidden_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


async def _validate_public_url(url: str) -> str:
    parsed = urlsplit(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise LegalImportError("Only public http/https source URLs are allowed")
    if parsed.username or parsed.password:
        raise LegalImportError("Source URL credentials are not allowed")
    hostname = parsed.hostname.lower().rstrip(".")
    if hostname in {"localhost", "localhost.localdomain"}:
        raise LegalImportError("Local source URLs are not allowed")
    try:
        infos = await asyncio.to_thread(
            socket.getaddrinfo,
            hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
        )
    except socket.gaierror as exc:
        raise LegalImportError("Source host could not be resolved") from exc
    addresses = {str(item[4][0]) for item in infos}
    if not addresses or any(_forbidden_address(address) for address in addresses):
        raise LegalImportError("Private or reserved source addresses are not allowed")
    return parsed.geturl()


async def fetch_public_legal_source(url: str) -> tuple[str, str]:
    safe_url = await _validate_public_url(url)
    timeout = httpx.Timeout(15.0, connect=5.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            async with client.stream(
                "GET",
                safe_url,
                headers={"User-Agent": "HRing-Legal-Importer/1.0"},
            ) as response:
                if 300 <= response.status_code < 400:
                    raise LegalImportError("Redirects are disabled; provide the final source URL")
                response.raise_for_status()
                declared = response.headers.get("content-length")
                if declared and int(declared) > MAX_DOCUMENT_BYTES:
                    raise LegalImportError("Remote document exceeds the 10 MB limit")
                body = bytearray()
                async for piece in response.aiter_bytes():
                    body.extend(piece)
                    if len(body) > MAX_DOCUMENT_BYTES:
                        raise LegalImportError("Remote document exceeds the 10 MB limit")
                content_type = response.headers.get("content-type", "").lower()
    except LegalImportError:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        raise LegalImportError("Could not retrieve the legal source URL") from exc

    raw = bytes(body)
    if "html" in content_type:
        return html_to_text(raw.decode("utf-8", errors="replace")), "url-html"
    path_name = urlsplit(safe_url).path.rsplit("/", 1)[-1] or "source.txt"
    return extract_document_text(path_name, raw), "url-document"
