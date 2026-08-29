# قرارداد اتصال منبع‌یابی خودکار هدهانتینگ

این قرارداد برای اتصال مجاز Make، PhantomBuster یا سرویس اختصاصی sourcing به HRing است. HRing هرگز صرفاً با پاسخ `202` یا با پایان timeout، کمپین را موفق اعلام نمی‌کند.

## چرخه

1. کاربر کمپین را ایجاد می‌کند؛ وضعیت آن `processing` است.
2. HRing یک `sourceRunId` و callback یک‌بارمصرف ایجاد و درخواست را به connector می‌فرستد.
3. پاسخ فوری connector فقط «پذیرش درخواست» است.
4. connector پس از جمع‌آوری، نتیجه را به callback می‌فرستد.
5. HRing callback را اعتبارسنجی، داده را تحلیل و ذخیره می‌کند؛ فقط آن‌وقت کمپین `active` می‌شود.
6. callback تکراری یا نامعتبر بدون ایجاد کاندیدای تکراری رد می‌شود.

## درخواست HRing به connector

```json
{
  "sourceRunId": "uuid",
  "campaignId": "uuid",
  "callbackUrl": "https://<host>/api/v1/recruiting/source-runs/<sourceRunId>/callback",
  "callbackToken": "one-time-secret",
  "jobRequirements": {
    "jobTitle": "string",
    "city": "string",
    "skills": "string",
    "experience": "string",
    "industry": "string",
    "seniorityLevel": "string"
  },
  "maxCandidates": 30
}
```

Connector باید در درخواست اولیه فقط `202 Accepted` بدهد. هیچ دادهٔ شخصیِ غیرضروری یا اعتبارنامهٔ پلتفرم ثالث در این payload نیست.

## callback connector به HRing

Header:

```
Authorization: Bearer <callbackToken>
Content-Type: application/json
```

Body:

```json
{
  "candidates": [
    {
      "name": "string",
      "title": "string",
      "skills": ["string"],
      "experience": "string",
      "education": "string",
      "lastCompany": "string",
      "location": "string",
      "linkedin": "https://..."
    }
  ]
}
```

- حداکثر تعداد رکوردها از مقدار `maxCandidates` پیروی می‌کند.
- فیلدهای `email` و `phone` تنها با مبنای قانونی و رضایت مناسب باید ارسال شوند.
- HRing هنگام تحلیل AI، ایمیل، تلفن، لینک LinkedIn و دادهٔ خام رزومه را به provider نمی‌فرستد.
- دادهٔ برگشتی فقط یک‌بار پردازش می‌شود؛ تکرار callback پاسخ idempotent می‌گیرد.

## وضعیت خطا

- connector تنظیم نشده یا کلید نامعتبر: کمپین متوقف می‌شود، نه «موفق».
- callback خالی یا نامعتبر: source run `failed` و علت برای پیگیری ثبت می‌شود.
- تحلیل AI ناموفق: کاندیدای ساخته‌شده یا وضعیت موفق ثبت نمی‌شود.
