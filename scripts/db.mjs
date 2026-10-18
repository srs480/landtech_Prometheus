// ===== SECTION: Neon database helper — npm run db:setup | db:reset | db:check =====
// Reads DATABASE_URL (or DATABASE_URL_UNPOOLED, preferred for schema changes) from .env — get it with: vercel env pull .env
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'node:fs';
neonConfig.webSocketConstructor = ws;

const cmd = process.argv[2] || 'check';
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('✘ DATABASE_URL পাওয়া যায়নি।\n  সমাধান: প্রজেক্ট ফোল্ডারে চালান  vercel env pull .env\n  (অথবা Neon কনসোল থেকে কানেকশন স্ট্রিং কপি করে .env ফাইলে DATABASE_URL=... লিখুন)');
  process.exit(1);
}
const pool = new Pool({ connectionString: url });
const read = (f) => fs.readFileSync(new URL('../db/' + f, import.meta.url), 'utf8');

// ===== SECTION: Report (row counts + hash-chain integrity of every plot) =====
async function report() {
  const [c] = (await pool.query(`SELECT
      (SELECT count(*) FROM divisions)::int divisions, (SELECT count(*) FROM mouzas)::int mouzas, (SELECT count(*) FROM people)::int people,
      (SELECT count(*) FROM users)::int users, (SELECT count(*) FROM plots)::int plots, (SELECT count(*) FROM khatians)::int khatians,
      (SELECT count(*) FROM deeds)::int deeds, (SELECT count(*) FROM mutations)::int mutations, (SELECT count(*) FROM mortgages)::int mortgages,
      (SELECT count(*) FROM court_cases)::int cases, (SELECT count(*) FROM land_events)::int events, (SELECT count(*) FROM access_tokens)::int tokens`)).rows;
  const [h] = (await pool.query(`WITH e AS (SELECT *, lag(hash) OVER (PARTITION BY plot_id ORDER BY seq) AS ep FROM land_events)
      SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT (hash = event_hash(plot_id, seq, event_type, title, details, occurred_on, prev_hash)
             AND prev_hash = coalesce(ep, 'GENESIS')))::int AS broken FROM e`)).rows;
  console.log('✔ ডাটাবেস সংযুক্ত:', new URL(url).host);
  console.log('  ', Object.entries(c).map(([k, v]) => `${k}=${v}`).join('  '));
  console.log(h.broken === 0 ? `✔ hash chain অক্ষত (${h.total}টি ইভেন্ট)` : `✘ hash chain ভাঙা: ${h.broken}টি ইভেন্ট`);
  if (h.broken) process.exitCode = 1;
}

// ===== SECTION: Commands =====
async function main() {
  if (cmd === 'setup' || cmd === 'reset') {
    const exists = (await pool.query("SELECT to_regclass('public.plots') AS t")).rows[0].t;
    if (exists && cmd === 'setup') {
      console.log('ℹ ডাটাবেসে টেবিল ইতিমধ্যে আছে, তাই কিছু বদলানো হয়নি।\n  সব মুছে নতুন করে বানাতে চালান: npm run db:reset');
    } else {
      console.log('→ schema.sql চালানো হচ্ছে…'); await pool.query(read('schema.sql'));
      console.log('→ seed.sql চালানো হচ্ছে…'); await pool.query(read('seed.sql'));
    }
  } else if (cmd !== 'check') { console.error('অজানা কমান্ড। ব্যবহার: setup | reset | check'); process.exit(1); }
  await report();
}
main().catch((e) => { console.error('✘', e.message); process.exitCode = 1; }).finally(() => pool.end());
