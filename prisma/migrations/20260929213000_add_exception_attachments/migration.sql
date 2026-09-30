CREATE TABLE "exception_attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reconciliation_exception_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID,
    "original_filename" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exception_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exception_attachments_storage_key_key" ON "exception_attachments"("storage_key");
CREATE INDEX "exception_attachments_reconciliation_exception_id_created_at_idx" ON "exception_attachments"("reconciliation_exception_id", "created_at");
CREATE INDEX "exception_attachments_organization_id_created_at_idx" ON "exception_attachments"("organization_id", "created_at");

ALTER TABLE "exception_attachments" ADD CONSTRAINT "exception_attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_attachments" ADD CONSTRAINT "exception_attachments_reconciliation_exception_id_fkey" FOREIGN KEY ("reconciliation_exception_id") REFERENCES "reconciliation_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_attachments" ADD CONSTRAINT "exception_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
