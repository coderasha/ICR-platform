-- Required by the tenant-scoped foreign keys introduced in subsequent additive migrations.
ALTER TABLE "legal_entities"
  ADD CONSTRAINT "legal_entities_organization_id_id_key" UNIQUE ("organization_id", "id");
