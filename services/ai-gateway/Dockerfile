FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

RUN addgroup --system hring \
    && adduser --system --ingroup hring --home /app hring \
    && chown -R hring:hring /app

USER hring

EXPOSE 8000

CMD ["uvicorn", "hring_ai_gateway.main:app", "--host", "0.0.0.0", "--port", "8000"]
