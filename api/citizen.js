// ===== FUNCTION 6/8: /api/citizen/unlock =====
import { dispatch } from './_lib/http.js';
import unlock from './_handlers/citizen-unlock.js';

export default dispatch({ unlock });
