/** Fast2 origin. Production is api.kchloe.co. Point API_ORIGIN at http://localhost:5000 for a local Fast2. */
export const API_ORIGIN = 'https://api.kchloe.co';
export const API_PREFIX = '/api/v1';
/** Set the extension's Google OAuth client id before Google sign-in can open. */
export const GOOGLE_CLIENT_ID = '';

export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${API_PREFIX}${suffix}`;
}
