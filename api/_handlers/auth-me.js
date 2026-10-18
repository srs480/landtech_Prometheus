// ===== SECTION: GET /api/auth/me =====
import { route, ok, fail, ALL_ROLES } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['GET'], roles: ALL_ROLES }, async (req, res, user) => {
  const p = await Q.profile(user.uid);
  if (!p) return fail(res, 401, 'অনুগ্রহ করে আবার লগইন করুন');
  ok(res, { user: p });
});
