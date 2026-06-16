/**
 * pushNotifications.ts
 * ─────────────────────────────────────────────────────────────────
 * Utilitários para registrar o Service Worker e inscrever o usuário
 * em Web Push Notifications após o login.
 *
 * Fluxo:
 *   1. registerServiceWorker()   → registra /sw.js
 *   2. subscribeToPush()         → solicita permissão + envia subscription ao backend
 *   3. unsubscribeFromPush()     → revoga e notifica o backend
 */

import { apiFetch, API_URL } from './apiClient';

// ─── Converte base64url → ArrayBuffer (formato que o PushManager aceita) ──────
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return buffer;
}

// ─── Registra o Service Worker ────────────────────────────────────────────────
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (e) {
    console.warn('[push] falha ao registrar SW:', e);
    return null;
  }
}

// ─── Busca a VAPID public key do backend ─────────────────────────────────────
async function fetchVapidKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/push/vapid-key`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

// ─── Inscreve o usuário em push notifications ─────────────────────────────────
export async function subscribeToPush(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('PushManager' in window)) {
    console.warn('[push] PushManager não suportado neste browser.');
    return false;
  }

  // Solicita permissão (se já foi concedida, não pede de novo)
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.info('[push] permissão negada:', permission);
    return false;
  }

  const reg = await registerServiceWorker();
  if (!reg) return false;

  const vapidKey = await fetchVapidKey();
  if (!vapidKey) {
    console.warn('[push] VAPID key não disponível');
    return false;
  }

  try {
    // Verifica se já tem subscription ativa
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
      });
    }

    // Envia para o backend
    await apiFetch(`${API_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });

    console.info('[push] subscription registrada com sucesso');
    return true;
  } catch (e) {
    console.warn('[push] erro ao subscrever:', e);
    return false;
  }
}

// ─── Remove a subscription ────────────────────────────────────────────────────
export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  try {
    await apiFetch(`${API_URL}/api/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    await sub.unsubscribe();
    console.info('[push] subscription removida');
  } catch (e) {
    console.warn('[push] erro ao remover subscription:', e);
  }
}
