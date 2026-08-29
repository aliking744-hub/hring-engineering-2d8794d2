# قرارداد اتصال هوش مصنوعی شرکت‌ها در PR66

## تصمیم محصول

HRing دو مسیر هم‌زمان و شفاف برای مصرف قابلیت‌های AI دارد. انتخاب در سطح هر شرکت است و هر درخواست دقیقاً یکی از این دو مسیر را ثبت می‌کند:

1. **کلید اختصاصی شرکت (BYOK)**: شرکت کلید Provider خودش را وارد می‌کند. HRing فقط واسط اجرا، کنترل دسترسی و ثبت مصرف است؛ هزینهٔ Provider مستقیماً با شرکت است و از اعتبار HRing کم نمی‌شود.
2. **سرویس مدیریت‌شدهٔ HRing**: شرکت هیچ کلیدی نمی‌دهد. HRing Provider را با کلید پلتفرم اجرا می‌کند و هزینهٔ مشخص قابلیت از کیف اعتبار شرکت، به‌صورت تراکنشی، رزرو و نهایی می‌شود.

این دو مسیر به‌صورت fallback پنهان به هم تبدیل نمی‌شوند. اگر BYOK انتخاب شده و کلید/سقف آن نامعتبر است، پاسخ خطای قابل‌فهم داده می‌شود؛ بدون مصرف ناخواسته از اعتبار HRing.

## قواعد امنیتی غیرقابل‌مذاکره

- کلید BYOK فقط از مسیر HTTPS به API می‌رسد، با Fernet رمز می‌شود و هرگز در پاسخ، لاگ، Audit metadata، مرورگر یا Export بازگردانده نمی‌شود.
- UI فقط `secret_configured` و hint چهار کاراکتر آخر را می‌بیند.
- هر Connection به `company_id` متصل است؛ خواندن/ویرایش/تست/حذف cross-tenant باید 403 بدهد.
- URL Provider بیرونی فقط HTTPS و تحت همان کنترل SSRF فعلی Integration Center است.
- Providerهای مجاز فقط Adapterهای runtime-backed هستند؛ URL دلخواه یا Adapter نمایشی ساخته نمی‌شود.
- هر تغییر کلید، تغییر mode، تست اتصال و مصرف موفق/ناموفق audit می‌شود؛ متن Prompt و secret در audit قرار نمی‌گیرد.

## مدل داده و مجوزها

جدول پیشنهادی `company_ai_connections`:

| فیلد | کاربرد |
|---|---|
| `company_id` + `capability_key` | مالک و دامنهٔ قابلیت؛ یکتا هستند |
| `mode` | `byok` یا `hring_managed` |
| `provider_key`/`adapter`/`model` | انتخاب Provider برای BYOK؛ در managed فقط route پلتفرم |
| `secret_ciphertext` + `secret_hint` | فقط برای BYOK |
| `status`, `last_tested_at`, `last_error` | وضعیت عملیاتی؛ خطا بدون secret |
| `created_by`, `updated_by`, timestamps | مسئولیت‌پذیری |

مجوزهای جدید:

- `company.integrations.read`: مشاهدهٔ mode، Provider و وضعیت (بدون secret).
- `company.integrations.manage`: ثبت، تعویض، تست و حذف کلید؛ پیش‌فرض فقط CEO. سایر نقش‌ها فقط با override صریح.

## قرارداد اجرای AI و اعتبار

1. Gateway قبل از Provider، context شرکت و Connection همان `capability_key` را بارگذاری می‌کند.
2. در `byok`، secret بازگشایی‌شده فقط در حافظهٔ همان درخواست برای Adapter استفاده می‌شود؛ ledger HRing دست‌نخورده می‌ماند.
3. در `hring_managed`، Credit Service با idempotency key درخواست، اعتبار را reserve می‌کند؛ پس از پاسخ موفق consume و در خطا/timeout release می‌کند.
4. usage record شامل `billing_mode`، Provider/مدل انتخاب‌شده، token/latency و وضعیت است؛ نه secret و نه متن حساس.
5. قیمت managed تنها از catalog سمت سرور می‌آید. مرورگر مقدار هزینه یا mode تحمیل نمی‌کند.

## UI مورد انتظار

- بخش «اتصال AI شرکت» در تنظیمات شرکت، نه Integration Center پلتفرم.
- انتخاب واضح `استفاده از کلید شرکت` / `استفاده از اعتبار HRing` همراه با توضیح هزینه و Provider مؤثر.
- BYOK: Provider، مدل، کلید، دکمهٔ تست و وضعیت؛ بعد از ذخیره فقط hint نشان داده می‌شود.
- Managed: Provider route و هزینهٔ اعتبار هر اجرا فقط خواندنی است؛ دکمهٔ خرید/افزایش اعتبار به Billing موجود می‌رود.

## وضعیت واقعی checkpoint فعلی

این checkpoint فقط **control plane امن** را پیاده‌سازی می‌کند: جدول و migration مستقل، رمزگذاری Fernet، ماسک‌کردن secret، مجوز CEO/override، audit، مالکیت tenant، و test اتصال BYOK با محافظت SSRF. Headhunting عمداً در catalog قابل‌تنظیم شرکت قرار نگرفته است.

مسیر اجرای gateway و شاخهٔ credit هنوز به این Connection متصل نشده‌اند؛ بنابراین تا تکمیل resolver اجرایی و UAT، UI نباید آن را «فعال برای تولید» اعلام کند. این تفکیک عمدی است تا با ذخیره‌شدن یک کلید، برداشت نادرست از فعال‌شدن runtime یا fallback پنهان ایجاد نشود.

## Acceptance برای پیاده‌سازی پس از فعال‌شدن CI

- [ ] Company A نمی‌تواند Connection شرکت B را بخواند، تست کند یا تغییر دهد.
- [ ] secret در GET، audit، Exception و UI دیده نمی‌شود.
- [ ] BYOK موفق، credit ledger را تغییر نمی‌دهد.
- [ ] Managed موفق reserve→consume و خطا reserve→release را با idempotency تکراری دقیقاً یک‌بار انجام می‌دهد.
- [ ] انتخاب BYOK نامعتبر هرگز پنهانی به Managed fall back نمی‌کند.
- [ ] حذف/rotate کلید فوراً اجرای BYOK را متوقف و audit ایجاد می‌کند.
- [ ] مسیرهای UI فقط برای `company.integrations.manage` قابل ویرایش‌اند.

## محدودهٔ این تصمیم

این قرارداد مربوط به اتصال Provider توسط مشتری است؛ API عمومی HRing برای توسعه‌دهندگان یا فروش reseller، محصول و threat model جداگانه‌ای دارد و در این مرحله ساخته نمی‌شود.
