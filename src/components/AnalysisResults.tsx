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
  AlertCircle, Clock, CircleHelp, XCircle,
  CalendarX, SearchX, Sparkles, Link2, Share2, Download,
  RefreshCw, History, CheckCircle2, SlidersHorizontal, ChevronDown, Check, ChevronRight, Flag, ListChecks, FileSearch, Gem, Calculator, Trophy,
  ListOrdered, Landmark, ShieldCheck, Scale3d, TrendingUp, ShieldAlert,
  Maximize2, Minimize2, ExternalLink,
  ScanSearch, Plus, PinOff, Gavel,
} from 'lucide-react';
import type {
  AnalysisResult,
  DecisionConfidenceFactor,
  DecisionData,
  DecisionEvidence,
  DecisionVerdict,
} from './analysis-types';
import { textoDoItem, citacaoDoItem, estadoDaCitacao } from './analysis-types';
// Construtor ÚNICO do plano de execução, compartilhado com o painel Gestão.
// Ver o comentário longo em `lib/decisionQueue` sobre por que isto não pode
// voltar a ser duas funções.
import { buildDecisionQueueTasks } from '@/lib/decisionQueue';
import {
  formatarDataCritica,
  dataCriticaExpirada,
  dataCriticaUrgente,
  venceHoje,
} from '@/lib/datasCriticas';
import { contarCriterios, todosOsCriteriosAtendidos } from '@/lib/criteriosDaEmpresa';
import type { SavedAnalysis } from '@/lib/types';
import TacticalSimulator from './TacticalSimulator';
import PremiumLock from './PremiumLock';
import CompetitorWarRoom from './CompetitorWarRoom';

