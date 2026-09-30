-- Additive collaboration notes for exception investigation.
CREATE TABLE "exception_notes" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "reconciliation_exception_id" UUID NOT NULL,
  "author_user_id" UUID,
  "body" VARCHAR(1000) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exception_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exception_notes_reconciliation_exception_id_created_at_idx" ON "exception_notes"("reconciliation_exception_id", "created_at");
CREATE INDEX "exception_notes_organization_id_created_at_idx" ON "exception_notes"("organization_id", "created_at");
ALTER TABLE "exception_notes" ADD CONSTRAINT "exception_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_notes" ADD CONSTRAINT "exception_notes_reconciliation_exception_id_fkey" FOREIGN KEY ("reconciliation_exception_id") REFERENCES "reconciliation_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_notes" ADD CONSTRAINT "exception_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
