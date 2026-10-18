process.env.JWT_SECRET = 'test-secret';
import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const rules = cfg.rewrites.map((r) => ({ re: new RegExp('^' + r.source.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), dest: r.destination }));
const cache = {};
// emulate Vercel: apply rewrite, merge query (source query kept), call the function's default export
async function call(method, url, { body, cookie, headers = {} } = {}) {
  const [path, qs = ''] = url.split('?'); const query = Object.fromEntries(new URLSearchParams(qs));
  let fn = null;
  for (const r of rules) { const m = path.match(r.re); if (m) { const d = r.dest.replace(/:(\w+)/g, (_, k) => m.groups[k]); const [dp, dq = ''] = d.split('?'); Object.assign(query, Object.fromEntries(new URLSearchParams(dq))); fn = dp; break; } }
  if (!fn) fn = path;                                       // direct file (e.g. /api/ocr-check)
  const mod = (cache[fn] ??= await import(`./${fn.slice(1)}.js`));
  const req = { method, query, body, headers: { ...(cookie ? { cookie } : {}), ...headers } };
  return new Promise((resolve) => { const res = { h: {}, status(c) { this.code = c; return this; }, setHeader(k, v) { this.h[k] = v; }, json(o) { resolve({ code: this.code || 200, body: o, cookie: (this.h['Set-Cookie'] || '').split(';')[0] }); } }; mod.default(req, res); });
}
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  ✔ ' : '  ✘ FAIL ') + name + (cond ? '' : ' ' + extra)); };
const login = async (u, portal) => (await call('POST', '/api/auth/login', { body: { username: u, password: 'Demo@1234', portal } }));
const A = { registry: 'registrar_demo', bank: 'bank_demo', dc: 'dc_demo', court: 'lawyer_demo', citizen: 'citizen_demo' };
const ck = {};

console.log('AUTH');
for (const [role, u] of Object.entries(A)) { const r = await login(u, role); ck[role] = r.cookie; t(`login ${role}`, r.code === 200 && r.body.redirect === `/portal/${role}.html` && ck[role].startsWith('lt_session='), JSON.stringify(r.body)); }
t('wrong portal -> 403', (await login('bank_demo', 'registry')).code === 403);
t('wrong password -> 401', (await call('POST', '/api/auth/login', { body: { username: 'bank_demo', password: 'x', portal: 'bank' } })).code === 401);
t('GET login -> 405', (await call('GET', '/api/auth/login')).code === 405);
t('me', (await call('GET', '/api/auth/me', { cookie: ck.registry })).body.user.office_code === 'SR-1001');
t('me without cookie -> 401', (await call('GET', '/api/auth/me')).code === 401);
t('unknown action -> 404', (await call('GET', '/api/auth/nothing')).code === 404);

console.log('LOOKUPS');
t('divisions', (await call('GET', '/api/geo/divisions', { cookie: ck.registry })).body.items.length === 4);
t('districts?division=3', (await call('GET', '/api/geo/districts?division=3', { cookie: ck.bank })).body.items.length === 2);
t('upazilas', (await call('GET', '/api/geo/upazilas?district=1', { cookie: ck.dc })).body.items.length === 1);
t('mouzas', (await call('GET', '/api/geo/mouzas?upazila=1', { cookie: ck.court })).body.items.length === 2);
t('geo needs login', (await call('GET', '/api/geo/divisions')).code === 401);
t('khatians?mouza=1&type=RS', (await call('GET', '/api/khatians?mouza=1&type=RS', { cookie: ck.registry })).body.items.length === 2);
t('people search', (await call('GET', '/api/people?q=' + encodeURIComponent('আবির'), { cookie: ck.registry })).body.items[0]?.nid_masked === '*********0002');
t('people: citizen forbidden', (await call('GET', '/api/people?q=ab', { cookie: ck.citizen })).code === 403);
t('banks', (await call('GET', '/api/banks', { cookie: ck.registry })).body.items.length === 1);

