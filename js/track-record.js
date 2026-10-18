// ===== SECTION: TrackRecord — reusable land timeline (used by ALL portals) =====
// Usage: TrackRecord.render(el, query, { onLocked(el, summary) })   query = { khatian } | { mouza, dag } | ...
const TrackRecord = (() => {
  const h = LT.h;
  const ICON = { sale: '🤝', gift: '🎁', partition: '✂️', mortgage: '🏦', release: '🔓', case: '⚖️', acquisition: '📋',
    mutation: '📝', agreement: '📄', poa: '📜', ownership: '🏠', complaint: '📢' };
  const FLAGS = [['mortgaged', 'ব্যাংক বন্ধক', 'danger'], ['injunction', 'আদালতের নিষেধাজ্ঞা', 'danger'], ['litigated', 'মামলা চলমান', 'danger'],
    ['is_acquired', 'অধিগ্রহণকৃত', 'danger'], ['is_khas', 'খাস জমি', 'warn'], ['mutation_pending', 'নামজারি অপেক্ষমান', 'warn']];

  // ===== SECTION: Land summary card =====
  function summaryCard(land, owners, mortgage) {
    const active = FLAGS.filter(([k]) => land[k]);
    return h('div', { class: 'card' },
      h('h3', {}, `দাগ ${LT.toBn(land.dag_no)} — ${land.mouza}, ${land.upazila}, ${land.district}`),
      h('dl', { class: 'kv' },
        h('dt', {}, 'জমির পরিমাণ'), h('dd', {}, LT.toBn(land.area_decimal) + ' শতাংশ'),
        h('dt', {}, 'জমির ধরন'), h('dd', {}, land.land_type),
        h('dt', {}, 'বর্তমান মালিক'), h('dd', {}, owners.length ? owners.map((o) => `${o.name_bn} (${LT.toBn(o.share_pct)}%)`).join(', ') : 'সরকার (কোনো ব্যক্তিমালিক নেই)'),
        mortgage ? [h('dt', {}, 'বর্তমান ঋণ'), h('dd', {}, `${mortgage.bank} — ${LT.fmtMoney(mortgage.amount)}, ${LT.fmtDate(mortgage.loan_date)}${mortgage.loan_account ? ', হিসাব ' + LT.toBn(mortgage.loan_account) : ''}`)] : ''),
      h('div', {}, active.length ? active.map(([, t, c]) => h('span', { class: 'badge ' + c }, t)) : h('span', { class: 'badge ok' }, '✔ কোনো ঝুঁকি চিহ্ন নেই')));
  }

  // ===== SECTION: Vertical timeline =====
  const timeline = (events) => events.length
    ? h('ol', { class: 'timeline', 'aria-label': 'জমির ইতিহাস' }, events.map((e) => h('li', {},
        h('div', { class: 'tl-head' }, h('span', { 'aria-hidden': 'true' }, ICON[e.event_type] || '•'), h('b', {}, e.title), h('span', { class: 'tl-date' }, LT.fmtDate(e.occurred_on))),
        e.details ? h('div', { class: 'muted' }, e.details) : '', e.actor ? h('div', { class: 'tl-date' }, 'কার্যকর্তা: ' + e.actor) : '')))
    : h('p', { class: 'muted' }, 'এই জমির কোনো ইতিহাস এখনো নথিভুক্ত হয়নি।');

  // ===== SECTION: Render =====
  async function render(box, query, { onLocked } = {}) {
    box.replaceChildren(h('p', { class: 'muted' }, 'তথ্য আনা হচ্ছে…'));
    let r;
    try { r = await LT.api('/api/land/track?' + new URLSearchParams(query)); }
    catch (e) { box.replaceChildren(h('div', { class: 'alert', role: 'alert' }, e.message)); return; }
    if (r.locked) {
      box.replaceChildren(h('div', { class: 'card' }, h('h3', {}, 'জমির সংক্ষিপ্ত তথ্য'),
        h('dl', { class: 'kv' }, h('dt', {}, 'অবস্থান'), h('dd', {}, r.summary.location), h('dt', {}, 'পরিমাণ'), h('dd', {}, LT.toBn(r.summary.area_decimal) + ' শতাংশ'), h('dt', {}, 'ধরন'), h('dd', {}, r.summary.land_type)),
        h('div', { class: 'alert info' }, '🔒 মালিক ও ইতিহাস দেখতে সুরক্ষা টোকেন প্রয়োজন।')));
      if (onLocked) onLocked(box, r.summary);
      return;
    }
    const chain = r.chain.intact
      ? h('span', { class: 'badge ok' }, `✔ ${LT.toBn(r.chain.checked)}টি ইভেন্টের হ্যাশ চেইন অক্ষত`)
      : h('span', { class: 'badge danger' }, `⚠ রেকর্ডে পরিবর্তনের চিহ্ন পাওয়া গেছে (ক্রম: ${r.chain.broken.map(LT.toBn).join(', ')})`);
    box.replaceChildren(summaryCard(r.land, r.owners, r.mortgage), h('h3', { style: 'margin-top:1.2rem' }, 'জমির পূর্ণ ইতিহাস'), chain, timeline(r.timeline));
  }
  return { render };
})();
