'use client';

/**
 * analysis-app.tsx — Orquestrador principal do painel de análise Bawzi.
 *
 * Responsabilidades deste ficheiro:
 *   - Toda a gestão de estado (token, tier, result, loading, modais, etc.)
 *   - useEffects de bootstrap (auth, tier sync, loading scroll, etc.)
 *   - Handlers de negócio (handleAnalyze, handleUpgrade, handleShare, etc.)
 *   - Layout de alto nível (grid principal + montagem dos sub-componentes)
 *
 * Componentes extraídos:
 *   AppHero              — secção hero (dark/light)
 *   AnalysisForm         — formulário de submissão
 *   AnalysisLoadingOverlay — painel de espera com progresso estimado
 *   AnalysisResults      — painel de resultados (tabs, score, etc.)
 *   AppSidebar           — sidebar de navegação
 *   ShareModal           — modal de partilha por e-mail
 *   ImpugnacaoModal      — modal da peça de impugnação
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Sub-componentes extraídos
import AppHero from './AppHero';
import AnalysisForm from './AnalysisForm';
import AnalysisLoadingOverlay from './AnalysisLoadingOverlay';
import AnalysisResults from './AnalysisResults';
import AppSidebar from './AppSidebar';
import ShareModal from './ShareModal';
import ImpugnacaoModal from './ImpugnacaoModal';

// Componentes externos (mantidos inalterados)
import HistoryTab from './HistoryTab';
import PricingSection from './PricingSection';
import PncpSearch from '../components/PncpSearch';
import ContratosVencendo from '../components/ContratosVencendo';
import CapitalIntelligence from '../components/CapitalIntelligence';
import CnaeOportunidades from '../components/CnaeOportunidades';
import UpgradeModal from './UpgradeModal';
import AuthModal from './AuthModal';
import UpsellModal from './UpsellModal';

// Contextos e tipos
import { useTierConfig } from '../Contexts/TierContext';
import { AnalysisResult } from './analysis-types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const logout = () => {
  localStorage.clear();
  window.location.reload();
};

const dominadorFeatures = [
  { title: 'Raio-X de Concorrentes', desc: 'Veja capital social, sócios e volume de vitórias.' },
  { title: 'Engenharia Reversa',     desc: 'Descubra o custo real e a margem de lucro dos seus rivais.' },
  { title: 'Alertas de Vencimento',  desc: 'Saiba 30 dias antes quando o contrato milionário do seu rival vai vencer.' },
];

const LOADING_MESSAGES = [
  { title: 'Preparando leitura multiagente', desc: 'Organizando o edital, os anexos e os sinais principais para iniciar a análise.' },
  { title: 'Agente jurídico em leitura', desc: 'Verificando habilitação, prazos, exigências fiscais e pontos que podem gerar risco.' },
  { title: 'Agente financeiro calculando viabilidade', desc: 'Estimando margem, pressão por preço, deságio provável e esforço de execução.' },
  { title: 'Agente de mercado rastreando concorrência', desc: 'Mapeando fornecedores recorrentes, histórico semelhante e agressividade local.' },
  { title: 'Consolidando veredito Go/No-Go', desc: 'Cruzando os achados para montar score, alertas e próximos passos em linguagem direta.' },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AnalysisApp() {
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Upsell
  const [showUpsell, setShowUpsell]     = useState(false);
  const [upsellData, setUpsellData]     = useState({ title: '', desc: '' });

  // Formulário
  const [text, setText]                 = useState('');
  const [files, setFiles]               = useState<File[]>([]);
  const [uf, setUf]                     = useState('');
  const [forceExact, setForceExact]     = useState(false);
  const [pncpData, setPncpData]         = useState<{ cnpj: string; ano: number; sequencial: number; uf?: string } | null>(null);

  // Análise
  const [result, setResult]             = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [successMsg, setSuccessMsg]     = useState<string | null>(null);
  const [modelSource, setModelSource]   = useState<string | null>(null);
  const [isCachedResult, setIsCachedResult] = useState(false);
  const [provider, setProvider]         = useState<string>('openai');
  const [loadingStep, setLoadingStep]   = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingRemainingSeconds, setLoadingRemainingSeconds] = useState(30);
  const [loadingEstimateSeconds, setLoadingEstimateSeconds] = useState(30);

  // Auth / perfil
  const [token, setToken]               = useState<string | null>(null);
  const [userTier, setUserTier]         = useState<number>(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userData, setUserData]         = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasUsedFreeTrial, setHasUsedFreeTrial] = useState(false);

  // Tabs e modais
  const [activeTab, setActiveTab]       = useState<string>('workspace');
  const [showAuthModal, setShowAuthModal]   = useState(false);
  const [authMode, setAuthMode]         = useState<'login' | 'register'>('register');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [stripeSecret, setStripeSecret] = useState<string | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Partilha
  const [analysisId, setAnalysisId]     = useState<string | null>(null);
  const [isSharing, setIsSharing]       = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail]     = useState('');

  // Impugnação
  const [impugnacaoText, setImpugnacaoText]           = useState('');
  const [showImpugnacaoModal, setShowImpugnacaoModal] = useState(false);
  const [copiadoImpugnacao, setCopiadoImpugnacao]     = useState(false);

  // Sidebar
  const [notifCount, setNotifCount]         = useState(0);
  const [renovacoesCount, setRenovacoesCount] = useState<number | null>(null);

  // Misc
  const [termoAlvo, setTermoAlvo]   = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedCompetitor, setSelectedCompetitor] = useState<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [abaConcorrentes, setAbaConcorrentes] = useState<'nacional' | 'regional'>('nacional');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchTerm, setSearchTerm] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── Configuração de limites por tier ──────────────────────────────────────
  const { tierLimits, tierFileLimits } = useTierConfig();
  const currentTier = Math.max(userTier, userData?.active_workspace?.tier || 1);
  const currentCharLimit    = tierLimits[userTier] || 10000;
  const currentFileLimitMB  = tierFileLimits[userTier] || 3;
  const currentFileLimitBytes = currentFileLimitMB * 1024 * 1024;
  const totalFileSize       = files.reduce((acc, f) => acc + f.size, 0);
  const isOverTextLimit     = text.length > currentCharLimit;
  const isOverFileLimit     = totalFileSize > currentFileLimitBytes;
  const isOverLimit         = isOverTextLimit || isOverFileLimit;
  const requiresAuth        = !token && hasUsedFreeTrial;

  // ─── Helpers de feedback ────────────────────────────────────────────────────
  const showError = (msg: string, ms = 5000) => {
    setError(msg);
    setTimeout(() => setError(null), ms);
  };
  const showSuccess = (msg: string, ms = 3500) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), ms);
  };
  const getLoadingEstimateSeconds = (motor: 'openai' | 'claude') => {
    const isFastAnalysis = userTier === 4 && motor === 'openai';
    const baseSeconds = isFastAnalysis ? 8 : motor === 'claude' ? 35 : 30;
    const filePenalty = files.length > 0 ? 4 : 0;
    const textPenalty = text.length > 80000 ? 8 : text.length > 30000 ? 4 : 0;

    return Math.min(baseSeconds + filePenalty + textPenalty, isFastAnalysis ? 15 : 45);
  };

  // ─── useEffect: progresso temporal da análise ───────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout;
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

  // ─── useEffect: soberania de tier (cache local) ─────────────────────────────
  useEffect(() => {
    const cachedTier = localStorage.getItem('bawzi_tier');
    if (cachedTier) {
      const tierNum = Number(cachedTier);
      setUserTier(tierNum);
      setSelectedTier(tierNum);
    }
    const handleGlobalTierUpdate = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (e as CustomEvent).detail;
      if (detail?.tier) {
        const novoTier = Number(detail.tier);
        setUserTier(prev => Math.max(prev, novoTier));
        setSelectedTier(prev => Math.max(prev, novoTier));
      }
    };
    window.addEventListener('bawzi_update', handleGlobalTierUpdate);
    return () => window.removeEventListener('bawzi_update', handleGlobalTierUpdate);
  }, []);

  // ─── useEffect: carga de dados unificada ────────────────────────────────────
  useEffect(() => {
    const loadUnifiedData = async () => {
      const savedToken = localStorage.getItem('bawzi_token');
      if (!savedToken) { setIsCheckingAuth(false); return; }
      setToken(savedToken);

      const urlParams = new URLSearchParams(window.location.search);
      const isSuccessReturn = urlParams.get('success') === 'true';
      const headers = { 'Authorization': `Bearer ${savedToken}`, 'Content-Type': 'application/json' };

      const fetchWithRetry = async (attemptsLeft = 5) => {
        try {
          const [userRes, wsRes] = await Promise.all([
            fetch(`${API_URL}/api/users/me`, { headers }),
            fetch(`${API_URL}/api/workspace/details`, { headers }),
          ]);

          if (userRes.status === 401) { localStorage.clear(); window.location.reload(); return; }

          if (userRes.ok && wsRes.ok) {
            const uData = await userRes.json();
            const wData = await wsRes.json();

            const nivelServidor  = Math.max(uData.tier || 1, wData.tier || 1);
            const nivelDoCache   = Number(localStorage.getItem('bawzi_tier') || 1);
            const nivelFinal     = Math.max(nivelServidor, nivelDoCache);

            if (isSuccessReturn && nivelFinal === 1 && attemptsLeft > 0) {
              setTimeout(() => fetchWithRetry(attemptsLeft - 1), 2000);
              return;
            }

            setUserTier(nivelFinal);
            setSelectedTier(nivelFinal);
            localStorage.setItem('bawzi_tier', nivelFinal.toString());

            const blendedUserData = {
              ...uData,
              name: uData.name || uData.nome,
              tier: nivelFinal,
              workspace_users_count: wData.workspace_users_count,
              vagas_totais: wData.vagas_totais,
              companies: wData.companies || [],
              active_cnpj: wData.companies?.[0]?.cnpj || uData.company?.cnpj,
            };

            setUserData(blendedUserData);
            window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: nivelFinal } }));

            // Contagem silenciosa de contratos a vencer (só tier 4)
            if (nivelFinal >= 4 && (wData.companies?.length > 0 || uData.company)) {
              const companies = wData.companies?.length > 0 ? wData.companies : (uData.company ? [uData.company] : []);
              const cnpjs = companies.map((c: { cnpj: string }) => c.cnpj).filter(Boolean);
              if (cnpjs.length > 0) {
                try {
                  const params = new URLSearchParams({ cnpj: cnpjs[0], dias: '90' });
                  const r = await fetch(`${API_URL}/api/contratos-vencendo?${params}`, { headers });
                  if (r.ok) {
                    const data = await r.json();
                    const contratos = data.contratos || data.results || data || [];
                    setRenovacoesCount(Array.isArray(contratos) ? contratos.length : 0);
                  }
                } catch { /* silencioso */ }
              }
            }

            if (isSuccessReturn && nivelFinal > 1) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        } catch (err) {
          console.error('Erro na sincronização:', err);
        } finally {
          setIsCheckingAuth(false);
        }
      };
      await fetchWithRetry();
    };
    loadUnifiedData();
  }, [API_URL]);

  // ─── useEffect: scroll para a área de loading ───────────────────────────────
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isAnalyzing) {
      timeoutId = setTimeout(() => {
        document.getElementById('area-loading')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [isAnalyzing]);

  // ─── useEffect: sincroniza token entre abas ─────────────────────────────────
  useEffect(() => {
    const syncAuth = (e: StorageEvent) => {
      if (e.key === 'bawzi_token' && e.newValue) window.location.reload();
    };
    window.addEventListener('storage', syncAuth);
    return () => window.removeEventListener('storage', syncAuth);
  }, []);

  // ─── useEffect: abre modal de auth via evento global ────────────────────────
  useEffect(() => {
    const handleOpenAuth = (e: Event) => {
      const mode = (e as CustomEvent).detail || 'login';
      setAuthMode(mode);
      setShowAuthModal(true);
    };
    window.addEventListener('bawzi_open_auth', handleOpenAuth);
    return () => window.removeEventListener('bawzi_open_auth', handleOpenAuth);
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleCancelAnalysis = () => {
    abortControllerRef.current?.abort();
    setIsAnalyzing(false);
    setLoadingStep(0);
    setLoadingProgress(0);
    setLoadingRemainingSeconds(loadingEstimateSeconds);
    showError('Análise cancelada pelo usuário.', 4000);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const tierReal   = typeof window !== 'undefined' ? Number(localStorage.getItem('bawzi_tier') || userTier) : userTier;
    const limiteReal = tierLimits[tierReal] || 10000;
    if (newText.length <= limiteReal) {
      setText(newText);
    } else {
      setText(newText.substring(0, limiteReal));
      setError(`O limite do Nível ${tierReal} é de ${limiteReal.toLocaleString()} caracteres.`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles      = Array.from(e.target.files);
      const newTotalSize  = newFiles.reduce((acc, f) => acc + f.size, 0) + totalFileSize;
      if (newTotalSize > currentFileLimitBytes) {
        setError(`Arquivos somam ${(newTotalSize / (1024 * 1024)).toFixed(2)}MB, excedendo o limite de ${currentFileLimitMB}MB.`);
        setTimeout(() => setError(null), 5000);
      } else {
        setFiles(prev => [...prev, ...newFiles]);
      }
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleShare = () => {
    if (!analysisId) return;
    setShareEmail('');
    setShowShareModal(true);
  };

  const confirmShare = async () => {
    if (!shareEmail || !shareEmail.includes('@')) { showError('Por favor, insira um e-mail válido.'); return; }
    if (!analysisId) { showError('Erro: não foi possível identificar o ID desta análise. Tente novamente.'); return; }
    setIsSharing(true);
    try {
      const currentToken = localStorage.getItem('bawzi_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/analyses/${analysisId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
        },
        body: JSON.stringify({ target_email: shareEmail }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Falha ao partilhar o relatório.');
      }
      showSuccess('✅ Relatório estratégico enviado com sucesso!');
      setShowShareModal(false);
      setShareEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      showError(`Erro ao partilhar: ${msg}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleAnalyze = async (motor: 'openai' | 'claude') => {
    if (requiresAuth) { setAuthMode('register'); setShowAuthModal(true); return; }
    if (!text.trim() && files.length === 0 && !pncpData) {
      setError('Por favor, cole um texto, adicione um documento ou selecione um edital no Radar PNCP antes de analisar.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (isOverLimit) { handleUpgrade(userTier >= 1 ? userTier + 1 : 2); return; }

    setLoadingEstimateSeconds(getLoadingEstimateSeconds(motor));
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setIsCachedResult(false);
    abortControllerRef.current = new AbortController();

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

      const headers: Record<string, string> = {};
      const currentToken = localStorage.getItem('bawzi_token');
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

      const response = await fetch(`${API_URL.replace(/\/$/, '')}/api/analyze`, {
        method: 'POST', headers, body: formData,
        signal: abortControllerRef.current.signal,
      });

      // Upsell 403
      if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.detail?.codigo === 'LIMIT_REACHED') {
          setUpsellData({ title: errorData.detail.titulo, desc: errorData.detail.mensagem });
          setShowUpsell(true);
          setIsAnalyzing(false);
          return;
        }
      }
      if (response.status === 401) { logout(); return; }
      if (response.status === 402) { handleUpgrade(userTier >= 1 ? userTier + 1 : 2); setIsAnalyzing(false); return; }

      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || 'Erro no servidor.');

      const analysisData = data.analysis || data;
      if (!analysisData || Object.keys(analysisData).length === 0 || !analysisData.score) {
        throw new Error('A IA processou o documento, mas não conseguiu estruturar o formato final. Por favor, clique em Iniciar Análise novamente.');
      }

      setResult(analysisData);
      setAnalysisId(data.id || data.record_id || data.analysis_hash);
      setModelSource(data.source || data.model_source || 'Motor Bawzi IA');
      setIsCachedResult(data.is_cached || false);

      setTimeout(() => {
        const el = document.getElementById('area-resultados');
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 50, behavior: 'smooth' });
      }, 100);

      if (!token) { localStorage.setItem('bawzi_free_trial_used', 'true'); setHasUsedFreeTrial(true); }

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      if (userTier === -1) { setShowUpgradeModal(true); setIsAnalyzing(false); return; }

      const msg = (err as Error).message || '';
      let mensagemParaExibir = 'Ocorreu um erro inesperado. Por favor, tente novamente.';
      if (msg.includes('NoneType') || msg.includes('401')) {
        mensagemParaExibir = 'Parece que a sua sessão expirou. Por favor, faça login novamente.';
      } else if (msg.includes('500')) {
        mensagemParaExibir = 'O nosso motor de IA está sobrecarregado. Tente novamente em instantes.';
      } else {
        mensagemParaExibir = msg;
      }
      setError(mensagemParaExibir);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpgrade = async (tier: number) => {
    if (!token) { setAuthMode('register'); setShowAuthModal(true); return; }
    setSelectedTier(tier);
    setIsCheckoutLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.url) {
          // Portal do Stripe — navega para lá.
          // Safety net: se a navegação não acontecer em 8s, reseta o loading
          // (evita que o spinner fique preso para sempre).
          const navTimeout = setTimeout(() => {
            setIsCheckoutLoading(false);
            showError('Redirecionamento demorou. Tente novamente ou acesse o portal pelo perfil.');
          }, 8000);
          window.addEventListener('beforeunload', () => clearTimeout(navTimeout), { once: true });
          window.location.href = data.url;
        } else if (data.client_secret) {
          setStripeSecret(data.client_secret);
          setShowUpgradeModal(true);
          setIsCheckoutLoading(false);
        } else {
          // Resposta inesperada do servidor
          setIsCheckoutLoading(false);
          showError('Resposta inesperada. Tente novamente.');
        }
      } else {
        throw new Error(data.detail || 'Erro no processamento');
      }
    } catch {
      setIsCheckoutLoading(false);
      showError('Erro ao processar plano. Tente novamente.');
    }
  };

  const handleResetAnalysis = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'instant' });
    setResult(null);
    setText('');
    setFiles([]);
    setActiveTab('workspace');
    setTimeout(() => {
      const target = document.getElementById('radar-pncp-section') || document.getElementById('area-submissao');
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    }, 50);
  };

  const handleExportPDF = () => {
    if (!result) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showError('Permita pop-ups no browser para gerar o PDF.'); return; }

    // ── helpers ──────────────────────────────────────────────────────────────
    const esc = (s: unknown) =>
      String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const scoreColor = result.score >= 70 ? '#16a34a' : result.score >= 45 ? '#d97706' : '#dc2626';
    const scoreBg    = result.score >= 70 ? '#f0fdf4' : result.score >= 45 ? '#fffbeb' : '#fef2f2';

    const semaforoIcon = (status: string) =>
      status === 'ok' ? '✅' : status === 'alerta' ? '⚠️' : '❌';

    const listHtml = (items: string[] | undefined, fallback = '') =>
      items?.length
        ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
        : fallback ? `<p style="color:#999;font-style:italic">${fallback}</p>` : '';

    const section = (num: string, title: string, body: string) =>
      body.trim()
        ? `<div class="section"><h3>${num}. ${esc(title)}</h3>${body}</div>`
        : '';

    const dateLabel = (iso: string | null) => {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
    };

    // ── datas críticas ────────────────────────────────────────────────────────
    const datasHtml = (() => {
      const datas = result.datas_criticas || [];
      if (!datas.length) return '';
      const rows = datas.map(d =>
        `<tr>
          <td>${esc(d.label)}</td>
          <td style="font-weight:bold;${d.urgente?'color:#dc2626':''}">
            ${dateLabel(d.data_iso)}${d.urgente ? ' ⚠️' : ''}
          </td>
        </tr>`
      ).join('');
      return `<table><thead><tr><th>Prazo</th><th>Data</th></tr></thead><tbody>${rows}</tbody></table>`;
    })();

    // ── semáforo ──────────────────────────────────────────────────────────────
    const semaforoHtml = (() => {
      const s = result.semaforo;
      if (!s) return '';
      const dims = [
        ['Técnica',       s.tecnica],
        ['Financeira',    s.financeira],
        ['Jurídica',      s.juridica],
        ['Documentação',  s.documentacao],
      ] as const;
      const rows = dims.map(([label, sig]) =>
        sig ? `<tr>
          <td>${esc(label)}</td>
          <td>${semaforoIcon(sig.status)} ${esc(sig.status.toUpperCase())}</td>
          <td>${esc(sig.motivo)}</td>
        </tr>` : ''
      ).join('');
      return `<table><thead><tr><th>Dimensão</th><th>Status</th><th>Observação</th></tr></thead><tbody>${rows}</tbody></table>`;
    })();

    // ── riscos ────────────────────────────────────────────────────────────────
    const riscosHtml = (() => {
      const risks = result.risks || [];
      if (!risks.length) return '';
      return risks.map(r => `<div style="margin-bottom:10px;border-left:3px solid #dc2626;padding:6px 10px;background:#fef2f2;">
        <strong style="font-size:11px">${esc(r.titulo)}</strong>
        ${r.impacto ? `<span style="font-size:9px;text-transform:uppercase;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;margin-left:6px">${esc(r.impacto)}</span>` : ''}
        <p style="margin:4px 0 0 0;font-size:11px;color:#444">${esc(r.descricao)}</p>
      </div>`).join('');
    })();

    // ── checklist ─────────────────────────────────────────────────────────────
    const checklistHtml = (() => {
      const cl = result.checklist || [];
      if (!cl.length) return '';
      return `<ul>${cl.map((item: Record<string,unknown>) => {
        const label = esc(item.label || item.item || item.descricao || item);
        const done  = item.done || item.checked || item.ok;
        return `<li style="list-style:none;margin-bottom:4px">
          <span style="margin-right:6px">${done ? '☑' : '☐'}</span>${label}
        </li>`;
      }).join('')}</ul>`;
    })();

    // ── pricing intelligence ───────────────────────────────────────────────────
    const pricingHtml = (() => {
      const p = result.pricing_intelligence;
      if (!p) return '';
      const rows = [
        p.desagioPreditivoOrgao != null && `<tr><td>Deságio Preditivo do Órgão</td><td>${p.desagioPreditivoOrgao}%</td></tr>`,
        p.nivelAmeaca            && `<tr><td>Nível de Ameaça</td><td>${esc(p.nivelAmeaca)}</td></tr>`,
        p.perfilVencedor         && `<tr><td>Perfil do Vencedor</td><td>${esc(p.perfilVencedor)}</td></tr>`,
        p.financial_verdict      && `<tr><td>Veredito Financeiro</td><td>${esc(p.financial_verdict)}</td></tr>`,
        p.estimated_discount != null && `<tr><td>Desconto Estimado</td><td>${p.estimated_discount}%</td></tr>`,
        p.valorMedioMercado      && `<tr><td>Valor Médio de Mercado</td><td>${esc(String(p.valorMedioMercado))}</td></tr>`,
        p.engenharia_reversa?.setor_identificado && `<tr><td>Setor Identificado</td><td>${esc(p.engenharia_reversa.setor_identificado)}</td></tr>`,
        p.engenharia_reversa?.margem_media_setor_pct != null && `<tr><td>Margem Média do Setor</td><td>${p.engenharia_reversa.margem_media_setor_pct}%</td></tr>`,
      ].filter(Boolean).join('');
      return rows ? `<table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>` : '';
    })();

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Parecer Técnico-Jurídico — Bawzi Intelligence</title>
  <style>
    @page { size: A4; margin: 2cm 2.2cm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.65; color: #111; margin: 0; padding: 0; }

    /* cabeçalho */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
    .header-brand h1 { font-size: 18px; font-weight: 900; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
    .header-brand p  { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin: 3px 0 0; }
    .header-meta { text-align: right; font-size: 9px; color: #64748b; }
    .header-meta strong { color: #0f172a; display: block; font-size: 10px; }

    /* aviso legal */
    .warning { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; padding: 8px 12px; font-size: 10px; color: #475569; margin-bottom: 20px; border-radius: 4px; }

    /* score card */
    .score-card { display: flex; align-items: center; gap: 20px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; background: ${scoreBg}; }
    .score-circle { width: 64px; height: 64px; border-radius: 50%; border: 3px solid ${scoreColor}; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: ${scoreColor}; flex-shrink: 0; }
    .score-info h2 { font-size: 15px; font-weight: 900; margin: 0 0 4px; color: #0f172a; }
    .score-info .class { display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 2px 10px; border-radius: 20px; background: ${scoreColor}; color: #fff; margin-bottom: 4px; }
    .score-info p { font-size: 10px; color: #475569; margin: 0; }

    /* sections */
    .section { margin-bottom: 18px; page-break-inside: avoid; }
    h3 { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 10px; }
    p  { font-size: 11px; text-align: justify; margin: 0 0 8px; white-space: pre-wrap; color: #1e293b; }
    ul { margin: 0 0 8px; padding-left: 18px; }
    li { font-size: 11px; margin-bottom: 4px; color: #1e293b; }

    /* tabelas */
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px; }
    th { background: #f1f5f9; font-weight: 800; text-align: left; padding: 5px 8px; border: 1px solid #e2e8f0; color: #0f172a; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }

    /* 2 colunas */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .col-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
    .col-box h4 { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin: 0 0 6px; }

    /* assinatura */
    .signature { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; page-break-inside: avoid; }
    .sig-box { text-align: center; }
    .sig-line { width: 160px; border-top: 1px solid #0f172a; margin: 0 auto 6px; }
    .sig-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
    .sig-sub   { font-size: 9px; color: #94a3b8; margin-top: 2px; }

    @media print { .no-print { display: none; } }
  </style>
</head>
<body>

  <!-- CABEÇALHO -->
  <div class="header">
    <div class="header-brand">
      <h1>Bawzi Intelligence</h1>
      <p>Parecer Técnico-Jurídico Preliminar — Análise de Edital</p>
    </div>
    <div class="header-meta">
      <strong>${new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}</strong>
      Score Bawzi: ${result.score}/100
    </div>
  </div>

  <!-- AVISO LEGAL -->
  <div class="warning">
    ⚠️ NOTA DE RESPONSABILIDADE: Este documento foi gerado por Inteligência Artificial para facilitar a triagem de editais. A revisão, validação e assinatura por um profissional habilitado é indispensável antes do uso oficial.
  </div>

  <!-- SCORE CARD -->
  <div class="score-card">
    <div class="score-circle">${result.score}</div>
    <div class="score-info">
      <h2>${esc(result.title || 'Análise de Edital')}</h2>
      <span class="class">${esc(result.classification || '—')}</span>
      <p>${esc(result.recommendation || result.rationale || '')}</p>
    </div>
  </div>

  ${section('1', 'Resumo Executivo', `<p>${esc(result.summary)}</p>`)}

  ${semaforoHtml ? section('2', 'Semáforo de Viabilidade', semaforoHtml) : ''}

  ${datasHtml ? section('3', 'Cronograma Crítico', datasHtml) : ''}

  ${(result.vantagens?.length || result.desvantagens?.length) ? `
  <div class="two-col">
    ${result.vantagens?.length ? `<div class="col-box"><h4>✅ Pontos Favoráveis</h4>${listHtml(result.vantagens)}</div>` : ''}
    ${result.desvantagens?.length ? `<div class="col-box"><h4>❌ Pontos Desfavoráveis</h4>${listHtml(result.desvantagens)}</div>` : ''}
  </div>` : ''}

  ${riscosHtml ? section('4', 'Matriz de Riscos', riscosHtml) : ''}

  ${section('5', 'Fundamentação Legal e Parecer Especialista',
    `<p>${esc(result.parecer_especialista || result.rationale || 'Sem parecer detalhado disponível para esta análise.')}</p>`
  )}

  ${result.exigencias_criticas?.length ? section('6', 'Exigências Críticas', listHtml(result.exigencias_criticas)) : ''}

  ${result.documentos_necessarios?.length ? section('7', 'Documentos Necessários', listHtml(result.documentos_necessarios)) : ''}

  ${checklistHtml ? section('8', 'Checklist de Participação', checklistHtml) : ''}

  ${pricingHtml ? section('9', 'Inteligência de Preços', pricingHtml) : ''}

  ${result.criterios_de_julgamento?.length ? section('10', 'Critérios de Julgamento', listHtml(result.criterios_de_julgamento)) : ''}

  <!-- ASSINATURA -->
  <div class="signature">
    <div class="sig-box">
      <div class="sig-line"></div>
      <p class="sig-label">Responsável Técnico</p>
      <p class="sig-sub">Nome / Cargo</p>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <p class="sig-label">Validação Jurídica</p>
      <p class="sig-sub">OAB/UF nº _________</p>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <p class="sig-label">Aprovação Diretoria</p>
      <p class="sig-sub">Data: ___/___/______</p>
    </div>
  </div>

</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
  };

  // ─── Renderização ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden relative">
      {/* Keyframes globais (path-routing, scan-laser, float-agent, draw-arc) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes route-data { 0% { stroke-dashoffset: 60; } 100% { stroke-dashoffset: 0; } }
        @keyframes scan-laser { 0% { transform: translateY(-10px); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(100px); opacity: 0; } }
        @keyframes float-agent { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        .path-routing { stroke-dasharray: 8; animation: route-data 1.2s linear infinite; }
        @keyframes draw-arc { 0% { stroke-dasharray: 0, 100; } 100% { stroke-dasharray: 98, 100; } }
      ` }} />

      <main>
        {/* ── HERO ── */}
        <div className="w-full max-w-[1400px] mx-auto p-2 md:p-4 font-sans relative group">
          <div className="bg-white rounded-[2.5rem] shadow-[0_15px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-200/80 overflow-hidden flex flex-col xl:flex-row p-4 md:p-6 gap-6">
            <AppHero
              token={token}
              userData={userData}
              isCheckingAuth={isCheckingAuth}
              currentTier={currentTier}
              onGoToWorkspace={() => setActiveTab('workspace')}
              onGoToHistory={() => setActiveTab('history')}
            />
          </div>
        </div>

        {/* ── CONTEÚDO PRINCIPAL ── */}
        <section className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 relative z-10 print:m-0 print:p-0">
          <div className="grid lg:grid-cols-[1fr_350px] gap-8 md:gap-12 items-start print:block">

            {/* ── COLUNA ESQUERDA ── */}
            <div className="flex flex-col gap-8 w-full overflow-hidden print:m-0">

              {/* Abas workspace / análise / concorrentes */}
              {(activeTab === 'workspace' || activeTab === 'analise' || activeTab === 'concorrentes') && (
                <div className="animate-in fade-in duration-500 flex flex-col gap-8 w-full print:m-0">

                  {!isAnalyzing && !result ? (
                    <>
                      {/* Radar PNCP */}
                      <div id="radar-pncp-section" className="animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                          <PncpSearch
                            token={token}
                            userUf={userData?.company?.uf}
                            onAnalyzeOportunity={(textoExtraido, termoPesquisado, editalDados) => {
                              setResult(null);
                              setError(null);
                              setText(textoExtraido);
                              setTermoAlvo(termoPesquisado);
                              setPncpData(editalDados || null);
                              setTimeout(() => {
                                document.getElementById('area-submissao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 150);
                            }}
                          />
                        </div>
                      </div>

                      {/* Divider "Edital Carregado" */}
                      {text && text.length > 100 && (
                        <div className="flex items-center gap-4 animate-in fade-in duration-300">
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Edital Carregado</span>
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                        </div>
                      )}

                      {/* Formulário */}
                      <AnalysisForm
                        text={text}
                        onTextChange={handleTextChange}
                        files={files}
                        onFileUpload={handleFileUpload}
                        onRemoveFile={removeFile}
                        currentCharLimit={currentCharLimit}
                        currentFileLimitMB={currentFileLimitMB}
                        isAnalyzing={isAnalyzing}
                        token={token}
                        userTier={userTier}
                        error={error}
                        successMsg={successMsg}
                        provider={provider}
                        onProviderChange={setProvider}
                        onAnalyze={handleAnalyze}
                        onShowAuthModal={(mode) => { setAuthMode(mode); setShowAuthModal(true); }}
                      />
                    </>
                  ) : isAnalyzing ? (
                    <AnalysisLoadingOverlay
                      loadingStep={loadingStep}
                      loadingMessages={LOADING_MESSAGES}
                      loadingProgress={loadingProgress}
                      remainingSeconds={loadingRemainingSeconds}
                      estimatedSeconds={loadingEstimateSeconds}
                      onCancel={handleCancelAnalysis}
                    />
                  ) : result ? (
                    <AnalysisResults
                      result={result}
                      activeTab={activeTab}
                      onSetActiveTab={setActiveTab}
                      userTier={userTier}
                      currentTier={currentTier}
                      termoAlvo={termoAlvo}
                      analysisId={analysisId}
                      token={token}
                      isSharing={isSharing}
                      onShare={handleShare}
                      onReset={handleResetAnalysis}
                      onExportPDF={handleExportPDF}
                      modelSource={modelSource}
                      isCachedResult={isCachedResult}
                      onUpgradeClick={() => setShowUpgradeModal(true)}
                    />
                  ) : null}
                </div>
              )}

              {/* Aba Renovações */}
              {activeTab === 'renovacoes' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <ContratosVencendo
                    token={token ?? ''}
                    companies={userData?.companies?.length > 0 ? userData.companies : userData?.company ? [userData.company] : []}
                    defaultUf={userData?.company?.uf || ''}
                  />
                </div>
              )}

              {/* Aba Capital */}
              {activeTab === 'capital' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {currentTier < 3 ? (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center shadow-sm">
                      <p className="text-slate-600 font-medium">Capital Intelligence disponível a partir do Nível 3.</p>
                    </div>
                  ) : (
                    <CapitalIntelligence
                      token={token ?? ''}
                      tier={currentTier}
                      companies={userData?.companies?.length ? userData.companies : userData?.company ? [userData.company] : []}
                      defaultCnpj={userData?.companies?.[0]?.cnpj || userData?.company?.cnpj || ''}
                      defaultUf={userData?.companies?.[0]?.uf || userData?.company?.uf || ''}
                    />
                  )}
                </div>
              )}

              {/* Aba Para Você (Feed CNAE) */}
              {activeTab === 'cnae' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CnaeOportunidades
                    token={token}
                    userData={userData}
                    onAnalyzeOportunity={(textoExtraido, termoPesquisado, editalDados) => {
                      setResult(null);
                      setError(null);
                      setText(textoExtraido);
                      setTermoAlvo(termoPesquisado);
                      setPncpData(editalDados || null);
                      setActiveTab('workspace');
                      setTimeout(() => {
                        document.getElementById('area-submissao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 150);
                    }}
                    onShowAuthModal={(mode) => { setAuthMode(mode); setShowAuthModal(true); }}
                  />
                </div>
              )}

              {/* Aba Histórico */}
              {activeTab === 'history' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {isCheckingAuth ? (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center shadow-sm flex flex-col items-center animate-pulse">
                      <div className="w-16 h-16 bg-slate-100 rounded-full mb-4"></div>
                      <div className="h-5 w-48 bg-slate-100 rounded-lg mb-2"></div>
                      <div className="h-4 w-64 bg-slate-50 rounded-lg"></div>
                    </div>
                  ) : (token && userTier !== -1) ? (
                    <HistoryTab
                      token={token}
                      userTier={userTier}
                      onRedoAnalysis={(analiseAntiga) => {
                        setText(analiseAntiga.raw_text || '');
                        setActiveTab('workspace');
                        setTimeout(() => {
                          document.getElementById('area-submissao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }}
                    />
                  ) : (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center shadow-sm">
                      <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                      </div>
                      <h3 className="text-lg font-black text-slate-800 mb-2">Modo Anónimo</h3>
                      <p className="text-slate-500 font-medium mb-6">Inicie sessão para ativar o histórico de editais e aceder ao Matchmaker de CNAE.</p>
                      <button
                        onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md"
                      >
                        Entrar na Conta
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── SIDEBAR DIREITA ── */}
            <AppSidebar
              token={token}
              userData={userData}
              currentTier={currentTier}
              activeTab={activeTab}
              onSetActiveTab={setActiveTab}
              renovacoesCount={renovacoesCount}
              onNotifCountChange={setNotifCount}
              onShowAuthModal={(mode) => { setAuthMode(mode); setShowAuthModal(true); }}
            />
          </div>
        </section>

        {/* ── SECÇÃO DE PLANOS ── */}
        <section id="planos" className="bg-white py-24 px-6 border-t border-slate-100 print:hidden">
          <div className="max-w-[1400px] mx-auto">
            <div className="text-center mb-16">
              <span className="text-slate-700 bg-slate-100 px-5 py-2 rounded-full font-black uppercase text-xs tracking-widest">Transparência e Escala</span>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mt-6 mb-4 tracking-tight">A IA certa para o desafio certo</h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">Otimizamos o custo e a precisão roteando a sua análise automaticamente para os melhores modelos LLM do mundo.</p>
            </div>
            <PricingSection
              onRegister={() => { setAuthMode('register'); setShowAuthModal(true); }}
              onUpgrade={handleUpgrade}
              currentTier={userTier}
            />
          </div>
        </section>
      </main>

      {/* ── MODAIS ── */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultView={authMode}
        onSuccess={() => window.location.reload()}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareEmail={shareEmail}
        onEmailChange={setShareEmail}
        onConfirm={confirmShare}
        isSharing={isSharing}
      />

      <ImpugnacaoModal
        isOpen={showImpugnacaoModal}
        onClose={() => setShowImpugnacaoModal(false)}
        impugnacaoText={impugnacaoText}
        copiado={copiadoImpugnacao}
        onCopy={() => {
          navigator.clipboard.writeText(impugnacaoText);
          setCopiadoImpugnacao(true);
          setTimeout(() => setCopiadoImpugnacao(false), 2000);
        }}
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={async () => {
          setShowUpgradeModal(false);
          setStripeSecret(null);
          const currentToken = localStorage.getItem('bawzi_token');
          if (currentToken) {
            try {
              const res = await fetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${currentToken}` },
              });
              const data = await res.json();
              if (res.ok && data.tier !== undefined) {
                localStorage.setItem('user_tier', String(data.tier));
                localStorage.setItem('bawzi_tier', String(data.tier));
                window.location.reload();
              }
            } catch (e) {
              console.error('Erro no sync após fechar modal', e);
            }
          }
        }}
        tier={selectedTier}
        clientSecret={stripeSecret}
      />

      {isCheckoutLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-[90%] mx-auto text-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-slate-900 rounded-full border-t-transparent animate-spin"></div>
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 m-auto text-slate-900" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Ambiente Seguro</h3>
            <p className="text-slate-500 font-medium leading-relaxed">Sincronizando com o Stripe...</p>
          </div>
        </div>
      )}

      <UpsellModal
        isOpen={showUpsell}
        onClose={() => setShowUpsell(false)}
        title="Torne-se um Dominador (Nível 4)"
        description="Você está a um passo de antecipar o movimento do mercado. Desbloqueie a verdadeira Inteligência Corporativa e destrua a concorrência."
        features={dominadorFeatures}
      />
    </div>
  );
}
