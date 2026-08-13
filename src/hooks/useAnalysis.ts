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
import { apiFetch, ensureSessionFor, mensagemDeErro } from '@/lib/apiClient';
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
  activeCnpj?: string;
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
  /** Sub-progresso da auditoria profunda (bloco N de M · K achados), ao vivo. */
  progressoAuditoria: {
    fase?: string; blocos_concluidos?: number; blocos_total?: number; achados?: number;
  } | null;
  /** ETA medido por modo (mediana do perfil) — para o card de escolha. */
  getEstimateSeconds: (motor: Motor) => number;
  // Setters expostos
  setResult: (r: AnalysisResult | null) => void;
  setError: (e: string | null) => void;
  setImpugnacaoText: (t: string) => void;
  // Handlers
  handleAnalyze: (motor: Motor, opts?: { aprofundarDe?: string }) => Promise<void>;
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
  activeCnpj,
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
  // Sub-progresso da AUDITORIA (só na profunda): bloco N de M · K achados.
  // É o trabalho pelo qual a profunda cobra 4× — sem isto, os minutos de
  // espera eram idênticos aos da rápida na tela.
  const [progressoAuditoria, setProgressoAuditoria] = useState<{
    fase?: string; blocos_concluidos?: number; blocos_total?: number; achados?: number;
  } | null>(null);

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
    // O teto do histórico era 240s. Com a auditoria profunda rodando em
    // `effort=high` na Anthropic, uma análise real passa disso — e um teto
    // abaixo da duração verdadeira faz a barra encher, parar em 100% e ficar
    // girando, que é a pior leitura possível: parece travamento, não espera.
    // Deixar o histórico falar é o ponto: ele é medição, não chute.
    const historica = lerEstimativaHistorica(getPerfilAnalise(motor));
    if (historica && historica >= 6) {
      return Math.min(historica, motor === 'claude' ? 900 : 240);
    }

    const loggedIn = Boolean(token);
    const runsMarketAgents = loggedIn && userTier >= 2;

    // Na primeira execução (sem histórico) é melhor superestimar a auditoria
    // profunda: terminar antes do previsto é uma boa surpresa, estourar a
    // previsão na frente de um cliente não é.
    let base = motor === 'claude' ? 180 : 30;
    if (runsMarketAgents) {
      if (userTier >= 4) base = motor === 'claude' ? 300 : 80;
      else if (userTier >= 3) base = motor === 'claude' ? 285 : 75;
      else base = motor === 'claude' ? 240 : 55;
    }

    const filePenalty = files.length > 0 ? (runsMarketAgents ? 10 : 4) : 0;
    const textPenalty = text.length > 80000 ? (runsMarketAgents ? 18 : 8) : text.length > 30000 ? (runsMarketAgents ? 10 : 4) : 0;
    const pncpPenalty = pncpData && runsMarketAgents ? 12 : 0;

    const teto = motor === 'claude' ? 900 : (runsMarketAgents ? 130 : 45);
    return Math.min(base + filePenalty + textPenalty + pncpPenalty, teto);
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
  // `opts.aprofundarDe`: id do laudo RÁPIDO deste mesmo edital — o backend
  // abate os créditos já pagos e cobra só a diferença ("Aprofundar este laudo").
  const handleAnalyze = useCallback(async (motor: Motor, opts?: { aprofundarDe?: string }) => {
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
    setProgressoAuditoria(null);
    const inicioAnalise = Date.now();
    const baseUrl = apiUrl.replace(/\/$/, '');

    // 🔖 Marcador de análise em curso — sobrevive a F5. Uma auditoria profunda
    // leva até 15 minutos e o resultado vivia só no estado React: recarregar a
    // página perdia tudo. Com o marcador, o workspace remonta, encontra o
    // progresso pelo token e reabre o laudo quando o backend concluir
    // (`_progresso_concluir` grava o resultado_id). Só para autenticados:
    // laudo de convidado não persiste, então não haveria o que reencontrar.
    if (token) {
      try {
        localStorage.setItem('bawzi_analise_em_curso', JSON.stringify({
          progressToken,
          startedAt: Date.now(),
          motor,
        }));
      } catch { /* sem storage: análise segue, só sem retomada pós-reload */ }
    }
    // O botão "Tentar novamente" do banner de erro repete o último motor
    // pedido — sem isto ele teria de adivinhar entre rápida e profunda.
    try { sessionStorage.setItem('bawzi_ultimo_motor', motor); } catch { /* sem storage */ }

    const pollInterval = setInterval(async () => {
      try {
        const r = await fetch(`${baseUrl}/api/analyze/progress/${progressToken}`);
        if (!r.ok) return;
        const p = await r.json();
        if (p.status === 'ok' && typeof p.etapa === 'number') {
          // Monotônico: nunca regride (etapas condicionais podem ser puladas)
          realStepRef.current = Math.max(realStepRef.current ?? 0, p.etapa);
          setProgressoAoVivo(true);
          setProgressoAuditoria(
            p.auditoria && typeof p.auditoria === 'object' ? p.auditoria : null,
          );
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
      if (opts?.aprofundarDe) formData.set('aprofundar_de', opts.aprofundarDe);
      if (activeCnpj) formData.set('context_cnpj', activeCnpj);
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

      // 403 — limites de uso.
      //
      // ⚠️ O corpo é lido UMA vez e a função SEMPRE retorna aqui. Antes, um 403
      // com código diferente de LIMIT_REACHED saía deste `if` e caía no
      // `await response.json()` de baixo — no mesmo Response, já consumido —,
      // lançando "body stream already read" em vez de mostrar a mensagem.
      // Quem passava por ali era o convidado que gastou a análise do dia:
      // recebia um erro de stream no lugar do convite para criar conta.
      if (response.status === 403) {
        const detalhe = await response.json().then(d => d?.detail).catch(() => null);
        const codigo = detalhe?.codigo;

        if (codigo === 'LIMIT_REACHED') {
          // Teto do plano: aqui o upsell faz sentido.
          onUpsellNeeded({ title: detalhe.titulo, desc: detalhe.mensagem });
        } else if (codigo === 'MODE_LIMIT_REACHED') {
          // Teto de UM dos modos. Nada de upsell: quem esbarra no limite da
          // auditoria profunda já está no plano que a inclui, e o outro modo
          // continua disponível — o backend diz qual em `alternativa`.
          setError(detalhe.mensagem || 'Limite deste tipo de análise atingido neste período.');
        } else {
          setError(mensagemDeErro(detalhe, 'Limite de uso atingido.'));
        }
        setIsAnalyzing(false);
        return;
      }

      // 402 — Precisa de upgrade de tier
      if (response.status === 402) {
        onUpgradeNeeded(userTier >= 1 ? userTier + 1 : 2);
        setIsAnalyzing(false);
        return;
      }

      const data = await response.json();
      // ⚠️ `data.detail` pode ser objeto (`{codigo, titulo, mensagem}`) ou lista
      // (validação 422). `new Error(objeto)` produz a mensagem "[object Object]",
      // que era exatamente o que o cliente lia na tela ao estourar o limite de
      // caracteres — no lugar de "o seu plano permite até 80.000".
      if (!response.ok) throw new Error(mensagemDeErro(data?.detail, 'Erro no servidor.'));

      const analysisData = data.analysis || data;
      if (!analysisData || Object.keys(analysisData).length === 0 || !analysisData.score) {
        throw new Error('A IA processou o documento mas não conseguiu estruturar o resultado. Clique em Iniciar Análise novamente.');
      }

      setResult(analysisData as AnalysisResult);
      // O caminho de cache devolve { analysis: {...}, is_cached: true } e o
      // caminho fresco devolve o dict achatado. Ler só de `data` fazia o id e o
      // source virem nulos em todo cache hit — e sem id o compartilhar/reabrir
      // do laudo quebra. Procura nos dois níveis.
      setAnalysisId(
        analysisData.id || analysisData.record_id || analysisData.analysis_hash ||
        data.id || data.record_id || data.analysis_hash || null
      );
      setModelSource(
        analysisData.source || analysisData.model_source ||
        data.source || data.model_source || 'Motor Bawzi IA'
      );
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
        // Persiste uso com a data de hoje para reset diário automático
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('bawzi_guest_quota', JSON.stringify({ date: today, used: 1 }));
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
      // A corrida terminou NESTA sessão (sucesso, erro ou cancelamento):
      // o marcador de retomada já não tem o que retomar. Ele só deve
      // sobreviver quando a página morre no meio — que é exatamente o
      // único caminho em que este finally não roda.
      // ⚠️ Guarda pelo token: em outra aba (ou numa análise iniciada logo em
      // seguida) o marcador pode já ser de OUTRA análise — apagar sem conferir
      // mataria a retomada dela.
      try {
        const atual = localStorage.getItem('bawzi_analise_em_curso');
        if (atual && JSON.parse(atual)?.progressToken === progressToken) {
          localStorage.removeItem('bawzi_analise_em_curso');
        }
      } catch { /* sem storage */ }
    }
  }, [
    text, files, uf, forceExact, pncpData, activeCnpj, userTier, isOverLimit,
    apiUrl, token, getEstimateSeconds, getPerfilAnalise, showError,
    onUpgradeNeeded, onUpsellNeeded, onFreeTrialUsed,
  ]);

  return {
    result, isAnalyzing, error, successMsg, modelSource, isCachedResult,
    analysisId, impugnacaoText, loadingStep, loadingProgress,
    loadingRemainingSeconds, loadingEstimateSeconds, progressoAoVivo,
    progressoAuditoria,
    // Exposto para o card de escolha exibir o ETA MEDIDO (mediana das últimas
    // análises do mesmo perfil) em vez de "vários minutos".
    getEstimateSeconds,
    setResult, setError, setImpugnacaoText,
    handleAnalyze, handleCancelAnalysis, showError, showSuccess,
  };
}
