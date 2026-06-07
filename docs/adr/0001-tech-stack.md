# ADR 0001: Tech Stack

## Status

Accepted for v0.1 and still active during the v0.2/v0.3 consolidation work.

## Decision

Koravo v0.1 uses:

- Java 21
- Spring Boot 3.5.3
- Flowable 7.1.0
- Maven
- PostgreSQL 16
- Redis 7
- MinIO
- Liquibase
- Spring Data JPA
- Vue 3.5
- Vite 6
- Ant Design Vue
- bpmn-js

## Compatibility Notes

The initial target requested Spring Boot 4.x and Flowable 8.x. During implementation, Maven Central exposed Flowable Spring Boot starter artifacts up to `7.1.0`, and Spring Boot starter parent `3.5.3` was the stable available line. To avoid committing a non-compiling project, v0.1 uses Spring Boot 3.5.3 and Flowable 7.1.0.

Module boundaries still support a future upgrade:

- `koravo-engine` isolates Flowable native services.
- controllers depend on platform facades and services.
- Flowable objects are not returned to frontend APIs.
- Flowable tables are not modified by platform migrations.

## Database

PostgreSQL is the first database because it is stable, open-source, and works well with Flowable and Liquibase.

## Frontend

Vue 3, TypeScript, Vite, Pinia, Vue Router, Axios, and Ant Design Vue provide a practical open-source console stack. bpmn-js is used by the process designer and process trace viewer, so the console can edit BPMN drafts and inspect runtime or historic process paths without exposing Flowable native services to controllers.
