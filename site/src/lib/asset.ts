// Public asset paths, resolved against wherever the site is actually served
// from.
//
// Vite rewrites the paths it processes itself, but not string literals in JSX
// and not the paths baked into the seed JSON, so anything referenced at runtime
// stays as a domain-root path like "/gallery/x.jpg". That is correct when the
// site sits at the root of a domain and completely wrong under a subfolder,
// where it resolves past the site entirely and 404s.
//
// BASE_URL is "/" for a root deploy and the subpath otherwise, so this is a
// no-op on Vercel and the fix on GitHub Pages.
const BASE = import.meta.env.BASE_URL || '/';

export function asset(path: string): string {
  if (!path) return path;
  // Leave anything already absolute, or a data URI, alone.
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return BASE.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
}
