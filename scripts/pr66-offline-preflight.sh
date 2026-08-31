#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

run() {
  printf '\n==> %s\n' "$1"
  shift
  "$@"
}

run "Reject operational Supabase SDK dependency" \
  bash -c "! rg -n '@supabase/supabase-js|\\.supabase\\.co' package.json package-lock.json src apps services compose*.yaml"

run "Reject operational Lovable runtime references" \
  bash -c '! rg -n "lovable\\.app|lovableproject\\.com|Lovable AI Gateway" src apps services compose*.yaml infra'

run "Validate PR66 transfer automation syntax" bash -c '
  bash -n scripts/pr66-offline-preflight.sh
  bash -n scripts/pr66-migration-roundtrip.sh
  bash -n scripts/pr66-staging-preflight.sh
  bash -n scripts/pr66-staging-smoke.sh
'

run "Create PR66 static audit reports" bash scripts/pr66-static-audit.sh

run "Validate frontend" npm run check

run "Validate backend style" bash -c 'cd apps/api && ruff check src tests'
run "Validate backend types" bash -c 'cd apps/api && mypy src'
run "Validate backend tests" bash -c 'cd apps/api && pytest -q'

run "Validate AI gateway" bash -c 'cd services/ai-gateway && ruff check src tests && mypy src && pytest -q'

run "Validate Compose" docker compose --env-file .env.standalone.example config --quiet
run "Validate local AI Compose" docker compose \
  --env-file .env.standalone.example \
  -f compose.yaml \
  -f compose.local-ai.yaml \
  --profile local-ai \
  config --quiet

printf '\nPR66 offline preflight passed.\n'
