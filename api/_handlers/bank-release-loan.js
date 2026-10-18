// ===== SECTION: POST /api/bank/release-loan (bank role; own loans only) =====
import { route, ok, fail, toInt, isDate } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['POST'], roles: ['bank'] }, async (req, res, user) => {
  const b = req.body || {};
  const plotId = await Q.resolvePlot({ khatian: toInt(b.khatianId) });
  if (!plotId) return fail(res, 404, 'এই খতিয়ানটি খুঁজে পাওয়া যায়নি');
  if (!isDate(b.releaseDate)) return fail(res, 400, 'মুক্তির তারিখ দিন');
  ok(res, await Q.releaseLoan(user.uid, { plotId, releaseDate: b.releaseDate, remarks: String(b.remarks || '').slice(0, 300) }));
});
