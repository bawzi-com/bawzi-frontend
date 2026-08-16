'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  DollarSign,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trophy,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { API_URL, apiFetch, clearSession, SessionExpiredError, startSessionKeepAlive } from '@/lib/apiClient';
import { getCachedTier } from '@/lib/tier';
import type { Empresa, SavedAnalysis } from '@/lib/types';
import type { AnalysisResult } from './analysis-types';
import AnalysisResults from './AnalysisResults';
import {
  buildDecisionQueueTasks,
  decisionQueueOrder,
  decisionQueueStages,
  getNextDecisionQueueStage,
  getDecisionQueueStage,
  normalizeDecisionCockpitStatus,
  type DecisionQueueKey,
  type DecisionQueueTask,
} from '@/lib/decisionQueue';

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

type NoticeState = { type: 'success' | 'error' | 'info'; message: string } | null;
type VerdictFilter = 'all' | 'go' | 'attention' | 'nogo';
type UrgencyFilter = 'all' | 'late' | 'urgent' | 'week';
type MonitorFilter = 'all' | 'changed' | 'monitored' | 'unmonitored';
type ActivityFilter = 'all' | 'active' | 'finalized';
type SortFilter = 'recent' | 'deadline' | 'score_desc' | 'score_asc';
type CompanyFilter = 'all' | 'unlinked' | string;

type DecisionQueueCardModel = {
  analysis: SavedAnalysis;
  tasks: DecisionQueueTask[];
  statusMap: ReturnType<typeof normalizeDecisionCockpitStatus>;
  done: number;
  total: number;
  progress: number;
  nextTask: DecisionQueueTask | null;
  stage: DecisionQueueKey;
};

const columnOrder = decisionQueueOrder;

