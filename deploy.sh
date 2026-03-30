#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="silicon"

cd "$APP_DIR"

echo ""
echo "======================================"
echo "  SDGL Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"
echo ""

# ── 1. Show what's incoming ────────────────────────────────────────────────────

echo "► Fetching latest from remote..."
git fetch origin main --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo ""
  echo "  Already up to date. Nothing to deploy."
  echo ""
  exit 0
fi

echo ""
echo "┌─ Changes since last deploy ─────────────────────────────────────────────"
echo ""
git log --oneline HEAD..origin/main
echo ""
echo "┌─ Files changed ─────────────────────────────────────────────────────────"
echo ""
git diff --stat HEAD..origin/main
echo ""

# ── 2. Confirm ─────────────────────────────────────────────────────────────────

read -r -p "Deploy these changes? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""

# ── 3. Pull ────────────────────────────────────────────────────────────────────

echo "► Pulling..."
git pull origin main --quiet
echo "  Done."

# ── 4. Dependencies ────────────────────────────────────────────────────────────

echo "► Installing dependencies..."
npm ci --omit=dev --quiet
echo "  Done."

# ── 5. Prisma migrations ───────────────────────────────────────────────────────

echo "► Running database migrations..."
npx prisma migrate deploy
echo "  Done."

# ── 6. Build ───────────────────────────────────────────────────────────────────

echo "► Building..."
npm run build
echo "  Done."

# ── 7. Restart ─────────────────────────────────────────────────────────────────

echo "► Restarting app..."
pm2 restart "$APP_NAME" --update-env
echo "  Done."

# ── 8. Health check ────────────────────────────────────────────────────────────

echo "► Checking app is up..."
sleep 3

STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
  procs = json.load(sys.stdin)
  match = next((p for p in procs if p.get('name') == '$APP_NAME'), None)
  if match:
    print(match['pm2_env']['status'])
  else:
    print('not_found')
except Exception as e:
  print('error')
" 2>/dev/null || echo "unknown")

if [ "$STATUS" = "online" ]; then
  echo "  App is online."
else
  echo ""
  echo "  WARNING: pm2 status is '$STATUS' — check logs:"
  echo "    pm2 logs $APP_NAME --lines 50"
  echo ""
fi

# ── 9. Summary ─────────────────────────────────────────────────────────────────

NEW=$(git rev-parse --short HEAD)
echo ""
echo "======================================"
echo "  Deploy complete — $NEW"
echo "======================================"
echo ""
echo "  Commits deployed:"
git log --oneline "$LOCAL".."$NEW" 2>/dev/null || true
echo ""
echo "  PM2 status:"
pm2 list --no-color 2>/dev/null | grep -E "($APP_NAME|─|App name)" | head -5 || true
echo ""
