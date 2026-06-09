'use client';

/**
 * AnalysisResults.tsx
 * Painel de resultados da análise: tabs de navegação, score, semáforo de
 * viabilidade, cronograma crítico, SWOT, matriz de riscos, parecer
 * técnico-jurídico, checklist e exportação PDF.
 */

import React, { useState } from 'react';
import { getCachedTier } from '@/lib/tier';
import {
  ScanSearch, Radar, Printer, Mail, Zap, Target,
  Gauge, Settings2, Banknote, Scale, FolderOpen,
  CalendarDays, AlertTriangle, Shield, BrainCircuit,
  ClipboardList, Pin, ThumbsUp, ThumbsDown, FileText,
  Lock, Crown, AlertCircle, Clock, CircleHelp, XCircle,
  CalendarX, SearchX, Sparkles, Link2, Share2, Download,
} from 'lucide-react';
import type { AnalysisResult, DecisionData, DecisionVerdict } from './analysis-types';
import { getScoreColor, getScoreBg } from './analysis-types';
import TacticalSimulator from './TacticalSimulator';
import PremiumLock from './PremiumLock';
import CompetitorWarRoom from './CompetitorWarRoom';

interface AnalysisResultsProps {
  result: AnalysisResult;
  activeTab: string;
  onSetActiveTab: (tab: string) => void;
  userTier: number;
  currentTier: number;
  termoAlvo: string;
  analysisId: string | null;
  token: string | null;
  isSharing: boolean;
  onShare: () => void;
  onReset: () => void;
  resetLabel?: string;
  onExportPDF: () => void;
  modelSource: string | null;
  isCachedResult: boolean;
  onUpgradeClick: () => void;
  /** Abre a aba Capital com o valor do edital pré-preenchido */
  onGoToCapital?: (valor: number) => void;
}

