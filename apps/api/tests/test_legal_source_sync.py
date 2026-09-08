import pytest

from hring_api.domains.legal.source_sync import (
    CORE_SOURCES,
    LegalSourceSyncError,
    _require_trusted_source_url,
    discover_official_documents,
    extract_legal_page,
)


def test_core_sync_manifest_uses_only_official_sources() -> None:
    assert {source.category for source in CORE_SOURCES} == {"labor_law"}
    assert all(source.critical for source in CORE_SOURCES)
    assert all("qavanin.ir/" in source.url for source in CORE_SOURCES)


def test_official_document_discovery_is_limited_and_allowlisted() -> None:
    html = """
    <html><body><nav><a href="https://evil.example/menu.pdf">جعلی</a></nav>
    <main>
      <a href="/files/labor.pdf"><span>قانون کار</span></a>
      <a href="/files/social.docx"><span>قانون تامین اجتماعی</span></a>
      <a href="https://evil.example/ruling.pdf">رای خارجی دیوان عدالت اداری</a>
    </main></body></html>
    """

    sources = discover_official_documents(
        html,
        base_url="https://www.mcls.gov.ir/fa/laws",
        limit=2,
    )

    assert [source.url for source in sources] == [
        "https://www.mcls.gov.ir/files/labor.pdf",
        "https://www.mcls.gov.ir/files/social.docx",
    ]
    assert [source.category for source in sources] == [
        "labor_law",
        "social_security",
    ]


def test_legal_page_extraction_keeps_document_and_removes_navigation() -> None:
    html = """
    <html><body><nav>فهرست غیرمرتبط</nav><main>
      <h1>قانون کار</h1><article><h2>ماده ۱</h2><p>متن معتبر قانون کار است.</p></article>
      <script>danger()</script>
    </main><footer>تبلیغات</footer></body></html>
    """

    text = extract_legal_page(html)

    assert "قانون کار" in text
    assert "ماده ۱" in text
    assert "متن معتبر قانون کار است" in text
    assert "danger" not in text
    assert "فهرست غیرمرتبط" not in text
    assert "تبلیغات" not in text


def test_sync_source_allowlist_rejects_other_hosts() -> None:
    with pytest.raises(LegalSourceSyncError, match="allowlist"):
        _require_trusted_source_url("https://example.com/law")


def test_sync_source_allowlist_accepts_official_hosts() -> None:
    assert _require_trusted_source_url(
        "https://qavanin.ir/Law/TreeText/?IDS=3983654531606411392"
    )
    assert _require_trusted_source_url("https://www.mcls.gov.ir/files/labor.pdf")


def test_sync_source_allowlist_accepts_official_ministry_subdomains() -> None:
    url = (
        "https://rkj.mcls.gov.ir/fa/moghararaat/ghavanin/"
        "ghanoonkar"
    )

    assert _require_trusted_source_url(url) == url
