# استقرار امن PR78 در production

این دستورالعمل فقط پس از merge شدن PR78 و سبز بودن همهٔ CIها اجرا می‌شود. درگاه پرداخت در این انتشار تغییر نمی‌کند و باید تا زمان آماده‌شدن پذیرنده روی `PAYMENT_PROVIDER=disabled` باقی بماند.

## اثر انتشار

- دو migration افزایشی اجرا می‌شود: `20260904_0035` برای تاریخچهٔ خصوصی تصویر Smart Ad و `20260904_0036` برای تاریخچهٔ خصوصی Job Profile و Interview Kit.
- هر دو جدول جدید مالک‌محور هستند و حذف کاربر را با cascade رعایت می‌کنند.
- فایل‌های Smart Ad در bucket خصوصی MinIO باقی می‌مانند و فقط از API احرازشده خوانده می‌شوند.
- Legal Defense عمداً غیرفعال و بدون دریافت فایل/اعتبار می‌ماند تا اجرای async آن آماده شود.
- هیچ provider/model، نرخ اعتبار یا تنظیم پرداخت در این انتشار تغییر نمی‌کند.

## preflight و backup

```bash
cd /opt/hring
git status --short
git rev-parse HEAD | tee /opt/hring/.rollback-pr78-sha
mkdir -p /opt/hring/backups
docker compose --env-file /opt/hring/.env.standalone -f /opt/hring/compose.yaml exec -T postgres \
  pg_dump -U hring -d hring -Fc > /opt/hring/backups/hring-pre-pr78.dump
grep '^PAYMENT_PROVIDER=' /opt/hring/.env.standalone
docker compose --env-file /opt/hring/.env.standalone -f /opt/hring/compose.yaml config --quiet
```

اگر `git status --short` تغییر محلی نشان داد، deployment متوقف می‌شود تا تغییر بررسی شود. خروجی تنظیم پرداخت باید `PAYMENT_PROVIDER=disabled` باشد.

## دریافت نسخه و استقرار

```bash
cd /opt/hring
git fetch origin
git switch main
git pull --ff-only origin main
docker compose --env-file /opt/hring/.env.standalone -f /opt/hring/compose.yaml up -d --build
docker compose --env-file /opt/hring/.env.standalone -f /opt/hring/compose.yaml ps
docker compose --env-file /opt/hring/.env.standalone -f /opt/hring/compose.yaml exec -T api alembic current
curl -fsS https://hring.ir/api/v1/health
```

کانتینر API در startup، `alembic upgrade head` را قبل از اجرای Uvicorn انجام می‌دهد. خروجی مورد انتظار migration جاری `20260904_0036 (head)` و health برابر `{"status":"ok","service":"hring-api"}` است.

## UAT رایگان پس از استقرار

بدون فشردن دکمه‌های تولید AI:

1. ثبت‌نام/ورود، refresh و خروج امن بررسی شود.
2. WorkspaceHeader، لوگو، بازگشت و قیمت جم روی دکمه‌ها در موبایل و دسکتاپ بررسی شود.
3. تاریخچه‌های قبلی Learning Path/Onboarding/Dashboard باز شوند.
4. در Smart Ad، Job Profile و Interview Kit بازشدن history و مالک‌محور بودن آن بررسی شود.
5. PDF موجود در history برای Job Profile و Interview Kit دانلود و RTL، لوگو و کلیدهای ارزیابی بررسی شود.
6. Legal Defense باید فقط پیام «به‌زودی» نشان دهد و هیچ upload یا کسر اعتباری نداشته باشد.

## rollback

migrationها افزایشی‌اند؛ rollback امن برنامه، جدول‌های جدید را حذف نمی‌کند تا دادهٔ کاربر از بین نرود.

```bash
cd /opt/hring
git switch --detach "$(cat /opt/hring/.rollback-pr78-sha)"
docker compose --env-file /opt/hring/.env.standalone -f /opt/hring/compose.yaml up -d --build
curl -fsS https://hring.ir/api/v1/health
```

پس از رفع مشکل، با `git switch main` به مسیر عادی انتشار برگردید. downgrade دیتابیس فقط در صورت تصمیم آگاهانه برای حذف history انجام می‌شود؛ backup مسیر بازیابی نهایی است.
