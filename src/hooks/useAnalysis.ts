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
import {
  atualizarMarcadorAnalise,
  gravarMarcadorAnalise,
  lerMarcadorAnalise,
  removerMarcadorAnalise,
  type MarcadorAnalise,
} from '@/lib/analiseEmCurso';

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
}

export interface OpcoesDeAnalise {
  /** id do laudo RÁPIDO deste mesmo edital (ver "Aprofundar este laudo"). */
  aprofundarDe?: string;
  /** "Analisar mesmo assim" depois do aviso de edital que PARECE encerrado. */
  ignorarPrazoEncerrado?: boolean;
}

/** O 409 EDITAL_ENCERRADO do servidor, pronto para a tela. */
export interface EditalEncerradoAviso {
  titulo: string;
  mensagem: string;
  dataFim: string | null;
  /** 'pncp' = data oficial (barra de vez); 'texto' = lida do edital. */
  fonte: string | null;
  trecho: string | null;
  /** Só a leitura do texto deixa seguir; a data oficial, não. */
  podeProsseguir: boolean;
  /** Para o "Analisar mesmo assim" repetir exatamente o pedido. */
  motor: Motor;
  aprofundarDe?: string;
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
  /** true quando o overlay acompanha uma análise RETOMADA pelo marcador — a
   *  página foi recarregada ou o app remontou no meio (troca de rota). Não há
   *  requisição viva nesta tela, só o polling do progresso; "Cancelar" vira
   *  "parar de acompanhar", porque o servidor não para. */
  analiseReanexada: boolean;
  /** true entre o pedido de cancelar e o veredito do servidor (a análise para
   *  no próximo ponto de parada — ou já tinha terminado). */
  cancelando: boolean;
  /** Recusa do servidor por edital encerrado (409 EDITAL_ENCERRADO). */
  editalEncerrado: EditalEncerradoAviso | null;
  dispensarEditalEncerrado: () => void;
  // Setters expostos
  setResult: (r: AnalysisResult | null) => void;
  setError: (e: string | null) => void;
  setImpugnacaoText: (t: string) => void;
  // Handlers
  handleAnalyze: (motor: Motor, opts?: OpcoesDeAnalise) => Promise<void>;
  handleCancelAnalysis: () => Promise<void>;
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

  // ── Ciclo de vida desta tela (ver a retomada e o `finally` do handleAnalyze)
  // A requisição de uma análise sobrevive à tela que a disparou. Quando ela
  // termina com a tela desmontada, `montadoRef` decide o destino do desfecho:
  // anotado no marcador, em vez de entregue a ninguém.
  const montadoRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Instante de início da análise em tela (a retomada usa o do marcador). */
  const inicioRef = useRef<number | null>(null);
  /** Espelho síncrono de `isAnalyzing` para as guardas fora do render. */
  const isAnalyzingRef = useRef(false);
  /** Token da análise retomada que esta tela acompanha (null = nenhuma). */
  const reanexadaTokenRef = useRef<string | null>(null);
  const [analiseReanexada, setAnaliseReanexada] = useState(false);
  const [editalEncerrado, setEditalEncerrado] = useState<EditalEncerradoAviso | null>(null);
  /** Token da análise VIVA nesta tela — o que o "Cancelar" manda ao servidor. */
  const progressTokenAtualRef = useRef<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  /** Espelho síncrono: o veredito da requisição viva precisa saber se houve pedido. */
  const cancelamentoPedidoRef = useRef(false);

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
      // Retomada: o relógio é o da ANÁLISE, não o da tela que a reencontrou —
      // senão a barra recomeçaria do zero no meio de uma auditoria de 10 min.
      const startedAt = inicioRef.current ?? Date.now();
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

