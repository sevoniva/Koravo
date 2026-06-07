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

Build and run the browser console through Compose:

```bash
cd koravo-ui
npm run build
cd ..
docker compose up --build koravo-ui
```

The UI image packages the local `koravo-ui/dist` output. This keeps npm dependency installation on the developer machine, where the domestic npm mirror and local proxy are already configured. The packaged UI listens on `KORAVO_UI_PORT` and proxies `/api/` to `koravo-server:8080` inside the Compose network.

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
- `KORAVO_UI_PORT`

## PostgreSQL

PostgreSQL is the first supported database. Liquibase creates Koravo platform tables, and Flowable initializes its own schema.

## Redis

Redis is included as a baseline dependency for future cache, lock, and event features. v0.1 does not rely on Redis for the minimal process loop.

## MinIO

MinIO is included as object storage for future model files, attachments, and form assets. v0.1 does not require buckets for the minimal process loop.

## Backend Config

Backend configuration lives in `koravo-bootstrap/src/main/resources/application.yml`. Use environment variables instead of hardcoded credentials.
