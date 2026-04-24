#!/usr/bin/env bash
# Wave E.2 (2026-04-24) — Kun pre-commit hook (source).
#
# Install into `.git/hooks/pre-commit` via:
#   bash apps/web/scripts/install-pre-commit-hook.sh
#
# This file is the canonical source; the installed copy is a byte-for-byte
# symlink or copy. Edit this file, NOT the installed hook.

set -e

# Only run checks on staged TS/TSX/JSON files to keep feedback fast.
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

# Dignity-framing audit on scholarship surfaces
if echo "$STAGED_FILES" | grep -qE '(stripe-donations|zoho-projects|donation-webhook-handlers|app/\[locale\]/donate|app/\[locale\]/scholarships|app/api/donations|app/api/scholarships|DonationForm|ScholarshipsBoard|ScholarshipApplicationForm|messages/(ar|en)\.json)'; then
  echo "[pre-commit] Running Wave E dignity-framing audit..."
  cd "$(git rev-parse --show-toplevel)"
  if [ -f apps/web/scripts/lint-dignity-framing.ts ]; then
    TSX_BIN=""
    if [ -x "/Users/samer/.nvm/versions/node/v22.18.0/bin/tsx" ]; then
      TSX_BIN="/Users/samer/.nvm/versions/node/v22.18.0/bin/tsx"
    elif command -v tsx >/dev/null 2>&1; then
      TSX_BIN="$(command -v tsx)"
    fi
    if [ -n "$TSX_BIN" ]; then
      "$TSX_BIN" apps/web/scripts/lint-dignity-framing.ts || {
        echo "[pre-commit] Dignity-framing audit FAILED — commit blocked."
        echo "See WAVE-E-SCHOLARSHIP-FUND-SPEC.md §3.2 for approved language."
        exit 1
      }
    else
      echo "[pre-commit] tsx not in PATH — skipping dignity audit (WARNING)."
    fi
  fi
fi

exit 0
