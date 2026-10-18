// ===== FUNCTION 3/8: /api/khatian/:id, /api/land/track =====
import { dispatch } from './_lib/http.js';
import khatian from './_handlers/khatian.js';
import track from './_handlers/land-track.js';

export default dispatch({ khatian, track });
