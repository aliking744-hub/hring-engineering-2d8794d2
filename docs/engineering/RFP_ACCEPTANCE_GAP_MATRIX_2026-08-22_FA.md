# HRing — ماتریس شکاف RFP و وضعیت واقعی Staging

**تاریخ ممیزی:** 2026-08-23  
**منبع حقیقت کد:** `main@fb994cd32af7f581228601d0c0c66237182cf83b`  
**وضعیت Staging:** هم‌تراز با `main`، تمام سرویس‌های اصلی Healthy، API Health موفق، Alembic روی `20260823_0011 (head)`  
**مبنای الزامات:** `HRing_Independent_Reengineering_RFP_FA_v1.0` و اسناد معماری مخزن  
**مرز ایمنی:** Production خارج از محدوده است و هیچ مسیر استقرار خودکار Production در این مخزن فعال نیست.

## نتیجه مدیریتی

HRing اکنون یک پلتفرم مستقل واقعی روی Staging دارد: React/Vite، FastAPI، PostgreSQL/pgvector، Redis، MinIO، Alembic، AI Gateway، احراز هویت مستقل و کنترل دسترسی سمت سرور. Integration Center، Prompt Registry، نقشهٔ مسیریابی ۲۵ قابلیت AI، اتصال‌های OpenAI/Anthropic و CMS پایه نیز به `main` رسیده‌اند.

با این حال، «فاز هسته» هنوز بسته نیست. چهار مانع اصلی آن عبارت‌اند از:

1. MFA برای حساب‌های دارای دسترسی مدیریتی پیاده‌سازی نشده است.
2. قفل حساب و بازکردن قفل مدیریتی پس از تلاش‌های ناموفق ورود کامل نیست؛ Rate Limit مبتنی بر Redis وجود دارد اما جای Lockout حساب را نمی‌گیرد.
3. اعتبار هنوز عمدتاً با شمارنده‌های `monthly_credits/used_credits/credit_pool` مدیریت می‌شود و Ledger افزایشی `reserve/consume/release/refund/expire` وجود ندارد.
4. تست‌های Tenant/RBAC خوب شروع شده‌اند، اما هنوز ماتریس جامع endpoint × role × tenant و UAT واقعی پنل ثبت نشده است.

## راهنمای وضعیت

- ✅ **کامل برای دروازه فعلی:** پیاده‌سازی و مدرک تست/استقرار موجود است.
- 🟡 **ناقص:** مسیر اصلی وجود دارد، اما بخشی از معیار پذیرش یا UAT باقی است.
- 🟠 **ناقص شدید:** پایه وجود دارد، اما کنترل بنیادی RFP غایب است.
- 🔴 **غایب:** مدرک قابل اتکایی در کد/استقرار فعلی دیده نشد.
- ⚪ **فرایندی/قراردادی:** باید پیش از Production تثبیت شود.

## ماتریس ۳۰ معیار پذیرش

