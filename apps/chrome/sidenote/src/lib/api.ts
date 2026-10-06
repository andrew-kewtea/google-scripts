/** Fast2 origin. Production is api.kchloe.co. Point API_ORIGIN at http://localhost:5000 for a local Fast2. */
export const API_ORIGIN = 'https://api.kchloe.co';
export const API_PREFIX = '/api/v1';
/** Public OAuth client id, the same value the Vue app ships. The client secret stays on the API server. */
export const GOOGLE_CLIENT_ID = '766026929348-r08njosngno19hnbjos7o9vq7q06o981.apps.googleusercontent.com';

export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${API_PREFIX}${suffix}`;
}
