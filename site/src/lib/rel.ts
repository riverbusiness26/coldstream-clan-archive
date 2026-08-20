// PostgREST returns an embedded relation as an object for a to-one link and an
// array for a to-many one, and the client's types do not always agree with
// what actually arrives. Reading through this helper means a shape change
// shows up as the real name rather than silently as "unknown".
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
