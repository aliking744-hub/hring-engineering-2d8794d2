# راهنمای بکاپ و بازیابی HRing

این Runbook بکاپ سازگار PostgreSQL و MinIO، کنترل checksum و بازیابی آزمایشی در منابع موقت را پوشش می‌دهد. هیچ دستور Restore این سند نباید مستقیماً روی دیتابیس یا bucket اصلی اجرا شود.

## خروجی بکاپ

هر اجرا یک پوشه با شناسه UTC مانند `20260824T230000Z` می‌سازد:

- `postgres.dump`: خروجی custom-format و قابل اعتبارسنجی `pg_restore`
- `minio.tar.gz`: snapshot منطقی bucket خصوصی از مسیر API خود MinIO
- `manifest.txt`: نسخه کد، Alembic، bucket و تعداد objectها؛ بدون Secret
- `SHA256SUMS`: checksum تمام artifactهای ضروری

پوشه ابتدا با پسوند `.partial` ساخته می‌شود و فقط پس از موفقیت کامل به نام نهایی تغییر می‌کند. مجوز فایل‌ها با `umask 077` محدود می‌شود و `flock` از اجرای هم‌زمان جلوگیری می‌کند.

## اجرای دستی روی Staging

```bash
cd /opt/hring
ENV_FILE=/opt/hring/.env.standalone \
BACKUP_ROOT=/var/backups/hring \
RETENTION_DAYS=14 \
./scripts/operations/backup.sh
```

برای اعتبارسنجی آخرین بکاپ:

```bash
latest="$(find /var/backups/hring -mindepth 1 -maxdepth 1 -type d -name '20*T*Z' | sort | tail -n 1)"
ENV_FILE=/opt/hring/.env.standalone \
BACKUP_ROOT=/var/backups/hring \
./scripts/operations/verify-backup.sh "$latest"
```

## Restore Drill ایزوله

اسکریپت زیر یک دیتابیس و bucket موقت با نام محدودشده می‌سازد، dump و فایل‌ها را داخل آن‌ها برمی‌گرداند، Alembic و تعداد objectها را تطبیق می‌دهد و در پایان هر دو منبع موقت را پاک می‌کند:

```bash
ENV_FILE=/opt/hring/.env.standalone \
BACKUP_ROOT=/var/backups/hring \
./scripts/operations/restore-drill.sh "$latest"
```

قبولی Drill باید شامل `Restore drill passed` باشد. شکست checksum، revision، table count یا object count به معنی نامعتبر بودن بکاپ است و باید قبل از هر استقرار بعدی بررسی شود.

## زمان‌بندی روزانه

```bash
install -d -m 0700 /var/backups/hring
install -m 0644 infra/systemd/hring-backup.service /etc/systemd/system/hring-backup.service
install -m 0644 infra/systemd/hring-backup.timer /etc/systemd/system/hring-backup.timer
systemctl daemon-reload
systemctl enable --now hring-backup.timer
systemctl list-timers hring-backup.timer
```

تایمر هر روز حدود ساعت 02:15 سرور اجرا می‌شود و بکاپ را بلافاصله verify می‌کند. نگه‌داری محلی پیش‌فرض ۱۴ روز است و فقط پوشه‌هایی با الگوی دقیق شناسه بکاپ حذف می‌شوند.

## نسخه خارج از سرور

تا زمان انتخاب مقصد و ثبت Credential مربوط، artifact تأییدشده باید بعد از هر Drill به یک مقصد خارج از همان سرور کپی شود. مقصد نهایی باید رمزنگاری‌شده، دارای retention مستقل و فاقد mount نوشتنی دائمی روی سرور HRing باشد. اتصال Credential این مقصد طبق تصمیم مالک محصول در مرحله نهایی تنظیم سرویس‌ها انجام می‌شود؛ Secret نباید در Git، Chat، log یا unit فایل قرار گیرد.

## ممنوعیت‌ها

- Restore مستقیم روی دیتابیس `hring` ممنوع است.
- Restore مستقیم روی bucket `hring-private` ممنوع است.
- اجرای backup با `BACKUP_ROOT` برابر مسیرهای وسیع مانند `/`، `/opt` یا ریشه مخزن رد می‌شود.
- حذف دستی backup پیش از اطمینان از وجود نسخه سالم خارج از سرور ممنوع است.
