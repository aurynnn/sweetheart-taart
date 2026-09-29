import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../lib/auth';

// POST only (a link/prefetch can't log you out); Astro's origin check blocks cross-site posts
export const POST: APIRoute = ({ cookies, redirect }) => {
  clearSessionCookie(cookies);
  return redirect('/admin/login', 303);
};
