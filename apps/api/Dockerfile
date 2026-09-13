FROM python:3.12-slim

ARG PIP_DEFAULT_TIMEOUT=120
ARG PIP_RETRIES=8

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=https://mirror-pypi.runflare.com/simple/

WORKDIR /app

# Legal ingestion is deliberately local: Poppler renders scanned PDFs and
# Tesseract performs Persian/English OCR without sending documents off-host.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-eng \
        tesseract-ocr-fas \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY alembic.ini ./
COPY alembic ./alembic
COPY src ./src

RUN export PIP_DEFAULT_TIMEOUT="${PIP_DEFAULT_TIMEOUT}" \
        PIP_RETRIES="${PIP_RETRIES}" \
    && pip install --no-cache-dir "setuptools>=70" wheel \
    && pip install --no-cache-dir --no-build-isolation .

RUN addgroup --system hring \
    && adduser --system --ingroup hring --home /app hring \
    && chown -R hring:hring /app

USER hring

EXPOSE 8000

CMD ["uvicorn", "hring_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
