/** Fast2 origin used by signed-in kchloe / journal sync. Not called in this scaffold. */
export const API_ORIGIN = 'https://api.kchloe.co';
export const API_PREFIX = '/api/v1';

export function apiUrl(path: string): string {
  return `${API_ORIGIN}${API_PREFIX}${path}`;
}
