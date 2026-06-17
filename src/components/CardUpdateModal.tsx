'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

// ── Ícones de bandeiras de cartão ─────────────────────────────────────────────
function VisaIcon() {
  return (
    <svg viewBox="0 0 38 24" className="h-5 w-auto" aria-label="Visa">
      <rect width="38" height="24" rx="4" fill="#1A1F71" />
      <text x="6" y="17" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial">VISA</text>
    </svg>
  );
}
function MastercardIcon() {
  return (
    <svg viewBox="0 0 38 24" className="h-5 w-auto" aria-label="Mastercard">
      <rect width="38" height="24" rx="4" fill="#252525" />
      <circle cx="15" cy="12" r="7" fill="#EB001B" />
      <circle cx="23" cy="12" r="7" fill="#F79E1B" />
      <path d="M19 7.3a7 7 0 010 9.4A7 7 0 0119 7.3z" fill="#FF5F00" />
    </svg>
  );
}

// ── Formulário interno ─────────────────────────────────────────────────────
function CardForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [done,       setDone]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErrorMsg(null);

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMsg(error.message ?? 'Erro ao salvar cartão. Tente novamente.');
      setSubmitting(false);
    } else {
      setDone(true);
      setTimeout(onSuccess, 1200);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-base font-black text-slate-950">Cartão salvo com sucesso!</p>
          <p className="mt-1 text-sm text-slate-500">Sua cobrança será processada normalmente.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <PaymentElement
        options={{
          layout: 'tabs',
          wallets: { applePay: 'never', googlePay: 'never' },
        }}
      />

      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm font-semibold text-red-700">{errorMsg}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe}
        className="relative h-12 w-full overflow-hidden rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
      >
        <span className={`flex items-center justify-center gap-2 transition-all ${submitting ? 'opacity-0' : 'opacity-100'}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Salvar cartão com segurança
        </span>
        {submitting && (
          <span className="absolute inset-0 flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Salvando...
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="text-sm font-semibold text-slate-400 transition hover:text-slate-600 disabled:opacity-40"
      >
        Agora não
      </button>
    </form>
  );
}

// ── Modal externo ──────────────────────────────────────────────────────────
interface CardUpdateModalProps {
  isOpen:       boolean;
  clientSecret: string | null;
  onClose:      () => void;
  onSuccess:    () => void;
}

export default function CardUpdateModal({ isOpen, clientSecret, onClose, onSuccess }: CardUpdateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center sm:items-center p-0 sm:p-6 bg-slate-950/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      <div
        className="relative w-full max-w-md bg-white sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'cardModalIn 0.3s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <style>{`
          @keyframes cardModalIn {
            from { opacity: 0; transform: scale(0.97) translateY(16px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @media (max-width: 639px) {
            @keyframes cardModalIn {
              from { opacity: 0; transform: translateY(100%); }
              to   { opacity: 1; transform: translateY(0); }
            }
          }
        `}</style>

        {/* ── Header visual ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 px-6 pb-6 pt-5">
          {/* Orb decorativo */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 left-4 h-20 w-20 rounded-full bg-teal-400/10 blur-xl" />

          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Ícone */}
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">Faturamento</p>
                <h2 className="mt-0.5 text-base font-black text-white">Cartão de pagamento</h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
              aria-label="Fechar"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="relative mt-3 text-sm leading-5 text-white/60">
            Adicione ou substitua o cartão usado nas cobranças da sua assinatura Bawzi.
          </p>
        </div>

        {/* ── Body ── */}
        <div className="p-6">
          {!STRIPE_KEY ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-slate-700">Configuração pendente</p>
                <p className="mt-1 text-xs text-slate-400">A chave Stripe não está definida neste ambiente.</p>
              </div>
            </div>
          ) : clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#059669',
                    colorBackground: '#ffffff',
                    colorText: '#0f172a',
                    colorDanger: '#dc2626',
                    borderRadius: '10px',
                    fontFamily: 'inherit',
                    spacingUnit: '4px',
                  },
                  rules: {
                    '.Input': { boxShadow: 'none', border: '1.5px solid #e2e8f0' },
                    '.Input:focus': { boxShadow: 'none', border: '1.5px solid #059669' },
                    '.Label': { fontWeight: '600', color: '#475569', fontSize: '12px' },
                  },
                },
              }}
            >
              <CardForm onSuccess={onSuccess} onClose={onClose} />
            </Elements>
          ) : (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 rounded-full border-[3px] border-slate-100" />
                <div className="absolute inset-0 rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin" />
                <svg className="absolute inset-0 m-auto h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Preparando formulário seguro...</p>
                <p className="mt-0.5 text-xs text-slate-400">Conectando ao Stripe</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-[11px] font-medium text-slate-400">
              SSL 256-bit · via <span className="font-semibold text-slate-500">Stripe</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <VisaIcon />
            <MastercardIcon />
          </div>
        </div>
      </div>
    </div>
  );
}
