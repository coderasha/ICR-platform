-- Additive normalized financial-record and reconciliation-run foundation.
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'MATCHED', 'UNMATCHED', 'EXCEPTION');
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_EXCEPTIONS', 'FAILED', 'CANCELLED');

CREATE TABLE "transactions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "legal_entity_id" UUID NOT NULL,
  "import_batch_id" UUID,
  "source_record_key" VARCHAR(200) NOT NULL,
  "document_reference" VARCHAR(200),
  "transaction_date" DATE NOT NULL,
  "amount" DECIMAL(20,6) NOT NULL,
  "currency_code" CHAR(3) NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "source_payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reconciliation_runs" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "legal_entity_id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'DRAFT',
  "rules_version" VARCHAR(50) NOT NULL,
  "input_fingerprint" CHAR(64),
  "processed_count" INTEGER NOT NULL DEFAULT 0,
  "matched_count" INTEGER NOT NULL DEFAULT 0,
  "unmatched_count" INTEGER NOT NULL DEFAULT 0,
  "failure_reason" VARCHAR(1000),
  "queued_at" TIMESTAMPTZ(6),
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reconciliation_runs_period_check" CHECK ("period_end" >= "period_start")
);

CREATE UNIQUE INDEX "transactions_organization_id_source_record_key_key" ON "transactions"("organization_id", "source_record_key");
CREATE INDEX "transactions_organization_id_legal_entity_id_transaction_date_idx" ON "transactions"("organization_id", "legal_entity_id", "transaction_date");
CREATE INDEX "transactions_organization_id_status_idx" ON "transactions"("organization_id", "status");
CREATE INDEX "transactions_organization_id_document_reference_idx" ON "transactions"("organization_id", "document_reference");
CREATE INDEX "reconciliation_runs_organization_id_status_created_at_idx" ON "reconciliation_runs"("organization_id", "status", "created_at");
CREATE INDEX "reconciliation_runs_organization_id_legal_entity_id_period_start_period_end_idx" ON "reconciliation_runs"("organization_id", "legal_entity_id", "period_start", "period_end");

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_legal_entity_id_fkey" FOREIGN KEY ("organization_id", "legal_entity_id") REFERENCES "legal_entities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_organization_id_legal_entity_id_fkey" FOREIGN KEY ("organization_id", "legal_entity_id") REFERENCES "legal_entities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
