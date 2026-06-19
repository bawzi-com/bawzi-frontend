'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/apiClient';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export const PLAN_INFO: Record<number, { name: string; price: string; features: string[] }> = {
  2: {
    name: 'Essencial',
    price: 'R$ 79/mês',
    features: [
      '1.000 análises/mês',
      'Perfil da empresa (CNPJ/UF)',
      'Central de decisões e laudos',
      'Radar 360 — busca PNCP',
      'Editais até 80.000 chars',
      'PDF até 15 MB',
    ],
  },
  3: {
    name: 'Profissional',
    price: 'R$ 197/mês',
    features: [
      '3.000 análises/mês',
      'Oportunidades com fit CNAE',
      'Monitor inteligente PNCP',
      'Fôlego financeiro',
      '4 Agentes IA em paralelo',
      'Editais até 180.000 chars',
    ],
  },
  4: {
    name: 'Avançado',
    price: 'R$ 497/mês',
    features: [
      'Análises ilimitadas',
      'Gestão do fluxo completo dos editais',
      'Pipeline de renovações',
      'War Room de concorrentes',
      'Simulador tático de preços',
      'Editais até 400.000 chars',
      'PDF até 100 MB',
    ],
  },
};

interface CouponValidation {
  valid: boolean;
  description?: string;
  duration?: string;
  originalPrice?: string;
  finalPrice?: string;
  error?: string;
}

interface ChangePlanModalProps {
  currentTier: number;
  targetTier: number | null;   // null = modal fechado
  onClose: () => void;
  onConfirm: (tier: number, coupon?: string) => Promise<void>;
  isConfirming: boolean;
}

export default function ChangePlanModal({
  currentTier,
  targetTier,
  onClose,
  onConfirm,
  isConfirming,
}: ChangePlanModalProps) {
  const [couponCode, setCouponCode]           = useState('');
  const [couponValidation, setCouponValidation] = useState<CouponValidation | null>(null);
  const [couponLoading, setCouponLoading]     = useState(false);

  // Limpa estado quando o modal fecha / muda de plano alvo
  useEffect(() => {
    setCouponCode('');
    setCouponValidation(null);
  }, [targetTier]);

  // Validação debounced do cupom
  useEffect(() => {
    if (!couponCode.trim() || !targetTier) {
      setCouponValidation(null);
      return;
    }
    setCouponLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/billing/validate-coupon`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: couponCode.trim(), tier: targetTier }),
        });
        const data = await res.json().catch(() => ({ valid: false, error: 'Erro ao validar.' }));
        setCouponValidation(data);
      } catch {
        setCouponValidation({ valid: false, error: 'Erro ao validar cupom.' });
      } finally {
        setCouponLoading(false);
      }
    }, 700);
    return () => { clearTimeout(timer); setCouponLoading(false); };
  }, [couponCode, targetTier]);

  if (!targetTier) return null;

  const current = PLAN_INFO[currentTier];
  const next    = PLAN_INFO[targetTier];
  const isUp    = targetTier > currentTier;

  const handleConfirm = async () => {
    const code = couponCode.trim() || undefined;
    await onConfirm(targetTier, code);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

        {/* Header */}
        <div className={`px-6 py-5 ${isUp ? 'bg-emerald-600' : 'bg-slate-800'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
            {isUp ? 'Upgrade de plano' : 'Downgrade de plano'}
          </p>
          <h2 className="mt-1 text-lg font-black text-white">
            {current?.name ?? `Nível ${currentTier}`} → {next?.name ?? `Nível ${targetTier}`}
          </h2>
          <p className="mt-0.5 text-sm text-white/70">
            {next?.price} · A Stripe aplica ajuste proporcional no ciclo atual
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Comparativo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Plano atual</p>
              <p className="font-black text-slate-950">{current?.name ?? `Nível ${currentTier}`}</p>
              <ul className="mt-2 space-y-1">
                {current?.features.slice(0, 3).map(f => (
                  <li key={f} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                    <span className="text-slate-300 mt-0.5 shrink-0">—</span>{f}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`rounded-xl border p-4 ${isUp ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isUp ? 'text-emerald-600' : 'text-amber-600'}`}>
                Novo plano
              </p>
              <p className="font-black text-slate-950">{next?.name ?? `Nível ${targetTier}`}</p>
              <ul className="mt-2 space-y-1">
                {next?.features.slice(0, 3).map(f => (
                  <li key={f} className={`text-[11px] flex items-start gap-1.5 ${isUp ? 'text-emerald-700' : 'text-amber-800'}`}>
                    <span className="mt-0.5 shrink-0">{isUp ? '✓' : '—'}</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Nota de cobrança */}
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            {isUp
              ? 'O upgrade é imediato. A diferença proporcional do ciclo atual será cobrada no cartão cadastrado.'
              : 'O downgrade ocorre no próximo ciclo. Você mantém os recursos atuais até o fim do período já pago.'}
          </p>

          {/* Cupom de desconto */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              Cupom de desconto{' '}
              <span className="normal-case font-semibold tracking-normal text-slate-300">(opcional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={couponCode}
                onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponValidation(null); }}
                placeholder="Ex: BAWZI30"
                className={`h-10 w-full rounded-lg border px-3 pr-9 text-sm font-mono font-bold text-slate-800
                  placeholder:font-sans placeholder:font-normal placeholder:text-slate-400
                  outline-none transition focus:ring-2 ${
                  couponValidation?.valid
                    ? 'border-emerald-400 bg-emerald-50/50 focus:ring-emerald-100'
                    : couponValidation?.valid === false
                    ? 'border-red-300 bg-red-50/50 focus:ring-red-100'
                    : 'border-slate-200 bg-slate-50 focus:border-emerald-400 focus:ring-emerald-100'
                }`}
              />
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {couponLoading ? (
                  <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : couponValidation?.valid ? (
                  <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : couponValidation?.valid === false ? (
                  <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : null}
              </div>
            </div>

            {couponValidation?.valid && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <p className="text-xs font-black text-emerald-700">
                  ✓ {couponValidation.description}
                  {couponValidation.duration && (
                    <span className="ml-1 font-semibold opacity-70">({couponValidation.duration})</span>
                  )}
                </p>
                <p className="mt-0.5 text-sm font-black text-emerald-800">
                  <span className="line-through opacity-50 mr-1.5">{couponValidation.originalPrice}/mês</span>
                  {couponValidation.finalPrice}/mês
                </p>
              </div>
            )}
            {couponValidation?.valid === false && (
              <p className="mt-1.5 text-xs font-semibold text-red-500">✗ {couponValidation.error}</p>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="h-11 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming || couponLoading}
              className={`h-11 flex-1 rounded-lg text-sm font-black uppercase tracking-wide text-white transition disabled:opacity-50
                ${isUp ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              {isConfirming ? (
                'Alterando...'
              ) : (
                <span className="flex flex-col items-center leading-tight">
                  <span>Confirmar {isUp ? 'upgrade' : 'downgrade'}</span>
                  {couponValidation?.valid && (
                    <span className="text-[10px] font-semibold opacity-80 normal-case tracking-normal">
                      {couponValidation.finalPrice}/mês com desconto
                    </span>
                  )}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