| کد | حوزه | وضعیت | شواهد فعلی | شکاف تا پذیرش |
|---|---|---:|---|---|
| A01 | نصب مستقل | 🟡 | Compose مستقل و Staging عملیاتی است | نصب مجدد روی سرور تمیز فقط با Runbook و ثبت زمان هنوز انجام نشده |
| A02 | حذف Lovable/Supabase Runtime | 🟡 | Safety tests و build مستقل پاس شده و cache خصوصی Lovable حذف شده است | compatibility code و آثار تاریخی باید پس از Reconciliation نهایی جمع شوند؛ اسکن نهایی network/image باقی است |
| A03 | دیتابیس، Migration و CI | ✅ | سه Quality Gate سبز، migration round-trip در CI و Staging روی Alembic head است | بازبینی مجدد فقط هنگام migration بعدی |
| A04 | Auth و MFA | 🟡 | Register/Login/Refresh/Logout، چرخش refresh، reset/change password، email verification، session list/revoke/logout-all تست شده‌اند | MFA/TOTP مدیران و Account Lockout/Unlock غایب است |
| A05 | Tenant Isolation | 🟡 | ایجاد شرکت و CEO مستقل، منع دسترسی متقاطع و invite/capacity tests وجود دارد | پوشش تمام منابع tenant-owned و ماتریس IDOR سراسری ناقص است |
| A06 | RBAC | 🟡 | Platform/Product/Company boundaries و permission override سمت سرور تست شده‌اند | پوشش جامع همه endpointها و نقش‌های Finance/Support/Operations ناقص است |
| A07 | CMS واقعی | 🟡 | CMS پایه برای برند، لوگو/favicon، رنگ، فونت، متن، visibility و SEO روی PostgreSQL/MinIO فعال است | Pages/FAQ/Blog/Testimonials/Stats/Media، Draft/Preview/Publish و UAT کامل باقی است |
| A08 | Pricing واحد | 🟡 | `BillingPlan` دیتابیس‌محور و endpoint عمومی وجود دارد | Plan Version، تاریخ اثر و اثبات همسانی Landing/Upgrade/Payment کامل نیست |
| A09 | Credit Ledger | 🟠 | قفل ردیف هنگام کسر اعتبار وجود دارد | Ledger افزایشی، reservation lifecycle، idempotency، refund/expire و double-spend tests غایب است |
| A10 | Payment | 🟡 | Adapter زرین‌پال و verify اتمیک پایه وجود دارد | Provider روی Staging غیرفعال، sandbox E2E، reconciliation و گزارش مالی ناقص است |
| A11 | Store | 🟡 | MinIO و entitlement/signed download پایه وجود دارد | UAT خرید تا دانلود، نسخه محصول و شمارنده واقعی کامل نیست |
| A12 | HR AI | 🟠 | routeهای مستقل، Recruiting persistence و AI routing مرکزی وجود دارد | Job/history/download/credit lifecycle برای همه ماژول‌ها کامل نیست |
| A13 | Onboarding واقعی | 🔴 | UI قدیمی وجود دارد | workflow واقعی task/owner/status/reminder/history تحویل نشده |
| A14 | Legal RAG | 🟡 | ورود چندفرمتی و SSRF/size protection وجود دارد | embedding داخلی، citation، reindex/version و golden set ناقص است |
| A15 | AI داخلی و Offline | 🟡 | runtimeهای opt-in Ollama/vLLM و provider داخلی تعریف شده‌اند | مدل فعال، benchmark فارسی، ظرفیت و آزمون قطع اینترنت انجام نشده |
| A16 | Provider Management | 🟡 | Integration Center مستقل، secret encryption، health/test و OpenAI/Anthropic پشتیبانی می‌شوند | rotate/revoke کامل، quota و UAT Providerهای واقعی باقی است |
| A17 | Prompt Registry | 🟡 | Draft/Test/Publish/Rollback، versioning و UI مستقل وجود دارد | adoption تمام قابلیت‌ها، golden regression batch و UAT عملیاتی ناقص است |
| A18 | Storage Security | 🟡 | MinIO خصوصی، signed access و validation پایه وجود دارد | ClamAV/quarantine، lifecycle، orphan cleanup و restore فایل ناقص است |
| A19 | Data/File Migration | 🔴 | دیتابیس مستقل Staging ساخته شده است | انتقال واقعی داده/فایل Production، checksum، reconciliation و rollback انجام نشده |
| A20 | Backup/Restore | 🟠 | قبل از استقرار اخیر pg_dump و rollback tag ساخته شد | backup خودکار/offsite/رمزگذاری‌شده، retention و restore drill غایب است |
| A21 | Monitoring/Alerts | 🔴 | healthcheck سرویس‌ها وجود دارد | Prometheus/Grafana/Loki، alert و runbook غایب است |
| A22 | Security Acceptance | 🟡 | CORS/Trusted Hosts/headers/Redis rate limit/secret guards و تست‌های پایه وجود دارد | گزارش OWASP/API Security و retest بدون High/Critical کامل نیست |
| A23 | Performance | 🔴 | build و smoke tests موجود است | load test صد کاربر/۵ AI Job و p95 report وجود ندارد |
| A24 | UI/RTL/Responsive | 🟡 | RTL و مسیرهای اصلی فعال‌اند | مرورگر/موبایل/accessibility/visual regression و state coverage کامل نیست |
| A25 | Docs/Training | 🟡 | معماری، handoff، run notes و این ماتریس وجود دارد | راهنمای کامل نصب/ادمین/API/backup/incident و آموزش نهایی ناقص است |
| A26 | Ownership | 🟡 | مخزن، Staging و حساب‌های اصلی تحت کنترل کارفرماست | inventory نهایی حساب/secret و drill مستقل rotate/restore/deploy باقی است |
| A27 | No Demo Data | 🟠 | Unicorn Lab حذف و بخشی از fallbackهای ساختگی حذف شده است | ممیزی کل UI برای demo/sample/hardcode و حذف یا برچسب‌گذاری کامل نیست |
| A28 | Audit | 🟡 | عملیات حساس Platform/Product و بخشی از Billing لاگ می‌شوند | auth/security/credit/provider/file events، export و retention کامل نیست |
| A29 | API Keys/Webhooks | 🔴 | secret داخلی Gateway و webhook تنظیمی محدود وجود دارد | API key مشتری، scope/quota/expiry/IP، HMAC webhook و delivery log غایب است |
| A30 | Warranty/Defect Process | ⚪ | توسعه داخلی ادامه دارد | release acceptance، defect window و مسئول رفع نقص باید پیش از Production ثبت شود |

