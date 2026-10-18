// ===== SECTION: GET /api/khatian/:id  (details + blocking checks) =====
// Citizen role without a valid token gets ONLY the public summary.
import { route, ok, fail, toInt, ALL_ROLES } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['GET'], roles: ALL_ROLES }, async (req, res, user) => {
  const plotId = await Q.resolvePlot({ khatian: toInt(req.query.id) });
  if (!plotId) return fail(res, 404, 'এই খতিয়ানটি খুঁজে পাওয়া যায়নি');
  const d = await Q.plotDetail(plotId);
  const full = user.role !== 'citizen' || (await Q.validateToken(req.headers['x-land-token']));
  if (!full) return ok(res, { locked: true, summary: Q.publicSummary(d) });
  const [owners, khatians] = await Promise.all([Q.currentOwners(plotId), Q.plotKhatians(plotId)]);
  const mortgage = await Q.activeMortgage(plotId, user.uid);
  ok(res, { locked: false, land: d, owners, mortgage, khatians, checks: Q.blockReasons(d, Q.DEED_TYPES[req.query.deed] ? req.query.deed : 'sale') });
});
