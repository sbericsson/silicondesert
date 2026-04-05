#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export APP_NAME="silicon-staging"
export DEPLOY_BRANCH="development"

exec "$APP_DIR/deploy.sh" "$@"
