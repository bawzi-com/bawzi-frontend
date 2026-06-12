'use client';

import { useState, useEffect } from 'react';
import {
  GitCompare, CheckCircle2, XCircle, AlertTriangle, CalendarDays,
  ChevronRight, ArrowLeft, TrendingUp, Copy, Check, Send, Archive, Scale,
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend,
} from 'recharts';
import { API_URL } from '@/lib/apiClient';
import { decisionQueueStages } from '@/lib/decisionQueue';
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

// ─── Lógica de veredito comparativo ───────────────────────────────────────────

const DIMENSOES: { key: keyof Semaforo; label: string }[] = [
  { key: 'juridica',     label: 'Jurídica' },
  { key: 'financeira',   label: 'Financeira' },
  { key: 'tecnica',      label: 'Técnica' },
  { key: 'documentacao', label: 'Documentação' },
];

/** Peso de cada status do semáforo para o duelo dimensional. */
const SEM_PESO: Record<string, number> = { ok: 2, alerta: 1, risco: 0 };

function extrairSemaforo(item: SavedAnalysis): Semaforo | undefined {
  return (item as unknown as { semaforo?: Semaforo }).semaforo;
}

interface DueloRow {
  label: string;
  a?: SemaforoItem;
  b?: SemaforoItem;
  vencedor: 'A' | 'B' | 'empate';
}

/** Compara as 4 dimensões do semáforo e devolve linhas + placar. */
function calcularDuelo(itemA: SavedAnalysis, itemB: SavedAnalysis): {
  rows: DueloRow[]; vitoriasA: number; vitoriasB: number; empates: number;
} {
  const semA = extrairSemaforo(itemA);
  const semB = extrairSemaforo(itemB);
  const rows: DueloRow[] = [];
  let vitoriasA = 0, vitoriasB = 0, empates = 0;

  for (const { key, label } of DIMENSOES) {
    const a = semA?.[key];
    const b = semB?.[key];
    if (!a && !b) continue; // dimensão ausente nas duas análises
    const pa = a ? SEM_PESO[a.status] ?? 0 : -1;
    const pb = b ? SEM_PESO[b.status] ?? 0 : -1;
    const vencedor: DueloRow['vencedor'] = pa === pb ? 'empate' : pa > pb ? 'A' : 'B';
    if (vencedor === 'A') vitoriasA++;
    else if (vencedor === 'B') vitoriasB++;
    else empates++;
    rows.push({ label, a, b, vencedor });
  }
  return { rows, vitoriasA, vitoriasB, empates };
}

/**
 * Veredito comparativo honesto:
 *  - ambos No-Go (score < 45) → "nenhum vale a disputa", sem badge de vencedor
 *  - scores diferentes → vence o maior; diferença ≤ 5 = "empate técnico"
 *  - scores iguais → desempate pelo placar dimensional; persiste empate → sem vencedor
 */
function calcularVeredito(itemA: SavedAnalysis, itemB: SavedAnalysis) {
  const scoreA = itemA.score ?? 0;
  const scoreB = itemB.score ?? 0;
  const duelo  = calcularDuelo(itemA, itemB);

  const ambosNoGo = scoreA < 45 && scoreB < 45;

  let vencedor: 'A' | 'B' | null = null;
  if (scoreA !== scoreB) vencedor = scoreA > scoreB ? 'A' : 'B';
  else if (duelo.vitoriasA !== duelo.vitoriasB) vencedor = duelo.vitoriasA > duelo.vitoriasB ? 'A' : 'B';

  const empateTecnico = Math.abs(scoreA - scoreB) <= 5;

  return { scoreA, scoreB, duelo, ambosNoGo, vencedor, empateTecnico };
}

