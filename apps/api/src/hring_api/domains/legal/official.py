from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlsplit

from hring_api.domains.ai.gateway_client import AiCitation


OFFICIAL_LEGAL_DOMAINS = (
    "mcls.gov.ir",
    "qavanin.ir",
    "sso.ir",
    "divan-edalat.ir",
)


@dataclass(frozen=True)
class OfficialCitation:
    reference_number: int
    url: str
    title: str
    published_at: str | None = None
    snippet: str | None = None


def is_official_legal_url(url: str | None, *, direct: bool = False) -> bool:
    if not url:
        return False
    parsed = urlsplit(url)
    hostname = (parsed.hostname or "").casefold()
    if parsed.scheme != "https" or not any(
        hostname == domain or hostname.endswith(f".{domain}")
        for domain in OFFICIAL_LEGAL_DOMAINS
    ):
        return False
    return not direct or parsed.path not in ("", "/") or bool(parsed.query)


def citation_title(citation: AiCitation) -> str:
    hostname = urlsplit(citation.url).hostname or "منبع رسمی"
    title = (citation.title or "").strip()
    rejected = ("error 403", "access denied", "forbidden", "خطای ۴۰۳")
    return hostname if not title or any(value in title.casefold() for value in rejected) else title[:500]


def official_citations(
    citations: tuple[AiCitation, ...],
    *,
    limit: int = 5,
) -> list[OfficialCitation]:
    rows: list[OfficialCitation] = []
    seen: set[str] = set()
    for provider_index, citation in enumerate(citations, start=1):
        if citation.url in seen or not is_official_legal_url(citation.url, direct=True):
            continue
        seen.add(citation.url)
        rows.append(
            OfficialCitation(
                reference_number=provider_index,
                url=citation.url,
                title=citation_title(citation),
                published_at=citation.published_at,
                snippet=citation.snippet,
            )
        )
        if len(rows) >= limit:
            break
    return rows
