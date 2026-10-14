// Wrapper entry point: handles Google sign-in and a temporary Access check first,
// then hands everything else to the original Worker in index.js.
import worker from './index.js';
import { googleRoute } from './google-login.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return Response.redirect(url.origin + '/studio/dashboard.html', 302);
    const response = await googleRoute(request, env);
    if (response) return response;
    return worker.fetch(request, env, ctx);
  }
};
