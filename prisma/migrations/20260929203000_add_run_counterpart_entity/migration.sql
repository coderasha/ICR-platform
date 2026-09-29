-- Additive counterpart context for intercompany reconciliation runs; historical runs remain readable.
ALTER TABLE "reconciliation_runs" ADD COLUMN "counterpart_legal_entity_id" UUID;
CREATE INDEX "reconciliation_runs_organization_id_counterpart_legal_entity_id_idx" ON "reconciliation_runs"("organization_id", "counterpart_legal_entity_id");
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_organization_id_counterpart_legal_entity_id_fkey" FOREIGN KEY ("organization_id", "counterpart_legal_entity_id") REFERENCES "legal_entities"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
