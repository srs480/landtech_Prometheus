// ===== SECTION: POST /api/citizen/unlock (citizen role; rate-limited) =====
// Client keeps the token in sessionStorage and sends it as header `x-land-token` on later calls.
import { route, ok, fail, clientIp } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

const MSG = {
  invalid: 'টোকেনটি সঠিক নয়',
  expired: 'টোকেনের মেয়াদ শেষ হয়ে গেছে',
  revoked: 'টোকেনটি বাতিল করা হয়েছে',
  exhausted: 'টোকেনের ব্যবহারের সীমা শেষ হয়ে গেছে',
};

export default route({ methods: ['POST'], roles: ['citizen'] }, async (req, res, user) => {
  if (await Q.hitRate(`unlock:${user.uid}:${clientIp(req)}`, 8, 15))
    return fail(res, 429, 'অনেকবার চেষ্টা করা হয়েছে, ১৫ মিনিট পরে আবার চেষ্টা করুন');
  const token = String(req.body?.token || '').trim();
  if (!/^[A-Za-z0-9-]{6,40}$/.test(token)) return fail(res, 400, 'টোকেনের ফরম্যাট সঠিক নয়');
  const r = await Q.consumeToken(token);
  if (r.state !== 'ok') return fail(res, 403, MSG[r.state]);
  await Q.audit(user.uid, 'token_unlock', 'access_token', '-', 'সফল');
  ok(res, { remaining: r.remaining });
});
