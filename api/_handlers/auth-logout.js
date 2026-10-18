// ===== SECTION: POST /api/auth/logout =====
import { route, ok, clearSession } from '../_lib/http.js';

export default route({ methods: ['POST'] }, async (req, res) => {
  clearSession(res);
  ok(res, { redirect: '/index.html' });
});
