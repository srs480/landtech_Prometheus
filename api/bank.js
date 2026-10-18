// ===== FUNCTION 5/8: /api/bank/{mark-loan,release-loan} =====
import { dispatch } from './_lib/http.js';
import markLoan from './_handlers/bank-mark-loan.js';
import releaseLoan from './_handlers/bank-release-loan.js';

export default dispatch({ 'mark-loan': markLoan, 'release-loan': releaseLoan });