export default function AnalysisResults({
  result,
  activeTab,
  onSetActiveTab,
  userTier,
  currentTier,
  termoAlvo,
  analysisId,
  token,
  isSharing,
  onShare,
  onReset,
  resetLabel = 'Nova Análise',
  onExportPDF,
  modelSource,
  isCachedResult,
  onUpgradeClick,
  onGoToCapital,
}: AnalysisResultsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* silencioso */
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Parecer Estratégico — Bawzi Intelligence',
          text: `Score: ${result.score}/100 · ${result.classification}`,
          url: window.location.href,
        });
      } catch {
      /* usuário cancelou */
      }
    } else {
      onShare();
    }
  };

  return (
    <div
      className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative animate-in fade-in duration-500 font-sans"
      id="area-resultados"
    >
      <div className={`h-2 ${getScoreBg(result.score)}`}></div>
      <div className="p-8 md:p-12">

        {/* HEADER DE IMPRESSÃO */}
        <div className="hidden print:flex items-center justify-between border-b border-slate-900 pb-6 mb-8 w-full">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-900">BAWZI | Inteligência em Editais</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Relatório Estratégico de Viabilidade</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase">Data da Análise</p>
            <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* TÍTULO + BARRA DE IMPRIMIR E PARTILHAR */}
        <div className="flex flex-col gap-4 mb-8 print:hidden">

          {/* Linha: título + botões de ação */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Painel de Decisão</h2>
                {isCachedResult && (
                  <span className="text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                    Cache
                  </span>
                )}
              </div>
              {termoAlvo && (
                <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-slate-200">
                  {termoAlvo}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* ── Capital de Giro CTA ── */}
              {onGoToCapital && (
                <button
                  onClick={() => {
                    const raw = result.estimated_value || '';
                    const num = parseFloat(
                      raw.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
                    );
                    onGoToCapital(isNaN(num) ? 0 : num);
                  }}
                  className="shrink-0 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-black rounded-xl transition-all text-sm flex items-center gap-2 shadow-md shadow-teal-500/30 hover:shadow-lg hover:shadow-teal-500/40 ring-1 ring-teal-400/30 print:hidden"
                  title={result.estimated_value ? `Abrir Capital com ${result.estimated_value} pré-preenchido` : 'Abrir Capital de Giro'}
                >
                  <Banknote size={15} />
                  💰 Capital de Giro
                </button>
              )}

              <button
                onClick={onReset}
                className="shrink-0 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-sm flex items-center gap-2 shadow-sm"
              >
                + {resetLabel}
              </button>
            </div>
          </div>

          {/* Barra: Imprimir e Partilhar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
              <Share2 size={11} /> Imprimir e Partilhar
            </p>
            <div className="flex flex-wrap gap-2">

              {/* Exportar PDF */}
              <button
                onClick={onExportPDF}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
              >
                <Download size={13} /> Exportar PDF
              </button>

              {/* Imprimir página */}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
              >
                <Printer size={13} /> Imprimir
              </button>

              {/* Compartilhar por e-mail (só com conta) */}
              {token && analysisId && (
                <button
                  onClick={onShare}
                  disabled={isSharing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all disabled:opacity-60"
                >
                  <Mail size={13} /> {isSharing ? 'Enviando...' : 'Compartilhar por e-mail'}
                </button>
              )}

              {/* Copiar link */}
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-2 px-4 py-2.5 border font-bold rounded-xl text-xs transition-all ${
                  copied
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <Link2 size={13} /> {copied ? '✓ Copiado!' : 'Copiar Link'}
              </button>

              {/* Web Share API (iOS/Android) */}
              {typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  <Share2 size={13} /> Compartilhar
                </button>
              )}

            </div>
          </div>

          </div>

          <DecisionSnapshot
            result={result}
          />

        {/* TABS */}
        <div className="flex flex-wrap gap-3 mb-8 border-b border-slate-200 pb-4 print:hidden">
          <button
            onClick={() => onSetActiveTab('analise')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all duration-300 ${
              activeTab === 'analise'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 ring-1 ring-emerald-600'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200'
            }`}
          >
            <ScanSearch size={18} className={activeTab === 'analise' ? 'text-white/70' : 'text-slate-400'} />
            Raio-X do Edital
          </button>

          <button
            onClick={() => onSetActiveTab('concorrentes')}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all duration-300 ${
              activeTab === 'concorrentes'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 ring-1 ring-sky-600'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200'
            }`}
          >
            <Radar size={18} className={activeTab === 'concorrentes' ? 'text-rose-400' : 'text-slate-400'} />
            Radar de Concorrentes
          </button>
        </div>

        {/* ── ABA 1: RELATÓRIO ── */}
        {(activeTab === 'analise' || activeTab === 'workspace') && (
          <ReportTab
            result={result}
            userTier={userTier}
            currentTier={currentTier}
            modelSource={modelSource}
            isCachedResult={isCachedResult}
            onUpgradeClick={onUpgradeClick}
            onExportPDF={onExportPDF}
          />
        )}

        {/* ── ABA 2: WAR ROOM ── */}
        {activeTab === 'concorrentes' && (
          <div className="animate-in fade-in zoom-in-95 duration-500 mt-8">
            <PremiumLock
              isLocked={Math.max(getCachedTier(userTier), currentTier) < 2}
              featureTitle="Radar de Concorrentes"
              requiredTierName="Nível 2 (Essencial)"
              onUpgradeClick={onUpgradeClick}
            >
              <CompetitorWarRoom
                competitorsNacionais={result.concorrentes_provaveis || []}
                competitorsRegionais={result.concorrentes_regionais || []}
                uf={result.uf || 'GO'}
                pricing={result.pricing_intelligence as import('./CompetitorWarRoom').PricingIntelligenceData | undefined}
                analysisId={analysisId || ''}
                userTier={userTier}
                fullResult={result as import('./CompetitorWarRoom').FullResultData}
              />
            </PremiumLock>
          </div>
        )}

      </div>
    </div>
  );
}

function DecisionSnapshot({
  result,
}: {
  result: AnalysisResult;
}) {
  const decision = normalizeDecision(result);
  const verdict = decisionUi[decision.veredito];
  const businessFit = normalizeBusinessFit(result);
  const summaryText = getDecisionSummary(decision);

  const { Icon } = verdict;
  const rawBlockers = decision.impeditivos.length > 0
    ? decision.impeditivos
    : ['Nenhum impeditivo fatal foi identificado no bloco de decisão.'];
  const rawConditions = decision.condicoes_para_participar.length > 0
    ? decision.condicoes_para_participar
    : ['Manter validação final de documentação, preço e prazo antes de protocolar a proposta.'];
  const rawReasons = decision.motivos.length > 0
    ? decision.motivos
    : ['A decisão foi derivada do score, semáforo, riscos e recomendação estratégica disponíveis.'];
  const reasons = filterCoveredDecisionItems(rawReasons, businessFit, 'reasons');
  const conditions = filterCoveredDecisionItems(rawConditions, businessFit, 'conditions');
  const blockers = filterCoveredDecisionItems(rawBlockers, businessFit, 'blockers');
  const decisionColumns = [
    {
      label: 'Motivos',
      Icon: Target,
      items: reasons.slice(0, 3),
      tone: 'text-slate-500',
    },
    {
      label: 'Condições',
      Icon: CircleHelp,
      items: conditions.slice(0, 3),
      tone: 'text-amber-500',
    },
    {
      label: 'Impedimentos',
      Icon: AlertTriangle,
      items: blockers.slice(0, 3),
      tone: decision.impeditivos.length ? 'text-red-500' : 'text-slate-400',
    },
  ];

  return (
    <section className="mb-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm print:hidden">
      <div className={`h-1.5 ${verdict.bar}`} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${verdict.iconShell}`}>
                <Icon size={25} strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${verdict.pill}`}>
                    {decision.veredito.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Decisão executiva
                  </span>
                </div>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                  {decision.rotulo}
                </h3>
              </div>
            </div>

          </div>

          <div className={`mt-6 rounded-2xl border px-5 py-4 ${verdict.summary}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Síntese</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">{summaryText}</p>
          </div>

          {businessFit && (
            <div className={`mt-6 rounded-2xl border px-5 py-4 ${businessFit.shell}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <Settings2 size={14} className={businessFit.icon} />
                    Aderência ao negócio
                  </p>
                  <p className="mt-2 text-sm font-black leading-snug text-slate-900">{businessFit.label}</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">{businessFit.description}</p>
                </div>
                <div className="shrink-0 rounded-xl border border-white/70 bg-white/75 px-3 py-2 md:text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Match CNAE</p>
                  <p className={`mt-1 text-lg font-black leading-none ${businessFit.text}`}>{businessFit.score}/100</p>
                </div>
              </div>
              {(businessFit.cnae || businessFit.object) && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {businessFit.cnae && (
                    <p className="rounded-lg bg-white/65 px-3 py-2 text-[11px] font-bold leading-snug text-slate-600">
                      CNAE: {businessFit.cnae}
                    </p>
                  )}
                  {businessFit.object && (
                    <p className="rounded-lg bg-white/65 px-3 py-2 text-[11px] font-bold leading-snug text-slate-600">
                      Edital: {businessFit.object}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
              {decisionColumns.map(({ label, Icon: ColumnIcon, items, tone }) => (
                <div key={label} className="bg-white px-5 py-4">
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <ColumnIcon size={14} className={tone} />
                    {label}
                  </p>
                  <div className="space-y-2.5">
                    {items.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex gap-2.5">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${verdict.dot}`} />
                        <p className="text-xs font-semibold leading-relaxed text-slate-600">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0 lg:p-6">
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Gauge size={14} className="text-slate-400" />
              Indicadores
            </p>
            <div className="space-y-4">
              <DecisionMetric
                label="Viabilidade"
                helper="Bawzi Score"
                value={`${result.score}/100`}
                percent={result.score}
                barClass={verdict.bar}
                valueClass={verdict.text}
              />
              <DecisionMetric
                label="Confiança na decisão"
                helper="Segurança do veredito"
                value={`${decision.confianca}%`}
                percent={decision.confianca}
                barClass={verdict.bar}
                valueClass={verdict.text}
              />
            </div>
          </div>

          <p className="mb-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <ClipboardList size={14} className="text-slate-400" />
            Próximas ações
          </p>
          <div className="space-y-4">
            {decision.proximas_acoes.slice(0, 3).map((action, index) => (
              <div key={`${action.acao}-${index}`} className="relative pl-9">
                {index < Math.min(decision.proximas_acoes.length, 3) - 1 && (
                  <span className="absolute left-[13px] top-7 h-[calc(100%+0.75rem)] w-px bg-slate-200" />
                )}
                <span className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-white ${verdict.bar}`}>
                  {index + 1}
                </span>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{action.prazo || 'Agora'}</p>
                <p className="mt-1 text-sm font-black leading-snug text-slate-900">{action.acao}</p>
                {(action.responsavel || action.resultado_esperado) && (
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500">
                    {action.responsavel ? `${action.responsavel}: ` : ''}{action.resultado_esperado}
                  </p>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function DecisionMetric({
  label,
  helper,
  value,
  percent,
  barClass,
  valueClass,
}: {
  label: string;
  helper: string;
  value: string;
  percent: number;
  barClass: string;
  valueClass: string;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight text-slate-800">{label}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{helper}</p>
        </div>
        <p className={`shrink-0 text-lg font-black leading-none ${valueClass}`}>{value}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
}

function getDecisionSummary(decision: DecisionUiData) {
  return stripDecisionPrefix(decision.resumo_decisao || decision.decisao_executiva, decision.rotulo);
}

function filterCoveredDecisionItems(
  items: string[],
  businessFit: ReturnType<typeof normalizeBusinessFit>,
  kind: 'reasons' | 'conditions' | 'blockers',
) {
  const seen = new Set<string>();
  const filtered = items.filter((item) => {
    const normalized = normalizeDecisionText(item);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);

    if (kind !== 'conditions' && businessFit?.status === 'sem_match') {
      const alreadyExplainedByBusinessFit = /cnae|aderencia|aderência|sem match|core business|atividade principal|negocio|negócio/.test(normalized);
      if (alreadyExplainedByBusinessFit) return false;
    }

    return true;
  });

  return filtered.length ? filtered : items.slice(0, 3);
}

function stripDecisionPrefix(value: string, label: string) {
  let text = shortenDecisionText(value, 430);
  const normalizedLabel = normalizeDecisionText(label);
  const normalizedText = normalizeDecisionText(text);

  if (normalizedLabel && normalizedText.startsWith(normalizedLabel)) {
    text = text.replace(new RegExp(`^${escapeRegExp(label)}\\s*[—-]\\s*`, 'i'), '').trim();
  }

  return text || value;
}

function normalizeDecisionText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeBusinessFit(result: AnalysisResult) {
  const fit = result.aderencia_negocio;
  if (!fit) return null;

  const score = clampPercent(fit.score ?? 50);
  const status = String(fit.status || 'indeterminado');
  const cnae = [
    fit.cnae_principal,
    fit.cnae_descricao,
  ].filter(Boolean).join(' · ');

  const labels: Record<string, {
    label: string;
    shell: string;
    text: string;
    icon: string;
    fallback: string;
  }> = {
    match_forte: {
      label: 'O edital combina com o negócio da empresa.',
      shell: 'border-emerald-100 bg-emerald-50/70',
      text: 'text-emerald-700',
      icon: 'text-emerald-600',
      fallback: 'O objeto tem aderência direta ao CNAE/atividade cadastrada.',
    },
    match_parcial: {
      label: 'Existe aderência parcial ao negócio.',
      shell: 'border-amber-100 bg-amber-50/70',
      text: 'text-amber-700',
      icon: 'text-amber-600',
      fallback: 'O objeto é adjacente ao CNAE/atividade, mas exige comprovação de capacidade.',
    },
    sem_match: {
      label: 'Sem match claro com o CNAE da empresa.',
      shell: 'border-red-100 bg-red-50/70',
      text: 'text-red-700',
      icon: 'text-red-600',
      fallback: 'O objeto do edital não conversa com o CNAE/atividade cadastrada da empresa.',
    },
    indeterminado: {
      label: 'Aderência ao negócio inconclusiva.',
      shell: 'border-slate-200 bg-slate-50',
      text: 'text-slate-700',
      icon: 'text-slate-500',
      fallback: 'Não há informação suficiente para medir o encaixe entre edital e CNAE.',
    },
    sem_cnae: {
      label: 'CNAE da empresa não disponível.',
      shell: 'border-slate-200 bg-slate-50',
      text: 'text-slate-700',
      icon: 'text-slate-500',
      fallback: 'Cadastre o CNAE da empresa para ativar o match de negócio.',
    },
  };

  const cfg = labels[status] || labels.indeterminado;
  return {
    ...cfg,
    status,
    score,
    cnae,
    object: shortenDecisionText(fit.objeto_detectado, 110),
    description: shortenDecisionText(fit.justificativa || cfg.fallback, 260),
  };
}

type DecisionUiData = {
  veredito: DecisionVerdict;
  rotulo: string;
  confianca: number;
  resumo_decisao: string;
  motivos: string[];
  condicoes_para_participar: string[];
  impeditivos: string[];
  proximas_acoes: {
    prazo?: string;
    acao: string;
    responsavel?: string;
    resultado_esperado?: string;
  }[];
  perguntas_criticas: string[];
  decisao_executiva: string;
};

const decisionUi: Record<DecisionVerdict, {
  Icon: typeof ThumbsUp;
  shell: string;
  side: string;
  iconShell: string;
  text: string;
  bar: string;
  dot: string;
  pill: string;
  summary: string;
}> = {
  GO: {
    Icon: ThumbsUp,
    shell: 'border-emerald-200 bg-emerald-50',
    side: 'bg-emerald-50',
    iconShell: 'bg-emerald-600 text-white',
    text: 'text-emerald-800',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    summary: 'border-emerald-100 bg-emerald-50/70',
  },
  GO_CONDICIONADO: {
    Icon: CircleHelp,
    shell: 'border-amber-200 bg-amber-50',
    side: 'bg-amber-50',
    iconShell: 'bg-amber-500 text-white',
    text: 'text-amber-800',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    summary: 'border-amber-100 bg-amber-50/70',
  },
  NO_GO: {
    Icon: ThumbsDown,
    shell: 'border-red-200 bg-red-50',
    side: 'bg-red-50',
    iconShell: 'bg-red-500 text-white',
    text: 'text-red-800',
    bar: 'bg-red-500',
    dot: 'bg-red-500',
    pill: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    summary: 'border-red-100 bg-red-50/70',
  },
};

function normalizeDecision(result: AnalysisResult): DecisionUiData {
  const raw = result.decisao;
  const score = typeof result.score === 'number' ? result.score : 0;
  const veredito = raw?.veredito
    ? normalizeDecisionVerdict(raw.veredito, score)
    : score >= 70 ? 'GO' : score >= 45 ? 'GO_CONDICIONADO' : 'NO_GO';

  const rotulos: Record<DecisionVerdict, string> = {
    GO: 'Participar',
    GO_CONDICIONADO: 'Participar somente após validações',
    NO_GO: 'Não participar agora',
  };

  const motivos = toDecisionTextList(raw?.motivos, 5);
  const fallbackMotivos = toDecisionTextList([
    result.pricing_intelligence?.financial_verdict,
    result.probabilidade_de_sucesso ? `Probabilidade de sucesso: ${result.probabilidade_de_sucesso}` : '',
    result.recommendation,
    ...(result.risks || []).slice(0, 2),
  ], 5);

  const condicoes = toDecisionTextList(raw?.condicoes_para_participar, 6);
  const semaforoCondicoes = Object.entries(result.semaforo || {})
    .filter(([, sinal]) => sinal && sinal.status !== 'ok')
    .map(([key, sinal]) => `${semaforoLabel(key)}: ${sinal.motivo}`);

  const impeditivos = toDecisionTextList(raw?.impeditivos, 5);
  const riscosAltos = toDecisionTextList(
    (result.risks || []).filter((risk) => {
      if (typeof risk === 'string') return /alto|grave|crítico|critico|desclassifica/i.test(risk);
      return risk.impacto === 'alto';
    }),
    5,
  );

  const resumoPadrao: Record<DecisionVerdict, string> = {
    GO: 'A recomendação é participar, mantendo validação final de preço, prazo e documentação antes do protocolo.',
    GO_CONDICIONADO: 'A oportunidade pode valer a pena, mas só deve avançar depois de resolver as condições críticas de preço, prazo, documentação ou risco.',
    NO_GO: 'A recomendação é não participar agora: os riscos ou impeditivos detectados superam o retorno provável.',
  };

  return {
    veredito,
    rotulo: shortenDecisionText(raw?.rotulo || rotulos[veredito], 90),
    confianca: clampPercent(raw?.confianca ?? confidenceFallback(veredito, score)),
    resumo_decisao: shortenDecisionText(raw?.resumo_decisao || resumoPadrao[veredito], 430),
    motivos: motivos.length ? motivos : fallbackMotivos,
    condicoes_para_participar: condicoes.length
      ? condicoes
      : toDecisionTextList([
          ...semaforoCondicoes,
          ...(result.exigencias_criticas || []).slice(0, 3),
          veredito !== 'NO_GO' ? 'Validar margem líquida e capital de giro antes do lance final.' : '',
        ], 6),
    impeditivos: impeditivos.length ? impeditivos : riscosAltos,
    proximas_acoes: normalizeDecisionActions(raw?.proximas_acoes),
    perguntas_criticas: toDecisionTextList(raw?.perguntas_criticas, 5),
    decisao_executiva: shortenDecisionText(raw?.decisao_executiva || `${rotulos[veredito]} — ${resumoPadrao[veredito]}`, 340),
  };
}

function normalizeDecisionVerdict(value: unknown, score: number): DecisionVerdict {
  const text = String(value || '').toUpperCase().replace(/[-\s]/g, '_');
  if (['GO', 'SIM', 'PARTICIPAR'].includes(text)) return 'GO';
  if (['NO_GO', 'NOGO', 'NO', 'NAO', 'NÃO', 'EVITAR'].includes(text)) return 'NO_GO';
  if (['GO_CONDICIONADO', 'CONDICIONADO', 'INVESTIGAR'].includes(text)) return 'GO_CONDICIONADO';
  return score >= 70 ? 'GO' : score >= 45 ? 'GO_CONDICIONADO' : 'NO_GO';
}

function normalizeDecisionActions(actions: DecisionData['proximas_acoes']): DecisionUiData['proximas_acoes'] {
  const normalized = (Array.isArray(actions) ? actions : [])
    .map((action) => ({
      prazo: shortenDecisionText(action?.prazo || 'Hoje', 40),
      acao: shortenDecisionText(action?.acao, 220),
      responsavel: shortenDecisionText(action?.responsavel, 80),
      resultado_esperado: shortenDecisionText(action?.resultado_esperado, 160),
    }))
    .filter((action) => action.acao);

  if (normalized.length) return normalized.slice(0, 5);

  return [
    {
      prazo: 'Hoje',
      acao: 'Conferir requisitos eliminatórios de habilitação e qualificação técnica.',
      responsavel: 'Licitações',
      resultado_esperado: 'Confirmar se há risco de desclassificação.',
    },
    {
      prazo: 'Hoje',
      acao: 'Calcular preço mínimo viável com impostos, logística, garantias e deságio provável.',
      responsavel: 'Financeiro',
      resultado_esperado: 'Definir limite de lance com margem preservada.',
    },
    {
      prazo: 'Próximo dia útil',
      acao: 'Validar cláusulas jurídicas, multas e pontos de impugnação.',
      responsavel: 'Jurídico',
      resultado_esperado: 'Decidir seguir, impugnar ou abandonar.',
    },
  ];
}

function toDecisionTextList(value: unknown, limit: number): string[] {
  const input = Array.isArray(value) ? value : value ? [value] : [];
  const items: string[] = [];

  input.forEach((item) => {
    let source: unknown = item;
    if (typeof item === 'object' && item !== null) {
      const record = item as Record<string, unknown>;
      source = record.titulo || record.tarefa || record.descricao || record.motivo || record.text || record.acao;
    }
    const text = shortenDecisionText(source);
    if (text && !items.includes(text)) items.push(text);
  });

  return items.slice(0, limit);
}

function shortenDecisionText(value: unknown, max = 260) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function clampPercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 60;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function confidenceFallback(veredito: DecisionVerdict, score: number) {
  if (veredito === 'GO') return Math.min(95, Math.max(65, score + 10));
  if (veredito === 'NO_GO') return Math.min(95, Math.max(65, 100 - score));
  return Math.min(85, Math.max(55, score));
}

function semaforoLabel(key: string) {
  const labels: Record<string, string> = {
    tecnica: 'Técnica',
    financeira: 'Financeira',
    juridica: 'Jurídica',
    documentacao: 'Documentação',
  };
  return labels[key] || key;
}

// ─── Sub-componente: conteúdo do Raio-X ──────────────────────────────────────

interface ReportTabProps {
  result: AnalysisResult;
  userTier: number;
  currentTier: number;
  modelSource: string | null;
  isCachedResult: boolean;
  onUpgradeClick: () => void;
  onExportPDF: () => void;
}

function ReportTab({ result, userTier, currentTier, modelSource, isCachedResult, onUpgradeClick, onExportPDF }: ReportTabProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* BANNER: EDITAL EXPIRADO */}
      <ExpiredBanner result={result} />

      {/* SCORE + DATAS CRÍTICAS */}
      <ScoreHeader result={result} />

      {/* SEMÁFORO DE VIABILIDADE */}
      <SemaforoSection result={result} />

      {/* CRONOGRAMA CRÍTICO */}
      <CronogramaSection result={result} />

      {/* RESUMO EXECUTIVO */}
      <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
        <SectionLabel icon={<Target size={18} className="text-slate-700" />} label="Resumo Executivo" />
        <div className="text-slate-700 text-sm md:text-base leading-relaxed space-y-4 font-medium whitespace-pre-line mt-2">
          {result.summary}
        </div>
      </div>

      {/* SIMULADOR TÁTICO */}
      {result.pricing_intelligence && (
        <div className="space-y-4 print:hidden mb-12">
          <TacticalSimulator
            pricing={result.pricing_intelligence}
            fullResult={result}
            userTier={userTier}
          />
        </div>
      )}

      {/* SWOT & CARGA OPERACIONAL */}
      <SwotSection result={result} />

      {/* MATRIZ DE RISCOS */}
      <RisksSection result={result} />

      {/* PARECER TÉCNICO-JURÍDICO */}
      <PareceSection result={result} userTier={userTier} onUpgradeClick={onUpgradeClick} />

      {/* RACIOCÍNIO ESTRATÉGICO */}
      <div className="mt-8 pt-6 border-t border-slate-100 print:hidden">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-slate-400" strokeWidth={2} />
          Raciocínio Estratégico da IA
        </h4>
        <div className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-line bg-slate-50 p-5 rounded-xl border border-slate-100">
          {result.rationale || result.recommendation || 'Sem dados estratégicos.'}
        </div>
      </div>

      {/* ROADMAP / CHECKLIST */}
      {result.checklist && result.checklist.length > 0 && (
        <ChecklistSection result={result} />
      )}

      {/* EXPORTAR PDF */}
      <PremiumLock
        isLocked={currentTier < 4}
        featureTitle="Minuta de Parecer Técnico-Jurídico (PDF)"
        requiredTierName="Nível 4 (Dominador)"
        onUpgradeClick={onUpgradeClick}
      >
        <PdfExportCard onExportPDF={onExportPDF} />
      </PremiumLock>

      {/* LAYOUT DE IMPRESSÃO */}
      <PrintLayout result={result} />

      {/* RODAPÉ METADADOS */}
      <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium print:hidden">
        <div className="flex items-center gap-2">
          <span>Gerado por:</span>
          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold uppercase tracking-widest">{modelSource || 'Motor Bawzi IA'}</span>
        </div>
        {isCachedResult && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
            <Zap size={14} />
            <span className="font-bold uppercase tracking-widest text-[10px]">Recuperado do Cache</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Label de secção reutilizável ─────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
      {icon}
      <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{label}</h3>
    </div>
  );
}

// ─── Helper: detecta se o edital já expirou ───────────────────────────────────

// Só 'encerramento' e 'recebimento' indicam prazo de submissão.
// 'abertura' = sessão de análise (ocorre APÓS o prazo) — não é indicador de expiração.
const LABELS_CHAVE_EXPIRACAO = ['encerramento', 'recebimento', 'prazo', 'limite'];

function getDataExpirada(result: AnalysisResult) {
  if (!result.datas_criticas?.length) return null;
  const agora = new Date();
  return result.datas_criticas.find(dc => {
    if (!dc.data_iso) return false;
    const isChave = LABELS_CHAVE_EXPIRACAO.some(k => dc.label.toLowerCase().includes(k));
    return isChave && new Date(dc.data_iso) < agora;
  }) ?? null;
}

// ─── Banner edital expirado ───────────────────────────────────────────────────

function ExpiredBanner({ result }: { result: AnalysisResult }) {
  const dataExpirada = getDataExpirada(result);
  if (!dataExpirada) return null;
  const formatted = new Date(dataExpirada.data_iso!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3.5">
      <CalendarX size={20} className="shrink-0 text-slate-400" />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Edital encerrado</span>
        <p className="text-sm font-medium text-slate-300 leading-snug mt-0.5">
          A <strong className="text-white">{dataExpirada.label}</strong> ocorreu em <strong className="text-white">{formatted}</strong>.{' '}
          <span className="text-slate-400">Análise disponível apenas para referência e estudo de mercado.</span>
        </p>
      </div>
      <span className="shrink-0 text-[9px] font-black uppercase tracking-widest bg-slate-800 border border-slate-700 text-slate-400 px-2.5 py-1 rounded-full">
        Histórico
      </span>
    </div>
  );
}

// ─── Score + datas críticas ───────────────────────────────────────────────────

function ScoreHeader({ result }: { result: AnalysisResult }) {
  const isExpired = !!getDataExpirada(result);

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-14 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-8 print:border-none print:p-0">
      {/* Score circle */}
      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="stroke-slate-200" strokeWidth="6" fill="none" />
            <circle
              cx="50" cy="50" r="42"
              className={`transition-all duration-1000 ease-out ${isExpired ? 'stroke-slate-400' : result.score >= 70 ? 'stroke-emerald-500' : result.score >= 45 ? 'stroke-amber-500' : 'stroke-red-500'}`}
              strokeWidth="6" fill="none" strokeLinecap="round"
              style={{ strokeDasharray: 264, strokeDashoffset: 264 - (264 * result.score) / 100 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-black tracking-tighter leading-none ${isExpired ? 'text-slate-400' : 'text-slate-900'}`}>
              {result.score}
            </span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bawzi Score</p>
          {isExpired ? (
            <>
              <h3 className="text-lg font-black uppercase tracking-widest text-slate-400">
                Referência histórica
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-1 max-w-sm">
                Score de {result.score}/100 — edital já encerrado.
              </p>
            </>
          ) : (
            <>
              <h3 className={`text-lg font-black uppercase tracking-widest ${getScoreColor(result.score)}`}>
                {result.classification}
              </h3>
              {result.pricing_intelligence?.financial_verdict && (
                <p className="text-sm text-slate-600 font-medium mt-1 max-w-sm">
                  {result.pricing_intelligence.financial_verdict}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Datas críticas */}
      <DatasBlock result={result} isExpired={isExpired} />
    </div>
  );
}

function DatasBlock({ result, isExpired = false }: { result: AnalysisResult; isExpired?: boolean }) {
  if (result.datas_criticas && result.datas_criticas.length > 0) {
    const visible = result.datas_criticas.filter(d => d.data_iso).slice(0, 3);
    if (visible.length === 0) return null;
    return (
      <div className="flex flex-col gap-3 pl-0 md:pl-8 border-t md:border-t-0 md:border-l border-slate-200 w-full md:w-auto pt-6 md:pt-0">
        {visible.map((dc, i) => {
          const date = dc.data_iso ? new Date(dc.data_iso) : null;
          const fmt = date ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : dc.data_iso;
          const isPast = date ? date < new Date() : false;
          return (
            <div key={i}>
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                {isPast
                  ? <CalendarX size={10} className="text-slate-400" />
                  : dc.urgente ? <Zap size={10} className="text-red-500" /> : null
                }
                {dc.label}
              </span>
              <span className={`text-sm font-bold ${isExpired || isPast ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {fmt}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Legacy fallback
  const d = result?.datas_criticas_extraidas;
  const propostas = String(d?.data_limite_propostas || '').trim();
  const impugnacao = String(d?.data_impugnacao || '').trim();
  const isValida = (t: string) =>
    !!t && !t.toLowerCase().includes('não') && !t.toLowerCase().includes('n/a') &&
    !t.toLowerCase().includes('informad') && !t.toLowerCase().includes('localizad');
  const propValida = isValida(propostas) ? propostas : null;
  const impValida = isValida(impugnacao) ? impugnacao : null;
  if (!propValida && !impValida) return null;
  return (
    <div className="flex flex-col gap-3 pl-0 md:pl-8 border-t md:border-t-0 md:border-l border-slate-200 w-full md:w-auto pt-6 md:pt-0">
      {propValida && <div><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo de Propostas</span><span className={`text-sm font-bold flex items-center gap-1 ${isExpired ? 'text-slate-400 line-through' : 'text-slate-900'}`}><CalendarDays size={14} className="text-slate-400 shrink-0" /> {propValida}</span></div>}
      {impValida && <div><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Limite Impugnação</span><span className={`text-sm font-bold flex items-center gap-1 ${isExpired ? 'text-slate-400 line-through' : 'text-slate-900'}`}><AlertCircle size={14} className={isExpired ? 'text-slate-400' : 'text-red-500'} /> {impValida}</span></div>}
    </div>
  );
}

// ─── Semáforo de Viabilidade ──────────────────────────────────────────────────

function SemaforoSection({ result }: { result: AnalysisResult }) {
  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mb-8">
      <SectionLabel icon={<Gauge size={18} className="text-slate-700" />} label="Semáforo de Viabilidade" />
      {result.semaforo ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
          {([
            { key: 'tecnica' as const, label: 'Técnica', icon: <Settings2 size={20} /> },
            { key: 'financeira' as const, label: 'Financeira', icon: <Banknote size={20} /> },
            { key: 'juridica' as const, label: 'Jurídica', icon: <Scale size={20} /> },
            { key: 'documentacao' as const, label: 'Documentação', icon: <FolderOpen size={20} /> },
          ] as { key: 'tecnica' | 'financeira' | 'juridica' | 'documentacao'; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => {
            const sinal = result.semaforo![key];
            if (!sinal) return null;
            const cfg: Record<string, { bg: string; border: string; dot: string; txt: string; lbl: string }> = {
              ok:     { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', txt: 'text-emerald-700', lbl: 'OK' },
              alerta: { bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   txt: 'text-amber-700',   lbl: 'ALERTA' },
              risco:  { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     txt: 'text-red-700',     lbl: 'RISCO' },
            };
            const s = cfg[sinal.status] ?? { bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-400', txt: 'text-slate-600', lbl: sinal.status };
            return (
              <div key={key} className={`${s.bg} ${s.border} border rounded-xl p-4 flex flex-col gap-2`}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">{icon}</span>
                  <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${s.txt}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.lbl}
                  </span>
                </div>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{label}</p>
                <p className="text-xs text-slate-600 font-medium leading-snug">{sinal.motivo}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5">
          <Sparkles size={28} className="shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-black text-slate-700">Nova análise necessária</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">Execute uma nova análise para ativar o Semáforo de Viabilidade — avaliação automática nos eixos <strong>Técnica · Financeira · Jurídica · Documentação</strong>.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cronograma Crítico ───────────────────────────────────────────────────────

function CronogramaSection({ result }: { result: AnalysisResult }) {
  const agora = new Date();

  // Não exibir a seção quando todas as datas com valor já expiraram
  // (edital encerrado — não há nenhuma ação pendente para o usuário)
  if (Array.isArray(result.datas_criticas) && result.datas_criticas.length > 0) {
    const temDataFutura = result.datas_criticas.some(
      (dc) => dc.data_iso && new Date(dc.data_iso) >= agora,
    );
    if (!temDataFutura) return null;
  }

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mb-8">
      <SectionLabel icon={<CalendarDays size={18} className="text-slate-700" />} label="Cronograma Crítico" />
      {result.datas_criticas === undefined ? (
        <div className="mt-4 flex items-center gap-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5">
          <CalendarX size={28} className="shrink-0 text-slate-500" />
          <div>
            <p className="text-sm font-black text-slate-700">Análise desatualizada</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">Esta análise foi gerada antes da atualização do cronograma. Execute uma nova análise para ativar os alertas de prazo automáticos.</p>
          </div>
        </div>
      ) : result.datas_criticas.length === 0 ? (
        <div className="mt-4 flex items-center gap-4 bg-amber-50 border border-dashed border-amber-200 rounded-xl p-5">
          <SearchX size={28} className="shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-black text-amber-800">Datas não identificadas</p>
            <p className="text-xs text-amber-700 font-medium mt-0.5 leading-relaxed">O documento não continha datas de prazo explícitas. Consulte diretamente o edital para verificar os prazos de proposta e impugnação.</p>
          </div>
        </div>
      ) : (
        <div className="relative mt-2">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />
          <div className="space-y-4">
            {result.datas_criticas.map((dc, i) => {
              const date = dc.data_iso ? new Date(dc.data_iso) : null;
              const expirado = date ? date < agora : false;
              const urgenteFuturo = date ? (!expirado && dc.urgente) : false;
              const formatted = date
                ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Data não informada no edital';
              return (
                <div key={i} className="relative flex items-start gap-4 pl-12">
                  <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center text-sm shrink-0 z-10 border-2 ${
                    !date        ? 'bg-slate-100 border-slate-200 text-slate-400' :
                    expirado     ? 'bg-slate-300 border-slate-200 text-slate-500' :
                    urgenteFuturo? 'bg-red-500 border-red-300 text-white' :
                                   'bg-white border-slate-300 text-slate-500'
                  }`}>
                    {!date ? <CircleHelp size={16} /> : expirado ? <Clock size={16} /> : urgenteFuturo ? <AlertCircle size={16} /> : <Pin size={16} />}
                  </div>
                  <div className={`flex-1 p-4 rounded-xl border transition-all ${
                    !date        ? 'bg-slate-50 border-dashed border-slate-200' :
                    expirado     ? 'bg-slate-50 border-slate-200 opacity-60' :
                    urgenteFuturo? 'bg-red-50 border-red-200' :
                                   'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${
                        !date        ? 'text-slate-400' :
                        expirado     ? 'text-slate-400 line-through' :
                        urgenteFuturo? 'text-red-600' : 'text-slate-500'
                      }`}>{dc.label}</p>
                      {expirado    && <span className="text-[9px] font-black uppercase tracking-widest bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">EXPIRADO</span>}
                      {urgenteFuturo && <span className="text-[9px] font-black uppercase tracking-widest bg-red-500 text-white px-2 py-0.5 rounded-full">URGENTE</span>}
                    </div>
                    <p className={`text-sm font-bold mt-0.5 ${
                      !date    ? 'text-slate-400 italic' :
                      expirado ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}>{formatted}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SWOT & Carga Operacional ────────────────────────────────────────────────

function SwotSection({ result }: { result: AnalysisResult }) {
  const hasContent =
    (result.exigencias_criticas && result.exigencias_criticas.length > 0) ||
    (result.documentos_necessarios && result.documentos_necessarios.length > 0) ||
    (result.vantagens && result.vantagens.length > 0) ||
    (result.desvantagens && result.desvantagens.length > 0);
  if (!hasContent) return null;
  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
      <SectionLabel icon={<ClipboardList size={18} className="text-slate-700" />} label="Carga Operacional & SWOT" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 mt-2">
        {result.vantagens && result.vantagens.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-1"><ThumbsUp size={11} /> Vantagens (Por que avançar?)</h4>
            <ul className="space-y-3">{result.vantagens.map((v, i) => <li key={i} className="text-sm text-slate-700 font-medium flex gap-2"><span className="text-emerald-500">＋</span> {v}</li>)}</ul>
          </div>
        )}
        {result.desvantagens && result.desvantagens.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4 flex items-center gap-1"><ThumbsDown size={11} /> Barreiras (Por que recuar?)</h4>
            <ul className="space-y-3">{result.desvantagens.map((d, i) => <li key={i} className="text-sm text-slate-700 font-medium flex gap-2"><span className="text-orange-500">−</span> {d}</li>)}</ul>
          </div>
        )}
        {result.exigencias_criticas && result.exigencias_criticas.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1"><Pin size={11} /> Exigências Críticas</h4>
            <ul className="space-y-3">{result.exigencias_criticas.map((e, i) => <li key={i} className="text-sm text-slate-700 font-medium flex items-center gap-2"><div className="w-1 h-1 bg-slate-400 rounded-full shrink-0"></div> {e}</li>)}</ul>
          </div>
        )}
        {result.documentos_necessarios && result.documentos_necessarios.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1"><FolderOpen size={11} /> Documentação Necessária</h4>
            <ul className="space-y-3">{result.documentos_necessarios.map((doc, i) => <li key={i} className="text-sm text-slate-700 font-medium flex items-center gap-2"><div className="w-1 h-1 bg-slate-400 rounded-full shrink-0"></div> {doc}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Matriz de Riscos ─────────────────────────────────────────────────────────

function RisksSection({ result }: { result: AnalysisResult }) {
  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
      <SectionLabel icon={<AlertTriangle size={18} className="text-slate-700" />} label="Matriz de Riscos" />
      {result.risks && result.risks.length > 0 ? (
        <div className="space-y-3 mt-2">
          {[...result.risks]
            .sort((a, b) => {
              const order: Record<string, number> = { alto: 0, medio: 1, baixo: 2 };
              return (order[a.impacto ?? 'medio'] ?? 1) - (order[b.impacto ?? 'medio'] ?? 1);
            })
            .map((risk, idx) => {
              const impactoCfg: Record<string, { bg: string; border: string; badge: string }> = {
                alto:  { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700' },
                medio: { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
                baixo: { bg: 'bg-slate-50',  border: 'border-slate-100',  badge: 'bg-slate-100 text-slate-500' },
              };
              const ic = impactoCfg[risk.impacto ?? 'medio'] ?? impactoCfg['medio'];
              const impactoLabel: Record<string, string> = { alto: 'ALTO', medio: 'MÉDIO', baixo: 'BAIXO' };
              return (
                <div key={idx} className={`${ic.bg} ${ic.border} border rounded-xl p-4`}>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <span className="text-sm font-black text-slate-800">{risk.titulo}</span>
                    <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${ic.badge}`}>
                      {impactoLabel[risk.impacto ?? 'medio'] ?? (risk.impacto || '—')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{risk.descricao}</p>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5">
          <Shield size={28} className="shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-black text-slate-700">Nova análise necessária</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">Execute uma nova análise para ver a matriz de riscos ranqueada por impacto — <strong>Alto · Médio · Baixo</strong> com fundamentação jurídica.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Parecer Técnico-Jurídico ─────────────────────────────────────────────────

function PareceSection({ result, userTier, onUpgradeClick }: { result: AnalysisResult; userTier: number; onUpgradeClick: () => void }) {
  return (
    <div className="my-10 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
      <div className="bg-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-white font-bold flex items-center gap-2 text-sm">
          <Scale size={18} /> PARECER TÉCNICO-JURÍDICO BAWZI
        </h3>
        <span className="text-[10px] uppercase tracking-widest text-amber-400 font-black px-2 py-1 bg-amber-400/10 rounded-md border border-amber-400/20">
          Agente IA Especialista
        </span>
      </div>

      {userTier <= 2 ? (
        <div className="relative p-6">
          <div className="prose prose-slate max-w-none mb-3 opacity-60">
            <p className="text-slate-700 text-sm font-medium italic">
              "Após análise minuciosa das cláusulas de habilitação técnica e financeira, identificamos pontos de atenção..."
            </p>
          </div>
          <div className="absolute inset-0 top-[50px] z-20 flex flex-col items-center justify-center bg-white/50 backdrop-blur-md rounded-b-2xl pb-2">
            <div className="bg-slate-900 text-white p-5 md:p-6 rounded-2xl shadow-xl max-w-sm text-center border border-slate-700 mx-4">
              <div className="w-12 h-12 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-400/20">
                <Lock size={24} />
              </div>
              <h4 className="font-black text-lg mb-1.5 text-white">Análise Jurídica Restrita</h4>
              <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                O Parecer Jurídico detalhado está disponível apenas para membros <strong className="text-white/80 uppercase">Especialistas</strong> e <strong className="text-amber-400 uppercase">Dominadores</strong>.
              </p>
              <button
                onClick={onUpgradeClick}
                className="w-full py-3 bg-white hover:bg-slate-50 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 border border-slate-200"
              >
                Fazer Upgrade Agora
              </button>
            </div>
          </div>
          <div className="space-y-3 blur-[5px] select-none pointer-events-none opacity-20 mt-2 min-h-[220px]">
            <div className="h-3 w-full bg-slate-300 rounded"></div>
            <div className="h-3 w-5/6 bg-slate-300 rounded"></div>
            <div className="h-3 w-4/6 bg-slate-300 rounded"></div>
            <div className="h-16 w-full bg-slate-100 rounded-xl mt-4"></div>
          </div>
        </div>
      ) : (
        result.parecer_especialista && (
          <div className="p-8 prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900">
            <div className="whitespace-pre-wrap font-sans leading-relaxed text-sm">
              {result.parecer_especialista}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─── Checklist / Roadmap ──────────────────────────────────────────────────────

function ChecklistSection({ result }: { result: AnalysisResult }) {
  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mt-12 print:hidden">
      <SectionLabel icon={<span className="text-lg">✅</span>} label="Roadmap de Execução" />
      <div className="space-y-3 mt-2">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {result.checklist!.map((item: any, idx: number) => {
          const tarefa = item.tarefa || item.descricao || item;
          const fase = item.fase || 'Preparação';
          const impacto = item.impacto || 'Importante';
          return (
            <label key={idx} className="group flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer">
              <input type="checkbox" className="mt-0.5 appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:ring-0 checked:bg-slate-800 checked:border-slate-800 cursor-pointer flex items-center justify-center shrink-0 before:content-['✓'] before:text-white before:text-xs before:hidden checked:before:block" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{fase}</span>
                  <span className="text-[9px] font-black text-slate-500 uppercase px-2 py-0.5 bg-slate-100 rounded-md">Impacto: {impacto}</span>
                </div>
                <p className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{tarefa}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Card de exportação PDF ───────────────────────────────────────────────────

function PdfExportCard({ onExportPDF }: { onExportPDF: () => void }) {
  return (
    <div className="relative bg-slate-950 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mt-4 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.04),_transparent_60%)] pointer-events-none" />
      <div className="flex items-start gap-5 flex-1 relative z-10">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white">
          <Scale size={26} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">Exclusivo Dominador</span>
          </div>
          <h3 className="font-black text-white text-xl tracking-tight mb-2 leading-tight">Minuta de Parecer Técnico-Jurídico</h3>
          <p className="text-sm font-medium text-slate-400 leading-relaxed mb-4 max-w-lg">
            Documento formal gerado pela IA Bawzi com fundamentação na <strong className="text-slate-300">Lei 14.133/2021</strong>. Pronto para anexar a impugnações, recursos administrativos ou dossiês internos.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {['Semáforo de Viabilidade', 'Matriz de Riscos', 'Cronograma Crítico', 'Parecer Especialista', 'Recomendação Final'].map(item => (
              <span key={item} className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 rounded-lg">✓ {item}</span>
            ))}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Minuta — requer validação por advogado habilitado</span>
          </div>
        </div>
      </div>
      <button
        onClick={onExportPDF}
        className="relative z-10 w-full md:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 shrink-0"
      >
        <FileText size={16} /> Gerar Minuta (PDF)
      </button>
    </div>
  );
}

// ─── Layout de impressão ──────────────────────────────────────────────────────

function PrintLayout({ result }: { result: AnalysisResult }) {
  return (
    <div className="hidden print:block bg-white p-10 font-serif text-slate-900 leading-relaxed text-sm">
      <div className="border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-2xl font-black uppercase">Bawzi Intelligence</h1>
        <p className="font-bold text-slate-500 uppercase">Parecer Técnico-Jurídico Preliminar</p>
      </div>
      <div className="bg-slate-100 p-4 mb-6 border-l-4 border-slate-900">
        <p className="font-bold text-xs flex items-start gap-1">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" /> Nota de Responsabilidade: Este rascunho foi gerado por IA para facilitar a triagem. A revisão e validação por um profissional da área jurídica é indispensável.
        </p>
      </div>
      <div className="space-y-6">
        <section>
          <h3 className="font-bold border-b border-slate-200 mb-2">1. Resumo da Análise</h3>
          <p>{result.summary}</p>
        </section>
        <section>
          <h3 className="font-bold border-b border-slate-200 mb-2">2. Fundamentação e Riscos</h3>
          <p className="whitespace-pre-wrap">{result.parecer_especialista || result.rationale || 'Sem riscos críticos identificados.'}</p>
        </section>
        <section>
          <h3 className="font-bold border-b border-slate-200 mb-2">3. Conclusão Estratégica</h3>
          <p>Veredito da Análise: <strong>{result.classification}</strong> (Score: {result.score}/100)</p>
        </section>
      </div>
      <div className="mt-20 pt-10 border-t border-slate-300 flex flex-col items-center">
        <div className="w-64 h-px bg-slate-900 mb-2"></div>
        <p className="font-bold uppercase text-xs">Validação Jurídica (Assinatura)</p>
        <p className="text-xs mt-1">OAB/UF nº _________</p>
      </div>
    </div>
  );
}
