# Deployment Guide

## Docker Compose

Start dependencies:

```bash
cp .env.example .env
docker compose up -d postgres redis minio
```

Build and run server through Compose:

```bash
docker compose up --build koravo-server
```

## Environment Variables

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `KORAVO_SERVER_PORT`

## PostgreSQL

PostgreSQL is the first supported database. Liquibase creates Koravo platform tables, and Flowable initializes its own schema.

## Redis

Redis is included as a baseline dependency for future cache, lock, and event features. v0.1 does not rely on Redis for the minimal process loop.

## MinIO

MinIO is included as object storage for future model files, attachments, and form assets. v0.1 does not require buckets for the minimal process loop.

## Backend Config

Backend configuration lives in `koravo-bootstrap/src/main/resources/application.yml`. Use environment variables instead of hardcoded credentials.
