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
import { apiFetch } from '@/lib/apiClient';
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

const LOADING_MESSAGES = [
  { title: 'Preparando leitura multiagente', desc: 'Organizando o edital, os anexos e os sinais principais para iniciar a análise.' },
  { title: 'Agente jurídico em leitura',     desc: 'Verificando habilitação, prazos, exigências fiscais e pontos que podem gerar risco.' },
  { title: 'Agente financeiro calculando viabilidade', desc: 'Estimando margem, pressão por preço, deságio provável e esforço de execução.' },
  { title: 'Agente de mercado rastreando concorrência', desc: 'Mapeando fornecedores recorrentes, histórico semelhante e agressividade local.' },
  { title: 'Consolidando veredito Go/No-Go', desc: 'Cruzando os achados para montar score, alertas e próximos passos em linguagem direta.' },
];

export { LOADING_MESSAGES };

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

  // ── Progresso temporal ────────────────────────────────────────────────────
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
        const progress = Math.min(96, Math.max(4, Math.round((elapsedSeconds / estimate) * 100)));
        const nextStep = Math.min(totalSteps - 1, Math.floor((progress / 100) * totalSteps));
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

  const getEstimateSeconds = useCallback((motor: Motor): number => {
    const isFast = userTier === 4 && motor === 'openai';
    const base = isFast ? 8 : motor === 'claude' ? 35 : 30;
    const filePenalty = files.length > 0 ? 4 : 0;
    const textPenalty = text.length > 80000 ? 8 : text.length > 30000 ? 4 : 0;
    return Math.min(base + filePenalty + textPenalty, isFast ? 15 : 45);
  }, [userTier, files.length, text.length]);

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

    try {
      const formData = new FormData();
      if (text.trim()) formData.set('raw_text', text.trim());
      files.forEach(f => formData.append('files', f));
      formData.set('uf', uf && uf.trim() !== '' ? uf.trim().toUpperCase() : 'BR');
      formData.set('force_exact', forceExact ? 'true' : 'false');
      formData.set('provider', motor);
      if (pncpData) {
        formData.set('pncp_cnpj', pncpData.cnpj);
        formData.set('pncp_ano', pncpData.ano.toString());
        formData.set('pncp_sequencial', pncpData.sequencial.toString());
        if (pncpData.uf) formData.set('uf', pncpData.uf);
      }

      const response = await apiFetch(`${apiUrl.replace(/\/$/, '')}/api/analyze`, {
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
      setIsAnalyzing(false);
    }
  }, [
    text, files, uf, forceExact, pncpData, userTier, isOverLimit,
    apiUrl, token, getEstimateSeconds, showError,
    onUpgradeNeeded, onUpsellNeeded, onFreeTrialUsed,
  ]);

  return {
    result, isAnalyzing, error, successMsg, modelSource, isCachedResult,
    analysisId, impugnacaoText, loadingStep, loadingProgress,
    loadingRemainingSeconds, loadingEstimateSeconds,
    setResult, setError, setImpugnacaoText,
    handleAnalyze, handleCancelAnalysis, showError, showSuccess,
  };
}
