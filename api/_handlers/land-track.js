// ===== SECTION: GET /api/land/track?khatian= | ?mouza=&type=&no= | ?mouza=&dag= =====
// Citizen role: token (header x-land-token) required for owner + history details.
import { route, ok, fail, toInt, ALL_ROLES } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['GET'], roles: ALL_ROLES }, async (req, res, user) => {
  const { khatian, mouza, type, no, dag } = req.query;
  const plotId = await Q.resolvePlot({
    khatian: toInt(khatian), mouza: toInt(mouza),
    type: type && String(type).toUpperCase(), no: no && String(no), dag: dag && String(dag),
  });
  if (!plotId) return fail(res, 404, 'এই জমির কোনো তথ্য পাওয়া যায়নি');
  const d = await Q.plotDetail(plotId);
  const full = user.role !== 'citizen' || (await Q.validateToken(req.headers['x-land-token']));
  if (!full) return ok(res, { locked: true, summary: Q.publicSummary(d) });
  const [owners, events, chain] = await Promise.all([Q.currentOwners(plotId), Q.timeline(plotId), Q.verifyChain(plotId)]);
  const mortgage = await Q.activeMortgage(plotId, user.uid);
  ok(res, { locked: false, land: d, owners, mortgage, timeline: events, chain, checks: Q.blockReasons(d) });
});