  // ── Montagem: tela viva ou morta ──────────────────────────────────────────
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      // O polling desta tela morre com ela. A REQUISIÇÃO não: o servidor
      // termina a análise de qualquer jeito, e é o `finally` do handleAnalyze
      // que anota no marcador como ela acabou.
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  // ── Retomada: a análise continua no servidor e esta tela a reencontra ─────
  // Antes, a retomada (só pós-F5) era uma faixa azul em cima do formulário, e
  // o laudo abria no Histórico. Agora é o MESMO overlay, na etapa real, e o
  // laudo abre aqui ao concluir — no F5 e na troca de rota, o caso que mais
  // acontecia (os links do cabeçalho desmontam o app).
  const encerrarReanexacao = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    reanexadaTokenRef.current = null;
    realStepRef.current = null;
    inicioRef.current = null;
    isAnalyzingRef.current = false;
    cancelamentoPedidoRef.current = false;
    setCancelando(false);
    setAnaliseReanexada(false);
    setIsAnalyzing(false);
  }, []);

  const entregarLaudoConcluido = useCallback(async (progressToken: string, resultadoId?: string | null) => {
    const baseUrl = apiUrl.replace(/\/$/, '');
    const falhar = (msg: string) => {
      if (!montadoRef.current) return;
      encerrarReanexacao();
      removerMarcadorAnalise(progressToken);
      setError(msg);
    };
    if (!resultadoId) {
      falhar('A análise terminou e o laudo foi salvo, mas não consegui abri-lo aqui. Ele está em Decisões.');
      return;
    }
    try {
      const res = await apiFetch(`${baseUrl}/api/analyses/${encodeURIComponent(resultadoId)}`);
      const data = res.ok ? await res.json() : null;
      const analysisData = data?.analysis || data;
      if (!analysisData || !analysisData.score) {
        falhar('A análise terminou e o laudo foi salvo, mas não consegui abri-lo aqui. Ele está em Decisões.');
        return;
      }
      // Saiu de novo enquanto o laudo baixava: o marcador fica para a próxima.
      if (!montadoRef.current) return;
      encerrarReanexacao();
      removerMarcadorAnalise(progressToken);
      setResult(analysisData as AnalysisResult);
      setAnalysisId(String(analysisData.id || resultadoId));
      setModelSource(analysisData.source || analysisData.model_source || 'Motor Bawzi IA');
      setIsCachedResult(false);
      showSuccess('A análise que estava rodando terminou — o laudo está aberto.', 6000);
      setTimeout(() => {
        const el = document.getElementById('area-resultados');
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 50, behavior: 'smooth' });
      }, 100);
    } catch {
      // Rede caiu no meio: o marcador fica — a próxima montagem tenta de novo.
      if (!montadoRef.current) return;
      encerrarReanexacao();
      setError('A análise terminou, mas a conexão falhou ao abrir o laudo. Ele está salvo em Decisões.');
    }
  }, [apiUrl, encerrarReanexacao, showSuccess]);

  const reanexar = useCallback((m: MarcadorAnalise) => {
    if (m.status === 'concluida') { void entregarLaudoConcluido(m.progressToken, m.resultadoId); return; }
    if (m.status === 'erro') {
      removerMarcadorAnalise(m.progressToken);
      setError(m.erro || 'A análise que estava rodando não terminou. Rode novamente — créditos só são debitados quando a análise conclui.');
      return;
    }

    const baseUrl = apiUrl.replace(/\/$/, '');
    reanexadaTokenRef.current = m.progressToken;
    inicioRef.current = m.startedAt;
    realStepRef.current = null;
    isAnalyzingRef.current = true;
    setLoadingEstimateSeconds(
      m.estimateSeconds && m.estimateSeconds >= 6 ? m.estimateSeconds : getEstimateSeconds(m.motor),
    );
    setError(null);
    setResult(null);
    setProgressoAoVivo(false);
    setProgressoAuditoria(null);
    setAnaliseReanexada(true);
    setIsAnalyzing(true);

    let semSinal = 0;
    let vistoRodando = false;
    let emVoo = false;
    const tick = async () => {
      if (emVoo || reanexadaTokenRef.current !== m.progressToken) return;
      emVoo = true;
      try {
        // O desfecho pode ter sido anotado pela requisição órfã desta mesma
        // página (troca de rota sem recarregar) — ela chega antes do polling.
        const anotado = lerMarcadorAnalise();
        if (anotado?.progressToken === m.progressToken && anotado.status === 'concluida') {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          await entregarLaudoConcluido(m.progressToken, anotado.resultadoId);
          return;
        }
        if (anotado?.progressToken === m.progressToken && anotado.status === 'erro') {
          encerrarReanexacao();
          removerMarcadorAnalise(m.progressToken);
          setError(anotado.erro || 'A análise que estava rodando não terminou. Rode novamente — créditos só são debitados quando a análise conclui.');
          return;
        }

        const r = await fetch(`${baseUrl}/api/analyze/progress/${encodeURIComponent(m.progressToken)}`);
        if (!r.ok || reanexadaTokenRef.current !== m.progressToken) return;
        const p = await r.json();
        if (reanexadaTokenRef.current !== m.progressToken) return;

        if (p?.status === 'ok') {
          semSinal = 0;
          if (p.cancelada) {
            // Cancelada (daqui ou de outra aba): nada gravado, nada cobrado —
            // a retomada só existe para quem tem conta, e para ela isso vale.
            encerrarReanexacao();
            removerMarcadorAnalise(m.progressToken);
            showSuccess('Análise cancelada. Nada foi cobrado.', 6000);
            return;
          }
          if (p.done) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            await entregarLaudoConcluido(m.progressToken, p.resultado_id);
            return;
          }
          vistoRodando = true;
          if (typeof p.etapa === 'number') {
            realStepRef.current = Math.max(realStepRef.current ?? 0, p.etapa);
            setProgressoAoVivo(true);
          }
          setProgressoAuditoria(p.auditoria && typeof p.auditoria === 'object' ? p.auditoria : null);
          return;
        }

        // "desconhecido": o registro expirou (o laudo está no histórico) ou a
        // análise morreu com o servidor. Recém-iniciada ainda pode não ter
        // reportado nada — daí a paciência de até 3 min sem sinal nenhum.
        semSinal += 1;
        if (semSinal >= 5 && (vistoRodando || Date.now() - m.startedAt > 180_000)) {
          encerrarReanexacao();
          removerMarcadorAnalise(m.progressToken);
          setError('Perdemos o rastro da análise que estava rodando. Se ela chegou ao fim, o laudo está em Decisões; senão, rode novamente — créditos só são debitados quando a análise conclui.');
        }
      } catch { /* rede: o próximo tick tenta de novo */ }
      finally { emVoo = false; }
    };

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(tick, 3000);
    void tick();
  }, [apiUrl, getEstimateSeconds, entregarLaudoConcluido, encerrarReanexacao, showSuccess]);

  // Ao montar (e quando a sessão aparece): há análise deste navegador rodando?
  useEffect(() => {
    if (!token) return;
    // Análise VIVA nesta tela (a requisição é daqui): não há o que retomar.
    if (isAnalyzingRef.current && !reanexadaTokenRef.current) return;
    const m = lerMarcadorAnalise();
    if (m) reanexar(m);
    // A retomada é um evento de CHEGADA: digitar no formulário (que muda a
    // identidade de `reanexar` via `getEstimateSeconds`) não pode redispará-la.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const dispensarEditalEncerrado = useCallback(() => setEditalEncerrado(null), []);

  // ── handleCancelAnalysis ──────────────────────────────────────────────────
  // ⚠️ "CANCELAR" ANTES SÓ FECHAVA A CONEXÃO. O servidor não percebe o
  // cliente indo embora (medido — ver backend/app/services/cancelamento.py):
  // a análise "cancelada" terminava, era gravada e cobrada, e reaparecia em
  // Decisões. Agora o pedido vai ao servidor, que para no próximo ponto de
  // parada e não grava. O VEREDITO vem pelo canal de sempre — a requisição
  // viva responde 409 ANALISE_CANCELADA (ou o laudo, se ele terminou antes);
  // na retomada, o /progress diz `cancelada` ou `done`. A tela só afirma
  // "nada foi cobrado" quando o servidor confirma.
  const handleCancelAnalysis = useCallback(async () => {
    if (cancelamentoPedidoRef.current) return;       // clique duplo
    const retomada = reanexadaTokenRef.current;
    const token = retomada ?? progressTokenAtualRef.current;
    if (!token) {
      // A requisição nem saiu (sessão sendo renovada): o servidor nunca soube
      // dela. Abortar aqui basta.
      abortRef.current?.abort();
      setIsAnalyzing(false);
      setLoadingStep(0);
      setLoadingProgress(0);
      setLoadingRemainingSeconds(loadingEstimateSeconds);
      showError('Análise cancelada pelo usuário.', 4000);
      return;
    }

    cancelamentoPedidoRef.current = true;
    setCancelando(true);
    const baseUrl = apiUrl.replace(/\/$/, '');
    let resposta: { status?: string; resultado_id?: string | null } | null = null;
    let proibido = false;
    try {
      const r = await apiFetch(`${baseUrl}/api/analyze/cancel/${encodeURIComponent(token)}`, { method: 'POST' });
      proibido = r.status === 403;
      resposta = r.ok ? await r.json() : null;
    } catch { resposta = null; }

    if (!resposta) {
      // Não chegou ao servidor: NÃO dá para dizer que parou. A análise segue.
      cancelamentoPedidoRef.current = false;
      setCancelando(false);
      showError(
        proibido
          ? 'Esta análise pertence a outra conta e não pode ser cancelada daqui.'
          : 'Não consegui cancelar agora — a análise continua. Tente de novo em instantes.',
        7000,
      );
      return;
    }

    if (retomada) {
      // Sem requisição viva: o desfecho imediato já se resolve aqui; o
      // "cancelando" segue pelo polling da retomada.
      if (resposta.status === 'ja_concluida') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        await entregarLaudoConcluido(retomada, resposta.resultado_id);
      } else if (resposta.status === 'cancelada') {
        encerrarReanexacao();
        removerMarcadorAnalise(retomada);
        showSuccess('Análise cancelada. Nada foi cobrado.', 6000);
      }
    }
    // Análise viva: 'cancelando', 'cancelada' e 'ja_concluida' se resolvem na
    // resposta da própria requisição (ver o 409 e o sucesso no handleAnalyze).
  }, [apiUrl, loadingEstimateSeconds, showError, showSuccess, encerrarReanexacao, entregarLaudoConcluido]);

  // ── handleAnalyze ─────────────────────────────────────────────────────────
  // `opts.aprofundarDe`: id do laudo RÁPIDO deste mesmo edital — o backend
  // abate os créditos já pagos e cobra só a diferença ("Aprofundar este laudo").
  const handleAnalyze = useCallback(async (motor: Motor, opts?: OpcoesDeAnalise) => {
    // ⚠️ SEM CONTA NÃO SE ANALISA (26/09/2026). O servidor responde 401 antes
    // do handler; aqui o convite para criar a conta vem antes do pedido.
    // `onUpgradeNeeded` sem token abre o CADASTRO (`handleUpgrade` do
    // analysis-app), nunca o checkout.
    if (!token) {
      onUpgradeNeeded(1);
      return;
    }
    if (!text.trim() && files.length === 0 && !pncpData) {
      showError('Por favor, cole um texto, adicione um documento ou selecione um edital no Radar PNCP antes de analisar.');
      return;
    }
    if (isOverLimit) {
      onUpgradeNeeded(userTier >= 1 ? userTier + 1 : 2);
      return;
    }

    // ⚠️ UMA ANÁLISE POR VEZ. A que está rodando (aqui ou retomada) termina
    // primeiro: duas em paralelo custam IA em dobro e, se as duas concluírem,
    // debitam duas vezes. Nada impedia — e voltar ao formulário depois de
    // trocar de rota convidava exatamente a isso.
    if (isAnalyzingRef.current) {
      showError('Já existe uma análise em andamento. Aguarde ela terminar para iniciar outra.');
      return;
    }
    if (token) {
      const outra = lerMarcadorAnalise();
      if (outra && outra.status === 'rodando') {
        // Marcador de outra aba (ou de uma tela que morreu): confere no
        // servidor antes de barrar — marcador órfão não pode travar ninguém.
        let rodando = false;
        try {
          const r = await fetch(`${apiUrl.replace(/\/$/, '')}/api/analyze/progress/${encodeURIComponent(outra.progressToken)}`);
          if (r.ok) {
            const p = await r.json();
            rodando = p?.status === 'ok' && !p.done;
          }
        } catch { /* sem rede: não barra por suposição */ }
        if (rodando) {
          showError('Já existe uma análise em andamento (em outra aba ou iniciada antes). Aguarde ela terminar para iniciar outra.', 7000);
          return;
        }
      }
    }

    const estimateSeconds = getEstimateSeconds(motor);
    setLoadingEstimateSeconds(estimateSeconds);
    inicioRef.current = Date.now();
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setError(null);
    setEditalEncerrado(null);
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
    progressTokenAtualRef.current = progressToken;
    cancelamentoPedidoRef.current = false;
    setCancelando(false);
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
      // Sem storage, `gravarMarcadorAnalise` não faz nada: a análise segue,
      // só sem retomada. O ETA vai junto para a retomada andar na mesma régua.
      gravarMarcadorAnalise({
        progressToken,
        startedAt: inicioRef.current ?? Date.now(),
        motor,
        estimateSeconds,
        status: 'rodando',
      });
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
    pollRef.current = pollInterval;

    // Como a análise terminou — anotado no marcador se a tela já tiver morrido
    // quando a resposta chegar (ver o `finally`).
    let desfecho: Pick<MarcadorAnalise, 'status' | 'resultadoId' | 'erro'> | null = null;
    // Cancelada a pedido: o marcador sai mesmo com a tela desmontada — não há
    // o que retomar nem de que avisar na volta.
    let foiCancelada = false;

    try {
      const formData = new FormData();
      if (text.trim()) formData.set('raw_text', text.trim());
      files.forEach(f => formData.append('files', f));
      formData.set('uf', uf && uf.trim() !== '' ? uf.trim().toUpperCase() : 'BR');
      formData.set('force_exact', forceExact ? 'true' : 'false');
      formData.set('provider', motor);
      formData.set('progress_token', progressToken);
      if (opts?.aprofundarDe) formData.set('aprofundar_de', opts.aprofundarDe);
      if (opts?.ignorarPrazoEncerrado) formData.set('ignorar_prazo_encerrado', 'true');
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

      // 409 — edital encerrado. O servidor recusa ANTES de cota, crédito e IA.
      // Data oficial do PNCP barra de vez; data lida do texto deixa seguir
      // ("Analisar mesmo assim" repete o pedido com `ignorarPrazoEncerrado`).
      if (response.status === 409) {
        const detalhe = await response.json().then(d => d?.detail).catch(() => null);
        if (detalhe?.codigo === 'ANALISE_CANCELADA') {
          // O veredito do "Cancelar": parou no servidor. A mensagem é a DELE —
          // só ele sabe se algo foi cobrado.
          foiCancelada = true;
          setIsAnalyzing(false);
          showSuccess(String(detalhe.mensagem || 'Análise cancelada. Nada foi cobrado.'), 7000);
          return;
        }
        if (detalhe?.codigo === 'EDITAL_ENCERRADO') {
          const aviso: EditalEncerradoAviso = {
            titulo: String(detalhe.titulo || 'Edital encerrado'),
            mensagem: String(detalhe.mensagem || 'O prazo de propostas deste edital já terminou.'),
            dataFim: detalhe.data_fim ?? null,
            fonte: detalhe.fonte ?? null,
            trecho: detalhe.trecho ?? null,
            podeProsseguir: Boolean(detalhe.pode_prosseguir),
            motor,
            aprofundarDe: opts?.aprofundarDe,
          };
          setEditalEncerrado(aviso);
          desfecho = { status: 'erro', erro: aviso.mensagem };
        } else {
          const msg = mensagemDeErro(detalhe, 'Não foi possível iniciar a análise.');
          setError(msg);
          desfecho = { status: 'erro', erro: msg };
        }
        setIsAnalyzing(false);
        return;
      }

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
        desfecho = { status: 'erro', erro: 'A análise não foi iniciada: limite de uso atingido.' };
        setIsAnalyzing(false);
        return;
      }

      // 402 — Precisa de upgrade de tier
      if (response.status === 402) {
        onUpgradeNeeded(userTier >= 1 ? userTier + 1 : 2);
        desfecho = { status: 'erro', erro: 'A análise não foi iniciada: o plano atual não inclui este recurso.' };
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

      // Id do LAUDO no banco — o único que `/api/analyses/{id}` sabe abrir
      // (`analysis_hash` é chave de cache, não reabre nada).
      desfecho = {
        status: 'concluida',
        resultadoId: analysisData.id || analysisData.record_id || data.id || data.record_id || null,
      };
      setResult(analysisData as AnalysisResult);
      if (cancelamentoPedidoRef.current) {
        // Perdeu a corrida: o laudo já estava sendo gravado quando o pedido
        // chegou. Ele foi entregue — e cobrado —, e a tela diz isso.
        showSuccess('A análise terminou antes de o cancelamento chegar: o laudo foi entregue normalmente.', 8000);
      }
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
      desfecho = { status: 'erro', erro: display };
    } finally {
      clearInterval(pollInterval);
      if (pollRef.current === pollInterval) pollRef.current = null;
      realStepRef.current = null;
      inicioRef.current = null;
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      // ⚠️ "A PÁGINA MORRE NO MEIO" NÃO ERA O ÚNICO CAMINHO. Este comentário
      // dizia que o marcador só devia sobreviver quando a página morresse — o
      // único caso em que este `finally` não roda. Mas a TELA morre sem a
      // página: trocar de rota desmonta o app e a requisição segue viva,
      // órfã. Ela terminava aqui e apagava o marcador; a tela nova não tinha
      // o que retomar, e o laudo sumia (estava no histórico, sem aviso).
      //
      // Tela viva: o desfecho foi entregue a ela — o marcador sai.
      // Tela morta: o desfecho vai PARA o marcador, e a próxima montagem (ou
      // o chip do cabeçalho) o encontra. Sem desfecho (abortada), fica.
      // A guarda por token está nas duas funções: o marcador pode já ser de
      // OUTRA análise, e mexer nele sem conferir mataria a retomada dela.
      if (progressTokenAtualRef.current === progressToken) progressTokenAtualRef.current = null;
      cancelamentoPedidoRef.current = false;
      setCancelando(false);
      if (montadoRef.current || foiCancelada) {
        removerMarcadorAnalise(progressToken);
      } else if (desfecho) {
        atualizarMarcadorAnalise(progressToken, desfecho);
      }
    }
  }, [
    text, files, uf, forceExact, pncpData, activeCnpj, userTier, isOverLimit,
    apiUrl, token, getEstimateSeconds, getPerfilAnalise, showError, showSuccess,
    onUpgradeNeeded, onUpsellNeeded,
  ]);

  return {
    result, isAnalyzing, error, successMsg, modelSource, isCachedResult,
    analysisId, impugnacaoText, loadingStep, loadingProgress,
    loadingRemainingSeconds, loadingEstimateSeconds, progressoAoVivo,
    progressoAuditoria,
    analiseReanexada, cancelando, editalEncerrado, dispensarEditalEncerrado,
    // Exposto para o card de escolha exibir o ETA MEDIDO (mediana das últimas
    // análises do mesmo perfil) em vez de "vários minutos".
    getEstimateSeconds,
    setResult, setError, setImpugnacaoText,
    handleAnalyze, handleCancelAnalysis, showError, showSuccess,
  };
}
