import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiFetch(path: string, options: RequestInit = {}) {
  // 1. Get the Cognito JWT session
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  // 2. Prepare headers with Authorization
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // 3. Make request
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // 4. Handle errors seamlessly
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    throw new Error(errorData?.error?.message || `API Error: ${response.status}`);
  }

  return response.json();
}
