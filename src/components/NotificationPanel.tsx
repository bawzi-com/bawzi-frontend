'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, BellRing, CheckCheck, ShieldAlert, Zap, RefreshCw, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
export interface Notificacao {
  _id: string;
  tipo: 'compliance' | 'matchmaker' | 'renovacao' | 'oportunidade';
  prioridade: 1 | 2 | 3;
  icone: string;
  titulo: string;
  mensagem: string;
  url: string;
  lida: boolean;
  criada_em?: string;
}

interface NotificationPanelProps {
  token: string;
  onNavigate?: (tab: string) => void;
  onCountChange?: (count: number) => void;
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function timeAgo(iso?: string): string {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  } catch { return ''; }
}

const TIPO_CONFIG: Record<string, {
  accent: string;
  badge: string;
  iconBg: string;
  cta: string;
  ctaHover: string;
  label: string;
}> = {
  compliance:   {
    accent:   'border-red-400',
    badge:    'bg-red-100 text-red-700',
    iconBg:   'bg-red-500',
    cta:      'bg-red-50 border-red-200 text-red-700',
    ctaHover: 'hover:bg-red-100 hover:border-red-400',
    label:    'Compliance',
  },
  matchmaker:   {
    accent:   'border-indigo-400',
    badge:    'bg-indigo-100 text-indigo-700',
    iconBg:   'bg-indigo-500',
    cta:      'bg-indigo-50 border-indigo-200 text-indigo-700',
    ctaHover: 'hover:bg-indigo-100 hover:border-indigo-400',
    label:    'Match',
  },
  renovacao:    {
    accent:   'border-amber-400',
    badge:    'bg-amber-100 text-amber-700',
    iconBg:   'bg-amber-500',
    cta:      'bg-amber-50 border-amber-200 text-amber-700',
    ctaHover: 'hover:bg-amber-100 hover:border-amber-400',
    label:    'Renovação',
  },
  oportunidade: {
    accent:   'border-emerald-400',
    badge:    'bg-emerald-100 text-emerald-700',
    iconBg:   'bg-emerald-500',
    cta:      'bg-emerald-50 border-emerald-200 text-emerald-700',
    ctaHover: 'hover:bg-emerald-100 hover:border-emerald-400',
    label:    'Oportunidade',
  },
};

function TipoIcon({ tipo }: { tipo: string }) {
  const cls = 'text-white';
  const sz  = 17;
  if (tipo === 'compliance')   return <ShieldAlert size={sz} className={cls} />;
  if (tipo === 'matchmaker')   return <Zap         size={sz} className={cls} />;
  if (tipo === 'renovacao')    return <RefreshCw   size={sz} className={cls} />;
  if (tipo === 'oportunidade') return <Sparkles    size={sz} className={cls} />;
  return <ShieldAlert size={sz} className={cls} />;
}

const CTA_LABEL: Record<string, string> = {
  compliance:   'Verificar certidões',
  matchmaker:   'Ver editais',
  renovacao:    'Ver contratos',
  oportunidade: 'Ver oportunidade',
};

// ─────────────────────────────────────────────
// Hook reutilizável
// ─────────────────────────────────────────────
export function useNotificacoes(token: string, onCountChange?: (n: number) => void) {
  const [notifs, setNotifs]   = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: Notificacao[] = await res.json();
      setNotifs(data);
      onCountChange?.(data.filter(n => !n.lida).length);
    } catch { /* silencioso */ } finally {
      if (!silent) setLoading(false);
      setChecked(true);
    }
  }, [token, onCountChange]);

  useEffect(() => {
    if (!token) return;
    check();
    intervalRef.current = setInterval(() => check(true), 120_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [token, check]);

  const marcarLida = useCallback(async (id: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifs(prev => {
        const updated = prev.filter(n => n._id !== id);
        onCountChange?.(updated.filter(n => !n.lida).length);
        return updated;
      });
    } catch { /* silencioso */ }
  }, [token, onCountChange]);

  const marcarTodasLidas = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifs([]);
      onCountChange?.(0);
    } catch { /* silencioso */ }
  }, [token, onCountChange]);

  return { notifs, loading, checked, check, marcarLida, marcarTodasLidas };
}

