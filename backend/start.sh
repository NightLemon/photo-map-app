#!/bin/bash
set -e

export PYTHONPATH=/app

echo "Running database migrations..."
cd /app
alembic upgrade head

echo "Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