interface AnalysisResultsProps {
  result: AnalysisResult;
  activeTab: string;
  onSetActiveTab: (tab: string) => void;
  /** Abre a aba Gestão JÁ apontando para esta análise — e, com `taskId`, com o
   *  passo aberto para edição. Sem ela, o fallback é trocar de aba e largar a
   *  pessoa na fila inteira para procurar o edital de novo. */
  onAbrirNaGestao?: (analysisId: string, taskId?: string) => void;
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
  /* `onCockpitStatusChange` foi REMOVIDA. O laudo não grava mais
   * `cockpit_status` — o plano é leitura aqui e edição na Gestão. Manter o
   * callback declarado seria a assinatura prometendo um evento que nunca mais
   * dispara, e o próximo a ler este arquivo assumiria que a tela ainda salva. */
  /** Abre a aba Capital com o valor do edital pré-preenchido */
  onGoToCapital?: (valor: number) => void;
  /** "Aprofundar este laudo": reexecuta ESTE edital em auditoria profunda
   *  cobrando só a diferença (o backend abate o que a rápida já debitou).
   *  Só chega em laudo rápido persistido, com o texto ainda carregado. */
  onAprofundar?: () => void;
  /** Multiplicador da auditoria profunda no plano (`quota.peso_profunda`).
   *  Com ele e o que ESTE laudo já custou (`result.creditos`), a conta sai
   *  exata: profunda = pago × peso, diferença = pago × (peso − 1). Não
   *  depende do texto na tela — que é justamente por onde a estimativa
   *  antiga errava (o backend cobra sobre o texto + PDFs do PNCP). */
  pesoProfunda?: number | null;
  /** Créditos disponíveis no período — o banner mostra ao lado do preço para
   *  a pessoa não precisar sair do laudo para saber se dá. */
  saldoCreditos?: number | null;
  /** Avisa quem renderiza a lista (ex.: painel Gestão) quando o acompanhamento muda,
   * já que o toggle é local a este componente e o "+ Gestão"/"Remover" precisa
   * refletir imediatamente numa lista filtrada por tracked_in_gestao. */
  onTrackedChange?: (tracked: boolean) => void;
  /** Menu lateral do app-shell (AppSidebar) — só passado por quem tem esse menu
   * pra ocultar (workspace principal). Sem essas props o botão de menu não
   * aparece (ex.: dentro da Gestão, que já tem seu próprio controle). */
  // ⚠️ PROPS REMOVIDAS: `sidebarHidden` / `onToggleSidebar`.
  // Este componente rendezia o botão de ocultar menu; ele foi para a casca
  // (`analysis-app.tsx`), que é quem de fato controla a largura, e passou a
  // valer para todas as abas. Sem o botão, as props ficariam declaradas e não
  // usadas — parâmetro morto que o próximo leitor tenta entender.
  /** Abre a compra de pacote avulso. O aviso de laudo degradado é o momento
   *  de maior intenção que existe: o cliente acabou de VER o que perdeu. */
  onComprarPacote?: () => void;
  /** Redige a peça de impugnação sobre as cláusulas marcadas e abre o modal.
   *  Ausente quando o texto do edital não está carregado (laudo aberto do
   *  histórico) — é a mesma condição do `onAprofundar`, e pela mesma razão: o
   *  backend redige SOBRE o texto, não sobre o laudo. */
  onGerarImpugnacao?: (riscos: Array<{ titulo: string; descricao: string }>) => void;
  gerandoImpugnacao?: boolean;
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
  onAbrirNaGestao,
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
  onComprarPacote,
  onUpgradeClick,
  onGoToCapital,
  onAprofundar,
  pesoProfunda,
  saldoCreditos,
  onTrackedChange,
  onGerarImpugnacao,
  gerandoImpugnacao,
}: AnalysisResultsProps) {
  const [copied, setCopied] = useState(false);
  const [liveResult, setLiveResult] = useState(result);
  const pncpEditalUrl = useMemo(() => buildPncpEditalUrl(liveResult), [liveResult]);
  const [tracked, setTracked] = useState<boolean>(!!result.tracked_in_gestao);
  const [trackSaving, setTrackSaving] = useState(false);
  const [activeAnaliseStep, setActiveAnaliseStep] = useState<string>('decisao');
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  // Derived: concorrentes step is active when that tab is selected
  const activeStep = activeTab === 'concorrentes' ? 'disputa' : activeAnaliseStep;

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
      {/* ⚠️ AQUI HAVIA UMA BARRA DECORATIVA DE 8px pintada por `getScoreBg`.
          Era o primeiro elemento colorido da tela, dizia menos do que qualquer
          palavra e discordava do veredito sempre que score e decisão não
          coincidiam. Quem carrega a cor agora é o trilho do veredito, logo
          abaixo — onde a cor está encostada na frase que ela qualifica. */}
      <div className="p-8 md:p-12">

        {/* HEADER DE IMPRESSÃO */}
        <div className="hidden print:flex items-center justify-between border-b border-slate-900 pb-6 mb-8 w-full">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-slate-900">BAWZI | Inteligência em Editais</h1>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.09em]">Relatório Estratégico de Viabilidade</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold text-slate-400 uppercase">Data da Análise</p>
            <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* TÍTULO + BARRA DE IMPRIMIR E PARTILHAR */}
        <div className="flex flex-col gap-4 mb-8 print:hidden">

          {/* ⚠️ ESTA LINHA DIZIA "PAINEL DE DECISÃO" EM text-2xl font-black.
              Era o maior texto da tela e não identificava nada: todo laudo se
              chamava igual. Quem abre um laudo já sabe que está num painel de
              decisão — o que ele precisa de ler primeiro é DE QUE EDITAL se
              trata, e depois qual é a decisão. A identidade veio para cá e o
              rótulo genérico desapareceu.

              O botão sólido "+ Nova Análise" também saiu daqui. Era o elemento
              mais saturado da tela e o seu efeito é TIRAR a pessoa do relatório
              que ela acabou de abrir; virou um botão de contorno na mesma
              barra das outras ações. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.06em] text-slate-400">
                {identidadeDoEdital(liveResult) || 'Edital sem identificação no cadastro'}
                {isCachedResult && <span className="ml-2 normal-case text-slate-400">· recuperado do cache</span>}
              </p>
              <h2 className="mt-1 max-w-[62ch] text-base font-medium leading-snug text-slate-700 md:text-[17px]">
                {liveResult.title}
              </h2>
              {termoAlvo && (
                <p className="mt-1 font-mono text-[11px] text-slate-400">busca: {termoAlvo}</p>
              )}
            </div>

          {/* Ações discretas: exportar, imprimir, compartilhar — não competem com o veredito */}
          <div className="flex flex-wrap items-center justify-end gap-1 sm:shrink-0">
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
            {pncpEditalUrl && (
              <a
                href={pncpEditalUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver edital original no Portal Nacional de Contratações Públicas (PNCP)"
                className="p-2 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-sky-50 transition-colors"
              >
                <ExternalLink size={15} />
              </a>
            )}
            {/* ⚠️ O BOTÃO DE OCULTAR MENU SAIU DAQUI.
                Ele existia neste cabeçalho, noutro no quadro da Gestão e num
                terceiro no painel de resultados — três posições e três rótulos
                para o mesmo efeito, e nenhum nas demais abas. Agora há UM, na
                casca (`analysis-app.tsx`), no mesmo lugar em todas as telas.
                A prop `onToggleSidebar` continua chegando aqui porque o
                "Voltar" ainda precisa restaurar o menu — o que mudou é quem
                oferece o controle, não quem reage a ele. */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia — usar 100% da largura'}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:block" />

            {onGoToCapital && (
              <button
                onClick={() => {
                  const raw = result.estimated_value || '';
                  const num = parseFloat(
                    raw.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
                  );
                  onGoToCapital(isNaN(num) ? 0 : num);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                title={result.estimated_value ? `Abrir Capital com ${result.estimated_value} pré-preenchido` : 'Abrir Capital de Giro'}
              >
                <Banknote size={14} />
                Capital de Giro
              </button>
            )}

            <button
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <Plus size={14} />
              {resetLabel}
            </button>
          </div>
          </div>

          {/* ══ O VEREDITO, ANTES DE QUALQUER OUTRA COISA ══════════════════
              A tela responde a uma pergunta só — participo deste edital? —
              e levava uns 500px até dizer. Agora a resposta cabe na dobra,
              junto do porquê e do número que a sustenta. */}
          <VereditoTopo result={liveResult} />

          </div>

        {/* ══ JORNADA — navegação principal no topo ══ */}
        <JourneyStepNav
          activeStep={activeStep}
          onStepClick={handleStepClick}
          currentTier={currentTier}
          userTier={userTier}
        />

        {/* ⚠️ AQUI HAVIA UMA `PersistentSummaryBar` — a TERCEIRA renderização
            do mesmo veredito, depois de `JourneySummary` e `DecisionSnapshot`.
            Ela existia porque o veredito não estava no topo: era preciso
            reimprimi-lo em cada aba para o leitor não o perder. Com
            `VereditoTopo` fixo acima das abas, repeti-lo aqui seria dizer a
            mesma coisa duas vezes antes de qualquer conteúdo novo. */}

        {/* ── Aprofundar: visível em TODA aba de um laudo rápido ──────────
            O convite acompanha a leitura: em qualquer aba que a pessoa esteja,
            a informação "isto foi uma leitura única e dá para aprofundar
            pagando só a diferença" está a um olhar de distância. Só em laudo
            rápido (rodape_leitura), nunca em laudo profundo, e só quando o app
            passou o callback (sessão ativa + texto ainda carregado).
            Some na aba "Riscos", onde o banner completo (com a conta) mora
            logo abaixo do "Como esta análise foi feita".
            `creditos` do próprio laudo é a MESMA fonte que o backend abate —
            estimar de novo arriscaria a tela prometer um desconto e o portão
            dar outro. */}
        {onAprofundar && liveResult.rodape_leitura && !liveResult.auditoria_delta
          && activeStep !== 'riscos' && (
          <AprofundarFaixa
            onAprofundar={onAprofundar}
            jaPago={typeof liveResult.creditos === 'number' ? liveResult.creditos : null}
            pesoProfunda={pesoProfunda ?? null}
            saldo={saldoCreditos ?? null}
          />
        )}

        {/* ⚠️ FORA DO `key={activeStep}` DE PROPÓSITO: o aviso vale para o
            laudo inteiro, não para uma aba. Ele é a rede de segurança da rede
            de segurança — se ele sumir, some junto o único sinal de que
            NENHUMA trava determinística rodou. */}
        <QaFalhouBanner result={liveResult} />

        {/* ══ CONTEÚDO DA ABA ATIVA ══ */}
        <div key={activeStep} className="animate-in fade-in duration-300">

          {/* ── Decisão ─────────────────────────────────────────────────────
              Absorve o antigo "00 Panorama", que abria com um cartão do
              veredito, o semáforo e o resumo executivo — e cujo cartão do
              veredito era literalmente o mesmo dado que a etapa seguinte
              mostrava por extenso. Sobrou o que Panorama tinha de próprio: o
              semáforo por eixo, o resumo em prosa e o log de trabalho da IA. */}
          {activeStep === 'decisao' && (
            <div className="space-y-8">
              <ExpiredBanner result={liveResult} />
              <MeEppImpeditivoBanner result={liveResult} />

              <div id="section-decisao" className="scroll-mt-24">
                <DecisionSnapshot result={liveResult} learningStats={learningStats} />
              </div>

              <div className="relative rounded-2xl border border-slate-200 p-8">
                <SectionLabel icon={<Target size={18} className="text-slate-700" />} label="Resumo executivo" />
                <div className="mt-2 space-y-4 whitespace-pre-line text-sm font-medium leading-relaxed text-slate-700 md:text-base">
                  {liveResult.summary}
                </div>
              </div>

              <SemaforoSection result={liveResult} />

              {/* "Log de trabalho" da IA: todas as frentes avaliadas, o que
                  sustenta cada uma e o que não precisa de atenção. */}
              <EscopoAnaliseSection result={liveResult} userTier={userTier} onStepClick={handleStepClick} />
            </div>
          )}

          {/* ── Aderência ───────────────────────────────────────────────────
              Prova da decisão: o que foi extraído do edital, os critérios
              aplicados sobre isso e o número que sai da aplicação. */}
          {activeStep === 'aderencia' && (
            <div id="section-aderencia" className="scroll-mt-24 space-y-10">
              <Capitulos
                itens={[
                  {
                    titulo: 'Dados extraídos do edital',
                    quando: Boolean(liveResult.ficha_tecnica?.length),
                    conteudo: <CollapsibleFichaTecnica result={liveResult} />,
                  },
                  {
                    titulo: 'Critérios aplicados',
                    conteudo: (
                      <>
                        <ParametrosSection result={liveResult} />
                        {/* ⚠️ CAMPO QUE NUNCA FOI RENDERIZADO.
                            `criterios_de_julgamento` chega preenchido do backend
                            (`models.py`) desde sempre e não existia em lado
                            nenhum da tela — é a regra pela qual o órgão escolhe
                            o vencedor, ou seja, o que decide se vale a pena
                            disputar preço. */}
                        <CriteriosJulgamentoSection result={liveResult} />
                      </>
                    ),
                  },
                  {
                    titulo: 'Como chegamos ao score',
                    conteudo: (
                      <>
                        <ScoreHeader result={liveResult} />
                        <CollapsibleScoreBreakdown result={liveResult} />
                      </>
                    ),
                  },
                  {
                    titulo: 'Quem está comprando',
                    quando: Boolean(liveResult.orgao_risk || liveResult.programa_integridade_obrigatorio?.exigido),
                    conteudo: <OrgaoContextoSection result={liveResult} />,
                  },
                ]}
              />
            </div>
          )}

          {/* ── Riscos ──────────────────────────────────────────────────────
              O antigo "03 SWOT & Riscos" empilhava oito blocos sem hierarquia
              nenhuma, e o "04 Jurídico" era uma aba inteira para uma secção.
              Cláusula abusiva e risco são a mesma conversa: quem lê um quer
              ler o outro. Passaram a três capítulos numa aba só. */}
          {activeStep === 'riscos' && (
            <div id="section-riscos" className="scroll-mt-24">
              {(() => {
                const item = buildJourneySummary(liveResult, userTier).find((i) => i.key === 'riscos')!;
                const tone: TimelineTone =
                  item.status === 'alerta' ? 'red'
                  : item.status === 'atencao' ? 'amber'
                  : item.status === 'ok' ? 'emerald'
                  : 'slate';
                return (
                  <StepHeadline tone={tone} eyebrow="Riscos" headline={item.headline}>
                    <Capitulos
                      itens={[
                        {
                          titulo: 'Forças e fraquezas',
                          quando: Boolean(
                            liveResult.vantagens?.length
                            || liveResult.desvantagens?.length
                            || liveResult.exigencias_criticas?.length
                            || liveResult.documentos_necessarios?.length,
                          ),
                          conteudo: <SwotSection result={liveResult} />,
                        },
                        {
                          titulo: 'Riscos e conformidade',
                          conteudo: (
                            <>
                              {/* Primeiro do capítulo de propósito: contradição
                                  no edital é acionável hoje (pedido de
                                  esclarecimento tem prazo) e some quando não
                                  existe, então nunca empurra o resto para baixo
                                  à toa. */}
                              <ContradicoesSection result={liveResult} />
                              <AuditoriaDeltaDestaque result={liveResult} />
                              <ComoFoiFeita result={liveResult} />
                              {onAprofundar && liveResult.rodape_leitura && !liveResult.auditoria_delta && (
                                <AprofundarBanner
                                  onAprofundar={onAprofundar}
                                  jaPago={typeof liveResult.creditos === 'number' ? liveResult.creditos : null}
                                  pesoProfunda={pesoProfunda ?? null}
                                  saldo={saldoCreditos ?? null}
                                />
                              )}
                              <RedFlagsSection result={liveResult} />
                              <RisksSection result={liveResult} />
                              <MatrizRiscoFormalSection result={liveResult} />
                              <HabilitacaoSection
                                result={liveResult}
                                analysisId={analysisId}
                                onAnalysisPatch={(patch) => setLiveResult((atual) => ({ ...atual, ...patch }))}
                              />
                            </>
                          ),
                        },
                        {
                          titulo: 'Leitura jurídica',
                          conteudo: (
                            <>
                              <PareceSection result={liveResult} userTier={userTier} onUpgradeClick={onUpgradeClick} />
                              <div className="border-t border-slate-100 pt-6 print:hidden">
                                <h4 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
                                  <BrainCircuit className="h-4 w-4 text-slate-400" strokeWidth={2} />
                                  Raciocínio estratégico da IA
                                </h4>
                                <div className="whitespace-pre-line rounded-xl border border-slate-100 bg-slate-50 p-5 text-sm font-medium leading-relaxed text-slate-700">
                                  {liveResult.rationale || liveResult.recommendation || 'Sem dados estratégicos.'}
                                </div>
                              </div>
                            </>
                          ),
                        },
                      ]}
                    />
                  </StepHeadline>
                );
              })()}
            </div>
          )}

          {/* ── Disputa ── */}
          {activeStep === 'disputa' && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              {(() => {
                const item = buildJourneySummary(liveResult, userTier).find((i) => i.key === 'disputa')!;
                const tone: TimelineTone =
                  item.status === 'alerta' ? 'red'
                  : item.status === 'atencao' ? 'amber'
                  : item.status === 'ok' ? 'emerald'
                  : 'slate';
                return <StepHeadline tone={tone} eyebrow="Disputa" headline={item.headline} />;
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
                  diagnostico={(liveResult as { concorrentes_diagnostico?: import('./CompetitorWarRoom').DiagnosticoConcorrentes }).concorrentes_diagnostico}
                  atualizadoEm={(liveResult as { concorrentes_atualizado_em?: string }).concorrentes_atualizado_em}
                />
              </PremiumLock>
            </div>
          )}

          {/* ── Ação ────────────────────────────────────────────────────────
              Tudo o que se faz DEPOIS de decidir, numa aba só: quando é, o que
              fazer, com que documentos, por que preço. O cronograma e as
              oportunidades vieram das abas de veredito e panorama — são
              consequência da decisão, não parte dela. */}
          {activeStep === 'acao' && (() => {
            // ⚠️ AQUI HAVIA UM PORTÃO DE NÍVEL 4 QUE O PRODUTO NÃO TEM MAIS.
            //
            // Esta linha era `>= 4`, e o efeito era o pior possível: quem
            // assinava o Essencial ou o Profissional VIA a Gestão no menu
            // (`AppSidebar.tsx:221` não exige nível nenhum — o portão foi
            // removido de propósito, com comentário dizendo que "o usuário do
            // Essencial tinha a funcionalidade e não tinha como chegar nela"),
            // entrava nela normalmente, abria um laudo lá de dentro — e o
            // próprio laudo dizia que o painel Gestão é Nível 4 e oferecia
            // "Desbloquear painel". Clicar chamava `onUpgradeClick()`.
            //
            // Ou seja: a plataforma vendia, por R$ 497/mês, um recurso que
            // aquela pessoa estava usando naquele exato momento. Pior que um
            // link quebrado, porque parece cobrança indevida.
            //
            // A regra volta a ser a única que existe de verdade: ter sessão.
            // ⚠️ IR PARA A ABA NÃO É CHEGAR NO ITEM. Antes isto só trocava de
            // aba: a pessoa clicava em "definir responsável" de uma condição
            // específica e caía na fila inteira, tendo que reencontrar o
            // edital, abrir o resumo e achar o passo. Com `analysisId` (e o
            // `taskId`, quando o clique veio de uma condição) a Gestão já abre
            // no lugar certo. O fallback continua sendo a troca de aba, para o
            // caso de a casca não passar o callback.
            const onGoToGestao = (taskId?: string) => {
              if (analysisId && onAbrirNaGestao) onAbrirNaGestao(analysisId, taskId);
              else onSetActiveTab('gestao');
            };
            return (
            <div id="section-acao" className="scroll-mt-24 space-y-8">
              <Capitulos
                itens={[
                  {
                    titulo: 'Quando',
                    conteudo: (
                      <>
                        <CronogramaSection result={liveResult} />
                        {/* ⚠️ SEGUNDO CAMPO QUE NUNCA FOI RENDERIZADO. `prazos`
                            chega do backend e não aparecia em lado nenhum — e é,
                            entre todos os campos do laudo, o mais próximo do que
                            a pessoa faz depois de decidir participar. */}
                        <PrazosSection result={liveResult} />
                        {!liveResult.datas_criticas?.length && !liveResult.prazos?.length && (
                          <p className="text-sm font-medium text-slate-400">
                            O material analisado não trouxe datas nem prazos legíveis. Confirme no edital original
                            antes de montar a agenda.
                          </p>
                        )}
                      </>
                    ),
                  },
                  {
                    titulo: 'O que fazer',
                    conteudo: (
                      <>
                        <DecisionCockpit
                          result={liveResult}
                          analysisId={analysisId}
                          token={token}
                          tracked={tracked}
                          trackSaving={trackSaving}
                          onToggleTracking={toggleTracking}
                          onGoToGestao={onGoToGestao}
                        />
                        {/* ⚠️ O ENDEREÇO FICA AQUI, NÃO NA ABA DECISÃO.
                            O `DecisionSnapshot` lista as três primeiras ações
                            como resumo do plano — é leitura, para quem ainda
                            está a decidir. Esta aba é onde se faz. Pendurar o
                            botão que redige a peça no resumo truncado seria pôr
                            a ferramenta longe do momento em que ela é usada, e
                            duplicá-la nos dois sítios traria de volta o padrão
                            que este laudo passou a semana a desfazer. */}
                        <EnderecoDasAcoes
                          result={liveResult}
                          onGerarImpugnacao={onGerarImpugnacao}
                          gerandoImpugnacao={gerandoImpugnacao}
                        />
                        <OportunidadesSection result={liveResult} />
                      </>
                    ),
                  },
                  {
                    titulo: 'Por que preço',
                    conteudo: (
                      <SimuladorPreco
                        result={liveResult}
                        userTier={userTier}
                        onUpgradeClick={onUpgradeClick}
                      />
                    ),
                  },
                  {
                    titulo: 'Acompanhar e exportar',
                    conteudo: (
                      <>
                        <DecisionVersionMonitor
                          result={liveResult}
                          analysisId={analysisId}
                          token={token}
                          onAnalysisUpdate={(updated) => setLiveResult(updated)}
                        />
                        <PremiumLock
                          isLocked={Math.max(getCachedTier(userTier), currentTier) < 4}
                          featureTitle="Laudo de Decisão Bawzi (PDF)"
                          requiredTierName="Nível 4 (Avançado)"
                          onUpgradeClick={onUpgradeClick}
                        >
                          <PdfExportCard onExportPDF={onExportPDF} />
                        </PremiumLock>
                      </>
                    ),
                  },
                ]}
              />
            </div>
            );
          })()}

        </div>

        {/* ── Aviso de laudo degradado ─────────────────────────────────────
            Quando a cota estoura, a análise NÃO é bloqueada: ela roda no motor
            do plano gratuito, sem auditoria profunda. Sem este aviso, o cliente
            compararia dois laudos de profundidade diferente sem entender por
            quê — e concluiria que a ferramenta piorou. */}
        {Boolean((liveResult as unknown as Record<string, unknown>)?.motor_gratuito) && (
          <div className="mt-8 rounded-2xl border border-violet-200 bg-violet-50 p-4 print:hidden">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-violet-700">
              Laudo gerado no motor gratuito
            </p>
            <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-violet-900">
              Os créditos do período acabaram, então esta análise rodou no motor do
              plano gratuito e <strong>sem a auditoria profunda</strong> — a varredura que
              lê o edital em blocos e valida cada achado contra o texto original. As
              conclusões continuam válidas, mas com menos profundidade de verificação.
            </p>
            {onComprarPacote && (
              <button
                type="button"
                onClick={onComprarPacote}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-violet-700"
              >
                Adicionar créditos e refazer com auditoria completa
              </button>
            )}
          </div>
        )}

        {/* LAYOUT DE IMPRESSÃO — renderiza tudo, visível apenas ao imprimir */}
        <PrintLayout result={liveResult} />

        {/* RODAPÉ METADADOS */}
        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium print:hidden">
          <div className="flex items-center gap-2">
            <span>Gerado por:</span>
            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-semibold uppercase tracking-[0.09em]">{modelSource || 'Motor Bawzi IA'}</span>
          </div>
          {isCachedResult && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
              <Zap size={14} />
              <span className="font-semibold uppercase tracking-[0.09em] text-[10px]">Recuperado do Cache</span>
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

  // Selo do modo que gerou ESTE laudo. Quem pagou 4× precisa reencontrar o
  // que comprou — e quem está na rápida vê que existe um degrau acima.
  // Detecção pelos artefatos (rodapés/delta), não pelo rótulo do provider:
  // laudos antigos sem os campos ficam sem selo, o que é o honesto.
  const modoDoLaudo: 'profunda' | 'rapida' | null =
    (result.auditoria_rodape || result.auditoria_delta)
      ? 'profunda'
      : result.rodape_leitura ? 'rapida' : null;

  /* ⚠️ AQUI HAVIA TRÊS FRASES INVENTADAS, E A PRIMEIRA ERA A PIOR DE TODAS.
   *
   *   impeditivos vazios  → "Nenhum impeditivo fatal foi identificado no bloco
   *                          de decisão."
   *   condições vazias    → "Manter validação final de documentação, preço e
   *                          prazo antes de protocolar a proposta."
   *   motivos vazios      → "A decisão foi derivada do score, semáforo, riscos
   *                          e recomendação estratégica disponíveis."
   *
   * "Nenhum impeditivo foi identificado" AFIRMA UMA VERIFICAÇÃO. O que de
   * facto aconteceu foi a IA não devolver o campo — que é o oposto de ter
   * procurado e não achado. Num laudo comercial, essa frase é a diferença
   * entre "conferimos e está limpo" e "não conferimos": a pessoa protocola
   * proposta em cima dela.
   *
   * A única marca que existia era `tone: 'text-slate-400'` — cinza mais
   * claro. Nada em texto. Agora a lista vazia continua vazia, e a coluna
   * some (o `.filter(col => col.items.length > 0)` mais abaixo já cuidava
   * disso); o que falta é dito uma vez, no rodapé do bloco.
   */
  const rawBlockers = decision.impeditivos;
  const rawConditions = decision.condicoes_para_participar;
  const rawReasons = decision.motivos;
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
  /* `VereditoTopo` já publicou `impeditivos[0]` como o porquê do veredito.
     Comparar pelo texto normalizado (e não pelo índice) porque `dedupTextos` e
     `filterCoveredDecisionItems` podem ter reordenado ou removido itens antes
     de chegarem aqui. */
  const _primeiroNoTopo = normalizeDecisionText(decision.impeditivos[0] || '');
  const blockersRestantes = decision.veredito === 'NO_GO' && _primeiroNoTopo
    ? blockers.filter((b) => normalizeDecisionText(b) !== _primeiroNoTopo)
    : blockers;
  const evidenceItems = decision.evidencias.slice(0, 4);
  const gapItems = dedupTextos(decision.lacunas, _vistosDedup);

  // Detalhes da "Base da confiança" que apenas repetem evidências são omitidos
  const _evidenciaTextos = evidenceItems.map(e => `${e.titulo || ''} ${e.detalhe || ''}`);
  const detalheJaCoberto = (txt?: string) =>
    !!txt && _evidenciaTextos.some(ev => textosSimilares(ev, txt));

  /* O que a leitura não devolveu. Dito uma vez, em nome próprio, em vez de
     cada campo vazio inventar uma frase afirmativa para se preencher. */
  const naoDevolvido = [
    decision.impeditivos.length === 0 ? 'impedimentos' : '',
    decision.motivos.length === 0 ? 'motivos' : '',
    decision.condicoes_para_participar.length === 0 ? 'condições para participar' : '',
    decision.proximas_acoes.length === 0 ? 'próximas ações' : '',
  ].filter(Boolean);

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
      {/* ⚠️ AQUI TAMBÉM HAVIA UMA BARRA DE COR (`verdict.bar`), e ela era a
          segunda no mesmo ecrã. Saiu pela mesma razão que a do topo: a cor do
          veredito já está encostada à frase do veredito, cinco centímetros
          acima. */}
      <div className="p-6 md:p-8">

        {/* ── Cabeçalho ──────────────────────────────────────────────────
            ⚠️ ESTE CABEÇALHO REPETIA O VEREDITO INTEIRO: ícone de polegar,
            pílula "NO GO", o rótulo em text-3xl e o nome do órgão — tudo
            aquilo que `VereditoTopo` mostra agora antes das abas, a menos de
            uma dobra de distância. E o mosaico "62 VIABILIDADE" era a segunda
            impressão do mesmo número. Ficaram as duas medidas que o topo NÃO
            dá, e que não são o score: quão segura é esta decisão, e quanto do
            edital a análise conseguiu ler. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
              Decisão executiva
            </span>
            {modoDoLaudo && (
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] ${
                modoDoLaudo === 'profunda'
                  ? 'border-sky-200 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}>
                {modoDoLaudo === 'profunda' ? 'Auditoria profunda' : 'Análise rápida'}
              </span>
            )}
            {/* Colado no selo do modo: quem pagou o modo caro pergunta
                "o que isso me deu?" exatamente aqui. */}
            {modoDoLaudo === 'profunda' && <ChipGanhoProfunda result={result} />}
            {result.orgao_nome_fonte === 'ia' && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500"
                    title="O nome do comprador foi lido do texto do edital pela IA — confira contra o documento oficial.">
                órgão lido do edital
              </span>
            )}
          </div>

          {/* Indicadores compactos: as duas medidas que NÃO são o score */}
          <div className="flex shrink-0 gap-3">
            {/* ⚠️ ESTE CARTÃO IMPRIMIA UM NÚMERO QUE PODIA NÃO SER UMA MEDIDA.
                Havia três caminhos até ele e a tela mostrava os três igual:
                a IA devolveu a confiança; o backend derivou-a do score; ou
                não havia número nenhum e o frontend fabricava 60. Agora o
                terceiro caminho não existe, e o segundo diz o que é. */}
            {decision.confianca == null ? (
              <div className="min-w-[80px] rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-center">
                <p className="text-[13px] font-semibold leading-tight text-slate-400">
                  não<br />informada
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                  Confiança
                </p>
              </div>
            ) : (
            <div
              className="min-w-[80px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center"
              title={decision.confianca_informada
                ? 'O quanto a IA está segura desta decisão, com base na quantidade e qualidade das evidências encontradas no edital. Cai quando há lacunas ou fatores não confirmados — não é a mesma coisa que viabilidade.'
                : 'ESTIMADA: a análise não devolveu um valor de confiança, então ele foi derivado do score e ajustado por lacunas e cobertura. Não é uma leitura das evidências do edital — trate-o como ordem de grandeza, não como medida.'}
            >
              <p className="text-2xl font-semibold leading-none text-slate-900">{decision.confianca}%</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                {decision.confianca_informada ? 'Confiança' : 'Confiança est.'}
                <CircleHelp size={10} className="shrink-0 opacity-70" />
              </p>
              {/* ⚠️ A BARRA MOSTRAVA A ESCALA ERRADA. O número vem de
                  `_calcular_confianca`, que termina em
                  `_clamp_int(base, minimo=35, maximo=95)` — a faixa útil é
                  35–95, não 0–100. Desenhar `width: 35%` numa trilha de 0–100
                  pinta um terço cheio quando 35 significa exatamente o
                  contrário: é o PISO, o mínimo que este indicador consegue
                  dizer. A pior análise possível parecia "um terço confiante".
                  Aqui a barra é normalizada para a faixa real: 35 esvazia, 95
                  enche. O número exibido não muda — quem estava errada era a
                  régua embaixo dele. */}
              {(() => {
                const PISO = 35, TETO = 95;
                const bruto = Number(decision.confianca);
                const preenchido = Number.isFinite(bruto)
                  ? Math.max(0, Math.min(100, ((bruto - PISO) / (TETO - PISO)) * 100))
                  : 0;
                return (
                  <div
                    className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200"
                    title={`Escala de ${PISO}% a ${TETO}% — ${PISO}% é o mínimo que este indicador expressa.`}
                  >
                    <div className={`h-full rounded-full ${decision.confianca_informada ? 'bg-slate-500' : 'bg-slate-300'}`} style={{ width: `${preenchido}%` }} />
                  </div>
                );
              })()}
            </div>
            )}
            {typeof result.qualidade_extracao?.cobertura_pct === 'number' && (
              <div
                className="min-w-[80px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center"
                title={
                  `Percentual de campos críticos do edital (objeto, valores, prazos, garantias etc.) que a IA conseguiu localizar para basear a análise. ${
                    result.qualidade_extracao.campos_faltantes?.length
                      ? `Não localizados: ${result.qualidade_extracao.campos_faltantes.join(', ')}`
                      : 'Todos os campos críticos foram localizados no material.'
                  }`
                }
              >
                {/* ⚠️ ESTE NÚMERO ERA PINTADO POR CORTES PRÓPRIOS (75/45), em
                    verde, âmbar ou vermelho. Era mais uma régua a colorir o
                    ecrã por conta própria — e o âmbar dela ficava ao lado do
                    âmbar de "condicionado", "urgente" e "risco médio", a
                    significar outra coisa. Cobertura baixa continua sinalizada,
                    mas onde ela é acionável: na linha de estado do "O Que Esta
                    Análise Avaliou". */}
                <p className="text-2xl font-semibold leading-none text-slate-900">
                  {result.qualidade_extracao.cobertura_pct}%
                </p>
                <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                  Cobertura
                  <CircleHelp size={10} className="shrink-0 opacity-70" />
                </p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-500"
                    style={{ width: `${result.qualidade_extracao.cobertura_pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Definições das três métricas — acessíveis no TOQUE, não só no hover.
            Os textos são os mesmos dos tooltips acima, mas `title=` não existe
            em celular/tablet — e estas são exatamente as três medidas que o
            leitor precisa distinguir (viabilidade ≠ confiança ≠ cobertura). */}
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400 transition-colors hover:text-slate-600 [&::-webkit-details-marker]:hidden">
            <CircleHelp size={11} className="shrink-0" />
            O que significam Viabilidade, Confiança e Cobertura?
            <span className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-2 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] font-medium leading-relaxed text-slate-600 md:grid-cols-3">
            <p>
              <strong className="text-slate-800">Viabilidade ({result.score}/100)</strong> — o quanto vale a pena
              participar, somando os critérios técnicos, financeiros, jurídicos e de documentação. A conta
              completa está em &ldquo;Composição do Score&rdquo;.
            </p>
            <p>
              <strong className="text-slate-800">
                Confiança {decision.confianca == null ? '(não informada)' : `(${decision.confianca}%${decision.confianca_informada ? '' : ', estimada'})`}
              </strong> — o quanto a IA está segura <em>desta decisão</em>, pela quantidade e qualidade das evidências
              encontradas. Cai quando há lacunas no material — não é a mesma coisa que viabilidade.
              {decision.confianca != null && !decision.confianca_informada && (
                <> <span className="text-slate-500">Nesta análise o valor foi <strong>derivado do score</strong> e ajustado
                por lacunas e cobertura, porque a leitura não devolveu um número próprio.</span></>
              )}
            </p>
            <p>
              <strong className="text-slate-800">
                Cobertura{typeof result.qualidade_extracao?.cobertura_pct === 'number' ? ` (${result.qualidade_extracao.cobertura_pct}%)` : ''}
              </strong> — percentual dos campos críticos do edital (objeto, valores, prazos, garantias…) que foram
              localizados para basear a análise.
              {result.qualidade_extracao?.campos_faltantes?.length
                ? <> Não localizados: {result.qualidade_extracao.campos_faltantes.join(', ')}.</>
                : null}
            </p>
          </div>
        </details>

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Síntese do veredito</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">{summaryText}</p>
          {/* ⚠️ O PRIMEIRO IMPEDIMENTO JÁ ESTÁ NO TOPO DA TELA.
              `VereditoTopo` mostra `impeditivos[0]` como o porquê do veredito,
              e esta lista começava por ele — a mesma frase, palavra por
              palavra, duas vezes na mesma dobra. Aqui ficam os RESTANTES; se
              não houver mais nenhum, o bloco some em vez de repetir. */}
          {decision.veredito === 'NO_GO' && blockersRestantes.length > 0 && (
            <div className="mt-3 border-t border-red-200/60 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-red-600">
                {blockers.length > 1 ? 'Os outros impedimentos' : 'Motivo exato do No-Go'}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {blockersRestantes.slice(0, 3).map((item, i) => (
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
                  className="mt-3 text-[11px] font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                >
                  Ver o trecho do edital que comprova isso ↓
                </button>
              )}
            </div>
          )}
        </div>

        {naoDevolvido.length > 0 && (
          <p className="mt-5 border-t border-slate-100 pt-3 text-[11px] font-medium leading-relaxed text-slate-400">
            Esta leitura não devolveu {naoDevolvido.join(', ')}. Campo em branco aqui significa que a análise não se
            pronunciou — não que tenha verificado e nada encontrado.
          </p>
        )}

        {/* ── Aderência ao negócio ──────────────────────────────────────── */}
        {businessFit && (
          <div className={`mt-5 rounded-2xl border px-5 py-4 ${businessFit.shell}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
                  <Settings2 size={14} className={businessFit.icon} />
                  Aderência ao negócio
                </p>
                <p className="mt-2 text-sm font-semibold leading-snug text-slate-900">{businessFit.label}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">{businessFit.description}</p>
              </div>
              <div className="shrink-0 rounded-xl border border-white/70 bg-white/75 px-3 py-2 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">Match CNAE</p>
                {businessFit.score == null ? (
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.09em] leading-none text-slate-400">
                    não medido
                  </p>
                ) : (
                  <p className={`mt-1 text-lg font-semibold leading-none ${businessFit.text}`}>{businessFit.score}/100</p>
                )}
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
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500 hover:text-slate-700">
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
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
            <ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" />
            Ver evidências, impedimentos, lacunas e base da confiança
          </summary>

        {/* ── Evidências ────────────────────────────────────────────────── */}
        {evidenceItems.length > 0 && (
          <div id="veredito-evidencias" className="mt-3 scroll-mt-24 rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4">
            <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
              <Shield size={14} className={verdict.text} />
              Por que a decisão é segura
            </p>
            <Timeline
              items={evidenceItems.map((evidence, index) => ({
                key: `${evidence.titulo}-${index}`,
                tone: 'slate',
                icon: <span className="text-[10px] font-semibold">{index + 1}</span>,
                eyebrow: evidence.categoria || 'Evidência',
                // Evidência sem referência E sem fonte é afirmação sem lastro
                // verificável. Antes o badge simplesmente sumia e ela ficava
                // indistinguível das citadas — o analista precisa ver de longe
                // o que pode conferir em 30s e o que é palavra da IA.
                badge: (evidence.referencia || evidence.fonte)
                  ? { label: evidence.referencia || evidence.fonte, tone: 'slate' }
                  : { label: 'sem citação verificada', tone: 'amber' },
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
            <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
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
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
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
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
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
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
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

/* ─── O endereço das ações ────────────────────────────────────────────────
 *
 * ⚠️ O PLANO DE AÇÃO DIZIA O QUÊ E NUNCA O ONDE.
 *
 * A linha que a IA escreve é do tipo "Protocolar pedido de esclarecimento ou
 * impugnação sobre anexos, itens, preços unitários, critérios e penalidades"
 * — cinco categorias, nenhuma nomeada, sem data e sem caminho. Enquanto
 * isso, duas abas antes, o mesmo laudo já sabe:
 *
 *   · QUAIS cláusulas — cada `red_flag` traz `acao_sugerida`
 *     ('impugnar' | 'esclarecer'), o `trecho` literal do edital, a
 *     `base_legal` e a `sumula_tcu` quando o padrão bate com a jurisprudência;
 *   · ATÉ QUANDO — `prazo_impugnacao_calculado` traz a data, a base legal
 *     (art. 164, I) e se ela DIVERGE da que o edital declara;
 *   · COMO — o backend redige a peça em `POST /api/gerar-impugnacao`.
 *
 * ⚠️ ESTE BLOCO NÃO TENTA ADIVINHAR A QUAL AÇÃO ELE PERTENCE. A tentação era
 * casar o texto da ação por palavra-chave ("impugna", "esclarec") e pendurar
 * o endereço na linha certa. Isso seria uma heurística sobre texto livre de
 * modelo, a errar nos dois sentidos. As cláusulas marcadas para impugnar
 * estão marcadas independentemente do que a IA escreveu no plano — então elas
 * viram um bloco próprio, sempre verdadeiro, logo abaixo das ações.
 */
function EnderecoDasAcoes({
  result,
  onGerarImpugnacao,
  gerandoImpugnacao,
}: {
  result: AnalysisResult;
  onGerarImpugnacao?: (riscos: Array<{ titulo: string; descricao: string }>) => void;
  gerandoImpugnacao?: boolean;
}) {
  const flags = result.red_flags || [];
  const aImpugnar = flags.filter((f) => f.acao_sugerida === 'impugnar');
  const aEsclarecer = flags.filter((f) => f.acao_sugerida === 'esclarecer');
  const alvos = [...aImpugnar, ...aEsclarecer];
  if (alvos.length === 0) return null;

  const prazo = result.prazo_impugnacao_calculado;
  const podeGerar = Boolean(onGerarImpugnacao) && aImpugnar.length > 0;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
        Sobre o que impugnar ou pedir esclarecimento
      </p>
      <p className="mt-1 text-[12px] font-medium leading-relaxed text-slate-400">
        As cláusulas que a varredura marcou, com o trecho do edital que as sustenta.
      </p>

      <ul className="mt-4 space-y-3.5">
        {alvos.map((flag, i) => (
          <li key={i} className="border-l-2 border-slate-200 pl-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] ${
                flag.acao_sugerida === 'impugnar'
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
              }`}>
                {flag.acao_sugerida === 'impugnar' ? 'Impugnar' : 'Esclarecer'}
              </span>
              {flag.base_legal && (
                <span className="font-mono text-[11px] text-slate-400">{flag.base_legal}</span>
              )}
            </div>
            <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-700">{flag.descricao}</p>
            {flag.trecho && (
              <p className="mt-1.5 border-l border-slate-200 pl-2.5 font-mono text-[11px] leading-relaxed text-slate-400">
                &ldquo;{flag.trecho}&rdquo;
              </p>
            )}
            {flag.sumula_tcu?.referencia && (
              <p className="mt-1.5 font-mono text-[11px] text-slate-400">
                {flag.sumula_tcu.referencia}
              </p>
            )}
          </li>
        ))}
      </ul>

      {prazo?.data_iso && (
        <div className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-3.5">
          <Clock size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <p className="text-[12px] font-medium leading-relaxed text-slate-500">
            <strong className="font-semibold text-slate-700">
              Protocolar até {formatarDataCritica(prazo.data_iso)}
            </strong>
            {prazo.base_legal ? ` · ${prazo.base_legal}` : ''}
            {/* `origem: 'divergente'` significa que a data calculada por lei NÃO
                é a que o edital declara. Omitir isso aqui, na linha em que a
                pessoa vai marcar a agenda, seria esconder o conflito no
                momento em que ele custa caro. */}
            {prazo.origem === 'divergente' && (
              <span className="mt-1 block text-amber-700">
                Esta data diverge da declarada no edital — {prazo.mensagem}
              </span>
            )}
          </p>
        </div>
      )}

      {podeGerar ? (
        <button
          type="button"
          disabled={gerandoImpugnacao}
          onClick={() =>
            onGerarImpugnacao!(
              aImpugnar.map((f) => ({
                titulo: f.tipo_label || f.tipo || 'Cláusula restritiva',
                descricao: [f.descricao, f.trecho ? `Trecho do edital: "${f.trecho}"` : '']
                  .filter(Boolean)
                  .join(' '),
              })),
            )
          }
          className="mt-4 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {gerandoImpugnacao ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Redigindo a peça…
            </>
          ) : (
            <>
              <Scale size={14} />
              Gerar peça de impugnação
            </>
          )}
        </button>
      ) : aImpugnar.length > 0 ? (
        /* Sem o texto do edital carregado não dá para redigir — o endpoint
           precisa dele. Dizer isso é melhor do que esconder a existência da
           ferramenta ou oferecer um botão que volta 400. */
        <p className="mt-4 border-t border-slate-100 pt-3.5 text-[12px] font-medium leading-relaxed text-slate-400">
          A Bawzi redige a peça de impugnação a partir do texto do edital. Este laudo foi aberto do histórico, sem o
          texto carregado — abra o edital numa análise nova para gerar a peça.
        </p>
      ) : null}

      <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-400">
        A peça sai como minuta de trabalho: não é parecer jurídico e deve ser revista por advogado habilitado antes
        do protocolo.
      </p>
    </div>
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
  const pncpEditalUrl = buildPncpEditalUrl(result);
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
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
              <History size={14} />
              Monitor PNCP e versões
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Validade contínua da decisão</h3>
          </div>
          <div className="flex items-center gap-2">
            {pncpEditalUrl && (
              <a
                href={pncpEditalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50"
              >
                <ExternalLink size={14} />
                Ver edital no PNCP
              </a>
            )}
            <button
              type="button"
              onClick={checkPncp}
              disabled={!hasPncpRef || !token || !analysisId || isChecking}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isChecking ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Verificar PNCP
            </button>
          </div>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">Linha do tempo da decisão</p>
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
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] ${
                          entry.kind === 'event' ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                        }`}>
                          {entry.kind === 'event' ? 'Mudança PNCP' : 'Revisão'}
                        </span>
                        <p className="mt-2 text-sm font-semibold leading-snug text-slate-900">
                          {String(entry.item.titulo || entry.item.title || 'Versão registrada')}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                          {String(entry.item.descricao || entry.item.conteudo || entry.item.previous_decision || 'Decisão atualizada.')}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                        {formatVersionDate(entry.item.created_at)}
                      </span>
                    </div>
                    {entry.kind === 'event' && (
                      <button
                        type="button"
                        onClick={() => reviewFromEvent(entry.item, entry.index)}
                        disabled={!token || reviewingIndex !== null}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-700 transition-all hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">Snapshot oficial</p>
            {files.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-500">
                Nenhum arquivo oficial salvo no snapshot atual.
              </div>
            ) : files.slice(0, 5).map((file, index) => (
              <div key={`${file.link || file.titulo || index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800">{String(file.titulo || 'Arquivo oficial')}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em]">{label}</p>
      </div>
      <p className="break-words text-sm font-semibold leading-snug text-slate-900">{value}</p>
    </div>
  );
}

/* O tipo local `DecisionCockpitTask` saiu junto com o construtor duplicado.
 * O contrato agora é `DecisionQueueTask` (`lib/decisionQueue`), um só para as
 * duas telas — dois tipos estruturalmente iguais para o mesmo dado é como as
 * duas implementações conseguiram divergir sem o compilador reclamar. */

/* ─── Cockpit: o laudo MOSTRA o plano, a Gestão EXECUTA ──────────────────────
 *
 * Decisão de produto do dono: a edição sai daqui.
 *
 * O que havia: duas superfícies de edição para o mesmo `cockpit_status` — esta
 * e o painel Gestão. Duas telas gravando o mesmo campo, com dois construtores
 * de tarefa diferentes (ver comentário em `lib/decisionQueue`), e a própria
 * tela sem saber explicar onde o dado morava: o subtítulo dizia "registrados
 * em Gestão" e a linha três centímetros abaixo dizia "salvos no histórico
 * desta análise". A primeira era falsa para quem não é Nível 4.
 *
 * O que fica: o laudo mostra o plano INTEIRO, em leitura, ancorado na
 * evidência que o gerou — que é a razão de o plano nascer aqui e não numa
 * lista solta. Responsável, prazo, nota e conclusão passam a existir só na
 * Gestão, que é quem tem o que o laudo nunca vai ter: visão entre editais,
 * filtros e prazos comparáveis.
 *
 * Por que não esconder o plano de quem não tem Nível 4: o plano é entrega da
 * análise, que a pessoa pagou. O que é Nível 4 é GERENCIAR o plano. Mostrar e
 * bloquear a gestão é a linha honesta; esconder seria cobrar por um laudo
 * incompleto. */
function DecisionCockpit({
  result,
  analysisId,
  // `token` continua aqui: o toggle "+ Gestão" é a única ação que sobrou nesta
  // tela e precisa saber se há sessão. `onStatusChange` saiu — nada mais grava
  // `cockpit_status` a partir do laudo.
  token,
  tracked,
  trackSaving,
  onToggleTracking,
  onGoToGestao,
}: {
  result: AnalysisResult;
  analysisId: string | null;
  token: string | null;
  tracked: boolean;
  trackSaving: boolean;
  onToggleTracking: () => void;
  /** `taskId` opcional: abre a Gestão JÁ com esse passo aberto para edição. */
  onGoToGestao: (taskId?: string) => void;
}) {
  const decision = normalizeDecision(result);
  const verdict = decisionUi[decision.veredito];
  // MESMO construtor que a Gestão usa. Era uma cópia local que divergia em três
  // pontos — e como o `id` da tarefa é a chave do `cockpit_status`, divergir
  // significava as duas telas contando progressos diferentes do mesmo edital.
  const tasks = useMemo(
    () => buildDecisionQueueTasks(result as unknown as SavedAnalysis),
    [result],
  );
  const [statusMap, setStatusMap] = useState<NonNullable<AnalysisResult['cockpit_status']>>(() => normalizeCockpitStatus(result.cockpit_status));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => {
    setStatusMap(normalizeCockpitStatus(result.cockpit_status));
  }, [result.cockpit_status, analysisId]);

  /* ⚠️ ISTO ERA `return null` — O COCKPIT SUMIA SEM DIZER NADA.
     Nunca acontecia na prática, porque a fila era preenchida com o checklist
     padrão da casa sempre que o laudo não trouxesse ações. Com essa injeção
     removida (ver `lib/decisionQueue`), o estado vazio passou a ser real e
     precisa ser dito: sumir em silêncio faria a pessoa procurar um plano que
     a análise não escreveu. */
  if (!tasks.length) {
    return (
      <section className="mb-8 rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 md:p-8 print:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
          Plano de execução
        </p>
        <p className="mt-2 max-w-[60ch] text-sm font-medium leading-relaxed text-slate-500">
          Esta análise não produziu próximas ações para este edital. A fila fica vazia de propósito — o plano
          genérico que aparecia aqui não vinha da leitura do documento, e marcá-lo como concluído media execução
          de um trabalho que ninguém definiu.
        </p>
        <button
          type="button"
          onClick={() => onGoToGestao()}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
        >
          <Plus size={14} />
          Criar a primeira tarefa na Gestão
        </button>
      </section>
    );
  }

  const completed = tasks.filter((task) => statusMap[task.id]?.done).length;
  const progress = Math.round((completed / tasks.length) * 100);

  // ⚠️ "SUGERIDO" NÃO É "DEFINIDO", E A TELA NÃO DIZIA A DIFERENÇA.
  // O responsável e o prazo que aparecem em cada linha vêm de `task.*`, ou
  // seja, do que a ANÁLISE propôs (com direito a padrão fixo — "Licitações",
  // "Hoje", em `lib/decisionQueue`). O que a pessoa realmente assumiu vive em
  // `cockpit_status`, gravado pelo painel Gestão. Os dois eram renderizados
  // com o mesmo peso: quem lia "Diretoria / Licitações · HOJE" concluía, com
  // razão, que aquilo já estava atribuído — e o único aviso do contrário era
  // uma linha de 11px em cinza-claro no topo. Daqui para baixo as duas coisas
  // andam separadas: o que falta é contado, dito no cabeçalho e marcado na
  // própria linha.
  const semDefinicao = tasks.filter((task) => {
    const salvo = statusMap[task.id];
    return !salvo?.done && !(salvo?.responsavel && salvo?.prazo);
  }).length;

  const isNoGo = decision.veredito === 'NO_GO';
  const cockpitTitle = isNoGo ? 'Monitoramento pós-veredito' : 'Plano de execução';
  // Sem promessa sobre onde o dado mora: o subtítulo descreve o que a lista É.
  // Onde ela se acompanha está dito uma vez só, embaixo, e condicionado ao
  // estado real (marcado / não marcado / plano sem Gestão).
  const cockpitSubtitle = isNoGo
    ? 'Condições a acompanhar para revisar esta decisão'
    : 'Passos para protocolar a proposta';

  // Onde este edital está no ciclo de vida do negócio — antes vivia isolada
  // num card próprio (EsteiraCTA) logo abaixo deste, duplicando o mesmo botão
  // de "acompanhar em Gestão" que já existe aqui ao lado.
  const pipelineStages: { key: string; label: string; done?: boolean; active?: boolean }[] = isNoGo
    ? [
        { key: 'analise', label: 'Análise', done: true },
        { key: 'monitoramento', label: 'Monitoramento', active: true },
        { key: 'reanalise', label: 'Re-análise' },
      ]
    : [
        { key: 'analise', label: 'Análise', done: true },
        { key: 'habilitacao', label: 'Habilitação', active: true },
        { key: 'proposta', label: 'Proposta' },
        { key: 'disputa', label: 'Disputa' },
        { key: 'resultado', label: 'Resultado' },
      ];

  return (
    <section className="mb-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm print:hidden">
      {/* Cabeçalho */}
      <div id="cockpit-pos-veredito" className="scroll-mt-24 border-b border-slate-100 bg-slate-50/60 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
              <ClipboardList size={13} className={verdict.text} />
              {cockpitTitle}
            </p>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950">{cockpitSubtitle}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {isNoGo
                ? 'Acompanhe estas condições — quando mudarem, vale reprocessar a análise.'
                : 'Esta é a leitura do plano. Responsável, prazo e conclusão se preenchem no painel Gestão.'}
            </p>

            {/* Pipeline: onde este edital está no ciclo Análise → ... */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {pipelineStages.map((stage, i) => (
                <React.Fragment key={stage.key}>
                  {i > 0 && <ChevronRight size={11} className="flex-shrink-0 text-slate-300" />}
                  <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
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

            {/* Uma frase, e ela muda com o estado. Antes era fixa — mandava
                "Ative + Gestão" mesmo depois de ativado, com o "✓ Em Gestão"
                aceso ao lado, e prometia o painel a quem não tem Nível 4. */}
            <p className="mt-2.5 text-[11px] font-semibold text-slate-400">
              {tracked ? (
                // Com pendência, quem fala é a faixa âmbar logo abaixo — repetir
                // aqui, em cinza-claro, só enfraquecia as duas.
                semDefinicao === 0 ? (
                  <>
                    Em acompanhamento, com responsável e prazo definidos —{' '}
                    <button type="button" onClick={() => onGoToGestao()} className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
                      abrir no painel Gestão
                    </button>
                    .
                  </>
                ) : null
              ) : (
                // O rótulo citado aqui tem de ser o que está escrito no botão
                // ao lado: era "+ Gestão", virou "Acompanhar".
                <>
                  Toque em <strong className="text-slate-600">Acompanhar</strong> para definir responsável e prazo destes passos no{' '}
                  <button type="button" onClick={() => onGoToGestao()} className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
                    painel Gestão
                  </button>
                  .
                </>
              )}
            </p>
          </div>

          {/* Progresso + acompanhamento.
              ⚠️ ERAM TRÊS FAIXAS EMPILHADAS num cartão de 126px: o número, o
              "✓ Em Gestão" e o "VER NO PAINEL →". As duas últimas eram verdes,
              do mesmo tamanho, coladas — e faziam coisas opostas: a de cima
              REMOVE do acompanhamento, a de baixo navega. Duas ficaram uma. */}
          <div className={`shrink-0 w-[214px] overflow-hidden rounded-2xl border shadow-sm transition-all ${
            tracked ? 'border-emerald-200' : 'border-slate-200 bg-white'
          }`}>
            {/* Big progress number */}
            <div className={`px-5 pt-4 pb-3 text-center ${tracked ? 'bg-emerald-50' : ''}`}>
              <div className="flex items-baseline justify-center gap-1">
                <span className={`text-[2.5rem] font-semibold leading-none tabular-nums ${verdict.text}`}>{completed}</span>
                <span className="text-xl font-semibold text-slate-200">/{tasks.length}</span>
              </div>
              <div className="mx-auto mt-2.5 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all duration-500 ${verdict.bar}`} style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">concluídas</p>
            </div>

            {/* ⚠️ O "✓" SAIU, E ISSO É O PRINCIPAL. Um tique verde diz
                "concluído"; este botão, clicado, TIRA a análise do
                acompanhamento. Parecia selo de status passivo e era o
                controle destrutivo — a pior combinação possível.
                O alfinete é honesto (cheio = fixado) e o rótulo troca no
                hover, como um "seguindo → deixar de seguir": o estado fica
                visível, o efeito do clique fica descoberto antes do clique.

                ⚠️ E O DESTINO VOLTOU AO RÓTULO. Só "Acompanhar" / "Acompanhando"
                não dizia acompanhar ONDE nem adicionar A QUÊ — virava gerúndio
                solto embaixo de um contador. "em Gestão" é o substantivo que a
                pessoa reconhece (é o nome da aba), e o "+" no estado desligado
                é o que diz que existe algo a adicionar. Fora da Gestão este é
                o único chamado do painel — a faixa âmbar só aparece depois de
                acompanhar —, então ele é sólido, não discreto. */}
            <button
              type="button"
              onClick={onToggleTracking}
              disabled={!analysisId || !token || trackSaving}
              title={tracked
                ? 'Está sendo acompanhada em Gestão. Clique para remover do acompanhamento — o que já foi preenchido não se perde.'
                : 'Adicionar esta análise ao acompanhamento no painel Gestão'}
              className={`group flex w-full items-center justify-center gap-1.5 border-t px-3 py-2.5 text-center text-[10.5px] font-semibold leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                tracked
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
                  : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {trackSaving ? (
                <RefreshCw size={12} className="shrink-0 animate-spin" />
              ) : tracked ? (
                <>
                  <Pin size={12} className="shrink-0 fill-emerald-600 text-emerald-600 group-hover:hidden" />
                  <PinOff size={12} className="hidden shrink-0 group-hover:block" />
                </>
              ) : (
                <Plus size={13} strokeWidth={3} className="shrink-0" />
              )}
              {trackSaving ? (
                'Salvando'
              ) : tracked ? (
                <>
                  <span className="group-hover:hidden">Acompanhando em Gestão</span>
                  <span className="hidden group-hover:inline">Remover da Gestão</span>
                </>
              ) : (
                'Acompanhar em Gestão'
              )}
            </button>
            {/* ⚠️ O "VER NO PAINEL →" SAIU DAQUI porque já existia duas vezes:
                na faixa âmbar ("Definir no painel →") quando há o que
                preencher, e no texto do cabeçalho ("abrir no painel Gestão")
                quando não há. Um terceiro caminho para o mesmo lugar, colado
                num botão que faz o oposto, era o que embaralhava o cartão. */}
          </div>
        </div>

        {/* ⚠️ ISTO PRECISA PESAR MAIS QUE UMA NOTA DE RODAPÉ. "✓ Em Gestão"
            aceso, "Ver no painel →" ao lado e cada linha exibindo um nome e um
            prazo: tudo na tela dizia "já está resolvido". O que faltava — que
            aqueles valores são sugestão e ninguém assumiu nada ainda — era a
            informação mais apagada da página. Aqui ela é uma faixa, diz quantos
            faltam, e o botão leva direto ao lugar onde se resolve. */}
        {tracked && semDefinicao > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  {semDefinicao === tasks.length
                    ? `Falta definir responsável e prazo — ${tasks.length === 1 ? 'do item abaixo' : `dos ${tasks.length} itens abaixo`}`
                    : `Falta definir responsável e prazo em ${semDefinicao} de ${tasks.length} itens`}
                </p>
                <p className="mt-0.5 max-w-xl text-[11px] font-semibold leading-relaxed text-amber-800/80">
                  O nome e o prazo que aparecem em cada linha são sugestão da análise, não uma
                  atribuição. Quem assume, até quando e a conclusão se gravam no painel Gestão.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onGoToGestao()}
              className="shrink-0 rounded-xl bg-amber-600 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-white shadow-sm transition-colors hover:bg-amber-700 active:scale-[0.98]"
            >
              Definir no painel →
            </button>
          </div>
        )}

        {/* O banner de "salvando / salvo no histórico" saiu junto com a
            edição: não há mais nada a salvar nesta tela. */}
      </div>

      {/* Lista de tarefas — coluna única, numerada e conectada por uma linha
          vertical atrás dos marcadores, para reforçar a ordem de execução */}
      <div className="relative px-6">
        <div className="pointer-events-none absolute bottom-6 left-[34px] top-6 w-px bg-slate-200" aria-hidden="true" />
        {tasks.map((task, idx) => {
          const salvo = statusMap[task.id];
          const isDone = !!salvo?.done;
          const isOpen = expanded.has(task.id);
          const hasCustomData = !!(salvo?.responsavel || salvo?.prazo || salvo?.nota);

          // ⚠️ A LINHA MOSTRAVA SEMPRE A SUGESTÃO, mesmo depois de a pessoa
          // atribuir outro responsável na Gestão: o valor gravado só aparecia
          // dentro de "Detalhes". Quem trocasse "Licitações" por um nome via a
          // tela continuar dizendo "Licitações" e concluía que não tinha salvo.
          const faltaResponsavel = !salvo?.responsavel;
          const faltaPrazo = !salvo?.prazo;
          const responsavelMostrado = salvo?.responsavel || task.responsavel;
          const prazoMostrado = salvo?.prazo || task.prazo;
          const aDefinir = !isDone && (faltaResponsavel || faltaPrazo);
          const oQueFalta = faltaResponsavel && faltaPrazo
            ? 'responsável e prazo'
            : faltaResponsavel ? 'responsável' : 'prazo';
          return (
            <div key={task.id} className={`relative border-b border-slate-100 py-4 last:border-b-0 transition-all ${isDone ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4">

                {/* Número + marca de concluído. Era um checkbox clicável; agora
                    é indicador. Um checkbox que não marca nada seria pior que
                    nenhum — convida ao clique e não faz nada. */}
                <div className="relative z-10 flex shrink-0 flex-col items-center gap-1.5 rounded-full bg-white pt-0.5">
                  <span className={`text-[10px] font-semibold tabular-nums ${isDone ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span
                    title={isDone ? 'Concluída em Gestão' : 'Pendente'}
                    className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                      isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {isDone && <Check size={12} strokeWidth={3.5} />}
                  </span>
                </div>

                {/* Conteúdo */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] ${
                      task.prioridade === 'Alta'
                        ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
                        : task.prioridade === 'Média'
                          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                          : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
                    }`}>
                      {task.prioridade}
                    </span>
                    {/* ⚠️ TRACEJADO = PALPITE. Sólido = alguém escreveu. Era o
                        mesmo chip nos dois casos, e "AGORA" ou "HOJE" em caixa
                        alta tem cara de compromisso assumido mesmo quando não
                        passa de um padrão do construtor de tarefas. */}
                    <span
                      title={faltaPrazo
                        ? 'Prazo sugerido pela análise — ainda não confirmado no painel Gestão'
                        : 'Prazo definido no painel Gestão'}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] ${
                        faltaPrazo
                          ? 'border-dashed border-slate-300 bg-white text-slate-400'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Clock size={10} />
                      {prazoMostrado}
                    </span>

                    {/* Não é só um selo: é o caminho. Marca o que falta E leva
                        ao único lugar onde isso se preenche.
                        ⚠️ MINÚSCULA E SEM TRACKING, ao contrário dos vizinhos, e
                        de propósito: "ALTA" e "AGORA" são ESTADO, isto é AÇÃO —
                        gramática diferente para função diferente. Em caixa alta
                        e espaçado ficava mais largo e mais gritado que a própria
                        tarefa, e três linhas idênticas viravam ruído. O verbo
                        mora na faixa acima; aqui bastam o "+" e o que falta. */}
                    {aDefinir && (
                      <button
                        type="button"
                        onClick={() => onGoToGestao(task.id)}
                        title={`Abrir esta condição no painel Gestão para definir ${oQueFalta}`}
                        className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-amber-300 bg-amber-50/70 px-2 py-0.5 text-[10px] font-bold text-amber-700 transition-colors hover:border-amber-500 hover:bg-amber-100 hover:text-amber-900"
                      >
                        <Plus size={11} strokeWidth={3} />
                        {oQueFalta}
                      </button>
                    )}

                    {!aDefinir && hasCustomData && !isOpen && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-emerald-600 ring-1 ring-emerald-100">
                        ✓ Preenchido
                      </span>
                    )}

                  </div>

                  <p className={`text-sm font-semibold leading-snug ${isDone ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900'}`}>
                    {task.acao}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                    <strong
                      title={faltaResponsavel
                        ? 'Área sugerida pela análise — ainda sem responsável definido no painel Gestão'
                        : 'Responsável definido no painel Gestão'}
                      className={faltaResponsavel ? 'font-bold text-slate-400' : 'text-slate-700'}
                    >
                      {responsavelMostrado}
                    </strong>
                    {task.resultado_esperado ? ` — ${task.resultado_esperado}` : ''}
                  </p>
                  {task.impacto && (
                    <p className="mt-1 text-[11px] font-bold text-amber-700/80">⚠ {task.impacto}</p>
                  )}
                </div>

                {/* O botão só existe quando há o que abrir. Antes era fixo e
                    abria três campos vazios; agora abre o que a Gestão gravou —
                    sem dado gravado, não há detalhe, e um botão que abre um
                    painel vazio é só um clique perdido. */}
                {hasCustomData && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(task.id)}
                    className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
                  >
                    {isOpen ? '↑ Fechar' : '↓ Detalhes'}
                  </button>
                )}
              </div>

              {/* Painel de detalhes — LEITURA do que foi preenchido em Gestão */}
              {isOpen && hasCustomData && (
                <div className="ml-11 mt-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 pb-4 pt-3">
                  <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                    Preenchido no painel Gestão
                    <button
                      type="button"
                      onClick={() => onGoToGestao()}
                      className="font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
                    >
                      editar lá →
                    </button>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">Responsável</span>
                      <p className="text-xs font-bold text-slate-700">{statusMap[task.id]?.responsavel || task.responsavel}</p>
                    </div>
                    <div>
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">Prazo</span>
                      <p className="text-xs font-bold text-slate-700">{statusMap[task.id]?.prazo || task.prazo}</p>
                    </div>
                    {statusMap[task.id]?.nota && (
                      <div className="sm:col-span-2">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">Nota interna</span>
                        <p className="text-xs font-semibold leading-relaxed text-slate-600">{statusMap[task.id]?.nota}</p>
                      </div>
                    )}
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

/* `buildDecisionCockpitTasks` foi REMOVIDA daqui. Era a cópia local do
 * construtor de tarefas, e as duas versões produziam os `id`s que indexam o
 * `cockpit_status` gravado — divergir significava as duas telas lendo
 * progressos diferentes do mesmo edital. A versão canônica agora é
 * `buildDecisionQueueTasks`, em `lib/decisionQueue`, com as divergências
 * reconciliadas e o dedupe entre fontes. */

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

/* ⚠️ `DecisionMetric` FOI REMOVIDA: estava definida, tipada e nunca era
   renderizada em lado nenhum. Ficava ao lado de `VersionMetric`, que é usada,
   e a semelhança dos nomes fazia parecer que as duas serviam para alguma
   coisa. */

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

type CriterioAvaliado = NonNullable<AnalysisResult['avaliacao_parametros']>[number];

function normalizeBusinessFit(result: AnalysisResult) {
  const fit = result.aderencia_negocio;
  if (!fit) return null;

  // ⚠️ `?? 50` TRANSFORMAVA AUSÊNCIA EM MEDIÇÃO. Quando o backend não tinha o
  // que medir (`status: "nao_avaliado"`, `score: null`), este `??` fabricava 50
  // e a tela imprimia "Match CNAE — 50/100" em três lugares, com a mesma
  // tipografia de um número apurado. `null` aqui significa "não há medida", e
  // cada ponto de render decide como dizer isso — nunca como número.
  const score = fit.score == null ? null : clampPercent(fit.score);
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
    // ⚠️ NÃO É `indeterminado`. Ali houve comparação e ela ficou no meio; aqui
    // não houve comparação nenhuma. O rótulo precisa ser uma constatação sobre
    // a análise ("não foi avaliada"), não sobre o edital.
    nao_avaliado: {
      label: 'Aderência ao negócio não avaliada.',
      shell: 'border-slate-200 bg-slate-50',
      text: 'text-slate-700',
      icon: 'text-slate-500',
      fallback: 'Esta análise não comparou o objeto do edital com o CNAE/atividade da empresa. Confira o encaixe manualmente antes de decidir.',
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
  /** `null` = o laudo não traz confiança. Não existe número a desenhar. */
  confianca: number | null;
  /** `false` = o número acima foi derivado do score pelo backend, não lido do
   *  edital. A tela é obrigada a dizer isso onde o número aparece. */
  confianca_informada: boolean;
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

/* ⚠️ ESTA É A ÚNICA FONTE DE COR DO LAUDO.
 *
 * A cor sai de `decisao.veredito` e de mais nada. Não havia forma de manter
 * isto verdadeiro enquanto `getScoreBg`/`getScoreColor` pintavam a partir do
 * score em paralelo — por isso foram removidas de `analysis-types.ts`. Se
 * aparecer a necessidade de um novo tom, ele entra AQUI, como campo desta
 * tabela; uma segunda função que decide cor volta a criar o conflito. */
const decisionUi: Record<DecisionVerdict, {
  Icon: typeof ThumbsUp;
  shell: string;
  side: string;
  iconShell: string;
  text: string;
  /** Trilho vertical do veredito no topo do laudo. */
  rail: string;
  /** Verbo, não sigla: é o que a pessoa lê primeiro ao abrir o laudo. */
  rotuloCurto: string;
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
    rail: 'border-emerald-600',
    rotuloCurto: 'Participar',
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
    rail: 'border-amber-500',
    rotuloCurto: 'Participar com ressalva',
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
    rail: 'border-red-600',
    rotuloCurto: 'Não participar',
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

  /* ⚠️ ESTAS FRASES ERAM O PARÁGRAFO PRINCIPAL DO LAUDO, E AFIRMAVAM ACHADOS.
   *
   * A do NO_GO dizia "os riscos ou impeditivos detectados superam o retorno
   * provável" — uma conclusão sobre a relação risco/retorno DESTE edital,
   * escrita quando a leitura não devolveu resumo nenhum. A do GO prometia que
   * bastava "validação final de preço, prazo e documentação".
   *
   * Ficou só o que é verdade em qualquer caso: a repetição do veredito. A
   * segunda oração — a que afirmava um achado — saiu, e no lugar entra a
   * declaração de que não houve síntese. Quem quiser saber por quê tem as
   * evidências e os impedimentos logo abaixo, quando existirem. */
  const resumoPadrao: Record<DecisionVerdict, string> = {
    GO: 'A recomendação é participar. Esta leitura não devolveu uma síntese própria do porquê.',
    GO_CONDICIONADO: 'A recomendação é participar somente após validações. Esta leitura não devolveu uma síntese própria do porquê.',
    NO_GO: 'A recomendação é não participar agora. Esta leitura não devolveu uma síntese própria do porquê.',
  };
  // ⚠️ A LACUNA SÓ APARECIA QUANDO O BLOCO FALTAVA POR INTEIRO. Um bloco
  // presente com `status: "nao_avaliado"` calava a lacuna: a tela deixava de
  // avisar que a aderência não foi medida justamente no caso em que ela não foi.
  const _fitStatus = String(result.aderencia_negocio?.status || '');
  const _semAderenciaMedida = !result.aderencia_negocio
    || ['nao_avaliado', 'sem_cnae'].includes(_fitStatus);
  const fallbackLacunas = toDecisionTextList([
    _semAderenciaMedida ? 'Perfil/CNAE da empresa não disponível para medir aderência ao negócio.' : '',
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
    confianca: clampPercent(raw?.confianca),
    confianca_informada: raw?.confianca_informada !== false && raw?.confianca != null,
    resumo_decisao: shortenDecisionText(raw?.resumo_decisao || resumoPadrao[veredito], 430),
    motivos: baseReasons,
    condicoes_para_participar: condicoes.length
      ? condicoes
      : toDecisionTextList([
          ...semaforoCondicoes,
          ...(result.exigencias_criticas || []).slice(0, 3).map(textoDoItem),
          veredito !== 'NO_GO' ? 'Validar margem líquida e capital de giro antes do lance final.' : '',
        ], 6),
    impeditivos: impeditivos.length ? impeditivos : riscosAltos,
    proximas_acoes: (Array.isArray(raw?.proximas_acoes) ? raw!.proximas_acoes! : [])
      .map((action) => ({
        prazo: shortenDecisionText(action?.prazo, 40),
        acao: shortenDecisionText(action?.acao, 220),
        responsavel: shortenDecisionText(action?.responsavel, 80),
        resultado_esperado: shortenDecisionText(action?.resultado_esperado, 160),
      }))
      .filter((action) => action.acao)
      .slice(0, 5),
    perguntas_criticas: toDecisionTextList(raw?.perguntas_criticas, 5),
    decisao_executiva: shortenDecisionText(raw?.decisao_executiva || `${rotulos[veredito]} — ${resumoPadrao[veredito]}`, 340),
    evidencias: normalizeDecisionEvidences(raw?.evidencias, result),
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
): DecisionEvidenceUi[] {
  const rawItems = Array.isArray(raw) ? raw : [];
  const fallbackItems: DecisionEvidence[] = [
    // ⚠️ "Evidência" pressupõe que algo foi apurado. Com `nao_avaliado`/`sem_cnae`
    // o card entrava na lista de "Evidências que sustentam a decisão" carregando
    // a justificativa de que nada foi comparado — uma não-medição contada como
    // prova a favor.
    (result.aderencia_negocio
      && !['nao_avaliado', 'sem_cnae'].includes(String(result.aderencia_negocio.status || ''))) ? {
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
    /* ⚠️ AQUI OS MOTIVOS DA DECISÃO ENTRAVAM COMO EVIDÊNCIA DA DECISÃO.
     *
     * Era `...fallbackReasons.slice(0, 2).map(...)` com `fonte: 'Síntese
     * Bawzi'` e `impacto: 'Sustenta a recomendação executiva.'`: a conclusão
     * reapresentada, na secção "Por que a decisão é segura", como prova dela
     * mesma. Circular — e a única pista era a palavra "Síntese" no mesmo
     * campo `fonte` em que aparecem procedências reais ("CNAE / Perfil",
     * "Preço / Mercado"), ou seja, nenhuma pista.
     *
     * Motivo não é evidência. Os motivos continuam onde sempre estiveram, na
     * coluna "Motivos"; a lista de evidências fica menor quando não há prova —
     * que é a informação correta. */
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
  // ⚠️ EXISTIR O OBJETO NÃO É TER MEDIDO. `result.aderencia_negocio ? 'parcial'`
  // dava crédito parcial de confiança a um bloco cujo status é justamente
  // "nao_avaliado"/"sem_cnae" — ou seja, o vazio contava como meia confirmação e
  // subia a barra de confiança. Ausência de leitura entra como 'ausente'.
  const aderenciaMedida = Boolean(
    result.aderencia_negocio && !['nao_avaliado', 'sem_cnae'].includes(businessStatus)
  );
  const fallbackItems: DecisionConfidenceFactor[] = [
    {
      criterio: 'Aderência ao negócio',
      status: businessStatus === 'match_forte'
        ? 'confirmado'
        : businessStatus === 'sem_match'
          ? 'risco'
          : aderenciaMedida
            ? 'parcial'
            : 'ausente',
      // ⚠️ O literal antigo — "CNAE/perfil da empresa usado para medir match
      // com o edital" — AFIRMAVA que a medição aconteceu, e aparecia
      // justamente quando não havia justificativa nenhuma.
      detalhe: result.aderencia_negocio?.justificativa
        || (aderenciaMedida ? '' : 'A análise não comparou o objeto com o CNAE/perfil da empresa.'),
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
      // ⚠️ ERA `: 'parcial'`. "Parcial" é uma avaliação — diz que se mediu em
      // parte. Sem `financial_verdict` não se mediu nada, e o rótulo âmbar
      // "Parcial" ainda descontava 3 pontos da confiança no backend por uma
      // leitura que não existiu. Ausente é ausente.
      status: result.pricing_intelligence?.financial_verdict ? 'confirmado' : 'ausente',
      detalhe: result.pricing_intelligence?.financial_verdict
        || 'Esta análise não avaliou preço mínimo nem margem.',
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
      // ⚠️ ERA `|| 'parcial'`: um fator sem status vindo da IA virava a pílula
      // âmbar "Parcial", que o leitor lê como avaliação. Sem status não houve
      // avaliação — é ausência, não meia-confirmação.
      const status = String(item?.status || 'ausente').toLowerCase();
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

/** ⚠️ ESTA FUNÇÃO DEVOLVIA TRÊS TAREFAS INVENTADAS QUANDO O LAUDO NÃO TINHA
 *  NENHUMA — "Conferir requisitos eliminatórios…", "Calcular preço mínimo
 *  viável…", "Validar cláusulas jurídicas…" — cada uma com `prazo: 'Hoje'` e
 *  um responsável atribuído, no bloco intitulado "Próximas ações, em ordem".
 *
 *  Efeito colateral que ninguém tinha notado: como a lista nunca voltava
 *  vazia, o resumo da jornada dizia sempre "3 tarefa(s) a fazer — próxima:
 *  Conferir requisitos eliminatórios…", e o ramo honesto do
 *  `buildJourneySummary` ("Nenhuma ação registrada no plano.") era código
 *  inalcançável.
 *
 *  O laudo é superfície de LEITURA: aqui, lista vazia fica vazia. O checklist
 *  genérico continua a existir onde ele serve — na fila da Gestão, em
 *  `lib/decisionQueue`, marcado com `generico: true` e sem prazo. */
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

/** ⚠️ ESTA FUNÇÃO DEVOLVIA 60 PARA QUALQUER ENTRADA NÃO-NUMÉRICA.
 *  String vazia, `null`, objeto — tudo virava "60%" impresso no cartão
 *  "Confiança", indistinguível de uma medida. Agora devolve `null`, e quem
 *  chama decide como dizer que não há número. */
function clampPercent(value: unknown): number | null {
  const numeric = Number(value);
  if (value === null || value === undefined || value === '') return null;
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

/* ⚠️ `confidenceFallback` FOI REMOVIDA.
 *
 * Ela fabricava a confiança a partir do score — `score + 10` para GO,
 * `100 - score` para NO_GO — e o resultado saía no cartão "Confiança: N%",
 * sob um tooltip que afirma "com base na quantidade e qualidade das
 * evidências encontradas no edital". Nessa via a frase era falsa: o número
 * era o score reescalado, e nada dizia isso ao leitor.
 *
 * O backend também deriva quando a IA não devolve (`_calcular_confianca_decisao`),
 * mas agora declara: `decisao.confianca_informada`. Quando falta o número de
 * vez, a tela diz que falta — não inventa uma segunda derivação em cima da
 * primeira. */

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
// ─── Link para o edital original no portal do PNCP ───────────────────────────
// Só existe quando a análise partiu de uma busca no Radar PNCP (carrega
// cnpj/ano/sequencial do órgão) — análises por texto colado ou upload de PDF
// não têm essa referência e o link simplesmente não aparece.
function buildPncpEditalUrl(result: AnalysisResult): string | null {
  const ref = result.pncp_ref || {};
  const cnpj = String(ref.cnpj || result.pncp_cnpj || '').replace(/\D/g, '');
  const ano = String(ref.ano || result.pncp_ano || '').trim();
  const sequencialRaw = String(ref.sequencial || result.pncp_sequencial || '').trim();
  const sequencial = parseInt(sequencialRaw, 10);
  if (cnpj.length !== 14 || !ano || !sequencialRaw || !Number.isFinite(sequencial)) return null;
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`;
}

/** ⚠️ ESTA FUNÇÃO TINHA UM TERCEIRO CORTE, EM 40.
 *
 *  `normalizeDecision` corta em 70/45; `getScoreBg` cortava em 70/45 mas
 *  ignorando o veredito; e aqui o corte era 40. Um laudo sem `decisao.veredito`
 *  e com score 42 era GO_CONDICIONADO para a tela toda e NÃO era No-Go para
 *  esta função — que é quem desliga o simulador tático. Delegar a
 *  `normalizeDecision` deixa UMA regra a decidir, e ela é a mesma que pinta. */
function isNoGoVerdict(result: AnalysisResult): boolean {
  return normalizeDecision(result).veredito === 'NO_GO';
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

/* ⚠️ ISTO ERAM SETE PASSOS NUMERADOS (00 a 06), E A NUMERAÇÃO ERA FALSA.
 *
 * Numerar promete uma sequência, e ninguém percorre um laudo de ponta a ponta:
 * abre-se para responder uma pergunta e sai-se. A promessa custava caro — a
 * trilha exigia `min-w-[720px]` com rolagem horizontal, o que por sua vez
 * recortava o selo de plano superior (ver o comentário longo que morava em
 * `JourneyStepNav`), e o selo tinha de caber em 7px.
 *
 * O que mudou de facto, além do número:
 *   · "Panorama" só repetia o veredito e o resumo — foi absorvido por Decisão;
 *   · "Jurídico" era uma etapa própria para uma secção; cláusula abusiva e
 *     risco são a mesma conversa, e passaram a viver juntos em Riscos;
 *   · "Cockpit" chamava-se pelo nome interno; para quem usa, é a Ação.
 */
const JOURNEY_STEPS = [
  {
    key: 'decisao',
    label: 'Decisão',
    sublabel: 'Veredito, motivos e o que mudaria',
    icon: Target,
    tab: 'analise' as const,
    sectionId: 'section-decisao',
  },
  {
    key: 'aderencia',
    label: 'Aderência',
    sublabel: 'Score, critérios e dados extraídos',
    icon: SlidersHorizontal,
    tab: 'analise' as const,
    sectionId: 'section-aderencia',
  },
  {
    key: 'riscos',
    label: 'Riscos',
    sublabel: 'SWOT, irregularidades e parecer jurídico',
    icon: AlertTriangle,
    tab: 'analise' as const,
    sectionId: 'section-riscos',
  },
  {
    key: 'disputa',
    label: 'Disputa',
    sublabel: 'Concorrentes e inteligência de preço',
    icon: Radar,
    tab: 'concorrentes' as const,
    sectionId: null as string | null,
  },
  {
    key: 'acao',
    label: 'Ação',
    sublabel: 'Prazos, plano de execução e documentos',
    icon: ClipboardList,
    tab: 'analise' as const,
    sectionId: 'section-acao',
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

/* ─── Parecer jurídico: por que ele está (ou não está) no laudo ──────────────
 *
 * Três situações que a tela tratava como uma só, e que pedem reações OPOSTAS
 * do usuário:
 *
 *   presente      → o parecer existe. Mostra, e ponto.
 *   fora_do_plano → o backend nem chamou o Agente Jurídico. Reação: upgrade.
 *   nao_gerado    → o plano inclui, mas veio vazio. Reação: refazer/reclamar.
 *
 * Antes, as duas ausências diziam a MESMA frase — "Parecer jurídico não gerado
 * nesta análise" — que soa como falha da rodada. Quem está no Essencial lia
 * isso e concluía que o produto falhou, quando o parecer nunca esteve
 * contratado; quem está no Profissional lia a mesma frase numa falha real e
 * concluía que era normal. É o mesmo defeito já corrigido no
 * `concorrentes_diagnostico`: "não rodou" e "rodou e deu vazio" não podem
 * caber na mesma frase.
 *
 * ⚠️ A ORDEM IMPORTA: primeiro pergunta se o parecer EXISTE, só depois olha o
 * plano. O corte real do backend é `agent_count >= 3`, e o agent_count é
 * editável por tier no Admin (`config_atual.get("agent_count")`, elevado a 3
 * quando tier >= 3). Ou seja, o Admin PODE ligar o parecer num tier abaixo —
 * e a versão anterior, que decidia só por `userTier <= 2`, esconderia atrás
 * do cadeado um parecer que já foi gerado e pago. Decidir pelo dado que
 * chegou nunca fica dessincronizado de uma configuração de servidor. */
type StatusParecer = 'presente' | 'fora_do_plano' | 'nao_gerado';

/** Tier a partir do qual o backend roda o Agente Jurídico (agent_count >= 3).
 *  Espelha `tier_config.py`: 1 Gratuito e 2 Essencial ficam de fora; 3
 *  Profissional e 4 Avançado incluem. */
const TIER_MINIMO_PARECER = 3;

function statusDoParecer(result: AnalysisResult, userTier: number): StatusParecer {
  if (result.parecer_especialista) return 'presente';
  return userTier < TIER_MINIMO_PARECER ? 'fora_do_plano' : 'nao_gerado';
}

function buildJourneySummary(result: AnalysisResult, userTier: number): JourneySummaryItem[] {
  const decision = normalizeDecision(result);

  const veredito: JourneySummaryItem = {
    key: 'decisao',
    status: decision.veredito === 'GO' ? 'ok' : decision.veredito === 'NO_GO' ? 'alerta' : 'atencao',
    headline: `${decision.rotulo} — score ${result.score}/100.`,
  };

  const params = result.avaliacao_parametros || [];
  const contagem = contarCriterios(params);
  const { bloqueios, alertas: alertasParam, semStatus, semTrecho } = contagem;
  const criterios: JourneySummaryItem =
    params.length === 0
      ? { key: 'aderencia', status: 'pendente', headline: 'Nenhum critério personalizado avaliado nesta análise.' }
      : bloqueios.length > 0
        ? { key: 'aderencia', status: 'alerta', headline: `${bloqueios.length} critério(s) não atende(m) — ${bloqueios[0].nome}.` }
        : alertasParam.length > 0
          ? { key: 'aderencia', status: 'atencao', headline: `${alertasParam.length} critério(s) em atenção — ${alertasParam[0].nome}.` }
          // ⚠️ ANTES ESTE ERA O `else` FINAL: qualquer critério que não fosse
          // bloqueio nem alerta caía aqui e virava "Todos … são atendidos".
          // Status irreconhecível e "atende sem citação do edital" entravam
          // na frase como se tivessem sido conferidos.
          : semStatus.length > 0
            ? { key: 'aderencia', status: 'atencao', headline: `${semStatus.length} critério(s) sem avaliação legível — ${semStatus[0].nome}.` }
            : semTrecho.length > 0
              ? { key: 'aderencia', status: 'atencao', headline: `Critérios atendidos, mas ${semTrecho.length} sem trecho do edital que comprove.` }
              : todosOsCriteriosAtendidos(contagem)
                ? { key: 'aderencia', status: 'ok', headline: 'Todos os critérios configurados são atendidos.' }
                : { key: 'aderencia', status: 'pendente', headline: 'Critérios configurados sem resultado legível nesta análise.' };

  const riscos = result.risks || [];
  const riscosAltos = riscos.filter(r => r.impacto === 'alto');
  const flags = result.red_flags || [];
  const flagsAltas = flags.filter(f => f.gravidade === 'alta');
  const analise: JourneySummaryItem =
    riscosAltos.length > 0
      ? { key: 'riscos', status: 'alerta', headline: `${riscosAltos.length} risco(s) alto(s) — ${riscosAltos[0].titulo}.` }
      : flagsAltas.length > 0
        ? { key: 'riscos', status: 'alerta', headline: `${flagsAltas.length} red flag(s) de gravidade alta identificada(s).` }
        : (riscos.length > 0 || flags.length > 0)
          ? { key: 'riscos', status: 'atencao', headline: 'Riscos e pontos de atenção mapeados, nenhum de gravidade alta.' }
          : { key: 'riscos', status: 'ok', headline: 'Nenhum risco relevante identificado.' };

  /* ⚠️ "JURÍDICO" DEIXOU DE SER UMA LINHA À PARTE.
     Cláusula potencialmente abusiva é um risco, e era esquisito lê-la numa
     etapa separada da matriz de riscos — a pessoa tinha de juntar as duas
     metades da mesma conversa. A linha do jurídico passa a somar-se à de
     riscos, e o pior estado dos dois é o que a aba mostra. */
  const abusivas = flags.filter(f => classifyRedFlag(f).kind === 'abusividade');
  const statusParecer = statusDoParecer(result, userTier);
  const riscosComJuridico: JourneySummaryItem =
    abusivas.length > 0
      ? { key: 'riscos', status: 'alerta', headline: `${abusivas.length} cláusula(s) potencialmente abusiva(s) — além de ${analise.headline.charAt(0).toLowerCase()}${analise.headline.slice(1)}` }
      : analise.status === 'alerta' || analise.status === 'atencao'
        ? analise
        : statusParecer === 'presente'
          ? { key: 'riscos', status: analise.status, headline: `${analise.headline} Parecer jurídico sem apontamentos críticos.` }
          : statusParecer === 'fora_do_plano'
            ? { key: 'riscos', status: analise.status, headline: `${analise.headline} O parecer jurídico não está incluído no seu plano.` }
            : { key: 'riscos', status: analise.status, headline: `${analise.headline} Parecer jurídico não gerado nesta análise.` };

  const totalConcorrentes = (result.concorrentes_provaveis?.length || 0) + (result.concorrentes_regionais?.length || 0);
  const nivelAmeaca = result.pricing_intelligence?.nivelAmeaca;
  const concorrentes: JourneySummaryItem = nivelAmeaca
    ? {
        key: 'disputa',
        status: /alt/i.test(nivelAmeaca) ? 'alerta' : /m[ée]d/i.test(nivelAmeaca) ? 'atencao' : 'ok',
        headline: `Concorrência ${nivelAmeaca.toLowerCase()}${totalConcorrentes ? ` — ${totalConcorrentes} concorrente(s) mapeado(s)` : ''}.`,
      }
    : totalConcorrentes > 0
      ? { key: 'disputa', status: 'atencao', headline: `${totalConcorrentes} concorrente(s) mapeado(s) na região.` }
      : { key: 'disputa', status: 'pendente', headline: 'Nenhum concorrente identificado ainda.' };

  const acoes = decision.proximas_acoes;
  const cockpit: JourneySummaryItem =
    acoes.length > 0
      ? { key: 'acao', status: 'pendente', headline: `${acoes.length} tarefa(s) a fazer — próxima: ${acoes[0].acao}.` }
      : { key: 'acao', status: 'pendente', headline: 'Nenhuma ação registrada no plano.' };

  return [veredito, criterios, riscosComJuridico, concorrentes, cockpit];
}

/* ⚠️ `JourneySummary` FOI REMOVIDA. Era um cartão clicável que repetia o
   veredito e o score no topo do Panorama — a PRIMEIRA das três renderizações
   do mesmo dado. Com `VereditoTopo` acima das abas, ela passou a ser a mesma
   frase duas vezes na mesma dobra. */

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

function buildEscopoAnalise(result: AnalysisResult, userTier: number): ScopeRow[] {
  const rows: ScopeRow[] = [];

  // Semáforo de Viabilidade não entra mais aqui como linha de checklist: desde
  // que passou a ser exibido por inteiro logo no topo do Panorama (ver
  // JSX da etapa 00), uma linha resumindo-o de novo alguns parágrafos abaixo
  // seria a mesma informação duas vezes na mesma tela.

  // 1. Ficha técnica (extração de dados)
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
    stepKey: 'aderencia',
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
    stepKey: 'aderencia',
  });

  // 4. Critérios personalizados
  const params = result.avaliacao_parametros || [];
  // ⚠️ `params.length - bloqueios - alertasParam` era a conta de "atende(m)".
  // Todo status que a IA não devolvesse direito entrava aí como atendido.
  const cnt = contarCriterios(params);
  const partesContagem = [
    `${cnt.atende.length} atende(m)`,
    `${cnt.alertas.length} em atenção`,
    `${cnt.bloqueios.length} bloqueiam`,
    ...(cnt.semStatus.length ? [`${cnt.semStatus.length} sem avaliação legível`] : []),
    ...(cnt.semTrecho.length ? [`${cnt.semTrecho.length} sem trecho do edital`] : []),
  ];
  rows.push({
    key: 'criterios',
    Icon: SlidersHorizontal,
    label: 'Critérios Personalizados',
    status: params.length === 0
      ? 'pendente'
      : cnt.bloqueios.length > 0
        ? 'alerta'
        : (cnt.alertas.length > 0 || cnt.semStatus.length > 0 || cnt.semTrecho.length > 0)
          ? 'atencao'
          : 'ok',
    headline: params.length === 0
      ? 'Nenhum critério personalizado configurado (ative em Parametrização, no menu).'
      : `${params.length} critério(s) avaliado(s) — ${partesContagem.join(', ')}.`,
    stepKey: 'aderencia',
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
    stepKey: 'riscos',
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
    stepKey: 'riscos',
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
    stepKey: 'riscos',
  });

  // 8. Checklist de habilitação
  const habilitacao = result.habilitacao_checklist;
  const eliminatorias = (habilitacao || []).filter((h) => h.criticidade === 'eliminatoria').length;
  // ⚠️ "(0 eliminatória(s))" em verde era uma AFIRMAÇÃO sobre exigências que
  // ninguém classificou: `criticidade` ausente virava "comum" no backend. Só
  // dizemos "nenhuma eliminatória" quando todas foram de fato classificadas.
  const semCriticidade = (habilitacao || []).filter(
    (h) => h.criticidade_informada === false,
  ).length;
  rows.push({
    key: 'habilitacao',
    Icon: ListChecks,
    label: 'Checklist de Habilitação',
    status: !habilitacao || habilitacao.length === 0
      ? 'pendente'
      : (eliminatorias > 0 || semCriticidade > 0) ? 'atencao' : 'ok',
    headline: !habilitacao || habilitacao.length === 0
      ? 'Exigências de habilitação não identificadas de forma legível no material.'
      : semCriticidade > 0
        ? `${habilitacao.length} exigência(s) mapeada(s) — ${eliminatorias} eliminatória(s) e ${semCriticidade} sem criticidade classificada.`
        : `${habilitacao.length} exigência(s) mapeada(s) por categoria (${eliminatorias} eliminatória(s)).`,
    stepKey: 'riscos',
  });

  // 9. Matriz de risco formal (condicional — só grande vulto/contratação integrada)
  if (result.matriz_risco_formal?.itens?.length) {
    rows.push({
      key: 'matrizformal',
      Icon: Scale3d,
      label: 'Matriz de Risco Formal',
      status: 'ok',
      headline: `${result.matriz_risco_formal.itens.length} risco(s) formalmente alocado(s) entre contratante e contratada (Lei 14.133, art. 6º, XXVII).`,
      stepKey: 'riscos',
    });
  }

  // 10. Parecer técnico-jurídico
  // Esta seção se chama "O Que Esta Análise Avaliou" — é justamente onde a
  // diferença entre "não contratado" e "falhou" muda o que a pessoa faz a
  // seguir. Uma linha "pendente" idêntica para os dois casos transformava a
  // lista de escopo numa lista de defeitos.
  const statusParecerEscopo = statusDoParecer(result, userTier);
  rows.push({
    key: 'parecer',
    Icon: Scale,
    label: 'Parecer Técnico-Jurídico',
    status: statusParecerEscopo === 'presente' ? 'ok' : 'pendente',
    headline:
      statusParecerEscopo === 'presente'
        ? 'Parecer jurídico especializado gerado com base legal.'
        : statusParecerEscopo === 'fora_do_plano'
          ? 'Não incluído no seu plano — o Agente Jurídico roda a partir do Profissional.'
          : 'Parecer jurídico não gerado nesta análise.',
    stepKey: 'riscos',
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
      stepKey: 'decisao',
    });
  }

  // 12. Contexto do órgão comprador (condicional)
  if (result.orgao_risk || result.programa_integridade_obrigatorio?.exigido) {
    const partes: string[] = [];
    if (result.orgao_risk) partes.push(`CAPAG ${result.orgao_risk.classificacao}`);
    if (result.programa_integridade_obrigatorio?.exigido) partes.push('Programa de integridade exigido');
    // ⚠️ `status: 'ok'` ERA LITERAL. `SCOPE_STATUS_CFG.ok` pinta bolinha verde
    // com o rótulo "Sem pendência" — então "CAPAG D" (risco fiscal alto, órgão
    // que pode atrasar pagamento) aparecia como linha verde "Sem pendência",
    // ao lado do card vermelho que diz exatamente o contrário.
    const _capag = String(result.orgao_risk?.classificacao || '').trim().toUpperCase();
    const _capagRuim = _capag === 'C' || _capag === 'D';
    rows.push({
      key: 'orgao',
      Icon: Landmark,
      label: 'Contexto do Órgão Comprador',
      status: _capagRuim
        ? 'alerta'
        : result.programa_integridade_obrigatorio?.exigido ? 'atencao' : 'ok',
      headline: `${partes.join(' · ')}.`,
      stepKey: 'decisao',
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
    stepKey: 'disputa',
  });

  return rows;
}

function EscopoAnaliseSection({
  result,
  userTier,
  onStepClick,
}: {
  result: AnalysisResult;
  userTier: number;
  onStepClick: (step: JourneyStepType) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const rows = useMemo(() => buildEscopoAnalise(result, userTier), [result, userTier]);
  const okCount = rows.filter((r) => r.status === 'ok').length;

  // Agrupado pelas mesmas 5 etapas da jornada (Veredito, Critérios, SWOT &
  // Riscos, Jurídico, Concorrentes) — é o mesmo mapa da navegação acima, só
  // que em maior detalhe. Antes disto ser agrupado, as 13 linhas formavam uma
  // sequência plana sem relação visível com as etapas da jornada.
  const grouped = JOURNEY_STEPS
    .map((step) => ({ step, items: rows.filter((r) => r.stepKey === step.key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8">
      <SectionLabel icon={<ListOrdered size={18} className="text-slate-700" />} label="O Que Esta Análise Avaliou" />
      <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
        {rows.length} frentes verificadas pela IA para chegar ao veredito, agrupadas pelas etapas da jornada acima
        — {okCount} sem pendência. Clique numa linha para ver o motivo.
      </p>
      <div className="mt-4 space-y-5">
        {grouped.map(({ step, items }) => (
          <div key={step.key}>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
              <step.icon size={12} />
              {step.label}
            </p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {items.map((row) => {
                const cfg = SCOPE_STATUS_CFG[row.status];
                const isOpen = !!expanded[row.key];
                const hasExtra = Boolean(row.detail?.length);
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
                          <span className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] ${cfg.text}`}>
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
                    {isOpen && hasExtra && row.detail && row.detail.length > 0 && (
                      <div className="px-4 pb-4 pl-[2.1rem]">
                        <ul className="space-y-1.5">
                          {row.detail.map((d, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-slate-500">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onStepClick(step)}
              className="mt-2 text-[11px] font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-950"
            >
              Ver {step.label.toLowerCase()} completo →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ⚠️ `PersistentSummaryBar` FOI REMOVIDA — ver o comentário no corpo do
   componente principal. Era a terceira cópia do veredito, e existia só porque
   o veredito não estava fixo no topo. */

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
    step.key === 'disputa' && Math.max(getCachedTier(userTier), currentTier) < 2;

  /* ⚠️ O SELO DE PLANO SUPERIOR ERA UMA COROA DE 7px, e o próprio código
     admitia por escrito ser "mira difícil para o mouse e impossível no toque".
     Ele media 7px porque tinha de caber pendurado fora de um nó circular
     dentro de um contentor com rolagem horizontal, que o recortava. Sem a
     trilha e sem os nós, o aviso pode ser o que sempre devia ter sido: a
     palavra, legível, dentro do próprio botão. */
  return (
    <nav className="mb-8 border-b border-slate-200 print:hidden" aria-label="Secções do laudo">
      <div className="-mb-px flex flex-wrap items-end gap-x-1">
        {JOURNEY_STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = activeStep === step.key;
          const locked = isLocked(step);

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onStepClick(step)}
              aria-current={isActive ? 'page' : undefined}
              title={
                locked
                  ? `${step.label}: disponível no plano Essencial ou superior. Faça upgrade para desbloquear o radar de concorrentes.`
                  : `${step.label} — ${step.sublabel}`
              }
              className={`group flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'border-slate-900 font-semibold text-slate-900'
                  : 'border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <Icon
                size={15}
                className={isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}
              />
              {step.label}
              {locked && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500 ring-1 ring-slate-200">
                  Nível 2
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Identidade e veredito: os dois primeiros blocos do laudo ───────────────

/** Como este edital se chama para quem o abriu: número no PNCP e órgão
 *  comprador. Devolve `null` quando o documento não identifica nem um nem
 *  outro — caso em que a chamada mostra a frase honesta em vez de um vazio. */
function identidadeDoEdital(result: AnalysisResult): string | null {
  const partes: string[] = [];
  const ref = result.pncp_ref;
  const seq = ref?.sequencial || result.pncp_sequencial;
  const ano = ref?.ano || result.pncp_ano;
  if (seq && ano) partes.push(`PNCP ${seq}/${ano}`);
  if (result.orgao_nome) partes.push(result.orgao_nome);
  const uf = result.uf || result.estado;
  if (uf && result.orgao_nome) partes.push(uf);
  return partes.length ? partes.join(' · ') : null;
}

/** A resposta, em uma frase, na dobra.
 *
 *  ⚠️ Antes o veredito era renderizado em TRÊS sítios com formatos diferentes
 *  — `JourneySummary` (cartão clicável), `PersistentSummaryBar` (faixa com
 *  pílula) e `DecisionSnapshot` (bloco completo) — e nenhum deles aparecia
 *  antes dos 400px. Os dois primeiros deixaram de existir: com o veredito
 *  fixo no topo de todas as abas, repeti-lo era dizer a mesma coisa três
 *  vezes antes de qualquer conteúdo novo. */
function VereditoTopo({ result }: { result: AnalysisResult }) {
  const decision = normalizeDecision(result);
  const verdict = decisionUi[decision.veredito];

  // O "porquê" mais afiado depende do veredito: num No-Go é o impeditivo que
  // fecha a porta; num condicionado é a condição que falta cumprir; num GO é
  // o motivo que sustenta. Cair no resumo só quando nenhum dos três existe.
  const porque =
    (decision.veredito === 'NO_GO' ? decision.impeditivos[0] : '') ||
    (decision.veredito === 'GO_CONDICIONADO' ? decision.condicoes_para_participar[0] : '') ||
    decision.motivos[0] ||
    decision.resumo_decisao ||
    decision.decisao_executiva ||
    '';

  const score = typeof result.score === 'number' ? result.score : null;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));

  return (
    <div className={`flex flex-wrap items-start gap-x-8 gap-y-4 border-l-4 pl-5 ${verdict.rail}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-[28px] font-semibold leading-[1.05] tracking-tight md:text-[34px] ${verdict.text}`}>
          {verdict.rotuloCurto}
        </p>
        {porque && (
          <p className="mt-2 max-w-[52ch] text-sm font-medium leading-relaxed text-slate-700">
            {porque}
          </p>
        )}
      </div>

      {/* ⚠️ O NÚMERO É NEUTRO DE PROPÓSITO. Ele já teve cor própria, calculada
          por `getScoreColor` a partir de cortes que não eram os do veredito —
          era exatamente daí que vinha o laudo âmbar com pílula vermelha. */}
      {score != null && (
        <div className="shrink-0">
          <p className="text-2xl font-semibold leading-none tabular-nums text-slate-900">
            {score}
            <span className="text-sm font-medium text-slate-400">/100</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
            {result.score_limitado_por ? 'Viabilidade (teto)' : 'Viabilidade'}
          </p>
          <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-slate-200">
            {/* ⚠️ TETO NÃO SE DESENHA COMO MEDIDA. Quando o score foi cortado
                por regra, a barra vira tracejada: ela não representa quanto o
                edital vale, representa onde a régua parou. */}
            <div
              className={`h-full rounded-full ${result.score_limitado_por ? 'bg-slate-300' : 'bg-slate-900'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {result.score_limitado_por && (
            <p className="mt-1.5 max-w-[13rem] text-[11px] font-medium leading-relaxed text-slate-400">
              {result.score_limitado_por === 'sem_aderencia_cnae'
                ? 'Limitado por não haver aderência ao seu CNAE'
                : `Limitado por: ${String(result.score_limitado_por).toLowerCase()}`}
              {typeof result.score_original === 'number' && result.score_original !== score
                ? ` — a leitura do edital dava ${result.score_original}.`
                : '.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── HIERARQUIA TIPOGRÁFICA: TRÊS NÍVEIS, E SÓ TRÊS ──────────────────────
 *
 * ⚠️ ESTE FICHEIRO TINHA 113 ETIQUETAS ESCRITAS
 *     `text-[10px] font-black uppercase tracking-widest`
 * — o mesmo peso, o mesmo tamanho e a mesma caixa alta para tudo. Dentro do
 * `DecisionSnapshot` chegavam a aparecer nove iguais em sequência. Quando
 * tudo grita no mesmo tom não existe nível baixo, e o olho não sabe onde
 * parar; foi por isso que três mosaicos numéricos do mesmo tamanho (Score,
 * Confiança, Cobertura) precisaram de um `<details>` a explicar a confusão
 * que o próprio layout criava.
 *
 *   NÍVEL 1 · título de secção
 *       text-[15px] font-semibold tracking-tight text-slate-900
 *       Sem caixa alta. É `SectionLabel` e os títulos de `ChapterDivider`.
 *
 *   NÍVEL 2 · etiqueta de campo — O ÚNICO NÍVEL EM CAIXA ALTA
 *       text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500
 *
 *   NÍVEL 3 · procedência, citação, nota de rodapé
 *       text-[11px] font-medium text-slate-400  (ou `font-mono` quando é
 *       referência ao edital: "item 9.4.1, fl. 12")
 *
 * REGRA QUE IMPEDE A RECAÍDA: nunca dois rótulos de nível 2 adjacentes. Se
 * dois campos precisam de etiqueta lado a lado, ou viram uma linha de dados
 * (chave à esquerda, valor à direita) ou um deles não precisava de etiqueta.
 */

// ─── Label de secção reutilizável ─────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
      {icon}
      <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">{label}</h3>
    </div>
  );
}

// ─── Divisor de capítulo: agrupa sub-seções dentro de uma etapa que misturam
// tipos de conteúdo diferentes (dado bruto, critério, resultado), deixando
// explícito o que é cada bloco em vez de empilhar tudo com o mesmo peso visual.
function ChapterDivider({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[13px] font-semibold tracking-tight text-slate-700">
        <span className="tabular-nums text-slate-400">{index}</span> {title}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

/* ─── Capítulos de uma aba ────────────────────────────────────────────────
 *
 * ⚠️ NUMERAR À MÃO QUEBRA A NUMERAÇÃO. Os capítulos eram escritos com
 * `index={1}`, `index={2}`, `index={3}` fixos, mas cada um só aparece se o
 * laudo trouxer o dado — e um laudo sem ficha técnica exibia "2 · Critérios
 * aplicados" logo abaixo das abas, sem 1 nenhum. O leitor lê isso como
 * "faltou carregar alguma coisa".
 *
 * Aqui a aba declara os capítulos que PODE ter, cada um com a condição de
 * existir, e a numeração é atribuída depois da filtragem. Nunca há buraco.
 */
type Capitulo = { titulo: string; quando?: boolean; conteudo: React.ReactNode };

function Capitulos({ itens }: { itens: Capitulo[] }) {
  const vivos = itens.filter((c) => c.quando !== false);
  return (
    <>
      {vivos.map((c, i) => (
        <section key={c.titulo} className="space-y-4">
          <ChapterDivider index={i + 1} title={c.titulo} />
          {c.conteudo}
        </section>
      ))}
    </>
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
                    <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">{item.eyebrow}</span>
                  )}
                  {item.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] ${TIMELINE_BADGE_TONE[item.badge.tone]}`}>
                      {item.badge.label}
                    </span>
                  )}
                  {item.meta && <span className="ml-auto shrink-0 text-xs font-semibold text-slate-700">{item.meta}</span>}
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">{eyebrow}</p>
        <p className="mt-1.5 text-base font-semibold leading-snug text-slate-900">{headline}</p>
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
    // ⚠️ `new Date(iso) < agora` acendia o banner "Edital encerrado" às 21h do
    // dia ANTERIOR ao prazo (T00:00:00Z lido no fuso de Brasília). Um prazo
    // sem hora só vence no fim do dia — ver `instanteLimite`.
    return isChave && !isExcluido && dataCriticaExpirada(dc.data_iso, agora);
  }) ?? null;
}

// ─── Banner edital expirado ───────────────────────────────────────────────────

function ExpiredBanner({ result }: { result: AnalysisResult }) {
  const dataExpirada = getDataExpirada(result);
  if (!dataExpirada) return null;
  const formatted = formatarDataCritica(dataExpirada.data_iso, 'longo') ?? '—';
  return (
    <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3.5">
      <CalendarX size={20} className="shrink-0 text-slate-400" />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.09em]">Edital encerrado</span>
        <p className="text-sm font-medium text-slate-300 leading-snug mt-0.5">
          A <strong className="text-white">{dataExpirada.label}</strong> ocorreu em <strong className="text-white">{formatted}</strong>.{' '}
          <span className="text-slate-400">Análise disponível apenas para referência e estudo de mercado.</span>
        </p>
      </div>
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.09em] bg-slate-800 border border-slate-700 text-slate-400 px-2.5 py-1 rounded-full">
        Histórico
      </span>
    </div>
  );
}

// ─── Impeditivo: exclusividade ME/EPP × porte da empresa (LC 123/2006) ───────

/**
 * A camada de QA falhou — e o laudo saiu do jeito que o LLM escreveu.
 *
 * ⚠️ ESTE AVISO EXISTIA NO BACKEND E NÃO ERA RENDERIZADO POR NINGUÉM.
 * `analysis_quality.py` termina com um `except` que grava
 * `{qa_executado: false, qa_erro, aviso}` — e o texto do `aviso` é exato:
 * "Score, veredito e ficha técnica não foram validados — trate este laudo como
 * preliminar." Nenhum componente lia esses campos.
 *
 * O efeito é o pior caso da tese inteira: quando a rede de segurança cai, o
 * laudo sai com score e veredito CRUS do modelo, sem nenhuma trava de
 * congruência — e visualmente IDÊNTICO a um laudo validado. A ausência de toda
 * a validação era a ausência mais invisível do produto.
 */
function QaFalhouBanner({ result }: { result: AnalysisResult }) {
  const qa = result.qualidade_extracao;
  // `undefined` é laudo antigo/rápido, não falha — só `false` é falha.
  if (!qa || qa.qa_executado !== false) return null;
  return (
    <div className="mb-8 flex items-start gap-4 rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
        <AlertTriangle size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-amber-700">
          Laudo preliminar · validação automática não executada
        </span>
        <p className="mt-0.5 text-sm font-medium leading-snug text-amber-900">
          {qa.aviso
            || 'A camada determinística de qualidade não pôde ser aplicada nesta análise. Score, veredito e ficha técnica não foram validados — trate este laudo como preliminar.'}
        </p>
        <p className="mt-1.5 text-xs font-semibold text-amber-800">
          Reprocesse a análise antes de decidir com base neste laudo.
        </p>
      </div>
    </div>
  );
}

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
          <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-[0.09em]">Possível impeditivo · ME/EPP</span>
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
          <span className="text-[10px] font-semibold text-sky-600 uppercase tracking-[0.09em]">Cota reservada · ME/EPP</span>
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
              // Neutro de propósito: o score é uma das entradas da decisão,
              // não a decisão. Quem carrega a cor é o veredito, no topo.
              className={`transition-all duration-1000 ease-out ${isExpired ? 'stroke-slate-300' : 'stroke-slate-900'}`}
              strokeWidth="6" fill="none" strokeLinecap="round"
              style={{ strokeDasharray: 264, strokeDashoffset: 264 - (264 * result.score) / 100 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-semibold tracking-tighter leading-none ${isExpired ? 'text-slate-400' : 'text-slate-900'}`}>
              {result.score}
            </span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.09em] mb-1">Bawzi Score</p>
          {isExpired ? (
            <>
              <h3 className="text-lg font-semibold uppercase tracking-[0.09em] text-slate-400">
                Referência histórica
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-1 max-w-sm">
                Score de {result.score}/100 — edital já encerrado.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">
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
          const fmt = formatarDataCritica(dc.data_iso, 'curto') ?? dc.data_iso;
          const isPast = dataCriticaExpirada(dc.data_iso);
          // `dc.urgente` é congelado no instante da análise — na véspera da
          // sessão ele ainda diz `false`. Recomputado ao vivo.
          const urgenteAgora = !isPast && dataCriticaUrgente(dc.data_iso);
          return (
            <div key={i}>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400 flex items-center gap-1">
                {isPast
                  ? <CalendarX size={10} className="text-slate-400" />
                  : urgenteAgora ? <Zap size={10} className="text-red-500" /> : null
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
      {propValida && <div><span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-[0.09em]">Prazo de Propostas</span><span className={`text-sm font-bold flex items-center gap-1 ${isExpired ? 'text-slate-400 line-through' : 'text-slate-900'}`}><CalendarDays size={14} className="text-slate-400 shrink-0" /> {propValida}</span></div>}
      {impValida && <div><span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-[0.09em]">Limite Impugnação</span><span className={`text-sm font-bold flex items-center gap-1 ${isExpired ? 'text-slate-400 line-through' : 'text-slate-900'}`}><AlertCircle size={14} className={isExpired ? 'text-slate-400' : 'text-red-500'} /> {impValida}</span></div>}
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
                  <span className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] ${s.txt}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.lbl}
                  </span>
                </div>
                <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider">{label}</p>
                <p className="text-xs text-slate-600 font-medium leading-snug">{sinal.motivo}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5">
          <Sparkles size={28} className="shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Nova análise necessária</p>
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
            <p className={`text-[11px] font-semibold uppercase tracking-[0.09em] ${tom.txt}`}>
              CAPAG do órgão {capag.escopo === 'municipio' ? '(município)' : '(estado)'}
            </p>
          </div>
          <p className={`mt-2 text-2xl font-semibold ${tom.txt}`}>{capag.classificacao}</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{capag.descricao}</p>
          {/* A flag existia no backend e NENHUM componente a lia — a nota do
              estado era exibida como se fosse a da prefeitura compradora. */}
          {capag.substituicao_municipio && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800">
              Esta é a nota do <strong>estado</strong>, não da prefeitura compradora — o município
              não consta na tabela do Tesouro. A capacidade de pagamento de quem vai pagar
              permanece desconhecida.
            </p>
          )}
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{capag.fonte}</p>
        </div>
      )}
      {integridade?.exigido && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-sky-700" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-700">Programa de integridade</p>
          </div>
          <p className="mt-2 text-sm font-semibold text-sky-800">Exigido pela Lei 14.133/2021</p>
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
      (dc) => dc.data_iso && !dataCriticaExpirada(dc.data_iso, agora),
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
            <p className="text-sm font-semibold text-slate-700">Análise desatualizada</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">Esta análise foi gerada antes da atualização do cronograma. Execute uma nova análise para ativar os alertas de prazo automáticos.</p>
          </div>
        </div>
      ) : result.datas_criticas.length === 0 ? (
        <div className="mt-4 flex items-center gap-4 bg-amber-50 border border-dashed border-amber-200 rounded-xl p-5">
          <SearchX size={28} className="shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Datas não identificadas</p>
            <p className="text-xs text-amber-700 font-medium mt-0.5 leading-relaxed">O documento não continha datas de prazo explícitas. Consulte diretamente o edital para verificar os prazos de proposta e impugnação.</p>
          </div>
        </div>
      ) : (
        <div className="relative mt-2">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />
          <div className="space-y-4">
            {result.datas_criticas.map((dc, i) => {
              const formatted = formatarDataCritica(dc.data_iso, 'curto');
              const date = formatted ? dc.data_iso : null;
              const expirado = dataCriticaExpirada(dc.data_iso, agora);
              // ⚠️ `dc.urgente` vem CONGELADO do backend, calculado no dia da
              // análise. Um laudo gerado com 20 dias de antecedência guardava
              // `false` para sempre e o selo URGENTE nunca chegava a acender.
              const urgenteFuturo = !expirado && dataCriticaUrgente(dc.data_iso, agora);
              const hoje = venceHoje(dc.data_iso, agora);
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
                      <p className={`text-[11px] font-semibold uppercase tracking-[0.09em] ${
                        !date        ? 'text-slate-400' :
                        expirado     ? 'text-slate-400 line-through' :
                        urgenteFuturo? 'text-red-600' : 'text-slate-500'
                      }`}>{dc.label}</p>
                      {expirado    && <span className="text-[11px] font-semibold uppercase tracking-[0.09em] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">EXPIRADO</span>}
                      {hoje        && <span className="text-[11px] font-semibold uppercase tracking-[0.09em] bg-red-600 text-white px-2 py-0.5 rounded-full">VENCE HOJE</span>}
                      {urgenteFuturo && !hoje && <span className="text-[11px] font-semibold uppercase tracking-[0.09em] bg-red-500 text-white px-2 py-0.5 rounded-full">URGENTE</span>}
                    </div>
                    <p className={`text-sm font-bold mt-0.5 ${
                      !date    ? 'text-slate-400 italic' :
                      expirado ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}>{formatted ?? 'Data não informada no edital'}</p>
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
            <p className={`text-[11px] font-semibold uppercase tracking-[0.09em] ${result.prazo_impugnacao_calculado.origem === 'divergente' ? 'text-amber-700' : 'text-slate-500'}`}>
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
            <p className={`text-[11px] font-semibold uppercase tracking-[0.09em] ${result.validade_proposta_calculada.origem === 'nao_informado' ? 'text-amber-700' : 'text-slate-500'}`}>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
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
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Base de partida</span>
        <div className="flex-1 border-t border-dashed border-slate-200" />
        <span className="text-sm font-semibold text-slate-900">100</span>
      </div>
      <Timeline
        dense
        items={itens.map((item, i) => {
          const positivo = item.pontos > 0;
          // ⚠️ O FECHO ARITMÉTICO NÃO É UM FATOR, E NÃO PODE SER VERDE.
          // A última linha do breakdown existe só para a conta bater quando os
          // fatores declarados pela IA não somam o score final. Colorida por
          // sinal como as outras, um resíduo positivo aparecia como
          // "+24 Ajuste de calibração do motor" em verde — lido como pontos
          // devolvidos pelo motor, embaixo do subtítulo "Nota auditável".
          // O backend marca essa linha com `tipo: 'residuo'`; aqui ela fica em
          // tom neutro, com ou sem sinal positivo.
          const eResiduo = (item as { tipo?: string }).tipo === 'residuo';
          const tone: TimelineTone = eResiduo ? 'slate' : positivo ? 'emerald' : 'red';
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
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-300">Bawzi Score final</span>
        <div className="flex-1 border-t border-dashed border-slate-700" />
        <span className={`text-2xl font-semibold leading-none tabular-nums ${result.score >= 70 ? 'text-emerald-400' : result.score >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
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
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.09em] bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full">
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400 leading-tight">{item.campo}</p>
                {!ausente && item.fonte === 'verificado_texto' && (
                  <span className="flex items-center gap-0.5 shrink-0 text-[11px] font-semibold uppercase tracking-[0.09em] text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-600 mb-2 flex items-center gap-1.5">
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-amber-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={11} /> Garantia acima do teto legal
          </p>
          <div className="space-y-2">
            {result.garantias_alerta!.map((g, i) => (
              <p key={i} className="text-xs font-medium leading-relaxed text-amber-900/90">
                <strong className="font-semibold">{g.campo}:</strong> {g.mensagem}
              </p>
            ))}
          </div>
        </div>
      )}
      {result.valor_total_com_prorrogacao && (
        <div className="mt-4 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-700 mb-1.5 flex items-center gap-1.5">
            <TrendingUp size={11} /> Valor total estimado com prorrogação
          </p>
          <p className="text-sm font-semibold text-sky-900">
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-amber-700 mb-1.5 flex items-center gap-1.5">
            <AlertTriangle size={11} /> Prazo de entrega/execução apertado
          </p>
          <p className="text-xs font-medium leading-relaxed text-amber-900/90">{result.alerta_prazo_entrega.mensagem}</p>
        </div>
      )}
      {result.alerta_indice_reajuste && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-amber-700 mb-1.5 flex items-center gap-1.5">
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
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
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
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FileSearch size={16} className="text-slate-400" />
          Ficha técnica do edital
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
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
            <p className="text-sm font-semibold text-emerald-800">Varredura concluída sem indícios</p>
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
                      <strong className="font-semibold">{flag.sumula_tcu.referencia}:</strong> {flag.sumula_tcu.texto}
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

/**
 * Checklist de habilitação — com o botão que nunca existiu.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A TRAVA MAIS DURA DO MOTOR NUNCA DISPAROU
 * ═══════════════════════════════════════════════════════════════════════════
 * O backend está inteiro, e é bom:
 *
 *   · `analysis_quality.py` → `habilitacao_bloqueios()` lê `status_atendimento`;
 *   · uma exigência ELIMINATÓRIA marcada `nao_atendido` trava o score em 40 e
 *     força veredito NO-GO (o comentário lá chama isso de "a trava mais dura
 *     do motor" — e é: não vem de inferência da IA, vem de uma confirmação do
 *     usuário, o bloqueio mais objetivo que o laudo tem);
 *   · `PATCH /analyses/{id}/habilitacao` recebe a marcação, recalcula score,
 *     congruência e veredito, e grava.
 *
 * E a tela renderizava `exigencia` / `criticidade` / `dica` / `trecho` — sem
 * um único controle. `status_atendimento` não era lido por componente nenhum,
 * o endpoint não era chamado de lugar nenhum. Logo `habilitacao_bloqueios()`
 * devolvia sempre `[]`, o teto de 40 jamais era atingido, e TODO score saía
 * calculado como se a empresa cumprisse todas as exigências eliminatórias.
 *
 * A tela mostrava "3 eliminatórias" e não dava onde dizer "não tenho nenhuma
 * delas". É a versão mais cara da tese: aqui o dado que faltava não era da IA
 * nem de uma fonte externa — era do próprio usuário, e o produto não perguntava.
 */
const HABILITACAO_STATUS_CFG: Record<string, { label: string; anel: string; ativo: string }> = {
  atendido:     { label: 'Atendemos',     anel: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50', ativo: 'bg-emerald-600 border-emerald-600 text-white' },
  nao_atendido: { label: 'Não atendemos', anel: 'border-red-300 text-red-700 hover:bg-red-50',             ativo: 'bg-red-600 border-red-600 text-white' },
  nao_avaliado: { label: 'A verificar',   anel: 'border-slate-300 text-slate-500 hover:bg-slate-50',        ativo: 'bg-slate-600 border-slate-600 text-white' },
};

function HabilitacaoSection({
  result,
  analysisId,
  onAnalysisPatch,
}: {
  result: AnalysisResult;
  analysisId?: string | null;
  onAnalysisPatch?: (patch: Partial<AnalysisResult>) => void;
}) {
  const itens = result.habilitacao_checklist;
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const marcar = async (itemId: string, status: string) => {
    if (!analysisId || !itemId || salvando) return;
    setSalvando(itemId);
    setErroSalvar(null);
    try {
      const res = await apiFetch(`${API_URL}/api/analyses/${analysisId}/habilitacao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, status }),
      });
      // ⚠️ `res.ok` PRECISA SER CHECADO. Um 4xx/5xx com corpo JSON passaria
      // adiante e o `onAnalysisPatch` sobrescreveria o laudo com o payload de
      // erro — a marcação pareceria salva sem ter sido.
      if (!res.ok) throw new Error(String(res.status));
      const dados = await res.json();
      // O endpoint devolve score, classificação, breakdown e decisão
      // recalculados: sem propagá-los, a tela mostraria o item vermelho e o
      // score antigo verde lado a lado.
      onAnalysisPatch?.({
        habilitacao_checklist: dados.habilitacao_checklist,
        score: dados.score,
        classification: dados.classification,
        score_breakdown: dados.score_breakdown,
        decisao: dados.decisao,
      });
    } catch {
      setErroSalvar('Não foi possível salvar a marcação. Tente de novo.');
    } finally {
      setSalvando(null);
    }
  };

  if (itens === undefined) return null;

  if (itens.length === 0) {
    return (
      <div className="relative border border-slate-200 rounded-2xl p-8">
        <SectionLabel icon={<ListChecks size={18} className="text-slate-700" />} label="Checklist de Habilitação" />
        <div className="mt-2 flex items-center gap-4 bg-amber-50 border border-dashed border-amber-200 rounded-xl p-5">
          <SearchX size={28} className="shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Exigências não identificadas</p>
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
  const naoAtendidas = itens.filter(i => i.status_atendimento === 'nao_atendido').length;
  const aVerificar = itens.filter(i => (i.status_atendimento || 'nao_avaliado') === 'nao_avaliado').length;
  const podeMarcar = Boolean(analysisId) && itens.some(i => i.id);

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8">
      <div className="flex items-start justify-between gap-4">
        <SectionLabel icon={<ListChecks size={18} className="text-slate-700" />} label="Checklist de Habilitação" />
        {eliminatorias > 0 && (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.09em] bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full">
            {eliminatorias} eliminatória{eliminatorias > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 font-medium mt-1 mb-4">
        Exigências extraídas do edital por categoria — itens eliminatórios desclassificam a proposta se falharem.
        {podeMarcar && ' Marque o que a empresa atende: o score e o veredito são recalculados na hora.'}
      </p>
      {/* ⚠️ ENQUANTO NINGUÉM MARCA, O SCORE ASSUME QUE A EMPRESA ATENDE A
          TUDO. Esse era o estado permanente e invisível do produto. Agora ele
          é dito na cara, e some conforme o usuário responde. */}
      {podeMarcar && aVerificar > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs font-semibold leading-relaxed text-amber-900">
            {aVerificar} de {itens.length} exigência(s) ainda sem resposta. Até você marcar, o score
            é calculado <strong>assumindo que a empresa atende a todas</strong> — inclusive as eliminatórias.
          </p>
        </div>
      )}
      {naoAtendidas > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-red-600" />
          <p className="text-xs font-semibold leading-relaxed text-red-900">
            {naoAtendidas} exigência(s) marcada(s) como não atendida(s). Se alguma for eliminatória,
            a empresa seria inabilitada no certame — o veredito já reflete isso.
          </p>
        </div>
      )}
      {erroSalvar && (
        <p className="mb-4 text-xs font-bold text-red-600">{erroSalvar}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {grupos.map(({ cat, label, lista }) => (
          <div key={cat}>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.09em] mb-3 pb-2 border-b border-slate-100">
              {label} <span className="text-slate-300">· {lista.length}</span>
            </h4>
            <Timeline
              dense
              items={lista.map((item, i) => {
                const st = item.status_atendimento || 'nao_avaliado';
                // Eliminatória NÃO ATENDIDA é o pior estado do laudo inteiro:
                // vermelho vence a cor da criticidade.
                const tone: TimelineTone =
                  st === 'nao_atendido' ? 'red'
                  : st === 'atendido' ? 'emerald'
                  : item.criticidade === 'eliminatoria' ? 'red'
                  : 'slate';
                return {
                  key: i,
                  tone,
                  badge: item.criticidade === 'eliminatoria'
                    ? { label: 'Eliminatória', tone: 'red' as TimelineTone }
                    : item.criticidade_informada === false
                      ? { label: 'Criticidade não classificada', tone: 'slate' as TimelineTone }
                      : undefined,
                  title: item.exigencia,
                  description: (
                    <>
                      {item.dica && <span className="block"><strong className="font-semibold text-slate-600">Dica:</strong> {item.dica}</span>}
                      {item.trecho && <span className="mt-1 block italic text-slate-400">&ldquo;{item.trecho}&rdquo;</span>}
                      {podeMarcar && item.id && (
                        <span className="mt-2 flex flex-wrap items-center gap-1.5">
                          {(['atendido', 'nao_atendido', 'nao_avaliado'] as const).map((opcao) => {
                            const cfg = HABILITACAO_STATUS_CFG[opcao];
                            const ativo = st === opcao;
                            return (
                              <button
                                key={opcao}
                                type="button"
                                disabled={salvando === item.id}
                                onClick={() => marcar(item.id!, opcao)}
                                aria-pressed={ativo}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] transition-colors disabled:opacity-50 ${
                                  ativo ? cfg.ativo : `bg-white ${cfg.anel}`
                                }`}
                              >
                                {cfg.label}
                              </button>
                            );
                          })}
                          {salvando === item.id && (
                            <span className="text-[10px] font-bold text-slate-400">salvando…</span>
                          )}
                        </span>
                      )}
                    </>
                  ),
                };
              })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Oportunidades Estratégicas (QA Engine) ──────────────────────────────────

/* ─── Critérios de julgamento e prazos ────────────────────────────────────
 *
 * ⚠️ OS DOIS CAMPOS ABAIXO CHEGAVAM DO BACKEND E NÃO ERAM RENDERIZADOS EM
 * LADO NENHUM. `criterios_de_julgamento` e `prazos` estão em
 * `AnalysisResult` (`models.py`) desde que o modelo existe, vinham
 * preenchidos em toda análise, e a tela simplesmente não os lia.
 *
 * São, entre todos os campos do laudo, dois dos mais próximos da acção: o
 * critério de julgamento é a regra pela qual o órgão escolhe o vencedor
 * (menor preço, técnica e preço, maior desconto) — ou seja, decide se vale a
 * pena disputar preço; e os prazos são o que a pessoa faz na agenda depois
 * de decidir participar.
 */

/* ─── Simulador de preço num laudo No-Go ──────────────────────────────────
 *
 * ⚠️ ISTO ERA UM BLOQUEIO, E O BLOQUEIO ESTAVA ERRADO.
 *
 * A tela dizia "Simulador tático desativado: o veredito é No-Go — não há
 * proposta a precificar" e não renderizava a ferramenta. A regra nunca teve
 * uma justificativa escrita em lado nenhum: entrou em commits chamados
 * "melhorias" e "ajustes finais", e o único argumento a favor dela é o que
 * está na própria frase.
 *
 * O argumento é parcialmente verdadeiro: a maioria dos No-Go do bawzi é de
 * HABILITAÇÃO (atestado, liquidez, CNAE), e aí de facto não há proposta a
 * precificar. Mas ele falha em três pontos:
 *
 *   1 · O No-Go nem sempre é de habilitação. Quando ele vem DO PREÇO — valor
 *       estimado abaixo do custo, deságio inviável — o simulador é
 *       exactamente a ferramenta que permite conferir o veredito. Desligá-lo
 *       remove a auditoria no eixo em que a máquina decidiu.
 *
 *   2 · O veredito pode ser heurística. Sem `decisao.veredito`,
 *       `normalizeDecision` cai no corte por score: abaixo de 45, NO_GO. Um
 *       laudo em que a IA nunca emitiu veredito, com score 44, perdia a
 *       ferramenta em silêncio. Ninguém decidiu isso.
 *
 *   3 · O PRÓPRIO PRODUTO CONTA AS PESSOAS QUE ESTE BLOQUEIO ATINGIA.
 *       `/api/analyses/learning-stats` devolve
 *       `no_go.total_participou_mesmo_assim` — o backend mede quantos
 *       clientes disputam apesar do No-Go e usa isso para calibrar a taxa de
 *       acerto que este mesmo laudo exibe. A plataforma sabe que essas
 *       pessoas existem, mede-as, e escondia delas a ferramenta de preço.
 *
 * "Não participar" é recomendação, não trava — é assim que o resto da tela se
 * comporta ("o que mudaria a decisão", impugnar, monitorar condições na
 * Gestão). O aviso fica, porque na maioria dos casos ele está certo e o
 * estado fechado respeita o veredito. O que deixa de existir é a proibição.
 */
function SimuladorPreco({
  result,
  userTier,
  onUpgradeClick,
}: {
  result: AnalysisResult;
  userTier: number;
  onUpgradeClick: () => void;
}) {
  if (!result.pricing_intelligence) {
    return (
      <p className="text-sm font-medium text-slate-400">
        Inteligência de preço não disponível nesta análise.
      </p>
    );
  }

  const simulador = (
    <div className="print:hidden">
      <TacticalSimulator
        pricing={result.pricing_intelligence}
        fullResult={result}
        userTier={userTier}
        onUpgradeClick={onUpgradeClick}
      />
    </div>
  );

  if (!isNoGoVerdict(result)) return simulador;

  return (
    <details className="group print:hidden">
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 transition-colors hover:border-slate-300 [&::-webkit-details-marker]:hidden">
        <Target size={18} className="mt-0.5 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-relaxed text-slate-500">
            <strong className="font-semibold text-slate-700">O veredito é Não participar.</strong> Na maioria dos
            casos o impedimento é de habilitação — e aí não há proposta a precificar. Se o seu impedimento for de
            preço, ou se vai disputar mesmo assim, o simulador continua aqui.
          </span>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 underline underline-offset-2">
            Simular mesmo assim
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          </span>
        </span>
      </summary>
      <div className="mt-4">{simulador}</div>
    </details>
  );
}

function CriteriosJulgamentoSection({ result }: { result: AnalysisResult }) {
  const itens = (result.criterios_de_julgamento || []).filter((c) => String(c || '').trim());
  if (itens.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 p-6">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
        Critérios de julgamento
      </h4>
      <p className="mt-1 text-[12px] font-medium leading-relaxed text-slate-400">
        Como o órgão escolhe o vencedor. É o que define se a disputa é de preço, de técnica, ou das duas.
      </p>
      <ul className="mt-4 space-y-2.5">
        {itens.map((criterio, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-slate-700">
            <Gavel size={15} className="mt-0.5 shrink-0 text-slate-400" />
            {criterio}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrazosSection({ result }: { result: AnalysisResult }) {
  const itens = (result.prazos || []).filter((c) => String(c || '').trim());
  if (itens.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 p-6">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">
        Prazos declarados no edital
      </h4>
      <p className="mt-1 text-[12px] font-medium leading-relaxed text-slate-400">
        Em texto, como o edital os escreve. O Cronograma traz as datas que a análise conseguiu converter em
        calendário; estes são os que ficam de fora dele, incluindo os relativos (&ldquo;15 dias após o
        empenho&rdquo;).
      </p>
      <ul className="mt-4 space-y-2.5">
        {itens.map((prazo, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-slate-700">
            <Clock size={15} className="mt-0.5 shrink-0 text-slate-400" />
            {prazo}
          </li>
        ))}
      </ul>
    </div>
  );
}

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

// ─── Contradições detectadas na auditoria ────────────────────────────────────
//
// A seção que justifica o multiplicador de créditos da auditoria profunda.
//
/** Nome legível da categoria da contradição.
 *
 *  Espelha `_ASSUNTO_LABEL` em `app/services/auditoria.py`. Duplicado de
 *  propósito: mandar o rótulo pronto do backend obrigaria a migrar as análises
 *  já gravadas, que carregam só a chave. Aqui o mapa cobre o histórico também.
 */
const ROTULO_ASSUNTO: Record<string, string> = {
  pagamento: 'prazo de pagamento',
  impugnacao: 'prazo de impugnação',
  entrega: 'prazo de entrega/execução',
  sessao: 'data da sessão pública',
  vigencia: 'vigência contratual',
  garantia: 'garantia',
};

function rotuloDoAssunto(chave?: string): string | undefined {
  const k = (chave || '').trim();
  if (!k) return undefined;
  return ROTULO_ASSUNTO[k] || k;
}

// `auditoria.detectar_contradicoes` no backend extrai os fatos de prazo e de
// valor com a POSIÇÃO de cada um no documento e confronta os que falam do
// mesmo assunto. Duas datas de sessão divergentes entre o corpo do edital e o
// cadastro do PNCP é das divergências mais caras que existem: o licitante se
// organiza pela data do portal e perde a sessão.
//
// Isto era computado e descartado duas vezes — o endpoint não copiava o campo
// para o laudo e a tela não tinha onde mostrar. O cliente pagava 4 créditos e
// recebia um relatório visualmente idêntico ao da análise rápida, o que torna
// a percepção dele ("a profunda não entrega nada a mais") simplesmente
// correta. Nenhum texto de marketing conserta isso; mostrar o achado conserta.
//
// Some inteira quando não há contradição, e isso é resultado, não falha: um
// edital coerente é o caso normal. O que não pode acontecer é a seção existir
// vazia sugerindo que a auditoria não rodou.
/** Como esta análise foi feita — e o que ela não fez.
 *
 *  Os dois modos entram AQUI, com o mesmo tratamento visual. Isso é
 *  deliberado: se a profunda ganhasse moldura dourada e a rápida um aviso
 *  cinza de rodapé, a seção viraria peça de venda. O que diferencia os dois
 *  é o texto, que descreve método — e o método da rápida inclui, nomeadas, as
 *  duas verificações que ela não faz.
 *
 *  O motivo é medido, não estético: no mesmo edital, a rápida encontrou 1
 *  risco de gravidade alta e a profunda encontrou 4, e as duas devolveram o
 *  mesmo veredito com score 55 e 56. A diferença é feita de ausências, e
 *  ausência não aparece na tela sozinha.
 */
/** Convite para transformar um laudo RÁPIDO em auditoria profunda, pagando
 *  só a diferença. Renderizado no NÍVEL do laudo (logo abaixo da navegação
 *  de etapas), portanto visível em TODA aba — a pessoa pode estar no
 *  Jurídico ou no Cockpit quando decide que quer a verificação completa,
 *  e o caminho precisa estar ali, não escondido numa etapa específica.
 *  A copy diz as três coisas que importam, nesta ordem: o que ESTE laudo é
 *  (leitura única), o que a profunda faz a mais, e por que o preço é só a
 *  diferença. */
/** Preço do aprofundamento, numa conta só — usada pelo banner, pela faixa e
 *  pelo botão do histórico, para os três nunca mostrarem números diferentes.
 *
 *  ⚠️ DERIVA DO QUE O LAUDO JÁ PAGOU, não do texto na tela. A régua fixa é
 *  `max(1, teto(chars ÷ unidade)) × peso_do_modo`, e a rápida tem peso 1 —
 *  logo `profunda = rápida × peso` e a diferença é `pago × (peso − 1)`,
 *  qualquer que seja o tamanho do edital.
 *
 *  A versão anterior estimava pelo `text` do formulário e ERRAVA FEIO: o
 *  backend cobra sobre o `text_to_analyze`, que inclui os PDFs baixados do
 *  PNCP no servidor. Num caso real de 325 mil caracteres a tela prometeu
 *  "+2 créditos" e o portão debitou 21 — a tela mentindo sobre preço, que é
 *  o defeito mais caro que este produto pode ter. Pior ainda no histórico,
 *  onde o formulário está vazio e a estimativa nem existia. */
function precoAprofundar(jaPago: number | null | undefined, pesoProfunda: number | null | undefined) {
  const pago = typeof jaPago === 'number' && jaPago > 0 ? jaPago : null;
  const peso = Math.max(1, Number(pesoProfunda) || 0);
  if (pago === null || peso <= 1) return { cheio: null, pago, diferenca: null };
  return { cheio: pago * peso, pago, diferenca: pago * (peso - 1) };
}

const creditosLabel = (n: number) => `${n} ${n === 1 ? 'crédito' : 'créditos'}`;

/* ─── Peças do convite, compartilhadas entre a faixa e o banner ──────────────
 *
 * A faixa expandida e o banner mostram A MESMA coisa. Se cada um montasse o
 * próprio texto e a própria conta, bastava uma correção de preço num deles
 * para o produto passar a dizer dois números para a mesma pergunta — que é
 * exatamente o defeito do item 14f (a tela mentindo sobre preço). Componente
 * exportado em vez de markup copiado, mesma decisão do ResumoCreditos. */

/** O que este laudo é, e o que a profunda faz a mais. */
function TextoAprofundar() {
  return (
    <>
      <p className="text-sm font-semibold leading-relaxed text-slate-800">
        Este laudo foi gerado por uma leitura única do edital.
      </p>
      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
        A <strong className="text-slate-800">Auditoria profunda</strong> relê o documento inteiro
        em blocos, confere cada afirmação contra o texto original e procura contradições que a
        leitura única não enxerga.
      </p>
    </>
  );
}

/** A CONTA inteira: cheio − já pago = o que você paga. Nunca um número solto. */
function ContaAprofundar({ cheio, pago, diferenca }: {
  cheio: number | null; pago: number | null; diferenca: number | null;
}) {
  if (diferenca === null) {
    return (
      <p className="text-[12px] font-medium text-slate-500">
        O preço aparece assim que o edital estiver carregado.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-sky-100 bg-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 text-[12px] font-medium text-slate-500">
        <span>Auditoria completa</span>
        <span className="tabular-nums">{creditosLabel(cheio!)}</span>
      </div>
      {pago !== null && (
        <div className="mt-1 flex items-baseline justify-between gap-3 text-[12px] font-medium text-emerald-700">
          <span>Já pago nesta leitura</span>
          <span className="tabular-nums">− {pago}</span>
        </div>
      )}
      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Você paga</span>
        <span className="text-lg font-semibold tabular-nums text-sky-700">{creditosLabel(diferenca)}</span>
      </div>
    </div>
  );
}

function BotaoAprofundar({ onAprofundar }: { onAprofundar: () => void }) {
  return (
    <button
      onClick={onAprofundar}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-sky-200/70 transition-colors hover:bg-sky-700"
    >
      <ShieldCheck size={16} className="shrink-0" />
      Fazer auditoria profunda
    </button>
  );
}

/** Saldo ao lado do preço: a pessoa decide sem sair do laudo. */
function SaldoAprofundar({ saldo, diferenca }: { saldo: number | null; diferenca: number | null }) {
  if (saldo === null) return null;
  const cobre = diferenca === null || saldo >= diferenca;
  return (
    <p className={`mt-2 text-center text-[11px] font-bold ${cobre ? 'text-slate-400' : 'text-amber-700'}`}>
      {cobre
        ? `Seu saldo: ${creditosLabel(saldo)}`
        : `Seu saldo é de ${creditosLabel(saldo)} — o restante entra na margem de cortesia.`}
    </p>
  );
}

/** Versão de UMA LINHA do convite, para as abas em que o banner completo
 *  seria peso demais. Mesma gramática da PersistentSummaryBar: a informação
 *  acompanha o leitor sem competir com o conteúdo da etapa. Leva o preço
 *  junto — quem decide na aba do Jurídico não precisa ir procurar quanto é. */
function AprofundarFaixa({ onAprofundar, jaPago, pesoProfunda, saldo }: {
  onAprofundar: () => void;
  jaPago: number | null;
  pesoProfunda: number | null;
  saldo: number | null;
}) {
  const { cheio, pago, diferenca } = precoAprofundar(jaPago, pesoProfunda);

  // ⚠️ A FAIXA AGORA ABRE, E ISSO MUDA ONDE O DINHEIRO É GASTO.
  //
  // Antes, o botão desta faixa chamava `onAprofundar` direto — e `onAprofundar`
  // NÃO abre confirmação: dispara a análise e debita na hora. Ou seja, 24
  // créditos saíam de um clique numa tira de uma linha que mostrava o valor
  // final e mais nada: nem o preço cheio, nem o abatimento, nem o saldo. A
  // conta inteira só existia no banner, que mora numa única aba.
  //
  // Agora a tira ABRE a conta e o botão de confirmar vive lá dentro. Custa um
  // clique a mais para quem já decidiu, e em troca nenhuma cobrança acontece
  // sem que o preço cheio, o abatimento e o saldo estejam na tela. Para uma
  // ação irreversível que gasta crédito, esse é o lado certo do trade.
  //
  // O estado mora AQUI e não no componente-pai de propósito: a faixa é
  // renderizada fora do `key={activeStep}`, então não remonta ao trocar de
  // aba — quem abriu a conta continua com ela aberta enquanto navega.
  const [aberto, setAberto] = useState(false);
  // ⚠️ CONTAINER QUERIES, não breakpoints de viewport (`sm:`/`md:`).
  // Esta faixa vive na coluna do laudo, que tem a barra lateral de 350px ao
  // lado: num monitor largo a coluna já é estreita, e um `md:inline` mandava
  // exibir a frase num espaço que não a comportava — texto e botão colavam.
  // Com `@container`, cada peça reage à largura REAL disponível:
  //   < 22rem → botão em bloco, largura total, embaixo do rótulo
  //   ≥ 22rem → botão volta para a direita, na mesma linha
  //   ≥ 44rem → cabe também a frase explicativa (truncada se faltar espaço)
  // Medido com screenshots em 340/400/460/620/760/980px antes de escrever.
  return (
    <div className="@container mb-6 print:hidden">
      <div className={`rounded-2xl border border-sky-200 transition-colors ${
        aberto ? 'bg-gradient-to-r from-sky-50 to-white shadow-sm' : 'bg-sky-50/70'
      }`}>
        {/* GATILHO — a tira inteira é o botão de abrir. Um alvo grande e uma
            intenção só; dois botões lado a lado (abrir / confirmar), com o
            que gasta crédito sendo o de MENOS informação, seria armadilha. */}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls="aprofundar-detalhe"
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-2.5 text-left transition-colors hover:bg-sky-100/50"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <ScanSearch size={14} className="shrink-0 text-sky-600" />
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-700">
              Leitura única
            </span>
            <span className="hidden h-4 w-px shrink-0 bg-sky-200 @min-[44rem]:block" />
            <span className="hidden min-w-0 flex-1 truncate text-xs font-medium text-slate-600 @min-[44rem]:block">
              A auditoria profunda relê o edital inteiro e confere cada afirmação contra o texto.
            </span>
          </span>
          {/* Rótulo do gatilho: o preço fica visível FECHADO — esconder o
              número atrás do clique transformaria a tira num teaser. A seta
              para baixo é o que diz que abre, em vez de executar. */}
          <span className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-sky-300 bg-white px-3.5 py-2 text-[11px] font-semibold text-sky-700 @min-[22rem]:ml-auto @min-[22rem]:w-auto">
            {aberto
              ? 'Ver menos'
              : `Aprofundar${diferenca !== null ? ` por ${creditosLabel(diferenca)}` : ''}`}
            <ChevronDown
              size={13}
              className={`shrink-0 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {/* DETALHE — mesmas peças do banner completo, pelos mesmos
            componentes. Abaixo de 38rem a conta empilha sob o texto: esta
            faixa vive na coluna do laudo, estreita mesmo em monitor largo. */}
        {aberto && (
          <div
            id="aprofundar-detalhe"
            className="animate-in fade-in slide-in-from-top-1 duration-200 border-t border-sky-100 px-4 pb-4 pt-4"
          >
            <div className="flex flex-col gap-5 @min-[38rem]:flex-row @min-[38rem]:items-center @min-[38rem]:justify-between">
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-700">
                  Análise rápida · leitura única
                </p>
                <TextoAprofundar />
              </div>
              <div className="w-full shrink-0 @min-[38rem]:w-[19rem]">
                <div className="mb-3">
                  <ContaAprofundar cheio={cheio} pago={pago} diferenca={diferenca} />
                </div>
                <BotaoAprofundar onAprofundar={onAprofundar} />
                <SaldoAprofundar saldo={saldo} diferenca={diferenca} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AprofundarBanner({ onAprofundar, jaPago, pesoProfunda, saldo }: {
  onAprofundar: () => void;
  jaPago: number | null;
  pesoProfunda: number | null;
  saldo: number | null;
}) {
  // A CONTA, não um número solto. O botão dizia "+9 CR": "CR" é abreviação de
  // programador (o resto do produto escreve "N créditos", ver SeloCusto), o
  // "+" sugere acréscimo sobre algo que a pessoa não sabe qual é, e o valor
  // vinha colado ao rótulo em caixa alta — virava ruído, não preço.
  // Agora a conta aparece inteira: cheio − já pago = o que você paga.
  //
  // O miolo é o MESMO da faixa expandida, pelos mesmos componentes: este
  // banner é a versão sempre-aberta (aba Análise, logo abaixo do texto que
  // lista o que a leitura única não fez) e a faixa é a versão sob demanda.
  // Duas cópias do markup acabariam com dois preços para a mesma pergunta.
  const { cheio, pago, diferenca } = precoAprofundar(jaPago, pesoProfunda);

  // Container queries pelo mesmo motivo da faixa: a coluna do laudo é
  // estreita mesmo em monitor largo (barra lateral de 350px). Com `md:`,
  // o bloco da conta era espremido a ~19rem ao lado do texto num espaço
  // que não comportava os dois. Abaixo de 38rem, empilha.
  return (
    // `id` + `scroll-mt`: o botão "Aprofundar" do histórico abre o laudo e rola
    // até aqui, em vez de cobrar a partir da lista. Sem a âncora, ele abriria o
    // laudo no topo e a conta ficaria a uma rolagem de distância de quem clicou
    // justamente para vê-la.
    <div
      id="aprofundar-banner"
      className="@container mb-8 scroll-mt-24 overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white shadow-sm"
    >
      <div className="flex flex-col gap-5 p-5 @min-[38rem]:flex-row @min-[38rem]:items-center @min-[38rem]:justify-between">
        {/* Lado esquerdo: o que este laudo é e o que falta nele */}
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-700">
            Análise rápida · leitura única
          </p>
          <TextoAprofundar />
        </div>

        {/* Lado direito: a conta e a ação */}
        <div className="w-full shrink-0 @min-[38rem]:w-[19rem]">
          <div className="mb-3">
            <ContaAprofundar cheio={cheio} pago={pago} diferenca={diferenca} />
          </div>
          <BotaoAprofundar onAprofundar={onAprofundar} />
          <SaldoAprofundar saldo={saldo} diferenca={diferenca} />
        </div>
      </div>
    </div>
  );
}

/** Ganho × investimento da auditoria profunda, numa estrutura só.
 *
 *  Usada pelo chip do cabeçalho e pelo cartão da etapa 03 — se cada um
 *  montasse a própria lista, os dois acabariam contando coisas diferentes
 *  sobre a mesma análise. */
function resumoGanhoProfunda(result: AnalysisResult) {
  const d = result.auditoria_delta;
  if (!d) return null;
  const exig = d.exigencias_acrescentadas ?? 0;
  const contra = d.contradicoes_detectadas ?? 0;
  const quarentena = d.achados_em_quarentena ?? 0;
  const contestados = d.contestados_adversarial ?? 0;
  const validados = d.achados_validados ?? 0;
  const blocos = d.blocos ?? 0;
  const chars = d.chars_edital ?? 0;

  // Cada ganho com o VERBO do que aconteceu — "3 exigências" não diz nada;
  // "3 exigências que a leitura única não relatou" diz o que mudou no laudo.
  const ganhos: { n: number; texto: string }[] = [];
  if (exig > 0) ganhos.push({ n: exig, texto: `exigência${exig > 1 ? 's' : ''} que a leitura única não relatou` });
  if (contra > 0) ganhos.push({ n: contra, texto: `contradição${contra > 1 ? 'ões' : ''} entre trechos do edital` });
  if (quarentena > 0) ganhos.push({ n: quarentena, texto: `afirmação${quarentena > 1 ? 'ões' : ''} descartada${quarentena > 1 ? 's' : ''} por falta de respaldo no texto` });
  if (contestados > 0) ganhos.push({ n: contestados, texto: `achado${contestados > 1 ? 's' : ''} rebaixado${contestados > 1 ? 's' : ''} a "a confirmar" pelo revisor cético` });

  // O que a profunda faz SEMPRE, mesmo quando não acha nada novo. É isto que
  // sustenta o preço num edital limpo — e é verdade verificável, não promessa.
  const garantias: string[] = [];
  if (blocos > 0) {
    garantias.push(
      chars > 0
        ? `Edital lido integralmente: ${blocos} bloco${blocos > 1 ? 's' : ''}, ${chars.toLocaleString('pt-BR')} caracteres, sem truncar`
        : `Edital lido integralmente em ${blocos} bloco${blocos > 1 ? 's' : ''}, sem truncar`,
    );
  }
  if (validados > 0) garantias.push(`${validados} fatos conferidos um a um contra o texto original`);

  const pago = typeof result.creditos === 'number' ? result.creditos : null;
  const abatido = typeof result.desconto_aprofundar === 'number' && result.desconto_aprofundar > 0
    ? result.desconto_aprofundar : null;

  return { ganhos, garantias, pago, abatido, houveGanho: ganhos.length > 0 };
}

/** Chip do cabeçalho: "o que ganhei?" — abre o balanço ganho × investimento.
 *
 *  Fica ao lado do selo "Auditoria profunda" porque é ali que a pergunta
 *  aparece: a pessoa vê que pagou o modo caro e quer saber o que isso
 *  comprou. O cartão da etapa 03 continua existindo para quem lê o laudo
 *  inteiro; este é o atalho para quem só abriu o veredito. */
function ChipGanhoProfunda({ result }: { result: AnalysisResult }) {
  const [aberto, setAberto] = useState(false);
  const resumo = resumoGanhoProfunda(result);
  if (!resumo) return null;

  const total = resumo.ganhos.reduce((s, g) => s + g.n, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        title="Ver o que a auditoria profunda acrescentou e quanto custou"
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] transition-colors ${
          aberto
            ? 'border-sky-300 bg-sky-600 text-white'
            : 'border-sky-200 bg-white text-sky-700 hover:bg-sky-50'
        }`}
      >
        <Sparkles size={11} className="shrink-0" />
        {total > 0 ? `+${total} achados` : 'o que ganhei?'}
        <ChevronDown size={10} className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="mt-3 w-full rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-700">
            O que a auditoria profunda entregou
          </p>

          {resumo.houveGanho ? (
            <ul className="space-y-1.5">
              {resumo.ganhos.map((g) => (
                <li key={g.texto} className="flex items-start gap-2 text-[13px] font-medium leading-relaxed text-slate-700">
                  <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-sky-600 px-1 text-[11px] font-semibold tabular-nums text-white">
                    {g.n}
                  </span>
                  {g.texto}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] font-medium leading-relaxed text-slate-700">
              Nada além do que a leitura única já havia captado — neste edital a auditoria
              funcionou como <strong className="text-slate-900">contraprova</strong> da primeira
              leitura, que é um resultado, não uma ausência.
            </p>
          )}

          {resumo.garantias.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-sky-200/70 pt-3">
              {resumo.garantias.map((g) => (
                <li key={g} className="flex items-start gap-2 text-[12px] font-medium leading-relaxed text-slate-500">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                  {g}
                </li>
              ))}
            </ul>
          )}

          {resumo.pago !== null && (
            <p className="mt-3 border-t border-sky-200/70 pt-3 text-[12px] font-bold text-slate-600">
              Investimento: {resumo.pago} {resumo.pago === 1 ? 'crédito' : 'créditos'}
              {resumo.abatido !== null && (
                <span className="font-medium text-emerald-700">
                  {' '}· {resumo.abatido} já {resumo.abatido === 1 ? 'pago' : 'pagos'} na leitura rápida {resumo.abatido === 1 ? 'foi abatido' : 'foram abatidos'}
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** O número que responde "o que eu ganhei pagando a profunda" — em destaque.
 *
 *  O backend calcula e grava `auditoria_delta` em TODA análise profunda desde
 *  12/08, mas até aqui ele nunca era exibido: o cliente pagava 4×, a auditoria
 *  acrescentava exigências e derrubava afirmações sem respaldo, e nada disso
 *  aparecia como ganho nomeado. Este cartão também persiste o último delta em
 *  localStorage para o CARD DE ESCOLHA do modo poder mostrar "na sua última
 *  auditoria" — prova de valor no momento exato da decisão de pagar.
 *
 *  Zero novidades NÃO esconde o cartão: vira "a auditoria funcionou como
 *  contraprova" — que é verdade e vale dinheiro num edital limpo. Esconder
 *  repetiria o defeito que este cartão existe para corrigir. */
function AuditoriaDeltaDestaque({ result }: { result: AnalysisResult }) {
  const d = result.auditoria_delta;
  const exig = d?.exigencias_acrescentadas ?? 0;
  const contra = d?.contradicoes_detectadas ?? 0;
  const quarentena = d?.achados_em_quarentena ?? 0;
  const validados = d?.achados_validados ?? 0;

  useEffect(() => {
    if (!d) return;
    try {
      localStorage.setItem('bawzi_ultimo_delta_profunda', JSON.stringify({
        exigencias: exig, contradicoes: contra, ts: Date.now(),
      }));
    } catch { /* sem storage: o card de escolha fica sem a prova, nada quebra */ }
  }, [d, exig, contra]);

  if (!d) return null;

  // MESMA fonte do chip do cabeçalho: dois lugares contando a mesma análise
  // com listas próprias acabariam divergindo na primeira mudança de regra.
  const resumo = resumoGanhoProfunda(result);
  if (!resumo) return null;

  return (
    <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-700">
        O que a auditoria profunda acrescentou
      </p>

      {resumo.houveGanho ? (
        <ul className="space-y-1.5">
          {resumo.ganhos.map((g) => (
            <li key={g.texto} className="flex items-start gap-2 text-[13px] font-medium leading-relaxed text-slate-700">
              <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-sky-600 px-1 text-[11px] font-semibold tabular-nums text-white">
                {g.n}
              </span>
              {g.texto}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-medium leading-relaxed text-slate-600">
          Nada além do que a leitura única já havia captado — neste edital a auditoria
          funcionou como <strong className="text-slate-800">contraprova</strong> da primeira
          leitura, que é um resultado, não uma ausência.
        </p>
      )}

      {resumo.garantias.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-sky-200/70 pt-3">
          {resumo.garantias.map((g) => (
            <li key={g} className="flex items-start gap-2 text-[12px] font-medium leading-relaxed text-slate-500">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
              {g}
            </li>
          ))}
        </ul>
      )}

      {resumo.pago !== null && (
        <p className="mt-3 border-t border-sky-200/70 pt-3 text-[12px] font-bold text-slate-600">
          Investimento: {resumo.pago} {resumo.pago === 1 ? 'crédito' : 'créditos'}
          {resumo.abatido !== null && (
            <span className="font-medium text-emerald-700">
              {' '}· {resumo.abatido} já {resumo.abatido === 1 ? 'pago' : 'pagos'} na leitura rápida {resumo.abatido === 1 ? 'foi abatido' : 'foram abatidos'}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function ComoFoiFeita({ result }: { result: AnalysisResult }) {
  const profunda = String(result.auditoria_rodape || '').trim();
  const rapida = String(result.rodape_leitura || '').trim();
  const texto = profunda || rapida;
  if (!texto) return null;

  const ehProfunda = Boolean(profunda);
  // Divide em frases para virar lista legível — o backend monta com ". ".
  const linhas = texto.split('. ').map(t => t.trim()).filter(Boolean);

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
      <SectionLabel
        icon={<ShieldCheck size={18} className="text-slate-700" />}
        label="Como esta análise foi feita"
      />
      <p className="mt-2 mb-5 text-sm font-medium leading-relaxed text-slate-500">
        {ehProfunda
          ? 'Auditoria profunda: cada afirmação abaixo é verificável por você no documento original.'
          : 'Análise rápida: leitura única, com as citações conferidas contra o documento.'}
      </p>
      <ul className="space-y-2.5">
        {linhas.map((linha, i) => {
          const alerta = linha.startsWith('⚠️');
          const ausencia = linha.includes('NÃO incluiu') || linha.includes('não foram procuradas');
          return (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  alerta ? 'bg-amber-500' : ausencia ? 'bg-slate-400' : 'bg-emerald-500'
                }`}
              />
              <span className={ausencia ? 'text-slate-600' : alerta ? 'text-amber-800' : 'text-slate-700'}>
                {linha.replace(/^⚠️\s*/, '')}
                {i < linhas.length - 1 ? '.' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ContradicoesSection({ result }: { result: AnalysisResult }) {
  const itens = result.auditoria?.contradicoes || [];
  if (!itens.length) return null;

  const tomDaGravidade = (g?: string): TimelineTone =>
    (g || '').toLowerCase() === 'alta' ? 'red' : 'amber';

  return (
    <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
      <SectionLabel
        icon={<ShieldAlert size={18} className="text-amber-600" />}
        label="Contradições no Edital"
      />
      <p className="text-sm font-medium text-slate-500 leading-relaxed mt-2 mb-6">
        {itens.length === 1
          ? 'A auditoria encontrou um ponto do edital que se contradiz. '
          : `A auditoria encontrou ${itens.length} pontos do edital que se contradizem. `}
        Cada item traz os dois trechos conferidos no documento — leve-os para
        pedido de esclarecimento antes de montar a proposta.
      </p>
      <Timeline
        items={itens.map((c, i) => ({
          key: i,
          tone: tomDaGravidade(c.gravidade),
          // `c.assunto` é o identificador INTERNO da categoria ("sessao",
          // "vigencia", "impugnacao") — minúsculo e sem acento porque casa
          // contra texto normalizado. Exibido cru, o achado mais valioso da
          // auditoria chegava ao cliente rotulado com um slug de código.
          eyebrow: rotuloDoAssunto(c.assunto),
          badge: c.tipo === 'contradicao_com_cadastro'
            ? { label: 'Edital × cadastro PNCP', tone: tomDaGravidade(c.gravidade) }
            : { label: 'Interna ao edital', tone: tomDaGravidade(c.gravidade) },
          title: c.descricao || 'Divergência detectada',
          description: (c.trecho_a || c.trecho_b) ? (
            <span className="block space-y-2">
              {c.trecho_a && (
                <span className="block border-l-2 border-slate-200 pl-3 text-slate-500 italic">
                  &ldquo;{c.trecho_a}&rdquo;
                </span>
              )}
              {c.trecho_b && (
                <span className="block border-l-2 border-slate-200 pl-3 text-slate-500 italic">
                  &ldquo;{c.trecho_b}&rdquo;
                  {c.fonte_b && (
                    <span className="not-italic font-bold text-slate-400"> — {c.fonte_b}</span>
                  )}
                </span>
              )}
            </span>
          ) : undefined,
        }))}
      />
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
            <h4 className="text-[10px] font-semibold text-emerald-600 uppercase tracking-[0.09em] mb-4 flex items-center gap-1"><ThumbsUp size={11} /> Vantagens (Por que avançar?)</h4>
            <Timeline dense items={result.vantagens.map((v, i) => ({ key: i, tone: 'emerald' as TimelineTone, title: v }))} />
          </div>
        )}
        {result.desvantagens && result.desvantagens.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-orange-600 uppercase tracking-[0.09em] mb-4 flex items-center gap-1"><ThumbsDown size={11} /> Barreiras (Por que recuar?)</h4>
            <Timeline dense items={result.desvantagens.map((d, i) => ({ key: i, tone: 'amber' as TimelineTone, title: d }))} />
          </div>
        )}
        {result.exigencias_criticas && result.exigencias_criticas.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.09em] mb-4 flex items-center gap-1"><Pin size={11} /> Exigências Críticas</h4>
            {/* `textoDoItem`: a auditoria acrescenta exigências como OBJETO
                (com a citação conferida junto), o investigador as escreve como
                string. Passar o item cru para `title` renderizava um objeto
                onde React espera um nó — e quebrava justamente quando a
                análise profunda entregava o que ela tem de melhor. */}
            <Timeline dense items={result.exigencias_criticas.map((e, i) => ({
              key: i,
              tone: 'slate' as TimelineTone,
              title: textoDoItem(e),
              // ⚠️ ESTE COMENTÁRIO DIZIA "a citação vem da auditoria e já foi
              // conferida caractere a caractere" — verdade só num dos três
              // desfechos. `citacao_conferida: false` (trecho curto demais,
              // devolvido sem busca) e `trecho_nao_conferido` (citação que não
              // existe no edital) apareciam com a MESMA aspa e a mesma borda de
              // uma citação verificada. Ver `estadoDaCitacao`.
              description: (() => {
                const estado = estadoDaCitacao(e);
                if (estado === 'removida') {
                  const original = typeof e === 'string' ? '' : e.trecho_nao_conferido;
                  return (
                    <div className="mt-1 rounded-lg border-l-4 border-red-300 bg-red-50 px-3 py-1.5 text-[11px] text-red-800">
                      <span className="font-semibold uppercase tracking-[0.09em]">Citação não localizada no edital</span>
                      {original && <span className="mt-0.5 block italic opacity-70">&ldquo;{original}&rdquo;</span>}
                    </div>
                  );
                }
                if (!citacaoDoItem(e)) return undefined;
                const naoConferida = estado === 'nao_conferida';
                return (
                  <blockquote className={`mt-1 rounded-lg border-l-4 px-3 py-1.5 text-[11px] italic ${
                    naoConferida
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-slate-300 bg-slate-50 text-slate-600'
                  }`}>
                    &ldquo;{citacaoDoItem(e)}&rdquo;
                    {naoConferida && (
                      <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.09em] not-italic text-amber-700">
                        Trecho curto demais para conferir contra o documento
                      </span>
                    )}
                  </blockquote>
                );
              })(),
            }))} />
          </div>
        )}
        {result.documentos_necessarios && result.documentos_necessarios.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.09em] mb-4 flex items-center gap-1"><FolderOpen size={11} /> Documentação Necessária</h4>
            <Timeline dense items={result.documentos_necessarios.map((doc, i) => ({
              key: i, tone: 'blue' as TimelineTone, title: textoDoItem(doc),
            }))} />
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
            <p className="text-sm font-semibold text-emerald-800">Nenhum risco relevante identificado</p>
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
                // ⚠️ `impacto ?? 'medio'` estampava "MÉDIO" num risco que a
                // análise se RECUSOU a graduar — e o backend, que só conta
                // `impacto == "alto"`, não cobrava nada por ele. O selo dizia
                // que alguém mediu; ninguém mediu.
                const impactoLabel: Record<string, string> = { alto: 'ALTO', medio: 'MÉDIO', baixo: 'BAIXO' };
                return {
                  key: idx,
                  tone,
                  badge: { label: impactoLabel[String(risk.impacto || '')] ?? 'NÃO GRADUADO', tone },
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
            <p className="text-sm font-semibold text-slate-700">Nova análise necessária</p>
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
                <p className="text-sm font-semibold text-slate-800">{item.risco}</p>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.09em] ${cfg.cls}`}>
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
  // ⚠️ O DADO DECIDE ANTES DO PLANO. A versão anterior perguntava
  // `userTier <= 2 ? cadeado : parecer`, nesta ordem — então um parecer que
  // JÁ tivesse sido gerado num tier baixo (o Admin pode elevar o agent_count
  // por tier) ficava escondido atrás do cadeado. Conteúdo produzido, custo
  // pago, invisível. Agora: se veio parecer, mostra; a ausência é que precisa
  // ser explicada.
  const status = statusDoParecer(result, userTier);

  /* ⚠️ SAIU A BARRA PRETA "PARECER TÉCNICO-JURÍDICO BAWZI".
     Ela vinha logo abaixo do divisor de capítulo "Leitura jurídica" — dois
     títulos empilhados a dizer a mesma coisa, o segundo em caixa alta sobre
     `bg-slate-900`, mais pesado do que qualquer coisa na aba inclusive o
     conteúdo do parecer. O capítulo já nomeia a secção; o selo "Agente IA
     Especialista" que a acompanhava era chrome de venda dentro de um laudo
     que a pessoa já pagou. O que era informação de verdade — quem escreveu
     isto, e o que isto não é — desceu para uma nota de procedência. */

  if (status === 'presente') {
    return (
      <div className="rounded-2xl border border-slate-200 p-6 md:p-8">
        <div className="whitespace-pre-wrap font-sans text-sm font-medium leading-relaxed text-slate-700">
          {result.parecer_especialista}
        </div>
        <p className="mt-6 border-t border-slate-100 pt-4 text-[11px] font-medium leading-relaxed text-slate-400">
          Gerado pelo Agente Jurídico da Bawzi a partir do texto do edital. É apoio à decisão — não substitui
          parecer de advogado nem dispensa a leitura do documento original.
        </p>
      </div>
    );
  }

  /* Plano INCLUI e mesmo assim não veio: é falha, e a tela precisa dizer
     isso. Antes, este caminho renderizava o cabeçalho preto e mais nada —
     um cartão vazio com título, que parece bug de layout e não informa nem
     que houve problema nem o que fazer. */
  if (status === 'nao_gerado') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-6">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-semibold text-slate-800">
            O parecer não foi gerado nesta análise.
          </p>
          {/* "Refazer cobra de novo" precisa estar escrito. Repetir o mesmo
              edital normalmente sai de graça — bate no cache e devolve o
              laudo salvo, sem chamar a IA. Mas quando o parecer falta, o
              cache é invalidado de propósito (ver router_analyses) para que
              refazer REPROCESSE — e reprocessar debita. Recomendar a ação
              sem dizer o preço é a mesma armadilha do "+2 créditos". */}
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
            Seu plano inclui o Agente Jurídico, então isto é uma falha desta rodada —
            não um limite da assinatura. Refazer a análise reprocessa o edital do zero
            (e debita como uma análise nova); se repetir, vale reportar ao suporte.
          </p>
        </div>
      </div>
    );
  }

  /* fora_do_plano — ⚠️ ESTE RAMO ERA O TERCEIRO MECANISMO DE BLOQUEIO DA
     TELA: um cartão preto próprio, sobreposto a `h-3 bg-slate-300` — barras
     de esqueleto INVENTADAS, que não são o parecer desfocado, são um desenho
     de texto. Agora usa o mesmo `PremiumLock` do Radar e do PDF, desfocando
     uma amostra real da linguagem do parecer.
     "Nível N (Nome)" é a gramática do PremiumLock; este cartão dizia
     "membros Profissionais e Avançados" — correto, mas num vocabulário só
     dele. Confere com tier_config: 3 Profissional e 4 Avançado têm
     agent_count 3; o 2 (Essencial) tem 2. */
  return (
    <PremiumLock
      isLocked
      featureTitle="Parecer técnico-jurídico"
      requiredTierName="Nível 3 (Profissional)"
      onUpgradeClick={onUpgradeClick}
      nota="Vale para os dois modos — a auditoria profunda não desbloqueia o parecer."
    >
      <div className="rounded-2xl border border-slate-200 p-6 md:p-8">
        <p className="text-sm font-medium italic leading-relaxed text-slate-600">
          &ldquo;Após análise minuciosa das cláusulas de habilitação técnica e financeira, identificamos pontos de
          atenção quanto à exigência de atestado e ao índice de liquidez, cuja redação comporta questionamento nos
          termos do art. 67 da Lei 14.133/2021…&rdquo;
        </p>
      </div>
    </PremiumLock>
  );
}

type AvaliacaoParametro = CriterioAvaliado;

const PARAM_STATUS_CFG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  ok:       { label: 'Atende',        bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  alerta:   { label: 'Atenção',       bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400'  },
  bloqueio: { label: 'Não atende',    bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'    },
  // Quarto estado, criado porque o terceiro não existia e a ausência caía no
  // primeiro. Cinza de propósito: não é uma nota, é a falta de uma.
  nao_verificado: { label: 'Não verificado', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
};

const PARAM_PESO_CFG = {
  alto:  { label: 'Crítico',    color: 'text-red-600 font-semibold' },
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
    // O que não foi verificado vem logo abaixo dos bloqueios: é pendência de
    // conferência, não item resolvido. Antes caía no `?? 1` junto com "alerta".
    const order: Record<string, number> = { bloqueio: 0, nao_verificado: 1, alerta: 2, ok: 3 };
    return (order[String(a.status)] ?? 2) - (order[String(b.status)] ?? 2);
  });

  return (
    <section className="mb-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      {/* Cabeçalho */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
              <SlidersHorizontal size={13} />
              Critérios configurados
            </p>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950">
              Avaliação por Critérios
            </h3>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">
              {params.length} critério{params.length > 1 ? 's' : ''} avaliado{params.length > 1 ? 's' : ''} pela IA — resultado por critério abaixo
            </p>
          </div>
          <div className="flex gap-2">
            {ok > 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-center min-w-[60px]">
                <span className="text-xl font-semibold text-emerald-600">{ok}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-emerald-500">Atende</span>
              </div>
            )}
            {alertas > 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-amber-100 bg-amber-50 px-4 py-2 text-center min-w-[60px]">
                <span className="text-xl font-semibold text-amber-600">{alertas}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-amber-500">Atenção</span>
              </div>
            )}
            {bloqueios > 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-center min-w-[60px]">
                <span className="text-xl font-semibold text-red-600">{bloqueios}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-red-500">Bloqueio{bloqueios > 1 ? 's' : ''}</span>
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
        <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500 transition-colors hover:bg-slate-50">
          <ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" />
          Ver avaliação completa dos {params.length} critérios
        </summary>
        <div className="border-t border-slate-200 px-6 py-6">
        <Timeline
          items={sorted.map((p, i) => {
            const st   = PARAM_STATUS_CFG[p.status] ?? PARAM_STATUS_CFG.nao_verificado;
            const peso = PARAM_PESO_CFG[p.peso]     ?? PARAM_PESO_CFG.medio;
            const comprovado = p.comprovado ?? Boolean(String(p.trecho_citado || '').trim());
            const tone: TimelineTone =
              p.status === 'bloqueio' ? 'red'
              : p.status === 'ok' ? (comprovado ? 'emerald' : 'amber')
              : p.status === 'alerta' ? 'amber'
              : 'slate';
            return {
              key: i,
              tone,
              badge: { label: st.label, tone },
              // `{p.score}/10` sem guarda imprimia "/10" sozinho quando o
              // score não vinha. Sem nota, não se desenha nota.
              meta: <span className="tabular-nums">{p.score == null ? '—' : `${p.score}/10`}</span>,
              eyebrow: peso.label,
              title: p.nome,
              description: (
                <>
                  {p.avaliacao && <span className="block">{p.avaliacao}</span>}
                  {p.trecho_citado ? (
                    <blockquote className="mt-2 rounded-lg border-l-4 border-slate-200 bg-slate-50 px-3 py-2 text-[11px] italic text-slate-500">
                      "{p.trecho_citado}"
                    </blockquote>
                  ) : (
                    // ⚠️ ANTES A CITAÇÃO VAZIA SUMIA EM SILÊNCIO: "Atende ✅"
                    // com base no edital e "Atende ✅" sem base nenhuma ficavam
                    // pixel a pixel idênticos.
                    <span className="mt-2 block text-[11px] font-semibold text-amber-700">
                      Sem trecho do edital que comprove esta avaliação — confira manualmente.
                    </span>
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

/* ⚠️ `ChecklistSection` FOI REMOVIDA: definida, nunca renderizada. O
   checklist que a tela mostra de facto é o `habilitacao_checklist`, através de
   `HabilitacaoSection`. */

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
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">Exclusivo Avançado</span>
          </div>
          <h3 className="font-semibold text-white text-xl tracking-tight mb-2 leading-tight">Laudo de Decisão Bawzi</h3>
          <p className="text-sm font-medium text-slate-400 leading-relaxed mb-4 max-w-lg">
            Documento executivo com veredito Go/No-Go, evidências, lacunas, confiança, próximos responsáveis e base para decisão interna.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {['Veredito Executivo', 'Evidências', 'Base da Confiança', 'Lacunas', 'Cockpit de Execução'].map(item => (
              <span key={item} className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.09em] bg-white/5 border border-white/10 px-2 py-1 rounded-lg">✓ {item}</span>
            ))}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-[0.09em]">Apoio à decisão — requer validação responsável</span>
          </div>
        </div>
      </div>
      <button
        onClick={onExportPDF}
        className="relative z-10 w-full md:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-[11px] uppercase tracking-[0.09em] rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 shrink-0"
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
        <h1 className="text-2xl font-semibold tracking-tight">Bawzi Intelligence</h1>
        <p className="font-bold text-slate-500 uppercase">Laudo de Decisão — Go / No-Go de Licitação</p>
      </div>
      <div className="bg-slate-100 p-4 mb-6 border-l-4 border-slate-900">
        <p className="font-bold text-xs flex items-start gap-1">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" /> Nota de Responsabilidade: Este laudo foi gerado por IA para apoiar a decisão de participação. A revisão e validação por um profissional habilitado continua indispensável.
        </p>
      </div>

      {/* ⚠️ IMPEDITIVOS FALTAVAM NO IMPRESSO. `MeEppImpeditivoBanner` e
          `ExpiredBanner` só existiam no caminho interativo — a versão impressa
          do laudo, que é a que circula assinada, saía sem o aviso de que a
          empresa pode estar VEDADA por porte ou de que o edital já encerrou.
          Vão antes do veredito: impeditivo antecede recomendação. */}
      {(() => {
        const meEpp = result.elegibilidade_me_epp;
        const encerrada = getDataExpirada(result);
        if (!meEpp && !encerrada) return null;
        return (
          <div className="mb-6 space-y-2">
            {meEpp && !meEpp.elegivel && (
              <div className="border-l-4 border-rose-600 bg-rose-50 px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-rose-700">Possível impeditivo · ME/EPP</p>
                <p className="text-xs text-rose-900">{meEpp.mensagem}</p>
              </div>
            )}
            {meEpp?.elegivel && meEpp.cota_reservada && (
              <div className="border-l-4 border-sky-600 bg-sky-50 px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-sky-700">Cota reservada · ME/EPP</p>
                <p className="text-xs text-sky-900">{meEpp.mensagem}</p>
              </div>
            )}
            {encerrada && (
              <div className="border-l-4 border-slate-900 bg-slate-100 px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-700">Edital encerrado</p>
                <p className="text-xs text-slate-800">
                  A {encerrada.label} ocorreu em {formatarDataCritica(encerrada.data_iso, 'longo') ?? '—'}.
                  {' '}Laudo válido apenas como referência e estudo de mercado.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      <div className="space-y-6">

        {/* 01 · Veredito */}
        <Secao title="Veredito Executivo">
          <p><strong>{decision.veredito.replace('_', ' ')}</strong> — {decision.rotulo}</p>
          <p className="mt-1">{getDecisionSummary(decision)}</p>
          <p className="mt-1">
            Score: <strong>{result.score}/100</strong>
            {decision.confianca != null && (
              <> · Confiança: <strong>{decision.confianca}%</strong>{decision.confianca_informada ? '' : ' (estimada do score)'}</>
            )}
          </p>
        </Secao>

        {businessFit && (
          <Secao title="Aderência ao Negócio (CNAE)">
            <p>
              {businessFit.label}
              {businessFit.score == null ? ' — Match: não medido' : <> — Match: <strong>{businessFit.score}/100</strong></>}
            </p>
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
                  {dc.label}: {formatarDataCritica(dc.data_iso, 'numerico') ?? 'não informado'}
                  {dataCriticaExpirada(dc.data_iso)
                    ? ' · ENCERRADO'
                    : dataCriticaUrgente(dc.data_iso) ? ' · URGENTE' : ''}
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
                {result.orgao_risk.substituicao_municipio
                  && ' (nota do ESTADO — o município comprador não consta na tabela do Tesouro)'}
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
                <li key={i}><strong>[{(r.impacto || 'não graduado').toUpperCase()}]</strong> {r.titulo} — {r.descricao}</li>
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
