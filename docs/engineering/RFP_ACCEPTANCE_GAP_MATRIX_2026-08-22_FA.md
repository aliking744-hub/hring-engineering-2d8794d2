# HRing — ماتریس شکاف RFP و وضعیت فعلی Staging

**تاریخ ممیزی:** 2026-08-22  
**منبع وضعیت اجرا:** staging روی commit `1532fc25e908067f5186b955151d68683da4ff61` (`fix/public-npm-registry`)  
**مبنای الزامات:** `HRing_Independent_Reengineering_RFP_FA_v1.0` و اسناد معماری مخزن  
**مرز ایمنی:** این سند صرفاً ممیزی است. هیچ تغییر یا استقراری روی Production مجاز نیست.

## نتیجه مدیریتی

HRing در staging یک زیربنای مستقل واقعی شامل React/Vite، FastAPI، PostgreSQL، Redis، MinIO، Alembic و AI Gateway دارد؛ اما هنوز «تحویل کامل RFP» نیست. بزرگ‌ترین فاصله‌ها عبارت‌اند از: پنل مدیریتی جامع، Provider/Secret Management، مدل AI لوکال، Prompt Registry، Worker/Scheduler، CMS کامل، مهاجرت و تطبیق داده، بکاپ/Restore، مانیتورینگ، API Key/Webhook Management و تست‌های پذیرش.

قاعده قطعی محصول:

> هر سرویس یا مدل قابل‌تغییر باید از پنل Super Admin، بدون تغییر کد، قابل تعریف، تست، فعال‌سازی، اولویت‌بندی، جایگزینی، Rotate و Revoke باشد.

## راهنمای وضعیت

- ✅ **کامل/دارای مدرک:** پیاده‌سازی و معیار پذیرش ثبت‌شده.
- 🟡 **ناقص:** بخشی از Backend/UI وجود دارد، اما معیار پذیرش کامل یا UAT ندارد.
- 🟠 **ناقص شدید:** مسیر پایه یا UI قدیمی وجود دارد، ولی قابلیت مدیریتی/عملیاتی مورد توافق فراهم نیست.
- 🔴 **غایب:** در کد و استقرار فعلی مدرک قابل اتکایی دیده نشد.
- ⚪ **قراردادی/نیازمند تصمیم:** الزام فرایندی که باید جداگانه تثبیت شود.

## ماتریس ۳۰ معیار پذیرش

