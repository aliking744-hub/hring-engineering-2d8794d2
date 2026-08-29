# HRing Engineering

مخزن مستقل HRing شامل وب‌اپ React، API مبتنی بر FastAPI، AI Gateway، Worker، PostgreSQL، Redis و Object Storage خصوصی MinIO است. اجرای عملیاتی سامانه به Lovable، Supabase Auth/Database/Storage/Edge Functions یا Lovable AI Gateway وابسته نیست.

## اجزای اصلی

- `src/`: رابط کاربری React/Vite و سازگارساز API قدیمی.
- `apps/api/`: هویت، Tenant/RBAC، Billing/Credit، قابلیت‌های محصول، Storage و Admin API.
- `services/ai-gateway/`: Registry و مسیریابی Provider/Model/Prompt با کلیدهای server-side.
- `apps/worker/`: کارهای پس‌زمینه و صف‌های AI/Notification/Maintenance.
- `compose.yaml`: PostgreSQL، Redis، MinIO، API، Web، Worker و Observability.
- `infra/`: تنظیمات استقرار، پایش و عملیات.

نام `src/integrations/supabase` فقط یک facade سازگاری برای کد UI قدیمی است و از SDK یا Runtime سوپابیس استفاده نمی‌کند.

## اجرای مستقل

```bash
cp .env.standalone.example .env.standalone
# تمام CHANGE_MEها را با secretهای واقعی جایگزین کنید.
docker compose --env-file .env.standalone up -d --build
docker compose --env-file .env.standalone ps
curl -fsS http://127.0.0.1:8080/api/v1/health
```

Providerهای SMS، Email، Payment و AI تا زمانی که credential واقعی تنظیم نشود fail-closed یا disabled می‌مانند. Secretها نباید در Git، خروجی تست یا history شل ثبت شوند.

## کنترل کیفیت

```bash
npm ci
npm run check

cd apps/api
ruff check src tests
mypy src
pytest -q

cd ../../services/ai-gateway
ruff check src tests
mypy src
pytest -q
```

برای بسته نهایی PR66:

```bash
bash scripts/pr66-static-audit.sh
bash scripts/pr66-offline-preflight.sh
PR66_ENV_FILE=.env.standalone bash scripts/pr66-migration-roundtrip.sh
```

تست بار پذیرش با k6، به‌صورت پیش‌فرض ۱۰۰ کاربر وب و ۵ کار AI همزمان اجرا می‌کند:

```bash
k6 run \
  -e BASE_URL=https://staging.hring.ir \
  -e AI_TEST_URL=https://staging.hring.ir/api/v1/REPLACE_WITH_ACCEPTED_AI_ENDPOINT \
  -e AI_AUTH_TOKEN=REPLACE_AT_RUNTIME \
  -e AI_PAYLOAD='{"replace":"with accepted payload"}' \
  tests/load/pr66-acceptance.js
```

## قواعد انتشار

- تغییرات از شاخه نام‌دار و Pull Request وارد `main` می‌شوند.
- Migrationهای schema فقط با Alembic انجام می‌شوند.
- قبل از Merge باید Quality Gate، تست Migration و بازبینی امنیتی سبز باشند.
- ابتدا یک Deploy یکپارچه روی Staging و UAT انجام می‌شود.
- Production فقط با اجازه صریح مالک پروژه Deploy می‌شود.

وضعیت و ترتیب اجرای بسته نهایی در `docs/engineering/PR66_EXECUTION_MATRIX_FA.md` نگهداری می‌شود.
