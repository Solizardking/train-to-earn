/**
 * API utility for Train2Earn
 * Uses Vite proxy in development, direct Render URL in production
 */
export const API_BASE_URL = import.meta.env.DEV 
  ? ''  // Vite proxy handles this in dev
  : (import.meta.env.VITE_API_URL || '');  // Render URL in production

export async function apiPost(endpoint, body) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function apiGet(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export default { apiGet, apiPost };
