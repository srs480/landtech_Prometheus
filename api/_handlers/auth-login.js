// ===== SECTION: POST /api/auth/login =====
import bcrypt from 'bcryptjs';
import { route, ok, fail, setSession, clientIp, PORTAL_PATH, ALL_ROLES } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['POST'] }, async (req, res) => {
  const { username = '', password = '', portal = '' } = req.body || {};
  if (!ALL_ROLES.includes(portal)) return fail(res, 400, 'অনুগ্রহ করে একটি পোর্টাল নির্বাচন করুন');
  if (await Q.hitRate('login:' + clientIp(req), 20, 10)) return fail(res, 429, 'অনেকবার চেষ্টা করা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন');
  const u = await Q.findUser(String(username).trim());
  const good = u ? await bcrypt.compare(String(password), u.password_hash) : false;
  if (!good) return fail(res, 401, 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়');
  if (u.role !== portal) return fail(res, 403, 'এই পোর্টালে প্রবেশের অনুমতি আপনার নেই');
  setSession(res, { uid: u.id, role: u.role });
  await Q.audit(u.id, 'login', 'user', u.id);
  ok(res, { role: u.role, redirect: PORTAL_PATH[u.role] });
});
