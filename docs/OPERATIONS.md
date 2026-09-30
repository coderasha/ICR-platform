# ICR Platform operations

## Local services

Copy `.env.example` to `.env`, replace every placeholder secret, then start PostgreSQL, Redis and MinIO with `docker compose up -d`. The compose ports bind only to loopback by default.

Run `pnpm prisma migrate deploy` before starting the API or worker against a database that has not received the current migrations. Do not use `prisma migrate reset` outside a disposable local environment.

Start the API and worker separately so import/reconciliation work does not consume API request capacity:

```sh
pnpm --filter api start:dev
pnpm --filter worker dev
pnpm --filter web dev
```

The API exposes `/api/v1/health` for liveness and `/api/v1/ready` for PostgreSQL readiness. Every response has an `X-Request-Id`; retain it in reverse-proxy and application logs when investigating a request.

## Production configuration

Set strong unique values for database, Redis, MinIO and JWT secrets. Set `WEB_ORIGIN` to the exact web application origin. `STORAGE_DRIVER=local` is development-only. Production requires `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`; `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE=true` support MinIO or another S3-compatible service. The bucket must be private and created before the API or worker starts.

The API fails fast in `NODE_ENV=production` unless `JWT_ACCESS_SECRET` is at least 32 characters, `REDIS_URL` is explicitly configured, and `WEB_ORIGIN` is a valid HTTPS origin. The worker likewise refuses to start in production without `REDIS_URL`. This is intentional: do not rely on development fallback connection values in a deployment.

The API adds request IDs and baseline browser security headers. Terminate TLS at the load balancer/reverse proxy, forward the request ID, and keep the application-to-proxy network private. HSTS is emitted only in production.

The application uses the configured S3-compatible object store for imports and exception evidence in production. Keep the bucket private, enable provider-side encryption/versioning and lifecycle retention, and grant the API/worker identity only bucket-scoped read/write/delete permissions. The local driver writes to disk and is not suitable for production.

## Backup and recovery

Back up PostgreSQL with `pg_dump` on a tested schedule and keep an independently encrypted copy of imported source files/object storage. Restore first to an isolated environment, apply the exact application migrations, validate row counts and import hashes, then promote only after finance-owner approval.

Never delete import batches, transactions, reconciliation runs, match records, or exceptions to fix a workflow issue. Use a new batch/run and retain the earlier record for auditability.
