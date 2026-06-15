'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  DollarSign,
  FileText,
  Loader2,
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
}: {
  token: string;
  userTier?: number;
}) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [companies, setCompanies] = useState<Empresa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
  const [stageFilter, setStageFilter] = useState<'all' | DecisionQueueKey>('all');
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [monitorFilter, setMonitorFilter] = useState<MonitorFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('active');
  const [sortFilter, setSortFilter] = useState<SortFilter>('recent');
  const [notice, setNotice] = useState<NoticeState>(null);
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

  const CARDS_PER_COLUMN = 20;
  const [expandedColumns, setExpandedColumns] = useState<Partial<Record<DecisionQueueKey, boolean>>>({});
  const toggleColumnExpand = (key: DecisionQueueKey) =>
    setExpandedColumns((prev) => ({ ...prev, [key]: !prev[key] }));

  // Renova o access token proativamente enquanto o usuário estiver na gestão.
  // Sem isso, o token de 60 min expira e a próxima ação retorna 401.
  useEffect(() => startSessionKeepAlive(), []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [historyRes, workspaceRes] = await Promise.all([
          apiFetch(`${API_URL}/api/analyses/history`),
          apiFetch(`${API_URL}/api/workspace/details`),
        ]);

        const data = await historyRes.json();
        const history = data.history || (Array.isArray(data) ? data : []);
        if (Array.isArray(history)) setAnalyses(history);

        if (workspaceRes.ok) {
          const workspaceData = await workspaceRes.json().catch(() => null);
          const workspaceCompanies = Array.isArray(workspaceData?.companies)
            ? workspaceData.companies
            : [];
          setCompanies(workspaceCompanies.filter((company: Empresa) => company?.cnpj));
        }
      } catch (err) {
        if (err instanceof SessionExpiredError) return;
        setNotice({ type: 'error', message: 'Erro ao carregar a gestão de decisões.' });
      } finally {
        setIsLoading(false);
      }
    };

    if (token) void loadData();
    else setIsLoading(false);
  }, [token]);

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

      if (stageFilter !== 'all' && card.stage !== stageFilter) return false;

      const score = Number(card.analysis.score || 0);
      if (verdictFilter === 'go' && score < 70) return false;
      if (verdictFilter === 'attention' && !(score >= 45 && score < 70)) return false;
      if (verdictFilter === 'nogo' && score >= 45) return false;

      const isFinal = finalStages.includes(card.stage);
      if (activityFilter === 'active' && isFinal) return false;
      if (activityFilter === 'finalized' && !isFinal) return false;

      const monitor = asRecord(card.analysis.pncp_monitor);
      const hasEvents = Array.isArray(card.analysis.pncp_monitor_events) && card.analysis.pncp_monitor_events.length > 0;
      const hasPncpRef = Boolean(asRecord(card.analysis.pncp_ref).cnpj || card.analysis.pncp_cnpj);
      if (monitorFilter === 'changed' && !hasEvents && monitor.status !== 'mudanca_detectada') return false;
      if (monitorFilter === 'monitored' && !hasPncpRef) return false;
      if (monitorFilter === 'unmonitored' && hasPncpRef) return false;

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
  }, [activityFilter, allQueueCards, companyFilter, companyOptions, monitorFilter, sortFilter, stageFilter, urgencyFilter, verdictFilter]);

  const activeSummaryCard = useMemo(() => {
    if (!summaryModal) return null;
    return allQueueCards.find((card) => card.analysis.id === summaryModal.analysis.id) || summaryModal;
  }, [allQueueCards, summaryModal]);

  const counts = useMemo(() => queueCards.reduce<Record<DecisionQueueKey, number>>((acc, card) => {
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
  }), [queueCards]);

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
  }, [queueCards.length, searchText]);

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
    || stageFilter !== 'all'
    || verdictFilter !== 'all'
    || urgencyFilter !== 'all'
    || monitorFilter !== 'all'
    || activityFilter !== 'active'
    || sortFilter !== 'recent',
  );

  const resetFilters = () => {
    setSearchText('');
    setCompanyFilter('all');
    setStageFilter('all');
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

  const completeNextTask = async (
    analysis: SavedAnalysis,
    task: DecisionQueueTask,
  ) => {
    if (!analysis.id || savingTaskId) return;

    const statusBefore = normalizeDecisionCockpitStatus(analysis.cockpit_status);
    const nowIso = new Date().toISOString();
    const nextStatus = {
      ...statusBefore,
      [task.id]: {
        ...statusBefore[task.id],
        done: true,
        responsavel: statusBefore[task.id]?.responsavel || task.responsavel,
        prazo: statusBefore[task.id]?.prazo || task.prazo,
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
      setNotice({ type: 'success', message: 'Ação concluída e salva no histórico.' });
    } catch (err) {
      setAnalyses((prev) => prev.map((item) => (
        item.id === analysis.id ? { ...item, cockpit_status: statusBefore } : item
      )));
      if (err instanceof SessionExpiredError) return;
      setNotice({ type: 'error', message: 'Erro de conexão ao salvar a tarefa.' });
    } finally {
      setSavingTaskId(null);
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
    payload: { participou: boolean; resultado: string; preco_final: string; vencedor: string; observacao: string },
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
      setNotice({ type: 'success', message: 'Resultado registrado. A Bawzi usará esse histórico nas próximas decisões.' });
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
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500 pb-16">
        {renderNotice()}
        <div className="sticky top-0 z-30 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => {
              setSelectedAnalysis(null);
              setDetailTab('analise');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase text-slate-600 transition-all hover:border-slate-300 hover:text-slate-950"
          >
            ← Voltar para gestão
          </button>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700">
            Laudo aberto pela gestão
          </span>
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
          onCockpitStatusChange={(status, updatedAnalysis) => {
            const merged = {
              ...selectedAnalysis,
              ...(updatedAnalysis as unknown as SavedAnalysis | undefined),
              cockpit_status: status,
            };
            setSelectedAnalysis(merged);
            setAnalyses((prev) => prev.map((item) => item.id === selectedAnalysis.id ? { ...item, ...merged } : item));
          }}
        />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-5">
      {renderNotice()}
      {activeSummaryCard && (
        <OperationalSummaryModal
          card={activeSummaryCard}
          savingTaskId={savingTaskId}
          savingStageId={savingStageId}
          onClose={() => setSummaryModal(null)}
          onOpenLaudo={(analysis) => {
            setSummaryModal(null);
            void openAnalysisDetail(analysis);
          }}
          onComplete={completeNextTask}
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
        <div className="grid gap-6 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 p-5 md:grid-cols-[1fr_auto] md:p-7">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-emerald-700 shadow-sm">
              <ClipboardList size={13} />
              Gestão de execução
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Fluxo completo dos editais</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              Acompanhe cada edital desde o primeiro contato operacional até envio, resultado e execução/encerramento.
            </p>
          </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 md:min-w-[720px]">
            {columnOrder.map((key) => {
              const stage = decisionQueueStages[key];
              return (
                <div key={key} className={`rounded-2xl border p-3 shadow-sm ${stage.className}`}>
                  <p className="text-2xl font-black leading-none">{counts[key]}</p>
                  <p className="mt-1 text-[10px] font-black uppercase text-current opacity-70">{stage.label}</p>
                </div>
              );
            })}
          </div>
        </div>

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

            <div className="inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase text-slate-500">
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal size={13} className="text-emerald-600" />
                Filtros
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-slate-700 shadow-sm">
                {queueCards.length} de {analyses.length}
              </span>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value as 'all' | DecisionQueueKey)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              >
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
                <option value="monitored">Monitorados</option>
                <option value="unmonitored">Sem monitor</option>
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

          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <RotateCcw size={12} />
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {queueCards.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white py-20 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <Search size={24} />
          </div>
          <h3 className="text-lg font-black text-slate-800">Nada para gerir agora</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Nenhuma decisão salva corresponde à busca atual.
          </p>
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

          {/* Stage flow legend */}
          <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
            {/* Active pipeline */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400 mr-0.5">Fluxo</span>
              <span className="shrink-0 text-slate-200 mr-0.5">·</span>
              {(['not_started', 'triage', 'pending', 'proposal', 'submitted'] as const).map((key, i, arr) => (
                <span key={key} className="flex items-center gap-1">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${decisionQueueStages[key].className}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${decisionQueueStages[key].dotClass}`} />
                    {i + 1}. {decisionQueueStages[key].label}
                  </span>
                  {i < arr.length - 1 && <ChevronRight size={9} className="shrink-0 text-slate-300" />}
                </span>
              ))}
            </div>
            {/* Outcome branch */}
            <div className="flex flex-wrap items-center gap-1 border-l-2 border-slate-200 pl-2 ml-1">
              <span className="text-[11px] text-slate-400 mr-0.5">↳</span>
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-slate-400 mr-0.5">Resultado</span>
              <span className="shrink-0 text-slate-200 mr-0.5">·</span>
              {(['won', 'lost', 'abandoned'] as const).map((key, i, arr) => (
                <span key={key} className="flex items-center gap-1">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${decisionQueueStages[key].className}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${decisionQueueStages[key].dotClass}`} />
                    {decisionQueueStages[key].label}
                  </span>
                  {i < arr.length - 1 && <span className="text-[9px] text-slate-300">/</span>}
                </span>
              ))}
              <ChevronRight size={9} className="shrink-0 text-slate-300" />
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${decisionQueueStages.executed.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${decisionQueueStages.executed.dotClass}`} />
                {decisionQueueStages.executed.label}
              </span>
            </div>
          </div>

          <div ref={boardScrollRef} className="overflow-x-auto scroll-smooth pb-3">
            <div className="grid min-w-[2250px] grid-cols-9 gap-3">
            {columnOrder.map((stageKey) => {
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
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-8 text-center text-[11px] font-bold text-slate-400">
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
                        onOpenSummary={setSummaryModal}
                        onComplete={completeNextTask}
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
  onOpenSummary: (card: DecisionQueueCardModel) => void;
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
            {learnedResult}
          </div>
        )}

        {card.nextTask ? (
          <div className="rounded-xl border border-slate-100 bg-white p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Próxima ação</p>
              <button
                type="button"
                title={`Concluir: ${card.nextTask.acao}`}
                onClick={() => card.nextTask && onComplete(card.analysis, card.nextTask)}
                disabled={savingTaskId === quickTaskId}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingTaskId === quickTaskId ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
              </button>
            </div>
            <p className="line-clamp-2 text-xs font-black leading-snug text-slate-800">
              {card.nextTask.acao}
            </p>
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
            <button
              type="button"
              title={`Avançar para ${decisionQueueStages[nextStage].label}`}
              onClick={() => onStageChange(card.analysis, nextStage)}
              disabled={savingStageId === workflowTaskId}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingStageId === workflowTaskId ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            </button>
          ) : (
            <button
              type="button"
              title="Etapa final"
              disabled
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400"
            >
              <CheckCircle2 size={13} />
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

function OperationalSummaryModal({
  card,
  savingTaskId,
  savingStageId,
  onClose,
  onOpenLaudo,
  onComplete,
  onStageChange,
  onReviewRequest,
  onLearningRequest,
}: {
  card: DecisionQueueCardModel;
  savingTaskId: string | null;
  savingStageId: string | null;
  onClose: () => void;
  onOpenLaudo: (analysis: SavedAnalysis) => void;
  onComplete: (analysis: SavedAnalysis, task: DecisionQueueTask) => void;
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

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[140] flex items-start justify-center overflow-hidden bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
      style={{ top: headerOffset }}
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
  const [tipo, setTipo] = useState('resposta_orgao');
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const canSubmit = conteudo.trim().length >= 20 && !isSaving;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[150] flex items-start justify-center overflow-hidden bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
      style={{ top: headerOffset }}
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
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</label>
              <select
                value={tipo}
                onChange={(event) => setTipo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-slate-800 outline-none focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
              >
                <option value="resposta_orgao">Resposta do órgão</option>
                <option value="novo_documento">Novo documento</option>
                <option value="alteracao_edital">Alteração do edital</option>
                <option value="nova_cotacao">Nova cotação</option>
                <option value="decisao_interna">Decisão interna</option>
              </select>
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
  onSubmit: (card: DecisionQueueCardModel, payload: { participou: boolean; resultado: string; preco_final: string; vencedor: string; observacao: string }) => void;
}) {
  const headerOffset = useStickyHeaderOffset();
  const learning = card.analysis.decision_learning || {};
  const [participou, setParticipou] = useState(Boolean(learning.participou ?? true));
  const [resultado, setResultado] = useState(String(learning.resultado || 'won'));
  const [precoFinal, setPrecoFinal] = useState(String(learning.preco_final || ''));
  const [vencedor, setVencedor] = useState(String(learning.vencedor || ''));
  const [observacao, setObservacao] = useState(String(learning.observacao || ''));
  const finalResult = participou ? resultado : 'not_participated';

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[150] flex items-start justify-center overflow-hidden bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
      style={{ top: headerOffset }}
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
