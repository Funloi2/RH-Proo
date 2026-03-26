import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth';
import { get } from 'svelte/store';

const API_BASE = 'http://localhost:3001/api';

interface RequestOptions {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    noAuth?: boolean;
}

interface ApiError {
    message: string;
    statusCode: number;
}

async function refreshAccessToken(): Promise<string | null> {
    const { refreshToken } = get(authStore);

    if (!refreshToken) return null;

    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        authStore.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
    } catch {
        return null;
    }
}

export async function api<T = unknown>(
    endpoint: string,
    options: RequestOptions = {},
): Promise<T> {
    const { method = 'GET', body, headers = {}, noAuth = false } = options;

    const requestHeaders: Record<string, string> = {
        ...headers,
    };

    if (body && !(body instanceof FormData)) {
        requestHeaders['Content-Type'] = 'application/json';
    }

    if (!noAuth) {
        const { accessToken } = get(authStore);
        if (accessToken) {
            requestHeaders['Authorization'] = `Bearer ${accessToken}`;
        }
    }

    let res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });

    // If 401, try refreshing the token once
    if (res.status === 401 && !noAuth) {
        const newToken = await refreshAccessToken();

        if (newToken) {
            requestHeaders['Authorization'] = `Bearer ${newToken}`;
            res = await fetch(`${API_BASE}${endpoint}`, {
                method,
                headers: requestHeaders,
                body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
            });
        } else {
            // Refresh failed — log out
            authStore.logout();
            goto('/login');
            throw { message: 'Session expired', statusCode: 401 } as ApiError;
        }
    }

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'An error occurred' }));
        throw {
            message: errorData.message || 'An error occurred',
            statusCode: res.status,
        } as ApiError;
    }

    // Handle empty responses (204)
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
}

// Convenience methods
export const apiGet = <T = unknown>(endpoint: string) => api<T>(endpoint);
export const apiPost = <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: 'POST', body });
export const apiPatch = <T = unknown>(endpoint: string, body?: unknown) =>
    api<T>(endpoint, { method: 'PATCH', body });
export const apiDelete = <T = unknown>(endpoint: string) =>
    api<T>(endpoint, { method: 'DELETE' });
export const apiUpload = <T = unknown>(endpoint: string, formData: FormData) =>
    api<T>(endpoint, { method: 'POST', body: formData });