import { supabasePortal } from '@/lib/supabase/portal-client';

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabasePortal.auth.getSession();
    if (error || !data?.session?.access_token) {
      return null;
    }
    return data.session.access_token;
  } catch {
    return null;
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  );

  if (!headers.has('Authorization')) {
    const token = await getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
