// ===== SECTION: Imports =====
// ALL SQL lives in this file. To swap the schema, edit db/schema.sql + this file only.
import crypto from 'node:crypto';
import { query, withTx } from './db.js';
import { UserError } from './http.js';

// ===== SECTION: Users & profile =====
export const findUser = async (username) =>
  (await query('SELECT id, username, password_hash, role FROM users WHERE username = $1', [username]))[0];

export const profile = async (uid) => (await query(
  `SELECT u.id, u.role, u.full_name, u.designation, u.office_name, u.office_code,
          d.name_bn AS district, up.name_bn AS upazila, p.name_bn AS person_name
   FROM users u LEFT JOIN districts d ON d.id = u.district_id
   LEFT JOIN upazilas up ON up.id = u.upazila_id LEFT JOIN people p ON p.id = u.person_id
   WHERE u.id = $1`, [uid]))[0];

// ===== SECTION: Audit log & rate limiting =====
export const audit = (uid, action, entity, entityId, details = '') =>
  query('INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5)',
    [uid, action, entity, String(entityId ?? ''), details]);

// returns true when the key is over the limit; otherwise records the hit
export async function hitRate(key, max, minutes) {
  const [r] = await query(
    `SELECT count(*)::int AS c FROM rate_hits WHERE key = $1 AND hit_at > now() - ($2 || ' minutes')::interval`,
    [key, String(minutes)]);
  if (r.c >= max) return true;
  await query('INSERT INTO rate_hits (key) VALUES ($1)', [key]);
  return false;
}

// ===== SECTION: Geography =====
export const divisions = () => query('SELECT id, name_bn FROM divisions ORDER BY id');
export const districts = (divisionId) => query('SELECT id, name_bn FROM districts WHERE division_id = $1 ORDER BY name_bn', [divisionId]);
export const upazilas = (districtId) => query('SELECT id, name_bn FROM upazilas WHERE district_id = $1 ORDER BY name_bn', [districtId]);
export const mouzas = (upazilaId) => query('SELECT id, name_bn, jl_no FROM mouzas WHERE upazila_id = $1 ORDER BY name_bn', [upazilaId]);

// ===== SECTION: Khatian list & land lookup =====
export const khatiansByMouza = (mouzaId, type) => query(
  `SELECT id, khatian_type, khatian_no, plot_id FROM khatians WHERE mouza_id = $1 AND khatian_type = $2
   ORDER BY khatian_no`, [mouzaId, type]);

// find a plot by: khatian id | (mouza + type + khatian no) | (mouza + dag)
export async function resolvePlot({ khatian, mouza, type, no, dag }) {
  let rows = [];
  if (khatian) rows = await query('SELECT plot_id FROM khatians WHERE id = $1', [khatian]);
  else if (mouza && type && no) rows = await query('SELECT plot_id FROM khatians WHERE mouza_id=$1 AND khatian_type=$2 AND khatian_no=$3', [mouza, type, no]);
  else if (mouza && dag) rows = await query('SELECT id AS plot_id FROM plots WHERE mouza_id=$1 AND dag_no=$2', [mouza, dag]);
  return rows[0]?.plot_id ?? null;
}

// ===== SECTION: Plot detail + status flags =====
const PLOT_SQL = `
  SELECT p.id AS plot_id, p.dag_no, p.area_decimal, p.land_type, p.is_khas, p.is_acquired,
         m.id AS mouza_id, m.name_bn AS mouza, u.name_bn AS upazila, d.name_bn AS district, v.name_bn AS division,
         EXISTS (SELECT 1 FROM mortgages x WHERE x.plot_id = p.id AND x.status = 'active') AS mortgaged,
         EXISTS (SELECT 1 FROM court_cases c WHERE c.plot_id = p.id AND c.status = 'pending') AS litigated,
         EXISTS (SELECT 1 FROM court_cases c WHERE c.plot_id = p.id AND c.status = 'pending' AND c.injunction) AS injunction,
         EXISTS (SELECT 1 FROM mutations n WHERE n.plot_id = p.id AND n.status = 'pending') AS mutation_pending
  FROM plots p JOIN mouzas m ON m.id = p.mouza_id JOIN upazilas u ON u.id = m.upazila_id
  JOIN districts d ON d.id = u.district_id JOIN divisions v ON v.id = d.division_id
  WHERE p.id = $1`;