| کد | حوزه | وضعیت | شواهد فعلی | شکاف تا پذیرش |
|---|---|---|---|---|
| A01 | نصب مستقل | 🟡 | `compose.yaml` و staging مستقل فعال است | نصب روی سرور تمیز فقط با مستندات، ثبت زمان و مدرک تکرارپذیری انجام نشده |
| A02 | حذف Lovable/Supabase Runtime | 🟡 | `@supabase/supabase-js` از dependency فعال حذف و facade به API مستقل متصل شده | PR #21 هنوز باز و CI قرمز است؛ اسکن نهایی سورس/build/network و پاکسازی متن‌های قدیمی README لازم است |
| A03 | دیتابیس، Migration و CI | 🟡 | PostgreSQL/pgvector و Alembic وجود دارد؛ staging بالا آمده | CI فعلی شکست‌خورده و اجرای schema/migration از صفر در CI مدرک نهایی ندارد |
| A04 | Auth و MFA | 🟡 | ثبت‌نام، ورود، refresh، reset، session revoke و logout-all در Backend دیده می‌شود | MFA اجباری مدیران و E2E کامل Auth تحویل نشده |
| A05 | Tenant Isolation | 🟡 | عضویت شرکت و کنترل‌های server-side برای چند مسیر وجود دارد | پوشش همه منابع، تست IDOR و اثبات عدم دسترسی متقاطع کامل نیست |
| A06 | RBAC | 🟡 | Platform permissions و کنترل نقش‌های شرکتی وجود دارد | ماتریس کامل endpointها، نقش‌های Finance/Content/Support و تست جامع مجوزها ناقص است |
| A07 | CMS واقعی | 🟠 | تنظیمات عمومی و تعدادی کامپوننت قدیمی CMS وجود دارد | CRUD کامل صفحات، FAQ، بلاگ، نظرات، آمار، رسانه، SEO، ترتیب و انتشار از پنل جدید متصل نیست |
| A08 | Pricing واحد | 🟡 | `BillingPlan` دیتابیس‌محور و endpoint مدیریتی وجود دارد | UI مدیریتی کامل، نسخه/تاریخ اثر و اثبات یکسانی Landing/Upgrade/Payment کامل نیست |
| A09 | Credit Ledger | 🟠 | اعتبار شرکت و داده‌های Billing پایه وجود دارد | Ledger افزایشی reserve/consume/release/refund/expire، جلوگیری از مصرف رایگان و تست اتمیک کامل اثبات نشده |
| A10 | Payment | 🟡 | Adapter زرین‌پال و init/verify در Backend وجود دارد | Provider در staging غیرفعال و Merchant ID تنظیم نشده؛ پنل تنظیم، sandbox E2E، reconciliation و گزارش مالی غایب است |
| A11 | Store | 🟡 | MinIO و مسیر entitlement/download امضاشده گزارش شده | UAT خرید تا دانلود، نسخه محصول، شمارنده واقعی و مدیریت کامل فروشگاه از پنل لازم است |
| A12 | HR AI | 🟠 | تعدادی route مستقل و compatibility bridge برای قابلیت‌ها وجود دارد | ذخیره خروجی، تاریخچه، دانلود، Job قابل پیگیری، مدل/Prompt ثبت‌شده و اعتبار صحیح برای همه ماژول‌ها کامل نیست |
| A13 | Onboarding واقعی | 🔴 | صفحه و مسیر قدیمی وجود دارد | تبدیل Demo به workflow واقعی با task/owner/status/reminder/history و UAT اثبات نشده |
| A14 | Legal RAG | 🟡 | ورود PDF/DOCX/TXT/RTF/HTML/URL، محدودیت حجم و SSRF گزارش شده | embedding داخلی، hybrid search، citation، version/reindex/delete و golden set کامل نیست |
| A15 | AI داخلی و Offline | 🔴 | AI Gateway داخلی شبکه وجود دارد | runtime مدل Ollama/vLLM و اجرای بدون اینترنت/Gemini/Gateway خارجی وجود ندارد |
| A16 | Provider Management | 🔴 | Providerها فقط با Environment تنظیم می‌شوند | تعریف Provider/API/Endpoint/Secret/Model، health، fallback، rotate/revoke و quota از پنل غایب است |
| A17 | Prompt Registry | 🔴 | مدرک Prompt Registry عملیاتی دیده نشد | Draft/Test/Publish/Rollback، schema خروجی، version compare و ثبت نسخه در خروجی باید ساخته شود |
| A18 | Storage Security | 🟡 | MinIO private، signed access و بخشی از validation وجود دارد | ClamAV/quarantine، lifecycle، orphan cleanup، retention و backup/restore فایل کامل نیست |
| A19 | Data/File Migration | 🔴 | دیتابیس مستقل staging ساخته شده | انتقال ۳۷ جدول، کاربران، فایل‌ها، تاریخچه‌ها و reconciliation/checksum/rollback انجام نشده |
| A20 | Backup/Restore | 🔴 | Volumeهای persistent وجود دارند | backup خارج از سرور، نگهداری ۳۰روزه، رمزگذاری، drill واقعی و ثبت RPO/RTO غایب است |
| A21 | Monitoring/Alerts | 🔴 | healthcheck سرویس‌ها وجود دارد | Prometheus/Grafana/Loki، alert، payment anomaly، AI/queue metrics و runbook غایب است |
| A22 | Security Acceptance | 🟡 | CORS، Trusted Hosts، headers، rate limit و production secret guards وجود دارد | گزارش OWASP/API Security، tenant/file tests، secret/dependency scan و retest بدون High/Critical کامل نیست |
| A23 | Performance | 🔴 | healthcheck و تعدادی تست مهندسی وجود دارد | load test صد کاربر/۵ AI Job، p95 و گزارش bottleneck تحویل نشده |
| A24 | UI/RTL/Responsive | 🟡 | مسیرها، RTL و صفحات اصلی وجود دارند | UAT مرورگر/موبایل، accessibility، visual regression و states همه صفحات کامل نیست |
| A25 | Docs/Training | 🟡 | معماری، handoff و READMEهای پایه وجود دارد | راهنمای کامل نصب/ادمین/محصول/API/backup/runbook و آموزش ضبط‌شده وجود ندارد |
| A26 | Ownership | 🟡 | مخزن و staging تحت کنترل کارفرماست | inventory کامل حساب‌ها/secretها، روش rotate، restore، deploy و bootstrap admin باید مستند و آزموده شود |
| A27 | No Demo Data | 🔴 | چند دامنه هنوز از UI/داده قدیمی عبور می‌کنند | audit کل محصول برای حذف یا برچسب‌گذاری آمار، نظر، خروجی و workflow ساختگی انجام نشده |
| A28 | Audit | 🟡 | Audit برای بخشی از عملیات Platform/Billing وجود دارد | پوشش تمام اعمال حساس، جست‌وجوی پیشرفته، export و retention ناقص است |
| A29 | API Keys/Webhooks | 🔴 | یک secret داخلی Gateway و URL webhook تنظیمی وجود دارد | API key مشتری با scope/quota/expiry/IP، rotate/revoke، HMAC webhook و delivery log غایب است |
| A30 | Warranty/Defect Process | ⚪ | پروژه اکنون داخلی ادامه پیدا می‌کند | معیار release acceptance، defect window و مسئول رفع نقص باید پیش از Production تثبیت شود |

