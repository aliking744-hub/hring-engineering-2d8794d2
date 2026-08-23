# HRing — دروازهٔ فاز هسته

**نسخه:** 2026-08-23  
**مبنای کد:** `main@fb994cd32af7f581228601d0c0c66237182cf83b`  
**هدف یک‌جمله‌ای:** هستهٔ Auth/Tenant/RBAC/Credit/Admin باید پیش از گسترش ظاهری یا افزودن ماژول جدید، دارای کنترل‌های امنیتی، حسابداری و تست پذیرش قابل اتکا باشد.

## 1. دامنهٔ تغییر

این دروازه فقط حوزه‌های زیر را پوشش می‌دهد:

- Identity & Authentication
- Companies & Membership
- Platform/Company RBAC
- Plans & Credits
- Admin foundation
- Audit events مرتبط با موارد بالا

این دروازه شامل تکمیل CMS، Payment Provider واقعی، Legal RAG، Worker، Monitoring، Migration Production یا تغییر ظاهر نیست.

## 2. وضعیت تأییدشده

### موجود و دارای تست

- Register/Login/Refresh/Logout
- Refresh token rotation و replay rejection
- Password reset/change و session revocation
- Email verification
- Session list/selective revoke/logout-all
- Company creation، CEO provisioning، invites و capacity
- Company suspension و منع استفاده از invite
- Platform/Product admin separation
- Company permission override و cross-tenant denial
- حفاظت از آخرین Super Admin
- Audit پایه برای عملیات مدیریتی
- Redis rate limit برای مسیرهای حساس

### شکاف‌های مسدودکننده

1. MFA/TOTP برای نقش‌های مدیریتی وجود ندارد.
2. Account Lockout پایدار و Admin Unlock وجود ندارد.
3. Credit Ledger افزایشی وجود ندارد.
4. پوشش permission و IDOR برای تمام endpointهای حساس کامل نیست.
5. Audit رخدادهای Auth/MFA/Lockout/Credit کامل نیست.
6. UAT هسته روی Staging ثبت نشده است.

## 3. PR اول — Account Security

### رفتار مورد انتظار

- کاربر بتواند TOTP را ثبت، تأیید، غیرفعال و با recovery code بازیابی کند.
- نقش‌های `super_admin`، `platform_admin`، `content_admin` و `support_admin` بدون MFA فعال اجازهٔ نشست مدیریتی نداشته باشند.
- Secret خام TOTP و recovery code خام هرگز در log، API response تکراری یا دیتابیس plaintext باقی نماند.
- تلاش ناموفق ورود به‌صورت server-side ثبت شود.
- پس از آستانهٔ تنظیم‌شده، حساب موقتاً قفل شود.
- Super Admin بتواند قفل حساب را باز کند.
- تغییر رمز، reset، deactivation، MFA reset و Admin Unlock نشست‌های لازم را revoke کنند.
- همهٔ اعمال حساس Audit شوند.

### مدل/مهاجرت پیشنهادی

- `mfa_factors`
- `mfa_recovery_codes`
- `login_attempts` یا state معادل با retention مشخص
- فیلدهای lockout روی user یا جدول امنیتی مستقل

هر schema change باید migration جدید Alembic، downgrade امن و impact analysis داشته باشد. migration قبلی نباید بازنویسی شود.

### تست‌های الزامی

- enrollment و verification صحیح TOTP
- رد کد اشتباه/منقضی یا replay نامجاز
- recovery code یکبارمصرف
- الزام MFA برای همهٔ platform roleها
- عدم الزام MFA برای کاربر عادی مگر opt-in
- lockout پس از threshold
- پایان lockout یا Admin Unlock
- عدم account enumeration
- session revocation
- عدم افشای secret در response/log/audit

## 4. PR دوم — Credit Ledger

### رفتار مورد انتظار

- موجودی از جمع رویدادهای Ledger یا projection قابل بازسازی باشد.
- عملیات `grant/reserve/consume/release/refund/expire/admin_adjustment` فقط append شوند.
- هر عملیات دارای owner scope دقیق: user یا company.
- هر reservation دارای `idempotency_key` و lifecycle معتبر باشد.
- Provider/AI failure اعتبار را release کند.
- retry باعث مصرف دوباره نشود.
- admin adjustment علت و actor اجباری داشته باشد.
- Audit و correlation/request id ثبت شود.

### سازگاری انتقالی

ستون‌های فعلی `monthly_credits`، `used_credits` و `credit_pool` تا پایان migration حذف نمی‌شوند. مسیر جدید باید با backfill و projection کنترل‌شده فعال شود و frontend تا زمان UAT قرارداد فعلی را دریافت کند.

### تست‌های الزامی

- concurrent reserve بدون double-spend
- consume فقط از reservation معتبر
- release در failure
- idempotent retry
- user/company isolation
- refund/expire
- عدم موجودی منفی
- تطبیق projection با Ledger
- rollback migration و حفظ مسیر قبلی تا cutover

## 5. PR سوم — Authorization Gate

یک inventory ماشینی/مستند از همهٔ endpointهای حساس تهیه شود و برای هر endpoint موارد زیر ثبت شود:

- Authentication
- Platform permission یا Company permission
- Tenant ownership rule
- Audit requirement
- Credit requirement
- تست Allow
- تست Deny
- تست Cross-tenant/IDOR

هیچ endpoint حساس نباید فقط به مخفی‌سازی UI متکی باشد.

## 6. UAT فاز هسته روی Staging

حداقل سناریوها:

1. کاربر عادی: ثبت‌نام، verify، login، session management، password recovery
2. Super Admin: MFA، ایجاد شرکت، ایجاد مدیر، نقش‌ها، deactivate/reactivate و unlock
3. دو شرکت مستقل: users/invites/settings/permissions و تلاش دسترسی متقاطع
4. اعتبار فردی: grant → reserve → consume و failure → release
5. اعتبار شرکتی: pool مستقل و منع مصرف tenant دیگر
6. Audit: مشاهدهٔ تمام رخدادهای حساس با actor/resource/outcome/time
7. rollback: migration downgrade در کاندید جدا و بازگشت بدون از دست‌رفتن داده

## 7. معیار خروج

فاز هسته فقط زمانی Passed است که:

- CI کامل سبز باشد.
- migration round-trip پاس شود.
- تست‌های Auth/Tenant/RBAC/Credit پاس شوند.
- build کاندید مستقل پاس شود.
- Staging backup و rollback point داشته باشد.
- UAT ثبت و امضا شود.
- هیچ تغییر Production رخ نداده باشد.

## 8. ترتیب و محدودیت

- هر حوزه در PR مستقل
- بدون refactor یا formatting گسترده
- بدون تغییر ظاهر
- بدون حذف مسیر انتقالی پیش از reconciliation
- بدون Secret واقعی در GitHub، chat، log یا test fixture
- production فقط با مجوز صریح بعدی
