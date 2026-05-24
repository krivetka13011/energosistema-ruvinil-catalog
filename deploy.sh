#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SFTP_HOST="${SFTP_HOST:-46.254.20.108}"
SFTP_USER="${SFTP_USER:-ruvinil}"
SFTP_REMOTE_PATH="${SFTP_REMOTE_PATH:-/home/ruvinil/www/}"
DIST_DIR="${DIST_DIR:-dist}"

if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

if [ -z "${SFTP_PASSWORD:-}" ]; then
  read -r -s -p "SFTP password for ${SFTP_USER}@${SFTP_HOST}: " SFTP_PASSWORD
  echo
fi

if ! command -v lftp >/dev/null 2>&1; then
  echo "lftp is required for SFTP deploy" >&2
  exit 1
fi

npm run build

if [ ! -d "$DIST_DIR" ]; then
  echo "Build output not found: $DIST_DIR" >&2
  exit 1
fi

REMOTE="${SFTP_REMOTE_PATH%/}/"

lftp -u "${SFTP_USER},${SFTP_PASSWORD}" "sftp://${SFTP_HOST}" <<EOF
set sftp:connect-program "ssh -a -x -oStrictHostKeyChecking=accept-new"
cd ${REMOTE}
lcd ${ROOT}/${DIST_DIR}
mirror -R --delete --parallel=4 --verbose .
bye
EOF

echo "Deploy complete: ${SFTP_HOST}:${REMOTE}"
