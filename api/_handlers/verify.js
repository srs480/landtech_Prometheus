// ===== SECTION: GET /api/verify/:deedNo (PUBLIC — QR target; no personal data) =====
import { route, ok, fail, clientIp } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['GET'] }, async (req, res) => {
  if (await Q.hitRate('verify:' + clientIp(req), 60, 10)) return fail(res, 429, 'অনেকবার অনুরোধ করা হয়েছে, কিছুক্ষণ পরে চেষ্টা করুন');
  const no = String(req.query.deedNo || '');
  if (!/^D-\d{4}-\d{4}$/.test(no)) return fail(res, 400, 'দলিল নম্বরের ফরম্যাট সঠিক নয়');
  const r = await Q.verifyDeed(no);
  if (!r) return fail(res, 404, 'এই নম্বরে কোনো দলিল পাওয়া যায়নি');
  ok(res, { valid: r.chain.intact, ...r });
});
