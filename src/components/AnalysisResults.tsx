'use client';

/**
 * AnalysisResults.tsx
 * Painel de resultados da análise: tabs de navegação, score, semáforo de
 * viabilidade, cronograma crítico, SWOT, matriz de riscos, parecer
 * técnico-jurídico, checklist e exportação PDF.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCachedTier } from '@/lib/tier';
import { API_URL, apiFetch, SessionExpiredError } from '@/lib/apiClient';
import {
  Radar, Printer, Mail, Zap, Target,
  Gauge, Settings2, Banknote, Scale, FolderOpen,
  CalendarDays, AlertTriangle, Shield, BrainCircuit,
  ClipboardList, Pin, ThumbsUp, ThumbsDown, FileText,
  Lock, Crown, AlertCircle, Clock, CircleHelp, XCircle,
  CalendarX, SearchX, Sparkles, Link2, Share2, Download,
  RefreshCw, History, CheckCircle2, SlidersHorizontal, ChevronDown, Quote,
  Check, ChevronRight, Flag, ListChecks, FileSearch, Gem, Calculator, Trophy,
  ListOrdered, LayoutDashboard, Landmark, ShieldCheck, Scale3d, TrendingUp, ShieldAlert,
  Maximize2, Minimize2, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import type {
  AnalysisResult,
  DecisionConfidenceFactor,
  DecisionData,
  DecisionEvidence,
  DecisionVerdict,
} from './analysis-types';
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
  onCockpitStatusChange?: (status: NonNullable<AnalysisResult['cockpit_status']>, updatedAnalysis?: AnalysisResult) => void;
  /** Abre a aba Capital com o valor do edital pré-preenchido */
  onGoToCapital?: (valor: number) => void;
  /** Avisa quem renderiza a lista (ex.: painel Gestão) quando o acompanhamento muda,
   * já que o toggle é local a este componente e o "+ Gestão"/"Remover" precisa
   * refletir imediatamente numa lista filtrada por tracked_in_gestao. */
  onTrackedChange?: (tracked: boolean) => void;
  /** Menu lateral do app-shell (AppSidebar) — só passado por quem tem esse menu
   * pra ocultar (workspace principal). Sem essas props o botão de menu não
   * aparece (ex.: dentro da Gestão, que já tem seu próprio controle). */
  sidebarHidden?: boolean;
  onToggleSidebar?: () => void;
}

