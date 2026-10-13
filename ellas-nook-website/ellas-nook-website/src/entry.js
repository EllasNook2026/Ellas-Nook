// Wrapper entry point: handles Google sign-in and a temporary Access check first,
// then hands everything else to the original Worker in index.js.
import worker from './index.js';
import { googleRoute } from './google-login.js';

// ---- TEMPORARY: /api/admin/debug-access (delete this block once the Studio login works) ----
function b64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function mask(s) { return s.length > 10 ? s.slice(0, 4) + '...' + s.slice(-4) + ' (length ' + s.length + ')' : '(length ' + s.length + ')'; }

async function debugAccess(request, env) {
  const out = {};
  const team = String(env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const aud = String(env.ACCESS_AUD || '');
  out.secrets_on_worker = {
    ACCESS_TEAM_DOMAIN: team || '(missing)',
    ACCESS_AUD: aud ? mask(aud) : '(missing)',
    ADMIN_EMAIL: env.ADMIN_EMAIL ? 'set (length ' + String(env.ADMIN_EMAIL).length + ')' : '(missing)'
  };
  const cookieMatch = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || (cookieMatch ? cookieMatch[1] : '');
  out.access_token_reached_worker = !!token;
  if (!token) { out.verdict = 'No Access token reached the Worker, so the problem is the Access setup, not the secrets.'; return out; }
  try {
    const [h, p, sig] = token.split('.');
    const dec = x => JSON.parse(new TextDecoder().decode(b64u(x)));
    const head = dec(h), claims = dec(p);
    out.token_contents = {
      aud: claims.aud, iss: claims.iss, email: claims.email, alg: head.alg,
      expires_in_minutes: Math.round((Number(claims.exp) * 1000 - Date.now()) / 60000)
    };
    const checks = {
      aud_matches: !!aud && [].concat(claims.aud || []).includes(aud),
      iss_matches: claims.iss === 'https://' + team,
      not_expired: Number(claims.exp) * 1000 > Date.now(),
      email_matches: !!env.ADMIN_EMAIL && String(claims.email || '').toLowerCase() === String(env.ADMIN_EMAIL).toLowerCase()
    };
    try {
      const r = await fetch('https://' + team + '/cdn-cgi/access/certs');
      checks.certs_fetched = r.ok;
      if (r.ok) {
        const jwk = ((await r.json()).keys || []).find(k => k.kid === head.kid);
        checks.signing_key_found = !!jwk;
        if (jwk) {
          const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
          checks.signature_valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(h + '.' + p));
        }
      }
    } catch (e) { checks.certs_error = String(e.message || e); }
    out.checks = checks;
    const bad = Object.entries(checks).filter(([k, v]) => v === false).map(([k]) => k);
    out.verdict = bad.length ? 'These checks failed: ' + bad.join(', ') : 'All checks passed. The Worker should accept this token.';
  } catch (e) { out.verdict = 'Could not read the token: ' + String(e.message || e); }
  return out;
}
// ---- end of temporary block ----

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/admin/debug-access') {
      return new Response(JSON.stringify(await debugAccess(request, env), null, 2), {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }
    const response = await googleRoute(request, env);
    if (response) return response;
    return worker.fetch(request, env, ctx);
  }
};