export const plotDetail = async (plotId) => (await query(PLOT_SQL, [plotId]))[0];
export const plotKhatians = (plotId) => query('SELECT khatian_type, khatian_no FROM khatians WHERE plot_id = $1', [plotId]);
export const currentOwners = (plotId) => query(
  `SELECT pe.id, pe.name_bn, pe.father_name_bn, ('*********' || right(pe.nid, 4)) AS nid_masked, o.share_pct
   FROM plot_owners o JOIN people pe ON pe.id = o.person_id WHERE o.plot_id = $1 AND o.is_current ORDER BY o.id`, [plotId]);

// minimal public summary (no owner / history) for locked citizen access
export const publicSummary = (d) => ({
  plot_id: d.plot_id, exists: true, area_decimal: d.area_decimal, land_type: d.land_type,
  location: `${d.mouza}, ${d.upazila}, ${d.district}, ${d.division}`,
});

// blocking reasons for transfers (pure function)
export function blockReasons(d, deedType = 'sale') {
  const blocks = [], warnings = [];
  if (d.mortgaged) blocks.push('এই জমিতে সক্রিয় ব্যাংক বন্ধক রয়েছে');
  if (d.injunction) blocks.push('এই জমিতে আদালতের নিষেধাজ্ঞা সক্রিয় আছে');
  else if (d.litigated) warnings.push('এই জমি নিয়ে আদালতে মামলা চলমান');
  if (deedType === 'khas') { if (!d.is_khas) blocks.push('এটি খাস জমি নয়, তাই বন্দোবস্ত দেওয়া যাবে না'); }
  else if (d.is_khas) blocks.push('এটি সরকারি খাস জমি, সাধারণ দলিল সম্ভব নয়');
  if (d.is_acquired) blocks.push('এই জমি সরকারি অধিগ্রহণের আওতাভুক্ত');
  if (d.mutation_pending) blocks.push('নামজারি অপেক্ষমান — দ্বৈত বিক্রয়ের ঝুঁকি');
  return { blocks, warnings };
}

// ===== SECTION: Timeline & hash-chain verification =====
export const timeline = (plotId) => query(
  `SELECT seq, event_type, title, details, actor, occurred_on, hash FROM land_events WHERE plot_id = $1 ORDER BY seq`, [plotId]);

// recomputes every hash inside the database with the same event_hash() used by the insert trigger
export async function verifyChain(plotId) {
  const rows = await query(
    `WITH e AS (SELECT *, lag(hash) OVER (ORDER BY seq) AS expected_prev FROM land_events WHERE plot_id = $1)
     SELECT seq, (hash = event_hash(plot_id, seq, event_type, title, details, occurred_on, prev_hash)
                  AND prev_hash = coalesce(expected_prev, 'GENESIS')) AS valid
     FROM e ORDER BY seq`, [plotId]);
  const broken = rows.filter((r) => !r.valid).map((r) => r.seq);
  return { intact: broken.length === 0, checked: rows.length, broken };
}

// ===== SECTION: Access tokens (citizen portal) =====
export const hashToken = (t) => crypto.createHash('sha256').update(String(t).trim().toUpperCase()).digest('hex');
export async function validateToken(token) {
  if (!token) return false;
  const r = await query(
    `SELECT 1 FROM access_tokens WHERE token_hash = $1 AND status = 'active' AND expires_at > now() AND used_count >= 1 AND used_count <= max_uses`,
    [hashToken(token)]);
  return r.length > 0;
}