console.log('KHATIAN CHECKS (blocking rules)');
const kh = async (id, deed = 'sale', c = ck.registry) => (await call('GET', `/api/khatian/${id}?deed=${deed}`, { cookie: c })).body;
t('1 clean', (await kh(1)).checks.blocks.length === 0);
t('2 mortgaged blocked', (await kh(2)).checks.blocks.some((b) => b.includes('বন্ধক')));
t('3 injunction blocked', (await kh(3)).checks.blocks.some((b) => b.includes('নিষেধাজ্ঞা')));
t('4 khas blocked for sale', (await kh(4)).checks.blocks.some((b) => b.includes('খাস')));
t('4 khas OK for khas-deed', (await kh(4, 'khas')).checks.blocks.length === 0);
t('1 NOT khas -> khas-deed blocked', (await kh(1, 'khas')).checks.blocks.some((b) => b.includes('খাস জমি নয়')));
t('5 acquired blocked', (await kh(5)).checks.blocks.some((b) => b.includes('অধিগ্রহণ')));
t('6 pending mutation blocked', (await kh(6)).checks.blocks.some((b) => b.includes('নামজারি')));
t('nid masked in owners', (await kh(1)).owners[0].nid_masked === '*********0001');
t('bad khatian id -> 404', (await call('GET', '/api/khatian/999', { cookie: ck.registry })).code === 404);

console.log('TRACK + HASH CHAIN');
let tr = (await call('GET', '/api/land/track?khatian=1', { cookie: ck.court })).body;
t('timeline of plot 1 = 2 events, chain intact', tr.timeline.length === 2 && tr.chain.intact === true && tr.chain.checked === 2, JSON.stringify(tr.chain));
t('track by dag', (await call('GET', '/api/land/track?mouza=1&dag=102', { cookie: ck.dc })).body.land.dag_no === '102');
t('track by mouza+type+no', (await call('GET', '/api/land/track?mouza=1&type=CS&no=45', { cookie: ck.dc })).body.land.injunction === true);
t('active mortgage visible (loan acct hidden from non-owner bank)', (await call('GET', '/api/land/track?khatian=2', { cookie: ck.court })).body.mortgage.loan_account == null);
t('mortgage owner bank sees account', (await call('GET', '/api/land/track?khatian=2', { cookie: ck.bank })).body.mortgage.loan_account === 'LN-DEMO-0001');
let threw = false; try { await (await import('./api/_lib/db.js')).query("UPDATE land_events SET title='hacked' WHERE id=1"); } catch { threw = true; } t('land_events is append-only (UPDATE rejected)', threw);

console.log('CITIZEN TOKEN GATE');
let c1 = (await call('GET', '/api/land/track?khatian=1', { cookie: ck.citizen })).body;
t('no token -> locked, no owner/history', c1.locked === true && !c1.owners && !c1.timeline && c1.summary.area_decimal);
t('khatian detail locked too', (await kh(1, 'sale', ck.citizen)).locked === true);
t('forged header w/o unlock -> locked', (await call('GET', '/api/land/track?khatian=1', { cookie: ck.citizen, headers: { 'x-land-token': 'LAND-DEMO-1111' } })).body.locked === true);
t('invalid token', (await call('POST', '/api/citizen/unlock', { cookie: ck.citizen, body: { token: 'NOPE-NOPE' } })).body.error === 'টোকেনটি সঠিক নয়');
t('expired token', (await call('POST', '/api/citizen/unlock', { cookie: ck.citizen, body: { token: 'LAND-DEMO-9999' } })).body.error.includes('মেয়াদ'));
t('registry cannot unlock (role)', (await call('POST', '/api/citizen/unlock', { cookie: ck.registry, body: { token: 'LAND-DEMO-1111' } })).code === 403);
const un = await call('POST', '/api/citizen/unlock', { cookie: ck.citizen, body: { token: 'land-demo-1111' } });
t('valid token (case-insensitive), 19 uses left', un.body.ok && un.body.remaining === 19, JSON.stringify(un.body));
c1 = (await call('GET', '/api/land/track?khatian=1', { cookie: ck.citizen, headers: { 'x-land-token': 'LAND-DEMO-1111' } })).body;
t('token unlocks owners+timeline', c1.locked === false && c1.owners.length === 1 && c1.timeline.length === 2);

