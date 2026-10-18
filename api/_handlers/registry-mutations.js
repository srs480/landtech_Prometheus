// ===== SECTION: GET /api/registry/mutations (view only) =====
import { route, ok } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['GET'], roles: ['registry'] }, async (req, res) => {
  ok(res, { items: await Q.mutationList() });
});