// ===== SECTION: Active mortgage (loan account shown only to the owning bank) =====
export const activeMortgage = async (plotId, uid) => (await query(
  `SELECT x.id, x.amount, x.loan_date, u.office_name AS bank, (x.bank_user_id = $2) AS mine,
          CASE WHEN x.bank_user_id = $2 THEN x.loan_account END AS loan_account
   FROM mortgages x JOIN users u ON u.id = x.bank_user_id WHERE x.plot_id = $1 AND x.status = 'active'`, [plotId, uid]))[0] ?? null;

// ===== SECTION: People search & bank list =====
export const searchPeople = (q) => query(
  `SELECT id, name_bn, father_name_bn, ('*********' || right(nid, 4)) AS nid_masked
   FROM people WHERE name_bn ILIKE $1 OR nid LIKE $1 ORDER BY name_bn LIMIT 10`,
  ['%' + q.replace(/[\\%_]/g, '\\$&') + '%']);
export const banks = () => query(`SELECT id, office_name FROM users WHERE role = 'bank' ORDER BY office_name`);

// ===== SECTION: Transaction helpers =====
const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const fmt = (n) => bn(Number(n).toLocaleString('en-IN'));
const pad = (n) => String(n).padStart(4, '0');
const nextId = async (tx, table) => Number((await tx(`SELECT nextval(pg_get_serial_sequence('${table}','id')) AS id`))[0].id);
const addEvent = (tx, plotId, type, title, details, actor, on = null) => tx(
  `INSERT INTO land_events (plot_id, event_type, title, details, actor, occurred_on) VALUES ($1,$2,$3,$4,$5, coalesce($6::date, current_date))`,
  [plotId, type, title, details, actor, on]);
const addAudit = (tx, uid, action, entity, entityId, details) => tx(
  'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5)', [uid, action, entity, String(entityId), details]);
const ownersOf = (tx, plotId) => tx(
  `SELECT o.person_id, pe.name_bn, o.share_pct FROM plot_owners o JOIN people pe ON pe.id = o.person_id
   WHERE o.plot_id = $1 AND o.is_current ORDER BY o.id`, [plotId]);

// ===== SECTION: Deed types (7) =====
export const DEED_TYPES = {
  sale:   { bn: 'সাফ কবলা',            ownership: 'replace' },
  bayna:  { bn: 'বায়নানামা',           ownership: null },
  poa:    { bn: 'আমমোক্তারনামা',        ownership: null },
  hiba:   { bn: 'হেবা',                ownership: 'replace' },
  bonton: { bn: 'বণ্টননামা',            ownership: 'split' },
  rehen:  { bn: 'রেহেন/বন্ধকি',         ownership: null },
  khas:   { bn: 'খাস জমি বন্দোবস্ত',    ownership: 'replace' },
};

