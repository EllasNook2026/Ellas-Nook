// Entry point for the PUBLIC Worker (ellas-nook-public). It never serves the Studio or admin API.
import worker from './index.js';

export default {
  async fetch(request, env, ctx) {
    const p = new URL(request.url).pathname.toLowerCase();
    if (p === '/studio' || p.startsWith('/studio/') || p.startsWith('/api/admin')) {
      return new Response('Not found', { status: 404 });
    }
    return worker.fetch(request, env, ctx);
  }
};
