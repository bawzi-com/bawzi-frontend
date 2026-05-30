'use client';

import { useState, useEffect } from 'react';
import {
  Scale, CheckCircle2, XCircle, AlertTriangle, CalendarDays,
  ChevronRight, ArrowLeft, TrendingUp,
} from 'lucide-react';
import { API_URL } from '@/lib/apiClient';
import type { SavedAnalysis } from '@/lib/types';

// ─── Tipos locais (extraídos dos campos unknown de SavedAnalysis) ──────────────

interface SemaforoItem { status: 'ok' | 'alerta' | 'risco'; motivo: string; }
interface Semaforo {
  tecnica?: SemaforoItem;
  financeira?: SemaforoItem;
  juridica?: SemaforoItem;
  documentacao?: SemaforoItem;
}
interface RiskItem { titulo: string; descricao?: string; }

// ─── Helpers de cor ────────────────────────────────────────────────────────────

function scoreColors(score: number) {
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-200', label: 'Go' };
  if (score >= 45) return { bar: 'bg-amber-400',   text: 'text-amber-700',   light: 'bg-amber-50',   border: 'border-amber-200',   label: 'Atenção' };
  return             { bar: 'bg-red-500',     text: 'text-red-700',     light: 'bg-red-50',     border: 'border-red-200',     label: 'No-Go' };
}

function semaforoBg(status: string) {
  if (status === 'ok')     return 'bg-emerald-50 border-emerald-100 text-emerald-800';
  if (status === 'alerta') return 'bg-amber-50   border-amber-100   text-amber-800';
  return                          'bg-red-50     border-red-100     text-red-800';
}

function SemaforoIcon({ status }: { status: string }) {
  if (status === 'ok')     return <CheckCircle2  size={13} className="text-emerald-600 shrink-0" />;
  if (status === 'alerta') return <AlertTriangle size={13} className="text-amber-500   shrink-0" />;
  return                          <XCircle       size={13} className="text-red-600     shrink-0" />;
}

// ─── Coluna de uma análise na view de comparação ───────────────────────────────

