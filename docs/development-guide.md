# Development Guide

## Add a Backend Module

1. Create a directory under `koravo-server`.
2. Add a module `pom.xml`.
3. Add it to `koravo-server/pom.xml`.
4. Keep dependencies one-way and avoid controller access to infrastructure APIs.
5. Add tests in the module where behavior lives.

## Add an API

1. Define request and response DTOs.
2. Put validation on request DTOs.
3. Keep controller logic to validation and service calls.
4. Return `ApiResponse`.
5. Use `GlobalExceptionHandler` for errors.
6. Record audit logs for key mutations.

## Add a Connector

1. Implement `Connector`.
2. Return a stable `type`.
3. Enforce security policy before external access.
4. Let `ConnectorRegistry` discover the Spring bean.

## Add a Database Migration

1. Edit `koravo-bootstrap/src/main/resources/db/changelog/db.changelog-master.yaml`.
2. Use `ko_` table prefix for platform tables.
3. Do not modify Flowable internal tables.
4. Include tenant and audit fields unless the table is explicitly operational-only.

## Run Tests

Backend:

```bash
cd koravo-server
mvn test
```

Docker-backed or long-running integration checks are isolated behind the `integration-test` Maven profile:

```bash
cd koravo-server
mvn -Pintegration-test -pl koravo-engine -am test
```

Default tests must stay runnable without Docker or external services.

Frontend:

```bash
cd koravo-ui
npm install
npm run build
```

If domestic npm is slow:

```bash
npm install --registry=https://registry.npmjs.org --no-audit --no-fund
```
