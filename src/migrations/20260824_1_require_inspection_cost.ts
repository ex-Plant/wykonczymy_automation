import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-729: „Koszt" becomes required on a przegląd. Without it the fleet listing's new cost column
// would render one `0 zł` for two different claims — „it cost nothing" and „nobody typed a price".
// The column can only tell the truth once the source cannot be left empty.
//
// The backfill turns „unknown" into „zero" and is not reversible, so a human checks the affected
// count before running this against prod:
//   SELECT count(*) FROM vehicle_inspections WHERE cost IS NULL;
//
// DEPLOY ORDER IS THE REVERSE OF AGENTS.md's DEFAULT, as for every destructive migration: ship the
// code first, migrate second. The constraint is what the OLD code breaks against — it still submits
// an absent cost; the new code always sends a number.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "vehicle_inspections" SET "cost" = 0 WHERE "cost" IS NULL;

    ALTER TABLE "vehicle_inspections" ALTER COLUMN "cost" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Only the constraint comes off — a backfilled zero is indistinguishable from a typed one.
  await db.execute(sql`
    ALTER TABLE "vehicle_inspections" ALTER COLUMN "cost" DROP NOT NULL;
  `)
}
