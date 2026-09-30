CREATE TYPE "ReconciliationPeriodStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TABLE "reconciliation_periods" (
  "id" UUID NOT NULL, "organization_id" UUID NOT NULL, "name" VARCHAR(100) NOT NULL,
  "period_start" DATE NOT NULL, "period_end" DATE NOT NULL,
  "status" "ReconciliationPeriodStatus" NOT NULL DEFAULT 'OPEN', "closed_at" TIMESTAMPTZ(6), "closed_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "reconciliation_periods_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reconciliation_periods_organization_id_name_key" ON "reconciliation_periods"("organization_id", "name");
CREATE INDEX "reconciliation_periods_organization_id_period_start_period_end_idx" ON "reconciliation_periods"("organization_id", "period_start", "period_end");
ALTER TABLE "reconciliation_periods" ADD CONSTRAINT "reconciliation_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
