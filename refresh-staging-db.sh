#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "Missing .env in $APP_DIR"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

STAGING_DATABASE_URL="${STAGING_DATABASE_URL:-${DATABASE_URL:-}}"

if [ -z "$STAGING_DATABASE_URL" ]; then
  echo "DATABASE_URL (or STAGING_DATABASE_URL) must be set in .env"
  exit 1
fi

PROD_DATABASE_URL="${PROD_DATABASE_URL:-}"

if [ -z "$PROD_DATABASE_URL" ]; then
  case "$STAGING_DATABASE_URL" in
    */silicon_staging)
      PROD_DATABASE_URL="${STAGING_DATABASE_URL%/silicon_staging}/silicon"
      ;;
    *)
      echo "Unable to infer PROD_DATABASE_URL from staging DATABASE_URL."
      echo "Set PROD_DATABASE_URL explicitly and rerun."
      exit 1
      ;;
  esac
fi

if [ "$PROD_DATABASE_URL" = "$STAGING_DATABASE_URL" ]; then
  echo "Refusing to continue: production and staging database URLs are identical."
  exit 1
fi

DUMP_FILE="$(mktemp /tmp/silicon-prod-refresh-XXXXXX.dump)"
trap 'rm -f "$DUMP_FILE"' EXIT

echo ""
echo "======================================"
echo "  Refresh Staging DB — $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"
echo ""
echo "Production: $PROD_DATABASE_URL"
echo "Staging:    $STAGING_DATABASE_URL"
echo ""

read -r -p "Replace the staging database with a fresh copy of production? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "► Dumping production database..."
pg_dump "$PROD_DATABASE_URL" -Fc -f "$DUMP_FILE"
echo "  Done."

echo "► Clearing staging schema..."
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL
echo "  Done."

echo "► Restoring into staging database..."
pg_restore -d "$STAGING_DATABASE_URL" --no-owner --no-acl "$DUMP_FILE"
echo "  Done."

# The restore above replaced the whole public schema, including the
# _prisma_migrations table, so staging is now on production's schema. Staging
# runs the `development` branch, which is usually ahead of production, so any
# migration newer than prod has just been dropped along with everything else.
# Re-apply them here rather than leaving the schema behind the deployed code.
#
# This cannot be left to ./deploy-staging.sh: deploy.sh exits early with
# "Already up to date. Nothing to deploy." whenever the branch has not moved,
# which skips its own migrate step.
#
# DATABASE_URL is set inline so Prisma targets staging even when .env points
# somewhere else. Prisma's dotenv load does not override variables that are
# already set in the environment.
_MIGRATE_DB="${STAGING_DATABASE_URL##*/}"
_MIGRATE_DB="${_MIGRATE_DB%%\?*}"

echo "► Applying pending migrations to staging..."
echo "  Target database: $_MIGRATE_DB"
DATABASE_URL="$STAGING_DATABASE_URL" npx prisma migrate deploy
echo "  Done."

echo "► Verifying staging contents..."
psql "$STAGING_DATABASE_URL" -c 'SELECT COUNT(*) AS players FROM "Player"; SELECT COUNT(*) AS seasons FROM "Season"; SELECT COUNT(*) AS weeks FROM "Week";'

echo "► Migration status..."
DATABASE_URL="$STAGING_DATABASE_URL" npx prisma migrate status

echo ""
echo "======================================"
echo "  Staging refresh complete"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Restart the app so it drops connections killed by the restore:"
echo "       pm2 restart silicon-staging"
echo "  2. Review https://sdglstage.ericssonfam.com"
echo ""
echo "  Note: ./deploy-staging.sh only deploys when the branch has moved."
echo "  It is not needed here — migrations were applied above."
echo ""
