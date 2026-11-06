#!/usr/bin/env bash
# Spins up a throwaway Postgres, applies migrations + seed, runs SQL tests.
# Requires Postgres 15+ binaries on PATH (initdb, pg_ctl, psql).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
SOCK="$DATA"
cleanup() { "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

RUNAS=()
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$DATA" 2>/dev/null || { useradd -r postgres && chown -R postgres "$DATA"; }
  RUNAS=(runuser -u postgres --)
fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -w start >/dev/null

PSQL=(psql -h "$SOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create database app" >/dev/null
run() { "${PSQL[@]}" -d app -o /dev/null -f "$1"; }

run "$ROOT/supabase/tests/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "migrate: $(basename "$f")"; run "$f"; done
run "$ROOT/supabase/seed.sql"
run "$ROOT/supabase/seed.sql" # idempotency
for f in "$ROOT"/supabase/tests/*.test.sql; do echo "test: $(basename "$f")"; run "$f"; done
echo "All database tests passed."
