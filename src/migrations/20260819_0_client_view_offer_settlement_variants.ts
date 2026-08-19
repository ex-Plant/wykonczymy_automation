import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The client preview stops being one column set per investment: `variants` holds both the offer and
// the settlement set at once, `mode` says which one the client's link serves.
// No backfill — nobody has ticked a variant yet (owner, 2026-08-19), so the old pair is simply
// dropped and the new columns start empty; `sanitizeClientViewConfig` answers an empty row with the
// code defaults.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_kosztorys_client_view_mode" AS ENUM('OFFER', 'SETTLEMENT');
    CREATE TYPE "public"."enum_kosztorys_client_view_defaults_mode" AS ENUM('OFFER', 'SETTLEMENT');

    ALTER TABLE "kosztorys_client_view"
      DROP COLUMN IF EXISTS "hidden_columns",
      DROP COLUMN IF EXISTS "hide_empty_rows",
      ADD COLUMN IF NOT EXISTS "mode" "enum_kosztorys_client_view_mode" NOT NULL DEFAULT 'OFFER',
      ADD COLUMN IF NOT EXISTS "variants" jsonb DEFAULT '{}'::jsonb;

    ALTER TABLE "kosztorys_client_view_defaults"
      DROP COLUMN IF EXISTS "hidden_columns",
      DROP COLUMN IF EXISTS "hide_empty_rows",
      ADD COLUMN IF NOT EXISTS "mode" "enum_kosztorys_client_view_defaults_mode" NOT NULL DEFAULT 'OFFER',
      ADD COLUMN IF NOT EXISTS "variants" jsonb DEFAULT '{}'::jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_client_view"
      DROP COLUMN IF EXISTS "mode",
      DROP COLUMN IF EXISTS "variants",
      ADD COLUMN IF NOT EXISTS "hidden_columns" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "hide_empty_rows" boolean NOT NULL DEFAULT true;

    ALTER TABLE "kosztorys_client_view_defaults"
      DROP COLUMN IF EXISTS "mode",
      DROP COLUMN IF EXISTS "variants",
      ADD COLUMN IF NOT EXISTS "hidden_columns" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "hide_empty_rows" boolean NOT NULL DEFAULT true;

    DROP TYPE IF EXISTS "public"."enum_kosztorys_client_view_defaults_mode";
    DROP TYPE IF EXISTS "public"."enum_kosztorys_client_view_mode";
  `)
}