// ===== SECTION: Property transfer — ONE transaction, plot row locked FOR UPDATE =====
// Creates deed -> updates ownership -> AUTO mutation (completed) -> timeline events -> audit log.
export function registerDeed(uid, i) {
  return withTx(async (tx) => {
    const T = DEED_TYPES[i.deedType];
    const [lock] = await tx('SELECT id FROM plots WHERE id = $1 FOR UPDATE', [i.plotId]);
    if (!lock) throw new UserError(404, 'জমিটি খুঁজে পাওয়া যায়নি');
    const d = (await tx(PLOT_SQL, [i.plotId]))[0];
    const { blocks } = blockReasons(d, i.deedType);   // re-checked INSIDE the lock (double-sale guard)
    if (blocks.length) throw new UserError(409, 'দলিল সম্পাদন করা যাবে না: ' + blocks.join('; '));

    const owners = await ownersOf(tx, i.plotId);
    const ownerIds = owners.map((o) => o.person_id);
    if (i.deedType !== 'khas' && !owners.length) throw new UserError(409, 'এই জমির বর্তমান মালিক পাওয়া যায়নি');
    const ids = [i.buyerId, i.attorneyId, ...i.shares.map((s) => s.personId)].filter(Boolean);
    const ppl = ids.length ? await tx('SELECT id, name_bn FROM people WHERE id = ANY($1::int[])', [ids]) : [];
    if (new Set(ids).size !== ppl.length) throw new UserError(400, 'নির্বাচিত ব্যক্তিকে খুঁজে পাওয়া যায়নি');
    const nm = (id) => ppl.find((p) => p.id === id)?.name_bn;

    if (['sale', 'hiba'].includes(i.deedType) && ownerIds.includes(i.buyerId)) throw new UserError(400, 'ক্রেতা ও বিক্রেতা একই ব্যক্তি হতে পারবেন না');
    if (i.deedType === 'bonton' && !i.shares.every((s) => ownerIds.includes(s.personId))) throw new UserError(400, 'বণ্টননামায় শুধু বর্তমান শরিকরাই থাকতে পারবেন');
    let bank = null;
    if (i.deedType === 'rehen') {
      bank = (await tx(`SELECT id, office_name FROM users WHERE id = $1 AND role = 'bank'`, [i.bankId]))[0];
      if (!bank) throw new UserError(400, 'ব্যাংক খুঁজে পাওয়া যায়নি');
    }

    const year = new Date().getFullYear();
    const deedId = await nextId(tx, 'deeds');
    const deedNo = `D-${year}-${pad(deedId)}`;
    const seller = owners[0] ?? null;
    const sellerNames = owners.map((o) => o.name_bn).join(', ');
    await tx(
      `INSERT INTO deeds (id, deed_no, deed_type, plot_id, seller_id, buyer_id, price, extra, registered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
      [deedId, deedNo, T.bn, i.plotId, seller?.person_id ?? null, i.buyerId ?? i.attorneyId ?? null, i.price ?? null,
       JSON.stringify({ advance: i.advance, deadline: i.deadline, attorneyId: i.attorneyId, shares: i.shares, bankId: i.bankId }), uid]);

    const price = i.price ? fmt(i.price) : '';
    const [type, title, details] = {
      sale:   ['sale', `${sellerNames} থেকে ${nm(i.buyerId)}-এর নামে বিক্রয়`, `সাফ কবলা ${deedNo}, মূল্য ${price} টাকা`],
      bayna:  ['agreement', `${nm(i.buyerId)}-এর সাথে বায়নানামা`, `বায়নানামা ${deedNo}, মূল্য ${price} টাকা, অগ্রিম ${i.advance ? fmt(i.advance) : '—'} টাকা, মেয়াদ ${bn(i.deadline || '—')}`],
      poa:    ['poa', `${nm(i.attorneyId)}-কে আমমোক্তারনামা প্রদান`, `আমমোক্তারনামা ${deedNo}`],
      hiba:   ['gift', `${sellerNames} থেকে ${nm(i.buyerId)}-এর নামে হেবা`, `হেবা দলিল ${deedNo}`],
      bonton: ['partition', 'শরিকদের মধ্যে জমি বণ্টন', `বণ্টননামা ${deedNo}: ` + i.shares.map((s) => `${nm(s.personId)} ${bn(s.pct)}%`).join(', ')],
      rehen:  ['mortgage', `${bank?.office_name}-এর কাছে রেহেন/বন্ধকি`, `রেহেন দলিল ${deedNo}, ঋণ ${price} টাকা`],
      khas:   ['ownership', `খাস জমি ${nm(i.buyerId)}-এর নামে বন্দোবস্ত`, `বন্দোবস্ত দলিল ${deedNo}`],
    }[i.deedType];
    await addEvent(tx, i.plotId, type, title, details, 'সাব-রেজিস্ট্রার');

    if (i.deedType === 'rehen') {
      await tx(`INSERT INTO mortgages (plot_id, bank_user_id, borrower_id, amount, loan_account, loan_date, status, remarks)
                VALUES ($1,$2,$3,$4,$5,current_date,'active','রেহেন দলিলের মাধ্যমে')`,
        [i.plotId, bank.id, seller.person_id, i.price, deedNo]);
    }

    let mutationNo = null;
    const newOwners = T.ownership === 'replace' ? [{ personId: i.buyerId, pct: 100 }] : T.ownership === 'split' ? i.shares : null;
    if (newOwners) {   // ownership change AUTOMATICALLY creates a completed mutation (no extra user input)
      await tx('UPDATE plot_owners SET is_current = false, until = current_date WHERE plot_id = $1 AND is_current', [i.plotId]);
      for (const o of newOwners) await tx('INSERT INTO plot_owners (plot_id, person_id, share_pct) VALUES ($1,$2,$3)', [i.plotId, o.personId, o.pct]);
      if (i.deedType === 'khas') await tx('UPDATE plots SET is_khas = false WHERE id = $1', [i.plotId]);
      const mid = await nextId(tx, 'mutations');
      mutationNo = `M-${year}-${pad(mid)}`;
      await tx(`INSERT INTO mutations (id, mutation_no, plot_id, deed_id, from_person_id, to_person_id, status, completed_on)
                VALUES ($1,$2,$3,$4,$5,$6,'completed',current_date)`,
        [mid, mutationNo, i.plotId, deedId, seller?.person_id ?? null, newOwners[0].personId]);
      await addEvent(tx, i.plotId, 'mutation', 'নামজারি স্বয়ংক্রিয়ভাবে সম্পন্ন', `নামজারি ${mutationNo} (দলিল ${deedNo})`, 'সিস্টেম');
    }
    await addAudit(tx, uid, 'deed_registered', 'deed', deedId, `${deedNo} / ${T.bn} / জমি #${i.plotId}`);

    const after = (await tx(PLOT_SQL, [i.plotId]))[0];
    return {
      deedNo, mutationNo, deedType: T.bn, verifyPath: `/api/verify/${deedNo}`,
      status: { owners: (await ownersOf(tx, i.plotId)).map((o) => ({ name: o.name_bn, share_pct: o.share_pct })),
                mortgaged: after.mortgaged, is_khas: after.is_khas, mutation_pending: after.mutation_pending },
    };
  });
}

// ===== SECTION: Mutation list (view only) =====
export const mutationList = () => query(
  `SELECT n.mutation_no, n.status, n.created_on, n.completed_on, d.deed_no, d.deed_type, p.dag_no,
          m.name_bn AS mouza, fp.name_bn AS from_name, tp.name_bn AS to_name
   FROM mutations n JOIN plots p ON p.id = n.plot_id JOIN mouzas m ON m.id = p.mouza_id
   LEFT JOIN deeds d ON d.id = n.deed_id LEFT JOIN people fp ON fp.id = n.from_person_id LEFT JOIN people tp ON tp.id = n.to_person_id
   ORDER BY n.id DESC LIMIT 100`);

// ===== SECTION: Bank — mark loan (only if not already mortgaged) =====
export function markLoan(uid, i) {
  return withTx(async (tx) => {
    const [lock] = await tx('SELECT id FROM plots WHERE id = $1 FOR UPDATE', [i.plotId]);
    if (!lock) throw new UserError(404, 'জমিটি খুঁজে পাওয়া যায়নি');
    const d = (await tx(PLOT_SQL, [i.plotId]))[0];
    if (d.mortgaged) throw new UserError(409, 'এই জমি ইতিমধ্যে বন্ধক আছে — দ্বিতীয়বার ঋণ চিহ্নিত করা যাবে না');
    if (d.is_khas || d.is_acquired) throw new UserError(409, 'খাস বা অধিগ্রহণকৃত জমিতে ঋণ চিহ্নিত করা যাবে না');
    const owners = await ownersOf(tx, i.plotId);
    const borrower = owners.find((o) => o.person_id === i.borrowerId);
    if (!borrower) throw new UserError(400, 'ঋণগ্রহীতা অবশ্যই জমির বর্তমান মালিক হতে হবে');
    const bank = (await tx('SELECT office_name FROM users WHERE id = $1', [uid]))[0];
    const [m] = await tx(
      `INSERT INTO mortgages (plot_id, bank_user_id, borrower_id, amount, loan_account, loan_date, status, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7) RETURNING id`,
      [i.plotId, uid, i.borrowerId, i.amount, i.loanAccount, i.loanDate, i.remarks || null]);
    await addEvent(tx, i.plotId, 'mortgage', `${bank.office_name} — ${borrower.name_bn}-এর ঋণ চিহ্নিত`,
      `ঋণ হিসাব ${bn(i.loanAccount)}, পরিমাণ ${fmt(i.amount)} টাকা`, bank.office_name, i.loanDate);
    await addAudit(tx, uid, 'loan_marked', 'mortgage', m.id, `জমি #${i.plotId}, ${i.loanAccount}`);
    return { mortgageId: m.id };
  });
}

// ===== SECTION: Bank — release loan (own bank only; history kept, never deleted) =====
export function releaseLoan(uid, i) {
  return withTx(async (tx) => {
    const [lock] = await tx('SELECT id FROM plots WHERE id = $1 FOR UPDATE', [i.plotId]);
    if (!lock) throw new UserError(404, 'জমিটি খুঁজে পাওয়া যায়নি');
    const m = (await tx(`SELECT * FROM mortgages WHERE plot_id = $1 AND status = 'active' FOR UPDATE`, [i.plotId]))[0];
    if (!m) throw new UserError(404, 'এই জমিতে কোনো সক্রিয় ঋণ চিহ্ন পাওয়া যায়নি');
    if (m.bank_user_id !== uid) throw new UserError(403, 'আপনি শুধু নিজ প্রতিষ্ঠানের ঋণ চিহ্ন মুক্ত করতে পারবেন');
    if (new Date(i.releaseDate) < new Date(m.loan_date)) throw new UserError(400, 'মুক্তির তারিখ ঋণের তারিখের আগে হতে পারে না');
    await tx(`UPDATE mortgages SET status = 'released', release_date = $2, remarks = concat_ws(' | ', remarks, $3::text) WHERE id = $1`,
      [m.id, i.releaseDate, i.remarks || null]);
    const bank = (await tx('SELECT office_name FROM users WHERE id = $1', [uid]))[0];
    await addEvent(tx, i.plotId, 'release', `${bank.office_name} — ঋণ মুক্ত`, `ঋণ হিসাব ${bn(m.loan_account)} মুক্ত করা হয়েছে`, bank.office_name, i.releaseDate);
    await addAudit(tx, uid, 'loan_released', 'mortgage', m.id, `জমি #${i.plotId}`);
    return { mortgageId: m.id };
  });
}

// ===== SECTION: Citizen token unlock (consumes one use, atomically) =====
export async function consumeToken(token) {
  const h = hashToken(token);
  const upd = await query(
    `UPDATE access_tokens SET used_count = used_count + 1
     WHERE token_hash = $1 AND status = 'active' AND expires_at > now() AND used_count < max_uses
     RETURNING max_uses - used_count AS remaining`, [h]);
  if (upd.length) return { state: 'ok', remaining: upd[0].remaining };
  const r = (await query('SELECT status, expires_at < now() AS expired FROM access_tokens WHERE token_hash = $1', [h]))[0];
  if (!r) return { state: 'invalid' };
  if (r.expired) return { state: 'expired' };
  return { state: r.status !== 'active' ? 'revoked' : 'exhausted' };
}

// ===== SECTION: Public deed verification (QR target) — no personal data =====
export async function verifyDeed(deedNo) {
  const d = (await query(
    `SELECT d.id, d.deed_no, d.deed_type, d.registered_on, d.plot_id, p.dag_no, m.name_bn AS mouza, u.name_bn AS upazila, dt.name_bn AS district,
            n.mutation_no, n.status AS mutation_status
     FROM deeds d JOIN plots p ON p.id = d.plot_id JOIN mouzas m ON m.id = p.mouza_id JOIN upazilas u ON u.id = m.upazila_id
     JOIN districts dt ON dt.id = u.district_id LEFT JOIN mutations n ON n.deed_id = d.id WHERE d.deed_no = $1`, [deedNo]))[0];
  if (!d) return null;
  return { deed: d, chain: await verifyChain(d.plot_id) };
}
