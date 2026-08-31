#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

report_dir="${PR66_REPORT_DIR:-artifacts/pr66}"
mkdir -p "$report_dir"

runtime_report="$report_dir/runtime-dependencies.txt"
demo_report="$report_dir/demo-hardcode-inventory.txt"
financial_report="$report_dir/browser-financial-writes.txt"

rg -n --hidden \
  -g '!docs/**' -g '!artifacts/**' -g '!node_modules/**' -g '!.git/**' \
  '@supabase/supabase-js|\.supabase\.co|lovable\.app|lovableproject\.com|Lovable AI Gateway' \
  package.json package-lock.json src apps services infra compose*.yaml >"$runtime_report" || true

rg -n -i \
  -g '!artifacts/**' -g '!node_modules/**' \
  'demo|mock|fixture|sample|placeholder|hard.?code|آزمایشی|نمونه' \
  src apps services >"$demo_report" || true

rg -n \
  -g '*.ts' -g '*.tsx' -g '*.js' -g '*.mjs' \
  "from\(['\"](user_credits|user_purchases|credit_transactions)['\"]\)" \
  src >"$financial_report" || true

if [[ -s "$runtime_report" ]]; then
  printf 'PR66 runtime independence audit failed. See %s\n' "$runtime_report" >&2
  exit 1
fi

printf 'Runtime dependencies: clean\n'
printf 'Demo/hardcode inventory: %s\n' "$demo_report"
printf 'Browser financial access inventory: %s\n' "$financial_report"