console.log('TRANSFERS (one transaction each)');
const tx = (body, c = ck.registry) => call('POST', '/api/registry/transfer', { cookie: c, body });
let r = await tx({ deedType: 'sale', khatianId: 1, buyerId: 3, price: '1200000' });
t('sale ok', r.code === 201 && /^D-\d{4}-\d{4}$/.test(r.body.deedNo) && /^M-/.test(r.body.mutationNo) && r.body.status.owners[0].name === 'বকুল আক্তার', JSON.stringify(r.body));
const saleDeed = r.body.deedNo;
tr = (await call('GET', '/api/land/track?khatian=1', { cookie: ck.court })).body;
t('timeline grew by 2 (sale + auto mutation), chain intact, owner changed', tr.timeline.length === 4 && tr.chain.intact && tr.owners[0].name_bn === 'বকুল আক্তার', JSON.stringify(tr.chain));
t('mutation list has it (completed)', (await call('GET', '/api/registry/mutations', { cookie: ck.registry })).body.items.some((m) => m.mutation_no === r.body.mutationNo && m.status === 'completed'));
t('sell to current owner rejected', (await tx({ deedType: 'sale', khatianId: 1, buyerId: 3, price: 1000 })).code === 400);
t('sale on mortgaged plot -> 409', (await tx({ deedType: 'sale', khatianId: 2, buyerId: 1, price: 5000 })).code === 409);
t('sale on injunction plot -> 409', (await tx({ deedType: 'sale', khatianId: 3, buyerId: 1, price: 5000 })).code === 409);
t('sale on pending-mutation plot (double-sale) -> 409', (await tx({ deedType: 'sale', khatianId: 6, buyerId: 1, price: 5000 })).code === 409);
t('sale missing price -> 400', (await tx({ deedType: 'sale', khatianId: 8, buyerId: 1 })).code === 400);
t('bayna: no mutation, ownership unchanged', await (async () => { const b = await tx({ deedType: 'bayna', khatianId: 8, buyerId: 1, price: 500000, advance: 100000, deadline: '2026-12-31' }); return b.code === 201 && b.body.mutationNo === null && b.body.status.owners[0].name === 'জাহিদ হোসেন'; })());
t('poa recorded', (await tx({ deedType: 'poa', khatianId: 8, attorneyId: 1 })).code === 201);
t('hiba', (await tx({ deedType: 'hiba', khatianId: 10, buyerId: 1 })).body.status.owners[0].name === 'কুদ্দুস মিয়া');
t('partition: shares must total 100', (await tx({ deedType: 'bonton', khatianId: 7, shares: [{ personId: 6, pct: 60 }, { personId: 7, pct: 30 }] })).code === 400);
r = await tx({ deedType: 'bonton', khatianId: 7, shares: [{ personId: 6, pct: 60 }, { personId: 7, pct: 40 }] });
t('partition ok (60/40)', r.code === 201 && r.body.status.owners.length === 2, JSON.stringify(r.body));
t('partition by non co-owner rejected', (await tx({ deedType: 'bonton', khatianId: 7, shares: [{ personId: 1, pct: 50 }, { personId: 6, pct: 50 }] })).code === 400);
r = await tx({ deedType: 'khas', khatianId: 4, buyerId: 8 });
t('khas settlement ok -> no longer khas', r.code === 201 && r.body.status.is_khas === false, JSON.stringify(r.body));
r = await tx({ deedType: 'rehen', khatianId: 9, bankId: 2, price: 700000 });
t('rehen deed creates active mortgage', r.code === 201 && r.body.status.mortgaged === true && r.body.mutationNo === null, JSON.stringify(r.body));
t('rehen again blocked (already mortgaged)', (await tx({ deedType: 'rehen', khatianId: 9, bankId: 2, price: 1000 })).code === 409);

console.log('ROLE BYPASS ATTEMPTS');
t('bank cannot transfer', (await tx({ deedType: 'sale', khatianId: 8, buyerId: 1, price: 1 }, ck.bank)).code === 403);
t('citizen cannot transfer', (await tx({ deedType: 'sale', khatianId: 8, buyerId: 1, price: 1 }, ck.citizen)).code === 403);
t('anonymous cannot transfer', (await tx({ deedType: 'sale', khatianId: 8, buyerId: 1, price: 1 }, null)).code === 401);
t('registry cannot mark loan', (await call('POST', '/api/bank/mark-loan', { cookie: ck.registry, body: {} })).code === 403);
t('dc/court cannot read mutations', (await call('GET', '/api/registry/mutations', { cookie: ck.court })).code === 403);
t('forged cookie rejected', (await call('GET', '/api/auth/me', { cookie: 'lt_session=abc.def.ghi' })).code === 401);

