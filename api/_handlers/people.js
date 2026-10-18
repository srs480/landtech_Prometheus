// ===== SECTION: GET /api/people?q=  (search by name/NID; NID is masked in results) =====
import { route, ok, fail } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['GET'], roles: ['registry', 'bank'] }, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return fail(res, 400, 'অন্তত ২টি অক্ষর লিখে খুঁজুন');
  ok(res, { items: await Q.searchPeople(q.slice(0, 40)) });
});
