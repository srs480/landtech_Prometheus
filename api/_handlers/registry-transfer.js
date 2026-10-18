// ===== SECTION: POST /api/registry/transfer (registry role only) =====
import { route, ok, fail, toInt, toMoney, isDate } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

// ===== SECTION: Per-deed-type input validation (returns a Bangla message or null) =====
function validate(t, i) {
  const needBuyer = ['sale', 'bayna', 'hiba', 'khas'].includes(t);
  if (needBuyer && !i.buyerId) return 'ক্রেতা/গ্রহীতা নির্বাচন করুন';
  if (['sale', 'bayna', 'rehen'].includes(t) && !i.price) return 'সঠিক মূল্য/ঋণের পরিমাণ দিন';
  if (t === 'bayna' && (!i.advance || !i.deadline)) return 'অগ্রিম টাকা ও মেয়াদ দিন';
  if (t === 'bayna' && i.advance >= i.price) return 'অগ্রিম টাকা মোট মূল্যের চেয়ে কম হতে হবে';
  if (t === 'poa' && !i.attorneyId) return 'আমমোক্তার ব্যক্তি নির্বাচন করুন';
  if (t === 'rehen' && !i.bankId) return 'ব্যাংক নির্বাচন করুন';
  if (t === 'bonton') {
    const sum = i.shares.reduce((a, s) => a + s.pct, 0);
    if (i.shares.length < 2 || i.shares.some((s) => !s.personId || !(s.pct > 0)) || Math.abs(sum - 100) > 0.01) return 'কমপক্ষে দুইজন শরিক এবং অংশের মোট ১০০% হতে হবে';
  }
  return null;
}

export default route({ methods: ['POST'], roles: ['registry'] }, async (req, res, user) => {
  const b = req.body || {};
  if (!Q.DEED_TYPES[b.deedType]) return fail(res, 400, 'দলিলের ধরন সঠিক নয়');
  const plotId = await Q.resolvePlot({ khatian: toInt(b.khatianId) });
  if (!plotId) return fail(res, 404, 'এই খতিয়ানটি খুঁজে পাওয়া যায়নি');
  const input = {
    deedType: b.deedType, plotId, buyerId: toInt(b.buyerId), price: toMoney(b.price), advance: toMoney(b.advance),
    deadline: isDate(b.deadline) ? b.deadline : null, attorneyId: toInt(b.attorneyId), bankId: toInt(b.bankId),
    shares: Array.isArray(b.shares) ? b.shares.slice(0, 10).map((s) => ({ personId: toInt(s?.personId), pct: Number(s?.pct) })) : [],
  };
  const err = validate(b.deedType, input);
  if (err) return fail(res, 400, err);
  ok(res, await Q.registerDeed(user.uid, input), 201);
});
