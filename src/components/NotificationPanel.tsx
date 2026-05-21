'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, BellRing, CheckCheck, ExternalLink } from 'lucide-react';

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
  /** Callback para navegar para uma tab interna (ex: "radar", "renovacoes") */
  onNavigate?: (tab: string) => void;
  /** Callback quando a contagem de não-lidas muda */
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
    if (m < 1) return 'agora mesmo';
    if (m < 60) return `há ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  } catch {
    return '';
  }
}

const TIPO_STYLE: Record<string, { border: string; bg: string; dot: string }> = {
  compliance:  { border: 'border-l-red-500',    bg: 'bg-red-50/60',    dot: 'bg-red-500'    },
  matchmaker:  { border: 'border-l-indigo-500', bg: 'bg-indigo-50/60', dot: 'bg-indigo-500' },
  renovacao:   { border: 'border-l-amber-500',  bg: 'bg-amber-50/60',  dot: 'bg-amber-500'  },
  oportunidade:{ border: 'border-l-emerald-500',bg: 'bg-emerald-50/60',dot: 'bg-emerald-500'},
};

// ─────────────────────────────────────────────
// Hook reutilizável
// ─────────────────────────────────────────────
export function useNotificacoes(token: string, onCountChange?: (n: number) => void) {
  const [notifs, setNotifs]     = useState<Notificacao[]>([]);
  const [loading, setLoading]   = useState(false);
  const [checked, setChecked]   = useState(false);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

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
    } catch {
      // silencioso — não bloquear a UI por falha de notificação
    } finally {
      if (!silent) setLoading(false);
      setChecked(true);
    }
  }, [token, onCountChange]);

  // Primeiro check ao montar + polling a cada 2 minutos
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
export default function NotificationPanel({
  token,
  onNavigate,
  onCountChange,
}: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const { notifs, loading, checked, marcarLida, marcarTodasLidas } =
    useNotificacoes(token, onCountChange);

  const unread = notifs.filter(n => !n.lida).length;

  function handleClick(n: Notificacao) {
    marcarLida(n._id);
    // URL relativa → tab interna (ex: "?tab=radar" → "radar")
    if (n.url.startsWith('?tab=')) {
      onNavigate?.(n.url.replace('?tab=', ''));
      setOpen(false);
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
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Painel slide-over ──────────────────────────────────────────────── */}
      <div className={`
        fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col
        bg-white shadow-2xl border-l border-slate-200
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <BellRing size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">
                Radar Estratégico
              </h2>
              {unread > 0 && (
                <p className="text-[10px] text-slate-400 font-medium">
                  {unread} alerta{unread !== 1 ? 's' : ''} não {unread !== 1 ? 'lidos' : 'lido'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={marcarTodasLidas}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
              >
                <CheckCheck size={14} /> Marcar lidas
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading && !checked && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <p className="text-[11px] text-slate-400 font-medium">
                A analisar o seu perfil...
              </p>
            </div>
          )}

          {checked && notifs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-8 text-center">
              <span className="text-4xl">✅</span>
              <p className="text-sm font-black text-slate-700">Tudo em dia!</p>
              <p className="text-[11px] text-slate-400 font-medium">
                Nenhum alerta pendente para o seu workspace.
              </p>
            </div>
          )}

          {notifs.length > 0 && (
            <div className="divide-y divide-slate-50">
              {notifs.map((n) => {
                const style = TIPO_STYLE[n.tipo] ?? TIPO_STYLE.compliance;
                const isExternal = n.url.startsWith('/') && !n.url.startsWith('?');

                return (
                  <button
                    key={n._id}
                    onClick={() => handleClick(n)}
                    className={`
                      w-full text-left px-5 py-4 border-l-4 ${style.border} ${style.bg}
                      hover:brightness-95 transition-all group
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Ícone */}
                      <div className="text-xl shrink-0 mt-0.5 leading-none">
                        {n.icone}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                            {n.titulo}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {n.criada_em && (
                              <span className="text-[9px] font-bold text-slate-400">
                                {timeAgo(n.criada_em)}
                              </span>
                            )}
                            {isExternal && (
                              <ExternalLink size={10} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                          {n.mensagem}
                        </p>
                      </div>
                    </div>

                    {/* CTA sutil */}
                    <div className="mt-2.5 ml-9">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
                        {n.tipo === 'compliance' ? 'Verificar certidões →' :
                         n.tipo === 'matchmaker' ? 'Ver editais →' :
                         n.tipo === 'renovacao'  ? 'Ver contratos →' :
                                                   'Ver oportunidade →'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60">
          <p className="text-[10px] text-slate-400 font-medium text-center leading-relaxed">
            Alertas gerados automaticamente com base no CNAE da empresa.
            Atualização semanal.
          </p>
        </div>
      </div>
    </>
  );
}
