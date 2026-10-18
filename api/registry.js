// ===== FUNCTION 4/8: /api/registry/{transfer,mutations} =====
import { dispatch } from './_lib/http.js';
import transfer from './_handlers/registry-transfer.js';
import mutations from './_handlers/registry-mutations.js';

export default dispatch({ transfer, mutations });
