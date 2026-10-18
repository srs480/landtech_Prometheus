// ===== SECTION: Imports & constants =====
import jwt from 'jsonwebtoken';

export const PORTAL_PATH = {
  registry: '/portal/registry.html', bank: '/portal/bank.html', dc: '/portal/dc.html',
  court: '/portal/court.html', citizen: '/portal/citizen.html',
};
export const ALL_ROLES = Object.keys(PORTAL_PATH);
const COOKIE = 'lt_session';
const MAX_AGE = 8 * 60 * 60;

// ===== SECTION: Response helpers (error format: { ok:false, error:"বাংলা বার্তা" }) =====
export const ok = (res, data = {}, status = 200) => res.status(status).json({ ok: true, ...data });
export const fail = (res, status, error) => res.status(status).json({ ok: false, error });
export const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

// ===== SECTION: Session cookie (signed JWT, httpOnly) =====
function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
export function setSession(res, payload) {
  const token = jwt.sign(payload, secret(), { expiresIn: MAX_AGE });
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`);
}
export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}
export function getSession(req) {
  const t = parseCookies(req)[COOKIE];
  if (!t) return null;
  try { return jwt.verify(t, secret()); } catch { return null; }
}

// ===== SECTION: Route wrapper (method + SERVER-SIDE role check + error handling) =====
// roles = null  -> public route;  roles = ['registry', ...] -> only those roles
export function route({ methods, roles = null }, handler) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) return fail(res, 405, 'এই পদ্ধতি অনুমোদিত নয়');
      let user = null;
      if (roles) {
        user = getSession(req);
        if (!user) return fail(res, 401, 'অনুগ্রহ করে লগইন করুন');
        if (!roles.includes(user.role)) return fail(res, 403, 'এই কাজের অনুমতি আপনার নেই');
      }
      await handler(req, res, user);
    } catch (e) {
      if (e instanceof UserError) return fail(res, e.status, e.message);
      if (e.code === '23505') return fail(res, 409, 'একই সময়ে অন্য একটি পরিবর্তন সম্পন্ন হয়েছে, আবার চেষ্টা করুন');
      console.error(e);
      fail(res, 500, 'সার্ভারে সমস্যা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন');
    }
  };
}

// ===== SECTION: Action dispatcher =====
// One Vercel function serves several routes (Hobby plan allows max 12 functions per deployment).
// vercel.json rewrites put the action name in ?action=...; each handler still checks method + role itself.
export const dispatch = (handlers) => (req, res) => {
  const a = String(req.query?.action || '');
  return Object.hasOwn(handlers, a) ? handlers[a](req, res) : fail(res, 404, 'অনুরোধকৃত তথ্য পাওয়া যায়নি');
};

// ===== SECTION: Business-rule errors (thrown from queries, shown to the user in Bangla) =====
export class UserError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ===== SECTION: Input helpers =====
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const toMoney = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n < 1e12 ? n : null; };
export const toInt = (v) => { const n = Number.parseInt(v, 10); return Number.isInteger(n) && n > 0 ? n : null; };
