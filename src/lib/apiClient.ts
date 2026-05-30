/**
 * apiClient.ts — cliente HTTP seguro do Bawzi
 * ─────────────────────────────────────────────────────────────────
 * Arquitectura de tokens (Fase 2):
 *
 *  • Access token (60 min) → armazenado APENAS em memória (módulo-level).
 *    Nunca toca o localStorage. Invisível a XSS.
 *
 *  • Refresh token (30 dias) → cookie HttpOnly/SameSite=Strict gravado
 *    pelo backend no login. Nunca acessível via JS.
 *
 * Fluxo de inicialização (page load):
 *   1. initSession() chama POST /api/auth/refresh com credentials:'include'
 *      (o browser envia o cookie automaticamente).
 *   2. Se OK → guarda access token em memória + localStorage (tier/name).
 *   3. Se 401 → utilizador não está autenticado; continua como anónimo.
 *
 * Fluxo de request autenticado:
 *   1. apiFetch() lê o token da memória.
 *   2. Se expira em < 2 min → renova antes de enviar.
 *   3. Se servidor responde 401 → tenta renovar + repete 1 vez.
 *   4. Se renovação falha → clearSession() + evento bawzi_session_expired.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// ─── Token em memória (não persiste entre reloads — o cookie renova) ──────────
let _accessToken: string | null = null;
let _refreshPromise: Promise<string | null> | null = null; // evita refreshes paralelos

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

/** Token ativo: preferência ao token em memória, fallback para localStorage (legado). */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    _accessToken ||
    localStorage.getItem('bawzi_token') ||
    localStorage.getItem('token') ||
    null
  );
}

// ─── Erro de sessão expirada ──────────────────────────────────────────────────
export class SessionExpiredError extends Error {
  constructor() {
    super('Sessão expirada. Por favor, faça login novamente.');
    this.name = 'SessionExpiredError';
  }
}

// ─── Decode JWT local (sem validar assinatura) ────────────────────────────────
function decodeJwtPayload(token: string): { exp?: number; sub?: string; workspace_id?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string, bufferSeconds = 120): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() / 1000 > payload.exp - bufferSeconds;
}

// ─── Renovar via cookie HttpOnly (POST /api/auth/refresh) ────────────────────
async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',  // envia o cookie bawzi_refresh automaticamente
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// Wrapper que evita refreshes paralelos (race condition em tabs/requests simultâneos)
async function renewToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = doRefresh().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

// ─── Limpar sessão ────────────────────────────────────────────────────────────
export function clearSession(): void {
  _accessToken = null;
  if (typeof window === 'undefined') return;
  localStorage.removeItem('bawzi_tier');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_email');
  localStorage.removeItem('bawzi_user');
  // Manter bawzi_token por retrocompatibilidade com componentes ainda não migrados
  localStorage.removeItem('bawzi_token');
  window.dispatchEvent(new CustomEvent('bawzi_session_expired'));
}

// ─── Inicialização de sessão (chamar no mount do app) ────────────────────────
export async function initSession(): Promise<string | null> {
  // Tenta hidratar a partir do cookie (Fase 2 — caminho seguro)
  const token = await renewToken();
  if (token) {
    _accessToken = token;
    // Manter localStorage em sync para componentes legacy
    localStorage.setItem('bawzi_token', token);
    return token;
  }
  // Fallback: verificar localStorage (utilizadores que fizeram login antes da Fase 2)
  const legacy = typeof window !== 'undefined' ? localStorage.getItem('bawzi_token') : null;
  if (legacy) {
    _accessToken = legacy;
    return legacy;
  }
  return null;
}

// ─── Obter token actualizado ──────────────────────────────────────────────────
async function getFreshToken(): Promise<string | null> {
  if (!_accessToken) return null;

  if (isTokenExpiringSoon(_accessToken)) {
    const newToken = await renewToken();
    if (newToken) {
      _accessToken = newToken;
      localStorage.setItem('bawzi_token', newToken);
      return newToken;
    }
    clearSession();
    throw new SessionExpiredError();
  }

  return _accessToken;
}

// ─── apiFetch ─────────────────────────────────────────────────────────────────
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  skipAuth = false,
): Promise<Response> {
  if (skipAuth) return fetch(url, options);

  const token = await getFreshToken();

  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...options, headers });

  // 401 do servidor → tenta renovar + repete uma vez
  if (response.status === 401 && token) {
    const newToken = await renewToken();
    if (newToken) {
      _accessToken = newToken;
      localStorage.setItem('bawzi_token', newToken);
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      return fetch(url, { ...options, headers: retryHeaders });
    }
    clearSession();
    throw new SessionExpiredError();
  }

  return response;
}

// ─── Utilitário: minutos restantes de sessão ─────────────────────────────────
export function sessionMinutesRemaining(): number | null {
  if (!_accessToken) return null;
  const payload = decodeJwtPayload(_accessToken);
  if (!payload?.exp) return null;
  return Math.max(0, Math.floor((payload.exp - Date.now() / 1000) / 60));
}
