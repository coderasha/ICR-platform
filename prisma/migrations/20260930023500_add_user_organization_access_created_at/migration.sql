-- Preserve the legacy granted_at evidence while adding the timestamp used by the Prisma model.
ALTER TABLE "user_organization_access"
  ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
