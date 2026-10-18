// ===== SECTION: Neon connection (the ONLY file that reads DATABASE_URL) =====
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws; // needed for interactive transactions on Node < 22

let _sql, _pool;
function url() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return process.env.DATABASE_URL;
}

// ===== SECTION: Single query (parameterized only) =====
export async function query(text, params = []) {
  _sql ??= neon(url());
  return _sql.query(text, params); // returns array of rows
}

// ===== SECTION: Interactive transaction (use for SELECT ... FOR UPDATE flows) =====
export async function withTx(fn) {
  _pool ??= new Pool({ connectionString: url() });
  const client = await _pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(async (text, params = []) => (await client.query(text, params)).rows);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
