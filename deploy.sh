#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="${APP_NAME:-silicon}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

cd "$APP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo ""
echo "======================================"
echo "  SDGL Deploy ($DEPLOY_BRANCH) — $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"
echo ""

# ── 1. Show what's incoming ────────────────────────────────────────────────────

echo "► Fetching latest from remote..."
git fetch origin "$DEPLOY_BRANCH" --quiet

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]; then
  echo "► Switching to branch '$DEPLOY_BRANCH'..."
  if git show-ref --verify --quiet "refs/heads/$DEPLOY_BRANCH"; then
    git checkout --quiet "$DEPLOY_BRANCH"
  else
    git checkout --quiet -b "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
  fi
fi

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$DEPLOY_BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  echo ""
  echo "  Already up to date. Nothing to deploy."
  echo ""
  exit 0
fi

echo ""
echo "┌─ Changes since last deploy ─────────────────────────────────────────────"
echo ""
git log --oneline "HEAD..origin/$DEPLOY_BRANCH"
echo ""
echo "┌─ Files changed ─────────────────────────────────────────────────────────"
echo ""
git diff --stat "HEAD..origin/$DEPLOY_BRANCH"
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
git pull origin "$DEPLOY_BRANCH" --quiet
echo "  Done."

# ── 4. Dependencies ────────────────────────────────────────────────────────────

echo "► Installing dependencies..."
npm ci --quiet
echo "  Done."

# ── 5. Prisma migrations ───────────────────────────────────────────────────────

# Name the target before migrating. Prisma resolves DATABASE_URL from the
# environment before .env, so a stray DATABASE_URL in the caller's shell can
# silently point a migration at the wrong database. This script sources .env
# above (which overwrites it), but printing the target makes a mistake visible
# instead of silent.
_MIGRATE_DB="${DATABASE_URL:-}"
_MIGRATE_DB="${_MIGRATE_DB##*/}"
_MIGRATE_DB="${_MIGRATE_DB%%\?*}"

# Guard: the app being deployed and the database it points at must agree.
# Sourcing .env above resolves DATABASE_URL from THIS deployment directory,
# but a copied or edited .env would still aim migrations at the wrong
# database, and a migration is not something you undo. A staging app must
# use a staging database, and production must not.
if [ -z "$_MIGRATE_DB" ]; then
  echo ""
  echo "  ABORT: DATABASE_URL is not set, so there is no migration target."
  echo "  Check .env in $APP_DIR."
  echo ""
  exit 1
fi

case "$APP_NAME" in
  *staging*) _WANT_STAGING=1 ;;
  *)         _WANT_STAGING=0 ;;
esac
case "$_MIGRATE_DB" in
  *staging*) _DB_IS_STAGING=1 ;;
  *)         _DB_IS_STAGING=0 ;;
esac

if [ "$_WANT_STAGING" != "$_DB_IS_STAGING" ]; then
  echo ""
  echo "  ABORT: app '$APP_NAME' would migrate database '$_MIGRATE_DB'."
  if [ "$_WANT_STAGING" = "1" ]; then
    echo "  A staging app must point at a staging database."
  else
    echo "  A production app must not point at a staging database."
  fi
  echo "  Nothing has been migrated. Check DATABASE_URL in $APP_DIR/.env."
  echo ""
  exit 1
fi

echo "► Running database migrations..."
echo "  Target database: $_MIGRATE_DB"
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
