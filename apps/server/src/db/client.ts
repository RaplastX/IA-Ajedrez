/**
 * Conexión a la base de datos.
 *  - Producción: PostgreSQL (DATABASE_URL) con node-postgres.
 *  - Desarrollo y tests: PGlite, PostgreSQL compilado a WASM, sin instalar nada.
 * Ambos hablan el mismo dialecto, así que el esquema y las consultas son idénticos.
 */
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import pg from 'pg';
import type { Config } from '../config.js';
import { MIGRATIONS, splitStatements } from './migrations.js';
import { schema } from './schema.js';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Database {
  db: Db;
  close: () => Promise<void>;
  kind: 'postgres' | 'pglite';
}

export async function connectDatabase(
  config: Pick<Config, 'DATABASE_URL' | 'PGLITE_DIR'>,
): Promise<Database> {
  if (config.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
    const db = drizzlePg({ client: pool, schema }) as unknown as Db;
    return { db, kind: 'postgres', close: () => pool.end() };
  }
  const client = new PGlite(config.PGLITE_DIR);
  await client.waitReady;
  const db = drizzlePglite({ client, schema }) as unknown as Db;
  return { db, kind: 'pglite', close: () => client.close() };
}

export async function migrate(db: Db): Promise<string[]> {
  await db.execute(
    sql.raw(
      'CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    ),
  );
  const result = await db.execute<{ id: string }>(sql.raw('SELECT id FROM _migrations'));
  const rows = (Array.isArray(result) ? result : (result as { rows: { id: string }[] }).rows) as {
    id: string;
  }[];
  const done = new Set(rows.map((r) => r.id));
  const applied: string[] = [];
  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) continue;
    await db.transaction(async (tx) => {
      for (const statement of splitStatements(migration.sql)) await tx.execute(sql.raw(statement));
      await tx.execute(sql`INSERT INTO _migrations (id) VALUES (${migration.id})`);
    });
    applied.push(migration.id);
  }
  return applied;
}
