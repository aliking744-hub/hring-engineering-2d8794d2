# راهنمای Worker و صف‌های HRing

کارهای پس‌زمینه HRing با Celery و Redis اجرا می‌شوند. Broker و نتیجه‌ها از دیتابیس‌های جداگانه Redis استفاده می‌کنند و هیچ پورت worker روی اینترنت یا میزبان منتشر نمی‌شود.

## صف‌ها

- `hring.default`: کارهای عمومی کوتاه
- `hring.ai`: پردازش‌های هوش مصنوعی و تحلیل‌های طولانی
- `hring.notifications`: ایمیل، پیامک و اعلان
- `hring.maintenance`: health check و نگه‌داری داخلی

اضافه‌شدن یک task جدید باید همراه با queue صریح، timeout محدود، رفتار retry مشخص، تست idempotency و کنترل tenant/RBAC همان دامنه باشد. هیچ endpoint موجود در این مرحله به‌صورت خودکار async نشده است.

## استقرار روی Staging

```bash
cd /opt/hring
docker compose --env-file .env.standalone -f compose.yaml build api
docker compose --env-file .env.standalone -f compose.yaml up -d worker prometheus
docker compose --env-file .env.standalone -f compose.yaml ps worker prometheus
```

## کنترل سلامت

```bash
docker compose --env-file .env.standalone -f compose.yaml exec -T worker \
  celery --app=hring_api.worker.app:celery_app inspect ping --timeout=5

curl -fsS 'http://127.0.0.1:9090/api/v1/query?query=hring_worker_ready'
curl -fsS 'http://127.0.0.1:9090/api/v1/query?query=time()-hring_worker_last_heartbeat_timestamp_seconds'
```

خروجی ping باید `pong`، مقدار آمادگی باید `1` و فاصله heartbeat باید کمتر از ۱۲۰ ثانیه باشد.

## نکات عملیاتی

- پیام‌ها JSON-only هستند؛ serializerهای ناامن پذیرفته نمی‌شوند.
- taskها بعد از اتمام ack می‌شوند و در صورت ازبین‌رفتن worker دوباره به صف بازمی‌گردند؛ بنابراین taskهای دامنه باید idempotent باشند.
- زمان اجرای پیش‌فرض ۹ دقیقه soft و ۱۰ دقیقه hard است.
- هر child پس از تعداد یا مصرف حافظه تعیین‌شده در Compose بازیافت می‌شود.
- توقف worker روی API و وب اثر مستقیم ندارد، اما کارهای پس‌زمینه تا راه‌اندازی مجدد در Redis باقی می‌مانند.

## Rollback

```bash
docker compose --env-file .env.standalone -f compose.yaml stop worker
```

این کار داده‌های PostgreSQL، MinIO و Redis را حذف نمی‌کند. تا پیش از متصل‌شدن taskهای کسب‌وکاری، rollback فقط توقف سرویس و بازگرداندن commit است.

