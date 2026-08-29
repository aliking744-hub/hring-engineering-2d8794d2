# Manifest مهاجرت Lovable/Supabase به HRing مستقل

این مهاجرت فقط بعد از گرفتن Snapshot read-only از منبع اجرا می‌شود. هیچ export یا credential مبدأ در Git قرار نمی‌گیرد.

## خروجی‌های لازم از مبدأ

1. CSV/JSON هر جدول همراه با count دقیق و زمان snapshot.
2. فهرست objectهای Storage شامل bucket، key، size، content type و checksum.
3. mapping شناسه‌های کاربر، شرکت، عضویت و relationها.
4. فهرست entitlementهای پرداخت/اعتبار و محصولات خریداری‌شده.

## ترتیب مهاجرت

1. کاربران و profileها؛ سپس شرکت‌ها و membershipها.
2. نقش‌ها و permissionها؛ سپس محتوا و تنظیمات عمومی.
3. Ledger/پرداخت/entitlement با reconciliation جداگانه.
4. فایل‌ها با checksum و تنها پس از وجود owner/reference مقصد.
5. داده‌های قابلیت‌ها؛ هر رکورد ناموفق به quarantine report می‌رود، نه حذف خاموش.

## فایل Evidence اجباری

برای هر entity: `source_count`، `imported_count`، `skipped_count`، `failed_count`، `relation_count`، `checksum` و مسیر rollback ثبت می‌شود. اختلاف count یا checksum مانع Cutover است.

## ممنوعیت‌ها

- اجرای migration روی Production.
- overwrite دادهٔ مقصد بدون backup و شناسهٔ run.
- انتقال Secret، password hash ناسازگار یا token فعال بدون طرح Rotate.
- پاک‌سازی مبدأ قبل از پذیرش reconciliation و Restore Drill.
