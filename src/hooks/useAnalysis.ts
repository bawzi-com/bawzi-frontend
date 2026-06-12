/**
 * useAnalysis.ts
 * ─────────────────────────────────────────────────────────────────
 * Hook que encapsula todo o ciclo de vida de uma análise de edital:
 *   - Estado: result, isAnalyzing, error, modelSource, loadingXxx
 *   - Handlers: handleAnalyze, handleCancelAnalysis
 *   - Progresso temporal via useEffect interno
 *
 * O componente orquestrador (analysis-app.tsx) passa os inputs
 * necessários e recebe de volta o estado e as funções prontas.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { apiFetch, ensureSessionFor } from '@/lib/apiClient';
import type { AnalysisResult } from '@/components/analysis-types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Motor = 'openai' | 'claude';

interface PncpData {
  cnpj: string;
  ano: number;
  sequencial: number;
  uf?: string;
}

interface UseAnalysisInput {
  token: string | null;
  text: string;
  files: File[];
  uf: string;
  forceExact: boolean;
  pncpData: PncpData | null;
  userTier: number;
  isOverLimit: boolean;
  apiUrl: string;
  /** Chamado quando a análise requer upgrade (403/402) */
  onUpgradeNeeded: (tier: number) => void;
  /** Chamado quando o limite de análises gratuitas é atingido */
  onUpsellNeeded: (data: { title: string; desc: string }) => void;
  /** Chamado quando o usuário anónimo faz a primeira análise */
  onFreeTrialUsed: () => void;
}

interface UseAnalysisReturn {
  // Estado
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  error: string | null;
  successMsg: string | null;
  modelSource: string | null;
  isCachedResult: boolean;
  analysisId: string | null;
  impugnacaoText: string;
  loadingStep: number;
  loadingProgress: number;
  loadingRemainingSeconds: number;
  loadingEstimateSeconds: number;
  /** true quando o backend está reportando a etapa real (polling conectado) */
  progressoAoVivo: boolean;
  // Setters expostos
  setResult: (r: AnalysisResult | null) => void;
  setError: (e: string | null) => void;
  setImpugnacaoText: (t: string) => void;
  // Handlers
  handleAnalyze: (motor: Motor) => Promise<void>;
  handleCancelAnalysis: () => void;
  showError: (msg: string, ms?: number) => void;
  showSuccess: (msg: string, ms?: number) => void;
}

// ─── Mensagens de progresso ────────────────────────────────────────────────────

// Ordem REAL do pipeline do backend (cada etapa é reportada ao vivo via
// /analyze/progress/{token}): extração → LLM principal → mercado/financeiro
// → jurídico → consolidação. Antes a ordem era inventada e não batia.
const LOADING_MESSAGES = [
  { title: 'Preparando o edital',                       desc: 'Extraindo texto, anexos e dados do PNCP para a leitura dos agentes.' },
  { title: 'Agente analista lendo o edital',            desc: 'O motor principal cruza exigências, valores, riscos e aderência ao seu perfil.' },
  { title: 'Agentes de mercado e financeiro',           desc: 'Concorrentes recorrentes, preços históricos, deságio provável e war room.' },
  { title: 'Agente jurídico em parecer',                desc: 'Habilitação, prazos, cláusulas sensíveis e fundamentos da Lei 14.133/21.' },
  { title: 'Consolidando veredito e salvando',          desc: 'Score final, Go/No-Go, próximos passos e gravação no histórico.' },
];

export { LOADING_MESSAGES };

// ─── ETA adaptativo: mediana das últimas análises com o mesmo perfil ─────────
const DURACOES_KEY = 'bawzi_analysis_durations_v1';

function _bucketTamanho(chars: number): string {
  if (chars > 80000) return 'xl';
  if (chars > 30000) return 'l';
  return 'm';
}

function lerEstimativaHistorica(perfil: string): number | null {
  try {
    const mapa = JSON.parse(localStorage.getItem(DURACOES_KEY) || '{}');
    const arr: number[] = mapa[perfil];
    if (!arr || arr.length === 0) return null;
    const ordenado = [...arr].sort((a, b) => a - b);
    return ordenado[Math.floor(ordenado.length / 2)];
  } catch {
    return null;
  }
}

