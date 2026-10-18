// ===== SECTION: POST /api/bank/mark-loan (bank role only) =====
import { route, ok, fail, toInt, toMoney, isDate } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['POST'], roles: ['bank'] }, async (req, res, user) => {
  const b = req.body || {};
  const plotId = await Q.resolvePlot({ khatian: toInt(b.khatianId) });
  if (!plotId) return fail(res, 404, 'এই খতিয়ানটি খুঁজে পাওয়া যায়নি');
  const loanAccount = String(b.loanAccount || '').trim();
  if (!toInt(b.borrowerId) || !toMoney(b.amount) || !isDate(b.loanDate) || !/^[A-Za-z0-9-]{4,30}$/.test(loanAccount))
    return fail(res, 400, 'ঋণগ্রহীতা, পরিমাণ, তারিখ ও সঠিক ঋণ হিসাব নম্বর দিন');
  const r = await Q.markLoan(user.uid, {
    plotId, borrowerId: toInt(b.borrowerId), amount: toMoney(b.amount), loanDate: b.loanDate,
    loanAccount, remarks: String(b.remarks || '').slice(0, 300),
  });
  ok(res, r, 201);
});
