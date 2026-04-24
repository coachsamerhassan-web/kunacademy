#!/usr/bin/env bash
# Wave E.2 (2026-04-24) — install the Kun pre-commit hook.
#
# Usage:
#   bash apps/web/scripts/install-pre-commit-hook.sh
#
# Idempotent. Preserves any existing pre-commit hook by backing it up to
# .git/hooks/pre-commit.pre-wave-e2.bak if one exists.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_SRC="$REPO_ROOT/apps/web/scripts/pre-commit-hook-source.sh"
HOOK_DEST="$REPO_ROOT/.git/hooks/pre-commit"
HOOK_BACKUP="$REPO_ROOT/.git/hooks/pre-commit.pre-wave-e2.bak"

if [ ! -f "$HOOK_SRC" ]; then
  echo "[install-pre-commit] Source hook missing: $HOOK_SRC"
  exit 1
fi

if [ -f "$HOOK_DEST" ] && ! cmp -s "$HOOK_SRC" "$HOOK_DEST"; then
  # Different content already exists — back it up before overwriting.
  echo "[install-pre-commit] Existing pre-commit hook differs — backing up to $HOOK_BACKUP"
  cp "$HOOK_DEST" "$HOOK_BACKUP"
fi

cp "$HOOK_SRC" "$HOOK_DEST"
chmod +x "$HOOK_DEST"

echo "[install-pre-commit] Installed: $HOOK_DEST"
echo "[install-pre-commit] Source:    $HOOK_SRC"
