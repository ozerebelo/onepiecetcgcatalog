#!/usr/bin/env bash
# Runs the migrations and the pgTAP database tests against a throwaway local
# Postgres, without Docker. With Docker available prefer the real thing:
#
#   supabase start && supabase test db
#
# Requirements: Postgres 15+ server binaries and the pgTAP extension
# (Debian/Ubuntu: apt install postgresql-16 postgresql-16-pgtap).
#
# Usage: scripts/db/test-local.sh [--keep]   (--keep leaves the server running)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PGPORT_TEST:-54329}"
KEEP="${1:-}"
DATA_DIR="$(mktemp -d -t playset-pg-XXXXXX)"

# initdb refuses to run as root; use the postgres system user in that case.
run_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}
if [ "$(id -u)" = "0" ]; then chown postgres "$DATA_DIR"; fi

cleanup() {
  if [ "$KEEP" != "--keep" ]; then
    run_pg "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m fast stop >/dev/null 2>&1 || true
    rm -rf "$DATA_DIR"
  fi
}
trap cleanup EXIT

run_pg "$PG_BIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
run_pg "$PG_BIN/pg_ctl" -D "$DATA_DIR" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DATA_DIR/server.log" -w start >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U postgres -d postgres)

echo "▶ applying Supabase stub"
"${PSQL[@]}" -f "$ROOT/scripts/db/supabase-stub.sql" >/dev/null

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "▶ migration $(basename "$migration")"
  "${PSQL[@]}" -f "$migration" >/dev/null
done

failed=0
for test in "$ROOT"/supabase/tests/database/*.sql; do
  echo "▶ test $(basename "$test")"
  output="$("${PSQL[@]}" -t -A -c "set search_path = public, extensions;" -f "$test" 2>&1)" || failed=1
  echo "$output" | sed 's/^/    /'
  if echo "$output" | grep -qE '^not ok|Looks like you failed|ERROR'; then failed=1; fi
done

if [ "$KEEP" = "--keep" ]; then
  echo "Postgres left running: postgresql://postgres@127.0.0.1:$PORT/postgres (data: $DATA_DIR)"
fi

if [ "$failed" -ne 0 ]; then
  echo "✗ database tests failed"
  exit 1
fi
echo "✓ database tests passed"
