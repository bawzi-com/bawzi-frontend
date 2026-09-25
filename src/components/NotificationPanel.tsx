'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, BellRing, CheckCheck, CheckCircle2, Trash2 } from 'lucide-react';
import { API_URL, apiFetch, SessionExpiredError } from '@/lib/apiClient';
import {
  contagemDoSino, contagensPorTipo, filtrarPorTipo, rodapeDoRadar, secoesDoRadar, subtituloDoRadar,
  type GrupoDeAlertas, type Notificacao, type TipoDeAlerta,
} from '@/lib/radar';
import { CardDeAlerta, ChipsDoRadar, SecaoVencidos, type EstadoDoCard } from './SinoDeAlertas';

// O modelo do alerta mora em `lib/radar` (25/09/2026), junto do que a tela
// calcula a partir dele; fica exportado daqui para quem já importava.
export type { Notificacao } from '@/lib/radar';

/** Para onde um clique leva. `analysisId` é o que transforma "abrir a Gestão"
 *  em "abrir ESTE edital na Gestão". */
export interface AlvoNotificacao {
  analysisId?: string;
  ncp?: string;
}

interface NotificationPanelProps {
  token: string;
  onNavigate?: (tab: string, alvo?: AlvoNotificacao) => void;
  onCountChange?: (count: number) => void;
}

/** O que o teto do servidor devolve no máximo (`_LIMITE_NAO_LIDAS`). Ao bater
 *  nele o cabeçalho diz "100+", em vez de fingir que a conta é essa. */
const TETO_DO_SERVIDOR = 100;