console.log('BANK LOANS');
const mark = (b, c = ck.bank) => call('POST', '/api/bank/mark-loan', { cookie: c, body: b });
t('mark: rehen-mortgaged plot -> 409', (await mark({ khatianId: 9, borrowerId: 9, amount: 1, loanDate: '2026-10-18', loanAccount: 'LN-X-0001' })).code === 409);
t('mark: borrower must be current owner', (await mark({ khatianId: 8, borrowerId: 1, amount: 100000, loanDate: '2026-10-18', loanAccount: 'LN-X-0002' })).code === 400);
t('mark: khas/acquired plot refused', (await mark({ khatianId: 5, borrowerId: 4, amount: 100000, loanDate: '2026-10-18', loanAccount: 'LN-X-0003' })).code === 409);
t('mark: bad loan account -> 400', (await mark({ khatianId: 8, borrowerId: 8, amount: 100000, loanDate: '2026-10-18', loanAccount: '!!' })).code === 400);
r = await mark({ khatianId: 8, borrowerId: 8, amount: 250000, loanDate: '2026-10-18', loanAccount: 'LN-DEMO-0002', remarks: 'টেস্ট' });
t('mark ok', r.code === 201 && r.body.mortgageId > 0, JSON.stringify(r.body));
t('double mark -> 409 with clear message', (await mark({ khatianId: 8, borrowerId: 8, amount: 1, loanDate: '2026-10-18', loanAccount: 'LN-DEMO-0003' })).body.error.includes('ইতিমধ্যে বন্ধক'));
t('sale now blocked (mortgage)', (await tx({ deedType: 'sale', khatianId: 8, buyerId: 1, price: 1 })).code === 409);
const rel = (b, c = ck.bank) => call('POST', '/api/bank/release-loan', { cookie: c, body: b });
t('release before loan date -> 400', (await rel({ khatianId: 8, releaseDate: '2020-01-01' })).code === 400);
t('release ok', (await rel({ khatianId: 8, releaseDate: '2026-10-19', remarks: 'শোধ' })).code === 200);
t('release again -> 404 (no active)', (await rel({ khatianId: 8, releaseDate: '2026-10-19' })).code === 404);
t('history kept: released row not deleted', (await (await import('./api/_lib/db.js')).query("SELECT status, release_date FROM mortgages WHERE loan_account='LN-DEMO-0002'"))[0].status === 'released');
t('sale possible again after release', (await tx({ deedType: 'sale', khatianId: 8, buyerId: 1, price: 111111 })).code === 201);
tr = (await call('GET', '/api/land/track?khatian=8', { cookie: ck.dc })).body;
t('plot 8 chain intact w/ mortgage+release+sale events', tr.chain.intact && tr.timeline.some((e) => e.event_type === 'release'), JSON.stringify(tr.chain));

console.log('VERIFY (public) + OCR STUB + RATE LIMIT');
let v = await call('GET', `/api/verify/${saleDeed}`);
t('verify new deed, chain intact', v.body.ok && v.body.valid === true && !JSON.stringify(v.body).includes('বকুল'), JSON.stringify(v.body).slice(0, 120));
t('verify seed deed D-2018-0001', (await call('GET', '/api/verify/D-2018-0001')).body.deed.deed_type === 'সাফ কবলা');
t('verify unknown -> 404', (await call('GET', '/api/verify/D-2099-9999')).code === 404);
t('verify bad format -> 400', (await call('GET', '/api/verify/abc')).code === 400);
t('ocr-check stub', (await call('POST', '/api/ocr-check', { body: {} })).body.stub === true);
let last; for (let i = 0; i < 22; i++) last = await call('POST', '/api/auth/login', { body: { username: 'x', password: 'y', portal: 'bank' } });
t('login rate limit -> 429', last.code === 429);
const audits = await (await import('./api/_lib/db.js')).query("SELECT action, count(*)::int n FROM audit_logs GROUP BY action ORDER BY action");
console.log('  audit actions:', audits.map((a) => `${a.action}=${a.n}`).join(', '));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);

process.exit(fail ? 1 : 0);
