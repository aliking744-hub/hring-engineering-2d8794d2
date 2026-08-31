# ماتریس اجرایی PR66

تاریخ مبنا: ۲۹ اوت ۲۰۲۶  
شاخه آماده‌سازی: `codex/pr66-preparation`  
قاعده: تا بازگشت GitHub Actions هیچ PR، Merge یا Deploy انجام نمی‌شود. تغییرات مستقل در این شاخه جمع می‌شوند و سپس یک‌جا از Quality Gate عبور می‌کنند.

## وضعیت‌ها

- `آماده‌سازی آفلاین`: کد، تست، اسکریپت یا سند را اکنون می‌توان تکمیل کرد.
- `نیازمند سرویس بیرونی`: بدون حساب/کلید/داده واقعی فقط Fixture و Contract آماده می‌شود.
- `نیازمند Staging`: نتیجه فقط پس از استقرار و آزمون واقعی قابل پذیرش است.
- `آخر کار`: طبق تصمیم علی، هدهانتینگ پس از سایر قابلیت‌ها انجام می‌شود.

## ۳۰ بسته قابل ردیابی

| # | بسته | کار قابل انجام اکنون | گیت نهایی | اولویت |
|---:|---|---|---|---|
| 01 | PR744 غیرهدهانتینگ | ممیزی UI/API/Contract و تکمیل Fixtureها | UAT قابلیت‌به‌قابلیت | اکنون |
| 02 | استقلال Runtime | اسکن Lovable/Supabase در سورس و Compose | اسکن Image و Network | اکنون |
| 03 | Migration از صفر | Alembic graph و اسکریپت round-trip | PostgreSQL خالی در CI | اکنون |
| 04 | Auth | ماتریس Login/Refresh/Logout/Reset | تست ایمیل/SMS واقعی | اکنون |
| 05 | MFA و Lockout | تست سیاست و خطاها | تحویل OTP واقعی | اکنون |
| 06 | Session Security | تست expiry/revocation/cookie | مرورگر Staging | اکنون |
| 07 | Tenant Isolation | تست منفی cross-tenant | Staging با دو شرکت | اکنون |
| 08 | RBAC | ماتریس نقش × عملیات | UAT نقش‌های واقعی | اکنون |
| 09 | CMS | ممیزی CRUD/Publish/Media | UAT پنل ادمین | اکنون |
| 10 | Plan Catalog | یک منبع قیمت و versioning | کنترل خرید واقعی | اکنون |
| 11 | Credit Ledger | بستن self-write و تست atomic/idempotent | reconciliation واقعی | اکنون |
| 12 | اتصال Credit به قابلیت‌ها | ماتریس reserve/consume/release/refund | اجرای Provider واقعی | اکنون |
| 13 | Marketplace | entitlement و download contract | پرداخت/دانلود واقعی | اکنون |
| 14 | زرین‌پال | Fixture و callback/idempotency tests | Sandbox زرین‌پال | سرویس بیرونی |
| 15 | Storage خصوصی | MIME/path/quota/access tests | MinIO و مرورگر Staging | اکنون |
| 16 | Antivirus/Quarantine | interface، state machine و تست | موتور AV واقعی | اکنون |
| 17 | Lifecycle/Orphan cleanup | job و dry-run report | اجرای داده واقعی | اکنون |
| 18 | مهاجرت داده | mapping، count/relation/checksum scripts | export منبع Lovable | سرویس بیرونی |
| 19 | مهاجرت فایل | manifest/checksum/resume/rollback | دسترسی فایل مبدأ | سرویس بیرونی |
| 20 | AI داخلی | benchmark harness و expected contracts | مدل داخلی و GPU/CPU واقعی | اکنون |
| 21 | Provider/Prompt | fallback، schema و version tests | کلید Providerها | اکنون |
| 22 | API Key مشتری/Webhook | مدل امنیتی، signing، replay tests | endpoint مصرف‌کننده واقعی | اکنون |
| 23 | Worker/Jobs | retry/idempotency/dedupe contracts | اجرای broker و job واقعی | اکنون |
| 24 | Backup/Restore | runbook، verification و timer checks | offsite + restore drill | اکنون |
| 25 | Monitoring/Logs | rule lint، dashboard/runbook specs | alert واقعی روی Staging | اکنون |
| 26 | Security Acceptance | SAST/dependency/secret/static suites | DAST و رفع Critical/High | اکنون |
| 27 | Load/Performance | سناریوی ۱۰۰ وب + ۵ AI و threshold | اجرای Staging و ثبت p95 | اکنون |
| 28 | UAT/RTL/A11y/Visual | checklist و browser scripts | مرورگر/موبایل Staging | اکنون |
| 29 | Docs/Release/Clean install | README/ERD/OpenAPI/runbook/release checklist | نصب سرور تمیز و branch protection | اکنون |
| 30 | هدهانتینگ و پذیرش نهایی | استخراج Contract و طراحی job/webhook/PDF | Make/PhantomBuster، UAT و امضای پذیرش | آخر کار |

## تصمیم‌های قطعی این شاخه

1. مرورگر حق ایجاد `user_purchases` ندارد؛ entitlement فقط پس از تأیید server-side ساخته می‌شود.
2. مرورگر حق ایجاد `credit_transactions` ندارد؛ دفتر اعتبار فقط توسط Credit Service تراکنشی نوشته می‌شود.
3. Strategy/Business/Unicorn از دامنه حذف شده‌اند و کمبود محسوب نمی‌شوند.
4. هیچ تغییر این شاخه قبل از سبز شدن تست‌ها و بازبینی consolidated merge نمی‌شود.
5. Production بدون اجازه صریح علی تغییر نمی‌کند.

## خروجی‌های آماده‌شده تا این نقطه

- `scripts/pr66-offline-preflight.sh`: گیت یکپارچه frontend/backend/gateway/Compose.
- `scripts/pr66-static-audit.sh`: اسکن استقلال Runtime و موجودی Demo/Hardcode/Financial access.
- `scripts/pr66-migration-roundtrip.sh`: Upgrade/Downgrade/Upgrade روی دیتابیس موقت و پاک‌سازی‌شونده.
- `scripts/pr66-staging-smoke.sh`: Smoke غیرمخرب health/web/auth و ذخیره Evidence.
- `tests/load/pr66-acceptance.js`: سناریوی ۱۰۰ کاربر وب و ۵ AI job همزمان.
- `docs/engineering/PR66_LIVE_INPUTS_FA.md`: ورودی‌های زنده و مدرک موردنیاز هر گیت.
- سخت‌سازی Marketplace و Credit Ledger: خرید و تراکنش اعتبار از مرورگر self-grant نمی‌شوند.

## ترتیب بارگذاری پس از فعال‌شدن Actions

1. Sync شاخه با آخرین `main` و حل تعارض‌ها.
2. اجرای `scripts/pr66-offline-preflight.sh` و تست Migration از صفر.
3. یک PR تجمیعی با گزارش همین ماتریس؛ اجرای همه Quality Gateها.
4. رفع نتایج CI و Security؛ سپس Merge.
5. یک Deploy یکپارچه روی Staging، Smoke/UAT/Load/Restore و ثبت شواهد.
6. انجام هدهانتینگ، نصب تمیز و پذیرش نهایی.
