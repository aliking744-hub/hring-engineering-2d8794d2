# بستهٔ آمادهٔ انتقال PR66 و PR744

این سند وضعیت قابل اتکای شاخهٔ `codex/pr66-preparation` را مشخص می‌کند. «آمادهٔ انتقال» به معنای آماده بودن کد، migration، اسکریپت و چک‌لیست برای staging است؛ به معنای تأیید اجرای واقعی یا مجوز production نیست.

## آنچه در بسته وجود دارد

- AI شرکت: انتخاب روشن BYOK یا سرویس مدیریت‌شده، رمزگذاری secret، جداسازی tenant، جلوگیری از fallback پنهان و ثبت audit.
- قابلیت‌های AI غیر-هد‌هانتینگ: آگهی هوشمند، پروفایل شغلی، کیت مصاحبه، آنبوردینگ، یادگیری، حقوقی و پشتیبانی؛ خروجی باید در UI همان قابلیت ظاهر شود.
- آنبوردینگ ۹۰ روزه: برنامه و تسک‌های پایدار، تاریخچهٔ تغییر وضعیت و پیشرفت واقعی به‌جای دادهٔ ثابت.
- داشبورد HR: تفکیک روشن دادهٔ دمو از دادهٔ آپلودشدهٔ خصوصی.
- Runtime مستقل: Compose، API، Worker، Gateway AI، storage خصوصی، monitoring و migrationهای Alembic.
- گیت‌ها: `pr66-offline-preflight.sh`، `pr66-staging-preflight.sh`، `pr66-migration-roundtrip.sh` و `pr66-staging-smoke.sh`.

## مواردی که عمداً خارج از این انتقال‌اند

- Smart Headhunting و webhook تأمین نیرو؛ طبق تصمیم محصول، آخرین بخش PR744 است.
- Strategy/Business/Unicorn؛ این‌ها حذف محصول هستند، نه قابلیت ناقص.
- اتصال واقعی SMS، ایمیل و زرین‌پال تا وقتی credential و تصمیم فعال‌سازی آن‌ها در محیط محافظت‌شده وارد نشده باشد.
- production rollout؛ ابتدا فقط staging و UAT.

## وضعیت گیت‌های خودکار

در لحظهٔ نگارش این handoff، این شاخه برای commitهای مستقیمش اجرای CI ثبت‌شده ندارد؛ بنابراین هیچ نتیجهٔ CI به‌عنوان «گذشته» اعلام نمی‌شود. با بازشدن PR به main باید workflowهای quality، backend-quality و standalone-runtime-gates اجرا و سبز شوند. خطای هرکدام blocker انتقال staging است.

## مراحل اجرای انتقال

1. شاخه را با main در یک PR مرور و merge کنید.
2. روی staging، فایل محیط محافظت‌شده را با مقادیر واقعی بسازید؛ هیچ `CHANGE_ME` نباید باقی بماند.
3. پیش از build اجرا کنید:

   ```bash
   cd /opt/hring
   PR66_ENV_FILE=/opt/hring/.env.standalone bash scripts/pr66-staging-preflight.sh
   ```

4. فقط پس از عبور گیت، build/up کنترل‌شده و سپس `scripts/pr66-staging-smoke.sh` را اجرا کنید.
5. تمام سناریوهای `docs/operations/PR744_PR66_STAGING_UAT_FA.md` را با دو حساب و یک Provider واقعی انجام دهید.
6. نتیجهٔ UAT، نسخهٔ image، خروجی migration و بکاپ پیش از استقرار را ثبت کنید.

## معیار تحویل staging

بسته فقط وقتی «تحویل‌شده به staging» است که migration تا head باشد، health/smoke سبز باشد، UAT خروجی واقعی AI و BYOK/managed را تأیید کند و هیچ secret یا fallback ناخواسته‌ای دیده نشود.
