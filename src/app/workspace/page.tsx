'use client'; // 🟢 1. Adicionado para podermos executar código no browser (useEffect)

import { useEffect } from 'react';
import AnalysisApp from '../../components/analysis-app';
import ErrorBoundary from '../../components/ErrorBoundary';
import { apiFetch, API_URL, getAuthToken } from '@/lib/apiClient';

export default function WorkspacePage() {
  
  // Polling robusto pós-pagamento: até 6 tentativas com 2 s de intervalo,
  // igual ao padrão já usado em profile/page.tsx.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== 'true') return;

    // Limpa o parâmetro da URL imediatamente para não re-disparar no reload
    window.history.replaceState({}, document.title, window.location.pathname);

    let attempts = 0;
    const MAX_ATTEMPTS = 6;
    const tierAntes = Number(localStorage.getItem('bawzi_tier') || 1);

    const poll = async () => {
      attempts++;
      const token = getAuthToken();
      if (!token) return;

      try {
        // Força sync com Stripe antes de ler os dados
        await apiFetch(`${API_URL}/api/billing/sync`).catch(() => {});

        const [userRes, wsRes] = await Promise.all([
          apiFetch(`${API_URL}/api/users/me`),
          apiFetch(`${API_URL}/api/workspace/details`),
        ]);

        if (userRes.ok && wsRes.ok) {
          const uData = await userRes.json();
          const wData = await wsRes.json();
          const tierNovo = Math.max(wData.tier || 1, uData.tier || 1);

          if (tierNovo !== tierAntes || attempts >= MAX_ATTEMPTS) {
            localStorage.setItem('bawzi_tier', String(tierNovo));
            window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: tierNovo } }));
            window.location.reload();
          } else {
            setTimeout(poll, 2000);
          }
        } else if (attempts < MAX_ATTEMPTS) {
          setTimeout(poll, 2000);
        }
      } catch {
        if (attempts < MAX_ATTEMPTS) setTimeout(poll, 2000);
      }
    };

    poll();
  }, []);

  return (
    <div className="pt-8">
      <ErrorBoundary>
        <AnalysisApp />
      </ErrorBoundary>
    </div>
  );
}