#!/usr/bin/env bash
# Wave E.2 (2026-04-24) — run unit tests for scholarship fund libraries.
#
# Usage:
#   bash apps/web/scripts/wave-e2-run-tests.sh
#
# Relies on Node ≥ 20 (for node:test) and tsx (for TS-on-the-fly).

set -euo pipefail

cd "$(dirname "$0")/.."

export STRIPE_ALLOW_DEV_PLACEHOLDER=1
export NODE_ENV=test

unset STRIPE_SECRET_KEY ZOHO_SELF_CLIENT_ID ZOHO_SELF_CLIENT_SECRET \
      ZOHO_REFRESH_TOKEN_CORE ZOHO_REFRESH_TOKEN \
      ZOHO_PROJECTS_SCHOLARSHIP_FUND_ID

# Resolve tsx binary. Prefer global install; fall back to PATH lookup.
TSX_BIN=""
if [ -x "/Users/samer/.nvm/versions/node/v22.18.0/bin/tsx" ]; then
  TSX_BIN="/Users/samer/.nvm/versions/node/v22.18.0/bin/tsx"
elif command -v tsx >/dev/null 2>&1; then
  TSX_BIN="$(command -v tsx)"
else
  echo "ERROR: tsx binary not found. Install via: npm install -g tsx"
  exit 1
fi

echo "=== Wave E.2 unit tests (tsx: $TSX_BIN) ==="
echo

PASS_COUNT=0
FAIL_COUNT=0

for test_file in \
  src/lib/__tests__/stripe-donations.test.ts \
  src/lib/__tests__/zoho-projects.test.ts \
  src/lib/__tests__/donation-webhook-handlers.test.ts
do
  echo "---- $test_file ----"
  if "$TSX_BIN" --test "$test_file"; then
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  echo
done

echo "=== Wave E.2 suites: $PASS_COUNT passed, $FAIL_COUNT failed ==="
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
