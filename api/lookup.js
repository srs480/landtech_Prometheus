// ===== FUNCTION 2/8: /api/geo/:kind, /api/khatians, /api/people, /api/banks (read-only lookups) =====
import { dispatch } from './_lib/http.js';
import geo from './_handlers/geo.js';
import khatians from './_handlers/khatians.js';
import people from './_handlers/people.js';
import banks from './_handlers/banks.js';

export default dispatch({ geo, khatians, people, banks });
