import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Parity with the owner's vehicle-control sheet: the five of its columns that had nowhere to go.
//
// `exemptions` is a jsonb array of scheduled inspection types the car will never have — the
// przyczepa's przegląd is „bezterminowo". Separate from `flags` because it is a permanent property
// of the car, not a mark that clears itself once the work is recorded.
//
// `cost` goes back to nullable, partly reversing 20260824_1: the sheet carries no prices, so a
// required column would have written nine „0 zł" that mean „nobody knows". Unknown renders „—" now.
//
// ADD VALUE is legal inside the transactional runner as long as the new value is not USED in the
// same transaction — it is not; the first ODOMETER row comes from the import afterwards.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_vehicle_inspections_type" ADD VALUE IF NOT EXISTS 'ODOMETER';

    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "tyres" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "note" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "exemptions" jsonb;

    ALTER TABLE "vehicle_inspections" ADD COLUMN IF NOT EXISTS "insurer" varchar;
    ALTER TABLE "vehicle_inspections" ADD COLUMN IF NOT EXISTS "policy_number" varchar;
    ALTER TABLE "vehicle_inspections" ALTER COLUMN "cost" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres cannot remove an enum value; 'ODOMETER' stays. Restoring the NOT NULL needs the same
  // backfill 20260824_1 did — a row created while cost was optional has no price to restore.
  await db.execute(sql`
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "tyres";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "note";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "exemptions";

    ALTER TABLE "vehicle_inspections" DROP COLUMN IF EXISTS "insurer";
    ALTER TABLE "vehicle_inspections" DROP COLUMN IF EXISTS "policy_number";
    UPDATE "vehicle_inspections" SET "cost" = 0 WHERE "cost" IS NULL;
    ALTER TABLE "vehicle_inspections" ALTER COLUMN "cost" SET NOT NULL;
  `)
}
