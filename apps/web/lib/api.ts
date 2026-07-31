import { fetchAuthSession } from 'aws-amplify/auth';
import type { Capture, Item, RecallInput, RecallResponse } from '@contextkeeper/core';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    throw new Error(errorData?.error?.message || `API Error: ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ── API Methods ─────────────────────────────────────────────────────────────

export async function getCaptures(limit = 20, cursor?: string) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (cursor) params.set('cursor', cursor);
  return apiFetch<{ items: Capture[]; nextCursor: string | null }>(`/captures?${params}`);
}

export async function getCapture(id: string) {
  return apiFetch<Capture>(`/captures/${id}`);
}

export async function createTextCapture(text: string) {
  return apiFetch<{ captureId: string; status: string }>('/captures', {
    method: 'POST',
    body: JSON.stringify({ type: 'TEXT', text }),
  });
}

export async function getUploadUrl(filename: string, contentType: string) {
  return apiFetch<{ url: string; s3Key: string }>(
    `/captures/presign?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`
  );
}

export async function finalizeMediaCapture(type: 'IMAGE' | 'PDF' | 'AUDIO', s3Key: string) {
  return apiFetch<{ captureId: string; status: string }>('/captures', {
    method: 'POST',
    body: JSON.stringify({ type, s3Key }),
  });
}

export async function getItems(params?: { type?: string; status?: string; person?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.person) searchParams.set('person', params.person);
  
  const qs = searchParams.toString();
  return apiFetch<{ items: Item[] }>(`/items${qs ? `?${qs}` : ''}`);
}

export async function updateItem(id: string, updates: Partial<Item>) {
  return apiFetch<Item>(`/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteItem(id: string) {
  return apiFetch<void>(`/items/${id}`, {
    method: 'DELETE',
  });
}

export async function askRecall(question: string) {
  return apiFetch<RecallResponse>('/recall', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
