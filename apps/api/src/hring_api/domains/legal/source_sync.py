from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeVar
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.legal.ingestion import (
    ExtractedDocument,
    LegalIngestionError,
    fetch_public_html,
    fetch_public_source,
    html_to_text,
)
from hring_api.domains.legal.schemas import Category, LegalSourceMetadata
from hring_api.domains.legal.service import LegalError, ingest_document


OFFICIAL_SOURCE_HOSTS = frozenset(
    {
        "mcls.gov.ir",
        "www.mcls.gov.ir",
        "qavanin.ir",
        "www.qavanin.ir",
        "divan-edalat.ir",
        "www.divan-edalat.ir",
    }
)
MCLS_INDEX_URL = (
    "https://www.mcls.gov.ir/fa/rahnamayemorajein/"
    "karegaran-%D9%82%D9%88%D8%A7%D9%86%DB%8C%D9%86-"
    "%D9%85%D8%B1%D8%AA%D8%A8%D8%B7-%D8%A8%D8%A7-"
    "%DA%A9%D8%A7%D8%B1%DA%AF%D8%B1%D8%A7%D9%86"
)
QAVANIN_LABOR_LAW_URL = (
    "https://qavanin.ir/Law/TreeText/?IDS=3983654531606411392"
)
ROBOTS_CRAWL_DELAY_SECONDS = 10.0
MAX_OFFICIAL_DOCUMENTS = 250
_DOWNLOADABLE_SUFFIXES = (".pdf", ".doc", ".docx", ".rtf", ".htm", ".html")
_T = TypeVar("_T")


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
        url=QAVANIN_LABOR_LAW_URL,
        critical=True,
    ),
)


class LegalSourceSyncError(RuntimeError):
    pass


async def _fetch_with_retry(
    fetcher: Callable[[str], Awaitable[_T]],
    url: str,
    *,
    sleep: Callable[[float], Awaitable[None]],
    attempts: int = 3,
) -> _T:
    last_error: LegalIngestionError | None = None
    for attempt in range(attempts):
        try:
            return await fetcher(url)
        except LegalIngestionError as exc:
            last_error = exc
            if attempt + 1 < attempts:
                await sleep(float(2 ** attempt))
    raise LegalIngestionError(
        f"Official source remained unavailable after {attempts} attempts: {url}"
    ) from last_error


def _require_trusted_source_url(url: str) -> str:
    parsed = urlsplit(url)
    hostname = parsed.hostname
    trusted_host = hostname is not None and any(
        hostname == official_host
        or hostname.endswith(f".{official_host}")
        for official_host in OFFICIAL_SOURCE_HOSTS
    )
    if parsed.scheme != "https" or not trusted_host:
        raise LegalSourceSyncError("Online legal source is outside the trusted allowlist")
    return url


def _category_for_document(title: str, url: str) -> Category:
    value = f"{title} {url}".casefold()
    if any(token in value for token in ("تامین اجتماعی", "تأمین اجتماعی", "بیمه")):
        return "social_security"
    if any(token in value for token in ("رای", "رأی", "دیوان عدالت")):
        return "court_rulings"
    return "labor_law"


def discover_official_documents(
    raw_html: str,
    *,
    base_url: str = MCLS_INDEX_URL,
    limit: int = MAX_OFFICIAL_DOCUMENTS,
) -> list[OnlineLegalSource]:
    soup = BeautifulSoup(raw_html, "html.parser")
    main = soup.find("main") or soup
    discovered: list[OnlineLegalSource] = []
    seen: set[str] = set()
    for anchor in main.find_all("a", href=True):
        href = str(anchor.get("href", "")).strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        url = urljoin(base_url, href)
        try:
            url = _require_trusted_source_url(url)
        except LegalSourceSyncError:
            continue
        if url in seen:
            continue
        title = " ".join(anchor.get_text(" ", strip=True).split()).strip()
        path = urlsplit(url).path.casefold()
        looks_legal = any(
            token in title
            for token in (
                "قانون",
                "آیین نامه",
                "آیین‌نامه",
                "دستورالعمل",
                "بخشنامه",
                "رأی",
                "رای",
            )
        )
        if not title or not (path.endswith(_DOWNLOADABLE_SUFFIXES) or looks_legal):
            continue
        seen.add(url)
        discovered.append(
            OnlineLegalSource(
                title=title,
                category=_category_for_document(title, url),
                url=url,
            )
        )
        if len(discovered) >= limit:
            break
    return discovered


def extract_legal_page(raw_html: str) -> str:
    soup = BeautifulSoup(raw_html, "html.parser")
    for element in soup.select(
        "script,style,noscript,nav,footer,header,form,aside,.breadcrumb,.menu"
    ):
        element.decompose()
    main = (
        soup.find("main")
        or soup.find("article")
        or soup.select_one("#content")
        or soup.select_one(".content")
        or soup.body
    )
    if main is None:
        raise LegalIngestionError("Legal source page has no main document content")
    text = html_to_text(str(main))
    if len(text) < 100:
        raise LegalIngestionError("Official legal document content is unexpectedly short")
    return text


async def sync_online_legal_sources(
    session: AsyncSession,
    *,
    fetch_html: Callable[[str], Awaitable[str]] = fetch_public_html,
    fetch_source: Callable[[str], Awaitable[ExtractedDocument]] = fetch_public_source,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    crawl_delay_seconds: float = ROBOTS_CRAWL_DELAY_SECONDS,
) -> LegalSourceSyncResult:
    sources = list(CORE_SOURCES)
    failures: list[str] = []
    critical_failures: list[str] = []

    try:
        index_html = await _fetch_with_retry(
            fetch_html,
            MCLS_INDEX_URL,
            sleep=sleep,
        )
        official_documents = discover_official_documents(index_html)
        if not official_documents:
            raise LegalSourceSyncError("Official MCLS index returned no usable documents")
        known_urls = {source.url for source in sources}
        sources.extend(
            source for source in official_documents if source.url not in known_urls
        )
    except (LegalIngestionError, LegalSourceSyncError) as exc:
        failure = f"mcls_official_index: {exc}"
        failures.append(failure)
        critical_failures.append(failure)

    changed = 0
    unchanged = 0
    for index, source in enumerate(sources):
        if index:
            await sleep(crawl_delay_seconds)
        try:
            _require_trusted_source_url(source.url)
            document = await _fetch_with_retry(
                fetch_source,
                source.url,
                sleep=sleep,
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
            "Official legal sources could not be synchronized: "
            + "; ".join(critical_failures)
        )
    return LegalSourceSyncResult(
        checked=len(sources),
        changed=changed,
        unchanged=unchanged,
        failed=tuple(failures),
    )

