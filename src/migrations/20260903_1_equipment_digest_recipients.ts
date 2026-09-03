import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Fourth address list on the `notification-recipients` global, same shape as the three from
// 20260826_0. Seeded, because `minRows: 1` can never fire on a row that was never created and an
// unseeded list would make the first warranty sweep throw instead of mailing.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "notification_recipients_equipment_digest" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "notification_recipients"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY,
      "email" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "notification_recipients_equipment_digest_order_idx"
      ON "notification_recipients_equipment_digest" ("_order");
    CREATE INDEX IF NOT EXISTS "notification_recipients_equipment_digest_parent_id_idx"
      ON "notification_recipients_equipment_digest" ("_parent_id");

    INSERT INTO "notification_recipients_equipment_digest" ("_order", "_parent_id", "id", "email")
      VALUES
        (1, 1, 'seed_equipment_digest_1', 'bartek@wykonczymy.com.pl'),
        (2, 1, 'seed_equipment_digest_2', 'admin@wykonczymy.com.pl')
      ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "notification_recipients_equipment_digest";
  `)
}
