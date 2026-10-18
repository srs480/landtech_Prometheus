// ===== SECTION: Live smoke test (read-only) — npm run smoke -- https://your-app.vercel.app =====
// Uses one citizen token use (LAND-DEMO-1111). Does NOT create deeds or loans.
const base = (process.argv[2] || process.env.SMOKE_URL || '').replace(/\/$/, '');
if (!base) { console.error('ব্যবহার: npm run smoke -- https://আপনার-অ্যাপ.vercel.app'); process.exit(1); }
let pass = 0, fail = 0;
const t = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? '  ✔ ' : '  ✘ ') + name + (cond ? '' : '  → ' + extra)); };
async function api(method, path, { body, cookie, headers } = {}) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* not JSON */ }
  return { code: r.status, body: j, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const home = await fetch(base + '/index.html'); t('হোমপেজ খোলে', home.status === 200, home.status);
t('নাগরিক সেবা খোলে', (await fetch(base + '/nagorik-seba.html')).status === 200);
const ck = {};
for (const [role, u] of Object.entries({ registry: 'registrar_demo', bank: 'bank_demo', dc: 'dc_demo', court: 'lawyer_demo', citizen: 'citizen_demo' })) {
  const r = await api('POST', '/api/auth/login', { body: { username: u, password: 'Demo@1234', portal: role } });
  ck[role] = r.cookie; t(`লগইন: ${role}`, r.code === 200 && !!r.cookie, `${r.code} ${JSON.stringify(r.body)}`);
}
t('বিভাগ তালিকা (ডাটাবেস সংযুক্ত)', (await api('GET', '/api/geo/divisions', { cookie: ck.registry })).body?.items?.length === 4);
t('বন্ধকি খতিয়ানে ব্লক', (await api('GET', '/api/khatian/2?deed=sale', { cookie: ck.registry })).body?.checks?.blocks?.length > 0);
t('ট্র্যাক রেকর্ড + hash chain', (await api('GET', '/api/land/track?khatian=1', { cookie: ck.court })).body?.chain?.intact === true);
t('নাগরিক: টোকেন ছাড়া লক', (await api('GET', '/api/land/track?khatian=1', { cookie: ck.citizen })).body?.locked === true);
t('নাগরিক: টোকেন আনলক', (await api('POST', '/api/citizen/unlock', { cookie: ck.citizen, body: { token: 'LAND-DEMO-1111' } })).body?.ok === true);
t('ভূমিকা-লঙ্ঘন ঠেকানো (bank → transfer = 403)', (await api('POST', '/api/registry/transfer', { cookie: ck.bank, body: {} })).code === 403);
t('পাবলিক দলিল যাচাই', (await api('GET', '/api/verify/D-2018-0001')).body?.valid === true);
t('OCR স্টাব', (await api('POST', '/api/ocr-check', { body: {} })).body?.stub === true);
console.log(`\nফলাফল: ${pass} পাস, ${fail} ফেল`); process.exit(fail ? 1 : 0);
