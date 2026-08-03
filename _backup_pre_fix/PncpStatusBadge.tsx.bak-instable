'use client';

import { useState, useEffect, useRef } from 'react';
import { apiFetch, SessionExpiredError } from '@/lib/apiClient';

export default function PncpStatusBadge() {
  const [status, setStatus] = useState<'online' | 'degraded' | 'instable' | 'offline' | 'checking' | 'error'>('checking');
  const [retrying, setRetrying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; right: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkStatus = async () => {
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
      const res = await apiFetch(`${API_URL}/api/pncp/status`);
      if (!res.ok) throw new Error("Falha na API");
      const data = await res.json();
      setStatus(data.pncp_state || 'error');
      return data.pncp_state || 'error';
    } catch (err) {
      if (err instanceof SessionExpiredError) return 'error';
      setStatus('error');
      return 'error';
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    setShowTooltip(false);
    setStatus('checking');
    const result = await checkStatus();
    setRetrying(false);
    if (result === 'offline' || result === 'error') {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setTooltipPos({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
        });
      }
      setShowTooltip(true);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      tooltipTimer.current = setTimeout(() => setShowTooltip(false), 6000);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 120000);
    return () => {
      clearInterval(interval);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };
  }, []);

  useEffect(() => {
    checkStatus();
    // Verifica a cada 2 minutos
    const interval = setInterval(checkStatus, 120000);
    return () => clearInterval(interval);
  }, []);

  const config = {
    checking: {
      text: 'A Verificar...',
      color: 'text-slate-500',
      bg: 'bg-slate-50 border-slate-200',
      dot: 'bg-slate-400',
      animate: 'animate-pulse'
    },
    online: {
      text: 'PNCP Operacional',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
      animate: 'animate-pulse'
    },
    degraded: {
      text: 'Radar Operacional',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50 border-emerald-200',
      dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
      animate: 'animate-pulse'
    },
    instable: {
      text: 'PNCP Instável',
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
      animate: 'animate-ping'
    },
    offline: {
      text: 'PNCP Offline',
      color: 'text-red-600',
      bg: 'bg-red-50 border-red-200',
      dot: 'bg-red-500',
      animate: ''
    },
    error: {
      text: 'Status Desconhecido',
      color: 'text-slate-500',
      bg: 'bg-slate-100 border-slate-300',
      dot: 'bg-slate-400',
      animate: ''
    }
  }[status];

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Tooltip após retry sem sucesso — fixed para escapar qualquer overflow pai */}
      {showTooltip && tooltipPos && (
        <div
          className="fixed z-[9999] w-72 animate-in fade-in slide-in-from-top-1 duration-200"
          style={{ top: tooltipPos.top, right: tooltipPos.right }}
        >
          <div className="rounded-2xl border border-amber-200 bg-white shadow-xl p-4">
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5 shrink-0">🔌</span>
              <div>
                <p className="text-xs font-black text-slate-900">PNCP temporariamente indisponível</p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                  O portal do governo está fora do ar. Suas análises continuam funcionando com os dados locais. Tente novamente em alguns minutos.
                </p>
              </div>
            </div>
            {/* Seta apontando para cima */}
            <div className="absolute -top-1.5 right-5 h-3 w-3 rotate-45 border-t border-l border-amber-200 bg-white" />
          </div>
        </div>
      )}

      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bg} transition-all duration-500`}>
        <div className="relative flex h-2 w-2">
          {config.animate && (
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot} ${config.animate}`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`}></span>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest ${config.color} flex items-center gap-1`}>
          {config.text}
        </span>
        {(status === 'offline' || status === 'error') && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            title="Verificar novamente"
            className={`ml-1 text-[9px] text-slate-400 hover:text-slate-600 transition-all disabled:opacity-40 ${retrying ? 'animate-spin' : 'hover:scale-125'}`}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