/** Converte string monetária BR ("R$ 197.935,26") em número; null se sigiloso/ausente. */
function parseValorBRL(s?: string): number | null {
  if (!s) return null;
  const m = s.replace(/\s/g, '').match(/R?\$?([\d.]+(?:,\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normTxt(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function risksDe(item: SavedAnalysis): RiskItem[] {
  return ((item as unknown as { risks?: RiskItem[] }).risks ?? []).filter(r => r?.titulo);
}

/** Separa riscos em comuns (presentes nas duas análises) e exclusivos de cada uma. */
function separarRiscos(itemA: SavedAnalysis, itemB: SavedAnalysis): {
  comuns: string[]; soA: string[]; soB: string[];
} {
  const a = risksDe(itemA).map(r => r.titulo);
  const b = risksDe(itemB).map(r => r.titulo);
  const bNorm = new Set(b.map(normTxt));
  const aNorm = new Set(a.map(normTxt));
  return {
    comuns: a.filter(t => bNorm.has(normTxt(t))),
    soA:    a.filter(t => !bNorm.has(normTxt(t))),
    soB:    b.filter(t => !aNorm.has(normTxt(t))),
  };
}

/** Chip compacto de status de uma dimensão no duelo. */
function StatusChip({ data, destaque }: { data?: SemaforoItem; destaque: boolean }) {
  if (!data) {
    return (
      <span className="inline-flex items-center justify-center rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-300">
        —
      </span>
    );
  }
  const txt = data.status === 'ok' ? 'OK' : data.status === 'alerta' ? 'Alerta' : 'Risco';
  return (
    <span
      title={data.motivo}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${semaforoBg(data.status)} ${
        destaque ? 'ring-2 ring-violet-300 ring-offset-1' : ''
      }`}
    >
      <SemaforoIcon status={data.status} />
      {txt}
    </span>
  );
}

// ─── Coluna de uma análise na view de comparação ───────────────────────────────

function CompareColumn({ item, label, isWinner }: { item: SavedAnalysis; label: 'A' | 'B'; isWinner: boolean }) {
  const score      = item.score ?? 0;
  const c          = scoreColors(score);
  const semaforo   = extrairSemaforo(item);
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
              Analisado em {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
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
  const [busca, setBusca]           = useState('');
  const [ordem, setOrdem]           = useState<'recentes' | 'score'>('recentes');

  // Registro de decisão (move editais no fluxo de trabalho)
  const [decisao, setDecisao]             = useState<'A' | 'B' | 'nenhum' | null>(null);
  const [savingDecisao, setSavingDecisao] = useState(false);
  const [arquivarOutro, setArquivarOutro] = useState(false);
  const [erroDecisao, setErroDecisao]     = useState('');
  const [copiado, setCopiado]             = useState(false);

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

  // Lista filtrada e ordenada para o ecrã de seleção
  const buscaNorm = busca.trim().toLowerCase();
  const listaVisivel = analyses
    .filter(a => {
      if (!buscaNorm) return true;
      return `${a.title || ''} ${a.summary || ''} ${a.uf || a.estado || ''}`.toLowerCase().includes(buscaNorm);
    })
    .sort((a, b) => {
      if (ordem === 'score') return (b.score ?? 0) - (a.score ?? 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  // ── Registro de decisão no fluxo de trabalho ─────────────────────────────────
  const patchWorkflow = async (id: string, status: 'proposal' | 'abandoned') => {
    const tokenLocal = (typeof window !== 'undefined' && localStorage.getItem('bawzi_token')) || token;
    const res = await fetch(`${API_URL}/api/analyses/${id}/workflow`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenLocal}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Falha ao atualizar o fluxo.');
  };

  const registrarDecisao = async (escolha: 'A' | 'B' | 'nenhum') => {
    if (!itemA?.id || !itemB?.id || savingDecisao) return;
    setSavingDecisao(true);
    setErroDecisao('');
    try {
      const statusPorId: Record<string, 'proposal' | 'abandoned'> = {};
      if (escolha === 'nenhum') {
        statusPorId[itemA.id] = 'abandoned';
        statusPorId[itemB.id] = 'abandoned';
      } else {
        const win  = escolha === 'A' ? itemA : itemB;
        const lose = escolha === 'A' ? itemB : itemA;
        statusPorId[win.id!] = 'proposal';
        if (arquivarOutro) statusPorId[lose.id!] = 'abandoned';
      }
      await Promise.all(
        Object.entries(statusPorId).map(([id, st]) => patchWorkflow(id, st))
      );
      const nowIso = new Date().toISOString();
      setAnalyses(prev => prev.map(it =>
        it.id && statusPorId[it.id]
          ? { ...it, workflow_status: statusPorId[it.id], workflow_updated_at: nowIso }
          : it
      ));
      setDecisao(escolha);
    } catch {
      setErroDecisao('Não foi possível registrar a decisão. Verifique a ligação e tente novamente.');
    } finally {
      setSavingDecisao(false);
    }
  };

  // ── Resumo copiável (para partilhar a decisão com a equipe) ──────────────────
  const copiarResumo = async () => {
    if (!itemA || !itemB) return;
    const v = calcularVeredito(itemA, itemB);
    const linha = (lbl: string, it: SavedAnalysis) =>
      `${lbl}) ${it.title || 'Edital'} — score ${it.score ?? 0}/100 (${scoreColors(it.score ?? 0).label})` +
      `${it.estimated_value ? ` — ${it.estimated_value}` : ''}${(it.uf || it.estado) ? ` — ${it.uf || it.estado}` : ''}`;

    const veredito = v.ambosNoGo
      ? 'NENHUM vale a disputa (ambos NO-GO).'
      : v.vencedor
        ? `Disputar o Edital ${v.vencedor}${v.empateTecnico ? ' (margem estreita)' : ''}.`
        : 'Empate técnico — decidir por valor, prazo e proximidade.';

    const duelos = v.duelo.rows
      .map(r => `  • ${r.label}: A ${r.a ? r.a.status.toUpperCase() : '—'} × B ${r.b ? r.b.status.toUpperCase() : '—'}${r.vencedor !== 'empate' ? ` → vence ${r.vencedor}` : ''}`)
      .join('\n');

    const texto = [
      'COMPARAÇÃO DE EDITAIS — BAWZI',
      `Veredito: ${veredito}`,
      '',
      linha('A', itemA),
      linha('B', itemB),
      '',
      duelos ? `Duelo por dimensão:\n${duelos}` : '',
      itemA.recommendation ? `\nRecomendação A: ${itemA.recommendation.slice(0, 300)}` : '',
      itemB.recommendation ? `Recomendação B: ${itemB.recommendation.slice(0, 300)}` : '',
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* clipboard indisponível */ }
  };

  // ── Vista de comparação ──────────────────────────────────────────────────────
  if (comparing && itemA && itemB) {
    const { scoreA, scoreB, duelo, ambosNoGo, vencedor, empateTecnico } = calcularVeredito(itemA, itemB);
    const scoreDiff = Math.abs(scoreA - scoreB);

    // Badge "Melhor opção" só quando há vencedor real e a disputa vale a pena
    const badgeA = vencedor === 'A' && !ambosNoGo;
    const badgeB = vencedor === 'B' && !ambosNoGo;

    const tituloVencedor = vencedor
      ? (vencedor === 'A' ? itemA : itemB).title || `Edital ${vencedor}`
      : '';

    // Dados derivados para radar, números e riscos
    const radarData = duelo.rows.map(r => ({
      dim: r.label,
      A: r.a ? SEM_PESO[r.a.status] ?? 0 : 0,
      B: r.b ? SEM_PESO[r.b.status] ?? 0 : 0,
    }));
    const valorA = parseValorBRL(itemA.estimated_value);
    const valorB = parseValorBRL(itemB.estimated_value);
    const ufEmpresa = (itemA.empresa_contexto?.uf || itemB.empresa_contexto?.uf || '').toUpperCase();
    const ufA = (itemA.uf || itemA.estado || '').toUpperCase();
    const ufB = (itemB.uf || itemB.estado || '').toUpperCase();
    const riscosSep = separarRiscos(itemA, itemB);
    const temRiscos = riscosSep.comuns.length + riscosSep.soA.length + riscosSep.soB.length > 0;
    const fmtBRL = (n: number) =>
      n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

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
          <div className="flex items-center gap-2">
            <button
              onClick={copiarResumo}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
              title="Copia um resumo da comparação para partilhar com a equipe"
            >
              {copiado ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              {copiado ? 'Copiado!' : 'Copiar resumo'}
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[11px] font-black uppercase text-violet-700 sm:flex">
              <GitCompare size={13} />
              Comparação de editais
            </div>
          </div>
        </div>

        {/* ── Veredito comparativo ── */}
        <div className={`rounded-[2rem] border-2 p-5 shadow-sm ${
          ambosNoGo
            ? 'border-red-200 bg-red-50/60'
            : vencedor
              ? 'border-emerald-200 bg-emerald-50/50'
              : 'border-slate-200 bg-white'
        }`}>
          {ambosNoGo ? (
            <div className="flex items-start gap-3">
              <XCircle size={22} className="mt-0.5 shrink-0 text-red-500" />
              <div>
                <p className="text-base font-black text-red-800">
                  Nenhum dos dois vale a disputa
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-red-700/80">
                  Ambos receberam veredito NO-GO (scores {scoreA} e {scoreB}).
                  {vencedor && ` O Edital ${vencedor} está marginalmente à frente, mas isso não muda a recomendação.`}
                  {' '}Não aloque equipe nem orçamento — busque novas oportunidades no Radar PNCP.
                </p>
              </div>
            </div>
          ) : vencedor ? (
            <div className="flex items-start gap-3">
              <TrendingUp size={22} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-base font-black text-emerald-800">
                  Dispute o Edital {vencedor}{empateTecnico ? ' — por margem estreita' : ''}
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-emerald-800/70">
                  <span className="font-bold">{tituloVencedor}</span>
                  {scoreDiff > 0
                    ? ` lidera por ${scoreDiff} ponto${scoreDiff === 1 ? '' : 's'}`
                    : ' empata no score, mas vence no detalhe'}
                  {duelo.rows.length > 0 && (
                    <> e leva {vencedor === 'A' ? duelo.vitoriasA : duelo.vitoriasB} de {duelo.rows.length} dimensões no duelo abaixo</>
                  )}.
                  {empateTecnico && ' A diferença é pequena — valide com os critérios dimensão a dimensão antes de decidir.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <GitCompare size={22} className="mt-0.5 shrink-0 text-slate-400" />
              <div>
                <p className="text-base font-black text-slate-800">Empate técnico</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
                  Scores e dimensões equivalentes. Desempate por critérios de negócio: valor estimado,
                  prazo de entrega da proposta e proximidade geográfica.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Registrar decisão (move os editais no fluxo de trabalho) ── */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          {decisao ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-black text-slate-800">Decisão registrada</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                  {decisao === 'nenhum'
                    ? <>Os dois editais foram movidos para <strong>{decisionQueueStages.abandoned.label}</strong> na Gestão de Decisões.</>
                    : <>
                        O Edital {decisao} foi movido para <strong>{decisionQueueStages.proposal.label}</strong>
                        {arquivarOutro && <> e o Edital {decisao === 'A' ? 'B' : 'A'} para <strong>{decisionQueueStages.abandoned.label}</strong></>}
                        {' '}na Gestão de Decisões.
                      </>}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Scale size={15} className="text-violet-600" />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Registrar decisão no fluxo
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {ambosNoGo ? (
                    <button
                      onClick={() => registrarDecisao('nenhum')}
                      disabled={savingDecisao}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-700 px-5 py-2.5 text-xs font-black uppercase text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Archive size={13} />
                      {savingDecisao ? 'Registrando…' : 'Descartar ambos'}
                    </button>
                  ) : (
                    <>
                      {(['A', 'B'] as const).map(lado => {
                        const recomendado = vencedor === lado;
                        return (
                          <button
                            key={lado}
                            onClick={() => registrarDecisao(lado)}
                            disabled={savingDecisao}
                            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black uppercase transition-all disabled:opacity-50 ${
                              recomendado
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                            }`}
                          >
                            <Send size={13} />
                            {savingDecisao ? 'Registrando…' : `Disputar ${lado}`}
                            {recomendado && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px]">recomendado</span>}
                          </button>
                        );
                      })}
                      <label className="ml-1 flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-500">
                        <input
                          type="checkbox"
                          checked={arquivarOutro}
                          onChange={e => setArquivarOutro(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-violet-600"
                        />
                        Arquivar o não escolhido
                      </label>
                    </>
                  )}
                </div>
                <p className="text-[10px] font-medium text-slate-400">
                  Disputar move para <strong>{decisionQueueStages.proposal.label}</strong> · arquivar move para <strong>{decisionQueueStages.abandoned.label}</strong>
                </p>
              </div>
              {erroDecisao && (
                <p className="mt-2 text-xs font-bold text-red-600">{erroDecisao}</p>
              )}
            </>
          )}
        </div>

        {/* Barra visual de scores — escala absoluta 0-100 */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            Score comparativo <span className="text-slate-300">· escala 0-100</span>
          </p>
          <div className="flex items-end gap-6">
            {([itemA, itemB] as const).map((item, idx) => {
              const score = item.score ?? 0;
              const c     = scoreColors(score);
              const h     = Math.max(6, Math.round((Math.min(score, 100) / 100) * 88));
              return (
                <div key={item.id} className="flex flex-1 flex-col items-center gap-2">
                  <span className={`text-3xl font-black ${c.text}`}>{score}</span>
                  {/* Trilha 0-100 com marcas das faixas 45 (Atenção) e 70 (Go) */}
                  <div className="relative h-[88px] w-full overflow-hidden rounded-xl bg-slate-100">
                    <div className="absolute inset-x-0 border-t border-dashed border-emerald-300" style={{ bottom: '70%' }} />
                    <div className="absolute inset-x-0 border-t border-dashed border-amber-300" style={{ bottom: '45%' }} />
                    <div
                      className={`absolute inset-x-0 bottom-0 ${c.bar} transition-all`}
                      style={{ height: `${h}px` }}
                    />
                  </div>
                  <span className="text-[11px] font-black uppercase text-slate-500">
                    Edital {idx === 0 ? 'A' : 'B'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[10px] font-bold text-slate-400">
            <span className="text-amber-500">- - 45</span> limiar de Atenção · <span className="text-emerald-500">- - 70</span> limiar de Go
          </p>
        </div>

        {/* ── Duelo dimensão a dimensão + radar ── */}
        {duelo.rows.length > 0 && (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              Duelo dimensão a dimensão
            </p>
            <div className={`grid items-center gap-4 ${radarData.length >= 3 ? 'md:grid-cols-2' : ''}`}>
              {/* Radar das dimensões — só com 3+ dimensões avaliadas */}
              {radarData.length >= 3 && (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="72%">
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                      <PolarRadiusAxis domain={[0, 2]} tick={false} axisLine={false} tickCount={3} />
                      <Radar name="Edital A" dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} strokeWidth={2} />
                      <Radar name="Edital B" dataKey="B" stroke="#0284c7" fill="#0284c7" fillOpacity={0.2} strokeWidth={2} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Linhas do duelo */}
              <div className="space-y-2">
                {duelo.rows.map(row => (
                  <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex justify-end">
                      <StatusChip data={row.a} destaque={row.vencedor === 'A'} />
                    </div>
                    <span className="w-28 text-center text-[11px] font-black uppercase tracking-wide text-slate-500">
                      {row.label}
                    </span>
                    <div className="flex justify-start">
                      <StatusChip data={row.b} destaque={row.vencedor === 'B'} />
                    </div>
                  </div>
                ))}
                <p className="pt-2 text-center text-sm font-bold text-slate-600">
                  {duelo.vitoriasA === duelo.vitoriasB
                    ? `Duelo empatado (${duelo.vitoriasA}×${duelo.vitoriasB}${duelo.empates ? `, ${duelo.empates} empate${duelo.empates === 1 ? '' : 's'}` : ''})`
                    : `Edital ${duelo.vitoriasA > duelo.vitoriasB ? 'A' : 'B'} vence o duelo por ${Math.max(duelo.vitoriasA, duelo.vitoriasB)}×${Math.min(duelo.vitoriasA, duelo.vitoriasB)}${duelo.empates ? ` (${duelo.empates} empate${duelo.empates === 1 ? '' : 's'})` : ''}`}
                </p>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
              Escala do radar: 2 = OK · 1 = Alerta · 0 = Risco ou não avaliado
            </p>
          </div>
        )}

        {/* ── Disputa em números ── */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            Disputa em números
          </p>
          <div className="space-y-2">
            {/* Valor estimado */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
              <div className="text-right text-xs font-black text-slate-700">
                {valorA !== null ? fmtBRL(valorA) : <span className="font-bold text-slate-400">Sigiloso</span>}
                {valorA !== null && valorB !== null && valorA > valorB && (
                  <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">maior</span>
                )}
              </div>
              <span className="w-28 text-center text-[11px] font-black uppercase tracking-wide text-slate-500">Valor est.</span>
              <div className="text-left text-xs font-black text-slate-700">
                {valorB !== null ? fmtBRL(valorB) : <span className="font-bold text-slate-400">Sigiloso</span>}
                {valorA !== null && valorB !== null && valorB > valorA && (
                  <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">maior</span>
                )}
              </div>
            </div>
            {valorA !== null && valorB !== null && valorA !== valorB && Math.min(valorA, valorB) > 0 && (
              <p className="text-center text-[11px] font-semibold text-slate-400">
                O Edital {valorA > valorB ? 'A' : 'B'} disputa {fmtBRL(Math.abs(valorA - valorB))} a mais
                {' '}(+{Math.round((Math.abs(valorA - valorB) / Math.min(valorA, valorB)) * 100)}%)
              </p>
            )}

            {/* UF / proximidade */}
            {(ufA || ufB) && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                <div className="text-right text-xs font-black text-slate-700">
                  {ufA || '—'}
                  {ufEmpresa && ufA === ufEmpresa && (
                    <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-black text-sky-700">seu estado</span>
                  )}
                </div>
                <span className="w-28 text-center text-[11px] font-black uppercase tracking-wide text-slate-500">UF</span>
                <div className="text-left text-xs font-black text-slate-700">
                  {ufB || '—'}
                  {ufEmpresa && ufB === ufEmpresa && (
                    <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-black text-sky-700">seu estado</span>
                  )}
                </div>
              </div>
            )}

            {/* Termo de origem da busca */}
            {(itemA.termo_busca_pncp || itemB.termo_busca_pncp) && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                <div className="truncate text-right text-xs font-semibold text-slate-500">{itemA.termo_busca_pncp || '—'}</div>
                <span className="w-28 text-center text-[11px] font-black uppercase tracking-wide text-slate-500">Origem</span>
                <div className="truncate text-left text-xs font-semibold text-slate-500">{itemB.termo_busca_pncp || '—'}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Riscos: comuns × exclusivos ── */}
        {temRiscos && (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              Mapa de riscos
            </p>

            {riscosSep.comuns.length > 0 && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
                  ⚠️ Riscos presentes nas duas análises
                </p>
                <div className="flex flex-wrap gap-2">
                  {riscosSep.comuns.map((r, i) => (
                    <span key={i} className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800">
                      {r}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] font-medium leading-relaxed text-amber-800/80">
                  Riscos que se repetem nas duas oportunidades tendem a ser estruturais — do cadastro,
                  porte ou posicionamento da empresa, e não do edital. Resolvê-los destrava as próximas disputas.
                </p>
              </div>
            )}

            {(riscosSep.soA.length > 0 || riscosSep.soB.length > 0) && (
              <div className="grid gap-3 md:grid-cols-2">
                {([['A', riscosSep.soA], ['B', riscosSep.soB]] as const).map(([lado, lista]) => (
                  <div key={lado} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Só no Edital {lado}
                    </p>
                    {lista.length === 0 ? (
                      <p className="text-[11px] font-medium text-slate-400">Nenhum risco exclusivo.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {lista.map((r, i) => (
                          <li key={i} className="border-l-2 border-red-200 pl-2 text-xs font-semibold text-slate-600">
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Colunas lado a lado */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CompareColumn item={itemA} label="A" isWinner={badgeA} />
          <CompareColumn item={itemB} label="B" isWinner={badgeB} />
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
          <GitCompare size={24} />
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
            <GitCompare size={13} />
            Priorização de disputa
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
            Escolha o melhor edital para disputar
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
            Compare duas oportunidades salvas para decidir qual merece equipe, tempo e orçamento agora.
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
            onClick={() => {
              setDecisao(null);
              setErroDecisao('');
              setCopiado(false);
              setArquivarOutro(false);
              setComparing(true);
            }}
            disabled={selectedCount < 2}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Comparar
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Aviso: com A e B preenchidos, novo clique substitui A */}
        {selectedCount === 2 && (
          <div className="border-t border-slate-100 bg-violet-50/50 px-5 py-2 text-[11px] font-semibold text-violet-500">
            A e B preenchidos — clicar em outro edital substitui o Edital A.
          </div>
        )}
      </div>

      {/* Busca e ordenação */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Filtrar por título, resumo ou UF..."
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-500/10"
        />
        <select
          value={ordem}
          onChange={e => setOrdem(e.target.value as 'recentes' | 'score')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 outline-none transition-all focus:border-violet-300 cursor-pointer"
        >
          <option value="recentes">Mais recentes</option>
          <option value="score">Maior score</option>
        </select>
      </div>

      {/* Lista de análises seleccionáveis */}
      <div className="grid gap-3">
        {listaVisivel.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white py-10 text-center text-sm font-medium text-slate-400">
            Nenhuma análise corresponde ao filtro &ldquo;{busca}&rdquo;.
          </div>
        )}
        {listaVisivel.map(item => {
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
                  {!isSelected && <GitCompare size={16} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
