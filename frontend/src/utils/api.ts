import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await AsyncStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${API_BASE}/api${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshResp = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshResp.ok) {
          const data = await refreshResp.json();
          await AsyncStorage.setItem('access_token', data.access_token);
          const retryHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.access_token}`,
          };
          return fetch(`${API_BASE}/api${endpoint}`, { ...options, headers: retryHeaders });
        }
      } catch (_e) {
        // Refresh failed
      }
    }
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
  }

  return response;
}

export async function apiGet(endpoint: string) {
  const resp = await apiCall(endpoint);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return resp.json();
}

export async function apiPost(endpoint: string, body?: any) {
  const resp = await apiCall(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return resp.json();
}

export async function apiPut(endpoint: string, body?: any) {
  const resp = await apiCall(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return resp.json();
}

export async function apiDelete(endpoint: string) {
  const resp = await apiCall(endpoint, { method: 'DELETE' });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return resp.json();
}
