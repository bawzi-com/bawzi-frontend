'use client';

import { useState, useEffect, useCallback } from 'react';
import { resolveEffectiveTier } from '@/lib/tier';
import { getAuthToken } from '@/lib/apiClient';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export interface TierState {
  tier: number;
  isPromo: boolean;
  promoExpiresAt: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook centralizado para tier efetivo do usuário.
 *
 * - Inicializa imediatamente do localStorage (sem flash)
 * - Busca /api/users/me + /api/workspace/details e resolve via resolveEffectiveTier
 * - Escuta o evento global `bawzi_update` para reagir a upgrades/downgrades
 * - Persiste no localStorage com timestamp para invalidação por tier_reset_at
 */
export function useTier(): TierState {
  const [tier, setTier]                     = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    return Number(localStorage.getItem('bawzi_tier') || 1);
  });
  const [isPromo, setIsPromo]               = useState(false);
  const [promoExpiresAt, setPromoExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading]           = useState(false);

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      };

      const [userRes, wsRes] = await Promise.all([
        fetch(`${API_URL}/api/users/me?_t=${Date.now()}`, { headers }),
        fetch(`${API_URL}/api/workspace/details`, { headers }),
      ]);

      if (!userRes.ok) return;

      const uData = await userRes.json();
      const wData = wsRes.ok ? await wsRes.json() : {};

      const effective = resolveEffectiveTier(uData.tier, wData.tier);

      // Invalidação por tier_reset_at: se o servidor sinaliza que o tier mudou
      // (ex: promo expirou), sobrescreve o cache local independentemente do valor.
      const serverResetAt  = uData.tier_reset_at ? new Date(uData.tier_reset_at).getTime() : 0;
      const localSetAt     = Number(localStorage.getItem('bawzi_tier_ts') || 0);
      if (serverResetAt > localSetAt || effective !== tier) {
        localStorage.setItem('bawzi_tier', String(effective));
        localStorage.setItem('bawzi_tier_ts', String(Date.now()));
        window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: effective } }));
      }

      setTier(effective);
      setIsPromo(!!uData.is_promo);
      setPromoExpiresAt(uData.promo_expires_at ?? null);
    } catch {
      // silencioso — tier do localStorage continua valendo
    } finally {
      setIsLoading(false);
    }
  }, [tier]);

  // Escuta atualizações globais (disparadas por outros componentes após login/pagamento)
  useEffect(() => {
    const handler = (e: Event) => {
      const novoTier = (e as CustomEvent<{ tier?: number }>).detail?.tier;
      if (novoTier) setTier(t => Math.max(t, novoTier));
    };
    window.addEventListener('bawzi_update', handler);
    return () => window.removeEventListener('bawzi_update', handler);
  }, []);

  return { tier, isPromo, promoExpiresAt, isLoading, refresh };
}
