-- Align the persisted role table with the Prisma role-activity model.
ALTER TABLE "roles"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
