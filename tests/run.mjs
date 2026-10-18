// ===== SECTION: npm test — runs tests/e2e.mjs on a temp copy whose db layer is an in-process Postgres (PGlite) =====
import { cpSync, mkdtempSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'landtech-e2e-'));
cpSync(root, tmp, { recursive: true, filter: (s) => !/[\\/](node_modules|\.git|\.vercel|tests)([\\/]|$)/.test(s.slice(root.length)) });
copyFileSync(join(root, 'tests/pglite-db.js'), join(tmp, 'api/_lib/db.js'));   // swap ONLY the connection layer
copyFileSync(join(root, 'tests/e2e.mjs'), join(tmp, 'e2e.mjs'));
symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'), 'junction');
const r = spawnSync(process.execPath, ['e2e.mjs'], { cwd: tmp, stdio: 'inherit' });
process.exit(r.status ?? 1);
