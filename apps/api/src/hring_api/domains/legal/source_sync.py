from __future__ import annotations

import asyncio
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.legal.ingestion import (
    ExtractedDocument,
    LegalIngestionError,
    fetch_public_html,
    html_to_text,
)
from hring_api.domains.legal.schemas import Category, LegalSourceMetadata
from hring_api.domains.legal.service import LegalError, ingest_document


SOURCE_HOST = "davoudabadi.ir"
SOURCE_ORIGIN = f"https://{SOURCE_HOST}"
COURT_RULINGS_INDEX_URL = (
    f"{SOURCE_ORIGIN}/tag/1045296/"
    "%D8%A2%D8%B1%D8%A7%DB%8C-%D9%87%DB%8C%D8%A7%D8%AA-%D8%B9%D9%85%D9%88%D9%85%DB%8C-"
    "%D8%AF%DB%8C%D9%88%D8%A7%D9%86-%D8%B9%D8%AF%D8%A7%D9%84%D8%AA-%D8%A7%D8%AF%D8%A7%D8%B1%DB%8C"
)
ROBOTS_CRAWL_DELAY_SECONDS = 10.0
MAX_RECENT_RULINGS = 8
_RULING_PATH = re.compile(r"^/page/\d+/?$")


@dataclass(frozen=True)
class OnlineLegalSource:
    title: str
    category: Category
    url: str
    critical: bool = False


@dataclass(frozen=True)
class LegalSourceSyncResult:
    checked: int
    changed: int
    unchanged: int
    failed: tuple[str, ...]


CORE_SOURCES = (
    OnlineLegalSource(
        title="قانون کار با اصلاحات بعدی",
        category="labor_law",
        url=(
            f"{SOURCE_ORIGIN}/page/1874639/"
            "%D9%82%D8%A7%D9%86%D9%88%D9%86-%DA%A9%D8%A7%D8%B1"
        ),
        critical=True,
    ),
    OnlineLegalSource(
        title="قانون تامین اجتماعی با اصلاحات بعدی",
        category="social_security",
        url=(
            f"{SOURCE_ORIGIN}/page/2793614/"
            "%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%AA%D8%A7%D9%85%DB%8C%D9%86-"
            "%D8%A7%D8%AC%D8%AA%D9%85%D8%A7%D8%B9%DB%8C"
        ),
        critical=True,
    ),
)


class LegalSourceSyncError(RuntimeError):
    pass


def _require_trusted_source_url(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != SOURCE_HOST:
        raise LegalSourceSyncError("Online legal source is outside the trusted allowlist")
    return url


def discover_recent_court_rulings(
    raw_html: str,
    *,
    limit: int = MAX_RECENT_RULINGS,
) -> list[OnlineLegalSource]:
    soup = BeautifulSoup(raw_html, "html.parser")
    main = soup.find("main") or soup
    discovered: list[OnlineLegalSource] = []
    seen: set[str] = set()
    for anchor in main.find_all("a", href=True):
        path = str(anchor.get("href", "")).strip()
        if not _RULING_PATH.fullmatch(path):
            continue
        title = " ".join(anchor.get_text(" ", strip=True).split()).lstrip("❯ ")
        if "دیوان عدالت اداری" not in title or not title.startswith(("رای", "رأی")):
            continue
        url = _require_trusted_source_url(urljoin(SOURCE_ORIGIN, path))
        if url in seen:
            continue
        seen.add(url)
        discovered.append(
            OnlineLegalSource(title=title, category="court_rulings", url=url)
        )
        if len(discovered) >= limit:
            break
    return discovered


def extract_legal_page(raw_html: str) -> str:
    soup = BeautifulSoup(raw_html, "html.parser")
    main = soup.find("main")
    if main is None:
        raise LegalIngestionError("Legal source page has no main document content")
    articles = main.find_all("article")
    if len(articles) >= 5:
        title = main.find("h1")
        stable_document = BeautifulSoup("<main></main>", "html.parser")
        stable_main = stable_document.main
        if stable_main is None:
            raise LegalIngestionError("Could not construct stable legal document")
        if title is not None:
            stable_main.append(title)
        for article in articles:
            stable_main.append(article)
        return html_to_text(str(stable_main))
    return html_to_text(str(main))


async def sync_online_legal_sources(
    session: AsyncSession,
    *,
    fetch_html: Callable[[str], Awaitable[str]] = fetch_public_html,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    crawl_delay_seconds: float = ROBOTS_CRAWL_DELAY_SECONDS,
) -> LegalSourceSyncResult:
    sources = list(CORE_SOURCES)
    failures: list[str] = []

    try:
        index_html = await fetch_html(COURT_RULINGS_INDEX_URL)
        sources.extend(discover_recent_court_rulings(index_html))
    except (LegalIngestionError, LegalSourceSyncError) as exc:
        failures.append(f"court_rulings_index: {exc}")

    changed = 0
    unchanged = 0
    critical_failures: list[str] = []
    for index, source in enumerate(sources):
        if index or sources:
            await sleep(crawl_delay_seconds)
        try:
            _require_trusted_source_url(source.url)
            raw_html = await fetch_html(source.url)
            document = ExtractedDocument(
                text=extract_legal_page(raw_html),
                mime_type="text/html",
                filename=None,
                source_type="scheduled-url-html",
            )
            async with session.begin_nested():
                imported = await ingest_document(
                    session,
                    document=document,
                    metadata=LegalSourceMetadata(
                        title=source.title,
                        category=source.category,
                        source_url=source.url,
                    ),
                    actor_user_id=None,
                    ip_address=None,
                    request_id="scheduled-legal-source-sync",
                )
            if imported.duplicate:
                unchanged += 1
            else:
                changed += 1
        except (LegalError, LegalIngestionError, LegalSourceSyncError) as exc:
            failure = f"{source.category}:{source.url}: {exc}"
            failures.append(failure)
            if source.critical:
                critical_failures.append(failure)

    if critical_failures:
        raise LegalSourceSyncError(
            "Critical labor-law or social-security source could not be synchronized: "
            + "; ".join(critical_failures)
        )
    return LegalSourceSyncResult(
        checked=len(sources),
        changed=changed,
        unchanged=unchanged,
        failed=tuple(failures),
    )
