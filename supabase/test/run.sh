#!/usr/bin/env bash
# Pakai: PGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres supabase/test/run.sh <berkas vars.psql>
set -euo pipefail
cd "$(dirname "$0")"
VARS="$1"
psql -v ON_ERROR_STOP=1 -q -c "drop database if exists mbl_test" -c "create database mbl_test"
export PGDATABASE=mbl_test
psql -v ON_ERROR_STOP=1 -q -f shim.sql -f ../schema.sql 2>&1 | grep -v NOTICE || true
# ubah \set b1 '...' menjadi baris INSERT untuk t.vars
sed -E "s/^\\\\set ([a-z_0-9]+) '(.*)'$/insert into t.vars values ('\1', '\2');/" "$VARS" > vars_insert.sql
psql -v ON_ERROR_STOP=1 -q -f rls.sql 2>&1 | grep -v '^$' || exit 1
rm -f vars_insert.sql
