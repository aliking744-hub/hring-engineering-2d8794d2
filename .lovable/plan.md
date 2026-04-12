

## پلن: الماس بی‌نهایت برای تست بدون لاگین

### مشکل
الان `useCredits` وقتی `user` نال باشه (بدون لاگین)، الماس رو صفر برمی‌گردونه و عملیات‌های deduct هم فِیل می‌شن.

### راهکار
فایل `src/hooks/useCredits.tsx` رو تغییر بدیم که در حالت تست (بدون لاگین):
- همیشه `isFatherAdmin = true` باشه (مثل useSuperAdmin که قبلاً bypass شده)
- الماس `999999` برگردونه
- تمام عملیات `deductCredits` و `deductForOperation` بدون کم کردن واقعی `true` برگردونن

### تغییرات

**فایل: `src/hooks/useCredits.tsx`**
- خط ۶۲: شرط `isFatherAdmin` رو به `true` تغییر بدیم (مثل بقیه hookهای bypass شده)
- با این کار تمام checkهای الماس bypass می‌شن چون بقیه کد قبلاً شرط `isFatherAdmin` رو داره

```typescript
// TEMPORARY: Testing mode — bypass credit restrictions
const isFatherAdmin = true;
```

یک تغییر ساده در یک خط — بقیه منطق hook خودش با `isFatherAdmin = true` همه چیز رو bypass می‌کنه.

