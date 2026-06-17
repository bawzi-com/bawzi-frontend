'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// Classes completas são necessárias para o Tailwind JIT não purgá-las
const PLAN_INFO: Record<number, { name: string; price: string; headerClass: string; orbs: string }> = {
  2: { name: 'Essencial',    price: 'R$ 79/mês',  headerClass: 'bg-gradient-to-br from-sky-500 via-sky-500 to-indigo-600',      orbs: 'from-indigo-400/30 to-sky-300/20' },
  3: { name: 'Profissional', price: 'R$ 197/mês', headerClass: 'bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-600', orbs: 'from-teal-400/30 to-emerald-300/20' },
  4: { name: 'Avançado',     price: 'R$ 497/mês', headerClass: 'bg-gradient-to-br from-amber-500 via-amber-500 to-orange-600',   orbs: 'from-orange-400/30 to-amber-300/20' },
};

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: number;
  clientSecret: string | null;
  title?: string;
  eyebrow?: string;
}

export default function UpgradeModal({ isOpen, onClose, tier, clientSecret, title, eyebrow }: UpgradeModalProps) {
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_URL}/api/billing/config`)
      .then(r => r.json())
      .then(data => { if (data.publishable_key) setStripePromise(loadStripe(data.publishable_key)); })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const plan = PLAN_INFO[tier] ?? { name: 'Plano Bawzi', price: '', headerClass: 'bg-gradient-to-br from-emerald-500 to-sky-600', orbs: 'from-sky-400/30 to-emerald-300/20' };
  const modalTitle = title ?? `${plan.name} ${plan.price ? `· ${plan.price}` : ''}`;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md"
      style={{ animation: 'backdropIn 0.25s ease-out' }}
    >
      <style>{`
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>

      {/* Click fora para fechar */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className="relative bg-white w-full max-w-xl max-h-[92vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >

        {/* ── Header ── */}
        <div className={`${plan.headerClass} px-6 py-5 flex items-center justify-between shrink-0 relative overflow-hidden`}>
          {/* Orbs decorativos */}
          <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full bg-gradient-to-br ${plan.orbs} blur-xl pointer-events-none`} />
          <div className={`absolute right-8 -bottom-8 w-20 h-20 rounded-full bg-gradient-to-br ${plan.orbs} blur-lg pointer-events-none`} />

          <div className="relative flex items-center gap-3">
            <img src="/logo-bawzi.png" alt="Bawzi" className="h-7 w-auto brightness-0 invert drop-shadow" />
            <div className="w-px h-5 bg-white/30" />
            <div>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.15em] leading-none mb-1">
                {eyebrow ?? 'Assinar plano'}
              </p>
              <p className="text-white text-[15px] font-black leading-tight drop-shadow-sm">
                {modalTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="relative w-8 h-8 bg-white/15 hover:bg-white/30 active:bg-white/40 rounded-full flex items-center justify-center text-white/90 transition-all duration-150 hover:scale-105 active:scale-95"
            aria-label="Fechar"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Conteúdo Stripe ── */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {clientSecret ? (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-5">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-[3px] border-slate-100 rounded-full" />
                <div className="absolute inset-0 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
                {/* Lock icon no centro */}
                <svg className="absolute inset-0 m-auto w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-700 text-sm font-bold mb-1">Preparando pagamento seguro</p>
                <p className="text-slate-400 text-xs">Conectando ao Stripe…</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Rodapé de confiança ── */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-[11px] text-slate-400 font-medium">
            Pagamento seguro via <span className="font-semibold text-slate-500">Stripe</span> · Criptografia SSL · Cancele quando quiser
          </p>
        </div>

      </div>
    </div>
  );
}
