# Deployment Guide

## Docker Compose

Start dependencies:

```bash
cp .env.example .env
docker compose up -d postgres redis minio
```

Build and run the backend from the local JVM:

```bash
cd koravo-server
mvn -pl koravo-bootstrap -am -DskipTests package
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=15432 \
REDIS_HOST=127.0.0.1 REDIS_PORT=6379 \
java -jar koravo-bootstrap/target/koravo-bootstrap-0.1.0-SNAPSHOT.jar
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

- `POSTGRES_IMAGE`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `REDIS_IMAGE`
- `REDIS_HOST`
- `REDIS_PORT`
- `MINIO_IMAGE`
- `MINIO_ENDPOINT`
- `MINIO_API_PORT`
- `MINIO_CONSOLE_PORT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `KORAVO_SERVER_PORT`
- `KORAVO_UI_PORT`

## PostgreSQL

PostgreSQL is the first supported database. Liquibase creates Koravo platform tables, and Flowable initializes its own schema.
The default host port is `15432` to avoid conflicts with a local PostgreSQL on `5432`; containers still talk to PostgreSQL on port `5432` inside the Compose network.

## Redis

Redis is included as a baseline dependency for future cache, lock, and event features. v0.1 does not rely on Redis for the minimal process loop.

## MinIO

MinIO is included as object storage for future model files, attachments, and form assets. v0.1 does not require buckets for the minimal process loop.

## Backend Config

Backend configuration lives in `koravo-bootstrap/src/main/resources/application.yml`. Use environment variables instead of hardcoded credentials.

## Image Sources

Dependency images can be overridden in `.env` when Docker Hub is slow or rate-limited:

```env
POSTGRES_IMAGE=postgres:16
REDIS_IMAGE=redis:7
MINIO_IMAGE=quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z
```

Use a domestic registry mirror or pre-pulled local tag by changing these values without editing `docker-compose.yml`.
