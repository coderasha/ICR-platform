-- Durable, organization-scoped staging for source-file imports. This migration is additive.
CREATE TYPE "ImportStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');
CREATE TYPE "ImportFileType" AS ENUM ('CSV', 'XLSX');
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'REJECTED', 'IMPORTED');

CREATE TABLE "source_systems" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "system_type" VARCHAR(80) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "source_systems_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_batches" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "legal_entity_id" UUID NOT NULL,
  "source_system_id" UUID,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "original_filename" VARCHAR(255) NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "file_type" "ImportFileType" NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'DRAFT',
  "column_mapping" JSONB,
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "valid_rows" INTEGER NOT NULL DEFAULT 0,
  "rejected_rows" INTEGER NOT NULL DEFAULT 0,
  "imported_rows" INTEGER NOT NULL DEFAULT 0,
  "failure_reason" VARCHAR(1000),
  "created_by_user_id" UUID,
  "queued_at" TIMESTAMPTZ(6),
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_rows" (
  "id" UUID NOT NULL,
  "import_batch_id" UUID NOT NULL,
  "row_number" INTEGER NOT NULL,
  "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
  "raw_data" JSONB NOT NULL,
  "normalized_data" JSONB,
  "errors" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "source_systems_organization_id_code_key" ON "source_systems"("organization_id", "code");
CREATE INDEX "source_systems_organization_id_is_active_idx" ON "source_systems"("organization_id", "is_active");
CREATE UNIQUE INDEX "import_batches_organization_id_idempotency_key_key" ON "import_batches"("organization_id", "idempotency_key");
CREATE INDEX "import_batches_organization_id_status_created_at_idx" ON "import_batches"("organization_id", "status", "created_at");
CREATE INDEX "import_batches_organization_id_legal_entity_id_idx" ON "import_batches"("organization_id", "legal_entity_id");
CREATE UNIQUE INDEX "import_rows_import_batch_id_row_number_key" ON "import_rows"("import_batch_id", "row_number");
CREATE INDEX "import_rows_import_batch_id_status_idx" ON "import_rows"("import_batch_id", "status");

ALTER TABLE "source_systems" ADD CONSTRAINT "source_systems_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organization_id_legal_entity_id_fkey" FOREIGN KEY ("organization_id", "legal_entity_id") REFERENCES "legal_entities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_source_system_id_fkey" FOREIGN KEY ("source_system_id") REFERENCES "source_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
