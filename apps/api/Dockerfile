FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

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

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

RUN addgroup --system hring \
    && adduser --system --ingroup hring --home /app hring \
    && chown -R hring:hring /app

USER hring

EXPOSE 8000

CMD ["uvicorn", "hring_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
