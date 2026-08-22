import pytest

from hring_api.domains.compat.legal_import import (
    LegalImportError,
    _validate_public_url,
    extract_document_text,
    html_to_text,
    smart_chunk,
)


def test_html_to_text_removes_executable_and_navigation_content() -> None:
    html = """
    <html><head><title>ignored</title></head><body>
      <nav>menu</nav>
      <script>alert('x')</script>
      <h1>قانون کار</h1>
      <p>ماده ۱ متن قانون</p>
    </body></html>
    """

    text = html_to_text(html)

    assert "قانون کار" in text
    assert "ماده ۱ متن قانون" in text
    assert "alert" not in text
    assert "menu" not in text


def test_smart_chunk_preserves_persian_article_boundaries() -> None:
    content = "مقدمه این قانون برای آزمون نوشته شده است.\n\nماده ۱ اولین متن قانونی است و توضیح کافی دارد.\n\nماده ۲ دومین متن قانونی است و توضیح کافی دارد."

    chunks = smart_chunk(content)

    assert [item.article_number for item in chunks] == ["مقدمه", "۱", "۲"]
    assert chunks[1].content.startswith("ماده ۱")
    assert chunks[2].content.startswith("ماده ۲")


def test_plain_text_document_extraction_is_utf8_safe() -> None:
    raw = "ماده ۱ این یک متن فارسی است".encode("utf-8")

    assert extract_document_text("law.txt", raw) == "ماده ۱ این یک متن فارسی است"


def test_legacy_doc_requires_safe_conversion_to_docx() -> None:
    with pytest.raises(LegalImportError, match="docx"):
        extract_document_text("old-law.doc", b"legacy-binary")


@pytest.mark.asyncio
async def test_url_import_rejects_loopback_before_network_access() -> None:
    with pytest.raises(LegalImportError, match="Private|Local|reserved"):
        await _validate_public_url("http://127.0.0.1/internal")


@pytest.mark.asyncio
async def test_url_import_rejects_embedded_credentials() -> None:
    with pytest.raises(LegalImportError, match="credentials"):
        await _validate_public_url("https://user:password@example.com/legal")
