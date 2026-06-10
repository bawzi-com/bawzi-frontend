'use client';

import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// Classes completas são necessárias para o Tailwind JIT não purgá-las
const PLAN_INFO: Record<number, { name: string; price: string; headerClass: string }> = {
  2: { name: 'Essencial',     price: 'R$ 79/mês',  headerClass: 'bg-gradient-to-r from-sky-500 to-indigo-500' },
  3: { name: 'Profissional',  price: 'R$ 197/mês', headerClass: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
  4: { name: 'Avançado',      price: 'R$ 497/mês', headerClass: 'bg-gradient-to-r from-amber-500 to-orange-500' },
};

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: number;
  clientSecret: string | null;
}

export default function UpgradeModal({ isOpen, onClose, tier, clientSecret }: UpgradeModalProps) {
  if (!isOpen) return null;

  const plan = PLAN_INFO[tier] ?? { name: 'Plano Bawzi', price: '', headerClass: 'bg-gradient-to-r from-emerald-500 to-sky-500' };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-[2rem] shadow-2xl relative flex flex-col overflow-hidden">

        {/* ── Header Bawzi ── */}
        <div className={`${plan.headerClass} px-6 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <img src="/logo-bawzi.png" alt="Bawzi" className="h-7 w-auto brightness-0 invert" />
            <div className="w-px h-5 bg-white/30" />
            <div>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest leading-none">Assinar plano</p>
              <p className="text-white text-sm font-black leading-tight">{plan.name} · {plan.price}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-all text-lg leading-none"
            aria-label="Fechar"
          >
            &times;
          </button>
        </div>

        {/* ── Conteúdo Stripe ── */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
          {clientSecret ? (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Preparando pagamento seguro…</p>
            </div>
          )}
        </div>

        {/* ── Rodapé de confiança ── */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-3 flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="text-[10px] text-slate-400 font-medium">
            Pagamento seguro · Processado por <span className="font-bold text-slate-500">Stripe</span> · Cancele quando quiser
          </p>
        </div>

      </div>
    </div>
  );
}
