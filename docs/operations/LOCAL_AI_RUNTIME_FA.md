# راهنمای Runtime هوش مصنوعی لوکال HRing

این راهنما فقط برای **Staging** آماده شده است. هیچ‌یک از فرمان‌های این سند نباید روی
Production اجرا شود مگر پس از UAT، ظرفیت‌سنجی و تأیید صریح مالک سامانه.

## تصمیم معماری

- Ollama برای راه‌اندازی ساده‌تر CPU/GPU و مدل‌های GGUF در نظر گرفته شده است.
- vLLM برای سرور NVIDIA و بار همزمان بالاتر، به‌صورت override جدا ارائه می‌شود.
- هیچ پورتی از Runtime به اینترنت یا Host منتشر نمی‌شود؛ دسترسی فقط روی شبکهٔ
  `hring_internal` است.
- انتخاب Provider، مدل، Primary/Fallback و Prompt از پنل HRing انجام می‌شود.
- مدل لوکال به‌صورت پیش‌فرض اجرا یا دانلود نمی‌شود. فعال‌سازی نیازمند profile صریح است.

## ۱) قبل از انتخاب مدل، ظرفیت سرور را ثبت کنید

روی سرور Staging و پس از ورود امن اجرا شود:

```bash
free -h
df -h / /var/lib/docker
lscpu
nvidia-smi
```

اگر `nvidia-smi` وجود ندارد، مسیر CPU انتخاب می‌شود. نام و اندازهٔ مدل فقط بعد از
دیدن RAM، فضای آزاد، CPU/GPU و نیاز کیفیت فارسی تعیین شود. دانلود آزمایشی مدل بزرگ
بدون این بررسی ممنوع است.

## ۲) Ollama بدون GPU

نسخهٔ Runtime در فایل Compose پین شده است. نام مدل را مستقیم در فایل امن سرور وارد
کنید و آن را در چت یا Issue قرار ندهید:

```dotenv
OLLAMA_MODEL=<approved-model-name>
OLLAMA_KEEP_ALIVE=5m
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_MAX_QUEUE=32
```

سپس فقط سرویس‌های profile لوکال را بالا بیاورید:

```bash
docker compose \
  --env-file .env.standalone \
  -f compose.yaml \
  -f compose.local-ai.yaml \
  --profile local-ai \
  up -d ollama ollama-init
```

`ollama-init` پس از دانلود و تأیید مدل با وضعیت موفق خارج می‌شود. دادهٔ مدل در volume
`hring_ollama` باقی می‌ماند. اگر `OLLAMA_MODEL` خالی باشد، Runtime بالا می‌آید ولی
هیچ مدل سنگینی دانلود نمی‌شود.

## ۳) Ollama با NVIDIA

فقط اگر `nvidia-smi` سالم و Docker NVIDIA Runtime نصب است، override زیر نیز افزوده
شود:

```bash
docker compose \
  --env-file .env.standalone \
  -f compose.yaml \
  -f compose.local-ai.yaml \
  -f compose.local-ai.nvidia.yaml \
  --profile local-ai \
  up -d ollama ollama-init
```

## ۴) اتصال Ollama به پنل HRing

در `/admin/integrations` از قالب «Ollama لوکال» استفاده کنید:

| فیلد | مقدار |
|---|---|
| نوع | `llm` |
| Adapter | `ollama` |
| Base URL | `http://ollama:11434/v1` |
| Auth | `none` |
| Internal | روشن |
| Default model | دقیقاً همان `OLLAMA_MODEL` |
| Primary aliases | مانند `ollama` |
| Fallback for | مانند `gemini, openai` |

دکمهٔ «تست اتصال» علاوه بر دسترسی Runtime، وجود مدل انتخاب‌شده را در `/v1/models`
بررسی می‌کند. Provider تنها پس از وضعیت `healthy + active` وارد مسیر واقعی AI می‌شود.

سپس در `/admin/prompts` برای هر Prompt، `provider alias` را روی `ollama` و مدل را روی
نام نصب‌شده قرار دهید، تست واقعی بگیرید و فقط در صورت موفقیت Publish کنید.

## ۵) vLLM روی NVIDIA

vLLM فقط با فایل جدا و متغیرهای صریح فعال می‌شود:

```dotenv
VLLM_MODEL=<approved-huggingface-model>
VLLM_API_KEY=<long-random-internal-secret>
HF_TOKEN=
```

کلید `VLLM_API_KEY` را مستقیم در فایل امن سرور و همان مقدار را از طریق فرم Secret
در Integration Center وارد کنید؛ هرگز در چت یا مخزن ثبت نشود.

```bash
docker compose \
  --env-file .env.standalone \
  -f compose.yaml \
  -f compose.vllm.yaml \
  --profile local-ai-vllm \
  up -d vllm
```

تنظیم پنل:

| فیلد | مقدار |
|---|---|
| نوع | `llm` |
| Adapter | `vllm` |
| Base URL | `http://vllm:8000/v1` |
| Auth | `bearer` |
| Internal | روشن |
| Secret | همان `VLLM_API_KEY` |
| Default model | همان `VLLM_MODEL` |

## ۶) توقف و Rollback

ابتدا Provider لوکال را در Integration Center غیرفعال کنید تا Gateway سراغ fallback
سالم برود. سپس Runtime را متوقف کنید:

```bash
docker compose \
  --env-file .env.standalone \
  -f compose.yaml \
  -f compose.local-ai.yaml \
  --profile local-ai \
  stop ollama
```

حذف volume مدل جزو Rollback عادی نیست و بدون تأیید صریح نباید انجام شود.

## منابع رسمی

- Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility
- Ollama model inventory API: https://docs.ollama.com/api/tags
- Ollama releases: https://github.com/ollama/ollama/releases
- vLLM official Docker deployment: https://docs.vllm.ai/en/stable/deployment/docker/
- vLLM OpenAI-compatible server: https://docs.vllm.ai/en/latest/serving/online_serving/
