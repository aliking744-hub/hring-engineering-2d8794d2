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

برای انتقال نسخهٔ **تأییدشده** به مقصد خارج از سرور از اسکریپت immutable زیر استفاده می‌شود. مقصد `OFFSITE_REMOTE` باید یک remote رمزنگاری‌شدهٔ rclone باشد و روی سرور HRing mount نوشتنی دائمی نداشته باشد.

```bash
latest="$(find /var/backups/hring -mindepth 1 -maxdepth 1 -type d -name '20*T*Z' | sort | tail -n 1)"
ENV_FILE=/opt/hring/.env.standalone \
OFFSITE_REMOTE='encrypted-remote:hring-backups' \
./scripts/operations/offsite-backup.sh "$latest"
```

این دستور ابتدا `rclone copy --immutable --checksum` و بعد `rclone check --one-way --checksum` اجرا می‌کند؛ بنابراین artifact موجود را overwrite نمی‌کند و پیش از اعلام موفقیت، تطابق مقصد را کنترل می‌کند. آن را فقط پس از `verify-backup.sh` یا Restore Drill موفق اجرا کنید.

Credential مقصد در Git، Chat، log، متغیر unit systemd یا فایل `.env.standalone` قرار نمی‌گیرد. پیکربندی `rclone` باید با مجوز مالک سرویس در محل محافظت‌شدهٔ سیستم نگهداری شود. زمان‌بندی offsite تا وقتی مقصد و روش نگهداری نهایی انتخاب نشده، عمدی است که دستی بماند.

## ممنوعیت‌ها

- Restore مستقیم روی دیتابیس `hring` ممنوع است.
- Restore مستقیم روی bucket `hring-private` ممنوع است.
- اجرای backup با `BACKUP_ROOT` برابر مسیرهای وسیع مانند `/`، `/opt` یا ریشه مخزن رد می‌شود.
- حذف دستی backup پیش از اطمینان از وجود نسخه سالم خارج از سرور ممنوع است.
