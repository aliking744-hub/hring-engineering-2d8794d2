# وضعیت آماده‌سازی PR66 پیش از اجرای گیت‌ها

## انجام‌شده در شاخه `codex/pr66-runtime-completion`

- مسیر HR Dashboard از ذخیره‌سازی مستقیم Supabase جدا شد.
- داده‌های واقعیِ HR در `hr_dashboard_uploads` روی PostgreSQL ذخیره می‌شوند و هر API بر اساس `owner_user_id` محدود شده است.
- فهرست، ایجاد، دریافت و حذف snapshotهای HR API مستقل دارد.
- دادهٔ دمو دیگر در تاریخچهٔ داده‌های سازمان ذخیره نمی‌شود و در UI صریحاً «نمایشی» برچسب می‌خورد.
- تست قراردادی برای API و جداسازی دادهٔ دمو افزوده شده است.

## آماده برای اجرای گیت‌ها

1. اجرای migration `20260830_0027_hr_dashboard_uploads`.
2. اجرای frontend check، backend quality و smoke tests.
3. staging preflight و migration roundtrip.
4. UAT با یک فایل اکسل واقعی و یک اجرای دادهٔ دمو:
   - دادهٔ واقعی پس از refresh از تاریخچه برگردد.
   - دادهٔ دمو در تاریخچه ظاهر نشود.
   - کاربر دوم به تاریخچهٔ کاربر اول دسترسی نداشته باشد.

## مواردی که هنوز به تصمیم/credential محیط وابسته‌اند

- فعال‌سازی واقعی SMS، ایمیل و زرین‌پال.
- تنظیم provider و اعتبار API برای AI managed/BYOK.
- اجرای UAT واقعی AI و سناریوی callback برای Smart Headhunting.

## توجه برای ادغام بعدی

شاخهٔ Smart Headhunting نیز migration مستقلی دارد. پیش از ادغام هر دو شاخه، شمارهٔ revisionهای Alembic باید به یک زنجیرهٔ واحد تبدیل شود؛ این کار باید در همان PR/rebase انجام شود، نه روی staging.
