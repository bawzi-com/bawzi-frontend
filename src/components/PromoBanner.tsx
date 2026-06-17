'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Copy, Check, ArrowRight, Tag } from 'lucide-react';

interface BannerData {
  active: boolean;
  title?: string;
  description?: string;
  coupon_code?: string;
  discount_label?: string;
  color?: string;
  expires_at?: string | null;
  link_text?: string | null;
  link_url?: string | null;
  dismissible?: boolean;
}

const COLOR_MAP: Record<string, { bar: string; badge: string; btn: string; text: string; subtext: string; copy: string }> = {
  emerald: {
    bar:     'bg-gradient-to-r from-emerald-600 to-emerald-500',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-emerald-700 hover:bg-emerald-50',
    text:    'text-white',
    subtext: 'text-emerald-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
  },
  amber: {
    bar:     'bg-gradient-to-r from-amber-500 to-amber-400',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-amber-700 hover:bg-amber-50',
    text:    'text-white',
    subtext: 'text-amber-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
  },
  violet: {
    bar:     'bg-gradient-to-r from-violet-600 to-violet-500',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-violet-700 hover:bg-violet-50',
    text:    'text-white',
    subtext: 'text-violet-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
  },
  rose: {
    bar:     'bg-gradient-to-r from-rose-600 to-rose-500',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-rose-700 hover:bg-rose-50',
    text:    'text-white',
    subtext: 'text-rose-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
  },
  sky: {
    bar:     'bg-gradient-to-r from-sky-600 to-sky-500',
    badge:   'bg-white/20 text-white border-white/30',
    btn:     'bg-white text-sky-700 hover:bg-sky-50',
    text:    'text-white',
    subtext: 'text-sky-100',
    copy:    'bg-white/15 hover:bg-white/25 text-white border-white/20',
  },
};

function useCountdown(expiresAt: string | null | undefined) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining(''); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (d > 0) setRemaining(`${d}d ${h.toString().padStart(2, '0')}h`);
      else setRemaining(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

export default function PromoBanner() {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown(banner?.expires_at);

  useEffect(() => {
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
    fetch(`${API_URL}/api/admin/promo-banner/public`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.active) return;
        // Verifica se o usuário já dispensou este cupom específico
        const key = `promo_dismissed_${data.coupon_code || 'global'}`;
        if (typeof window !== 'undefined' && localStorage.getItem(key)) {
          setDismissed(true);
          return;
        }
        setBanner(data);
      })
      .catch(() => null);
  }, []);

  const handleDismiss = useCallback(() => {
    if (!banner) return;
    const key = `promo_dismissed_${banner.coupon_code || 'global'}`;
    localStorage.setItem(key, '1');
    setDismissed(true);
  }, [banner]);

  const handleCopy = useCallback(async () => {
    if (!banner?.coupon_code) return;
    try {
      await navigator.clipboard.writeText(banner.coupon_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso
    }
  }, [banner?.coupon_code]);

  if (!banner || !banner.active || dismissed) return null;

  const c = COLOR_MAP[banner.color || 'emerald'] ?? COLOR_MAP.emerald;

  return (
    <div className={`relative w-full ${c.bar} print:hidden`} role="banner" aria-label="Oferta promocional">
      <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-center">

        {/* Etiqueta de desconto */}
        {banner.discount_label && (
          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black tracking-wide ${c.badge}`}>
            <Tag size={10} />
            {banner.discount_label}
          </span>
        )}

        {/* Título + descrição */}
        <span className={`text-[13px] font-bold leading-tight ${c.text}`}>
          {banner.title}
          {banner.description && (
            <span className={`ml-1.5 font-medium ${c.subtext}`}>{banner.description}</span>
          )}
        </span>

        {/* Código do cupom com botão de cópia */}
        {banner.coupon_code && (
          <button
            onClick={handleCopy}
            title={copied ? 'Copiado!' : 'Clique para copiar o cupom'}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[12px] font-black tracking-widest transition-all ${c.copy}`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {banner.coupon_code}
          </button>
        )}

        {/* Countdown */}
        {countdown && (
          <span className={`shrink-0 text-[11px] font-black tabular-nums ${c.subtext}`}>
            expira em {countdown}
          </span>
        )}

        {/* CTA */}
        {banner.link_url && banner.link_text && (
          <a
            href={banner.link_url}
            className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[12px] font-black transition-all ${c.btn}`}
          >
            {banner.link_text}
            <ArrowRight size={12} />
          </a>
        )}
      </div>

      {/* Botão fechar */}
      {banner.dismissible !== false && (
        <button
          onClick={handleDismiss}
          aria-label="Fechar banner"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity text-white"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
