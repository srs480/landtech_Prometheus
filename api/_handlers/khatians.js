// ===== SECTION: GET /api/khatians?mouza=&type= =====
import { route, ok, fail, toInt, ALL_ROLES } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['GET'], roles: ALL_ROLES }, async (req, res) => {
  const mouza = toInt(req.query.mouza);
  const type = String(req.query.type || '').toUpperCase();
  if (!mouza || !['CS', 'RS', 'SA', 'BRS'].includes(type)) return fail(res, 400, 'মৌজা ও খতিয়ানের ধরন নির্বাচন করুন');
  ok(res, { items: await Q.khatiansByMouza(mouza, type) });
});