## دروازهٔ فعلی: بستن فاز هسته

فاز هسته فقط با چهار خروجی زیر بسته می‌شود:

- [ ] MFA/TOTP برای نقش‌های مدیریتی، recovery امن و تست E2E
- [ ] Lockout سمت سرور، ثبت تلاش ورود و Admin Unlock
- [ ] Credit Ledger افزایشی با reserve/consume/release/refund/expire و idempotency
- [ ] ماتریس تست Auth/Tenant/RBAC/Credit و UAT ثبت‌شده روی Staging

## ترتیب PRهای بعدی

1. **Account Security:** MFA، lockout/unlock، audit و تست‌ها
2. **Credit Ledger:** مدل/مهاجرت/service، سازگاری با شمارنده فعلی، تست اتمیک و rollback
3. **Authorization Gate:** پوشش endpoint × role × tenant و رفع شکاف‌های IDOR/RBAC
4. **Core UAT:** اجرای سناریوهای واقعی روی Staging و ثبت Pass/Fail

هر PR باید مستقل، قابل rollback و بدون تغییر Production باشد.

## تصمیم‌های دامنه

- Unicorn Lab طبق تصمیم مالک محصول از دامنه حذف شده است.
- قابلیت مشترک `track-funding` زیر Strategic Radar باقی می‌ماند.
- ظاهر و ماژول‌های جدید پس از تثبیت هسته روی همین معماری افزوده می‌شوند.
- Production تا تکمیل Migration، Operations، Backup/Restore و پذیرش صریح مالک محصول دست‌نخورده می‌ماند.

## شواهد این ممیزی

- `main@fb994cd` و PR #28
- سه GitHub Quality Gate سبز روی `1d8a2fc`
- Staging healthy و API health موفق
- Alembic `20260823_0011 (head)`
- تست‌های Auth، Recovery، Company، Admin، Runtime Security، AI Metering
- مدل‌ها و سرویس‌های Identity، Access، Billing، Admin و Compatibility
- `AGENTS.md`، `EXECUTION_ORDER.md` و `INDEPENDENCE_BACKLOG.md`
