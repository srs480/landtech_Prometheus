// ===== SECTION: Preflight — run before every push: npm run check =====
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
const bad = (m) => { errors++; console.log('  ✘ ' + m); }, good = (m) => console.log('  ✔ ' + m);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.name.startsWith('_') || e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

// ===== SECTION: 1. Serverless function count (Vercel Hobby allows at most 12 per deployment) =====
console.log('১. ফাংশন সংখ্যা');
const fns = walk(path.join(root, 'api')).filter((f) => /\.(js|mjs|cjs|ts)$/.test(f));
fns.forEach((f) => console.log('     ' + path.relative(root, f).replaceAll('\\', '/')));
if (fns.length > 12) bad(`${fns.length}টি ফাংশন — Hobby প্ল্যানে সর্বোচ্চ ১২টি। নতুন route আলাদা ফাইলে না রেখে বিদ্যমান dispatcher-এ যোগ করুন`);
else if (fns.length > 10) good(`${fns.length}টি ফাংশন (সীমা ১২; জায়গা প্রায় শেষ — নতুন route dispatcher-এ যোগ করুন)`);
else good(`${fns.length}টি ফাংশন (সীমা ১২)`);

// ===== SECTION: 2. vercel.json rewrites point to real functions =====
console.log('২. rewrites');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rules = (cfg.rewrites || []).map((r) => ({ re: new RegExp('^' + r.source.replace(/:(\w+)/g, '[^/]+') + '$'), src: r.source, dest: r.destination.split('?')[0] }));
for (const r of rules) if (!fns.some((f) => f.replaceAll('\\', '/').endsWith(r.dest + '.js'))) bad(`${r.src} → ${r.dest}: ফাইল নেই`);
if (!errors) good(`${rules.length}টি rewrite সঠিক ফাংশনে যায়`);

// ===== SECTION: 3. Every /api/... URL used by the frontend is served =====
console.log('৩. ফ্রন্টএন্ডের API URL');
const pages = [...walk(root).filter((f) => /\.(html|js)$/.test(f) && !/[\\/](api|scripts|tests)[\\/]/.test(f))];
const used = new Set();
for (const f of pages) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\/api\/[A-Za-z0-9_\-/.${}]+/g)) used.add(m[0].replace(/\$\{[^}]*\}/g, 'x').replace(/\.+$/, '').replace(/\/$/, '/x'));
const IGNORE = new Set(['/api/chat']);   // future chatbot hook
let before = errors;
for (const u of [...used].sort()) {
  if (IGNORE.has(u)) continue;
  const served = rules.some((r) => r.re.test(u)) || fns.some((f) => f.replaceAll('\\', '/').endsWith(u.slice(1) + '.js'));
  if (!served) bad(`${u} — কোনো ফাংশন/rewrite নেই`);
}
if (errors === before) good(`${used.size}টি URL-ই পরিবেশিত হচ্ছে`);

// ===== SECTION: 4. Syntax =====
console.log('৪. সিনট্যাক্স');
before = errors;
for (const f of [...fns, ...walk(path.join(root, 'api')).filter(Boolean), ...walk(path.join(root, 'js')), ...walk(path.join(root, 'scripts'))].filter((f) => /\.m?js$/.test(f))) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) bad(path.relative(root, f) + '\n' + r.stderr.split('\n').slice(0, 3).join('\n'));
}
if (errors === before) good('সব JS ফাইল ঠিক আছে');
console.log(errors ? `\n✘ ${errors}টি সমস্যা। ঠিক না করে push করবেন না।` : '\n✔ সব ঠিক আছে — নিশ্চিন্তে push করুন।');
process.exit(errors ? 1 : 0);