export default function DecisionManagementTab({
  token,
  userTier = 1,
  sidebarHidden = false,
  onToggleSidebar,
}: {
  token: string;
  userTier?: number;
  /** Estado do menu lateral do app-shell — só relevante quando esta aba vive
   * dentro do grid com AppSidebar (analysis-app.tsx). A página standalone
   * /gestao não tem esse menu, então não passa essas props e o botão some. */
  sidebarHidden?: boolean;
  onToggleSidebar?: () => void;
}) {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [companies, setCompanies] = useState<Empresa[]>([]);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
  /** ⚠️ CONJUNTO, NÃO VALOR ÚNICO. Era `'all' | DecisionQueueKey`, e por isso
   *  clicar numa etapa sempre descartava a anterior. "Quero ver Proposta E
   *  Enviado" — as duas pontas de quem está com envio na semana — era
   *  impossível: dava para ver uma ou todas as nove.
   *  Conjunto vazio significa "todas", e não "nenhuma": é o estado neutro, o
   *  mesmo papel que o `'all'` tinha. */
  const [etapasSelecionadas, setEtapasSelecionadas] = useState<Set<DecisionQueueKey>>(new Set());
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [monitorFilter, setMonitorFilter] = useState<MonitorFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('active');
  const [sortFilter, setSortFilter] = useState<SortFilter>('recent');
  const [notice, setNotice] = useState<NoticeState>(null);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // ⚠️ FALHA DE CARGA PRECISA DE ESTADO PRÓPRIO.
  // Sem isto, `analyses` ficava `[]` tanto para "você ainda não adicionou
  // nada" quanto para "a requisição falhou" — e a tela dizia a primeira coisa
  // nos dois casos. Quem tinha 40 editais em acompanhamento e caía num 500 lia
  // "Nenhum edital na Gestão ainda" e concluía que a plataforma tinha perdido
  // o trabalho dele. O toast de erro existia, mas some sozinho em 4s.
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  /** Por onde o resumo operacional deve abrir. O cartão tem DOIS caminhos para
   *  o mesmo modal — "Resumo do edital" e "Ver o plano inteiro" — e eles
   *  prometem coisas diferentes. Abrir os dois no topo faz o segundo mentir. */
  const [focoDoResumo, setFocoDoResumo] = useState<'plano' | null>(null);
  // Fila de gravação do plano de execução. `useRef` e não `useState`: ela é
  // encadeamento de promessas, não algo que a tela desenha — guardá-la em
  // estado provocaria re-render a cada `onBlur` sem mudar um pixel.
  const filaDeGravacaoRef = useRef<Promise<void>>(Promise.resolve());
  const [recarregar, setRecarregar] = useState(0);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [savingStageId, setSavingStageId] = useState<string | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);
  const [summaryModal, setSummaryModal] = useState<DecisionQueueCardModel | null>(null);
  const [reviewModal, setReviewModal] = useState<DecisionQueueCardModel | null>(null);
  const [learningModal, setLearningModal] = useState<DecisionQueueCardModel | null>(null);
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [savingLearningId, setSavingLearningId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'analise' | 'concorrentes'>('analise');
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const [boardScroll, setBoardScroll] = useState({ left: false, right: false });

  // ── Tela cheia do laudo aberto pela gestão ──────────────────────────────
  // Fullscreen real (API do navegador) some até com a barra do navegador; o
  // toggle de menu (via onToggleSidebar) libera os 350px da coluna lateral
  // do app-shell para o laudo respirar mais. São dois controles independentes.
  const laudoRef = useRef<HTMLDivElement | null>(null);
  // O quadro principal tem o seu próprio alvo: os dois nunca coexistem (a visão
  // de laudo é return antecipado), mas cada um precisa de um elemento distinto
  // para entregar ao requestFullscreen.
  const quadroRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = (alvo: RefObject<HTMLDivElement | null> = laudoRef) => {
    if (!document.fullscreenElement) {
      alvo.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const CARDS_PER_COLUMN = 20;
  const [expandedColumns, setExpandedColumns] = useState<Partial<Record<DecisionQueueKey, boolean>>>({});
  const toggleColumnExpand = (key: DecisionQueueKey) =>
    setExpandedColumns((prev) => ({ ...prev, [key]: !prev[key] }));

  // Renova o access token proativamente enquanto o usuário estiver na gestão.
  // Sem isso, o token de 60 min expira e a próxima ação retorna 401.
  useEffect(() => startSessionKeepAlive(), []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [historyRes, workspaceRes, learningStatsRes] = await Promise.all([
          apiFetch(`${API_URL}/api/analyses/history`),
          apiFetch(`${API_URL}/api/workspace/details`),
          apiFetch(`${API_URL}/api/analyses/learning-stats`).catch((err) => {
            console.warn('[learning-stats] falha na requisição:', err);
            return null;
          }),
        ]);

        // ⚠️ `.ok` ANTES DE LER O CORPO. Um erro do FastAPI vem como JSON
        // válido (`{"detail": "..."}`), então `historyRes.json()` NÃO lança:
        // `data.history` fica `undefined`, `Array.isArray(data)` é `false`
        // porque é objeto, e o resultado era `[]` — indistinguível de conta
        // vazia, sem erro nenhum em tela.
        if (!historyRes.ok) {
          const corpo = await historyRes.json().catch(() => null);
          const detalhe = typeof corpo?.detail === 'string' ? corpo.detail : '';
          throw new Error(
            historyRes.status === 403
              ? (detalhe || 'Sem permissão para ver a gestão desta conta.')
              : `Não foi possível carregar seus editais (erro ${historyRes.status}).${detalhe ? ' ' + detalhe : ''}`,
          );
        }

        const data = await historyRes.json();
        const history = data.history || (Array.isArray(data) ? data : []);
        // Gestão é opt-in: só entra aqui o que o usuário adicionou de propósito
        // pelo botão "+ Gestão" na análise. Sem esse filtro, esta tela mostrava
        // o histórico inteiro — igual à aba Decisões — o que confundia o que
        // "estar em Gestão" realmente significa.
        if (Array.isArray(history)) {
          setAnalyses(history.filter((item: SavedAnalysis) => item?.tracked_in_gestao === true));
        }
        setErroDeCarga(null);

        if (workspaceRes.ok) {
          const workspaceData = await workspaceRes.json().catch(() => null);
          const workspaceCompanies = Array.isArray(workspaceData?.companies)
            ? workspaceData.companies
            : [];
          setCompanies(workspaceCompanies.filter((company: Empresa) => company?.cnpj));
        } else {
          // Não derruba a tela — a gestão funciona sem o filtro de empresa —,
          // mas também não finge que a conta não tem empresa nenhuma: sem este
          // aviso o seletor exibia "Sem empresas" para quem tem três.
          console.warn(`[gestao] /workspace/details respondeu ${workspaceRes.status}`);
          setNotice({ type: 'info', message: 'Não consegui carregar suas empresas — o filtro por empresa fica indisponível nesta sessão.' });
        }

        if (learningStatsRes?.ok) {
          const stats = await learningStatsRes.json().catch(() => null);
          if (stats) setLearningStats(stats);
        } else if (learningStatsRes) {
          console.warn(`[learning-stats] resposta não-ok: ${learningStatsRes.status}`);
        }
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          // Sem isto, a tela ficava com "gestão vazia" em vez de deixar claro
          // que a sessão caiu — o usuário só percebia o logout ao tentar
          // clicar em algo e nada funcionar.
          clearSession();
          router.push('/login?redirect=/gestao');
          return;
        }
        const msg = err instanceof Error && err.message
          ? err.message
          : 'Erro ao carregar a gestão de decisões.';
        setErroDeCarga(msg);
        setNotice({ type: 'error', message: msg });
      } finally {
        setIsLoading(false);
      }
    };

    if (token) void loadData();
    else setIsLoading(false);
    // `recarregar` na lista: é o que o botão "Tentar de novo" incrementa. Sem
    // ele, a única saída de um erro de carga seria recarregar a página inteira.
  }, [token, recarregar]);

  const companyOptions = useMemo(() => {
    const seen = new Set<string>();
    return companies.filter((company) => {
      const cnpj = cleanCnpj(company.cnpj);
      if (!cnpj || seen.has(cnpj)) return false;
      seen.add(cnpj);
      return true;
    });
  }, [companies]);

  useEffect(() => {
    if (companyFilter === 'all' || companyFilter === 'unlinked') return;
    const stillExists = companyOptions.some((company) => cleanCnpj(company.cnpj) === companyFilter);
    if (!stillExists) setCompanyFilter('all');
  }, [companyFilter, companyOptions]);

  const searchFilteredAnalyses = useMemo(() => {
    const search = searchText.toLowerCase().trim();
    if (!search) return analyses;

    return analyses.filter((item) => {
      const haystack = [
        item.title,
        item.summary,
        item.recommendation,
        item.termo_busca_pncp,
        item.classification,
        getAnalysisCompanyName(item),
        getAnalysisCompanyCnpj(item),
        item.uf,
        item.estado,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [analyses, searchText]);

  const allQueueCards = useMemo<DecisionQueueCardModel[]>(() => searchFilteredAnalyses.map((analysis) => {
    const tasks = buildDecisionQueueTasks(analysis);
    const statusMap = normalizeDecisionCockpitStatus(analysis.cockpit_status);
    const done = tasks.filter((task) => statusMap[task.id]?.done).length;
    const nextTask = tasks.find((task) => !statusMap[task.id]?.done) || null;
    const stage = getDecisionQueueStage(analysis, tasks, statusMap).key;

    return {
      analysis,
      tasks,
      statusMap,
      done,
      total: tasks.length,
      progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      nextTask,
      stage,
    };
  }), [searchFilteredAnalyses]);

  const queueCards = useMemo<DecisionQueueCardModel[]>(() => {
    const finalStages: DecisionQueueKey[] = ['won', 'lost', 'abandoned', 'executed'];
    const now = Date.now();
    const selectedCompany = companyFilter === 'all' || companyFilter === 'unlinked'
      ? null
      : companyOptions.find((company) => cleanCnpj(company.cnpj) === companyFilter) || null;

    const filtered = allQueueCards.filter((card) => {
      if (companyFilter === 'unlinked' && getLinkedCompanyForAnalysis(card.analysis, companyOptions)) return false;
      if (companyFilter !== 'all' && companyFilter !== 'unlinked') {
        if (!selectedCompany || !analysisMatchesCompany(card.analysis, selectedCompany)) return false;
      }

      if (etapasSelecionadas.size > 0 && !etapasSelecionadas.has(card.stage)) return false;

      const score = Number(card.analysis.score || 0);
      if (verdictFilter === 'go' && score < 70) return false;
      if (verdictFilter === 'attention' && !(score >= 45 && score < 70)) return false;
      if (verdictFilter === 'nogo' && score >= 45) return false;

      const isFinal = finalStages.includes(card.stage);
      if (activityFilter === 'active' && isFinal) return false;
      if (activityFilter === 'finalized' && !isFinal) return false;

      const monitor = asRecord(card.analysis.pncp_monitor);
      const hasEvents = Array.isArray(card.analysis.pncp_monitor_events) && card.analysis.pncp_monitor_events.length > 0;
      // ⚠️ TER REFERÊNCIA DO PNCP NÃO É O MESMO QUE ESTAR SENDO MONITORADO.
      // O filtro olhava só `pncp_ref`, que é dado que fica gravado para sempre.
      // Mas o job noturno e o botão de verificação em lote EXCLUEM as etapas
      // finais — `{"workflow_status": {"$nin": ["won","lost","abandoned",
      // "executed"]}}` em scheduler.py:384 e router_analyses.py:6113. Um edital
      // ganho há três meses aparecia em "Monitorados" e o backend não olhava
      // para ele desde o dia em que foi marcado como ganho.
      //
      // A mesma lista de etapas finais que já existe acima (`finalStages`) é a
      // que decide aqui — se um dia o backend mudar quais etapas encerram o
      // monitoramento, muda-se num lugar só.
      const temRefPncp = Boolean(asRecord(card.analysis.pncp_ref).cnpj || card.analysis.pncp_cnpj);
      const emEtapaFinal = finalStages.includes(card.stage);
      const monitoradoDeFato = temRefPncp && !emEtapaFinal;
      if (monitorFilter === 'changed' && !hasEvents && monitor.status !== 'mudanca_detectada') return false;
      if (monitorFilter === 'monitored' && !monitoradoDeFato) return false;
      if (monitorFilter === 'unmonitored' && monitoradoDeFato) return false;

      if (urgencyFilter !== 'all') {
        const deadline = getCriticalDeadline(asRecord(card.analysis), card.nextTask).date;
        if (!deadline) return false;
        const diffDays = Math.ceil((deadline.getTime() - now) / (24 * 60 * 60 * 1000));
        if (urgencyFilter === 'late' && diffDays >= 0) return false;
        if (urgencyFilter === 'urgent' && !(diffDays >= 0 && diffDays <= 1)) return false;
        if (urgencyFilter === 'week' && !(diffDays >= 0 && diffDays <= 7)) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortFilter === 'score_desc') return Number(b.analysis.score || 0) - Number(a.analysis.score || 0);
      if (sortFilter === 'score_asc') return Number(a.analysis.score || 0) - Number(b.analysis.score || 0);
      if (sortFilter === 'deadline') {
        const da = getCriticalDeadline(asRecord(a.analysis), a.nextTask).date?.getTime() || Number.MAX_SAFE_INTEGER;
        const db = getCriticalDeadline(asRecord(b.analysis), b.nextTask).date?.getTime() || Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      const ca = parseOperationalDate(a.analysis.created_at)?.getTime() || 0;
      const cb = parseOperationalDate(b.analysis.created_at)?.getTime() || 0;
      return cb - ca;
    });
  }, [activityFilter, allQueueCards, companyFilter, companyOptions, etapasSelecionadas, monitorFilter, sortFilter, urgencyFilter, verdictFilter]);

  /** ⚠️ A TELA É SOBRE PRAZO E NÃO MOSTRAVA PRAZO NENHUM AO ABRIR.
   *
   *  Toda a maquinaria existia — `getCriticalDeadline`, `getDeadlineUrgency`, o
   *  filtro "Prazo", a ordenação "Prazo crítico" — mas nada disso acontece
   *  sozinho: o padrão ordena por "recente", e um edital vencido ontem aparece
   *  no meio do quadro, do mesmo tamanho e da mesma cor de um que vence daqui a
   *  três semanas. Quem abre a Gestão de manhã quer saber o que queima hoje, e
   *  precisava perguntar isso por meio de dois seletores.
   *
   *  Conta sobre `allQueueCards`, e não sobre `queueCards`, de propósito: é o
   *  risco da CARTEIRA. Contando o que já está filtrado, aplicar um filtro
   *  faria os vencidos "sumirem" — o oposto do objetivo. */
  const risco = useMemo(() => {
    const finais: DecisionQueueKey[] = ['won', 'lost', 'abandoned', 'executed'];
    const agora = Date.now();
    let vencidos = 0;
    let hojeAmanha = 0;
    for (const card of allQueueCards) {
      if (finais.includes(card.stage)) continue;   // encerrado não tem prazo a perder
      const prazo = getCriticalDeadline(asRecord(card.analysis), card.nextTask).date;
      if (!prazo) continue;
      const dias = Math.ceil((prazo.getTime() - agora) / 86_400_000);
      if (dias < 0) vencidos += 1;
      else if (dias <= 1) hojeAmanha += 1;
    }
    return { vencidos, hojeAmanha };
  }, [allQueueCards]);

  const activeSummaryCard = useMemo(() => {
    if (!summaryModal) return null;
    return allQueueCards.find((card) => card.analysis.id === summaryModal.analysis.id) || summaryModal;
  }, [allQueueCards, summaryModal]);

  /** ⚠️ CONTAVA `queueCards`, QUE JÁ VEM FILTRADO — e por isso quatro dos nove
   *  números eram zero por construção.
   *  O filtro padrão é `activityFilter: 'active'`, que descarta as etapas
   *  finais. Resultado: a faixa de resumo abria sempre com "0 Ganho, 0
   *  Perdido, 0 Abandonado, 0 Executado", inclusive para quem tinha dezenas de
   *  editais ganhos. Um resumo que não resume.
   *
   *  Agora conta `allQueueCards`: a carteira inteira dentro da busca por texto.
   *  A busca continua valendo (ela define o universo em questão); os seletores
   *  de recorte, não — eles definem o que o QUADRO mostra, e a faixa existe
   *  justamente para dizer o que existe fora dele. As etapas fora do recorte
   *  atual aparecem esmaecidas, para o número não ser confundido com o que
   *  está na tela. */
  const counts = useMemo(() => allQueueCards.reduce<Record<DecisionQueueKey, number>>((acc, card) => {
    acc[card.stage] += 1;
    return acc;
  }, {
    not_started: 0,
    triage: 0,
    pending: 0,
    proposal: 0,
    submitted: 0,
    won: 0,
    lost: 0,
    abandoned: 0,
    executed: 0,
  }), [allQueueCards]);

  /** ⚠️ O QUADRO ABRIA COM QUATRO COLUNAS QUE NÃO PODIAM CONTER NADA.
   *
   *  `activityFilter` começa em `'active'`, e o filtro descarta as quatro
   *  etapas finais (`if (activityFilter === 'active' && isFinal) return false`).
   *  Só que a grade renderizava as NOVE colunas de qualquer jeito — então o
   *  estado inicial era: cinco colunas de trabalho e, à direita delas, mil
   *  pixels de "Sem itens nesta fase" que o próprio filtro garantia que
   *  ficariam vazios. Quase metade da rolagem horizontal era dedicada a
   *  colunas estruturalmente impossíveis de preencher.
   *
   *  Renderizando só o que o filtro pode preencher, o caso comum (5 colunas)
   *  cabe em 1440px sem rolagem nenhuma — a barra horizontal deixa de existir
   *  no uso diário em vez de ser algo a domar com setinhas. */
  const colunasVisiveis = useMemo(() => {
    // Seleção explícita manda: escolher duas etapas devolve duas colunas
    // largas, que é o ganho concreto de poder selecionar mais de uma. Sem
    // isto, marcar "Proposta + Enviado" deixaria cinco colunas com três vazias.
    if (etapasSelecionadas.size > 0) return columnOrder.filter((k) => etapasSelecionadas.has(k));
    const finais: DecisionQueueKey[] = ['won', 'lost', 'abandoned', 'executed'];
    if (activityFilter === 'active') return columnOrder.filter((k) => !finais.includes(k));
    if (activityFilter === 'finalized') return columnOrder.filter((k) => finais.includes(k));
    return columnOrder;
  }, [activityFilter, etapasSelecionadas]);

  /** Largura mínima por coluna, medida e não estimada.
   *
   *  Com as 5 colunas do fluxo ativo, testei 250 / 240 / 230 / 220 px contra os
   *  três tamanhos de tela mais comuns:
   *    250 → cabe só em 1440px (1280 fica devendo 52px, um triz);
   *    240 → cabe em 1440 E em 1280, e o cartão não quebra linha em nenhum;
   *    230 e abaixo → a 1152px o título do edital começa a quebrar e o cartão
   *                   cresce de 86px para 101px de altura.
   *  240 é o maior valor que ainda elimina a rolagem no notebook de 1280. */
  const LARGURA_COLUNA = 240;

  /** Seleciona (ou desmarca) uma etapa, ajustando o recorte junto.
   *
   *  ⚠️ O DETALHE QUE FAZ ISTO FUNCIONAR: `activityFilter` começa em `'active'`,
   *  que descarta as quatro etapas finais. Sem mexer nele, clicar em "Ganho"
   *  cruzaria dois filtros contraditórios — etapa = ganho E recorte = ativos —
   *  e o quadro voltaria vazio, com a pessoa olhando para uma ficha que diz
   *  "12" e um board que diz "nada aqui". Filtro que se contradiz sozinho é
   *  pior que filtro nenhum.
   *
   *  Por isso a escolha da etapa arrasta o recorte para o lado certo. O mesmo
   *  vale ao contrário: escolher uma etapa do fluxo estando em "finalizados"
   *  volta para "ativos".
   *
   *  Usado pela faixa de fichas E pelo seletor "Etapa" do painel — o seletor
   *  tinha o mesmo defeito e ninguém tinha notado, porque escolher "Ganho" por
   *  lá também devolvia quadro vazio. */
  const ETAPAS_FINAIS: DecisionQueueKey[] = ['won', 'lost', 'abandoned', 'executed'];

  /** Ajusta o recorte para nunca contradizer a seleção de etapas.
   *
   *  ⚠️ COM SELEÇÃO MÚLTIPLA A REGRA PRECISOU DE UM TERCEIRO CASO. Com uma
   *  etapa só bastava "final → finalizados, ativa → ativos". Marcando
   *  "Enviado + Ganho" — que é exatamente o que alguém faz para ver o que
   *  mandou e o que voltou —, qualquer um dos dois recortes apagaria metade da
   *  seleção. Mistura pede `'all'`. */
  /** O recorte que valia ANTES de a seleção começar, para poder devolvê-lo.
   *
   *  ⚠️ SEM ISTO O CLIQUE NÃO DESFAZ. Um teste de mesa pegou: partindo do
   *  padrão (ativos), clicar em "Ganho" leva o recorte para "finalizados" — e
   *  clicar em "Ganho" de novo, esperando voltar ao ponto de partida, deixava
   *  a pessoa nos encerrados, olhando quatro colunas que ela não pediu. Um
   *  botão que liga e desliga precisa devolver o estado inteiro, não metade
   *  dele. Guardar o valor anterior também evita atropelar quem escolheu
   *  "Finalizados" à mão no painel antes de mexer nas fichas. */
  const recorteAntesDaSelecao = useRef<ActivityFilter | null>(null);

  const reconciliarRecorte = (sel: Set<DecisionQueueKey>) => {
    if (sel.size === 0) {
      if (recorteAntesDaSelecao.current) {
        setActivityFilter(recorteAntesDaSelecao.current);
        recorteAntesDaSelecao.current = null;
      }
      return;
    }
    if (recorteAntesDaSelecao.current === null) {
      setActivityFilter((atual) => { recorteAntesDaSelecao.current = atual; return atual; });
    }
    const temFinal = [...sel].some((k) => ETAPAS_FINAIS.includes(k));
    const temAtiva = [...sel].some((k) => !ETAPAS_FINAIS.includes(k));
    if (temFinal && temAtiva) setActivityFilter('all');
    else if (temFinal) setActivityFilter('finalized');
    else setActivityFilter('active');
  };

  /** Liga/desliga uma etapa na seleção. Conjunto vazio = todas. */
  const alternarEtapa = (key: DecisionQueueKey) => {
    setEtapasSelecionadas((antes) => {
      const proxima = new Set(antes);
      if (proxima.has(key)) proxima.delete(key); else proxima.add(key);
      reconciliarRecorte(proxima);
      return proxima;
    });
  };

  /** O seletor "Etapa" do painel é de escolha única (é um `<select>` nativo):
   *  escolher por lá SUBSTITUI a seleção inteira, em vez de somar. Some com a
   *  multi-seleção sem enganar — quem quer somar usa as fichas. */
  const selecionarEtapaUnica = (key: DecisionQueueKey | 'all') => {
    const proxima: Set<DecisionQueueKey> = key === 'all' ? new Set() : new Set([key]);
    setEtapasSelecionadas(proxima);
    reconciliarRecorte(proxima);
  };

  const updateBoardScrollState = () => {
    const el = boardScrollRef.current;
    if (!el) return;
    setBoardScroll({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  };

  useEffect(() => {
    const el = boardScrollRef.current;
    if (!el) return;

    updateBoardScrollState();
    const timer = window.setTimeout(updateBoardScrollState, 80);
    el.addEventListener('scroll', updateBoardScrollState, { passive: true });
    window.addEventListener('resize', updateBoardScrollState);

    return () => {
      window.clearTimeout(timer);
      el.removeEventListener('scroll', updateBoardScrollState);
      window.removeEventListener('resize', updateBoardScrollState);
    };
    // `colunasVisiveis.length` na lista: trocar o filtro muda a largura do
    // conteúdo, e sem recalcular as setinhas continuavam aparecendo (ou
    // sumidas) descrevendo o quadro anterior.
  }, [queueCards.length, searchText, colunasVisiveis.length]);

  const scrollBoard = (direction: 'left' | 'right') => {
    const el = boardScrollRef.current;
    if (!el) return;
    const distance = Math.round(el.clientWidth * 0.8);
    el.scrollBy({
      left: direction === 'right' ? distance : -distance,
      behavior: 'smooth',
    });
    window.setTimeout(updateBoardScrollState, 320);
  };

  const hasActiveFilters = Boolean(
    searchText.trim()
    || companyFilter !== 'all'
    || etapasSelecionadas.size > 0
    || verdictFilter !== 'all'
    || urgencyFilter !== 'all'
    || monitorFilter !== 'all'
    || activityFilter !== 'active'
    || sortFilter !== 'recent',
  );

  /** Filtros que, se estiverem ligados, NÃO têm nenhum sinal fora do painel —
   *  são os únicos que obrigam o painel a abrir.
   *
   *  ⚠️ USAR `hasActiveFilters` AQUI SERIA GROSSEIRO. Ele inclui coisas cujo
   *  estado já está à vista: a busca por texto (a caixa fica sempre visível e
   *  cheia), o recorte de encerrados (a faixa de contadores esmaece as etapas e
   *  oferece "Ver fluxo ativo") e a ordenação (que não esconde nada). Com ele,
   *  clicar em "1 prazo vencido" na faixa de risco escancararia sete seletores
   *  na cara de quem só queria ver os vencidos.
   *
   *  Estes quatro, não: se estiverem ligados e o painel estiver fechado, a
   *  pessoa vê uma lista curta sem nada em tela dizendo por quê. */
  const filtrosInvisiveisAtivos = Boolean(
    companyFilter !== 'all'
    // `stageFilter` SAIU DAQUI ao virar clicável: a ficha selecionada agora
    // fica com anel escuro na faixa, à vista. Mantê-lo forçaria o painel de
    // sete seletores a escancarar toda vez que alguém clicasse numa etapa.
    || verdictFilter !== 'all'
    || monitorFilter !== 'all',
  );

  const resetFilters = () => {
    setSearchText('');
    setCompanyFilter('all');
    setEtapasSelecionadas(new Set());
    setVerdictFilter('all');
    setUrgencyFilter('all');
    setMonitorFilter('all');
    setActivityFilter('active');
    setSortFilter('recent');
    setExpandedColumns({});
  };

  const openAnalysisDetail = async (analysis: SavedAnalysis) => {
    if (!analysis.id || loadingDetailId) return;

    setLoadingDetailId(analysis.id);
    try {
      const res = await apiFetch(`${API_URL}/api/analyses/${analysis.id}`);

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setNotice({ type: 'error', message: error?.detail || 'Erro ao abrir o laudo completo.' });
        return;
      }

      const data = await res.json();
      const fullAnalysis = data.analysis || analysis;
      setSelectedAnalysis(fullAnalysis);
      setAnalyses((prev) => prev.map((item) => item.id === analysis.id ? { ...item, ...fullAnalysis } : item));
      setDetailTab('analise');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setNotice({ type: 'error', message: 'Erro de conexão ao abrir o laudo.' });
    } finally {
      setLoadingDetailId(null);
    }
  };

  /* ⚠️ GANHOU `patch` PORQUE A EDIÇÃO MUDOU DE CASA.
   *
   * O plano de execução deixou de ser editável dentro do laudo (decisão do
   * dono: a análise MOSTRA, a Gestão EXECUTA). Só que a Gestão, até aqui,
   * sabia fazer uma coisa só com uma tarefa: marcar `done: true` na PRÓXIMA.
   * Responsável, prazo e nota nunca tiveram editor aqui — quem os preenchia
   * era o cockpit do laudo, que a Gestão abre por dentro.
   *
   * Sem isto, tornar o laudo somente-leitura teria REMOVIDO o preenchimento do
   * produto inteiro em vez de mudá-lo de lugar. `patch` generaliza o que já
   * existia (rollback otimista, PATCH, aviso) para qualquer campo. */
  const salvarTarefa = async (
    analysis: SavedAnalysis,
    task: DecisionQueueTask,
    patch: { done?: boolean; responsavel?: string; prazo?: string; nota?: string } = { done: true },
  ) => {
    if (!analysis.id) return;
    // ⚠️ ANTES ERA `if (!analysis.id || savingTaskId) return;` — e `savingTaskId`
    // é UM estado para o quadro inteiro, não por tarefa. O efeito: com um save
    // em voo em qualquer lugar da tela, TODA outra gravação virava um `return`
    // mudo. No editor de plano, que grava no `onBlur` e não desabilita os
    // campos, bastava passar de Responsável para Prazo com o Tab: o segundo
    // `onBlur` disparava antes do primeiro `await` voltar, e a edição sumia sem
    // erro — o texto continuava na tela, então parecia salvo.
    //
    // A fila serializa em vez de descartar. Recusar trabalho do usuário só se
    // justifica quando há como avisá-lo, e aqui não havia.
    await filaDeGravacaoRef.current;
    let liberar: () => void = () => {};
    filaDeGravacaoRef.current = new Promise<void>((r) => { liberar = r; });

    const statusBefore = normalizeDecisionCockpitStatus(analysis.cockpit_status);
    const nowIso = new Date().toISOString();
    const anterior = statusBefore[task.id] || {};
    const nextStatus = {
      ...statusBefore,
      [task.id]: {
        ...anterior,
        // O default da tarefa entra só na PRIMEIRA gravação; depois vence o que
        // o usuário digitou. Sem o `??`, salvar uma nota sobrescreveria o
        // responsável escolhido pelo texto que a IA sugeriu.
        responsavel: patch.responsavel ?? anterior.responsavel ?? task.responsavel,
        prazo: patch.prazo ?? anterior.prazo ?? task.prazo,
        nota: patch.nota ?? anterior.nota,
        done: patch.done ?? anterior.done ?? false,
        updated_at: nowIso,
      },
    };

    const quickId = `${analysis.id}-${task.id}`;
    setSavingTaskId(quickId);
    setAnalyses((prev) => prev.map((item) => (
      item.id === analysis.id
        ? { ...item, cockpit_status: nextStatus, cockpit_updated_at: nowIso }
        : item
    )));

    try {
      const res = await apiFetch(`${API_URL}/api/analyses/${analysis.id}/cockpit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: nextStatus }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setAnalyses((prev) => prev.map((item) => (
          item.id === analysis.id ? { ...item, cockpit_status: statusBefore } : item
        )));
        setNotice({ type: 'error', message: error?.detail || 'Não foi possível concluir a tarefa.' });
        return;
      }

      const data = await res.json().catch(() => null);
      if (data?.analysis) {
        setAnalyses((prev) => prev.map((item) => (
          item.id === analysis.id ? { ...item, ...(data.analysis as SavedAnalysis) } : item
        )));
      }
      // O aviso descreve o que ACONTECEU: a mesma função agora conclui e também
      // grava responsável/prazo/nota. Dizer "concluída" ao salvar uma nota
      // seria a tela relatando uma ação que não houve.
      setNotice({
        type: 'success',
        message: patch.done === true
          ? 'Ação concluída e salva no histórico.'
          : 'Alteração salva no histórico.',
      });
    } catch (err) {
      setAnalyses((prev) => prev.map((item) => (
        item.id === analysis.id ? { ...item, cockpit_status: statusBefore } : item
      )));
      if (err instanceof SessionExpiredError) return;
      setNotice({ type: 'error', message: 'Erro de conexão ao salvar a tarefa.' });
    } finally {
      setSavingTaskId(null);
      liberar();   // libera o próximo da fila, tenha dado certo ou não
    }
  };

  const updateWorkflowStage = async (
    analysis: SavedAnalysis,
    status: DecisionQueueKey,
  ) => {
    if (!analysis.id || savingStageId) return;

    const previousStatus = analysis.workflow_status;
    const nowIso = new Date().toISOString();
    const quickId = `${analysis.id}-workflow`;

    setSavingStageId(quickId);
    setAnalyses((prev) => prev.map((item) => (
      item.id === analysis.id
        ? { ...item, workflow_status: status, workflow_updated_at: nowIso }
        : item
    )));

    try {
      const res = await apiFetch(`${API_URL}/api/analyses/${analysis.id}/workflow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setAnalyses((prev) => prev.map((item) => (
          item.id === analysis.id ? { ...item, workflow_status: previousStatus } : item
        )));
        setNotice({ type: 'error', message: error?.detail || 'Não foi possível atualizar a etapa.' });
        return;
      }

      const data = await res.json().catch(() => null);
      if (data?.analysis) {
        setAnalyses((prev) => prev.map((item) => (
          item.id === analysis.id ? { ...item, ...(data.analysis as SavedAnalysis) } : item
        )));
      }
      setSummaryModal((prev) => prev?.analysis.id === analysis.id ? null : prev);
      const finalStages: DecisionQueueKey[] = ['won', 'lost', 'abandoned', 'executed'];
      if (finalStages.includes(status) && activityFilter === 'active') {
        setActivityFilter('all');
      }
      setNotice({ type: 'success', message: `Edital movido para ${decisionQueueStages[status].label}.` });
    } catch (err) {
      setAnalyses((prev) => prev.map((item) => (
        item.id === analysis.id ? { ...item, workflow_status: previousStatus } : item
      )));
      if (err instanceof SessionExpiredError) return;
      setNotice({ type: 'error', message: 'Erro de conexão ao atualizar a etapa.' });
    } finally {
      setSavingStageId(null);
    }
  };

  const reviewDecision = async (
    card: DecisionQueueCardModel,
    payload: { tipo: string; titulo: string; conteudo: string },
  ) => {
    if (!card.analysis.id || savingReviewId) return;

    setSavingReviewId(card.analysis.id);
    try {
      const res = await apiFetch(`${API_URL}/api/analyses/${card.analysis.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setNotice({ type: 'error', message: error?.detail || 'Não foi possível revisar a decisão.' });
        return;
      }

      const data = await res.json().catch(() => null);
      const updated = data?.analysis as SavedAnalysis | undefined;
      if (updated) {
        setAnalyses((prev) => prev.map((item) => (
          item.id === card.analysis.id ? { ...item, ...updated } : item
        )));
      }
      setReviewModal(null);
      const newScore = updated?.score != null ? ` Novo score: ${updated.score}.` : '';
      setNotice({
        type: 'success',
        message: `IA reprocessou o laudo e atualizou a recomendação.${newScore} O edital voltou para triagem.`,
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setNotice({ type: 'error', message: 'Erro de conexão ao revisar a decisão.' });
    } finally {
      setSavingReviewId(null);
    }
  };

  const saveLearning = async (
    card: DecisionQueueCardModel,
    payload: { participou: boolean; resultado: string; preco_final: string; vencedor: string; observacao: string; contrato_inicio: string; contrato_fim: string },
  ) => {
    if (!card.analysis.id || savingLearningId) return;

    setSavingLearningId(card.analysis.id);
    try {
      const res = await apiFetch(`${API_URL}/api/analyses/${card.analysis.id}/learning`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setNotice({ type: 'error', message: error?.detail || 'Não foi possível registrar o resultado.' });
        return;
      }

      const data = await res.json().catch(() => null);
      if (data?.analysis) {
        setAnalyses((prev) => prev.map((item) => (
          item.id === card.analysis.id ? { ...item, ...(data.analysis as SavedAnalysis) } : item
        )));
      }
      setLearningModal(null);
      // ⚠️ AQUI SE PROMETIA UM CICLO DE APRENDIZADO QUE NÃO EXISTE.
    // A frase era "a Bawzi usará esse histórico nas próximas decisões". O campo
    // `decision_learning` é gravado por esta rota e pelo worker de resultados,
    // e é lido em UM lugar só: `GET /analyses/learning-stats`, que calcula a
    // taxa de acerto exibida no banner. Nenhum arquivo de `app/services/` — nem
    // o `ai_router` — sequer menciona o campo: o laudo seguinte não sabe que
    // este resultado existe. Prometer que a IA aprende com o que a pessoa
    // registra, e não aprender, é a promessa mais cara de desmentir, porque ela
    // só é verificável depois de meses de uso fiel.
    setNotice({ type: 'success', message: 'Resultado registrado — ele entra na sua taxa de acerto.' });
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setNotice({ type: 'error', message: 'Erro de conexão ao registrar o resultado.' });
    } finally {
      setSavingLearningId(null);
    }
  };

  const scoreColors = (score: number) =>
    score >= 70
      ? { bar: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-100', label: 'Go' }
      : score >= 45
        ? { bar: 'bg-amber-400', text: 'text-amber-700', light: 'bg-amber-50', border: 'border-amber-100', label: 'Atenção' }
        : { bar: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50', border: 'border-red-100', label: 'No-Go' };

  const renderNotice = () => notice && (
    <div className={`fixed bottom-5 right-5 z-[130] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${
      notice.type === 'success'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
        : notice.type === 'error'
          ? 'border-red-100 bg-red-50 text-red-800'
          : 'border-sky-100 bg-sky-50 text-sky-800'
    }`}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current opacity-70" />
        <p className="leading-relaxed">{notice.message}</p>
        <button
          onClick={() => setNotice(null)}
          className="ml-2 text-current opacity-50 transition-opacity hover:opacity-100"
          aria-label="Fechar aviso"
        >
          ×
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="p-20 text-center animate-pulse text-slate-400 font-black uppercase tracking-widest text-xs">Carregando a gestão de decisões...</div>;
  }

  if (selectedAnalysis) {
    return (
      <div
        ref={laudoRef}
        className="space-y-5 overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-500 pb-16 [&:fullscreen]:bg-slate-50 [&:fullscreen]:p-4"
      >
        {renderNotice()}
        <div className="sticky top-0 z-30 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
              if (sidebarHidden) onToggleSidebar?.();
              setSelectedAnalysis(null);
              setDetailTab('analise');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase text-slate-600 transition-all hover:border-slate-300 hover:text-slate-950"
          >
            ← Voltar para gestão
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700">
              Laudo aberto pela gestão
            </span>
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                title={sidebarHidden ? 'Mostrar menu' : 'Ocultar menu para ganhar espaço'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-600 transition-all hover:border-slate-300 hover:text-slate-950"
              >
                {sidebarHidden ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
                {sidebarHidden ? 'Mostrar menu' : 'Ocultar menu'}
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleFullscreen(laudoRef)}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-600 transition-all hover:border-slate-300 hover:text-slate-950"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            </button>
          </div>
        </div>

        <AnalysisResults
          result={selectedAnalysis as unknown as AnalysisResult}
          activeTab={detailTab}
          onSetActiveTab={(tab) => setDetailTab(tab === 'concorrentes' ? 'concorrentes' : 'analise')}
          userTier={getCachedTier(userTier)}
          currentTier={getCachedTier(userTier)}
          termoAlvo={selectedAnalysis.termo_busca_pncp || selectedAnalysis.title || 'Gestão'}
          analysisId={selectedAnalysis.id}
          token={token}
          isSharing={false}
          onShare={() => setNotice({ type: 'info', message: 'Compartilhamento disponível na Central de Decisões.' })}
          onReset={() => {
            setSelectedAnalysis(null);
            setDetailTab('analise');
          }}
          resetLabel="Voltar para gestão"
          onExportPDF={() => window.print()}
          modelSource={selectedAnalysis.model_source || selectedAnalysis.modelSource || 'Motor Bawzi IA'}
          isCachedResult={false}
          onUpgradeClick={() => setNotice({ type: 'info', message: 'Faça upgrade pelo painel de planos para desbloquear este recurso.' })}
          onTrackedChange={(tracked) => {
            // Gestão só lista o que está marcado como tracked_in_gestao — se o
            // usuário remove o acompanhamento aqui de dentro, o item precisa
            // sumir do board assim que ele voltar, sem esperar um reload.
            if (!tracked) {
              setAnalyses((prev) => prev.filter((item) => item.id !== selectedAnalysis.id));
              setNotice({ type: 'info', message: 'Removido da Gestão. O laudo continua disponível em Decisões.' });
            } else {
              setAnalyses((prev) => prev.map((item) => (
                item.id === selectedAnalysis.id ? { ...item, tracked_in_gestao: true } : item
              )));
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={quadroRef}
      className="animate-in fade-in duration-500 space-y-5 [&:fullscreen]:overflow-y-auto [&:fullscreen]:bg-slate-50 [&:fullscreen]:p-4 md:[&:fullscreen]:p-8"
    >
      {renderNotice()}
      {activeSummaryCard && (
        <OperationalSummaryModal
          card={activeSummaryCard}
          foco={focoDoResumo}
          savingTaskId={savingTaskId}
          savingStageId={savingStageId}
          onClose={() => { setSummaryModal(null); setFocoDoResumo(null); }}
          onOpenLaudo={(analysis) => {
            setSummaryModal(null);
            void openAnalysisDetail(analysis);
          }}
          onComplete={(a, t) => salvarTarefa(a, t, { done: true })}
          onSalvarTarefa={salvarTarefa}
          onStageChange={updateWorkflowStage}
          onReviewRequest={(card) => {
            setSummaryModal(null);
            setReviewModal(card);
          }}
          onLearningRequest={(card) => {
            setSummaryModal(null);
            setLearningModal(card);
          }}
        />
      )}
      {reviewModal && (
        <DecisionReviewModal
          card={reviewModal}
          isSaving={savingReviewId === reviewModal.analysis.id}
          onClose={() => setReviewModal(null)}
          onSubmit={reviewDecision}
        />
      )}
      {learningModal && (
        <LearningModal
          card={learningModal}
          isSaving={savingLearningId === learningModal.analysis.id}
          onClose={() => setLearningModal(null)}
          onSubmit={saveLearning}
        />
      )}

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        {/* ⚠️ SEM FAIXA PRÓPRIA. Este alerta já foi um bloco de largura inteira,
            com fundo âmbar e o rótulo "PRECISA DE VOCÊ AGORA" em caixa alta —
            uma banda de ~46px para exibir UM número. Desproporcional: o alerta
            mais importante da tela não precisa da maior área, precisa do melhor
            LUGAR. E o cabeçalho tinha o lado direito inteiro vazio, ao lado de
            um título que ocupa 40% da linha.
            Agora ele mora ali, na altura dos olhos junto do título, sem gastar
            uma linha vertical sequer. O rótulo em caixa alta saiu junto: os
            próprios chips já dizem "1 prazo vencido" — em vermelho, com ícone
            de alerta. Repetir "precisa de você agora" antes disso era enfeite. */}
        {/* ⚠️ `flex-col` ATÉ `md`, e isso não é preciosismo: medido.
            Com `flex-wrap` + `shrink-0` nos chips, a 390px eles reservavam
            ~150px e sobravam 176px para o título — que passava a quebrar em
            quatro linhas e levava o cabeçalho de 596px para 710px. O alerta
            economizava 55px no desktop e custava 114px no celular. Lado a lado
            só onde há largura para os dois. */}
        <div className="flex flex-col gap-3 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 p-5 md:flex-row md:items-start md:justify-between md:gap-6 md:p-7">
          <div className="min-w-0 md:flex-1">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-emerald-700 shadow-sm">
                <ClipboardList size={13} />
                Gestão de execução
              </div>
              {/* Só tela cheia aqui. O botão de ocultar menu lateral existe na
                  visão de laudo e no painel de resultados, onde o utilizador
                  está mergulhado num documento e quer largura. O quadro é tela
                  de NAVEGAÇÃO: esconder a navegação a partir dela é armadilha —
                  some a coluna inteira e o caminho de volta é o mesmo ícone,
                  sem rótulo. Se voltar a fazer sentido, ponha com texto. */}
              <button
                type="button"
                onClick={() => toggleFullscreen(quadroRef)}
                title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia — usar 100% da largura'}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Fluxo completo dos editais</h2>
            {/* ⚠️ O SUBTÍTULO ERA DECORAÇÃO PERMANENTE.
                Dizia "acompanhe cada edital desde o primeiro contato
                operacional até envio, resultado e execução/encerramento" — uma
                descrição do produto, relida todo dia por quem já sabe o que a
                tela faz, ocupando duas linhas no topo. Agora ele carrega
                ESTADO: quantos editais existem aqui. A descrição do fluxo,
                quem quer, lê na faixa de etapas logo abaixo, que mostra a
                sequência inteira com os números reais.
                E os dois parágrafos de ensino viraram um: o segundo explicava
                o opt-in em três linhas; ele continua, resumido, na mesma
                frase. */}
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              {analyses.length > 0 ? (
                <>
                  <strong className="font-black text-slate-800">
                    {analyses.length} {analyses.length === 1 ? 'edital em acompanhamento' : 'editais em acompanhamento'}
                  </strong>
                  {' '}— só entram aqui os que você marcou com{' '}
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">+ Gestão</span>
                  {' '}na análise. Os demais continuam em Decisões.
                </>
              ) : (
                <>Acompanhe cada edital desde o primeiro contato operacional até envio, resultado e execução.</>
              )}
            </p>
          </div>

          {analyses.length > 0 && (risco.vencidos > 0 || risco.hojeAmanha > 0) && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {/* ⚠️ FUNDO SÓLIDO, NÃO TINTA CLARA. A primeira versão usava
                  `bg-red-50` com texto `text-red-700` — o padrão de chip suave
                  do resto da tela. Num cabeçalho que já é branco e claro, ele
                  simplesmente sumia: o alerta mais importante da tela era o
                  elemento menos visível dela.
                  O número ganha caixa própria porque é ele que se lê primeiro:
                  com cinco vencidos, "5" precisa saltar antes da palavra.

                  ⚠️ E AS CORES SÃO AS QUE PASSAM NO CONTRASTE, não as óbvias.
                  Branco sobre `amber-500` dá 2,15:1 e sobre `amber-600` dá
                  3,19:1 — os dois reprovam no mínimo de 4,5:1 para texto de
                  12px em negrito. Só `amber-700` passa (5,02:1). No vermelho,
                  `red-500` também reprova (3,76:1); `red-600` passa (4,83:1).
                  Medido antes de escolher. */}
              {risco.vencidos > 0 && (
                <button
                  type="button"
                  onClick={() => { setUrgencyFilter('late'); setActivityFilter('active'); setSortFilter('deadline'); }}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2.5 text-xs font-black text-white shadow-md shadow-red-600/25 transition-all hover:bg-red-700"
                >
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-white/20 px-1 text-sm font-black tabular-nums">
                    {risco.vencidos}
                  </span>
                  {risco.vencidos === 1 ? 'prazo vencido' : 'prazos vencidos'}
                </button>
              )}
              {risco.hojeAmanha > 0 && (
                <button
                  type="button"
                  onClick={() => { setUrgencyFilter('urgent'); setActivityFilter('active'); setSortFilter('deadline'); }}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-3.5 py-2.5 text-xs font-black text-white shadow-md shadow-amber-700/25 transition-all hover:bg-amber-800"
                >
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-white/20 px-1 text-sm font-black tabular-nums">
                    {risco.hojeAmanha}
                  </span>
                  {risco.hojeAmanha === 1 ? 'vence hoje/amanhã' : 'vencem hoje/amanhã'}
                </button>
              )}
              {urgencyFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setUrgencyFilter('all')}
                  className="text-[11px] font-bold text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-800"
                >
                  Ver todos
                </button>
              )}
            </div>
          )}
        </div>

        {/* ⚠️ AS NOVE ETAPAS EM UMA LINHA SÓ, e para isso a faixa precisou sair
            de dentro da coluna direita do cabeçalho.
            Ela morava numa grade `grid-cols-2 / sm:3 / xl:5` espremida ao lado
            do título: nove itens em cinco colunas viram duas fileiras
            desalinhadas (5 + 4), e a leitura de um fluxo — que é sequencial por
            natureza — passava a exigir uma quebra de linha no meio da
            sequência. Ocupando a largura inteira, e com número e rótulo lado a
            lado dentro de cada ficha (em vez de empilhados), as nove cabem numa
            fileira só.
            `overflow-x-auto` + `shrink-0`: no celular nove fichas não cabem de
            jeito nenhum, e rolar a faixa preserva a leitura em sequência —
            quebrar em duas linhas é o que se está corrigindo aqui. */}
        <div className="flex items-stretch gap-2 overflow-x-auto border-t border-slate-100 bg-white px-5 py-3 md:px-7">
          {columnOrder.map((key) => {
            const stage = decisionQueueStages[key];
            const noRecorte = colunasVisiveis.includes(key);
            const selecionada = etapasSelecionadas.has(key);
            return (
              <React.Fragment key={key}>
                {/* A seta antes das etapas de RESULTADO marca onde o fluxo
                    linear termina e vira desfecho — era o que a legenda
                    separada fazia com uma segunda fileira e um "↳". */}
                {key === 'won' && (
                  <span className="flex shrink-0 items-center px-0.5 text-slate-300" aria-hidden="true">
                    <ChevronRight size={14} />
                  </span>
                )}
                {/* ⚠️ DESABILITADA COM ZERO. Contagem vazia é a única em que o
                    clique tem resultado garantido e inútil: filtra para uma
                    etapa que não tem nada e devolve "nada corresponde à busca".
                    Desabilitar diz a mesma coisa antes do clique. */}
                <button
                  type="button"
                  onClick={() => alternarEtapa(key)}
                  disabled={counts[key] === 0}
                  aria-pressed={selecionada}
                  title={
                    counts[key] === 0
                      ? `${stage.label} — nenhum edital nesta etapa`
                      : selecionada
                        ? `${stage.label} selecionada — clique para tirar do filtro`
                        : `${stage.helper} — clique para somar ao filtro`
                  }
                  className={`flex shrink-0 items-center gap-2 rounded-xl border py-2 pr-3 shadow-sm transition-all ${stage.className} ${
                    selecionada
                      ? 'pl-2 ring-2 ring-slate-900 ring-offset-1'
                      : counts[key] === 0
                        ? 'cursor-not-allowed pl-3 opacity-40'
                        : noRecorte
                          ? 'pl-3 hover:-translate-y-0.5 hover:shadow-md'
                          : 'pl-3 opacity-40 hover:opacity-100'
                  }`}
                >
                  {/* O check só aparece na selecionada. Com várias marcadas, o
                      anel sozinho obriga a comparar bordas de fichas coloridas
                      para saber quais entraram — o ✓ responde item a item. */}
                  {selecionada && <Check size={13} strokeWidth={3.5} className="shrink-0" />}
                  <span className="text-lg font-black leading-none tabular-nums">{counts[key]}</span>
                  <span className="text-[9px] font-black uppercase leading-tight tracking-wide opacity-70">
                    {stage.label}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
          {/* Estava na legenda; vem para cá junto com ela. É o caminho de volta
              para as etapas esmaecidas ao lado. */}
          <button
            type="button"
            onClick={() => setActivityFilter(activityFilter === 'active' ? 'finalized' : 'active')}
            className="ml-1 shrink-0 self-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
          >
            {activityFilter === 'active' ? 'Ver encerrados' : 'Ver fluxo ativo'}
          </button>
        </div>

        {/* Métrica que exige 5 resultados registados: com zero editais o
            utilizador está a seis passos disto e o aviso só rouba atenção. */}
        {analyses.length > 0 && <LearningStatsBanner stats={learningStats} />}

        {/* Sete controlos para filtrar coisa nenhuma, mais o selo "0 de 0",
            é o que o utilizador via ao chegar aqui pela primeira vez. */}
        {analyses.length > 0 && (
        <div className="border-t border-slate-100 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar por título, órgão, UF, termo ou decisão..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-xs font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* ⚠️ SETE SELETORES ABERTOS O TEMPO TODO, para uma carteira que
                normalmente tem uma dúzia de itens. A busca por texto resolve a
                maioria dos casos e continua sempre visível; o resto vira sob
                demanda.
                ⚠️ E NUNCA FECHA COM FILTRO ATIVO (`hasActiveFilters` força
                aberto): esconder um recorte que está sendo aplicado faz o
                usuário ver uma lista curta sem nada em tela explicando por quê
                — o mesmo erro do filtro de órgão no Radar. */}
            <button
              type="button"
              onClick={() => setFiltrosAbertos((v) => !v)}
              aria-expanded={filtrosAbertos || filtrosInvisiveisAtivos}
              className={`inline-flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] font-black uppercase transition-all ${
                hasActiveFilters
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal size={13} className={hasActiveFilters ? 'text-emerald-600' : 'text-slate-400'} />
                Filtros
                <ChevronRight size={12} className={`transition-transform ${filtrosAbertos || filtrosInvisiveisAtivos ? 'rotate-90' : ''}`} />
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-slate-700 shadow-sm">
                {queueCards.length} de {analyses.length}
              </span>
            </button>

            {/* ⚠️ "Limpar filtros" ocupava uma LINHA INTEIRA só para ele,
                alinhada à direita, abaixo dos sete seletores — e só aparecia
                quando havia filtro ativo, ou seja, empurrava todo o quadro para
                baixo justamente no momento em que a pessoa estava mexendo nos
                filtros e queria ver o resultado.
                Aqui, ao lado do botão que ele desfaz: mesma linha, zero altura
                nova, e a relação entre os dois fica óbvia. `shrink-0` porque
                ele nunca deve ser comprimido pela caixa de busca ao lado. */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <RotateCcw size={12} />
                Limpar
              </button>
            )}
          </div>

          <div className={`mt-3 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 ${filtrosAbertos || filtrosInvisiveisAtivos ? 'grid' : 'hidden'}`}>
            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Empresa</span>
              <select
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value as CompanyFilter)}
                disabled={companyOptions.length === 0}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="all">{companyOptions.length ? 'Todas' : 'Sem empresas'}</option>
                {companyOptions.map((company) => {
                  const cnpj = cleanCnpj(company.cnpj);
                  return (
                    <option key={cnpj} value={cnpj}>
                      {getCompanyLabel(company)}
                    </option>
                  );
                })}
                <option value="unlinked">Sem vínculo</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Etapa</span>
              {/* ⚠️ UM `<select>` NATIVO NÃO SABE MOSTRAR DUAS ETAPAS.
                  Com várias marcadas nas fichas, exibir a primeira seria
                  mentira ("Etapa: Proposta" com Enviado também ligado). A
                  opção `__varias__` existe só para ele ter o que exibir nesse
                  caso, e está desabilitada porque não é uma escolha — é um
                  estado. Escolher qualquer outra substitui a seleção inteira. */}
              <select
                value={etapasSelecionadas.size === 0 ? 'all' : etapasSelecionadas.size === 1 ? [...etapasSelecionadas][0] : '__varias__'}
                onChange={(event) => selecionarEtapaUnica(event.target.value as 'all' | DecisionQueueKey)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                {etapasSelecionadas.size > 1 && (
                  <option value="__varias__" disabled>{etapasSelecionadas.size} etapas marcadas</option>
                )}
                <option value="all">Todas</option>
                {columnOrder.map((key) => (
                  <option key={key} value={key}>{decisionQueueStages[key].label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Status</span>
              <select
                value={activityFilter}
                onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="active">Ativos</option>
                <option value="finalized">Finalizados</option>
                <option value="all">Todos</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Decisão</span>
              <select
                value={verdictFilter}
                onChange={(event) => setVerdictFilter(event.target.value as VerdictFilter)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">Todas</option>
                <option value="go">Go</option>
                <option value="attention">Atenção</option>
                <option value="nogo">No-Go</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Prazo</span>
              <select
                value={urgencyFilter}
                onChange={(event) => setUrgencyFilter(event.target.value as UrgencyFilter)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">Todos</option>
                <option value="late">Vencidos</option>
                <option value="urgent">Hoje/amanhã</option>
                <option value="week">Próx. 7 dias</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">PNCP</span>
              <select
                value={monitorFilter}
                onChange={(event) => setMonitorFilter(event.target.value as MonitorFilter)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">Todos</option>
                <option value="changed">Com mudança</option>
                <option value="monitored">Monitorados agora</option>
                <option value="unmonitored">Sem monitoramento</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Ordenar</span>
              <select
                value={sortFilter}
                onChange={(event) => setSortFilter(event.target.value as SortFilter)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="recent">Mais recentes</option>
                <option value="deadline">Prazo crítico</option>
                <option value="score_desc">Maior score</option>
                <option value="score_asc">Menor score</option>
              </select>
            </label>
          </div>

        </div>
        )}
      </div>

      {/* ⚠️ FALHA VEM ANTES DE VAZIO, e a ordem é o conserto.
          Enquanto este ramo não existia, um 500 ou um 403 produziam `[]` e a
          tela caía no "Nenhum edital na Gestão ainda" — dizendo a quem tem
          quarenta editais em acompanhamento que ele nunca adicionou nenhum.
          Agora a lista vazia só é interpretada como vazia quando a carga
          realmente deu certo. */}
      {erroDeCarga ? (
        <div className="rounded-[2rem] border border-red-200 bg-red-50/60 py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-red-500">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-black text-red-900">Não consegui carregar seus editais</h3>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium text-red-800/80">{erroDeCarga}</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] font-medium text-red-700/60">
            Isto é uma falha de carregamento — nada foi perdido. Seus editais em
            acompanhamento continuam salvos.
          </p>
          <button
            type="button"
            onClick={() => setRecarregar((n) => n + 1)}
            className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-red-700"
          >
            <RefreshCw size={14} />
            Tentar de novo
          </button>
        </div>
      ) : queueCards.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white py-20 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <Search size={24} />
          </div>
          {analyses.length === 0 ? (
            <>
              <h3 className="text-lg font-black text-slate-800">Nenhum edital na Gestão ainda</h3>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-500">
                A Gestão só mostra editais adicionados de propósito. Abra uma análise em Decisões e clique em{' '}
                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-black text-emerald-700">+ Gestão</span>{' '}
                para trazê-la para cá.
              </p>
              {/* Sem isto a tela dá uma instrução e não oferece como cumpri-la:
                  em /gestao não existe barra lateral, logo "Decisões" não está
                  visível em lado nenhum. O ?tab= é lido pelo analysis-app. */}
              <button
                type="button"
                onClick={() => router.push('/workspace?tab=history')}
                className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-slate-800"
              >
                Ir para Decisões
                <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-black text-slate-800">Nada para gerir agora</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Nenhuma decisão salva corresponde à busca atual.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="relative">
          {boardScroll.left && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-slate-50 via-slate-50/85 to-transparent" />
              <button
                type="button"
                onClick={() => scrollBoard('left')}
                aria-label="Ver etapas anteriores"
                title="Ver etapas anteriores"
                className="absolute left-2 top-10 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition-all hover:-translate-x-0.5 hover:border-slate-300 hover:text-slate-950"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          )}

          {boardScroll.right && (
            <>
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent" />
              <button
                type="button"
                onClick={() => scrollBoard('right')}
                aria-label="Ver próximas etapas"
                title="Ver próximas etapas"
                className="absolute right-2 top-10 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-100 bg-white text-emerald-700 shadow-lg transition-all hover:translate-x-0.5 hover:border-emerald-200 hover:bg-emerald-50"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}

          {/* A legenda de fluxo que ficava aqui foi FUNDIDA na faixa de
              contadores, no topo da tela. Ela listava as mesmas nove etapas, na
              mesma ordem, a duas telas de distância dos contadores que já
              listavam as mesmas nove etapas com os números — duas fileiras
              dizendo a mesma sequência. O que ela tinha de próprio (a seta
              separando fluxo de resultado, e o botão "Ver encerrados") está
              agora dentro da faixa. */}
          <div ref={boardScrollRef} className="overflow-x-auto scroll-smooth pb-3">
            {/* Grade por `style` e não por classe: `grid-cols-${n}` dinâmico
                não existe para o Tailwind, que precisa da classe literal no
                código para gerá-la. */}
            <div
              className="grid gap-3"
              style={{
                minWidth: colunasVisiveis.length * LARGURA_COLUNA,
                gridTemplateColumns: `repeat(${colunasVisiveis.length}, minmax(0, 1fr))`,
              }}
            >
            {colunasVisiveis.map((stageKey) => {
              const stage = decisionQueueStages[stageKey];
              const cards = queueCards.filter((card) => card.stage === stageKey);
              const isExpanded = expandedColumns[stageKey] ?? false;
              const visibleCards = isExpanded ? cards : cards.slice(0, CARDS_PER_COLUMN);
              const hiddenCount = cards.length - visibleCards.length;
              const stageIndex = decisionQueueOrder.indexOf(stageKey) + 1;
              const isFinalStage = ['won', 'lost', 'abandoned', 'executed'].includes(stageKey);

              return (
                <section key={stageKey} className={`min-w-0 rounded-[1.5rem] border p-3 ${isFinalStage ? 'border-zinc-200 bg-zinc-50/60' : 'border-slate-200 bg-slate-50/70'}`}>
                  <div className="mb-3 flex items-center justify-between gap-2 px-1">
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase text-slate-700">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-black ${isFinalStage ? 'bg-slate-200 text-slate-500' : 'bg-slate-800 text-white'}`}>
                          {stageIndex}
                        </span>
                        <span className={`h-2 w-2 rounded-full ${stage.dotClass}`} />
                        {stage.label}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-500">{stage.helper}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 shadow-sm">
                      {cards.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {cards.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-[11px] font-bold text-slate-400">
                        Sem itens nesta fase
                      </div>
                    ) : visibleCards.map((card) => (
                      <DecisionQueueCard
                        key={card.analysis.id}
                        card={card}
                        loadingDetailId={loadingDetailId}
                        savingTaskId={savingTaskId}
                        savingStageId={savingStageId}
                        onOpen={openAnalysisDetail}
                        onOpenSummary={(c, foco) => { setFocoDoResumo(foco ?? null); setSummaryModal(c); }}
                        onComplete={(a, t) => salvarTarefa(a, t, { done: true })}
                        onStageChange={updateWorkflowStage}
                        scoreColors={scoreColors}
                      />
                    ))}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleColumnExpand(stageKey)}
                        className="w-full rounded-2xl border border-slate-200 bg-white py-2 text-[11px] font-black text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                      >
                        Ver mais {hiddenCount} edita{hiddenCount === 1 ? 'l' : 'is'} ↓
                      </button>
                    )}
                    {isExpanded && cards.length > CARDS_PER_COLUMN && (
                      <button
                        type="button"
                        onClick={() => toggleColumnExpand(stageKey)}
                        className="w-full rounded-2xl border border-slate-200 bg-white py-2 text-[11px] font-black text-slate-400 transition-colors hover:bg-slate-50"
                      >
                        Recolher ↑
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DecisionQueueCard({
  card,
  loadingDetailId,
  savingTaskId,
  savingStageId,
  onOpen,
  onOpenSummary,
  onComplete,
  onStageChange,
  scoreColors,
}: {
  card: DecisionQueueCardModel;
  loadingDetailId: string | null;
  savingTaskId: string | null;
  savingStageId: string | null;
  onOpen: (analysis: SavedAnalysis) => void;
  onOpenSummary: (card: DecisionQueueCardModel, foco?: 'plano') => void;
  onComplete: (analysis: SavedAnalysis, task: DecisionQueueTask) => void;
  onStageChange: (analysis: SavedAnalysis, status: DecisionQueueKey) => void;
  scoreColors: (score: number) => { bar: string; text: string; light: string; border: string; label: string };
}) {
  const score = Number(card.analysis.score || 0);
  const colors = scoreColors(score);
  const createdDate = card.analysis.created_at
    ? new Date(card.analysis.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : 'Sem data';
  const quickTaskId = card.nextTask ? `${card.analysis.id}-${card.nextTask.id}` : '';
  const workflowTaskId = `${card.analysis.id}-workflow`;
  const nextStage = getNextDecisionQueueStage(card.stage);
  const operational = getOperationalContext(card.analysis, card.stage, card.nextTask);
  const learnedResult = getResultLabel(card.analysis);
  const vigenciaStatus = getVigenciaStatus(card.analysis);
  const resultadoAutomatico = card.analysis.decision_learning?.origem === 'pncp_auto';

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-1 ${colors.bar}`} />
      <div className="p-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                <CalendarDays size={10} />
                {createdDate}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${colors.light} ${colors.text}`}>
                {colors.label}
              </span>
            </div>
            <h3 className="line-clamp-2 text-sm font-black leading-snug text-slate-950">
              {card.analysis.title || 'Análise de edital'}
            </h3>
          </div>
          <div className={`shrink-0 rounded-xl border px-2 py-1 text-center ${colors.light} ${colors.border}`}>
            <p className={`text-lg font-black leading-none ${colors.text}`}>{score}</p>
            <p className="mt-0.5 text-[8px] font-black uppercase text-slate-400">score</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenSummary(card)}
          className="mb-3 flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm"
        >
          <span className="flex w-full min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
              <FileText size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-black text-slate-800">Resumo do edital</span>
              <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Órgão, valor, prazo e status
              </span>
            </span>
          </span>
          <span className="flex w-full items-center justify-between gap-2">
            <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${operational.urgency.className}`}>
              {operational.urgency.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
              Abrir
              <ArrowRight size={13} />
            </span>
          </span>
        </button>

        {learnedResult && (
          <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-[11px] font-black leading-snug text-emerald-800">
            {resultadoAutomatico && (
              <span
                title="Resultado preenchido automaticamente a partir da homologação pública do PNCP. Use 'Registrar resultado' para ajustar — a edição manual substitui o automático."
                className="mb-1.5 inline-flex cursor-help items-center gap-1 rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-violet-700"
              >
                Automático · PNCP
              </span>
            )}
            {learnedResult}
          </div>
        )}

        {vigenciaStatus && (
          <div className={`mb-3 flex items-center gap-1.5 rounded-xl border p-2.5 text-[10px] font-black leading-snug ${vigenciaStatus.className}`}>
            <CalendarDays size={11} className="shrink-0" />
            {vigenciaStatus.label}
          </div>
        )}

        {/* ⚠️ O BLOCO INTEIRO É O BOTÃO, e isso corrige duas gerações de erro
            no mesmo lugar.
            Primeiro era um ícone de 20px sem rótulo, com o texto só no `title`
            — que não existe em toque, justamente onde o alvo já era pequeno
            demais. Depois eu "consertei" o alvo com `box-content p-2`, e o
            resultado foi pior: o fundo verde passou a pintar os 38px inteiros
            com um ícone de 10px flutuando no meio, ocupando 26% da área. Virou
            um selo decorativo — e um render lado a lado deixou isso óbvio.
            O erro dos dois era o mesmo: tentar resolver por tamanho o que era
            problema de RÓTULO. Concluir a ação é o verbo desta tela, e estava
            escrito em lugar nenhum.
            Alvo agora é a caixa toda (largura do cartão × ~64px) e o rótulo diz
            o que o clique faz. Custo zero de altura: medido em 272px, o mesmo
            do desenho anterior, então nenhum cartão a menos por coluna. */}
        {/* ⚠️ DOIS ALVOS, PORQUE SÃO DUAS INTENÇÕES.
            A versão anterior fazia a caixa inteira concluir a tarefa — e o
            texto da ação é cortado em duas linhas (`line-clamp-2`). Uma ação
            real como "Conferir habilitação, licença sanitária, autorizações
            aplicáveis e atestado de capacidade técnica" não cabe, e o único
            clique disponível marcava como feita em vez de deixar ler. Pedir
            para concluir algo que a pessoa não conseguiu terminar de ler é o
            oposto do que esta tela deveria fazer.
            Agora o círculo conclui e o texto abre o plano inteiro (mesmo modal
            do "Resumo do edital", onde a lista aparece sem corte e editável).
            Irmãos e não aninhados: botão dentro de botão é HTML inválido e o
            navegador desmonta a árvore. */}
        {card.nextTask ? (
          <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white p-2.5 transition-all focus-within:border-emerald-200">
            <button
              type="button"
              onClick={() => card.nextTask && onComplete(card.analysis, card.nextTask)}
              disabled={savingTaskId === quickTaskId}
              title={`Concluir: ${card.nextTask.acao}`}
              aria-label={`Concluir ação: ${card.nextTask.acao}`}
              /* `-m-1.5 p-1.5` no BOTÃO, com o círculo num `span` interno: a
                 área de toque vai a 36px enquanto o desenho continua 24px. O
                 truque só funciona porque quem pinta borda e fundo é o span —
                 foi pôr o `bg` no próprio botão que produziu, da última vez, um
                 quadrado verde de 38px com um ícone perdido no meio. */
              className="-m-1.5 shrink-0 rounded-full p-1.5 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-300 text-emerald-600">
                {savingTaskId === quickTaskId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onOpenSummary(card, 'plano')}
              className="group min-w-0 flex-1 text-left"
            >
              <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                Próxima ação · {card.done} de {card.total}
              </span>
              {/* ⚠️ SEM `block` AQUI. `line-clamp-2` funciona definindo
                  `display: -webkit-box`; a utilitária `block` define
                  `display: block` e vence na cascata, matando o corte em
                  silêncio. O original era um `<p>` (que já é bloco por
                  padrão) e por isso funcionava — ao virar `<span>` eu
                  acrescentei `block` por reflexo e o texto passou a
                  ocupar cinco linhas. Só apareceu ao renderizar com uma
                  ação longa de verdade. */}
              <span className="mt-0.5 line-clamp-2 text-xs font-black leading-snug text-slate-800">
                {card.nextTask.acao}
              </span>
              {/* O texto é cortado — então a saída para lê-lo por inteiro
                  precisa estar escrita, não adivinhada. */}
              <span className="mt-1 block text-[9px] font-black uppercase tracking-wider text-slate-400 transition-colors group-hover:text-emerald-700">
                Ver o plano inteiro →
              </span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-xs font-black text-emerald-800">
            Checklist concluído.
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
          <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-black uppercase ${decisionQueueStages[card.stage].className}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${decisionQueueStages[card.stage].dotClass}`} />
            {decisionQueueStages[card.stage].label}
          </span>
          <span className="text-[10px] font-black text-slate-500">
            {card.done}/{card.total} ações
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          {nextStage ? (
            /* Rotulado pelo mesmo motivo da próxima ação: era uma seta sozinha
               cujo significado morava num `title`. Divide a linha com o Laudo. */
            <button
              type="button"
              title={`Avançar para ${decisionQueueStages[nextStage].label}`}
              onClick={() => onStageChange(card.analysis, nextStage)}
              disabled={savingStageId === workflowTaskId}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingStageId === workflowTaskId ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
              Avançar
            </button>
          ) : (
            <button
              type="button"
              title="Etapa final — não há para onde avançar"
              disabled
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400"
            >
              <CheckCircle2 size={11} />
              Etapa final
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen(card.analysis)}
            disabled={loadingDetailId === card.analysis.id}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-medium text-slate-400 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingDetailId === card.analysis.id ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
            Laudo
          </button>
        </div>
      </div>
    </article>
  );
}

/** O plano de execução completo, editável — a casa nova da edição.
 *
 *  Cada passo tem responsável, prazo e nota. Grava no blur (não a cada tecla):
 *  a rota é um PATCH do mapa inteiro de tarefas, e disparar por tecla faria
 *  uma escrita por caractere, com corridas entre elas.
 *
 *  O estado local existe para o campo não "pular" enquanto se digita: o valor
 *  vem do rascunho local se houver, senão do que está salvo, senão do default
 *  da tarefa. */
function PlanoEditavel({ card, savingTaskId, onSalvar }: {
  card: DecisionQueueCardModel;
  savingTaskId: string | null;
  /** Devolve promessa: o editor precisa esperar a gravação terminar para só
   *  então descartar o rascunho e passar a ler o valor confirmado. */
  onSalvar: (
    analysis: SavedAnalysis,
    task: DecisionQueueTask,
    patch: { done?: boolean; responsavel?: string; prazo?: string; nota?: string },
  ) => Promise<void> | void;
}) {
  const [rascunho, setRascunho] = useState<Record<string, { responsavel?: string; prazo?: string; nota?: string }>>({});
  const [aberta, setAberta] = useState<string | null>(null);

  if (!card.tasks.length) return null;

  const valor = (taskId: string, campo: 'responsavel' | 'prazo' | 'nota', padrao: string) =>
    rascunho[taskId]?.[campo] ?? card.statusMap[taskId]?.[campo] ?? padrao;

  const editar = (taskId: string, campo: 'responsavel' | 'prazo' | 'nota', v: string) =>
    setRascunho((r) => ({ ...r, [taskId]: { ...r[taskId], [campo]: v } }));

  /** ⚠️ O RASCUNHO PRECISA SAIR DA FRENTE DEPOIS DE GRAVAR.
   *
   *  `valor()` dá precedência ao rascunho local, e nada nunca o limpava. Duas
   *  consequências, as duas invisíveis para quem estava usando:
   *
   *  1. Se o PATCH falhasse, `salvarTarefa` revertia o estado e mostrava o
   *     toast — mas o campo continuava exibindo o texto digitado, porque o
   *     rascunho vencia o valor revertido. Erro anunciado por 4s, e depois uma
   *     tela que parece salva.
   *  2. O backend corta os campos (`_texto_curto`: 80 / 40 / 180 caracteres,
   *     router_analyses.py:5511). Uma nota de 300 caracteres era gravada com
   *     180 e exibida com 300 pelo resto da sessão — a pessoa só descobriria o
   *     corte ao reabrir a tela outro dia.
   *
   *  Descartar o rascunho após o envio faz o campo passar a ler o que o
   *  servidor confirmou. É o servidor que decide o que ficou gravado. */
  const descartarRascunho = (taskId: string, campo: 'responsavel' | 'prazo' | 'nota') =>
    setRascunho((r) => {
      const doTask = { ...r[taskId] };
      delete doTask[campo];
      return { ...r, [taskId]: doTask };
    });

  const gravar = async (task: DecisionQueueTask, campo: 'responsavel' | 'prazo' | 'nota') => {
    const atual = rascunho[task.id]?.[campo];
    if (atual === undefined) return;                       // nada foi digitado
    const salvo = card.statusMap[task.id]?.[campo] ?? '';
    if (atual.trim() === String(salvo).trim()) {
      descartarRascunho(task.id, campo);                   // digitou e desfez
      return;
    }
    await onSalvar(card.analysis, task, { [campo]: atual.trim() });
    descartarRascunho(task.id, campo);
  };

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plano de execução</p>
          <p className="mt-1 text-sm font-bold text-slate-700">
            Responsável, prazo e conclusão de cada passo
          </p>
        </div>
        <span className="text-[11px] font-black tabular-nums text-slate-400">
          {card.done}/{card.total} concluídas
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {card.tasks.map((task, idx) => {
          const feito = !!card.statusMap[task.id]?.done;
          const salvando = savingTaskId === `${card.analysis.id}-${task.id}`;
          const abertaAqui = aberta === task.id;
          return (
            <div key={task.id} className="py-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  title={feito ? 'Marcar como pendente' : 'Marcar como concluída'}
                  onClick={() => onSalvar(card.analysis, task, { done: !feito })}
                  disabled={salvando}
                  aria-pressed={feito}
                  /* Mesma ampliação de área do cartão — ver comentário lá. E
                     `aria-pressed`: sem ele o leitor de tela anunciava só a
                     ação ("marcar como concluída"), nunca o estado atual. */
                  className={`-m-2 mt-0.5 box-content flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 p-2 transition-all disabled:opacity-50 ${
                    feito
                      ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'border-slate-300 bg-white hover:border-emerald-400'
                  }`}
                >
                  {salvando ? <Loader2 size={11} className="animate-spin" /> : feito ? <CheckCircle2 size={12} /> : null}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-black leading-snug ${feito ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    <span className="mr-1.5 tabular-nums text-slate-300">{String(idx + 1).padStart(2, '0')}</span>
                    {task.acao}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {valor(task.id, 'responsavel', task.responsavel)} · {valor(task.id, 'prazo', task.prazo)}
                    {card.statusMap[task.id]?.nota ? ' · com nota' : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAberta(abertaAqui ? null : task.id)}
                  className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
                >
                  {abertaAqui ? 'Fechar' : 'Editar'}
                </button>
              </div>

              {abertaAqui && (
                <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Responsável</span>
                    <input
                      value={valor(task.id, 'responsavel', task.responsavel)}
                      onChange={(e) => editar(task.id, 'responsavel', e.target.value)}
                      onBlur={() => gravar(task, 'responsavel')}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Prazo</span>
                    <input
                      value={valor(task.id, 'prazo', task.prazo)}
                      onChange={(e) => editar(task.id, 'prazo', e.target.value)}
                      onBlur={() => gravar(task, 'prazo')}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">Nota interna</span>
                    <input
                      value={valor(task.id, 'nota', '')}
                      onChange={(e) => editar(task.id, 'nota', e.target.value)}
                      onBlur={() => gravar(task, 'nota')}
                      placeholder="Ex.: aguardando jurídico, protocolado em 01/07..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-300 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OperationalSummaryModal({
  card,
  foco,
  savingTaskId,
  savingStageId,
  onClose,
  onOpenLaudo,
  onComplete,
  onSalvarTarefa,
  onStageChange,
  onReviewRequest,
  onLearningRequest,
}: {
  card: DecisionQueueCardModel;
  /** `'plano'` = abrir já no plano de execução, em vez do topo. */
  foco: 'plano' | null;
  savingTaskId: string | null;
  savingStageId: string | null;
  onClose: () => void;
  onOpenLaudo: (analysis: SavedAnalysis) => void;
  onComplete: (analysis: SavedAnalysis, task: DecisionQueueTask) => void;
  onSalvarTarefa: (
    analysis: SavedAnalysis,
    task: DecisionQueueTask,
    patch: { done?: boolean; responsavel?: string; prazo?: string; nota?: string },
  ) => void;
  onStageChange: (analysis: SavedAnalysis, status: DecisionQueueKey) => void;
  onReviewRequest: (card: DecisionQueueCardModel) => void;
  onLearningRequest: (card: DecisionQueueCardModel) => void;
}) {
  const operational = getOperationalContext(card.analysis, card.stage, card.nextTask);
  const stage = decisionQueueStages[card.stage];
  const score = Number(card.analysis.score || 0);
  const verdictClass = score >= 70
    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
    : score >= 45
      ? 'border-amber-100 bg-amber-50 text-amber-700'
      : 'border-red-100 bg-red-50 text-red-700';
  const nextResponsible = card.nextTask
    ? card.statusMap[card.nextTask.id]?.responsavel || card.nextTask.responsavel
    : 'Sem responsável pendente';
  const nextDeadline = card.nextTask
    ? card.statusMap[card.nextTask.id]?.prazo || card.nextTask.prazo
    : 'Sem prazo de ação';
  const nextStage = getNextDecisionQueueStage(card.stage);
  const workflowTaskId = `${card.analysis.id}-workflow`;
  const quickTaskId = card.nextTask ? `${card.analysis.id}-${card.nextTask.id}` : '';
  const isSavingStage = Boolean(savingStageId);
  const isSavingTask = Boolean(savingTaskId);
  const headerOffset = useStickyHeaderOffset();
  const fecharPeloFundo = useDispensaDeModal(true, onClose);

  /** ⚠️ "VER O PLANO INTEIRO →" PRECISA CAIR NO PLANO INTEIRO.
   *  O cartão abre este mesmo modal por dois caminhos: "Resumo do edital",
   *  que quer o topo, e o link do plano, que quer a lista. Os dois abriam no
   *  topo — e o segundo prometia uma coisa e entregava outra, deixando a
   *  pessoa rolar atrás do que o link já tinha nomeado.
   *
   *  `useLayoutEffect` e não `useEffect`: posicionar depois da pintura faz o
   *  modal aparecer no topo e pular para o plano, o que dá a impressão de
   *  falha. `block: 'start'` porque o plano é o fim do conteúdo — centralizar
   *  deixaria metade da tela vazia embaixo. */
  const planoRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (foco !== 'plano') return;
    planoRef.current?.scrollIntoView({ block: 'start' });
  }, [foco]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[140] flex items-start justify-center overflow-hidden bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
      style={{ top: headerOffset }}
      onClick={fecharPeloFundo}
      role="presentation"
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl sm:rounded-[2rem]">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${stage.className}`}>
                {stage.label}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${operational.urgency.className}`}>
                {operational.urgency.label}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${verdictClass}`}>
                Score {score}
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumo do edital</p>
            <h3 className="mt-1 line-clamp-3 text-lg font-black leading-tight text-slate-950 sm:text-xl">
              {card.analysis.title || 'Análise de edital'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar resumo"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-950"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryField
              icon={<Building2 size={16} />}
              label="Órgão / Unidade"
              value={operational.orgao}
            />
            <SummaryField
              icon={<CalendarDays size={16} />}
              label="UF / Resultado"
              value={[operational.uf || 'UF não informada', operational.resultLabel || 'Resultado ainda não registrado'].join(' · ')}
            />
            <SummaryField
              icon={<DollarSign size={16} />}
              label="Valor estimado"
              value={operational.valor}
            />
            <SummaryField
              icon={<AlertTriangle size={16} />}
              label="Prazo crítico"
              value={operational.prazo}
              toneClass={operational.urgency.className}
            />
            <SummaryField
              icon={<Clock3 size={16} />}
              label="Próxima ação"
              value={card.nextTask?.acao || 'Sem ação pendente no cockpit.'}
              wide
            />
            <SummaryField
              icon={<UserRound size={16} />}
              label="Responsável / prazo da ação"
              value={`${nextResponsible} · ${nextDeadline}`}
            />
            <SummaryField
              icon={<ClipboardList size={16} />}
              label="Progresso do cockpit"
              value={`${card.done}/${card.total} ações concluídas`}
            />
            <SummaryField
              icon={<RefreshCw size={16} />}
              label="Última atualização"
              value={operational.lastUpdate}
            />
            <SummaryField
              icon={<FileText size={16} />}
              label="Motivo do status"
              value={operational.reason}
              wide
            />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gestão do fluxo</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{stage.helper}</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${stage.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${stage.dotClass}`} />
                {stage.label}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <select
                value={card.stage}
                onChange={(event) => onStageChange(card.analysis, event.target.value as DecisionQueueKey)}
                disabled={isSavingStage}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-black text-slate-800 outline-none transition-all focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {decisionQueueOrder.map((stageKey) => (
                  <option key={stageKey} value={stageKey}>{decisionQueueStages[stageKey].label}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => nextStage && onStageChange(card.analysis, nextStage)}
                disabled={!nextStage || isSavingStage}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingStageId === workflowTaskId ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {nextStage ? `Avançar para ${decisionQueueStages[nextStage].label}` : 'Finalizado'}
              </button>

              <button
                type="button"
                onClick={() => card.nextTask && onComplete(card.analysis, card.nextTask)}
                disabled={!card.nextTask || isSavingTask}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingTaskId === quickTaskId ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Concluir ação
              </button>
            </div>
          </div>

          {/* PLANO COMPLETO, EDITÁVEL — o que o laudo deixou de fazer.
              Não é a "próxima ação" só: é a lista inteira, com responsável,
              prazo e nota por passo. Sem isto, a edição não teria mudado de
              casa; teria sumido. */}
          <div ref={planoRef} className="scroll-mt-2">
            <PlanoEditavel
              card={card}
              savingTaskId={savingTaskId}
              onSalvar={onSalvarTarefa}
            />
          </div>
        </div>

        <div className="shrink-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-3 sm:flex-row sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => onReviewRequest(card)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-black text-sky-700 transition-all hover:bg-sky-100"
          >
            <RotateCcw size={15} />
            Revisar decisão
          </button>
          <button
            type="button"
            onClick={() => onLearningRequest(card)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700 transition-all hover:bg-emerald-100"
          >
            <Trophy size={15} />
            Registrar resultado
          </button>
          <button
            type="button"
            onClick={() => onOpenLaudo(card.analysis)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-slate-800"
          >
            Abrir laudo
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Taxa de acerto real — cruza veredito x resultado registrado pelo usuário.
// É prova baseada em dado (não a IA reavaliando a si mesma), por isso fica
// visível tanto aqui na gestão quanto no Painel de Decisão de cada análise.
function LearningStatsBanner({ stats }: { stats: LearningStats | null }) {
  if (!stats) return null;
  const { go, no_go: noGo, amostra_minima: amostraMinima } = stats;

  // ⚠️ ESTADO VAZIO OCUPAVA UM BLOCO INTEIRO PARA EXPLICAR UMA MÉTRICA QUE
  // AINDA NÃO EXISTE — título em caixa alta mais três linhas de texto, no topo
  // da tela, todo dia, até a quinta disputa registrada. O bloco só se justifica
  // quando tem número para mostrar. Enquanto não tem, é uma linha com o que
  // falta para chegar lá, e o resto atrás de um clique de quem se interessar.
  if (go.total_com_resultado === 0 && noGo.total_participou_mesmo_assim === 0) {
    return (
      <details className="group border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 md:px-7">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-600">
          <Trophy size={12} className="shrink-0 text-slate-400" />
          Taxa de acerto real · registre {amostraMinima} resultados para começar
          <ChevronRight size={12} className="ml-auto shrink-0 transition-transform group-open:rotate-90" />
        </summary>
        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
          Assim que você registrar "Ganhou" ou "Perdeu" em pelo menos {amostraMinima} disputas (botão "Registrar resultado" em cada card), esta métrica passa a comparar o veredito da Bawzi com o resultado real. As contagens de GO e de No-Go são independentes: cada uma precisa dos seus {amostraMinima}.
        </p>
      </details>
    );
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 md:px-7">
      <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <Trophy size={12} className="text-emerald-600" />
        Taxa de acerto real — veredito Bawzi × resultado registrado
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quando dissemos GO</p>
          {go.amostra_suficiente ? (
            <>
              <p className="mt-1 text-2xl font-black text-emerald-700">{go.taxa_acerto_pct}%</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                de vitória em {go.total_com_resultado} disputa{go.total_com_resultado === 1 ? '' : 's'} com resultado registrado
                ({go.vitorias} ganha{go.vitorias === 1 ? '' : 's'}, {go.derrotas} perdida{go.derrotas === 1 ? '' : 's'})
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Ainda sem amostra suficiente ({go.total_com_resultado}/{amostraMinima} resultados registrados) — registre o resultado das disputas no Cockpit para ativar essa métrica.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quando dissemos No-Go (e participou mesmo assim)</p>
          {noGo.amostra_suficiente ? (
            <>
              <p className="mt-1 text-2xl font-black text-amber-700">{noGo.taxa_alerta_validado_pct}%</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                dos alertas se confirmaram (perdeu em {noGo.alertas_validados} de {noGo.total_participou_mesmo_assim} casos onde participou contrariando o alerta)
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Ainda sem amostra suficiente ({noGo.total_participou_mesmo_assim}/{amostraMinima} resultados registrados) para calibrar os alertas de No-Go.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionReviewModal({
  card,
  isSaving,
  onClose,
  onSubmit,
}: {
  card: DecisionQueueCardModel;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (card: DecisionQueueCardModel, payload: { tipo: string; titulo: string; conteudo: string }) => void;
}) {
  const headerOffset = useStickyHeaderOffset();
  const fecharPeloFundo = useDispensaDeModal(true, onClose);
  const [tipo, setTipo] = useState('resposta_orgao');
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const canSubmit = conteudo.trim().length >= 20 && !isSaving;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[150] flex items-start justify-center overflow-hidden bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
      style={{ top: headerOffset }}
      onClick={fecharPeloFundo}
      role="presentation"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          onSubmit(card, { tipo, titulo: titulo.trim() || 'Revisão de decisão', conteudo: conteudo.trim() });
        }}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl sm:rounded-[2rem]"
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-sky-50 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-600">Revisar decisão</p>
            <h3 className="mt-1 line-clamp-2 text-lg font-black leading-tight text-slate-950">
              {card.analysis.title || 'Análise de edital'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar revisão"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-950"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</label>
              <div className="relative">
                <select
                  value={tipo}
                  onChange={(event) => setTipo(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 pr-8 text-sm font-bold text-slate-800 outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
                >
                  <option value="resposta_orgao">Resposta do órgão</option>
                  <option value="novo_documento">Novo documento</option>
                  <option value="alteracao_edital">Alteração do edital</option>
                  <option value="nova_cotacao">Nova cotação</option>
                  <option value="decisao_interna">Decisão interna</option>
                </select>
                <ChevronRight size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Título</label>
              <input
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
                placeholder="Ex.: resposta ao pedido de esclarecimento"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Novo fato para reprocessar</label>
            <textarea
              value={conteudo}
              onChange={(event) => setConteudo(event.target.value)}
              rows={9}
              placeholder="Cole aqui o trecho novo do edital, resposta do órgão, anexo publicado, cotação ou decisão interna que pode mudar o Go/No-Go."
              className="min-h-[220px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
            />
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs font-bold leading-relaxed text-sky-800">
            A revisão atualiza o laudo, registra o histórico da mudança e move o edital de volta para triagem.
          </div>
        </div>

        <div className="shrink-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-3 sm:flex-row sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            Revisar agora
          </button>
        </div>
      </form>
    </div>
  );
}

function LearningModal({
  card,
  isSaving,
  onClose,
  onSubmit,
}: {
  card: DecisionQueueCardModel;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (card: DecisionQueueCardModel, payload: { participou: boolean; resultado: string; preco_final: string; vencedor: string; observacao: string; contrato_inicio: string; contrato_fim: string }) => void;
}) {
  const headerOffset = useStickyHeaderOffset();
  const fecharPeloFundo = useDispensaDeModal(true, onClose);
  const learning = card.analysis.decision_learning || {};
  const [participou, setParticipou] = useState(Boolean(learning.participou ?? true));
  const [resultado, setResultado] = useState(String(learning.resultado || 'won'));
  const [precoFinal, setPrecoFinal] = useState(String(learning.preco_final || ''));
  const [vencedor, setVencedor] = useState(String(learning.vencedor || ''));
  const [observacao, setObservacao] = useState(String(learning.observacao || ''));
  const [contratoInicio, setContratoInicio] = useState(String(learning.contrato_inicio || ''));
  const [contratoFim, setContratoFim] = useState(String(learning.contrato_fim || ''));
  const finalResult = participou ? resultado : 'not_participated';

  const sugerirVigencia = () => {
    const rec = card.analysis as Record<string, unknown>;
    const tryDate = (...keys: string[]): string => {
      for (const k of keys) {
        const v = String(rec[k] || '').trim();
        if (!v) continue;
        // YYYY-MM-DD already
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
        // DD/MM/YYYY
        const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      }
      return '';
    };
    const inicio = tryDate('data_inicio_vigencia', 'dataVigenciaInicio', 'data_vigencia_ini', 'vigencia_inicio', 'contrato_inicio');
    const fim = tryDate('data_fim_vigencia', 'dataVigenciaFim', 'data_vigencia_fim', 'vigencia_fim', 'contrato_fim');
    if (inicio) setContratoInicio(inicio);
    if (fim) setContratoFim(fim);
    if (!inicio && !fim) window.alert('Nenhuma data de vigência encontrada na análise. Preencha manualmente.');
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[150] flex items-start justify-center overflow-hidden bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
      style={{ top: headerOffset }}
      onClick={fecharPeloFundo}
      role="presentation"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(card, {
            participou,
            resultado: finalResult,
            preco_final: precoFinal.trim(),
            vencedor: vencedor.trim(),
            observacao: observacao.trim(),
            contrato_inicio: contratoInicio.trim(),
            contrato_fim: contratoFim.trim(),
          });
        }}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl sm:rounded-[2rem]"
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-emerald-50 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Memória de aprendizado</p>
            <h3 className="mt-1 line-clamp-2 text-lg font-black leading-tight text-slate-950">
              {card.analysis.title || 'Análise de edital'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar resultado"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-950"
          >
            <X size={18} />
          </button>
        </div>

        {learning.origem === 'pncp_auto' && (
          <div className="shrink-0 border-b border-violet-100 bg-violet-50 px-4 py-2.5 text-[11px] font-bold leading-snug text-violet-800 sm:px-5">
            Resultado preenchido automaticamente pela homologação pública do PNCP
            {learning.auto_registrado_em ? ` em ${new Date(String(learning.auto_registrado_em)).toLocaleDateString('pt-BR')}` : ''}.
            {' '}Ajuste os campos e salve — o registro manual substitui o automático.
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setParticipou(true);
                setResultado('won');
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${participou && resultado === 'won' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <Trophy size={18} />
              <p className="mt-3 text-sm font-black">Ganhou</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setParticipou(true);
                setResultado('lost');
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${participou && resultado === 'lost' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <XCircle size={18} />
              <p className="mt-3 text-sm font-black">Perdeu</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setParticipou(false);
                setResultado('abandoned');
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${!participou ? 'border-slate-300 bg-slate-100 text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <AlertTriangle size={18} />
              <p className="mt-3 text-sm font-black">Não participou</p>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Preço final</label>
              <input
                value={precoFinal}
                onChange={(event) => setPrecoFinal(event.target.value)}
                placeholder="Ex.: R$ 187.000,00"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Quem venceu</label>
              <input
                value={vencedor}
                onChange={(event) => setVencedor(event.target.value)}
                placeholder="Empresa vencedora"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
          </div>

          {participou && resultado === 'won' && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Vigência do contrato</p>
                <button
                  type="button"
                  onClick={sugerirVigencia}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[9px] font-black text-emerald-700 transition-all hover:bg-emerald-100"
                >
                  <RefreshCw size={9} />
                  Sugerir do edital
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-emerald-600">Início</label>
                  <input
                    type="date"
                    value={contratoInicio}
                    onChange={(event) => setContratoInicio(event.target.value)}
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-emerald-600">Fim</label>
                  <input
                    type="date"
                    value={contratoFim}
                    onChange={(event) => setContratoFim(event.target.value)}
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Observação</label>
            <textarea
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              rows={4}
              placeholder="Ex.: perdemos por preço, decidimos não participar por prazo, concorrente regional recorrente venceu..."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>
        </div>

        <div className="shrink-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-3 sm:flex-row sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Salvar aprendizado
          </button>
        </div>
      </form>
    </div>
  );
}

function SummaryField({
  icon,
  label,
  value,
  toneClass,
  wide = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  toneClass?: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${toneClass || 'border-slate-100 bg-slate-50 text-slate-800'} ${wide ? 'md:col-span-2' : ''}`}>
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm font-black leading-relaxed text-slate-900">{value}</p>
    </div>
  );
}

/** Dispensa por Escape + clique no fundo + trava a rolagem de trás.
 *
 *  ⚠️ OS TRÊS MODAIS DESTA TELA NÃO TINHAM NADA DISSO. Sem `Escape` e sem
 *  clique no fundo, o único jeito de sair era acertar o ✕ — em teclado, não
 *  havia jeito nenhum. E como o `body` continuava rolável, rolar dentro do
 *  modal e chegar ao fim passava a rolar a página atrás dele, tirando o modal
 *  da vista sem fechá-lo.
 *
 *  Um hook e não três cópias: eram três modais com o mesmo `<div>` de fundo
 *  copiado, e três cópias divergem.
 *
 *  Devolve o handler do fundo — ele precisa distinguir clique NO fundo de
 *  clique que borbulhou de dentro do painel, senão selecionar texto e soltar o
 *  mouse fora fecharia o modal e descartaria o que a pessoa estava lendo. */
function useDispensaDeModal(aberto: boolean, aoFechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const porTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    document.addEventListener('keydown', porTecla);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', porTecla);
      document.body.style.overflow = overflowAntes;
    };
  }, [aberto, aoFechar]);

  return (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) aoFechar();
  };
}

function useStickyHeaderOffset(defaultOffset = 80) {
  const [headerOffset, setHeaderOffset] = useState(defaultOffset);

  useEffect(() => {
    const measureHeader = () => {
      const header = document.querySelector('header');
      const wrapper = header?.parentElement || header;
      const rect = wrapper?.getBoundingClientRect();
      const bottom = rect?.bottom || rect?.height || 72;
      setHeaderOffset(Math.max(64, Math.ceil(bottom) + 8));
    };

    measureHeader();
    const timer = window.setTimeout(measureHeader, 120);
    window.addEventListener('resize', measureHeader);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', measureHeader);
    };
  }, []);

  return headerOffset;
}

function getOperationalContext(
  analysis: SavedAnalysis,
  stage: DecisionQueueKey,
  nextTask: DecisionQueueTask | null,
) {
  const record = asRecord(analysis);
  const orgaoRisk = asRecord(record.orgao_risk);
  const orgaoEntidade = asRecord(record.orgaoEntidade);
  const unidadeOrgao = asRecord(record.unidadeOrgao);
  const pricing = asRecord(record.pricing_intelligence);
  const prazo = getCriticalDeadline(record, nextTask);

  const orgao = firstText(
    record.orgao_nome,
    record.orgao,
    record.nomeOrgao,
    record.orgaoComprador,
    orgaoEntidade.razaoSocial,
    unidadeOrgao.nomeUnidade,
    orgaoRisk.nome,
    orgaoRisk.orgao,
  ) || 'Órgão não identificado';

  const uf = firstText(
    analysis.uf,
    analysis.estado,
    record.orgao_uf,
    record.uf_disputa,
    unidadeOrgao.ufSigla,
  );

  const valor = formatOperationalValue(
    analysis.estimated_value
    || pricing.valor_estimado_raw
    || record.valor_total_estimado
    || record.valorTotalEstimado
    || record.valor_global
    || record.valor,
  );

  return {
    orgao,
    uf,
    valor,
    prazo: prazo.label,
    urgency: getDeadlineUrgency(prazo.date),
    reason: getStageReason(stage, nextTask, prazo),
    lastUpdate: formatLastUpdate(analysis),
    resultLabel: getResultLabel(analysis),
  };
}

function getCriticalDeadline(record: Record<string, unknown>, nextTask: DecisionQueueTask | null) {
  const criticalDates = Array.isArray(record.datas_criticas) ? record.datas_criticas : [];
  const candidates = criticalDates
    .map((item) => {
      const dateRecord = asRecord(item);
      const label = firstText(dateRecord.label, dateRecord.tipo, dateRecord.nome) || 'Prazo crítico';
      const rawDate = firstText(dateRecord.data_iso, dateRecord.data, dateRecord.valor);
      const date = parseOperationalDate(rawDate);
      const priority = /encerramento|recebimento|proposta|limite|impugna|esclarec/i.test(label) ? 0 : 1;
      return { label, date, rawDate, priority };
    })
    .filter((item) => item.date || item.rawDate);

  const legacy = asRecord(record.datas_criticas_extraidas);
  [
    { label: 'Prazo de propostas', value: legacy.data_limite_propostas },
    { label: 'Limite impugnação', value: legacy.data_impugnacao },
  ].forEach((item) => {
    const rawDate = firstText(item.value);
    if (rawDate) candidates.push({ label: item.label, date: parseOperationalDate(rawDate), rawDate, priority: 0 });
  });

  const now = Date.now();
  const future = candidates
    .filter((item) => item.date && item.date.getTime() >= now)
    .sort((a, b) => (a.priority - b.priority) || ((a.date?.getTime() || 0) - (b.date?.getTime() || 0)));

  const selected = future[0] || candidates.sort((a, b) => a.priority - b.priority)[0];
  if (selected) {
    const formattedDate = selected.date
      ? selected.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      : selected.rawDate;
    return {
      label: `${selected.label}: ${formattedDate}`,
      date: selected.date,
    };
  }

  return {
    label: nextTask?.prazo || 'Sem prazo identificado',
    date: null,
  };
}

function getDeadlineUrgency(date: Date | null) {
  if (!date) {
    return { label: 'Sem data oficial', className: 'border-slate-100 bg-slate-50 text-slate-600' };
  }

  const diffDays = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { label: 'Prazo vencido', className: 'border-red-100 bg-red-50 text-red-700' };
  if (diffDays <= 1) return { label: 'Vence agora', className: 'border-red-100 bg-red-50 text-red-700' };
  if (diffDays <= 3) return { label: `Vence em ${diffDays} dias`, className: 'border-amber-100 bg-amber-50 text-amber-700' };
  if (diffDays <= 7) return { label: 'Esta semana', className: 'border-sky-100 bg-sky-50 text-sky-700' };
  return { label: 'No prazo', className: 'border-emerald-100 bg-emerald-50 text-emerald-700' };
}

function getStageReason(
  stage: DecisionQueueKey,
  nextTask: DecisionQueueTask | null,
  prazo: { label: string; date: Date | null },
) {
  if (nextTask) {
    return `${decisionQueueStages[stage].label}: ${nextTask.acao}`;
  }

  const fallback: Record<DecisionQueueKey, string> = {
    not_started: 'Edital ainda não recebeu primeira ação operacional.',
    triage: 'Validação inicial concluída, sem ação pendente registrada.',
    pending: `Acompanhar dependência externa. ${prazo.label}.`,
    proposal: 'Proposta pronta para montagem ou revisão final.',
    submitted: 'Proposta enviada. Acompanhar sessão, disputa e homologação.',
    won: 'Resultado ganho registrado. Transformar aprendizado em execução e referência futura.',
    lost: 'Resultado perdido registrado. Usar preço final e vencedor para calibrar próximas disputas.',
    abandoned: 'Participação abandonada ou não realizada. Decisão preservada para aprendizado.',
    executed: 'Fluxo encerrado na Bawzi. Registrar resultado final quando aplicável.',
  };
  return fallback[stage];
}

function getVigenciaStatus(analysis: SavedAnalysis): { label: string; className: string } | null {
  const learning = asRecord(analysis.decision_learning);
  if (learning.resultado !== 'won') return null;
  const inicio = firstText(learning.contrato_inicio);
  const fim = firstText(learning.contrato_fim);
  if (!inicio && !fim) return null;

  const fmt = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (inicio && fim) {
    const dInicio = new Date(inicio + 'T00:00:00');
    const dFim = new Date(fim + 'T00:00:00');
    const diffDias = Math.ceil((dFim.getTime() - today.getTime()) / 86_400_000);
    if (diffDias < 0) {
      const encerrado = Math.abs(diffDias);
      return { label: `Encerrado há ${encerrado}d · ${fmt(inicio)} → ${fmt(fim)}`, className: 'border-slate-200 bg-slate-50 text-slate-500' };
    }
    if (today < dInicio) {
      return { label: `Inicia em ${fmt(inicio)} → ${fmt(fim)}`, className: 'border-sky-100 bg-sky-50 text-sky-700' };
    }
    const urgency = diffDias <= 30 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700';
    return { label: `Vigência ativa · ${diffDias}d restantes · até ${fmt(fim)}`, className: urgency };
  }

  if (fim) {
    const dFim = new Date(fim + 'T00:00:00');
    const diffDias = Math.ceil((dFim.getTime() - today.getTime()) / 86_400_000);
    if (diffDias < 0) return { label: `Encerrado em ${fmt(fim)}`, className: 'border-slate-200 bg-slate-50 text-slate-500' };
    return { label: `Até ${fmt(fim)} · ${diffDias}d restantes`, className: 'border-emerald-100 bg-emerald-50 text-emerald-700' };
  }

  return { label: `Início: ${fmt(inicio)}`, className: 'border-sky-100 bg-sky-50 text-sky-700' };
}

function getResultLabel(analysis: SavedAnalysis) {
  const learning = asRecord(analysis.decision_learning);
  const learnedResult = firstText(learning.resultado);
  if (learnedResult) {
    const labels: Record<string, string> = {
      won: 'Ganho',
      lost: 'Perdido',
      abandoned: 'Abandonado',
      not_participated: 'Não participou',
      unknown: 'Resultado registrado',
    };
    const label = labels[learnedResult] || learnedResult;
    const winner = firstText(learning.vencedor);
    const price = firstText(learning.preco_final);
    return [label, winner && `Vencedor: ${winner}`, price && `Preço: ${price}`].filter(Boolean).join(' · ');
  }

  const result = firstText(
    analysis.resultado_final,
    analysis.resultado,
    analysis.status_resultado,
    analysis.situacao_final,
  );
  return result ? `Resultado: ${result}` : '';
}

function formatLastUpdate(analysis: SavedAnalysis) {
  const raw = firstText(
    analysis.workflow_updated_at,
    analysis.reviewed_at,
    analysis.cockpit_updated_at,
    asRecord(analysis.decision_learning).updated_at,
    analysis.updated_at,
    analysis.created_at,
  );
  const date = parseOperationalDate(raw);
  if (!date) return 'Sem atualização registrada';
  return `Atualizado em ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
}

function formatOperationalValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const text = firstText(value);
  if (!text || /não informado|nao informado|sigiloso/i.test(text)) return 'Não informado';
  return text;
}

function parseOperationalDate(value: unknown): Date | null {
  const text = firstText(value);
  if (!text) return null;

  const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const [, day, month, year, hour = '0', minute = '0'] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanCnpj(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function formatCnpj(value: unknown) {
  const cnpj = cleanCnpj(value);
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

function normalizeCompanyText(value: unknown) {
  return firstText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(ltda|eireli|mei|me|epp|sa|s a|servicos|comercio|industria)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCompanyLabel(company: Empresa) {
  const label = firstText(company.nome_fantasia, company.razao_social, company.nome, company.name, 'Empresa');
  const cnpj = formatCnpj(company.cnpj);
  return cnpj ? `${label} - ${cnpj}` : label;
}

function getAnalysisCompanyCnpj(analysis: SavedAnalysis) {
  const context = asRecord(analysis.empresa_contexto);
  const legacyContext = asRecord(analysis.company_context);
  return cleanCnpj(
    context.cnpj
    || legacyContext.cnpj
    || analysis.company_cnpj
    || analysis.empresa_cnpj
    || analysis.cnpj_empresa
    || analysis.cnpj_empresa_analisada,
  );
}

function getAnalysisCompanyName(analysis: SavedAnalysis) {
  const context = asRecord(analysis.empresa_contexto);
  const legacyContext = asRecord(analysis.company_context);
  const aderencia = asRecord(analysis.aderencia_negocio);
  return firstText(
    context.nome_fantasia,
    context.razao_social,
    context.nome,
    legacyContext.nome_fantasia,
    legacyContext.razao_social,
    legacyContext.nome,
    analysis.company_name,
    analysis.empresa_nome,
    analysis.nome_empresa,
    aderencia.empresa,
  );
}

function analysisMatchesCompany(analysis: SavedAnalysis, company: Empresa) {
  const analysisCnpj = getAnalysisCompanyCnpj(analysis);
  const companyCnpj = cleanCnpj(company.cnpj);
  if (analysisCnpj && companyCnpj) return analysisCnpj === companyCnpj;

  const analysisName = normalizeCompanyText(getAnalysisCompanyName(analysis));
  if (!analysisName) return false;

  return [
    company.nome_fantasia,
    company.razao_social,
    company.nome,
    company.name,
  ].some((name) => {
    const normalized = normalizeCompanyText(name);
    return normalized && (
      normalized === analysisName
      || normalized.includes(analysisName)
      || analysisName.includes(normalized)
    );
  });
}

function getLinkedCompanyForAnalysis(analysis: SavedAnalysis, companies: Empresa[]) {
  return companies.find((company) => analysisMatchesCompany(analysis, company)) || null;
}
