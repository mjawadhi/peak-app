// Auth helpers — store/retrieve JWT tokens per role

const SA_KEY = "peak_sa_token";
const TU_KEY = "peak_tu_token";

export function getSAToken(): string | null {
  return localStorage.getItem(SA_KEY);
}
export function setSAToken(token: string) {
  localStorage.setItem(SA_KEY, token);
}
export function clearSAToken() {
  localStorage.removeItem(SA_KEY);
}

export function getTUToken(): string | null {
  return localStorage.getItem(TU_KEY);
}
export function setTUToken(token: string) {
  localStorage.setItem(TU_KEY, token);
}
export function clearTUToken() {
  localStorage.removeItem(TU_KEY);
}

export function decodePayload(token: string): any {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}
