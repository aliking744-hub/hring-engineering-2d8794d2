import pytest

from hring_api.domains.legal.source_sync import (
    CORE_SOURCES,
    LegalSourceSyncError,
    _require_trusted_source_url,
    discover_recent_court_rulings,
    extract_legal_page,
)


def test_core_sync_manifest_covers_labor_and_social_security() -> None:
    assert {source.category for source in CORE_SOURCES} == {
        "labor_law",
        "social_security",
    }
    assert all(source.critical for source in CORE_SOURCES)
    assert all(source.url.startswith("https://davoudabadi.ir/") for source in CORE_SOURCES)


def test_recent_court_ruling_discovery_is_limited_and_allowlisted() -> None:
    html = """
    <html><body><nav><a href="/page/999/">رای جعلی دیوان عدالت اداری</a></nav>
    <main>
      <a href="/page/101/"><span>رای شماره ۱ هیات عمومی دیوان عدالت اداری</span></a>
      <a href="/page/102/"><span>رأی شماره ۲ هیات عمومی دیوان عدالت اداری</span></a>
      <a href="/page/103/not-direct"><span>رای نامعتبر دیوان عدالت اداری</span></a>
      <a href="https://evil.example/page/104/">رای خارجی دیوان عدالت اداری</a>
    </main></body></html>
    """

    sources = discover_recent_court_rulings(html, limit=2)

    assert [source.url for source in sources] == [
        "https://davoudabadi.ir/page/101/",
        "https://davoudabadi.ir/page/102/",
    ]
    assert all(source.category == "court_rulings" for source in sources)


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
