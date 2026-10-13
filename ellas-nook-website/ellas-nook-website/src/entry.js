// Wrapper entry point: handles Google sign-in first, then hands everything else to the original Worker in index.js.
import worker from './index.js';
import { googleRoute } from './google-login.js';

export default {
  async fetch(request, env, ctx) {
    const response = await googleRoute(request, env);
    if (response) return response;
    return worker.fetch(request, env, ctx);
  }
};