## شکاف‌های تأییدشده در پنل فعلی

### Platform Admin موجود

- نمای کلی کاربران و شرکت‌ها
- مدیریت وضعیت کاربر و نقش‌های سراسری
- ساخت/ویرایش شرکت
- Audit محدود
- AI economics

### Product Admin موجود

- فقط تنظیمات عمومی `key/value` برای متن، visibility، SEO و رفتار محصول
- Backend عمداً Secret و API Key را در این پنل رد می‌کند

### بخش‌های مدیریتی جاافتاده

- CMS کامل: بلاگ، FAQ، نظرات، آمار، صفحات و رسانه
- پلن/اعتبار/تراکنش/مغایرت
- Providerها، مدل‌ها و Secretها
- Prompt Registry
- پیامک، ایمیل، پرداخت، OCR، Search و Crawler
- فایل‌ها و Quarantine
- صف‌ها، Jobها، Retry و Dead Letter
- API Key و Webhook
- Feature Flags
- سلامت سرویس‌ها، بکاپ و هشدارها

## شکاف‌های تأییدشده در استقرار فعلی

1. `compose.yaml` شامل `postgres`، `redis`، `minio`، `ai`، `api` و `web` است؛ اما `worker`، `scheduler`، runtime مدل لوکال، Prometheus، Grafana و Loki ندارد.
2. OpenAI، Gemini و Perplexity فقط از Environment به AI Gateway داده می‌شوند.
3. `SMS_PROVIDER` و `EMAIL_PROVIDER` در نمونه تنظیمات غیرفعال‌اند.
4. `RECRUITING_SOURCING_WEBHOOK_URL` خالی است.
5. Backend زرین‌پال را می‌شناسد، اما متغیرهای Payment در `.env.standalone.example` کامل ارائه نشده و staging غیرفعال است.
6. PR #21 باز است و workflow `engineering-quality-gates` روی commit staging با نتیجه failure پایان یافته.

## ترتیب اجرایی مصوب پیشنهادی

### گام ۱ — تثبیت Baseline

- رفع CI مربوط به PR #21
- سبزشدن Build/Test
- Merge به `main`
- بازگرداندن staging به commit ادغام‌شده‌ی `main`
- بدون هیچ تغییر Production

### گام ۲ — Integration Center

- Secret Store امن
- Provider Registry
- Connection Test و Health
- Primary/Fallback routing
- AI/Payment/SMS/Email/Web Search/Crawler/OCR/Webhook adapters
- Audit کامل تغییرات

### گام ۳ — Prompt Registry و AI لوکال

- Draft/Test/Publish/Rollback
- اتصال Ollama/vLLM
- انتخاب مدل برای هر قابلیت
- ثبت Provider/Model/Prompt/Usage روی هر خروجی

### گام ۴ — تکمیل پنل‌ها

- Super Admin جامع
- Product/Content Admin
- Finance Admin
- Support/Operations Admin
- Company Admin کامل

### گام‌های بعدی

- CMS و Billing/Credit
- Worker/Queue و Job history
- Backup/Restore و Monitoring
- مهاجرت/Reconciliation
- UAT ماژول‌به‌ماژول و تکمیل A01 تا A30

## تصمیم بعدی

اولین تغییر فنی پس از تأیید این ماتریس باید فقط رفع CI و نهایی‌کردن PR #21 باشد. توسعه Integration Center باید بعد از تثبیت baseline و در یک PR مستقل آغاز شود.

## شواهد بررسی‌شده

- `AGENTS.md`
- `docs/architecture/INDEPENDENT_PLATFORM.md`
- `docs/engineering/INDEPENDENCE_BACKLOG.md`
- `compose.yaml`
- `.env.standalone.example`
- `package.json`
- `src/App.tsx`
- `src/pages/Admin.tsx`
- `src/pages/PlatformAdmin.tsx`
- `src/pages/ProductAdmin.tsx`
- `src/integrations/supabase/client.ts`
- `apps/api/src/hring_api/api/v1/router.py`
- `apps/api/src/hring_api/config.py`
- دامنه‌های Admin، Identity، Companies، Billing، AI و Recruiting
- وضعیت PR #21 و workflowهای commit فعلی staging
