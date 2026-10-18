// ===== SECTION: GET /api/banks  (for the mortgage-deed bank dropdown) =====
import { route, ok } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['GET'], roles: ['registry'] }, async (req, res) => {
  ok(res, { items: await Q.banks() });
});