function gravarDuracaoReal(perfil: string, segundos: number) {
  try {
    const mapa = JSON.parse(localStorage.getItem(DURACOES_KEY) || '{}');
    mapa[perfil] = [...(mapa[perfil] || []), Math.round(segundos)].slice(-5);
    localStorage.setItem(DURACOES_KEY, JSON.stringify(mapa));
  } catch { /* localStorage indisponível */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalysis({
  token,
  text,
  files,
  uf,
  forceExact,
  pncpData,
  userTier,
  isOverLimit,
  apiUrl,
  onUpgradeNeeded,
  onUpsellNeeded,
  onFreeTrialUsed,
}: UseAnalysisInput): UseAnalysisReturn {

  const [result,                 setResult]                = useState<AnalysisResult | null>(null);
  const [isAnalyzing,            setIsAnalyzing]           = useState(false);
  const [error,                  setError]                 = useState<string | null>(null);
  const [successMsg,             setSuccessMsg]            = useState<string | null>(null);
  const [modelSource,            setModelSource]           = useState<string | null>(null);
  const [isCachedResult,         setIsCachedResult]        = useState(false);
  const [analysisId,             setAnalysisId]            = useState<string | null>(null);
  const [impugnacaoText,         setImpugnacaoText]        = useState('');
  const [loadingStep,            setLoadingStep]           = useState(0);
  const [loadingProgress,        setLoadingProgress]       = useState(0);
  const [loadingRemainingSeconds, setLoadingRemainingSeconds] = useState(30);
  const [loadingEstimateSeconds, setLoadingEstimateSeconds] = useState(30);

  const abortRef = useRef<AbortController | null>(null);

  // 📡 Progresso REAL: etapa reportada pelo backend via polling
  const realStepRef = useRef<number | null>(null);
  const [progressoAoVivo, setProgressoAoVivo] = useState(false);

  // ── Progresso temporal (suavização) + etapa real quando disponível ────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isAnalyzing) {
      const startedAt = Date.now();
      const totalSteps = LOADING_MESSAGES.length;
      const estimate = Math.max(loadingEstimateSeconds, 6);

      setLoadingStep(0);
      setLoadingProgress(4);
      setLoadingRemainingSeconds(estimate);

      interval = setInterval(() => {
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        const ratio = elapsedSeconds / estimate;
        let progress = ratio <= 1
          ? Math.min(94, Math.max(4, Math.round(ratio * 94)))
          : Math.min(99, 94 + Math.floor((elapsedSeconds - estimate) / 6));

        const realStep = realStepRef.current;
        let nextStep: number;
        if (realStep !== null) {
          // Etapa REAL do backend: a barra anda dentro dos limites da etapa
          // atual (nunca corre na frente da realidade, nem trava no visual).
          nextStep = Math.min(totalSteps - 1, realStep);
          const piso = Math.round((realStep / totalSteps) * 94) + 2;
          const teto = Math.round(((realStep + 1) / totalSteps) * 94);
          progress = Math.min(Math.max(progress, piso), teto);
        } else {
          nextStep = Math.min(totalSteps - 1, Math.floor((progress / 100) * totalSteps));
        }

        setLoadingProgress(progress);
        setLoadingRemainingSeconds(Math.max(0, Math.ceil(estimate - elapsedSeconds)));
        setLoadingStep(nextStep);
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, loadingEstimateSeconds]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showError = useCallback((msg: string, ms = 5000) => {
    setError(msg);
    setTimeout(() => setError(null), ms);
  }, []);

  const showSuccess = useCallback((msg: string, ms = 3500) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), ms);
  }, []);

  /** Perfil da análise — chave do histórico de durações reais. */
  const getPerfilAnalise = useCallback((motor: Motor): string => {
    const runsMarketAgents = Boolean(token) && userTier >= 2;
    return `${motor}:${userTier}:${runsMarketAgents ? 1 : 0}:${_bucketTamanho(text.length)}:${pncpData ? 1 : 0}`;
  }, [token, userTier, text.length, pncpData]);

  const getEstimateSeconds = useCallback((motor: Motor): number => {
    // 1º: mediana das últimas análises REAIS com o mesmo perfil (tier, motor,
    // tamanho, PNCP). Só cai na fórmula estática quando não há histórico.
    const historica = lerEstimativaHistorica(getPerfilAnalise(motor));
    if (historica && historica >= 6) {
      return Math.min(historica, 240);
    }

    const loggedIn = Boolean(token);
    const runsMarketAgents = loggedIn && userTier >= 2;

    let base = motor === 'claude' ? 35 : 30;
    if (runsMarketAgents) {
      if (userTier >= 4) base = motor === 'claude' ? 95 : 80;
      else if (userTier >= 3) base = motor === 'claude' ? 90 : 75;
      else base = motor === 'claude' ? 70 : 55;
    }

    const filePenalty = files.length > 0 ? (runsMarketAgents ? 10 : 4) : 0;
    const textPenalty = text.length > 80000 ? (runsMarketAgents ? 18 : 8) : text.length > 30000 ? (runsMarketAgents ? 10 : 4) : 0;
    const pncpPenalty = pncpData && runsMarketAgents ? 12 : 0;

    return Math.min(base + filePenalty + textPenalty + pncpPenalty, runsMarketAgents ? 130 : 45);
  }, [token, userTier, files.length, text.length, pncpData, getPerfilAnalise]);

  // ── handleCancelAnalysis ──────────────────────────────────────────────────
  const handleCancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
    setIsAnalyzing(false);
    setLoadingStep(0);
    setLoadingProgress(0);
    setLoadingRemainingSeconds(loadingEstimateSeconds);
    showError('Análise cancelada pelo usuário.', 4000);
  }, [loadingEstimateSeconds, showError]);

  // ── handleAnalyze ─────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async (motor: Motor) => {
    if (!text.trim() && files.length === 0 && !pncpData) {
      showError('Por favor, cole um texto, adicione um documento ou selecione um edital no Radar PNCP antes de analisar.');
      return;
    }
    if (isOverLimit) {
      onUpgradeNeeded(userTier >= 1 ? userTier + 1 : 2);
      return;
    }

    const estimateSeconds = getEstimateSeconds(motor);
    setLoadingEstimateSeconds(estimateSeconds);
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setIsCachedResult(false);
    abortRef.current = new AbortController();

    setTimeout(() => {
      const el = document.getElementById('area-loading');
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
    }, 50);

    // 🔐 Garante sessão válida para TODA a janela da análise (até ~2 min de
    // pipeline + ações pós-veredito). Sem isto, um token com <2 min de vida
    // podia expirar no meio do fluxo.
    await ensureSessionFor(15 * 60).catch(() => null);

    // 📡 Progresso real: token aleatório que o backend usa para reportar etapas
    const progressToken =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    realStepRef.current = null;
    setProgressoAoVivo(false);
    const inicioAnalise = Date.now();
    const baseUrl = apiUrl.replace(/\/$/, '');

    const pollInterval = setInterval(async () => {
      try {
        const r = await fetch(`${baseUrl}/api/analyze/progress/${progressToken}`);
        if (!r.ok) return;
        const p = await r.json();
        if (p.status === 'ok' && typeof p.etapa === 'number') {
          // Monotônico: nunca regride (etapas condicionais podem ser puladas)
          realStepRef.current = Math.max(realStepRef.current ?? 0, p.etapa);
          setProgressoAoVivo(true);
        }
      } catch { /* polling é melhor-esforço */ }
    }, 1500);

    try {
      const formData = new FormData();
      if (text.trim()) formData.set('raw_text', text.trim());
      files.forEach(f => formData.append('files', f));
      formData.set('uf', uf && uf.trim() !== '' ? uf.trim().toUpperCase() : 'BR');
      formData.set('force_exact', forceExact ? 'true' : 'false');
      formData.set('provider', motor);
      formData.set('progress_token', progressToken);
      if (pncpData) {
        formData.set('pncp_cnpj', pncpData.cnpj);
        formData.set('pncp_ano', pncpData.ano.toString());
        formData.set('pncp_sequencial', pncpData.sequencial.toString());
        if (pncpData.uf) formData.set('uf', pncpData.uf);
      }

      const response = await apiFetch(`${baseUrl}/api/analyze`, {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      });

      // 403 — Limite de análises atingido (upsell)
      if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.detail?.codigo === 'LIMIT_REACHED') {
          onUpsellNeeded({ title: errorData.detail.titulo, desc: errorData.detail.mensagem });
          setIsAnalyzing(false);
          return;
        }
      }

      // 402 — Precisa de upgrade de tier
      if (response.status === 402) {
        onUpgradeNeeded(userTier >= 1 ? userTier + 1 : 2);
        setIsAnalyzing(false);
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || 'Erro no servidor.');

      const analysisData = data.analysis || data;
      if (!analysisData || Object.keys(analysisData).length === 0 || !analysisData.score) {
        throw new Error('A IA processou o documento mas não conseguiu estruturar o resultado. Clique em Iniciar Análise novamente.');
      }

      setResult(analysisData as AnalysisResult);
      setAnalysisId(data.id || data.record_id || data.analysis_hash || null);
      setModelSource(data.source || data.model_source || 'Motor Bawzi IA');
      setIsCachedResult(data.is_cached || false);

      // 📊 Grava a duração REAL — vira a estimativa das próximas análises
      // (resultados de cache voltam em segundos e poluiriam a mediana)
      if (!data.is_cached) {
        gravarDuracaoReal(getPerfilAnalise(motor), (Date.now() - inicioAnalise) / 1000);
      }

      setTimeout(() => {
        const el = document.getElementById('area-resultados');
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 50, behavior: 'smooth' });
      }, 100);

      if (!token) {
        localStorage.setItem('bawzi_free_trial_used', 'true');
        onFreeTrialUsed();
      }

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      if (userTier === -1) { onUpgradeNeeded(2); setIsAnalyzing(false); return; }

      const msg = (err as Error).message || '';
      const display =
        msg.includes('NoneType') || msg.includes('401')
          ? 'Parece que a sua sessão expirou. Por favor, faça login novamente.'
          : msg.includes('500')
          ? 'O nosso motor de IA está sobrecarregado. Tente novamente em instantes.'
          : msg || 'Ocorreu um erro inesperado. Por favor, tente novamente.';
      setError(display);
    } finally {
      clearInterval(pollInterval);
      realStepRef.current = null;
      setIsAnalyzing(false);
    }
  }, [
    text, files, uf, forceExact, pncpData, userTier, isOverLimit,
    apiUrl, token, getEstimateSeconds, getPerfilAnalise, showError,
    onUpgradeNeeded, onUpsellNeeded, onFreeTrialUsed,
  ]);

  return {
    result, isAnalyzing, error, successMsg, modelSource, isCachedResult,
    analysisId, impugnacaoText, loadingStep, loadingProgress,
    loadingRemainingSeconds, loadingEstimateSeconds, progressoAoVivo,
    setResult, setError, setImpugnacaoText,
    handleAnalyze, handleCancelAnalysis, showError, showSuccess,
  };
}
