// Central API base URL — points to the Tachikoma host machine.
// All components call this directly so the app works from any origin.
export const API_BASE = "/tachikoma";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