function CompareColumn({ item, label, isWinner }: { item: SavedAnalysis; label: 'A' | 'B'; isWinner: boolean }) {
  const score      = item.score ?? 0;
  const c          = scoreColors(score);
  const semaforo   = (item as unknown as { semaforo?: Semaforo }).semaforo;
  const risks      = ((item as unknown as { risks?: RiskItem[] }).risks ?? []).slice(0, 3);
  const vantagens  = ((item as unknown as { vantagens?: string[] }).vantagens ?? []).slice(0, 3);
  const dims: { label: string; data?: SemaforoItem }[] = [
    { label: 'Jurídica',      data: semaforo?.juridica },
    { label: 'Financeira',    data: semaforo?.financeira },
    { label: 'Técnica',       data: semaforo?.tecnica },
    { label: 'Documentação',  data: semaforo?.documentacao },
  ];

  return (
    <div className={`flex flex-col gap-4 rounded-[2rem] border-2 p-5 ${
      isWinner
        ? 'border-emerald-400 bg-emerald-50/30 shadow-lg shadow-emerald-500/10'
        : 'border-slate-200 bg-white shadow-sm'
    }`}>

      {/* Rótulo A/B + winner badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
          {label}
        </span>
        {isWinner && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
            <TrendingUp size={11} />
            Melhor opção
          </span>
        )}
      </div>

      {/* Título */}
      <h3 className="text-sm font-black leading-snug text-slate-900 line-clamp-3">
        {item.title || 'Análise de edital'}
      </h3>

      {/* Score */}
      <div className={`rounded-2xl border p-4 text-center ${c.light} ${c.border}`}>
        <span className={`block text-5xl font-black leading-none ${c.text}`}>{score}</span>
        <span className={`mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-black uppercase ${c.text}`}>
          {c.label}
        </span>
        {item.classification && (
          <p className="mt-1.5 text-[11px] font-bold text-slate-500">{item.classification}</p>
        )}
      </div>

      {/* Meta */}
      <div className="space-y-1.5 text-xs">
        {item.estimated_value && (
          <div className="flex items-start gap-2">
            <span className="w-20 shrink-0 font-bold text-slate-400">Valor est.</span>
            <span className="font-semibold text-slate-700">{item.estimated_value}</span>
          </div>
        )}
        {(item.uf || item.estado) && (
          <div className="flex items-start gap-2">
            <span className="w-20 shrink-0 font-bold text-slate-400">UF</span>
            <span className="font-semibold text-slate-700">{item.uf || item.estado}</span>
          </div>
        )}
        {item.created_at && (
          <div className="flex items-center gap-1.5 text-slate-400">
            <CalendarDays size={11} />
            <span className="font-medium">
              {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>

      {/* Semáforo */}
      {semaforo && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Semáforo</p>
          {dims.map(({ label: dim, data }) => data && (
            <div key={dim} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${semaforoBg(data.status)}`}>
              <SemaforoIcon status={data.status} />
              <span className="w-24 shrink-0 font-black">{dim}</span>
              <span className="line-clamp-1 text-[11px] leading-tight opacity-80">{data.motivo}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pontos favoráveis */}
      {vantagens.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Pontos favoráveis</p>
          {vantagens.map((v, i) => (
            <div key={i} className="flex items-start gap-2 text-xs font-medium text-slate-600">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />
              <span className="leading-tight">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Riscos principais */}
      {risks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Riscos principais</p>
          {risks.map((r, i) => (
            <div key={i} className="border-l-2 border-red-200 pl-2 text-xs font-semibold text-slate-600">
              {r.titulo}
            </div>
          ))}
        </div>
      )}

      {/* Recomendação */}
      {item.recommendation && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Recomendação</p>
          <p className="line-clamp-4 text-xs font-medium leading-relaxed text-slate-600">
            {item.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── CompareTab ────────────────────────────────────────────────────────────────

export default function CompareTab({ token }: { token: string }) {
  const [analyses, setAnalyses]     = useState<SavedAnalysis[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [selected, setSelected]     = useState<[SavedAnalysis | null, SavedAnalysis | null]>([null, null]);
  const [comparing, setComparing]   = useState(false);

  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    fetch(`${API_URL}/api/analyses/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        const list: SavedAnalysis[] = data.history || (Array.isArray(data) ? data : []);
        setAnalyses(list);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  const toggle = (item: SavedAnalysis) => {
    setSelected(([a, b]) => {
      if (a?.id === item.id) return [null, b];
      if (b?.id === item.id) return [a, null];
      if (!a) return [item, b];
      if (!b) return [a, item];
      return [item, b]; // substitui A quando ambas estão preenchidas
    });
  };

  const [itemA, itemB] = selected;
  const selectedCount  = selected.filter(Boolean).length;

  // ── Vista de comparação ──────────────────────────────────────────────────────
  if (comparing && itemA && itemB) {
    const scoreA     = itemA.score ?? 0;
    const scoreB     = itemB.score ?? 0;
    const winnerIsA  = scoreA >= scoreB;
    const scoreDiff  = Math.abs(scoreA - scoreB);
    const maxScore   = Math.max(scoreA, scoreB, 1);

    return (
      <div className="animate-in fade-in duration-400 space-y-5 pb-16">

        {/* Barra fixa de topo */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 rounded-[1.5rem] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-md">
          <button
            onClick={() => setComparing(false)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowLeft size={13} />
            Alterar seleção
          </button>
          <div className="flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[11px] font-black uppercase text-violet-700">
            <Scale size={13} />
            Comparação de editais
          </div>
        </div>

        {/* Barra visual de scores */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            Score comparativo
          </p>
          <div className="flex items-end gap-6 h-24">
            {([itemA, itemB] as const).map((item, idx) => {
              const score = item.score ?? 0;
              const c     = scoreColors(score);
              const h     = Math.max(16, Math.round((score / maxScore) * 88));
              return (
                <div key={item.id} className="flex flex-1 flex-col items-center gap-2">
                  <span className={`text-3xl font-black ${c.text}`}>{score}</span>
                  <div className="w-full flex items-end justify-center">
                    <div className={`w-full rounded-t-xl ${c.bar} transition-all`} style={{ height: `${h}px` }} />
                  </div>
                  <span className="text-[11px] font-black uppercase text-slate-500">
                    Edital {idx === 0 ? 'A' : 'B'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-sm font-semibold text-slate-500">
            {scoreDiff === 0
              ? 'Scores empatados'
              : `Edital ${winnerIsA ? 'A' : 'B'} lidera por ${scoreDiff} pontos`}
          </p>
        </div>

        {/* Colunas lado a lado */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CompareColumn item={itemA} label="A" isWinner={winnerIsA} />
          <CompareColumn item={itemB} label="B" isWinner={!winnerIsA && scoreB > scoreA} />
        </div>
      </div>
    );
  }

  // ── Estado de carregamento ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-20 text-center text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
        Carregando histórico...
      </div>
    );
  }

  // ── Sem histórico suficiente ──────────────────────────────────────────────────
  if (analyses.length < 2) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white py-20 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
          <Scale size={24} />
        </div>
        <h3 className="text-lg font-black text-slate-800">Histórico insuficiente</h3>
        <p className="mx-auto mt-2 max-w-xs text-sm font-medium text-slate-500">
          É necessário ter pelo menos 2 análises salvas para usar o modo comparação.
        </p>
      </div>
    );
  }

  // ── Ecrã de seleção ───────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-400 space-y-5">

      {/* Cabeçalho + status de seleção */}
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-white via-slate-50 to-violet-50/50 p-5 md:p-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-violet-700 shadow-sm">
            <Scale size={13} />
            Modo comparação
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
            Selecione 2 editais
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
            Escolha dois registos do histórico para comparar scores, semáforo de viabilidade, riscos e pontos-chave lado a lado.
          </p>
        </div>

        {/* Slots de seleção + botão Comparar */}
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {([0, 1] as const).map(i => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition-all ${
                  selected[i]
                    ? 'border-violet-200 bg-violet-50 text-violet-800'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  selected[i] ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-300'
                }`}>
                  {selected[i] && <span className="text-[10px] font-black">{i === 0 ? 'A' : 'B'}</span>}
                </div>
                {selected[i]
                  ? <span className="max-w-[140px] truncate">{selected[i]!.title || 'Edital'}</span>
                  : <span>Edital {i === 0 ? 'A' : 'B'}</span>
                }
                {selected[i] && (
                  <button
                    onClick={() => setSelected(prev => { const next = [...prev] as typeof prev; next[i] = null; return next; })}
                    className="ml-1 text-violet-400 hover:text-violet-700 transition-colors"
                    aria-label="Remover"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => setComparing(true)}
            disabled={selectedCount < 2}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Comparar
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Lista de análises seleccionáveis */}
      <div className="grid gap-3">
        {analyses.map(item => {
          const score      = item.score ?? 0;
          const c          = scoreColors(score);
          const isA        = selected[0]?.id === item.id;
          const isB        = selected[1]?.id === item.id;
          const isSelected = isA || isB;

          return (
            <button
              key={item.id}
              onClick={() => toggle(item)}
              className={`group w-full overflow-hidden rounded-[1.5rem] border-2 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                isSelected
                  ? 'border-violet-400 ring-4 ring-violet-500/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`h-1.5 ${c.bar}`} />
              <div className="grid gap-4 p-4 md:grid-cols-[96px_minmax(0,1fr)_auto] md:items-center md:p-5">

                {/* Score */}
                <div className={`flex items-center justify-between rounded-2xl border p-3 md:block md:text-center ${c.light} ${c.border}`}>
                  <div>
                    <span className={`block text-3xl font-black leading-none ${c.text}`}>{score}</span>
                    <span className="mt-1 block text-[9px] font-black uppercase text-slate-400">score</span>
                  </div>
                  <span className={`rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase md:mt-3 md:inline-block ${c.text}`}>
                    {c.label}
                  </span>
                </div>

                {/* Conteúdo */}
                <div className="min-w-0">
                  <h3 className={`text-base font-black leading-snug text-slate-950 transition-colors ${isSelected ? 'text-violet-800' : 'group-hover:text-violet-700'}`}>
                    {item.title || 'Análise de edital'}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-relaxed text-slate-500">
                    {item.summary || item.recommendation || '—'}
                  </p>
                  {item.created_at && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <CalendarDays size={11} />
                      {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>

                {/* Indicador de seleção A/B */}
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition-all ${
                  isSelected
                    ? 'border-violet-500 bg-violet-500 text-white'
                    : 'border-slate-200 bg-white text-slate-400 group-hover:border-violet-300 group-hover:text-violet-400'
                }`}>
                  {isA && <span className="text-sm font-black">A</span>}
                  {isB && <span className="text-sm font-black">B</span>}
                  {!isSelected && <Scale size={16} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
