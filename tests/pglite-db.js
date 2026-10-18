import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
export const db = new PGlite({ extensions: { pgcrypto } });
let ready;
const init = () => (ready ??= (async () => { await db.exec(fs.readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')); await db.exec(fs.readFileSync(new URL('../../db/seed.sql', import.meta.url), 'utf8')); })());
export async function query(t, p = []) { await init(); return (await db.query(t, p)).rows; }
export async function withTx(fn) {
  await init(); await db.query('BEGIN');
  try { const out = await fn(async (t, p = []) => (await db.query(t, p)).rows); await db.query('COMMIT'); return out; }
  catch (e) { await db.query('ROLLBACK'); throw e; }
}
