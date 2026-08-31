# ورودی‌های زنده و گیت اجرای PR66

این فایل Secret نگه نمی‌دارد. مقدارها فقط هنگام اجرای گیت مربوطه از Secret Manager یا متغیر محیطی وارد می‌شوند و نباید در Git، گزارش یا history ثبت شوند.

| ورودی | کاربرد | کار آماده‌شده قبل از دسترسی | مدرک لازم برای Passed |
|---|---|---|---|
| GitHub Actions فعال | Quality/Security/Build | preflight و تست‌ها روی شاخه آماده‌اند | همه checkها سبز |
| Staging admin/user token | UAT و کنترل RBAC | Smoke غیرمخرب و ماتریس نقش آماده است | پاسخ‌های مجاز/غیرمجاز ثبت‌شده |
| Zarinpal sandbox | پرداخت و entitlement | contract/idempotency/reconciliation آماده بررسی | تراکنش success/fail/replay/refund |
| SMS provider | OTP/MFA | سیاست و مسیر backend قابل تست است | ارسال و expiry/lockout واقعی |
| Email provider | reset/notification | مسیر backend قابل تست است | delivery و failure handling |
| AI provider keys | Prompt/Provider/fallback | registry و contract testها موجود است | خروجی واقعی، قطع Provider و fallback |
| AI داخلی | benchmark و استقلال | harness/Compose قابل تکمیل است | کیفیت/زمان/منابع ثبت‌شده |
| Make/PhantomBuster webhook | sourcing هدهانتینگ | contract و امنیت در بسته آخر | signing/auth/retry/dedupe واقعی |
| Export دیتابیس Lovable | مهاجرت داده | mapping و reconciliation باید روی snapshot نهایی اجرا شود | count/relation/checksum/rollback |
| Export فایل‌های مبدأ | مهاجرت Storage | manifest/checksum/resume لازم است | checksum و دسترسی فایل‌ها |
| Offsite backup target | DR | timer/runbook محلی قابل کنترل است | encrypted backup و restore drill |
| سرور تمیز | Clean install | README و Compose مستقل آماده می‌شود | نصب فقط با مستندات تحویلی |

## فرمان‌های گیت پس از دسترسی

```bash
bash scripts/pr66-offline-preflight.sh
PR66_ENV_FILE=.env.standalone bash scripts/pr66-migration-roundtrip.sh
BASE_URL=https://staging.hring.ir bash scripts/pr66-staging-smoke.sh
```

Token احراز هویت فقط برای همان process تزریق می‌شود:

```bash
PR66_AUTH_TOKEN='runtime-only' \
BASE_URL=https://staging.hring.ir \
bash scripts/pr66-staging-smoke.sh
```

برای Load Test از `tests/load/pr66-acceptance.js` استفاده می‌شود. URL و Payload دقیق AI بعد از انتخاب endpoint پذیرفته‌شده در Staging تزریق می‌شوند؛ خود تست هیچ Secret ثابتی ندارد.
