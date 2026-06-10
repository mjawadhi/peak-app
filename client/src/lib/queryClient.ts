import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Resolve API base — deploy_website rewrites the literal string "__PORT_5000__"
// in the JS bundle at upload time. Do NOT read from window — keep it as a literal
// string so the rewrite hits it correctly.
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export async function apiRequest(
  method: string,
  url: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  // Use explicitly-provided Authorization first, fall back to stored tokens
  const storedToken = localStorage.getItem("peak_tu_token") ||
    localStorage.getItem("peak_sa_token") ||
    localStorage.getItem("peak_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (storedToken && !extraHeaders?.["Authorization"]) {
    headers["Authorization"] = `Bearer ${storedToken}`;
  }
  if (extraHeaders) Object.assign(headers, extraHeaders);

  const res = await fetch(API_BASE + url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res;
}

export async function apiFetch<T>(url: string, opts?: { method?: string; body?: unknown; headers?: Record<string, string> }): Promise<T> {
  const res = await apiRequest(opts?.method || "GET", url, opts?.body, opts?.headers);
  return res.json();
}