// ─────────────────────────────────────────────
// Hook reutilizável
// ─────────────────────────────────────────────
export function useNotificacoes(token: string, onCountChange?: (n: number) => void) {
  const [notifs, setNotifs]   = useState<Notificacao[]>([]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  /** Quando o servidor respondeu pela última vez — é o que o rodapé mostra,
   *  no lugar do "Atualização semanal" que não era verdade para nenhum tipo. */
  const [ultimaVerificacao, setUltimaVerificacao] = useState<Date | null>(null);
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/notifications/check`, {
        method: 'POST',
      });
      if (!res.ok) return;
      // ⚠️ A ANOTAÇÃO DE TIPO NÃO VERIFICA NADA EM TEMPO DE EXECUÇÃO.
      // `const data: Notificacao[] = await res.json()` convence o TypeScript e
      // não convence o navegador: se a rota devolver 200 com qualquer coisa
      // que não seja lista, o `.filter()` da linha seguinte lança e derruba a
      // PÁGINA INTEIRA no ErrorBoundary — sino quebrado vira tela branca.
      // Descobri isto sem querer, com um stub que devolvia `{}`.
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.warn('[notificacoes] resposta fora do formato esperado:', data);
        return;
      }
      setNotifs(data as Notificacao[]);
      setUltimaVerificacao(new Date());
      onCountChange?.(contagemDoSino(data as Notificacao[]));
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      /* silencioso */
    } finally {
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

  /** Marca lidas (mantém na lista até a próxima verificação). Uma chamada
   *  para o grupo inteiro: tirar o card das três alterações tira as três. */
  const marcarLidas = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await apiFetch(`${API_URL}/api/notifications/read-many`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      /* silencioso */
    }
    const marcados = new Set(ids);
    setNotifs(prev => {
      const updated = prev.map(n => marcados.has(n._id) ? { ...n, lida: true } : n);
      onCountChange?.(contagemDoSino(updated));
      return updated;
    });
  }, [token, onCountChange]);

  // Marca como lida + registra como "aberto" (quando o CTA é clicado)
  const abrirNotificacoes = useCallback(async (ids: string[]) => {
    await marcarLidas(ids);
    setAbertos(prev => new Set([...prev, ...ids]));
  }, [marcarLidas]);

  // Marca todas como lidas (mantém na lista)
  const marcarTodasLidas = useCallback(async () => {
    try {
      await apiFetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
      });
      setNotifs(prev => prev.map(n => ({ ...n, lida: true })));
      onCountChange?.(0);
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      /* silencioso */
    }
  }, [token, onCountChange]);

  /** Tira da lista (o servidor só marca lida: o fingerprint fica, para o
   *  alerta não renascer). Serve para um grupo e para "Limpar vencidos". */
  const remover = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await apiFetch(`${API_URL}/api/notifications/read-many`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      /* silencioso */
    }
    const removidos = new Set(ids);
    setNotifs(prev => {
      const updated = prev.filter(n => !removidos.has(n._id));
      onCountChange?.(contagemDoSino(updated));
      return updated;
    });
    setAbertos(prev => { const s = new Set(prev); ids.forEach((id) => s.delete(id)); return s; });
  }, [token, onCountChange]);

  // Remove todas as notificações
  const removerTodas = useCallback(async () => {
    try {
      await apiFetch(`${API_URL}/api/notifications`, {
        method: 'DELETE',
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      /* silencioso */
    }
    setNotifs([]);
    setAbertos(new Set());
    onCountChange?.(0);
  }, [token, onCountChange]);

  return {
    notifs, abertos, loading, checked, ultimaVerificacao,
    check, marcarLidas, abrirNotificacoes,
    marcarTodasLidas, remover, removerTodas,
  };
}

// ─────────────────────────────────────────────
// Painel principal
// ─────────────────────────────────────────────
export default function NotificationPanel({ token, onNavigate, onCountChange }: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [filtro, setFiltro] = useState<TipoDeAlerta | null>(null);
  const [vencidosAbertos, setVencidosAbertos] = useState(false);
  const {
    notifs, abertos, loading, checked, ultimaVerificacao,
    abrirNotificacoes, marcarTodasLidas, remover, removerTodas,
  } = useNotificacoes(token, onCountChange);

  useEffect(() => { setMounted(true); }, []);

  // ⚠️ RECALCULADO A CADA RENDER, DE PROPÓSITO: "vence hoje" tem de virar
  // "venceu ontem" quando o dia vira, sem esperar o alerta mudar. A cada
  // verificação (2 min) a lista é nova e tudo é reavaliado.
  const hoje = new Date();
  const secoes = useMemo(() => secoesDoRadar(notifs, hoje), [notifs]); // eslint-disable-line react-hooks/exhaustive-deps
  const contagens = useMemo(() => contagensPorTipo(secoes.ativos), [secoes]);
  const ativosVisiveis = filtrarPorTipo(secoes.ativos, filtro);
  const vencidosVisiveis = filtrarPorTipo(secoes.vencidos, filtro);
  const unread = notifs.filter(n => !n.lida).length;
  /** O mesmo número que vai para o sino da barra lateral. */
  const pendentes = useMemo(() => contagemDoSino(notifs, hoje), [notifs]); // eslint-disable-line react-hooks/exhaustive-deps
  // Se o tipo filtrado sumiu (apagou o último), o filtro volta para "Todos".
  const filtroValido = filtro === null || contagens.some((c) => c.tipo === filtro);
  const filtroAtivo = filtroValido ? filtro : null;

  function estadoDe(g: GrupoDeAlertas): EstadoDoCard {
    if (g.ids.some((id) => abertos.has(id))) return 'aberto';
    if (g.itens.every((n) => n.lida)) return 'lida';
    return 'pendente';
  }

  /** ⚠️ O DESTINO É A ABA MAIS O ITEM — e o item já vinha junto.
   *
   *  Antes daqui saía só o nome da aba. Uma notificação que diz o nome do
   *  edital, com `dados.analysis_id` no mesmo documento, abria a Gestão na
   *  lista inteira e deixava a pessoa reencontrar à mão aquilo que o alerta
   *  acabara de nomear. Duas telas depois do clique para chegar onde o clique
   *  já sabia.
   *
   *  ⚠️ E `/workspace` RECARREGAVA A PÁGINA. Os alertas de disputa usam a URL
   *  absoluta (é a mesma string do push, que abre o app de fora). Dentro do
   *  app isso virava `window.location.href` — recarga completa, sessão
   *  remontada, e a pessoa caindo na aba padrão em vez da que ela pediu.
   *  Rota interna com aba conhecida agora troca de aba; a recarga fica só
   *  para o que é genuinamente outra página (ex.: `/profile`). */
  const ABAS_INTERNAS = new Set([
    'workspace', 'gestao', 'renovacoes', 'radar', 'history', 'analise', 'concorrentes',
    // O aviso de contrato próprio a vencer (25/09/2026) aponta para cá.
    'meus-contratos',
  ]);

  function destinoDe(n: Notificacao): { aba: string; alvo?: AlvoNotificacao } | null {
    const analysisId = typeof n.dados?.analysis_id === 'string' ? n.dados.analysis_id : undefined;
    const ncp = typeof n.dados?.ncp === 'string' ? n.dados.ncp : undefined;

    let aba: string | null = null;
    if (n.url.startsWith('?tab=')) {
      aba = n.url.slice(5).split('&')[0];
    } else if (n.url === '/workspace' || n.url.startsWith('/workspace?')) {
      const q = n.url.split('?')[1] || '';
      aba = new URLSearchParams(q).get('tab') || (ncp ? 'renovacoes' : 'workspace');
    }
    if (!aba || !ABAS_INTERNAS.has(aba)) return null;
    return { aba, alvo: analysisId || ncp ? { analysisId, ncp } : undefined };
  }

  function abrirGrupo(g: GrupoDeAlertas) {
    const n = g.principal;
    void abrirNotificacoes(g.ids);
    const destino = destinoDe(n);
    if (destino) {
      onNavigate?.(destino.aba, destino.alvo);
      setOpen(false);
      return;
    }
    if (n.url.startsWith('?')) {
      window.location.href = window.location.pathname + n.url;
    } else if (n.url.startsWith('/')) {
      window.location.href = n.url;
    }
  }

  const limparVencidos = () => {
    void remover(secoes.vencidos.flatMap((g) => g.ids));
    setVencidosAbertos(false);
  };

  return (
    <>
      {/* ── Botão sino ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-10 h-10 rounded-2xl text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all"
        aria-label="Notificações"
      >
        <BellRing size={20} className={pendentes > 0 ? 'text-amber-500' : ''} />
        {pendentes > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full leading-none ring-2 ring-white">
            {pendentes > 9 ? '9+' : pendentes}
          </span>
        )}
      </button>

      {/* ── Overlay + Painel renderizados no body via portal ────────────────── */}
      {mounted && createPortal(
        <>
        {open && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px]"
            style={{ zIndex: 9998 }}
            onClick={() => setOpen(false)}
          />
        )}

      {/* ── Painel slide-over ──────────────────────────────────────────────── */}
      <div className={`
        fixed top-0 right-0 h-full w-full max-w-sm flex flex-col
        bg-slate-50 shadow-2xl
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}
      style={{ zIndex: 9999 }}>

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
                {pendentes > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-black text-white tracking-tight">
                  Radar Estratégico
                </h2>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {subtituloDoRadar(pendentes, secoes.vencidos.length, notifs.length >= TETO_DO_SERVIDOR)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {unread > 0 && (
                <button
                  onClick={marcarTodasLidas}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/10"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck size={13} />
                  <span>Lidas</span>
                </button>
              )}
              {notifs.length > 0 && (
                <button
                  onClick={removerTodas}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/10"
                  title="Excluir todas"
                >
                  <Trash2 size={13} />
                  <span>Excluir todas</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Chips por tipo — clicáveis, filtram a lista. Antes eram quatro
              pílulas fixas (compliance, match, renovação, oportunidade) que
              não contavam prazos, mudanças nem disputas — os três tipos que
              mais aparecem — e não faziam nada ao clicar. */}
          <ChipsDoRadar contagens={contagens} ativo={filtroAtivo} onEscolher={setFiltro} />
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

          {/* Só vencidos: o que sobrou já passou. */}
          {checked && notifs.length > 0 && secoes.ativos.length === 0 && (
            <p className="px-3 pt-4 pb-2 text-center text-[11px] font-medium text-slate-400">
              Nada em aberto — o que resta já venceu.
            </p>
          )}

          {/* Cards, um por grupo */}
          {ativosVisiveis.map((g) => (
            <CardDeAlerta key={g.chave} grupo={g} estado={estadoDe(g)} hoje={hoje} onAbrir={abrirGrupo} onRemover={(grupo) => void remover(grupo.ids)} />
          ))}

          <SecaoVencidos
            grupos={vencidosVisiveis}
            aberta={vencidosAbertos}
            onAlternar={() => setVencidosAbertos((v) => !v)}
            onLimpar={limparVencidos}
            estadoDe={estadoDe}
            hoje={hoje}
            onAbrir={abrirGrupo}
            onRemover={(grupo) => void remover(grupo.ids)}
          />
        </div>

        {/* ── Rodapé ───────────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white">
          <p className="text-[10px] text-slate-400 font-medium text-center leading-relaxed">
            {rodapeDoRadar(ultimaVerificacao, hoje)}
          </p>
        </div>
      </div>
        </>,
        document.body
      )}
    </>
  );
}
