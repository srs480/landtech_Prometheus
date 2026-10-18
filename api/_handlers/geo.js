// ===== SECTION: GET /api/geo/divisions|districts|upazilas|mouzas =====
// districts?division=ID  upazilas?district=ID  mouzas?upazila=ID
import { route, ok, fail, toInt, ALL_ROLES } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

const KINDS = {
  divisions: () => Q.divisions(),
  districts: (q) => toInt(q.division) && Q.districts(toInt(q.division)),
  upazilas: (q) => toInt(q.district) && Q.upazilas(toInt(q.district)),
  mouzas: (q) => toInt(q.upazila) && Q.mouzas(toInt(q.upazila)),
};

export default route({ methods: ['GET'], roles: ALL_ROLES }, async (req, res) => {
  const fn = KINDS[req.query.kind];
  if (!fn) return fail(res, 404, 'অনুরোধকৃত তথ্য পাওয়া যায়নি');
  const rows = await fn(req.query);
  if (!rows) return fail(res, 400, 'প্রয়োজনীয় তথ্য দেওয়া হয়নি');
  ok(res, { items: rows });
});
