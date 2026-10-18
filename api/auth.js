// ===== FUNCTION 1/8: /api/auth/{login,logout,me} =====
import { dispatch } from './_lib/http.js';
import login from './_handlers/auth-login.js';
import logout from './_handlers/auth-logout.js';
import me from './_handlers/auth-me.js';

export default dispatch({ login, logout, me });
