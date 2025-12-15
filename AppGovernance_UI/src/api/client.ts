export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:9000';

export async function get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) {
        throw new Error(`GET ${path} failed: ${response.statusText}`);
    }
    return response.json();
}

export async function post<T>(path: string, body?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body || {}),
    });
    if (!response.ok) {
        throw new Error(`POST ${path} failed: ${response.statusText}`);
    }
    return response.json();
}
