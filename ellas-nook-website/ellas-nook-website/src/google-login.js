// "Sign in with Google" for Ella's Studio.
// Only the Google account whose email matches the ADMIN_EMAIL secret can sign in.
// Needs two secrets: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
// Start page:    /api/admin/google/start
// Google returns: /api/admin/google/callback

const STATE_COOKIE = 'ella_google_state';
const SESSION_SECONDS = 8 * 60 * 60;

function b64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
async function sha(text) { return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
function randomHex(n) { return Array.from(crypto.getRandomValues(new Uint8Array(n)), x => x.toString(16).padStart(2, '0')).join(''); }
function readCookie(req, name) {
  const s = req.headers.get('Cookie') || '';
  const m = s.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function fromB64Url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
}
function page(message, { status = 200, redirectTo = '', cookies = [] } = {}) {
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  for (const c of cookies) headers.append('set-cookie', c);
  const refresh = redirectTo ? `<meta http-equiv="refresh" content="0;url=${redirectTo}">` : '';
  const link = redirectTo
    ? `<p><a href="${redirectTo}">Continue to Ella's Studio</a></p>`
    : `<p><a href="/api/admin/google/start">Try Google sign-in again</a></p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${refresh}<title>Ella's Studio</title><style>body{font:18px/1.5 Georgia,serif;background:#f3f8fb;color:#12303f;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:26rem;padding:1.5rem;text-align:center}a{color:#1f6f8b}</style></head><body><main><h1>Ella's Studio</h1><p>${message}</p>${link}</main></body></html>`;
  return new Response(html, { status, headers });
}

export async function googleRoute(request, env) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return null;
  if (url.pathname !== '/api/admin/google/start' && url.pathname !== '/api/admin/google/callback') return null;

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.ADMIN_EMAIL) {
    return page('Google sign-in is not set up yet.', { status: 503 });
  }
  const redirectUri = url.origin + '/api/admin/google/callback';
  const stateCookie = (value, maxAge) => `${STATE_COOKIE}=${value}; Path=/api/admin/google; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

  if (url.pathname === '/api/admin/google/start') {
    const state = randomHex(24);
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      prompt: 'select_account',
      login_hint: String(env.ADMIN_EMAIL)
    });
    return new Response(null, {
      status: 302,
      headers: {
        location: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(),
        'set-cookie': stateCookie(state, 600),
        'cache-control': 'no-store'
      }
    });
  }

  // Callback: Google sends the person back here with ?code=...&state=...
  if (url.searchParams.get('error')) return page('Google sign-in was cancelled.', { status: 400, cookies: [stateCookie('', 0)] });
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const savedState = readCookie(request, STATE_COOKIE);
  if (!code || !state || !savedState || state !== savedState) {
    return page('That sign-in link expired. Please start again.', { status: 400, cookies: [stateCookie('', 0)] });
  }

  let data;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    if (!res.ok) return page('Google could not confirm the sign-in. Please try again.', { status: 502, cookies: [stateCookie('', 0)] });
    data = await res.json();
  } catch (e) {
    return page('Could not reach Google. Please try again.', { status: 502, cookies: [stateCookie('', 0)] });
  }

  // The ID token comes straight from Google over HTTPS in the exchange above, so its contents can be trusted.
  let claims;
  try { claims = JSON.parse(fromB64Url(String(data.id_token || '').split('.')[1] || '')); }
  catch (e) { return page('Google sent an unexpected reply. Please try again.', { status: 502, cookies: [stateCookie('', 0)] }); }

  const issOk = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  const audOk = claims.aud === env.GOOGLE_CLIENT_ID;
  const expOk = Number(claims.exp) * 1000 > Date.now();
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  const emailOk = String(claims.email || '').toLowerCase() === String(env.ADMIN_EMAIL).toLowerCase();
  if (!issOk || !audOk || !expOk || !verified || !emailOk) {
    return page('This Google account is not allowed to open Ella\'s Studio.', { status: 403, cookies: [stateCookie('', 0)] });
  }

  // Same kind of session the password login creates, so the rest of the Studio works unchanged.
  const token = randomHex(32);
  const hash = await sha(token);
  await env.DB.prepare('INSERT INTO sessions(token_hash,created_at,expires_at) VALUES(?,?,?)')
    .bind(hash, Date.now(), Date.now() + SESSION_SECONDS * 1000).run();
  const sessionCookie = `ella_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
  return page('Signed in. Opening the Studio…', { redirectTo: '/studio/dashboard', cookies: [sessionCookie, stateCookie('', 0)] });
}