// ─────────────────────────────────────────────
// Painel principal
// ─────────────────────────────────────────────
export default function NotificationPanel({ token, onNavigate, onCountChange }: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const { notifs, loading, checked, marcarLida, marcarTodasLidas } =
    useNotificacoes(token, onCountChange);

  const unread = notifs.filter(n => !n.lida).length;

  function handleClick(n: Notificacao) {
    marcarLida(n._id);
    if (n.url.startsWith('?tab=') && !n.url.includes('&')) {
      // Navegação SPA simples: apenas troca de aba (ex: ?tab=alertas)
      onNavigate?.(n.url.replace('?tab=', ''));
      setOpen(false);
    } else if (n.url.startsWith('?')) {
      // URL com parâmetros de busca (ex: ?q=losartana&uf=GO) — navegação completa
      window.location.href = window.location.pathname + n.url;
    } else if (n.url.startsWith('/')) {
      window.location.href = n.url;
    }
  }

  return (
    <>
      {/* ── Botão sino ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-10 h-10 rounded-2xl text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
        aria-label="Notificações"
      >
        <BellRing size={20} className={unread > 0 ? 'text-amber-500' : ''} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full leading-none ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Overlay ────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Painel slide-over ──────────────────────────────────────────────── */}
      <div className={`
        fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col
        bg-slate-50 shadow-2xl
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>

        {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pt-6 pb-5">
          {/* Textura sutil */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }} />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Ícone animado */}
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-900/30 shrink-0">
                <BellRing size={18} className="text-white" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-black text-white tracking-tight">
                  Radar Estratégico
                </h2>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {unread > 0
                    ? `${unread} alerta${unread !== 1 ? 's' : ''} pendente${unread !== 1 ? 's' : ''}`
                    : 'Tudo em dia'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {unread > 0 && (
                <button
                  onClick={marcarTodasLidas}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/10"
                >
                  <CheckCheck size={13} />
                  <span>Lidas</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Pills de tipos com contagem */}
          {unread > 0 && (
            <div className="relative flex items-center gap-2 mt-4 flex-wrap">
              {(['compliance','matchmaker','renovacao','oportunidade'] as const).map(tipo => {
                const count = notifs.filter(n => n.tipo === tipo && !n.lida).length;
                if (!count) return null;
                const cfg = TIPO_CONFIG[tipo];
                return (
                  <span key={tipo} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${cfg.badge}`}>
                    {count} {cfg.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Lista ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-2">

          {/* Loading */}
          {loading && !checked && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <p className="text-[11px] text-slate-400 font-medium">A analisar o seu perfil...</p>
            </div>
          )}

          {/* Vazio */}
          {checked && notifs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">Tudo em dia!</p>
                <p className="text-[11px] text-slate-400 font-medium mt-1 leading-relaxed">
                  Nenhum alerta pendente para o seu workspace.
                </p>
              </div>
            </div>
          )}

          {/* Cards */}
          {notifs.map((n) => {
            const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.compliance;
            const isExternal = n.url.startsWith('/') && !n.url.startsWith('?');

            return (
              <div
                key={n._id}
                className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden border-l-4 ${cfg.accent}`}
              >
                {/* Topo do card */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    {/* Ícone */}
                    <div className={`w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                      <TipoIcon tipo={n.tipo} />
                    </div>

                    {/* Texto */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-tight">
                          {n.titulo}
                        </span>
                        {n.criada_em && (
                          <span className="text-[9px] font-bold text-slate-400 shrink-0 bg-slate-50 px-1.5 py-0.5 rounded-md">
                            {timeAgo(n.criada_em)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {n.mensagem}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rodapé do card — CTA */}
                <div className={`px-4 py-2.5 border-t border-slate-100`}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`
                      w-full flex items-center justify-between gap-2
                      px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest
                      transition-all ${cfg.cta} ${cfg.ctaHover}
                    `}
                  >
                    <span>{CTA_LABEL[n.tipo] ?? 'Ver detalhes'}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Rodapé ───────────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white">
          <p className="text-[10px] text-slate-400 font-medium text-center leading-relaxed">
            Alertas gerados automaticamente · Atualização semanal
          </p>
        </div>
      </div>
    </>
  );
}
