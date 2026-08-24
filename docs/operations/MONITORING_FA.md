# راهنمای مانیتورینگ HRing

این بسته وضعیت API، درگاه هوش مصنوعی، وب، PostgreSQL، Redis و MinIO را فقط در شبکه داخلی Docker پایش می‌کند. رابط‌های Prometheus و Alertmanager تنها روی `127.0.0.1` سرور منتشر می‌شوند و از اینترنت قابل دسترسی نیستند.

## اجزا

- Prometheus با نگه‌داری ۱۵روزه متریک‌ها
- متریک تعداد درخواست، کد پاسخ، درخواست‌های جاری و زمان پاسخ API و AI Gateway
- Blackbox Exporter برای کنترل HTTP وب، API، AI و MinIO و اتصال TCP به PostgreSQL و Redis
- Alertmanager با گیرنده محلی؛ اتصال گیرنده بیرونی در مرحله نهایی تنظیم کلید سرویس‌ها انجام می‌شود
- هشدارهای قطعی سرویس، خطای 5xx، کندی p95، مصرف بالای حافظه و خطای تنظیمات Prometheus

هیچ URL، query string، شناسه کاربر، payload یا Secret وارد labelهای متریک نمی‌شود؛ routeها فقط با template ثبت‌شده برنامه ذخیره می‌شوند.

## استقرار روی Staging

```bash
cd /opt/hring
docker compose --env-file .env.standalone -f compose.yaml build api ai
docker compose --env-file .env.standalone -f compose.yaml up -d api ai web blackbox-exporter alertmanager prometheus
docker compose --env-file .env.standalone -f compose.yaml ps
```

## کنترل سلامت

```bash
curl -fsS http://127.0.0.1:9090/-/ready
curl -fsS http://127.0.0.1:9093/-/ready
curl -fsS 'http://127.0.0.1:9090/api/v1/query?query=up'
curl -fsS 'http://127.0.0.1:9090/api/v1/query?query=probe_success'
```

برای مشاهده رابط‌ها از رایانه شخصی یک تونل SSH بسازید:

```bash
ssh -L 9090:127.0.0.1:9090 -L 9093:127.0.0.1:9093 user@staging-host
```

- Prometheus: `http://127.0.0.1:9090/targets`
- هشدارهای Prometheus: `http://127.0.0.1:9090/alerts`
- Alertmanager: `http://127.0.0.1:9093`

## اتصال اعلان بیرونی

Alertmanager در این مرحله هشدارها را ثبت و در رابط محلی نمایش می‌دهد اما پیام خارجی ارسال نمی‌کند. وب‌هوک یا سرویس پیام‌رسان تنها پس از انتخاب مقصد و ثبت Secret در فایل محیطی سرور فعال می‌شود؛ Credential نباید داخل Git یا فایل YAML قرار گیرد.

## Rollback

```bash
docker compose --env-file .env.standalone -f compose.yaml stop prometheus alertmanager blackbox-exporter
```

توقف این سه سرویس روی API، AI، وب یا داده‌های اصلی اثری ندارد. volumeهای مانیتورینگ برای امکان بررسی و بازگشت نگه داشته می‌شوند.
