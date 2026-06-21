#!/bin/sh
set -e

if [ "$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_database WHERE datname = 'nestjs_saas_test'")" != "1" ]; then
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE nestjs_saas_test"
  echo "Created database nestjs_saas_test"
fi