type LearningStats = {
  go: {
    total_com_resultado: number;
    vitorias: number;
    derrotas: number;
    taxa_acerto_pct: number | null;
    amostra_suficiente: boolean;
  };
  no_go: {
    total_participou_mesmo_assim: number;
    alertas_validados: number;
    alertas_nao_validados: number;
    taxa_alerta_validado_pct: number | null;
    amostra_suficiente: boolean;
  };
  amostra_minima: number;
};

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
  onCockpitStatusChange,
  onGoToCapital,
  onTrackedChange,
  sidebarHidden = false,
  onToggleSidebar,
}: AnalysisResultsProps) {
  const [copied, setCopied] = useState(false);
  const [liveResult, setLiveResult] = useState(result);
  const [tracked, setTracked] = useState<boolean>(!!result.tracked_in_gestao);
  const [trackSaving, setTrackSaving] = useState(false);
  const [activeAnaliseStep, setActiveAnaliseStep] = useState<string>('panorama');
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  // Derived: concorrentes step is active when that tab is selected
  const activeStep = activeTab === 'concorrentes' ? 'concorrentes' : activeAnaliseStep;

  // ── Tela cheia do painel de resultados ──────────────────────────────────
  // Fullscreen real (API do navegador): 100% da largura pra quem quer ler sem
  // distração, disponível sempre que este componente é montado. Independente
  // do toggle de menu (onToggleSidebar), que só existe quando quem chama este
  // componente tem um menu lateral pra ocultar.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    setLiveResult(result);
    setTracked(!!result.tracked_in_gestao);
  }, [result]);

  // Taxa de acerto real (veredito x resultado registrado) — prova baseada em
  // dado do próprio workspace, não autoavaliação da IA. Silenciosa se falhar.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/analyses/learning-stats`);
        if (cancelled) return;
        if (!res.ok) {
          console.warn(`[learning-stats] resposta não-ok: ${res.status}`);
          return;
        }
        const data = await res.json().catch(() => null);
        if (data && !cancelled) setLearningStats(data);
      } catch (err) {
        // Selo de calibração simplesmente não aparece — mas o erro fica
        // visível no console para diagnóstico, em vez de sumir sem rastro.
        console.warn('[learning-stats] falha na requisição:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const toggleTracking = async () => {
    if (!analysisId || !token || trackSaving) return;
    const next = !tracked;
    setTracked(next);
    setTrackSaving(true);
    try {
      await apiFetch(`${API_URL}/api/analyses/${analysisId}/track`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: next }),
      });
      onTrackedChange?.(next);
    } catch {
      setTracked(!next);
    } finally {
      setTrackSaving(false);
    }
  };

  const handleStepClick = (step: (typeof JOURNEY_STEPS)[number]) => {
    if (step.tab !== activeTab) {
      onSetActiveTab(step.tab);
    }
    if (step.tab === 'analise') {
      setActiveAnaliseStep(step.key);
    }
    if (step.sectionId) {
      const delay = step.tab !== activeTab ? 200 : 50;
      setTimeout(() => {
        document.getElementById(step.sectionId!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, delay);
    }
  };

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
      ref={rootRef}
      className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative animate-in fade-in duration-500 font-sans [&:fullscreen]:overflow-y-auto [&:fullscreen]:rounded-none"
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
                  className="shrink-0 px-5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors text-sm flex items-center gap-2 print:hidden"
                  title={result.estimated_value ? `Abrir Capital com ${result.estimated_value} pré-preenchido` : 'Abrir Capital de Giro'}
                >
                  <Banknote size={15} />
                  Capital de Giro
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

          {/* Ações discretas: exportar, imprimir, compartilhar — não competem com o veredito */}
          <div className="flex items-center gap-1 self-end -mt-1">
            <button
              onClick={onExportPDF}
              title="Exportar PDF"
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              <Download size={15} />
            </button>
            <button
              onClick={() => window.print()}
              title="Imprimir"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Printer size={15} />
            </button>
            {token && analysisId && (
              <button
                onClick={onShare}
                disabled={isSharing}
                title={isSharing ? 'Enviando...' : 'Compartilhar por e-mail'}
                className="p-2 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-sky-50 transition-colors disabled:opacity-60"
              >
                <Mail size={15} />
              </button>
            )}
            <button
              onClick={handleCopyLink}
              title={copied ? 'Copiado!' : 'Copiar link'}
              className={`p-2 rounded-lg transition-colors ${
                copied ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {copied ? <Check size={15} /> : <Link2 size={15} />}
            </button>
            {typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                title="Compartilhar"
                className="p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <Share2 size={15} />
              </button>
            )}
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                title={sidebarHidden ? 'Mostrar menu' : 'Ocultar menu para ganhar espaço'}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {sidebarHidden ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia — usar 100% da largura'}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>

          </div>

        {/* ══ JORNADA — navegação principal no topo ══ */}
        <JourneyStepNav
          activeStep={activeStep}
          onStepClick={handleStepClick}
          currentTier={currentTier}
          userTier={userTier}
        />

        {/* Score, veredito e aderência ao CNAE viviam repetidos em ~4 formatos
            diferentes espalhados pelas etapas. Esta barra é o único lugar
            "canônico" — fica visível em qualquer etapa, sempre no mesmo
            lugar, para dar uma referência estável enquanto se navega. */}
        <PersistentSummaryBar result={liveResult} />

        {/* ══ CONTEÚDO DA ETAPA ATIVA ══ */}
        <div key={activeStep} className="animate-in fade-in duration-300">

          {/* ── 00 Panorama ── */}
          {activeStep === 'panorama' && (
            <div id="section-panorama" className="scroll-mt-24 space-y-8">
              <ExpiredBanner result={liveResult} />

              {/* Início-meio-fim antes de qualquer detalhe — quem só quer o
                  quadro geral não precisa abrir as outras etapas para
                  entender a história inteira. */}
              <JourneySummary result={liveResult} onStepClick={handleStepClick} />

              {/* "Log de trabalho" da IA: todas as frentes avaliadas, o que
                  sustenta cada uma e o que não precisa de atenção — em um só
                  lugar, sem precisar reabrir as 6 etapas pra confirmar. */}
              <EscopoAnaliseSection result={liveResult} onStepClick={handleStepClick} />
            </div>
          )}

          {/* ── 01 Veredito ── */}
          {activeStep === 'veredito' && (
            <div className="space-y-8">
              <ExpiredBanner result={liveResult} />
              <MeEppImpeditivoBanner result={liveResult} />

              {/* O veredito e o porquê vêm primeiro — é a resposta que o usuário veio buscar.
                  Score, cronograma e evidências abaixo sustentam essa resposta. */}
              <div id="section-score" className="scroll-mt-24">
                <DecisionSnapshot result={liveResult} learningStats={learningStats} />
              </div>
              <SemaforoSection result={liveResult} />
              <OrgaoContextoSection result={liveResult} />
              <CronogramaSection result={liveResult} />

              <div className="relative border border-slate-200 rounded-2xl p-8">
                <SectionLabel icon={<Target size={18} className="text-slate-700" />} label="Resumo Executivo" />
                <div className="text-slate-700 text-sm md:text-base leading-relaxed space-y-4 font-medium whitespace-pre-line mt-2">
                  {liveResult.summary}
                </div>
              </div>
              <OportunidadesSection result={liveResult} />
            </div>
          )}

          {/* ── 02 Critérios ── */}
          {/* Prova/auditoria da decisão: parâmetros avaliados, ficha técnica e
              composição do score — tudo o que sustenta o veredito, num só
              lugar, visível por padrão (antes ficava escondido dentro de
              "Veredito" atrás de dois cliques em <details>). */}
          {activeStep === 'criterios' && (
            <div id="section-criterios" className="scroll-mt-24 space-y-10">
              {/* 1 · dados brutos extraídos → 2 · critérios aplicados sobre eles →
                  3 · resultado (score) que sai dessa aplicação. Cada bloco tinha o
                  mesmo peso visual antes, sem indicar essa relação — o "1 · 2 · 3"
                  deixa explícito que ficha técnica não é um critério, é a base de
                  dados que os critérios e o score usam. */}
              <section className="space-y-4">
                <ChapterDivider index={1} title="Dados extraídos do edital" />
                <CollapsibleFichaTecnica result={liveResult} />
              </section>

              <section className="space-y-4">
                <ChapterDivider index={2} title="Critérios aplicados" />
                <ParametrosSection result={liveResult} />
              </section>

              <section className="space-y-4">
                <ChapterDivider index={3} title="Como chegamos ao score" />
                <ScoreHeader result={liveResult} />
                <CollapsibleScoreBreakdown result={liveResult} />
              </section>
            </div>
          )}

          {/* ── 03 SWOT & Riscos ── */}
          {activeStep === 'analise' && (
            <div id="section-analise" className="scroll-mt-24">
              {(() => {
                const item = buildJourneySummary(liveResult).find((i) => i.key === 'analise')!;
                const tone: TimelineTone =
                  item.status === 'alerta' ? 'red'
                  : item.status === 'atencao' ? 'amber'
                  : item.status === 'ok' ? 'emerald'
                  : 'slate';
                return (
                  <StepHeadline
                    tone={tone}
                    eyebrow="SWOT & Riscos"
                    headline={item.headline}
                  >
                    <RedFlagsSection result={liveResult} />
                    <SwotSection result={liveResult} />
                    <HabilitacaoSection result={liveResult} />
                    <RisksSection result={liveResult} />
                    <MatrizRiscoFormalSection result={liveResult} />
                  </StepHeadline>
                );
              })()}
            </div>
          )}

          {/* ── 04 Jurídico ── */}
          {activeStep === 'juridico' && (
            <div id="section-juridico" className="scroll-mt-24">
              {(() => {
                const item = buildJourneySummary(liveResult).find((i) => i.key === 'juridico')!;
                const tone: TimelineTone =
                  item.status === 'alerta' ? 'red'
                  : item.status === 'atencao' ? 'amber'
                  : item.status === 'ok' ? 'emerald'
                  : 'slate';
                return (
                  <StepHeadline
                    tone={tone}
                    eyebrow="Jurídico"
                    headline={item.headline}
                  >
                    <PareceSection result={liveResult} userTier={userTier} onUpgradeClick={onUpgradeClick} />
                    <div className="pt-6 border-t border-slate-100 print:hidden">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-slate-400" strokeWidth={2} />
                        Raciocínio Estratégico da IA
                      </h4>
                      <div className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-line bg-slate-50 p-5 rounded-xl border border-slate-100">
                        {liveResult.rationale || liveResult.recommendation || 'Sem dados estratégicos.'}
                      </div>
                    </div>
                  </StepHeadline>
                );
              })()}
            </div>
          )}

          {/* ── 05 Concorrentes ── */}
          {activeStep === 'concorrentes' && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              {(() => {
                const item = buildJourneySummary(liveResult).find((i) => i.key === 'concorrentes')!;
                const tone: TimelineTone =
                  item.status === 'alerta' ? 'red'
                  : item.status === 'atencao' ? 'amber'
                  : item.status === 'ok' ? 'emerald'
                  : 'slate';
                return <StepHeadline tone={tone} eyebrow="Concorrentes" headline={item.headline} />;
              })()}
              <PremiumLock
                isLocked={Math.max(getCachedTier(userTier), currentTier) < 2}
                featureTitle="Radar de Concorrentes"
                requiredTierName="Nível 2 (Essencial)"
                onUpgradeClick={onUpgradeClick}
              >
                <CompetitorWarRoom
                  competitorsNacionais={liveResult.concorrentes_provaveis || []}
                  competitorsRegionais={liveResult.concorrentes_regionais || []}
                  uf={liveResult.uf || 'GO'}
                  pricing={liveResult.pricing_intelligence as import('./CompetitorWarRoom').PricingIntelligenceData | undefined}
                  analysisId={analysisId || ''}
                  userTier={userTier}
                  fullResult={liveResult as import('./CompetitorWarRoom').FullResultData}
                />
              </PremiumLock>
            </div>
          )}

          {/* ── 06 Cockpit ── */}
          {activeStep === 'cockpit' && (() => {
            // O painel Gestão (menu lateral) é onde o acompanhamento realmente
            // acontece — é um recurso Nível 4. Quem ainda não tem acesso é
            // levado para o upgrade em vez de um link que não leva a lugar nenhum.
            const gestaoDisponivel = Math.max(getCachedTier(userTier), currentTier) >= 4;
            const onGoToGestao = () => {
              if (gestaoDisponivel) onSetActiveTab('gestao');
              else onUpgradeClick();
            };
            return (
            <div className="space-y-6">
              <DecisionCockpit
                result={liveResult}
                analysisId={analysisId}
                token={token}
                onStatusChange={onCockpitStatusChange}
                tracked={tracked}
                trackSaving={trackSaving}
                onToggleTracking={toggleTracking}
                onGoToGestao={onGoToGestao}
                gestaoDisponivel={gestaoDisponivel}
              />
              <EsteiraCTA
                result={liveResult}
                tracked={tracked}
                trackSaving={trackSaving}
                onToggle={toggleTracking}
                analysisId={analysisId}
                token={token}
                onGoToGestao={onGoToGestao}
                gestaoDisponivel={gestaoDisponivel}
              />

              {/* Ferramentas operacionais — precificar a proposta e acompanhar
                  mudanças no edital ao longo do tempo. Ficam aqui, junto do
                  resto do que se faz DEPOIS da decisão, não misturadas com o
                  veredito em si. */}
              {liveResult.pricing_intelligence && !isNoGoVerdict(liveResult) && (
                <div className="print:hidden">
                  <TacticalSimulator
                    pricing={liveResult.pricing_intelligence}
                    fullResult={liveResult}
                    userTier={userTier}
                  />
                </div>
              )}
              {liveResult.pricing_intelligence && isNoGoVerdict(liveResult) && (
                <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 print:hidden">
                  <Target size={18} className="mt-0.5 shrink-0 text-slate-400" />
                  <p className="text-sm font-medium leading-relaxed text-slate-500">
                    <strong className="text-slate-700">Simulador tático desativado:</strong> o veredito é No-Go — não há
                    proposta a precificar. Se o órgão corrigir o edital (documentos, prazos), reprocesse a análise para reativá-lo.
                  </p>
                </div>
              )}
              <DecisionVersionMonitor
                result={liveResult}
                analysisId={analysisId}
                token={token}
                onAnalysisUpdate={(updated) => setLiveResult(updated)}
              />

              <PremiumLock
                isLocked={currentTier < 4}
                featureTitle="Laudo de Decisão Bawzi (PDF)"
                requiredTierName="Nível 4 (Avançado)"
                onUpgradeClick={onUpgradeClick}
              >
                <PdfExportCard onExportPDF={onExportPDF} />
              </PremiumLock>
            </div>
            );
          })()}

        </div>

        {/* LAYOUT DE IMPRESSÃO — renderiza tudo, visível apenas ao imprimir */}
        <PrintLayout result={liveResult} />

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
    </div>
  );
}

function DecisionSnapshot({
  result,
  learningStats,
}: {
  result: AnalysisResult;
  learningStats?: LearningStats | null;
}) {
  const decision = normalizeDecision(result);
  const verdict = decisionUi[decision.veredito];

  // Calibração real: taxa de acerto do seu próprio histórico para o mesmo
  // tipo de veredito — prova baseada em dado, não a IA reavaliando a si mesma.
  const calibracao = (() => {
    if (!learningStats) return null;
    if (decision.veredito === 'GO' || decision.veredito === 'GO_CONDICIONADO') {
      const { go } = learningStats;
      if (!go.amostra_suficiente) return null;
      return { pct: go.taxa_acerto_pct, label: 'de acerto real em vereditos GO', n: go.total_com_resultado };
    }
    if (decision.veredito === 'NO_GO') {
      const { no_go: noGo } = learningStats;
      if (!noGo.amostra_suficiente) return null;
      return { pct: noGo.taxa_alerta_validado_pct, label: 'dos alertas No-Go se confirmaram', n: noGo.total_participou_mesmo_assim };
    }
    return null;
  })();
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
  const conditions = filterCoveredDecisionItems(rawConditions, businessFit, 'conditions');

  // ── Deduplicação entre seções: a IA tende a repetir o mesmo fato em
  // Impedimentos, Motivos e Lacunas. Impedimentos têm prioridade (são o
  // conteúdo acionável); o que já apareceu não se repete nas demais.
  const _vistosDedup: string[] = [];
  const blockers = dedupTextos(filterCoveredDecisionItems(rawBlockers, businessFit, 'blockers'), _vistosDedup);
  const reasons = dedupTextos(filterCoveredDecisionItems(rawReasons, businessFit, 'reasons'), _vistosDedup);
  const changeTriggers = dedupTextos(
    decision.o_que_mudaria_decisao.length ? decision.o_que_mudaria_decisao : conditions,
    _vistosDedup,
  );
  const evidenceItems = decision.evidencias.slice(0, 4);
  const gapItems = dedupTextos(decision.lacunas, _vistosDedup);

  // Detalhes da "Base da confiança" que apenas repetem evidências são omitidos
  const _evidenciaTextos = evidenceItems.map(e => `${e.titulo || ''} ${e.detalhe || ''}`);
  const detalheJaCoberto = (txt?: string) =>
    !!txt && _evidenciaTextos.some(ev => textosSimilares(ev, txt));

  const decisionColumns = [
    {
      label: 'Impedimentos',
      Icon: AlertTriangle,
      items: blockers.slice(0, 3),
      tone: decision.impeditivos.length ? 'text-red-500' : 'text-slate-400',
    },
    {
      label: 'Motivos',
      Icon: Target,
      items: reasons.slice(0, 3),
      tone: 'text-slate-500',
    },
    {
      label: 'Mudaria a decisão',
      Icon: CircleHelp,
      items: changeTriggers.slice(0, 3),
      tone: 'text-amber-500',
    },
  ].filter(col => col.items.length > 0);
  const decisionColsClass =
    decisionColumns.length === 1 ? 'md:grid-cols-1'
    : decisionColumns.length === 2 ? 'md:grid-cols-2'
    : 'md:grid-cols-3';

  return (
    <section className="mb-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm print:hidden">
      <div className={`h-1.5 ${verdict.bar}`} />

      <div className="p-6 md:p-8">

        {/* ── Cabeçalho: veredito + métricas em linha ───────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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

          {/* Indicadores compactos no cabeçalho */}
          <div className="flex shrink-0 gap-3">
            <div
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center min-w-[80px]"
              title="Bawzi Score: nota de 0 a 100 que resume a recomendação, calculada a partir dos critérios técnicos, financeiros, jurídicos e de documentação avaliados. Quanto maior, mais favorável é participar."
            >
              <p className={`text-2xl font-black leading-none ${verdict.text}`}>{result.score}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Viabilidade
                <CircleHelp size={10} className="shrink-0 opacity-70" />
              </p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${verdict.bar}`} style={{ width: `${result.score}%` }} />
              </div>
            </div>
            <div
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center min-w-[80px]"
              title="O quanto a IA está segura desta decisão, com base na quantidade e qualidade das evidências encontradas no edital. Cai quando há lacunas ou fatores não confirmados — não é a mesma coisa que viabilidade."
            >
              <p className="text-2xl font-black leading-none text-slate-700">{decision.confianca}%</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Confiança
                <CircleHelp size={10} className="shrink-0 opacity-70" />
              </p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-slate-500" style={{ width: `${decision.confianca}%` }} />
              </div>
            </div>
            {typeof result.qualidade_extracao?.cobertura_pct === 'number' && (
              <div
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center min-w-[80px]"
                title={
                  `Percentual de campos críticos do edital (objeto, valores, prazos, garantias etc.) que a IA conseguiu localizar para basear a análise. ${
                    result.qualidade_extracao.campos_faltantes?.length
                      ? `Não localizados: ${result.qualidade_extracao.campos_faltantes.join(', ')}`
                      : 'Todos os campos críticos foram localizados no material.'
                  }`
                }
              >
                <p className={`text-2xl font-black leading-none ${
                  result.qualidade_extracao.cobertura_pct >= 75 ? 'text-emerald-600'
                  : result.qualidade_extracao.cobertura_pct >= 45 ? 'text-amber-600'
                  : 'text-red-600'
                }`}>{result.qualidade_extracao.cobertura_pct}%</p>
                <p className="mt-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Cobertura
                  <CircleHelp size={10} className="shrink-0 opacity-70" />
                </p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${
                    result.qualidade_extracao.cobertura_pct >= 75 ? 'bg-emerald-500'
                    : result.qualidade_extracao.cobertura_pct >= 45 ? 'bg-amber-500'
                    : 'bg-red-500'
                  }`} style={{ width: `${result.qualidade_extracao.cobertura_pct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Calibração real (histórico do workspace) ──────────────────── */}
        {calibracao && (
          <p className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <Trophy size={12} className="text-emerald-600" />
            Histórico real do seu workspace: <span className="text-emerald-700">{calibracao.pct}% {calibracao.label}</span>
            <span className="text-slate-400">({calibracao.n} caso{calibracao.n === 1 ? '' : 's'} registrado{calibracao.n === 1 ? '' : 's'})</span>
          </p>
        )}

        {/* ── Síntese ───────────────────────────────────────────────────── */}
        <div className={`mt-6 rounded-2xl border px-5 py-4 ${verdict.summary}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Síntese do veredito</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">{summaryText}</p>
          {decision.veredito === 'NO_GO' && blockers.length > 0 && (
            <div className="mt-3 border-t border-red-200/60 pt-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Motivo exato do No-Go</p>
              <ul className="mt-1.5 space-y-1.5">
                {blockers.slice(0, 3).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-slate-700">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" />
                    {item}
                  </li>
                ))}
              </ul>
              {evidenceItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => document.getElementById('veredito-evidencias')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="mt-3 text-[11px] font-black text-red-700 underline underline-offset-2 hover:text-red-900"
                >
                  Ver o trecho do edital que comprova isso ↓
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Aderência ao negócio ──────────────────────────────────────── */}
        {businessFit && (
          <div className={`mt-5 rounded-2xl border px-5 py-4 ${businessFit.shell}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <Settings2 size={14} className={businessFit.icon} />
                  Aderência ao negócio
                </p>
                <p className="mt-2 text-sm font-black leading-snug text-slate-900">{businessFit.label}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">{businessFit.description}</p>
              </div>
              <div className="shrink-0 rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Match CNAE</p>
                <p className={`mt-1 text-lg font-black leading-none ${businessFit.text}`}>{businessFit.score}/100</p>
              </div>
            </div>
            {(businessFit.cnae || businessFit.object) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {businessFit.cnae && (
                  <span className="rounded-lg bg-white/65 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                    CNAE: {businessFit.cnae}
                  </span>
                )}
                {businessFit.object && (
                  <span className="rounded-lg bg-white/65 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                    Edital: {businessFit.object}
                  </span>
                )}
              </div>
            )}
            {businessFit.viaSecundario && businessFit.cnaeCorrespondente && (
              <p className="mt-2 text-[11px] font-bold text-slate-600">
                ✓ Match encontrado via CNAE secundário: {businessFit.cnaeCorrespondente}
              </p>
            )}
            {businessFit.cnaesSecundarios.length > 0 && (
              <details className="mt-3 group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700">
                  <ChevronDown size={12} className="shrink-0 transition-transform group-open:rotate-180" />
                  Ver {businessFit.cnaesSecundarios.length} CNAE(s) secundário(s) da empresa
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {businessFit.cnaesSecundarios.map((item, idx) => (
                    <span
                      key={`${item.codigo || idx}`}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                        businessFit.cnaeCorrespondente && item.codigo && businessFit.cnaeCorrespondente.startsWith(item.codigo)
                          ? 'bg-emerald-600/10 text-emerald-800 ring-1 ring-emerald-300'
                          : 'bg-white/65 text-slate-600'
                      }`}
                    >
                      {[item.codigo, item.descricao].filter(Boolean).join(' · ')}
                    </span>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* ── Evidências, impedimentos, lacunas e base da confiança ficam
             atrás de um toggle: a síntese acima já resume o essencial, e as
             próximas ações (abaixo) já dizem o que fazer. Isso evita que o
             veredito pareça "cheio" antes mesmo do usuário decidir explorar. */}
        <details className="group mt-5" open={decision.veredito === 'NO_GO'}>
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
            <ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" />
            Ver evidências, impedimentos, lacunas e base da confiança
          </summary>

        {/* ── Evidências ────────────────────────────────────────────────── */}
        {evidenceItems.length > 0 && (
          <div id="veredito-evidencias" className="mt-3 scroll-mt-24 rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4">
            <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Shield size={14} className={verdict.text} />
              Por que a decisão é segura
            </p>
            <Timeline
              items={evidenceItems.map((evidence, index) => ({
                key: `${evidence.titulo}-${index}`,
                tone: 'slate',
                icon: <span className="text-[10px] font-black">{index + 1}</span>,
                eyebrow: evidence.categoria || 'Evidência',
                badge: (evidence.referencia || evidence.fonte)
                  ? { label: evidence.referencia || evidence.fonte, tone: 'slate' }
                  : undefined,
                title: evidence.titulo,
                description: (
                  <>
                    {evidence.detalhe && <span className="block">{evidence.detalhe}</span>}
                    {evidence.trecho && (
                      <blockquote className="mt-2 rounded-lg border-l-4 border-slate-300 bg-white px-3 py-2 text-[11px] italic text-slate-600">
                        "{evidence.trecho}"
                      </blockquote>
                    )}
                    {evidence.impacto && (
                      <span className="mt-1.5 block text-[11px] font-bold text-slate-500">Impacto: {evidence.impacto}</span>
                    )}
                  </>
                ),
              }))}
            />
          </div>
        )}

        {/* ── Impedimentos / Motivos / O que mudaria: uma única sequência,
             ordenada por prioridade, para dar leitura clara de cima a baixo */}
        {decisionColumns.length > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-5">
            <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <ListOrdered size={14} className="text-slate-400" />
              Leitura da decisão, em ordem
            </p>
            <Timeline
              items={decisionColumns.flatMap(({ label, items, tone: colTone }) =>
                items.map((item, index) => ({
                  key: `${label}-${item}-${index}`,
                  tone: (colTone.includes('red') ? 'red' : colTone.includes('amber') ? 'amber' : 'slate') as TimelineTone,
                  eyebrow: label,
                  title: item,
                }))
              )}
            />
          </div>
        )}

        {/* ── Lacunas ───────────────────────────────────────────────────── */}
        {gapItems.length > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <SearchX size={14} className="text-amber-500" />
              Lacunas da análise
              <span className="font-medium normal-case tracking-normal text-slate-400">· o que ainda não está coberto acima</span>
            </p>
            <Timeline
              dense
              items={gapItems.slice(0, 4).map((item, index) => ({
                key: `${item}-${index}`,
                tone: 'amber',
                title: item,
              }))}
            />
          </div>
        )}

        {/* ── Base da confiança ──────────────────────────────────────────── */}
        {decision.fatores_confianca.length > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <FileText size={14} className="text-slate-400" />
              Base da confiança
            </p>
            <Timeline
              dense
              items={decision.fatores_confianca.slice(0, 5).map((factor, index) => {
                const status = confidenceStatusUi[factor.status] || confidenceStatusUi.parcial;
                const tone: TimelineTone =
                  factor.status === 'confirmado' ? 'emerald'
                  : factor.status === 'risco' ? 'red'
                  : factor.status === 'ausente' ? 'slate'
                  : 'amber';
                return {
                  key: `${factor.criterio}-${index}`,
                  tone,
                  title: factor.criterio,
                  badge: { label: status.label, tone },
                  description: factor.detalhe,
                };
              })}
            />
          </div>
        )}
        </details>

        {/* ── Próxima ação ──────────────────────────────────────────────── */}
        {decision.proximas_acoes.length > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <ClipboardList size={14} className="text-slate-400" />
              Próximas ações, em ordem
            </p>
            <Timeline
              items={decision.proximas_acoes.slice(0, 3).map((acao, index) => ({
                key: `${acao.acao}-${index}`,
                tone: 'blue' as TimelineTone,
                hollow: index > 0,
                eyebrow: acao.prazo || undefined,
                title: acao.acao,
                description: [acao.responsavel, acao.resultado_esperado].filter(Boolean).join(' · ') || undefined,
              }))}
            />
          </div>
        )}

      </div>
    </section>
  );
}

function DecisionVersionMonitor({
  result,
  analysisId,
  token,
  onAnalysisUpdate,
}: {
  result: AnalysisResult;
  analysisId: string | null;
  token: string | null;
  onAnalysisUpdate: (analysis: AnalysisResult) => void;
}) {
  const [isChecking, setIsChecking] = useState(false);
  const [reviewingIndex, setReviewingIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const monitor = toUiRecord(result.pncp_monitor);
  const ref = toUiRecord(result.pncp_ref);
  const hasPncpRef = Boolean(ref.cnpj || result.pncp_cnpj) && Boolean(ref.ano || result.pncp_ano) && Boolean(ref.sequencial || result.pncp_sequencial);
  const events = toUiRecords(result.pncp_monitor_events).slice().reverse();
  const reviews = toUiRecords(result.decision_reviews).slice().reverse();
  const files = toUiRecords(monitor.files);
  const lastChecked = formatVersionDate(monitor.last_checked_at);

  const checkPncp = async () => {
    if (!analysisId || !token || isChecking) return;
    setIsChecking(true);
    setNotice(null);
    try {
      const response = await apiFetch(`${API_URL}/api/analyses/${analysisId}/pncp-monitor/check`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(data?.detail || 'Não foi possível verificar o PNCP agora.');
        return;
      }
      if (data?.analysis) onAnalysisUpdate(data.analysis as AnalysisResult);
      setNotice(data?.changed ? 'Mudança oficial detectada no PNCP.' : 'PNCP verificado: sem mudanças oficiais.');
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setNotice('Erro de conexão ao verificar o PNCP.');
    } finally {
      setIsChecking(false);
    }
  };

  const reviewFromEvent = async (event: Record<string, unknown>, index: number) => {
    if (!analysisId || !token || reviewingIndex !== null) return;
    const payload = toUiRecord(event.review_payload);
    const fallbackContent = [
      String(event.titulo || 'Mudança detectada no PNCP'),
      String(event.descricao || ''),
      ...toUiRecords(event.added_files).map((file) => `- ${file.titulo || 'Arquivo'}: ${file.link || ''}`),
    ].join('\n');

    setReviewingIndex(index);
    setNotice(null);
    try {
      const response = await apiFetch(`${API_URL}/api/analyses/${analysisId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: String(payload.tipo || 'alteracao_edital'),
          titulo: String(payload.titulo || event.titulo || 'Mudança detectada no PNCP'),
          conteudo: String(payload.conteudo || fallbackContent),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(data?.detail || 'Não foi possível revisar a decisão.');
        return;
      }
      if (data?.analysis) onAnalysisUpdate(data.analysis as AnalysisResult);
      setNotice('Decisão revisada e versão salva no laudo.');
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setNotice('Erro de conexão ao revisar a decisão.');
    } finally {
      setReviewingIndex(null);
    }
  };

  return (
    <section className="mb-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm print:hidden">
      <div className="border-b border-slate-100 bg-slate-50 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <History size={14} />
              Monitor PNCP e versões
            </p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">Validade contínua da decisão</h3>
          </div>
          <button
            type="button"
            onClick={checkPncp}
            disabled={!hasPncpRef || !token || !analysisId || isChecking}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isChecking ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Verificar PNCP
          </button>
        </div>
        {notice && (
          <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-bold text-sky-800">
            {notice}
          </div>
        )}
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
        <VersionMetric icon={<RefreshCw size={15} />} label="Status PNCP" value={hasPncpRef ? String(monitor.status || 'monitorado') : 'sem origem PNCP'} />
        <VersionMetric icon={<FileText size={15} />} label="Arquivos oficiais" value={hasPncpRef ? `${Number(monitor.files_count || files.length || 0)} arquivo(s)` : 'não monitorado'} />
        <VersionMetric icon={<Clock size={15} />} label="Última checagem" value={lastChecked || 'ainda não verificado'} />
      </div>

      {(events.length > 0 || reviews.length > 0 || files.length > 0) && (
        <div className="grid gap-4 border-t border-slate-100 p-5 md:grid-cols-[1.15fr_0.85fr] md:p-6">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Linha do tempo da decisão</p>
            {reviews.length === 0 && events.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-500">
                Nenhuma revisão ou mudança oficial registrada ainda.
              </div>
            ) : (
              [...events.map((item, index) => ({ kind: 'event', item, index })), ...reviews.map((item, index) => ({ kind: 'review', item, index }))]
                .slice(0, 6)
                .map((entry) => (
                  <div key={`${entry.kind}-${entry.index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
                          entry.kind === 'event' ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                        }`}>
                          {entry.kind === 'event' ? 'Mudança PNCP' : 'Revisão'}
                        </span>
                        <p className="mt-2 text-sm font-black leading-snug text-slate-900">
                          {String(entry.item.titulo || entry.item.title || 'Versão registrada')}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                          {String(entry.item.descricao || entry.item.conteudo || entry.item.previous_decision || 'Decisão atualizada.')}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-black uppercase text-slate-400">
                        {formatVersionDate(entry.item.created_at)}
                      </span>
                    </div>
                    {entry.kind === 'event' && (
                      <button
                        type="button"
                        onClick={() => reviewFromEvent(entry.item, entry.index)}
                        disabled={!token || reviewingIndex !== null}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-black uppercase text-sky-700 transition-all hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {reviewingIndex === entry.index ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Revisar com esta mudança
                      </button>
                    )}
                  </div>
                ))
            )}
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Snapshot oficial</p>
            {files.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-500">
                Nenhum arquivo oficial salvo no snapshot atual.
              </div>
            ) : files.slice(0, 5).map((file, index) => (
              <div key={`${file.link || file.titulo || index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="line-clamp-2 text-xs font-black leading-snug text-slate-800">{String(file.titulo || 'Arquivo oficial')}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {String(file.tipo || 'Documento')} {file.data_publicacao ? `· ${file.data_publicacao}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function VersionMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className="break-words text-sm font-black leading-snug text-slate-900">{value}</p>
    </div>
  );
}

type DecisionCockpitTask = {
  id: string;
  prazo: string;
  acao: string;
  responsavel: string;
  resultado_esperado: string;
  /** Impacto do item (vindo do roadmap — exibido no card) */
  impacto?: string;
  origem: string;
  prioridade: 'Alta' | 'Média' | 'Normal';
};

function DecisionCockpit({
  result,
  analysisId,
  token,
  onStatusChange,
  tracked,
  trackSaving,
  onToggleTracking,
  onGoToGestao,
  gestaoDisponivel,
}: {
  result: AnalysisResult;
  analysisId: string | null;
  token: string | null;
  onStatusChange?: (status: NonNullable<AnalysisResult['cockpit_status']>, updatedAnalysis?: AnalysisResult) => void;
  tracked: boolean;
  trackSaving: boolean;
  onToggleTracking: () => void;
  onGoToGestao: () => void;
  gestaoDisponivel: boolean;
}) {
  const decision = normalizeDecision(result);
  const verdict = decisionUi[decision.veredito];
  const tasks = useMemo(() => buildDecisionCockpitTasks(decision, result), [decision, result]);
  const [statusMap, setStatusMap] = useState<NonNullable<AnalysisResult['cockpit_status']>>(() => normalizeCockpitStatus(result.cockpit_status));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => {
    setStatusMap(normalizeCockpitStatus(result.cockpit_status));
  }, [result.cockpit_status, analysisId]);

  if (!tasks.length) return null;

  const completed = tasks.filter((task) => statusMap[task.id]?.done).length;
  const progress = Math.round((completed / tasks.length) * 100);

  const persistStatus = async (nextStatus: NonNullable<AnalysisResult['cockpit_status']>) => {
    onStatusChange?.(nextStatus);
    if (!analysisId || !token) return;

    setSaveState('saving');
    try {
      const res = await apiFetch(`${API_URL}/api/analyses/${analysisId}/cockpit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: nextStatus }),
      });

      if (!res.ok) throw new Error('Falha ao salvar cockpit');
      const data = await res.json().catch(() => null);
      if (data?.analysis) onStatusChange?.(nextStatus, data.analysis);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1800);
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setSaveState('error');
    }
  };

  const toggleTask = (taskId: string, checked: boolean) => {
    const nextStatus = {
      ...statusMap,
      [taskId]: {
        ...statusMap[taskId],
        done: checked,
        updated_at: new Date().toISOString(),
      },
    };
    setStatusMap(nextStatus);
    void persistStatus(nextStatus);
  };

  const updateTaskField = (
    taskId: string,
    field: 'responsavel' | 'prazo' | 'nota',
    value: string,
  ) => {
    setStatusMap((current) => ({
      ...current,
      [taskId]: {
        ...current[taskId],
        [field]: value,
      },
    }));
  };

  const persistTaskField = (
    taskId: string,
    field: 'responsavel' | 'prazo' | 'nota',
  ) => {
    const current = statusMap[taskId] || {};
    const value = String(current[field] || '').trim();
    const nextStatus = {
      ...statusMap,
      [taskId]: {
        ...current,
        [field]: value || undefined,
        updated_at: new Date().toISOString(),
      },
    };
    setStatusMap(nextStatus);
    void persistStatus(nextStatus);
  };

  const isNoGo = decision.veredito === 'NO_GO';
  const cockpitTitle = isNoGo ? 'Monitoramento pós-veredito' : 'Cockpit de execução';
  const cockpitSubtitle = isNoGo
    ? 'Condições a acompanhar para revisar esta decisão'
    : 'Passos para protocolar a proposta — registrados em Gestão';

  return (
    <section className="mb-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm print:hidden">
      {/* Cabeçalho */}
      <div id="cockpit-pos-veredito" className="scroll-mt-24 border-b border-slate-100 bg-slate-50/60 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <ClipboardList size={13} className={verdict.text} />
              {cockpitTitle}
            </p>
            <h3 className="mt-1.5 text-xl font-black tracking-tight text-slate-950">{cockpitSubtitle}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {isNoGo
                ? 'Marque quando as condições mudarem e reprocesse a análise.'
                : 'Preencha responsável e prazo para cada passo — os dados ficam salvos no histórico desta análise.'}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
              Ative "+ Gestão" para acompanhar isto no{' '}
              <button type="button" onClick={onGoToGestao} className="font-black text-slate-700 underline underline-offset-2 hover:text-slate-900">
                painel Gestão, no menu lateral
              </button>
              {gestaoDisponivel ? '.' : ' (recurso Nível 4).'}
            </p>
          </div>

          {/* Progresso + toggle Gestão — unified card */}
          <div className={`shrink-0 min-w-[126px] overflow-hidden rounded-2xl border shadow-sm transition-all ${
            tracked ? 'border-emerald-200' : 'border-slate-200 bg-white'
          }`}>
            {/* Big progress number */}
            <div className={`px-5 pt-4 pb-3 text-center ${tracked ? 'bg-emerald-50' : ''}`}>
              <div className="flex items-baseline justify-center gap-1">
                <span className={`text-[2.5rem] font-black leading-none tabular-nums ${verdict.text}`}>{completed}</span>
                <span className="text-xl font-black text-slate-200">/{tasks.length}</span>
              </div>
              <div className="mx-auto mt-2.5 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all duration-500 ${verdict.bar}`} style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">concluídas</p>
            </div>

            {/* Tracking toggle */}
            <button
              type="button"
              onClick={onToggleTracking}
              disabled={!analysisId || !token || trackSaving}
              title={tracked ? 'Remover do acompanhamento em Gestão' : 'Adicionar ao acompanhamento em Gestão'}
              className={`flex w-full items-center justify-center gap-1.5 border-t px-4 py-2.5 text-[11px] font-black transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                tracked
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'border-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {trackSaving ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Pin size={12} className={tracked ? 'fill-emerald-600 text-emerald-600' : ''} />
              )}
              {tracked ? '✓ Em Gestão' : '+ Gestão'}
            </button>
            {tracked && (
              <button
                type="button"
                onClick={onGoToGestao}
                className="flex w-full items-center justify-center gap-1 border-t border-emerald-100 bg-emerald-50/60 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                {gestaoDisponivel ? 'Ver no painel →' : 'Desbloquear painel →'}
              </button>
            )}
          </div>
        </div>

        {/* Banner save state */}
        {saveState !== 'idle' && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
            saveState === 'error' ? 'bg-red-50 text-red-600'
            : saveState === 'saving' ? 'bg-amber-50 text-amber-600'
            : 'bg-emerald-50 text-emerald-600'
          }`}>
            {saveState === 'error' ? '✕ Erro ao salvar — tente novamente'
              : saveState === 'saving' ? 'Salvando no histórico...'
              : '✓ Salvo no histórico desta análise'}
          </div>
        )}
      </div>

      {/* Lista de tarefas — coluna única, numerada e conectada por uma linha
          vertical atrás dos checkboxes, para reforçar a ordem de execução */}
      <div className="relative px-6">
        <div className="pointer-events-none absolute bottom-6 left-[34px] top-6 w-px bg-slate-200" aria-hidden="true" />
        {tasks.map((task, idx) => {
          const isDone = !!statusMap[task.id]?.done;
          const isOpen = expanded.has(task.id);
          const hasCustomData = !!(statusMap[task.id]?.responsavel || statusMap[task.id]?.prazo || statusMap[task.id]?.nota);
          return (
            <div key={task.id} className={`relative border-b border-slate-100 py-4 last:border-b-0 transition-all ${isDone ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4">

                {/* Número + checkbox: nó da linha do tempo */}
                <div className="relative z-10 flex shrink-0 flex-col items-center gap-1.5 rounded-full bg-white pt-0.5">
                  <span className={`text-[10px] font-black tabular-nums ${isDone ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={(e) => toggleTask(task.id, e.target.checked)}
                    className="h-5 w-5 cursor-pointer rounded border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </div>

                {/* Conteúdo */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                      task.prioridade === 'Alta'
                        ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
                        : task.prioridade === 'Média'
                          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                          : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
                    }`}>
                      {task.prioridade}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 ring-1 ring-slate-200">
                      <Clock size={10} />
                      {task.prazo}
                    </span>
                    {hasCustomData && !isOpen && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 ring-1 ring-emerald-100">
                        ✓ Preenchido
                      </span>
                    )}
                  </div>

                  <p className={`text-sm font-black leading-snug ${isDone ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900'}`}>
                    {task.acao}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                    <strong className="text-slate-600">{task.responsavel}</strong>
                    {task.resultado_esperado ? ` — ${task.resultado_esperado}` : ''}
                  </p>
                  {task.impacto && (
                    <p className="mt-1 text-[11px] font-bold text-amber-700/80">⚠ {task.impacto}</p>
                  )}
                </div>

                {/* Botão de detalhes */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(task.id)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
                >
                  {isOpen ? '↑ Fechar' : '↓ Detalhes'}
                </button>
              </div>

              {/* Painel de detalhes — colapsável */}
              {isOpen && (
                <div className="ml-11 mt-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 pb-4 pt-3">
                  <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Dados salvos nesta análise · visíveis em Gestão
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Responsável</span>
                      <input
                        value={statusMap[task.id]?.responsavel ?? task.responsavel}
                        onChange={(e) => updateTaskField(task.id, 'responsavel', e.target.value)}
                        onBlur={() => persistTaskField(task.id, 'responsavel')}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Prazo</span>
                      <input
                        value={statusMap[task.id]?.prazo ?? task.prazo}
                        onChange={(e) => updateTaskField(task.id, 'prazo', e.target.value)}
                        onBlur={() => persistTaskField(task.id, 'prazo')}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Nota interna</span>
                      <input
                        value={statusMap[task.id]?.nota ?? ''}
                        onChange={(e) => updateTaskField(task.id, 'nota', e.target.value)}
                        onBlur={() => persistTaskField(task.id, 'nota')}
                        placeholder="Ex.: aguardando jurídico, pedido protocolado em 01/07..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function buildDecisionCockpitTasks(decision: DecisionUiData, result: AnalysisResult): DecisionCockpitTask[] {
  const tasks: DecisionCockpitTask[] = [];
  const isNoGo = decision.veredito === 'NO_GO';

  decision.proximas_acoes.forEach((action, index) => {
    const prazo = action.prazo || 'Hoje';
    const priority: DecisionCockpitTask['prioridade'] =
      isNoGo || /agora|hoje/i.test(prazo) ? 'Alta' : 'Média';
    tasks.push({
      id: `decision-${index}-${normalizeDecisionText(action.acao).slice(0, 40)}`,
      prazo,
      acao: action.acao,
      responsavel: action.responsavel || 'Licitações',
      resultado_esperado: action.resultado_esperado || 'Critério objetivo para seguir ou abandonar.',
      origem: 'Decisão',
      prioridade: priority,
    });
  });

  // Itens de checklist (habilitação) só fazem sentido para GO/CONDICIONAL
  if (!isNoGo) {
    (result.checklist || []).slice(0, 6).forEach((item, index) => {
      const record = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
      const acao = shortenDecisionText(record.tarefa || record.descricao || record.label || record.item || item, 180);
      if (!acao) return;
      const impacto = String(record.impacto || '').toLowerCase();
      tasks.push({
        id: `checklist-${index}-${normalizeDecisionText(acao).slice(0, 40)}`,
        prazo: shortenDecisionText(record.prazo || record.fase || 'Antes da proposta', 40),
        acao,
        responsavel: shortenDecisionText(record.responsavel || 'Licitações', 80),
        resultado_esperado: shortenDecisionText(record.resultado_esperado || 'Item validado antes de protocolar a proposta.', 140),
        impacto: shortenDecisionText(record.impacto || '', 120) || undefined,
        origem: 'Checklist',
        prioridade: impacto.includes('alto') || impacto.includes('crítico') || impacto.includes('critico') ? 'Alta' : 'Normal',
      });
    });
  }

  const seen = new Set<string>();
  return tasks
    .filter((task) => {
      const key = normalizeDecisionText(`${task.origem}-${task.acao}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function normalizeCockpitStatus(value: AnalysisResult['cockpit_status']): NonNullable<AnalysisResult['cockpit_status']> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([taskId]) => Boolean(taskId))
      .map(([taskId, state]) => [
        taskId,
        {
          done: Boolean(state?.done),
          updated_at: state?.updated_at,
          responsavel: state?.responsavel,
          prazo: state?.prazo,
          nota: state?.nota,
        },
      ]),
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
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-500">{helper}</p>
        </div>
        <p className={`shrink-0 text-2xl font-black leading-none ${valueClass}`}>{value}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
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
  const cnaesSecundarios = Array.isArray(fit.cnaes_secundarios)
    ? fit.cnaes_secundarios.filter((item) => item && (item.codigo || item.descricao))
    : [];
  const cnaeCorrespondente = fit.cnae_correspondente
    ? [fit.cnae_correspondente, fit.cnae_correspondente_descricao].filter(Boolean).join(' · ')
    : null;
  const viaSecundario = Boolean(
    cnaeCorrespondente && fit.cnae_principal && fit.cnae_correspondente !== fit.cnae_principal
  );
  return {
    ...cfg,
    status,
    score,
    cnae,
    object: shortenDecisionText(fit.objeto_detectado, 110),
    description: shortenDecisionText(fit.justificativa || cfg.fallback, 260),
    cnaesSecundarios,
    cnaeCorrespondente,
    viaSecundario,
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
  evidencias: DecisionEvidenceUi[];
  lacunas: string[];
  fatores_confianca: DecisionConfidenceFactorUi[];
  o_que_mudaria_decisao: string[];
};

type DecisionEvidenceUi = {
  categoria: string;
  titulo: string;
  detalhe: string;
  fonte: string;
  referencia: string;
  trecho: string;
  impacto: string;
};

type DecisionConfidenceFactorUi = {
  criterio: string;
  status: 'confirmado' | 'parcial' | 'ausente' | 'risco';
  detalhe: string;
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

const confidenceStatusUi: Record<DecisionConfidenceFactorUi['status'], {
  label: string;
  pill: string;
}> = {
  confirmado: {
    label: 'Confirmado',
    pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  parcial: {
    label: 'Parcial',
    pill: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  ausente: {
    label: 'Ausente',
    pill: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  },
  risco: {
    label: 'Risco',
    pill: 'bg-red-50 text-red-700 ring-1 ring-red-200',
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
  const fallbackLacunas = toDecisionTextList([
    !result.aderencia_negocio ? 'Perfil/CNAE da empresa não disponível para medir aderência ao negócio.' : '',
    !result.pricing_intelligence?.financial_verdict ? 'Preço e margem ainda precisam de validação financeira antes da proposta.' : '',
    !result.concorrentes_provaveis?.length && !result.concorrentes_regionais?.length
      ? 'Sem histórico concorrencial suficiente para calibrar ameaça de mercado.'
      : '',
  ], 5);
  const lacunas = toDecisionTextList(raw?.lacunas, 7);
  const oQueMudaria = toDecisionTextList(raw?.o_que_mudaria_decisao, 6);
  const baseReasons = motivos.length ? motivos : fallbackMotivos;
  const confidenceFactors = normalizeDecisionConfidenceFactors(raw?.fatores_confianca, result);

  return {
    veredito,
    rotulo: shortenDecisionText(raw?.rotulo || rotulos[veredito], 90),
    confianca: clampPercent(raw?.confianca ?? confidenceFallback(veredito, score)),
    resumo_decisao: shortenDecisionText(raw?.resumo_decisao || resumoPadrao[veredito], 430),
    motivos: baseReasons,
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
    evidencias: normalizeDecisionEvidences(raw?.evidencias, result, baseReasons),
    lacunas: lacunas.length ? lacunas : fallbackLacunas,
    fatores_confianca: confidenceFactors,
    o_que_mudaria_decisao: oQueMudaria.length
      ? oQueMudaria
      : toDecisionTextList([
          ...(condicoes.length ? condicoes : semaforoCondicoes),
          veredito === 'GO'
            ? 'A decisão mudaria se surgir impeditivo documental, jurídico, técnico ou margem negativa.'
            : '',
        ], 6),
  };
}

function normalizeDecisionEvidences(
  raw: DecisionEvidence[] | undefined,
  result: AnalysisResult,
  fallbackReasons: string[],
): DecisionEvidenceUi[] {
  const rawItems = Array.isArray(raw) ? raw : [];
  const fallbackItems: DecisionEvidence[] = [
    result.aderencia_negocio ? {
      categoria: 'Aderência',
      titulo: 'Match com o negócio',
      detalhe: result.aderencia_negocio.justificativa,
      fonte: 'CNAE / Perfil',
      impacto: 'Define se a empresa deveria consumir esforço nesta disputa.',
    } : undefined,
    result.pricing_intelligence?.financial_verdict ? {
      categoria: 'Financeiro',
      titulo: 'Viabilidade econômica',
      detalhe: String(result.pricing_intelligence.financial_verdict),
      fonte: 'Preço / Mercado',
      impacto: 'Ajuda a definir margem, deságio e limite de lance.',
    } : undefined,
    ...(result.risks || []).slice(0, 2).map((risk) => {
      if (typeof risk === 'string') {
        return {
          categoria: 'Risco',
          titulo: risk,
          detalhe: '',
          fonte: 'Riscos',
          impacto: 'Pode alterar ou condicionar o veredito.',
        };
      }
      return {
        categoria: 'Risco',
        titulo: risk.titulo,
        detalhe: risk.descricao,
        fonte: 'Riscos',
        impacto: risk.impacto ? `Impacto ${risk.impacto}.` : 'Pode alterar ou condicionar o veredito.',
      };
    }),
    ...fallbackReasons.slice(0, 2).map((reason) => ({
      categoria: 'Decisão',
      titulo: reason,
      detalhe: '',
      fonte: 'Síntese Bawzi',
      impacto: 'Sustenta a recomendação executiva.',
    })),
  ].filter(Boolean) as DecisionEvidence[];

  const sourceItemsBase = rawItems.length >= 3 ? rawItems : [...rawItems, ...fallbackItems];
  const hasSpecificBusinessEvidence = sourceItemsBase.some((item) => (
    normalizeDecisionText(item?.categoria).includes('aderencia')
    && !normalizeDecisionText(item?.titulo).includes('match com o negocio')
  ));
  const sourceItems = sourceItemsBase.filter((item) => !(
    hasSpecificBusinessEvidence
    && normalizeDecisionText(item?.categoria).includes('aderencia')
    && normalizeDecisionText(item?.titulo).includes('match com o negocio')
  ));
  const seen = new Set<string>();
  return sourceItems
    .map((item) => ({
      categoria: shortenDecisionText(item?.categoria || 'Evidência', 40),
      titulo: shortenDecisionText(item?.titulo || item?.detalhe, 120),
      detalhe: shortenDecisionText(item?.detalhe, 220),
      fonte: shortenDecisionText(item?.fonte, 64),
      referencia: shortenDecisionText(item?.referencia, 80),
      trecho: shortenDecisionText(String(item?.trecho || '').replace(/https?:\/\/\S+/g, '[link oficial]'), 220),
      impacto: shortenDecisionText(item?.impacto, 160),
    }))
    .filter((item) => {
      if (!item.titulo) return false;
      const key = `${item.categoria}|${item.titulo}|${item.detalhe}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function normalizeDecisionConfidenceFactors(
  raw: DecisionConfidenceFactor[] | undefined,
  result: AnalysisResult,
): DecisionConfidenceFactorUi[] {
  const rawItems = Array.isArray(raw) ? raw : [];
  const semaforoValues = Object.values(result.semaforo || {});
  const hasRiskSignal = semaforoValues.some((signal) => signal?.status === 'risco');
  const hasAlertSignal = semaforoValues.some((signal) => signal?.status === 'alerta');
  const businessStatus = String(result.aderencia_negocio?.status || '');
  const fallbackItems: DecisionConfidenceFactor[] = [
    {
      criterio: 'Aderência ao negócio',
      status: businessStatus === 'match_forte'
        ? 'confirmado'
        : businessStatus === 'sem_match'
          ? 'risco'
          : result.aderencia_negocio
            ? 'parcial'
            : 'ausente',
      detalhe: result.aderencia_negocio?.justificativa || 'CNAE/perfil da empresa usado para medir match com o edital.',
    },
    {
      criterio: 'Riscos do edital',
      status: hasRiskSignal ? 'risco' : hasAlertSignal ? 'parcial' : 'confirmado',
      detalhe: hasRiskSignal
        ? 'Há dimensão em risco no semáforo da análise.'
        : hasAlertSignal
          ? 'Há alertas que precisam ser resolvidos antes da proposta.'
          : 'Nenhum risco vermelho foi destacado no semáforo.',
    },
    {
      criterio: 'Preço e margem',
      status: result.pricing_intelligence?.financial_verdict ? 'confirmado' : 'parcial',
      detalhe: result.pricing_intelligence?.financial_verdict || 'Preço mínimo e margem ainda dependem de validação financeira.',
    },
    {
      criterio: 'Histórico de mercado',
      status: result.concorrentes_provaveis?.length || result.concorrentes_regionais?.length ? 'confirmado' : 'ausente',
      detalhe: result.concorrentes_provaveis?.length || result.concorrentes_regionais?.length
        ? 'Há sinais de concorrência/histórico para orientar a disputa.'
        : 'Sem concorrentes prováveis suficientes para calibrar ameaça de mercado.',
    },
  ];

  const seen = new Set<string>();
  return [...rawItems, ...fallbackItems]
    .map((item) => {
      const status = String(item?.status || 'parcial').toLowerCase();
      const normalizedStatus: DecisionConfidenceFactorUi['status'] =
        status === 'confirmado' || status === 'ausente' || status === 'risco' ? status : 'parcial';
      return {
        criterio: shortenDecisionText(item?.criterio, 80),
        status: normalizedStatus,
        detalhe: shortenDecisionText(item?.detalhe, 180),
      };
    })
    .filter((item) => {
      if (!item.criterio) return false;
      const key = item.criterio.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
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

// ─── Deduplicação de conteúdo (a IA repete os mesmos fatos em várias seções) ──

function _tokensDedup(s: unknown): Set<string> {
  const txt = String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  return new Set(txt.split(/\s+/).filter(t => t.length >= 4));
}

/** Similaridade Jaccard de tokens — true quando dois textos dizem a mesma coisa. */
function textosSimilares(a: unknown, b: unknown, limiar = 0.5): boolean {
  const ta = _tokensDedup(a);
  const tb = _tokensDedup(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter += 1; });
  const uniao = ta.size + tb.size - inter;
  return uniao > 0 && inter / uniao >= limiar;
}

/** Remove itens repetidos OU muito similares aos já vistos (set compartilhado entre seções). */
function dedupTextos(itens: string[], vistos: string[]): string[] {
  const out: string[] = [];
  for (const item of itens) {
    const txt = String(item || '').trim();
    if (!txt) continue;
    if (vistos.some(v => textosSimilares(v, txt)) || out.some(o => textosSimilares(o, txt))) continue;
    out.push(txt);
  }
  vistos.push(...out);
  return out;
}

/** Veredito No-Go (campo da decisão ou score muito baixo). */
function isNoGoVerdict(result: AnalysisResult): boolean {
  const decisao = (result as unknown as { decisao?: { veredito?: string } }).decisao;
  const v = String(decisao?.veredito || '').toUpperCase();
  if (v) return v === 'NO_GO';
  return (result.score ?? 100) < 40;
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

// ─── Jornada de análise: steps unificados (substitui tab bar) ────────────────

const JOURNEY_STEPS = [
  {
    key: 'panorama',
    num: '00',
    label: 'Panorama',
    sublabel: 'A história em 1 minuto',
    icon: LayoutDashboard,
    tab: 'analise' as const,
    sectionId: 'section-panorama',
  },
  {
    key: 'veredito',
    num: '01',
    label: 'Veredito',
    sublabel: 'Score e decisão',
    icon: Target,
    tab: 'analise' as const,
    sectionId: 'section-score',
  },
  {
    key: 'criterios',
    num: '02',
    label: 'Critérios',
    sublabel: 'Dados, critérios e score',
    icon: SlidersHorizontal,
    tab: 'analise' as const,
    sectionId: 'section-criterios',
  },
  {
    key: 'analise',
    num: '03',
    label: 'SWOT & Riscos',
    sublabel: 'Análise estratégica',
    icon: AlertTriangle,
    tab: 'analise' as const,
    sectionId: 'section-analise',
  },
  {
    key: 'juridico',
    num: '04',
    label: 'Jurídico',
    sublabel: 'Parecer técnico',
    icon: Scale,
    tab: 'analise' as const,
    sectionId: 'section-juridico',
  },
  {
    key: 'concorrentes',
    num: '05',
    label: 'Concorrentes',
    sublabel: 'Radar de mercado',
    icon: Radar,
    tab: 'concorrentes' as const,
    sectionId: null as string | null,
  },
  {
    key: 'cockpit',
    num: '06',
    label: 'Cockpit',
    sublabel: 'Plano de ação',
    icon: ClipboardList,
    tab: 'analise' as const,
    sectionId: 'cockpit-pos-veredito',
  },
] as const;

type JourneyStepType = (typeof JOURNEY_STEPS)[number];

// ─── Resumo da jornada: início-meio-fim em 6 linhas. Quem só quer o quadro
// geral lê isto e já sabe a história inteira; quem precisa de detalhe clica
// na linha e cai direto na etapa correspondente. ────────────────────────────

type JourneySummaryStatus = 'ok' | 'atencao' | 'alerta' | 'pendente';

type JourneySummaryItem = {
  key: JourneyStepType['key'];
  status: JourneySummaryStatus;
  headline: string;
};

const JOURNEY_SUMMARY_TEXT: Record<JourneySummaryStatus, string> = {
  ok: 'text-emerald-700',
  atencao: 'text-amber-700',
  alerta: 'text-red-700',
  pendente: 'text-slate-400',
};

const JOURNEY_SUMMARY_LABEL: Record<JourneySummaryStatus, string> = {
  ok: 'favorável',
  atencao: 'atenção',
  alerta: 'alerta',
  pendente: 'a fazer',
};

function buildJourneySummary(result: AnalysisResult): JourneySummaryItem[] {
  const decision = normalizeDecision(result);

  const veredito: JourneySummaryItem = {
    key: 'veredito',
    status: decision.veredito === 'GO' ? 'ok' : decision.veredito === 'NO_GO' ? 'alerta' : 'atencao',
    headline: `${decision.rotulo} — score ${result.score}/100.`,
  };

  const params = result.avaliacao_parametros || [];
  const bloqueios = params.filter(p => p.status === 'bloqueio');
  const alertasParam = params.filter(p => p.status === 'alerta');
  const criterios: JourneySummaryItem =
    params.length === 0
      ? { key: 'criterios', status: 'pendente', headline: 'Nenhum critério personalizado avaliado nesta análise.' }
      : bloqueios.length > 0
        ? { key: 'criterios', status: 'alerta', headline: `${bloqueios.length} critério(s) não atende(m) — ${bloqueios[0].nome}.` }
        : alertasParam.length > 0
          ? { key: 'criterios', status: 'atencao', headline: `${alertasParam.length} critério(s) em atenção — ${alertasParam[0].nome}.` }
          : { key: 'criterios', status: 'ok', headline: 'Todos os critérios configurados são atendidos.' };

  const riscos = result.risks || [];
  const riscosAltos = riscos.filter(r => r.impacto === 'alto');
  const flags = result.red_flags || [];
  const flagsAltas = flags.filter(f => f.gravidade === 'alta');
  const analise: JourneySummaryItem =
    riscosAltos.length > 0
      ? { key: 'analise', status: 'alerta', headline: `${riscosAltos.length} risco(s) alto(s) — ${riscosAltos[0].titulo}.` }
      : flagsAltas.length > 0
        ? { key: 'analise', status: 'alerta', headline: `${flagsAltas.length} red flag(s) de gravidade alta identificada(s).` }
        : (riscos.length > 0 || flags.length > 0)
          ? { key: 'analise', status: 'atencao', headline: 'Riscos e pontos de atenção mapeados, nenhum de gravidade alta.' }
          : { key: 'analise', status: 'ok', headline: 'Nenhum risco relevante identificado.' };

  const abusivas = flags.filter(f => classifyRedFlag(f).kind === 'abusividade');
  const juridico: JourneySummaryItem =
    abusivas.length > 0
      ? { key: 'juridico', status: 'alerta', headline: `${abusivas.length} cláusula(s) potencialmente abusiva(s) identificada(s).` }
      : result.parecer_especialista
        ? { key: 'juridico', status: 'ok', headline: 'Parecer jurídico sem apontamentos críticos.' }
        : { key: 'juridico', status: 'pendente', headline: 'Parecer jurídico não gerado nesta análise.' };

  const totalConcorrentes = (result.concorrentes_provaveis?.length || 0) + (result.concorrentes_regionais?.length || 0);
  const nivelAmeaca = result.pricing_intelligence?.nivelAmeaca;
  const concorrentes: JourneySummaryItem = nivelAmeaca
    ? {
        key: 'concorrentes',
        status: /alt/i.test(nivelAmeaca) ? 'alerta' : /m[ée]d/i.test(nivelAmeaca) ? 'atencao' : 'ok',
        headline: `Concorrência ${nivelAmeaca.toLowerCase()}${totalConcorrentes ? ` — ${totalConcorrentes} concorrente(s) mapeado(s)` : ''}.`,
      }
    : totalConcorrentes > 0
      ? { key: 'concorrentes', status: 'atencao', headline: `${totalConcorrentes} concorrente(s) mapeado(s) na região.` }
      : { key: 'concorrentes', status: 'pendente', headline: 'Nenhum concorrente identificado ainda.' };

  const acoes = decision.proximas_acoes;
  const cockpit: JourneySummaryItem =
    acoes.length > 0
      ? { key: 'cockpit', status: 'pendente', headline: `${acoes.length} tarefa(s) a fazer — próxima: ${acoes[0].acao}.` }
      : { key: 'cockpit', status: 'pendente', headline: 'Nenhuma ação registrada no plano.' };

  return [veredito, criterios, analise, juridico, concorrentes, cockpit];
}

const JOURNEY_SUMMARY_ICON_WRAP: Record<JourneySummaryStatus, string> = {
  ok: 'bg-emerald-50 text-emerald-600',
  atencao: 'bg-amber-50 text-amber-600',
  alerta: 'bg-red-50 text-red-600',
  pendente: 'bg-slate-100 text-slate-400',
};

function JourneySummary({
  result,
  onStepClick,
}: {
  result: AnalysisResult;
  onStepClick: (step: JourneyStepType) => void;
}) {
  const decision = normalizeDecision(result);
  const verdict = decisionUi[decision.veredito];
  const items = buildJourneySummary(result).filter((item) => item.key !== 'veredito');
  const verdictStep = JOURNEY_STEPS.find((s) => s.key === 'veredito')!;

  return (
    <div className="print:hidden">
      {/* Hero: a resposta que importa, antes de qualquer lista */}
      <button
        type="button"
        onClick={() => onStepClick(verdictStep)}
        className={`mb-4 flex w-full items-center justify-between gap-4 rounded-2xl border px-6 py-5 text-left transition-transform hover:-translate-y-0.5 ${verdict.summary}`}
      >
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-widest ${verdict.text}`}>Veredito executivo</p>
          <p className="mt-1.5 text-xl font-black leading-snug text-slate-950 md:text-2xl">{decision.rotulo}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className={`text-3xl font-black leading-none ${verdict.text}`}>{result.score}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">score / 100</p>
          </div>
          <ChevronRight size={18} className="text-slate-400" />
        </div>
      </button>

      {/* O resto da jornada, em ordem — cada linha leva direto ao detalhe */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {items.map((item, i) => {
          const step = JOURNEY_STEPS.find((s) => s.key === item.key);
          if (!step) return null;
          const Icon = step.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onStepClick(step)}
              className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 ${i > 0 ? 'border-t border-slate-100' : ''}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${JOURNEY_SUMMARY_ICON_WRAP[item.status]}`}>
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{step.num} · {step.label}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${JOURNEY_SUMMARY_TEXT[item.status]}`}>
                    {JOURNEY_SUMMARY_LABEL[item.status]}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm font-semibold leading-snug text-slate-800">{item.headline}</span>
              </span>
              <ChevronRight size={15} className="shrink-0 text-slate-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Escopo da análise: "log de trabalho" da IA ──────────────────────────────
// Todas as frentes que rodaram para chegar ao veredito, com o motivo de cada
// uma e link direto pra seção completa. Existe pra responder duas perguntas
// de quem só quer confirmar sem reabrir as 6 etapas: "o que vocês já
// verificaram" (o que eu não preciso me preocupar) e "em que a decisão se
// baseou" (de onde veio cada conclusão).

type ScopeStatus = 'ok' | 'atencao' | 'alerta' | 'pendente';

type ScopeRow = {
  key: string;
  Icon: typeof Gauge;
  label: string;
  status: ScopeStatus;
  headline: string;
  detail?: string[];
  stepKey?: JourneyStepType['key'];
};

const SCOPE_STATUS_CFG: Record<ScopeStatus, { dot: string; text: string; label: string }> = {
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Sem pendência' },
  atencao: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Atenção' },
  alerta: { dot: 'bg-red-500', text: 'text-red-700', label: 'Alerta' },
  pendente: { dot: 'bg-slate-300', text: 'text-slate-400', label: 'Não avaliado' },
};

const SEMAFORO_EIXO_LABEL: Record<string, string> = {
  tecnica: 'Técnica',
  financeira: 'Financeira',
  juridica: 'Jurídica',
  documentacao: 'Documentação',
};

function buildEscopoAnalise(result: AnalysisResult): ScopeRow[] {
  const rows: ScopeRow[] = [];

  // 1. Semáforo de viabilidade
  const eixos = result.semaforo ? Object.entries(result.semaforo) : [];
  const eixosRisco = eixos.filter(([, s]) => s.status === 'risco').length;
  const eixosAlerta = eixos.filter(([, s]) => s.status === 'alerta').length;
  rows.push({
    key: 'semaforo',
    Icon: Gauge,
    label: 'Semáforo de Viabilidade',
    status: !result.semaforo ? 'pendente' : eixosRisco > 0 ? 'alerta' : eixosAlerta > 0 ? 'atencao' : 'ok',
    headline: !result.semaforo
      ? 'Não avaliado nesta análise — reprocesse o edital para ativar.'
      : `4 eixos avaliados — Técnica, Financeira, Jurídica e Documentação${
          eixosRisco || eixosAlerta ? ` (${eixosRisco} em risco, ${eixosAlerta} em atenção)` : ', todos OK'
        }.`,
    detail: result.semaforo
      ? Object.entries(result.semaforo).map(([k, s]) => `${SEMAFORO_EIXO_LABEL[k] || k}: ${s.motivo}`)
      : undefined,
    stepKey: 'veredito',
  });

  // 2. Ficha técnica (extração de dados)
  const ficha = result.ficha_tecnica || [];
  const isFichaAusente = (item: NonNullable<AnalysisResult['ficha_tecnica']>[number]) =>
    !item.valor || item.fonte === 'ausente' || /n[ãa]o\s+localizad/i.test(item.valor);
  const fichaLocalizados = ficha.filter((f) => !isFichaAusente(f)).length;
  const coberturaPct = result.qualidade_extracao?.cobertura_pct;
  rows.push({
    key: 'ficha',
    Icon: FileSearch,
    label: 'Ficha Técnica do Edital',
    status:
      ficha.length === 0 ? 'pendente'
      : typeof coberturaPct === 'number'
        ? (coberturaPct >= 75 ? 'ok' : coberturaPct >= 45 ? 'atencao' : 'alerta')
        : 'ok',
    headline: ficha.length === 0
      ? 'Extração estruturada não disponível nesta análise.'
      : `${fichaLocalizados}/${ficha.length} campos localizados e cross-checados contra o texto original${
          typeof coberturaPct === 'number' ? ` (${coberturaPct}% de cobertura)` : ''
        }.`,
    detail: result.qualidade_extracao?.campos_faltantes?.length
      ? [`Não localizados: ${result.qualidade_extracao.campos_faltantes.join(', ')}`]
      : undefined,
    stepKey: 'criterios',
  });

  // 3. Composição do score
  const scoreItens = result.score_breakdown || [];
  rows.push({
    key: 'score',
    Icon: Calculator,
    label: 'Composição do Score',
    status: scoreItens.length === 0 ? 'pendente' : 'ok',
    headline: scoreItens.length === 0
      ? `Score de ${result.score}/100 calculado sem detalhamento de fatores nesta análise.`
      : `${scoreItens.length} fator(es) somaram ou subtraíram pontos a partir de 100, chegando a ${result.score}/100.`,
    stepKey: 'criterios',
  });

  // 4. Critérios personalizados
  const params = result.avaliacao_parametros || [];
  const bloqueios = params.filter((p) => p.status === 'bloqueio').length;
  const alertasParam = params.filter((p) => p.status === 'alerta').length;
  rows.push({
    key: 'criterios',
    Icon: SlidersHorizontal,
    label: 'Critérios Personalizados',
    status: params.length === 0 ? 'pendente' : bloqueios > 0 ? 'alerta' : alertasParam > 0 ? 'atencao' : 'ok',
    headline: params.length === 0
      ? 'Nenhum critério personalizado configurado (ative em Parametrização, no menu).'
      : `${params.length} critério(s) avaliado(s) — ${params.length - bloqueios - alertasParam} atende(m), ${alertasParam} em atenção, ${bloqueios} bloqueiam.`,
    stepKey: 'criterios',
  });

  // 5. SWOT / carga operacional
  const vantagens = result.vantagens || [];
  const desvantagens = result.desvantagens || [];
  const oportunidades = result.oportunidades || [];
  const hasSwot = vantagens.length > 0 || desvantagens.length > 0 || oportunidades.length > 0
    || (result.exigencias_criticas?.length || 0) > 0 || (result.documentos_necessarios?.length || 0) > 0;
  rows.push({
    key: 'swot',
    Icon: ClipboardList,
    label: 'Carga Operacional & SWOT',
    status: hasSwot ? 'ok' : 'pendente',
    headline: hasSwot
      ? `${vantagens.length} vantagem(ns), ${desvantagens.length} barreira(s) e ${oportunidades.length} oportunidade(s) mapeada(s).`
      : 'Não disponível nesta análise.',
    stepKey: 'analise',
  });

  // 6. Matriz de riscos
  const risks = result.risks;
  const riscosAltos = (risks || []).filter((r) => r.impacto === 'alto').length;
  rows.push({
    key: 'riscos',
    Icon: AlertTriangle,
    label: 'Matriz de Riscos',
    status: risks === undefined ? 'pendente' : risks.length === 0 ? 'ok' : riscosAltos > 0 ? 'alerta' : 'atencao',
    headline: risks === undefined
      ? 'Execute uma nova análise para ativar a matriz de riscos.'
      : risks.length === 0
        ? 'Nenhum risco relevante identificado.'
        : `${risks.length} risco(s) mapeado(s) (${riscosAltos} de impacto alto).`,
    stepKey: 'analise',
  });

  // 7. Red flags (varredura de irregularidades)
  const flags = result.red_flags;
  const flagsAltas = (flags || []).filter((f) => f.gravidade === 'alta').length;
  rows.push({
    key: 'redflags',
    Icon: Flag,
    label: 'Varredura de Irregularidades',
    status: flags === undefined ? 'pendente' : flags.length === 0 ? 'ok' : flagsAltas > 0 ? 'alerta' : 'atencao',
    headline: flags === undefined
      ? 'Não verificado nesta análise.'
      : flags.length === 0
        ? 'Varredura concluída — nenhum indício de direcionamento, restrição ou cláusula abusiva.'
        : `${flags.length} achado(s) (${flagsAltas} de gravidade alta) — direcionamento, restrição ou lacunas de informação.`,
    stepKey: 'analise',
  });

  // 8. Checklist de habilitação
  const habilitacao = result.habilitacao_checklist;
  const eliminatorias = (habilitacao || []).filter((h) => h.criticidade === 'eliminatoria').length;
  rows.push({
    key: 'habilitacao',
    Icon: ListChecks,
    label: 'Checklist de Habilitação',
    status: !habilitacao || habilitacao.length === 0 ? 'pendente' : eliminatorias > 0 ? 'atencao' : 'ok',
    headline: !habilitacao || habilitacao.length === 0
      ? 'Exigências de habilitação não identificadas de forma legível no material.'
      : `${habilitacao.length} exigência(s) mapeada(s) por categoria (${eliminatorias} eliminatória(s)).`,
    stepKey: 'analise',
  });

  // 9. Matriz de risco formal (condicional — só grande vulto/contratação integrada)
  if (result.matriz_risco_formal?.itens?.length) {
    rows.push({
      key: 'matrizformal',
      Icon: Scale3d,
      label: 'Matriz de Risco Formal',
      status: 'ok',
      headline: `${result.matriz_risco_formal.itens.length} risco(s) formalmente alocado(s) entre contratante e contratada (Lei 14.133, art. 6º, XXVII).`,
      stepKey: 'analise',
    });
  }

  // 10. Parecer técnico-jurídico
  rows.push({
    key: 'parecer',
    Icon: Scale,
    label: 'Parecer Técnico-Jurídico',
    status: result.parecer_especialista ? 'ok' : 'pendente',
    headline: result.parecer_especialista
      ? 'Parecer jurídico especializado gerado com base legal.'
      : 'Parecer jurídico não gerado nesta análise.',
    stepKey: 'juridico',
  });

  // 11. Aderência ao negócio (CNAE)
  const businessFit = normalizeBusinessFit(result);
  if (businessFit) {
    rows.push({
      key: 'aderencia',
      Icon: Settings2,
      label: 'Aderência ao Negócio (CNAE)',
      status:
        businessFit.status === 'match_forte' ? 'ok'
        : businessFit.status === 'match_parcial' ? 'atencao'
        : businessFit.status === 'sem_match' ? 'alerta'
        : 'pendente',
      headline: businessFit.label,
      stepKey: 'veredito',
    });
  }

  // 12. Contexto do órgão comprador (condicional)
  if (result.orgao_risk || result.programa_integridade_obrigatorio?.exigido) {
    const partes: string[] = [];
    if (result.orgao_risk) partes.push(`CAPAG ${result.orgao_risk.classificacao}`);
    if (result.programa_integridade_obrigatorio?.exigido) partes.push('Programa de integridade exigido');
    rows.push({
      key: 'orgao',
      Icon: Landmark,
      label: 'Contexto do Órgão Comprador',
      status: 'ok',
      headline: `${partes.join(' · ')}.`,
      stepKey: 'veredito',
    });
  }

  // 13. Radar de concorrentes
  const totalConcorrentes = (result.concorrentes_provaveis?.length || 0) + (result.concorrentes_regionais?.length || 0);
  const nivelAmeaca = result.pricing_intelligence?.nivelAmeaca;
  rows.push({
    key: 'concorrentes',
    Icon: Radar,
    label: 'Radar de Concorrentes',
    status: !nivelAmeaca && totalConcorrentes === 0
      ? 'pendente'
      : /alt/i.test(nivelAmeaca || '') ? 'alerta' : /m[ée]d/i.test(nivelAmeaca || '') ? 'atencao' : 'ok',
    headline: totalConcorrentes > 0
      ? `${totalConcorrentes} concorrente(s) mapeado(s)${nivelAmeaca ? ` — ameaça ${nivelAmeaca.toLowerCase()}` : ''}.`
      : 'Nenhum concorrente mapeado ainda (recurso Nível 2+).',
    stepKey: 'concorrentes',
  });

  return rows;
}

function EscopoAnaliseSection({
  result,
  onStepClick,
}: {
  result: AnalysisResult;
  onStepClick: (step: JourneyStepType) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const rows = useMemo(() => buildEscopoAnalise(result), [result]);
  const okCount = rows.filter((r) => r.status === 'ok').length;

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8">
      <SectionLabel icon={<ListOrdered size={18} className="text-slate-700" />} label="O Que Esta Análise Avaliou" />
      <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
        {rows.length} frentes verificadas pela IA para chegar ao veredito — {okCount} sem pendência. Clique numa linha
        para ver o motivo e ir direto à seção completa.
      </p>
      <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {rows.map((row) => {
          const cfg = SCOPE_STATUS_CFG[row.status];
          const isOpen = !!expanded[row.key];
          const step = row.stepKey ? JOURNEY_STEPS.find((s) => s.key === row.stepKey) : undefined;
          const hasExtra = Boolean(row.detail?.length || step);
          return (
            <div key={row.key}>
              <button
                type="button"
                onClick={() => hasExtra && setExpanded((prev) => ({ ...prev, [row.key]: !prev[row.key] }))}
                className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${hasExtra ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}
              >
                <row.Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{row.label}</span>
                    <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${cfg.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{row.headline}</p>
                </div>
                {hasExtra && (
                  <ChevronDown size={14} className={`mt-1 shrink-0 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {isOpen && hasExtra && (
                <div className="px-4 pb-4 pl-[2.1rem]">
                  {row.detail && row.detail.length > 0 && (
                    <ul className="space-y-1.5">
                      {row.detail.map((d, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-slate-500">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                  {step && (
                    <button
                      type="button"
                      onClick={() => onStepClick(step)}
                      className={`text-[11px] font-black text-slate-700 underline underline-offset-2 hover:text-slate-950 ${row.detail?.length ? 'mt-2.5' : ''}`}
                    >
                      Ver seção completa →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Barra persistente: score, veredito e aderência ao CNAE ──────────────────
// Único lugar "canônico" para esses 3 dados — antes o score aparecia em até 4
// formatos diferentes (hero do Panorama, card do Veredito, gauge do
// ScoreHeader, resumo do CollapsibleScoreBreakdown) e a aderência ao CNAE em
// pelo menos 2. Fica visível em qualquer etapa, sempre no mesmo lugar.
function PersistentSummaryBar({ result }: { result: AnalysisResult }) {
  const decision = normalizeDecision(result);
  const verdict = decisionUi[decision.veredito];
  const businessFit = normalizeBusinessFit(result);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 print:hidden">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${verdict.pill}`}>
          {decision.veredito.replace('_', ' ')}
        </span>
        <span className="hidden text-xs font-bold text-slate-600 sm:inline">{decision.rotulo}</span>
      </div>

      <div className="hidden h-4 w-px bg-slate-300 sm:block" />

      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-black leading-none ${verdict.text}`}>{result.score}</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Viabilidade</span>
      </div>

      {businessFit && (
        <>
          <div className="hidden h-4 w-px bg-slate-300 sm:block" />
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${businessFit.shell} ${businessFit.text}`}>
            Match CNAE {businessFit.score}/100
          </span>
        </>
      )}
    </div>
  );
}

function JourneyStepNav({
  activeStep,
  onStepClick,
  currentTier,
  userTier,
}: {
  activeStep: string;
  onStepClick: (step: JourneyStepType) => void;
  currentTier: number;
  userTier: number;
}) {
  const isLocked = (step: JourneyStepType) =>
    step.key === 'concorrentes' && Math.max(getCachedTier(userTier), currentTier) < 2;

  const activeIndex = Math.max(0, JOURNEY_STEPS.findIndex((s) => s.key === activeStep));
  const progressPct = JOURNEY_STEPS.length > 1 ? (activeIndex / (JOURNEY_STEPS.length - 1)) * 100 : 0;

  return (
    <div className="mb-8 print:hidden">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3 px-1">
        <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
          Jornada de análise
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
        <span className="text-[9px] font-medium text-slate-400">
          Passo {activeIndex + 1} de {JOURNEY_STEPS.length}
        </span>
      </div>

      {/* Trilha: nós conectados por uma linha — só a etapa ativa ganha cor,
          as demais ficam neutras para não competir com o veredito abaixo. */}
      <div className="overflow-x-auto pb-1">
        <div className="relative min-w-[720px] px-4">
          <div className="pointer-events-none absolute left-9 right-9 top-6 h-0.5 bg-slate-200" />
          <div
            className="pointer-events-none absolute left-9 top-6 h-0.5 bg-slate-900 transition-all duration-500"
            style={{ width: `calc((100% - 2.25rem) * ${progressPct / 100})` }}
          />

          <div className="relative grid grid-cols-7 gap-1">
            {JOURNEY_STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = activeStep === step.key;
              const locked = isLocked(step);

              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => onStepClick(step)}
                  className="group relative flex flex-col items-center gap-2 rounded-xl px-1 py-1 text-center transition-transform hover:-translate-y-0.5"
                >
                  {/* Nó */}
                  <div
                    className={`relative z-10 flex items-center justify-center rounded-full transition-all ${
                      isActive
                        ? 'h-12 w-12 bg-slate-900 shadow-lg shadow-slate-900/20 ring-4 ring-white'
                        : 'h-10 w-10 border border-slate-200 bg-white text-slate-400 group-hover:border-slate-300 group-hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={isActive ? 20 : 16} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                    {locked && (
                      <span className="absolute -right-1.5 -top-1.5 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[7px] font-black text-white shadow-sm">
                        <Crown size={7} />
                      </span>
                    )}
                  </div>

                  {/* Texto */}
                  <div className="flex flex-col gap-0.5">
                    <span className={`whitespace-nowrap text-[11px] leading-tight ${
                      isActive ? 'font-black text-slate-900' : 'font-bold text-slate-500 group-hover:text-slate-700'
                    }`}>
                      {step.num} · {step.label}
                    </span>
                    <span className={`whitespace-nowrap text-[9px] font-medium leading-tight transition-opacity ${
                      isActive ? 'text-slate-400 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'
                    }`}>
                      {step.sublabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Esteira CTA: convite proeminente para gestão ─────────────────────────────

function EsteiraCTA({
  result,
  tracked,
  trackSaving,
  onToggle,
  analysisId,
  token,
  onGoToGestao,
  gestaoDisponivel,
}: {
  result: AnalysisResult;
  tracked: boolean;
  trackSaving: boolean;
  onToggle: () => void;
  analysisId: string | null;
  token: string | null;
  onGoToGestao: () => void;
  gestaoDisponivel: boolean;
}) {
  const decision = normalizeDecision(result);
  const isNoGo = decision.veredito === 'NO_GO';

  const goStages: { key: string; label: string; done?: boolean; active?: boolean }[] = [
    { key: 'analise', label: 'Análise', done: true },
    { key: 'habilitacao', label: 'Habilitação', active: true },
    { key: 'proposta', label: 'Proposta' },
    { key: 'disputa', label: 'Disputa' },
    { key: 'resultado', label: 'Resultado' },
  ];

  const noGoStages: { key: string; label: string; done?: boolean; active?: boolean }[] = [
    { key: 'analise', label: 'Análise', done: true },
    { key: 'monitoramento', label: 'Monitoramento', active: true },
    { key: 'reanalise', label: 'Re-análise' },
  ];

  const stages = isNoGo ? noGoStages : goStages;
  const nextStage = isNoGo ? 'Monitoramento' : 'Habilitação';

  return (
    <div className={`mb-6 overflow-hidden rounded-[1.5rem] border-2 print:hidden transition-all ${
      tracked
        ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/60 to-white shadow-sm shadow-emerald-100'
        : 'border-dashed border-slate-300 bg-slate-50/60'
    }`}>
      <div className="px-6 py-6 md:px-8 md:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

          {/* Left: title + pipeline */}
          <div className="min-w-0 flex-1">
            <p className={`mb-1.5 text-[10px] font-black uppercase tracking-widest ${tracked ? 'text-emerald-600' : 'text-slate-500'}`}>
              {tracked ? 'Na esteira de gestão' : 'Próxima fase disponível'}
            </p>
            <h3 className="mb-4 text-lg font-black tracking-tight text-slate-900">
              {tracked
                ? `Este edital está sendo acompanhado · entrando em ${nextStage}`
                : 'Levar este edital para a esteira de gestão?'}
            </h3>

            {/* Pipeline visual */}
            <div className="flex flex-wrap items-center gap-1.5">
              {stages.map((stage, i) => (
                <React.Fragment key={stage.key}>
                  {i > 0 && (
                    <ChevronRight size={11} className="flex-shrink-0 text-slate-300" />
                  )}
                  <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black transition-all ${
                    stage.done
                      ? 'bg-emerald-100 text-emerald-700'
                      : stage.active
                        ? tracked
                          ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/30'
                          : 'bg-slate-200 text-slate-700 ring-2 ring-slate-300'
                        : 'bg-slate-100 text-slate-400'
                  }`}>
                    {stage.done && <Check size={9} className="flex-shrink-0" />}
                    {stage.label}
                  </div>
                </React.Fragment>
              ))}
            </div>

            <p className="mt-3 text-[11px] font-semibold text-slate-400">
              Isso é acompanhado no{' '}
              <button type="button" onClick={onGoToGestao} className="font-black text-slate-700 underline underline-offset-2 hover:text-slate-900">
                painel Gestão, no menu lateral
              </button>
              {gestaoDisponivel ? '.' : ' (recurso Nível 4).'}
            </p>
          </div>

          {/* Right: CTA button */}
          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            {tracked ? (
              <>
                <button
                  type="button"
                  onClick={onGoToGestao}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-white transition-all hover:bg-emerald-700"
                >
                  <Pin size={15} className="flex-shrink-0" />
                  <span className="text-sm font-black">
                    {gestaoDisponivel ? 'Acompanhando · ver painel →' : 'Acompanhando · desbloquear painel →'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onToggle}
                  disabled={!analysisId || !token || trackSaving}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors disabled:opacity-50"
                >
                  Remover do acompanhamento
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onToggle}
                  disabled={!analysisId || !token || trackSaving}
                  className="flex items-center gap-2.5 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {trackSaving ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <Pin size={15} className="flex-shrink-0" />
                  )}
                  Acompanhar este edital →
                </button>
                {!token && (
                  <p className="text-[10px] font-medium text-slate-400">Faça login para acompanhar</p>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
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
      <div id="section-score" className="scroll-mt-24">
        <ScoreHeader result={result} />
      </div>

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

      {/* SIMULADOR TÁTICO — oculto em No-Go: simular lance para um edital
          que a própria análise mandou evitar é ruído de decisão */}
      {result.pricing_intelligence && !isNoGoVerdict(result) && (
        <div className="space-y-4 print:hidden mb-12">
          <TacticalSimulator
            pricing={result.pricing_intelligence}
            fullResult={result}
            userTier={userTier}
          />
        </div>
      )}
      {result.pricing_intelligence && isNoGoVerdict(result) && (
        <div className="mb-12 flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 print:hidden">
          <span className="text-lg leading-none">🎯</span>
          <p className="text-sm font-medium leading-relaxed text-slate-500">
            <strong className="text-slate-700">Simulador tático desativado:</strong> o veredito é No-Go — não há
            proposta a precificar. Se o órgão corrigir o edital (documentos, prazos), reprocesse a análise para reativá-lo.
          </p>
        </div>
      )}

      {/* CRITÉRIOS CONFIGURADOS — logo após o veredito para decisão imediata */}
      <div id="section-criterios" className="scroll-mt-24">
        <ParametrosSection result={result} />
      </div>

      {/* SWOT & CARGA OPERACIONAL + MATRIZ DE RISCOS */}
      <div id="section-analise" className="scroll-mt-24 space-y-8">
        <SwotSection result={result} />
        <RisksSection result={result} />
      </div>

      {/* PARECER TÉCNICO-JURÍDICO */}
      <div id="section-juridico" className="scroll-mt-24">
        <PareceSection result={result} userTier={userTier} onUpgradeClick={onUpgradeClick} />
      </div>

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

      {/* ROADMAP / CHECKLIST — removido: os mesmos itens vivem no Cockpit
          pós-veredito (com responsável, prazo, nota e impacto), que é a fonte
          operacional única. Duplicar a lista aqui só inflava o relatório. */}

      {/* EXPORTAR PDF */}
      <PremiumLock
        isLocked={currentTier < 4}
        featureTitle="Laudo de Decisão Bawzi (PDF)"
        requiredTierName="Nível 4 (Avançado)"
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

// ─── Divisor de capítulo: agrupa sub-seções dentro de uma etapa que misturam
// tipos de conteúdo diferentes (dado bruto, critério, resultado), deixando
// explícito o que é cada bloco em vez de empilhar tudo com o mesmo peso visual.
function ChapterDivider({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {index} · {title}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

// ─── Timeline: lista vertical conectada por linha, para dar ordem de leitura
// clara a qualquer sequência de itens (critérios, riscos, evidências, ações
// etc.). Reutilizada em todas as etapas da jornada de análise. ──────────────

type TimelineTone = 'red' | 'amber' | 'emerald' | 'slate' | 'blue' | 'violet';

const TIMELINE_DOT_TONE: Record<TimelineTone, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  slate: 'bg-slate-400',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
};

const TIMELINE_BADGE_TONE: Record<TimelineTone, string> = {
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  slate: 'bg-slate-100 text-slate-500',
  blue: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
};

type TimelineItemData = {
  key?: string | number;
  tone?: TimelineTone;
  icon?: React.ReactNode;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: { label: string; tone: TimelineTone };
  meta?: React.ReactNode;
  hollow?: boolean;
};

function Timeline({ items, dense }: { items: TimelineItemData[]; dense?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="relative pl-0.5">
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-slate-200" aria-hidden="true" />
      <div className={dense ? 'space-y-3.5' : 'space-y-5'}>
        {items.map((item, i) => {
          const tone = item.tone || 'slate';
          return (
            <div key={item.key ?? i} className="relative flex gap-3">
              <span
                className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  item.hollow ? 'border-2 border-slate-300 bg-white' : `${TIMELINE_DOT_TONE[tone]} text-white`
                }`}
              >
                {!item.hollow && item.icon}
              </span>
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  {item.eyebrow && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.eyebrow}</span>
                  )}
                  {item.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${TIMELINE_BADGE_TONE[item.badge.tone]}`}>
                      {item.badge.label}
                    </span>
                  )}
                  {item.meta && <span className="ml-auto shrink-0 text-xs font-black text-slate-700">{item.meta}</span>}
                </div>
                <p className="text-sm font-semibold leading-relaxed text-slate-800">{item.title}</p>
                {item.description && (
                  // <div>, não <p>: várias chamadas passam um <blockquote> (elemento de
                  // bloco) dentro de `description` — dentro de <p> isso é HTML inválido
                  // e quebra a hidratação do Next.js.
                  <div className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{item.description}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── StepHeadline: a manchete de uma etapa vem primeiro, o detalhe completo
// (as timelines de sempre) fica atrás de um "ver detalhe completo" — assim
// cada etapa não despeja tudo de uma vez em quem só quer o essencial. ───────

const HEADLINE_SHELL_TONE: Record<TimelineTone, string> = {
  red: 'border-red-200 bg-red-50',
  amber: 'border-amber-200 bg-amber-50',
  emerald: 'border-emerald-200 bg-emerald-50',
  slate: 'border-slate-200 bg-slate-50',
  blue: 'border-sky-200 bg-sky-50',
  violet: 'border-violet-200 bg-violet-50',
};

function StepHeadline({
  tone,
  eyebrow,
  headline,
  sub,
  children,
}: {
  tone: TimelineTone;
  eyebrow: string;
  headline: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className={`rounded-2xl border px-5 py-5 ${HEADLINE_SHELL_TONE[tone]}`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{eyebrow}</p>
        <p className="mt-1.5 text-base font-black leading-snug text-slate-900">{headline}</p>
        {sub && <p className="mt-1.5 text-sm font-semibold text-slate-600">{sub}</p>}
      </div>
      {/* Entrar nesta etapa já É pedir o detalhe — antes o conteúdo ficava
          atrás de um <details> fechado por padrão ("Ver detalhe completo"),
          escondendo riscos/parecer que o usuário veio justamente ver. */}
      {children && (
        <div className="mt-3 space-y-8 rounded-2xl border border-slate-200 px-5 py-6">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Helper: detecta se o edital já expirou ───────────────────────────────────

// Só 'encerramento' e 'recebimento' indicam prazo de submissão.
// 'abertura' = sessão de análise (ocorre APÓS o prazo) — não é indicador de expiração.
const LABELS_CHAVE_EXPIRACAO = ['encerramento', 'recebimento', 'prazo', 'limite'];

// 'prazo' e 'limite' são genéricos demais — batem também em datas que
// acontecem ANTES da abertura (ex.: "Prazo de Impugnação", que por lei ocorre
// dias antes do encerramento) ou DEPOIS dela (ex.: "Prazo de recurso"). Sem
// esta exclusão, o banner "Edital Encerrado" disparava assim que a janela de
// impugnação passava — bem antes do edital realmente fechar para propostas —
// fazendo editais totalmente abertos aparecerem como vencidos.
const LABELS_EXCLUIDOS_EXPIRACAO = ['impugna', 'esclarec', 'recurso', 'entrega', 'vigenc', 'pagamento'];

function getDataExpirada(result: AnalysisResult) {
  if (!result.datas_criticas?.length) return null;
  const agora = new Date();
  return result.datas_criticas.find(dc => {
    if (!dc.data_iso) return false;
    const labelLower = dc.label.toLowerCase();
    const isChave = LABELS_CHAVE_EXPIRACAO.some(k => labelLower.includes(k));
    const isExcluido = LABELS_EXCLUIDOS_EXPIRACAO.some(k => labelLower.includes(k));
    return isChave && !isExcluido && new Date(dc.data_iso) < agora;
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

// ─── Impeditivo: exclusividade ME/EPP × porte da empresa (LC 123/2006) ───────

function MeEppImpeditivoBanner({ result }: { result: AnalysisResult }) {
  const elegibilidade = result.elegibilidade_me_epp;
  if (!elegibilidade) return null;

  // Impeditivo real (exclusividade × porte incompatível) — crítico.
  if (!elegibilidade.elegivel) {
    return (
      <div className="flex items-start gap-4 bg-rose-50 border border-rose-300 rounded-2xl px-5 py-4">
        <div className="shrink-0 w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center">
          <ShieldAlert size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Possível impeditivo · ME/EPP</span>
          <p className="text-sm font-medium text-rose-900 leading-snug mt-0.5">{elegibilidade.mensagem}</p>
        </div>
      </div>
    );
  }

  // Cota reservada — nunca impede, mas muda a estratégia de disputa; nota informativa, não um alerta crítico.
  if (elegibilidade.cota_reservada) {
    return (
      <div className="flex items-start gap-4 bg-sky-50 border border-sky-200 rounded-2xl px-5 py-4">
        <div className="shrink-0 w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center">
          <ShieldAlert size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Cota reservada · ME/EPP</span>
          <p className="text-sm font-medium text-sky-900 leading-snug mt-0.5">{elegibilidade.mensagem}</p>
        </div>
      </div>
    );
  }

  return null;
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

      {/* Datas críticas — só no formato legado (sem datas_criticas estruturadas);
          no formato novo, o Cronograma Crítico logo abaixo é a fonte única */}
      {!result.datas_criticas && <DatasBlock result={result} isExpired={isExpired} />}
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

// ─── Contexto do órgão comprador (CAPAG + programa de integridade) ────────────

const CAPAG_TOM: Record<string, { bg: string; border: string; txt: string }> = {
  'A+': { bg: 'bg-emerald-50', border: 'border-emerald-200', txt: 'text-emerald-700' },
  A:    { bg: 'bg-emerald-50', border: 'border-emerald-200', txt: 'text-emerald-700' },
  'B+': { bg: 'bg-sky-50',     border: 'border-sky-200',     txt: 'text-sky-700' },
  B:    { bg: 'bg-amber-50',   border: 'border-amber-200',   txt: 'text-amber-700' },
  C:    { bg: 'bg-orange-50',  border: 'border-orange-200',  txt: 'text-orange-700' },
  D:    { bg: 'bg-red-50',     border: 'border-red-200',     txt: 'text-red-700' },
};

function OrgaoContextoSection({ result }: { result: AnalysisResult }) {
  const capag = result.orgao_risk;
  const integridade = result.programa_integridade_obrigatorio;
  if (!capag && !integridade?.exigido) return null;

  const tom = capag ? (CAPAG_TOM[capag.classificacao] ?? CAPAG_TOM.B) : null;

  return (
    <div className="grid gap-4 mb-8 sm:grid-cols-2">
      {capag && tom && (
        <div className={`rounded-2xl border ${tom.border} ${tom.bg} p-5`}>
          <div className="flex items-center gap-2">
            <Landmark size={16} className={tom.txt} />
            <p className={`text-[10px] font-black uppercase tracking-widest ${tom.txt}`}>
              CAPAG do órgão {capag.escopo === 'municipio' ? '(município)' : '(estado)'}
            </p>
          </div>
          <p className={`mt-2 text-2xl font-black ${tom.txt}`}>{capag.classificacao}</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{capag.descricao}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{capag.fonte}</p>
        </div>
      )}
      {integridade?.exigido && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-sky-700" />
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Programa de integridade</p>
          </div>
          <p className="mt-2 text-sm font-black text-sky-800">Exigido pela Lei 14.133/2021</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{integridade.mensagem}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-sky-600">Prazo: {integridade.prazo}</p>
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
      {result.prazo_impugnacao_calculado && result.prazo_impugnacao_calculado.origem !== 'confirmado' && (
        <div className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
          result.prazo_impugnacao_calculado.origem === 'divergente'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <Scale size={14} className={`mt-0.5 shrink-0 ${result.prazo_impugnacao_calculado.origem === 'divergente' ? 'text-amber-600' : 'text-slate-500'}`} />
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${result.prazo_impugnacao_calculado.origem === 'divergente' ? 'text-amber-700' : 'text-slate-500'}`}>
              Prazo de impugnação calculado (art. 164, I)
            </p>
            <p className={`text-xs font-medium leading-relaxed mt-0.5 ${result.prazo_impugnacao_calculado.origem === 'divergente' ? 'text-amber-900/90' : 'text-slate-600'}`}>
              {result.prazo_impugnacao_calculado.mensagem}
            </p>
          </div>
        </div>
      )}
      {result.validade_proposta_calculada && (
        <div className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
          result.validade_proposta_calculada.origem === 'nao_informado'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <Scale size={14} className={`mt-0.5 shrink-0 ${result.validade_proposta_calculada.origem === 'nao_informado' ? 'text-amber-600' : 'text-slate-500'}`} />
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${result.validade_proposta_calculada.origem === 'nao_informado' ? 'text-amber-700' : 'text-slate-500'}`}>
              Validade da proposta (art. 90, §3º)
            </p>
            <p className={`text-xs font-medium leading-relaxed mt-0.5 ${result.validade_proposta_calculada.origem === 'nao_informado' ? 'text-amber-900/90' : 'text-slate-600'}`}>
              {result.validade_proposta_calculada.mensagem}
            </p>
          </div>
        </div>
      )}
      {result.prazo_recurso_pos_julgamento && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 bg-slate-50 border-slate-200">
          <Scale size={14} className="mt-0.5 shrink-0 text-slate-500" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Prazo de recurso pós-julgamento (art. 165, §1º, I)
            </p>
            <p className="text-xs font-medium leading-relaxed mt-0.5 text-slate-600">
              {result.prazo_recurso_pos_julgamento.mensagem}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Composição do Score (QA Engine — score auditável) ──────────────────────

function ScoreBreakdownSection({ result }: { result: AnalysisResult }) {
  const itens = result.score_breakdown || [];
  if (itens.length === 0) return null;
  return (
    <div className="relative border border-slate-200 rounded-2xl p-8">
      <SectionLabel icon={<Calculator size={18} className="text-slate-700" />} label="Composição do Score" />
      <p className="text-xs text-slate-500 font-medium mt-1 mb-4">
        Nota auditável: partimos de <strong>100</strong> e cada fator soma ou subtrai pontos com justificativa e evidência.
      </p>
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 mb-2">
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Base de partida</span>
        <div className="flex-1 border-t border-dashed border-slate-200" />
        <span className="text-sm font-black text-slate-900">100</span>
      </div>
      <Timeline
        dense
        items={itens.map((item, i) => {
          const positivo = item.pontos > 0;
          const tone: TimelineTone = positivo ? 'emerald' : 'red';
          return {
            key: i,
            tone,
            meta: <span className="tabular-nums">{positivo ? '+' : ''}{item.pontos}</span>,
            title: item.fator,
            description: (item.justificativa || item.trecho) && (
              <>
                {item.justificativa && <span className="block">{item.justificativa}</span>}
                {item.trecho && (
                  <blockquote className="mt-1.5 rounded-lg border-l-2 border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] italic text-slate-500">
                    &ldquo;{item.trecho}&rdquo;
                  </blockquote>
                )}
              </>
            ),
          };
        })}
      />
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5">
        <span className="text-xs font-black uppercase tracking-widest text-slate-300">Bawzi Score final</span>
        <div className="flex-1 border-t border-dashed border-slate-700" />
        <span className={`text-2xl font-black leading-none tabular-nums ${result.score >= 70 ? 'text-emerald-400' : result.score >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
          {result.score}
        </span>
      </div>
    </div>
  );
}

// ─── Ficha Técnica do Edital (QA Engine — extração verificada) ───────────────

function FichaTecnicaSection({ result }: { result: AnalysisResult }) {
  const ficha = result.ficha_tecnica || [];
  if (ficha.length === 0) return null;
  const isAusente = (item: NonNullable<AnalysisResult['ficha_tecnica']>[number]) =>
    !item.valor || item.fonte === 'ausente' || /n[ãa]o\s+localizad/i.test(item.valor);
  const localizados = ficha.filter(f => !isAusente(f)).length;
  const divergencias = result.qualidade_extracao?.divergencias_ia_texto || [];

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-4">
        <SectionLabel icon={<FileSearch size={18} className="text-slate-700" />} label="Ficha Técnica do Edital" />
        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full">
          {localizados}/{ficha.length} localizados
        </span>
      </div>
      <p className="text-xs text-slate-500 font-medium mt-1 mb-4">
        Dados extraídos literalmente do material e cross-checados automaticamente contra o texto original.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ficha.map((item, i) => {
          const ausente = isAusente(item);
          return (
            <div
              key={`${item.campo}-${i}`}
              title={item.trecho ? `Trecho do edital: "${item.trecho}"` : undefined}
              className={`rounded-xl border p-3.5 transition-colors ${
                ausente ? 'border-dashed border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight">{item.campo}</p>
                {!ausente && item.fonte === 'verificado_texto' && (
                  <span className="flex items-center gap-0.5 shrink-0 text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                    <Check size={8} strokeWidth={3.5} /> Texto
                  </span>
                )}
              </div>
              <p className={`mt-1 text-sm leading-snug ${ausente ? 'text-slate-400 italic font-medium' : 'text-slate-900 font-bold'}`}>
                {ausente ? 'Não localizado' : item.valor}
              </p>
            </div>
          );
        })}
      </div>
      {divergencias.length > 0 && (
        <div className="mt-4 rounded-xl bg-sky-50/70 border border-sky-100 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-600 mb-2 flex items-center gap-1.5">
            <RefreshCw size={11} /> Reconciliação automática IA × texto do edital
          </p>
          <div className="space-y-1.5">
            {divergencias.slice(0, 3).map((d, i) => (
              <p key={i} className="text-xs font-medium leading-relaxed text-sky-900/80">• {d}</p>
            ))}
          </div>
        </div>
      )}
      {(result.garantias_alerta?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={11} /> Garantia acima do teto legal
          </p>
          <div className="space-y-2">
            {result.garantias_alerta!.map((g, i) => (
              <p key={i} className="text-xs font-medium leading-relaxed text-amber-900/90">
                <strong className="font-black">{g.campo}:</strong> {g.mensagem}
              </p>
            ))}
          </div>
        </div>
      )}
      {result.valor_total_com_prorrogacao && (
        <div className="mt-4 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-700 mb-1.5 flex items-center gap-1.5">
            <TrendingUp size={11} /> Valor total estimado com prorrogação
          </p>
          <p className="text-sm font-black text-sky-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(result.valor_total_com_prorrogacao.valor_total_estimado)}
            <span className="ml-1.5 text-[10px] font-bold text-sky-600 uppercase tracking-wide">
              ({result.valor_total_com_prorrogacao.multiplicador.toFixed(1)}x o valor inicial)
            </span>
          </p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-sky-900/80">{result.valor_total_com_prorrogacao.mensagem}</p>
        </div>
      )}
      {result.alerta_prazo_entrega && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1.5 flex items-center gap-1.5">
            <AlertTriangle size={11} /> Prazo de entrega/execução apertado
          </p>
          <p className="text-xs font-medium leading-relaxed text-amber-900/90">{result.alerta_prazo_entrega.mensagem}</p>
        </div>
      )}
      {result.alerta_indice_reajuste && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1.5 flex items-center gap-1.5">
            <AlertTriangle size={11} /> Índice de reajuste não especificado
          </p>
          <p className="text-xs font-medium leading-relaxed text-amber-900/90">{result.alerta_indice_reajuste.mensagem}</p>
        </div>
      )}
    </div>
  );
}

// ─── Wrappers colapsáveis — score e ficha técnica são prova/auditoria, não a
// manchete do veredito. Ficam recolhidos por padrão para não competir com a
// decisão e com o "por quê" no topo da aba. ─────────────────────────────────

function CollapsibleScoreBreakdown({ result }: { result: AnalysisResult }) {
  const itens = result.score_breakdown || [];
  if (itens.length === 0) return null;
  return (
    // Aberto por padrão: esta etapa (Critérios) é o lugar de prova/auditoria —
    // entrar aqui já deve mostrar o conteúdo, sem clique extra.
    <details open className="group rounded-2xl border border-slate-200 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-slate-50">
        <span className="flex items-center gap-2 text-sm font-black text-slate-700">
          <Calculator size={16} className="text-slate-400" />
          Como chegamos ao score {result.score}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-200 bg-slate-50/50 p-4">
        <ScoreBreakdownSection result={result} />
      </div>
    </details>
  );
}

function CollapsibleFichaTecnica({ result }: { result: AnalysisResult }) {
  const ficha = result.ficha_tecnica || [];
  if (ficha.length === 0) return null;
  const isAusente = (item: NonNullable<AnalysisResult['ficha_tecnica']>[number]) =>
    !item.valor || item.fonte === 'ausente' || /n[ãa]o\s+localizad/i.test(item.valor);
  const localizados = ficha.filter((f) => !isAusente(f)).length;
  return (
    // Aberto por padrão — mesmo raciocínio do bloco de score acima.
    <details open className="group rounded-2xl border border-slate-200 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-slate-50">
        <span className="flex items-center gap-2 text-sm font-black text-slate-700">
          <FileSearch size={16} className="text-slate-400" />
          Ficha técnica do edital
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {localizados}/{ficha.length} localizados
          </span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-200 bg-slate-50/50 p-4">
        <FichaTecnicaSection result={result} />
      </div>
    </details>
  );
}

// ─── Red Flags — direcionamento & abusividade (QA Engine) ────────────────────

// Um "red flag" nem sempre é uma cláusula abusiva — o motor também usa essa
// lista para sinalizar lacunas (documento ausente, orçamento sigiloso etc.).
// Sem isso, o subtítulo fixo da seção prometia "cláusula abusiva" para achados
// que na verdade eram apenas "faltou publicar o documento" — confuso.
type RedFlagKind = 'abusividade' | 'lacuna' | 'outro';

function classifyRedFlag(flag: NonNullable<AnalysisResult['red_flags']>[number]): { kind: RedFlagKind; label: string } {
  const texto = normalizeDecisionText(`${flag.tipo || ''} ${flag.tipo_label || ''} ${flag.descricao || ''}`);

  const abusividadeMap: { test: RegExp; label: string }[] = [
    { test: /direcionament/, label: 'Direcionamento' },
    { test: /restri[cç][aã]o|restring/, label: 'Restrição de competitividade' },
    { test: /clausula(s)? abusiva/, label: 'Cláusula abusiva' },
    { test: /exigencia(s)? desproporcional/, label: 'Exigência desproporcional' },
    { test: /marca especifica|marca exclusiva/, label: 'Marca específica' },
    { test: /prazo exiguo|prazo curto demais/, label: 'Prazo exíguo' },
  ];
  for (const { test, label } of abusividadeMap) {
    if (test.test(texto)) return { kind: 'abusividade', label };
  }

  if (/sigilos/.test(texto)) return { kind: 'lacuna', label: 'Informação sigilosa' };
  if (/nenhum (arquivo|documento)|documento(s)? oficial(is)?.*(ausente|nao public|não public)|arquivo publicado|sem anexo/.test(texto)) {
    return { kind: 'lacuna', label: 'Documentação ausente' };
  }
  if (/valor (global )?estimado|orcamento sigiloso|a apurar/.test(texto)) {
    return { kind: 'lacuna', label: 'Dado financeiro ausente' };
  }

  return { kind: 'outro', label: flag.tipo_label || (flag.tipo && flag.tipo !== 'outro' ? flag.tipo : 'Outro achado') };
}

const RED_FLAG_SUBTITLES: Record<'abusividade' | 'lacuna' | 'misto' | 'outro', string> = {
  abusividade: 'Indícios de direcionamento, restrição de competitividade e cláusulas abusivas — cada um com evidência literal e ação sugerida.',
  lacuna: 'Informações que faltam no material publicado e impedem uma análise completa — cada uma com evidência literal e ação sugerida.',
  misto: 'Possíveis irregularidades e lacunas de informação identificadas no edital — cada uma com evidência literal e ação sugerida.',
  outro: 'Pontos de atenção identificados no material analisado — cada um com evidência literal e ação sugerida.',
};

function RedFlagsSection({ result }: { result: AnalysisResult }) {
  const flags = result.red_flags;
  if (flags === undefined) return null;

  if (flags.length === 0) {
    return (
      <div className="relative border border-slate-200 rounded-2xl p-8">
        <SectionLabel icon={<Flag size={18} className="text-slate-700" />} label="Red Flags do Edital" />
        <div className="mt-2 flex items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-xl p-5">
          <CheckCircle2 size={28} className="shrink-0 text-emerald-500" />
          <div>
            <p className="text-sm font-black text-emerald-800">Varredura concluída sem indícios</p>
            <p className="text-xs text-emerald-700 font-medium mt-0.5 leading-relaxed">
              Nenhum indício concreto de direcionamento, restrição de competitividade ou cláusula abusiva foi detectado no material analisado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const gravidadeCfg: Record<string, { bg: string; border: string; badge: string; label: string }> = {
    alta:  { bg: 'bg-red-50',   border: 'border-red-200',   badge: 'bg-red-600 text-white',       label: 'GRAVIDADE ALTA' },
    media: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-500 text-white',     label: 'GRAVIDADE MÉDIA' },
    baixa: { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-400 text-white',     label: 'GRAVIDADE BAIXA' },
  };
  const acaoCfg: Record<string, { cls: string; label: string }> = {
    impugnar:   { cls: 'bg-red-100 text-red-700 border-red-200',       label: 'Impugnar' },
    esclarecer: { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pedir esclarecimento' },
    monitorar:  { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Monitorar' },
  };

  const classified = flags.map((flag) => ({ flag, ...classifyRedFlag(flag) }));
  const hasAbuso = classified.some((c) => c.kind === 'abusividade');
  const hasLacuna = classified.some((c) => c.kind === 'lacuna');
  const subtitleKey = hasAbuso && hasLacuna ? 'misto' : hasAbuso ? 'abusividade' : hasLacuna ? 'lacuna' : 'outro';

  const sortedFlags = [...classified].sort((a, b) => {
    const order: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
    return (order[a.flag.gravidade] ?? 1) - (order[b.flag.gravidade] ?? 1);
  });

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8">
      <SectionLabel icon={<Flag size={18} className="text-slate-700" />} label="Red Flags do Edital" />
      <p className="text-xs text-slate-500 font-medium mt-1 mb-4">
        {RED_FLAG_SUBTITLES[subtitleKey]}
      </p>
      <Timeline
        items={sortedFlags.map(({ flag, label }, i) => {
          const acao = acaoCfg[flag.acao_sugerida || 'esclarecer'] ?? acaoCfg.esclarecer;
          const tone: TimelineTone = flag.gravidade === 'alta' ? 'red' : flag.gravidade === 'baixa' ? 'slate' : 'amber';
          return {
            key: i,
            tone,
            eyebrow: label,
            badge: { label: acao.label, tone },
            title: flag.descricao,
            description: (
              <>
                {flag.trecho && (
                  <blockquote className="mt-1 rounded-lg border-l-4 border-slate-300 bg-slate-50 px-3 py-2 text-[11px] italic text-slate-600">
                    &ldquo;{flag.trecho}&rdquo;
                  </blockquote>
                )}
                {flag.base_legal && (
                  <span className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <Scale size={11} /> Base legal: {flag.base_legal}
                  </span>
                )}
                {flag.sumula_tcu && (
                  <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-sky-50 border border-sky-100 px-2.5 py-1.5">
                    <Landmark size={11} className="mt-0.5 shrink-0 text-sky-600" />
                    <p className="text-[11px] font-medium leading-relaxed text-sky-700">
                      <strong className="font-black">{flag.sumula_tcu.referencia}:</strong> {flag.sumula_tcu.texto}
                    </p>
                  </div>
                )}
              </>
            ),
          };
        })}
      />
    </div>
  );
}

// ─── Checklist de Habilitação (QA Engine) ────────────────────────────────────

const HABILITACAO_ORDEM = ['juridica', 'fiscal', 'tecnica', 'economico_financeira'] as const;
const HABILITACAO_LABELS: Record<string, string> = {
  juridica: 'Habilitação Jurídica',
  fiscal: 'Regularidade Fiscal e Trabalhista',
  tecnica: 'Qualificação Técnica',
  economico_financeira: 'Qualificação Econômico-Financeira',
};

function HabilitacaoSection({ result }: { result: AnalysisResult }) {
  const itens = result.habilitacao_checklist;
  if (itens === undefined) return null;

  if (itens.length === 0) {
    return (
      <div className="relative border border-slate-200 rounded-2xl p-8">
        <SectionLabel icon={<ListChecks size={18} className="text-slate-700" />} label="Checklist de Habilitação" />
        <div className="mt-2 flex items-center gap-4 bg-amber-50 border border-dashed border-amber-200 rounded-xl p-5">
          <SearchX size={28} className="shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-black text-amber-800">Exigências não identificadas</p>
            <p className="text-xs text-amber-700 font-medium mt-0.5 leading-relaxed">
              O material analisado não trouxe as exigências de habilitação de forma legível. Confirme os anexos do edital antes de montar a proposta.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const grupos = HABILITACAO_ORDEM
    .map(cat => ({ cat, label: HABILITACAO_LABELS[cat], lista: itens.filter(i => i.categoria === cat) }))
    .filter(g => g.lista.length > 0);
  const eliminatorias = itens.filter(i => i.criticidade === 'eliminatoria').length;

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-4">
        <SectionLabel icon={<ListChecks size={18} className="text-slate-700" />} label="Checklist de Habilitação" />
        {eliminatorias > 0 && (
          <span className="shrink-0 text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full">
            {eliminatorias} eliminatória{eliminatorias > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 font-medium mt-1 mb-4">
        Exigências extraídas do edital por categoria — itens eliminatórios desclassificam a proposta se falharem.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {grupos.map(({ cat, label, lista }) => (
          <div key={cat}>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 pb-2 border-b border-slate-100">
              {label} <span className="text-slate-300">· {lista.length}</span>
            </h4>
            <Timeline
              dense
              items={lista.map((item, i) => ({
                key: i,
                tone: (item.criticidade === 'eliminatoria' ? 'red' : 'slate') as TimelineTone,
                badge: item.criticidade === 'eliminatoria' ? { label: 'Eliminatória', tone: 'red' as TimelineTone } : undefined,
                title: item.exigencia,
                description: (item.dica || item.trecho) ? (
                  <>
                    {item.dica && <span className="block"><strong className="font-black text-slate-600">Dica:</strong> {item.dica}</span>}
                    {item.trecho && <span className="mt-1 block italic text-slate-400">"{item.trecho}"</span>}
                  </>
                ) : undefined,
              }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Oportunidades Estratégicas (QA Engine) ──────────────────────────────────

function OportunidadesSection({ result }: { result: AnalysisResult }) {
  const oportunidades = result.oportunidades || [];
  if (oportunidades.length === 0) return null;
  return (
    <div className="relative border border-emerald-200 bg-emerald-50/40 rounded-2xl p-8">
      <SectionLabel icon={<Gem size={18} className="text-emerald-600" />} label="Oportunidades Estratégicas" />
      <div className="mt-2">
        <Timeline items={oportunidades.map((op, i) => ({ key: i, tone: 'emerald' as TimelineTone, icon: <Sparkles size={10} />, title: op }))} />
      </div>
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
            <Timeline dense items={result.vantagens.map((v, i) => ({ key: i, tone: 'emerald' as TimelineTone, title: v }))} />
          </div>
        )}
        {result.desvantagens && result.desvantagens.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4 flex items-center gap-1"><ThumbsDown size={11} /> Barreiras (Por que recuar?)</h4>
            <Timeline dense items={result.desvantagens.map((d, i) => ({ key: i, tone: 'amber' as TimelineTone, title: d }))} />
          </div>
        )}
        {result.exigencias_criticas && result.exigencias_criticas.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1"><Pin size={11} /> Exigências Críticas</h4>
            <Timeline dense items={result.exigencias_criticas.map((e, i) => ({ key: i, tone: 'slate' as TimelineTone, title: e }))} />
          </div>
        )}
        {result.documentos_necessarios && result.documentos_necessarios.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1"><FolderOpen size={11} /> Documentação Necessária</h4>
            <Timeline dense items={result.documentos_necessarios.map((doc, i) => ({ key: i, tone: 'blue' as TimelineTone, title: doc }))} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Matriz de Riscos ─────────────────────────────────────────────────────────

function RisksSection({ result }: { result: AnalysisResult }) {
  // Distinguir "análise antiga sem esse campo" (precisa reprocessar) de
  // "analisamos e não encontramos risco relevante" (resultado positivo) —
  // as duas situações têm `result.risks` vazio, mas significam coisas opostas.
  const risksEmpty = Array.isArray(result.risks) && result.risks.length === 0;

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
      <SectionLabel icon={<AlertTriangle size={18} className="text-slate-700" />} label="Matriz de Riscos" />
      {risksEmpty ? (
        <div className="mt-2 flex items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-xl p-5">
          <CheckCircle2 size={28} className="shrink-0 text-emerald-500" />
          <div>
            <p className="text-sm font-black text-emerald-800">Nenhum risco relevante identificado</p>
            <p className="text-xs text-emerald-700 font-medium mt-0.5 leading-relaxed">
              A análise avaliou o edital e não encontrou riscos de impacto alto, médio ou baixo dignos de nota.
            </p>
          </div>
        </div>
      ) : result.risks && result.risks.length > 0 ? (
        <div className="mt-2">
          <Timeline
            items={[...result.risks]
              // Dedup: a IA frequentemente lista o mesmo risco 2x com títulos
              // diferentes (ex: "Sem aderência ao CNAE" e "Desalinhamento de
              // CNAE — Impeditivo Estrutural"). Mantém o primeiro de cada tema.
              .filter((risk, idx, arr) =>
                arr.findIndex(r =>
                  textosSimilares(`${r.titulo || ''} ${r.descricao || ''}`, `${risk.titulo || ''} ${risk.descricao || ''}`, 0.45)
                ) === idx
              )
              .sort((a, b) => {
                const order: Record<string, number> = { alto: 0, medio: 1, baixo: 2 };
                return (order[a.impacto ?? 'medio'] ?? 1) - (order[b.impacto ?? 'medio'] ?? 1);
              })
              .map((risk, idx) => {
                const tone: TimelineTone = risk.impacto === 'alto' ? 'red' : risk.impacto === 'baixo' ? 'slate' : 'amber';
                const impactoLabel: Record<string, string> = { alto: 'ALTO', medio: 'MÉDIO', baixo: 'BAIXO' };
                return {
                  key: idx,
                  tone,
                  badge: { label: impactoLabel[risk.impacto ?? 'medio'] ?? (risk.impacto || '—'), tone },
                  title: risk.titulo,
                  description: risk.descricao,
                };
              })}
          />
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

// ─── Matriz de Risco Formal (Lei 14.133/2021, art. 6º, XXVII — grande vulto) ──

const ALOCACAO_CFG: Record<string, { label: string; cls: string }> = {
  contratante: { label: 'Órgão contratante', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  contratado: { label: 'Contratada', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  a_negociar: { label: 'A negociar', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function MatrizRiscoFormalSection({ result }: { result: AnalysisResult }) {
  const matriz = result.matriz_risco_formal;
  if (!matriz || !matriz.itens || matriz.itens.length === 0) return null;

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
      <SectionLabel icon={<Scale3d size={18} className="text-slate-700" />} label="Matriz de Risco Formal" />
      <p className="text-xs text-slate-500 font-medium mt-1 mb-4">{matriz.motivo_obrigatoriedade}</p>
      <div className="space-y-2">
        {matriz.itens.map((item, i) => {
          const cfg = ALOCACAO_CFG[item.alocado_a] ?? ALOCACAO_CFG.a_negociar;
          return (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-800">{item.risco}</p>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${cfg.cls}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{item.impacto}</p>
            </div>
          );
        })}
      </div>
      {matriz.nota && (
        <p className="mt-4 text-[11px] font-medium leading-relaxed text-slate-400">{matriz.nota}</p>
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
                O Parecer Jurídico detalhado está disponível apenas para membros <strong className="text-white/80 uppercase">Profissionais</strong> e <strong className="text-amber-400 uppercase">Avançados</strong>.
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

// ─── Avaliação por Parâmetros ─────────────────────────────────────────────────

interface AvaliacaoParametro {
  nome: string;
  peso: 'alto' | 'medio' | 'baixo';
  status: 'ok' | 'alerta' | 'bloqueio';
  score: number;
  trecho_citado: string;
  avaliacao: string;
}

const PARAM_STATUS_CFG = {
  ok:       { label: 'Atende',        bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  alerta:   { label: 'Atenção',       bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400'  },
  bloqueio: { label: 'Não atende',    bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'    },
};

const PARAM_PESO_CFG = {
  alto:  { label: 'Crítico',    color: 'text-red-600 font-black' },
  medio: { label: 'Importante', color: 'text-amber-600 font-bold' },
  baixo: { label: 'Desejável',  color: 'text-slate-500' },
};

const PARAM_STATUS_ICON = {
  ok:       <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />,
  alerta:   <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />,
  bloqueio: <XCircle size={20} className="text-red-500 flex-shrink-0" />,
};

function ParametrosSection({ result }: { result: AnalysisResult }) {
  const params: AvaliacaoParametro[] = result.avaliacao_parametros || [];

  // Sem critérios avaliados: nudge para o usuário configurar
  if (!params.length) {
    return (
      <div className="mb-8 flex items-start gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4 print:hidden">
        <SlidersHorizontal size={18} className="mt-0.5 flex-shrink-0 text-slate-400" />
        <div>
          <p className="text-sm font-bold text-slate-700">Nenhum critério personalizado avaliado nesta análise</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Configure seus critérios em <strong>Parametrização</strong> e gere uma nova análise para ver a avaliação por critério aqui.
          </p>
        </div>
      </div>
    );
  }

  const bloqueios = params.filter(p => p.status === 'bloqueio').length;
  const alertas   = params.filter(p => p.status === 'alerta').length;
  const ok        = params.filter(p => p.status === 'ok').length;

  const sorted = [...params].sort((a, b) => {
    const order = { bloqueio: 0, alerta: 1, ok: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });

  return (
    <section className="mb-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      {/* Cabeçalho */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <SlidersHorizontal size={13} />
              Critérios configurados
            </p>
            <h3 className="mt-1.5 text-xl font-black tracking-tight text-slate-950">
              Avaliação por Critérios
            </h3>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">
              {params.length} critério{params.length > 1 ? 's' : ''} avaliado{params.length > 1 ? 's' : ''} pela IA — resultado por critério abaixo
            </p>
          </div>
          <div className="flex gap-2">
            {ok > 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-center min-w-[60px]">
                <span className="text-xl font-black text-emerald-600">{ok}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Atende</span>
              </div>
            )}
            {alertas > 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-amber-100 bg-amber-50 px-4 py-2 text-center min-w-[60px]">
                <span className="text-xl font-black text-amber-600">{alertas}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Atenção</span>
              </div>
            )}
            {bloqueios > 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-center min-w-[60px]">
                <span className="text-xl font-black text-red-600">{bloqueios}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Bloqueio{bloqueios > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {bloqueios > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <XCircle size={15} className="flex-shrink-0 text-red-500" />
            <p className="text-xs font-bold text-red-700">
              {bloqueios} critério{bloqueios > 1 ? 's' : ''} crítico{bloqueios > 1 ? 's não atendem' : ' não atende'} às suas exigências — revise antes de prosseguir com a proposta
            </p>
          </div>
        )}
      </div>

      {/* O cabeçalho acima já é a manchete (contagem + alerta de bloqueio).
          O detalhe critério a critério fica atrás de um toggle. */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50">
          <ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" />
          Ver avaliação completa dos {params.length} critérios
        </summary>
        <div className="border-t border-slate-200 px-6 py-6">
        <Timeline
          items={sorted.map((p, i) => {
            const st   = PARAM_STATUS_CFG[p.status] ?? PARAM_STATUS_CFG.alerta;
            const peso = PARAM_PESO_CFG[p.peso]     ?? PARAM_PESO_CFG.medio;
            const tone: TimelineTone = p.status === 'bloqueio' ? 'red' : p.status === 'ok' ? 'emerald' : 'amber';
            return {
              key: i,
              tone,
              badge: { label: st.label, tone },
              meta: <span className="tabular-nums">{p.score}/10</span>,
              eyebrow: peso.label,
              title: p.nome,
              description: (
                <>
                  {p.avaliacao && <span className="block">{p.avaliacao}</span>}
                  {p.trecho_citado && (
                    <blockquote className="mt-2 rounded-lg border-l-4 border-slate-200 bg-slate-50 px-3 py-2 text-[11px] italic text-slate-500">
                      "{p.trecho_citado}"
                    </blockquote>
                  )}
                </>
              ),
            };
          })}
        />
        </div>
      </details>
    </section>
  );
}

// ─── Checklist / Roadmap ──────────────────────────────────────────────────────

function ChecklistSection({ result }: { result: AnalysisResult }) {
  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mt-12 print:hidden">
      <SectionLabel icon={<CheckCircle2 size={18} className="text-slate-700" />} label="Roadmap de Execução" />
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
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">Exclusivo Avançado</span>
          </div>
          <h3 className="font-black text-white text-xl tracking-tight mb-2 leading-tight">Laudo de Decisão Bawzi</h3>
          <p className="text-sm font-medium text-slate-400 leading-relaxed mb-4 max-w-lg">
            Documento executivo com veredito Go/No-Go, evidências, lacunas, confiança, próximos responsáveis e base para decisão interna.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {['Veredito Executivo', 'Evidências', 'Base da Confiança', 'Lacunas', 'Cockpit de Execução'].map(item => (
              <span key={item} className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 rounded-lg">✓ {item}</span>
            ))}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Apoio à decisão — requer validação responsável</span>
          </div>
        </div>
      </div>
      <button
        onClick={onExportPDF}
        className="relative z-10 w-full md:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 shrink-0"
      >
        <FileText size={16} /> Gerar Laudo (PDF)
      </button>
    </div>
  );
}

function toUiRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toUiRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function formatVersionDate(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ─── Layout de impressão ──────────────────────────────────────────────────────

// PrintLayout é o único bloco sempre montado no DOM independente da etapa
// ativa na tela (as demais só existem quando `activeStep` bate com elas).
// Por isso, para "Imprimir"/"Baixar" carregarem as 6 etapas da jornada, todo
// o conteúdo relevante de cada etapa precisa estar reproduzido aqui.
function PrintLayout({ result }: { result: AnalysisResult }) {
  const decision = normalizeDecision(result);
  const businessFit = normalizeBusinessFit(result);
  const params: AvaliacaoParametro[] = result.avaliacao_parametros || [];
  const redFlags = result.red_flags || [];
  const habilitacao = result.habilitacao_checklist || [];
  const riscos = result.risks || [];
  const oportunidades = result.oportunidades || [];
  const ficha = result.ficha_tecnica || [];
  const scoreItens = result.score_breakdown || [];
  const concorrentes = [...(result.concorrentes_provaveis || []), ...(result.concorrentes_regionais || [])];

  let secaoAtual = 0;
  const Secao = ({ title, children }: { title: string; children: React.ReactNode }) => {
    secaoAtual += 1;
    return (
      <section className="mb-6 break-inside-avoid">
        <h3 className="font-bold border-b border-slate-200 mb-2">{secaoAtual}. {title}</h3>
        {children}
      </section>
    );
  };

  return (
    <div className="hidden print:block bg-white p-10 font-serif text-slate-900 leading-relaxed text-sm">
      <div className="border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-2xl font-black uppercase">Bawzi Intelligence</h1>
        <p className="font-bold text-slate-500 uppercase">Laudo de Decisão — Go / No-Go de Licitação</p>
      </div>
      <div className="bg-slate-100 p-4 mb-6 border-l-4 border-slate-900">
        <p className="font-bold text-xs flex items-start gap-1">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" /> Nota de Responsabilidade: Este laudo foi gerado por IA para apoiar a decisão de participação. A revisão e validação por um profissional habilitado continua indispensável.
        </p>
      </div>

      <div className="space-y-6">

        {/* 01 · Veredito */}
        <Secao title="Veredito Executivo">
          <p><strong>{decision.veredito.replace('_', ' ')}</strong> — {decision.rotulo}</p>
          <p className="mt-1">{getDecisionSummary(decision)}</p>
          <p className="mt-1">Score: <strong>{result.score}/100</strong> · Confiança: <strong>{decision.confianca}%</strong></p>
        </Secao>

        {businessFit && (
          <Secao title="Aderência ao Negócio (CNAE)">
            <p>{businessFit.label} — Match: <strong>{businessFit.score}/100</strong></p>
            {businessFit.cnae && <p>CNAE: {businessFit.cnae}</p>}
            <p className="text-slate-600">{businessFit.description}</p>
          </Secao>
        )}

        {decision.evidencias.length > 0 && (
          <Secao title="Evidências que Sustentam a Decisão">
            {decision.evidencias.map((ev, i) => (
              <div key={i} className="mb-2">
                <p className="font-bold">{ev.titulo} <span className="font-normal text-slate-500">— {ev.referencia || ev.fonte}</span></p>
                {ev.detalhe && <p>{ev.detalhe}</p>}
                {ev.trecho && <blockquote className="border-l-2 border-slate-300 pl-2 italic text-slate-600">&ldquo;{ev.trecho}&rdquo;</blockquote>}
              </div>
            ))}
          </Secao>
        )}

        {decision.lacunas.length > 0 && (
          <Secao title="Lacunas da Análise">
            <ul className="list-disc pl-5 space-y-1 text-xs">{decision.lacunas.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </Secao>
        )}

        {/* 06 · Cockpit — plano de ação */}
        {decision.proximas_acoes.length > 0 && (
          <Secao title="Plano de Ação (Cockpit)">
            <table className="w-full text-xs">
              <thead><tr><th className="text-left">#</th><th className="text-left">Prazo</th><th className="text-left">Ação</th><th className="text-left">Responsável</th></tr></thead>
              <tbody>
                {decision.proximas_acoes.map((a, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1">{a.prazo}</td>
                    <td className="py-1">{a.acao}</td>
                    <td className="py-1">{a.responsavel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        <Secao title="Resumo Executivo do Edital">
          <p>{result.summary}</p>
        </Secao>

        {ficha.length > 0 && (
          <Secao title="Ficha Técnica do Edital">
            <table className="w-full text-xs">
              <tbody>
                {ficha.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1 pr-4 font-bold whitespace-nowrap align-top">{item.campo}</td>
                    <td className="py-1">{item.valor || 'Não localizado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        {result.datas_criticas && result.datas_criticas.length > 0 && (
          <Secao title="Cronograma Crítico">
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {result.datas_criticas.map((dc, i) => (
                <li key={i}>
                  {dc.label}: {dc.data_iso ? new Date(dc.data_iso).toLocaleDateString('pt-BR') : 'não informado'}
                  {dc.urgente ? ' (urgente)' : ''}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {/* 02 · Critérios */}
        {params.length > 0 && (
          <Secao title="Critérios Configurados">
            <table className="w-full text-xs">
              <thead><tr><th className="text-left">Critério</th><th className="text-left">Peso</th><th className="text-left">Status</th><th className="text-left">Score</th></tr></thead>
              <tbody>
                {params.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1">{p.nome}</td>
                    <td className="py-1">{PARAM_PESO_CFG[p.peso]?.label || p.peso}</td>
                    <td className="py-1">{PARAM_STATUS_CFG[p.status]?.label || p.status}</td>
                    <td className="py-1">{p.score}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        {/* 03 · SWOT & Riscos */}
        {redFlags.length > 0 && (
          <Secao title="Red Flags do Edital">
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {redFlags.map((f, i) => (
                <li key={i}>
                  <strong>[{(f.gravidade || 'media').toUpperCase()}]</strong> {f.descricao}
                  {f.base_legal ? ` (${f.base_legal})` : ''}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {(result.orgao_risk || result.programa_integridade_obrigatorio?.exigido || (result.garantias_alerta?.length ?? 0) > 0) && (
          <Secao title="Contexto do Órgão, Garantias e Integridade">
            {result.orgao_risk && (
              <p className="mb-1">
                <strong>CAPAG do órgão ({result.orgao_risk.escopo === 'municipio' ? 'município' : 'estado'}):</strong>{' '}
                {result.orgao_risk.classificacao} — {result.orgao_risk.descricao}
              </p>
            )}
            {result.programa_integridade_obrigatorio?.exigido && (
              <p className="mb-1">
                <strong>Programa de integridade obrigatório</strong> (Lei 14.133/2021): {result.programa_integridade_obrigatorio.mensagem} Prazo: {result.programa_integridade_obrigatorio.prazo}.
              </p>
            )}
            {(result.garantias_alerta?.length ?? 0) > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-xs mt-1">
                {result.garantias_alerta!.map((g, i) => (
                  <li key={i}><strong>{g.campo}:</strong> {g.mensagem}</li>
                ))}
              </ul>
            )}
          </Secao>
        )}

        {(!!result.vantagens?.length || !!result.desvantagens?.length) && (
          <Secao title="Carga Operacional & SWOT">
            <div className="grid grid-cols-2 gap-6">
              {!!result.vantagens?.length && (
                <div>
                  <p className="font-bold mb-1 text-xs">Vantagens</p>
                  <ul className="list-disc pl-5 space-y-1 text-xs">{result.vantagens.map((v, i) => <li key={i}>{v}</li>)}</ul>
                </div>
              )}
              {!!result.desvantagens?.length && (
                <div>
                  <p className="font-bold mb-1 text-xs">Barreiras</p>
                  <ul className="list-disc pl-5 space-y-1 text-xs">{result.desvantagens.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
              )}
            </div>
          </Secao>
        )}

        {habilitacao.length > 0 && (
          <Secao title="Checklist de Habilitação">
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {habilitacao.map((h, i) => (
                <li key={i}>{h.exigencia}{h.criticidade === 'eliminatoria' ? ' (eliminatória)' : ''}</li>
              ))}
            </ul>
          </Secao>
        )}

        {riscos.length > 0 && (
          <Secao title="Matriz de Riscos">
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {riscos.map((r, i) => (
                <li key={i}><strong>[{(r.impacto || 'medio').toUpperCase()}]</strong> {r.titulo} — {r.descricao}</li>
              ))}
            </ul>
          </Secao>
        )}

        {(result.matriz_risco_formal?.itens?.length ?? 0) > 0 && (
          <Secao title="Matriz de Risco Formal (Contratação de Grande Vulto)">
            <p className="text-xs text-slate-600 mb-1">{result.matriz_risco_formal!.motivo_obrigatoriedade}</p>
            <table className="w-full text-xs">
              <thead><tr><th className="text-left">Risco</th><th className="text-left">Impacto</th><th className="text-left">Alocado a</th></tr></thead>
              <tbody>
                {result.matriz_risco_formal!.itens.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1 pr-2">{item.risco}</td>
                    <td className="py-1 pr-2">{item.impacto}</td>
                    <td className="py-1">{ALOCACAO_CFG[item.alocado_a]?.label || item.alocado_a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        {oportunidades.length > 0 && (
          <Secao title="Oportunidades Estratégicas">
            <ul className="list-disc pl-5 space-y-1 text-xs">{oportunidades.map((o, i) => <li key={i}>{o}</li>)}</ul>
          </Secao>
        )}

        {/* 04 · Jurídico */}
        <Secao title="Fundamentação e Parecer Especialista">
          <p className="whitespace-pre-wrap">{result.parecer_especialista || result.rationale || 'Sem parecer detalhado disponível para esta análise.'}</p>
        </Secao>

        {scoreItens.length > 0 && (
          <Secao title="Composição do Score">
            <table className="w-full text-xs">
              <tbody>
                {scoreItens.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1">{item.fator}</td>
                    <td className="py-1 text-right font-bold">{item.pontos > 0 ? '+' : ''}{item.pontos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}

        {/* 05 · Concorrentes */}
        {concorrentes.length > 0 && (
          <Secao title="Concorrência">
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {concorrentes.slice(0, 10).map((c: Record<string, unknown>, i: number) => (
                <li key={i}>
                  {String(c?.nome || c?.razao_social || c?.name || 'Concorrente identificado')}
                  {c?.uf ? ` — ${c.uf}` : ''}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        <Secao title="Conclusão Estratégica">
          <p>Veredito da Análise: <strong>{result.classification}</strong> (Score: {result.score}/100)</p>
        </Secao>
      </div>
      <div className="mt-20 pt-10 border-t border-slate-300 flex flex-col items-center">
        <div className="w-64 h-px bg-slate-900 mb-2"></div>
        <p className="font-bold uppercase text-xs">Validação Jurídica (Assinatura)</p>
        <p className="text-xs mt-1">OAB/UF nº _________</p>
      </div>
    </div>
  );
}
