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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { initSession, clearSession, apiFetch, API_URL, startSessionKeepAlive } from '@/lib/apiClient';
import { useInactivityTimeout } from '@/lib/useInactivityTimeout';
import type { UserData, Empresa, Concorrente, BawziUpdateEvent } from '@/lib/types';
import { useAnalysis, LOADING_MESSAGES } from '@/hooks/useAnalysis';
import { exportPdf } from '@/lib/exportPdf';
import { useRouter } from 'next/navigation';

// Sub-componentes extraídos
import AppHero from './AppHero';
import AnalysisForm, { type QuotaInfo } from './AnalysisForm';
import AnalysisLoadingOverlay from './AnalysisLoadingOverlay';
import AnalysisResults from './AnalysisResults';
import AppSidebar from './AppSidebar';
import ShareModal from './ShareModal';
import ImpugnacaoModal from './ImpugnacaoModal';

// Componentes externos (mantidos inalterados)
import HistoryTab from './HistoryTab';
import ParametrizacaoPanel from './ParametrizacaoPanel';
import DecisionManagementTab from './DecisionManagementTab';
import CompareTab from './CompareTab';
import PricingSection from './PricingSection';
import PncpSearch from '../components/PncpSearch';
import ContratosVencendo from '../components/ContratosVencendo';
import CapitalIntelligence from '../components/CapitalIntelligence';
import CnaeOportunidades from '../components/CnaeOportunidades';
import RadarAlertas from '../components/RadarAlertas';
import OnboardingModal from '../components/OnboardingModal';
import UpgradeModal from './UpgradeModal';
import AuthModal from './AuthModal';
import UpsellModal from './UpsellModal';
import ChangePlanModal from './ChangePlanModal';

// Contextos e tipos
import { useTierConfig } from '../Contexts/TierContext';
import { AnalysisResult } from './analysis-types';
import { resolveEffectiveTier } from '@/lib/tier';
import {
  ACTIVE_CONTEXT_EVENT,
  getPreferredActiveCnpj,
  orderCompaniesByActive,
  resolveActiveCompany,
  setActiveCompanyContext,
  type ActiveContextEventDetail,
} from '@/lib/activeContext';

// ─── Constantes ───────────────────────────────────────────────────────────────

// Usa clearSession() do apiClient — remove apenas os dados de sessão,
// sem apagar preferências do usuário (ex: bawzi_favorites, bawzi_tier).
const logout = () => {
  clearSession({ notifyExpired: false });
  window.location.reload();
};

const avancadoFeatures = [
  { title: 'Raio-X de Concorrentes', desc: 'Veja capital social, sócios e volume de vitórias.' },
  { title: 'Engenharia Reversa',     desc: 'Descubra o custo real e a margem de lucro dos seus rivais.' },
  { title: 'Alertas de Vencimento',  desc: 'Saiba 30 dias antes quando o contrato milionário do seu rival vai vencer.' },
];

// ─── Gate de tier (conteúdo de abas bloqueadas) ───────────────────────────────

const TIER_NAMES: Record<number, string> = {
  2: 'Essencial',
  3: 'Profissional',
  4: 'Avançado',
};

function TierGateTab({
  requiredTier,
  featureName,
  onUpgrade,
}: {
  requiredTier: number;
  featureName: string;
  onUpgrade: () => void;
}) {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-12 text-center">
      <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Lock className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-lg font-black text-slate-800 mb-2">{featureName}</h3>
      <p className="text-slate-500 text-sm font-medium mb-2 max-w-xs mx-auto leading-relaxed">
        Esta funcionalidade está disponível a partir do plano{' '}
        <span className="font-black text-slate-700">{TIER_NAMES[requiredTier] ?? `Nível ${requiredTier}`}</span>.
      </p>
      <p className="text-slate-400 text-xs mb-7">Nível {requiredTier} ou superior</p>
      <button
        onClick={onUpgrade}
        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-colors shadow-md"
      >
        <Sparkles className="w-4 h-4" />
        Ver planos
      </button>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AnalysisApp() {
  const router = useRouter();

  // Upsell
  const [showUpsell, setShowUpsell]     = useState(false);
  const [upsellData, setUpsellData]     = useState({ title: '', desc: '' });

  // Formulário
  const [text, setText]                 = useState('');
  const [files, setFiles]               = useState<File[]>([]);
  const [uf, setUf]                     = useState('');
  const [forceExact, setForceExact]     = useState(false);
  const [pncpData, setPncpData]         = useState<{ cnpj: string; ano: number; sequencial: number; uf?: string } | null>(null);

  // Parâmetros de busca pré-carregados via URL (link de email ou notificação)
  const [initialPncpQuery, setInitialPncpQuery] = useState('');
  const [initialPncpUf, setInitialPncpUf]       = useState('');

  // Análise — estado e handlers geridos pelo hook useAnalysis
  const [provider, setProvider] = useState<string>('openai');

  // Auth / perfil
  const [token, setToken]               = useState<string | null>(null);
  const [userTier, setUserTier]         = useState<number>(1);
  const [userData, setUserData]         = useState<UserData | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasUsedFreeTrial, setHasUsedFreeTrial] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem('bawzi_guest_quota');
      if (!raw) return false;
      const { date, used } = JSON.parse(raw);
      const today = new Date().toISOString().split('T')[0];
      return date === today && used > 0;
    } catch { return false; }
  });
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  // Tabs e modais
  const [activeTab, setActiveTab]       = useState<string>('workspace');
  // Valor pré-preenchido para Capital (vindo de uma análise)
  const [capitalPrefilledValor, setCapitalPrefilledValor] = useState<number>(0);
  const [capitalPrefilledObjeto, setCapitalPrefilledObjeto] = useState<string>('');
  const [showAuthModal, setShowAuthModal]   = useState(false);
  const [authMode, setAuthMode]         = useState<'login' | 'register'>('register');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [stripeSecret, setStripeSecret] = useState<string | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // ChangePlanModal (workspace)
  const [changePlanTargetTier, setChangePlanTargetTier] = useState<number | null>(null);
  const [isChangingPlan, setIsChangingPlan]             = useState(false);

  // Partilha
  const [isSharing, setIsSharing]       = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail]     = useState('');

  // Impugnação
  const [showImpugnacaoModal, setShowImpugnacaoModal] = useState(false);
  const [copiadoImpugnacao, setCopiadoImpugnacao]     = useState(false);

  // Sidebar
  const [notifCount, setNotifCount]         = useState(0);
  const [renovacoesCount, setRenovacoesCount] = useState<number | null>(null);
  const [quota, setQuota]                   = useState<QuotaInfo | null>(null);

  // Misc
  const [termoAlvo, setTermoAlvo]   = useState('');
  const [selectedCompetitor, setSelectedCompetitor] = useState<Concorrente | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [abaConcorrentes, setAbaConcorrentes] = useState<'nacional' | 'regional'>('nacional');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchTerm, setSearchTerm] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── Hook useAnalysis — estado e handlers do ciclo de análise ────────────────
  const {
    result, setResult,
    isAnalyzing,
    error, setError, showError,
    successMsg, showSuccess,
    modelSource, isCachedResult,
    analysisId,
    impugnacaoText, setImpugnacaoText,
    loadingStep, loadingProgress, loadingRemainingSeconds, loadingEstimateSeconds, progressoAoVivo,
    handleAnalyze,
    handleCancelAnalysis,
  } = useAnalysis({
    token,
    text,
    files,
    uf,
    forceExact,
    pncpData,
    activeCnpj: userData?.active_cnpj || '',
    userTier,
    isOverLimit: false, // calculado abaixo e reatribuído dinamicamente
    apiUrl: API_URL,
    onUpgradeNeeded: (tier) => handleUpgrade(tier),
    onUpsellNeeded: (data) => { setUpsellData(data); setShowUpsell(true); },
    onFreeTrialUsed: () => setHasUsedFreeTrial(true),
  });

  // ─── Inactividade: timeout de sessão ────────────────────────────────────────
  const handleInactivityExpire = useCallback(() => {
    clearSession();
    setSessionExpired(true);
  }, []);

  const { showWarning: showInactivityWarning, secondsRemaining: inactivitySecondsLeft } = useInactivityTimeout({
    onExpire: handleInactivityExpire,
    enabled: !!token,
  });

  // ─── Configuração de limites por tier ──────────────────────────────────────
  const { tierLimits, tierFileLimits } = useTierConfig();
  const currentTier = resolveEffectiveTier(userTier, userData?.active_workspace?.tier);
  const currentCharLimit    = tierLimits[userTier] || 10000;
  const currentFileLimitMB  = tierFileLimits[userTier] || 3;
  const currentFileLimitBytes = currentFileLimitMB * 1024 * 1024;
  const totalFileSize       = files.reduce((acc, f) => acc + f.size, 0);
  const isOverTextLimit     = text.length > currentCharLimit;
  const isOverFileLimit     = totalFileSize > currentFileLimitBytes;
  const isOverLimit         = isOverTextLimit || isOverFileLimit;
  const requiresAuth        = !token && hasUsedFreeTrial;

  // Quota para usuários não logados (tier -1): 1 análise gratuita por dia (reset meia-noite UTC)
  const GUEST_LIMIT = 1;
  const guestQuota: QuotaInfo | null = !token ? (() => {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return {
      tier:            -1,
      ilimitado:       false,
      limite:          GUEST_LIMIT,
      usado:           hasUsedFreeTrial ? GUEST_LIMIT : 0,
      restante:        hasUsedFreeTrial ? 0 : GUEST_LIMIT,
      reseta_em:       tomorrow.toISOString().split('T')[0],
      dias_para_reset: 0, // sempre hoje/amanhã — label tratado no QuotaBar
    };
  })() : null;

  // ─── useEffect: atualiza quota após cada análise concluída ──────────────────
  useEffect(() => {
    if (!result || !token) return;
    apiFetch(`${API_URL}/api/analyses/quota`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setQuota(data); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // ─── useEffect: soberania de tier (cache local) ─────────────────────────────
  useEffect(() => {
    const cachedTier = localStorage.getItem('bawzi_tier');
    if (cachedTier) {
      const tierNum = Number(cachedTier);
      setUserTier(tierNum);
      setSelectedTier(tierNum);
    }
    const handleGlobalTierUpdate = (e: Event) => {
      const { detail } = e as BawziUpdateEvent;
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
  // 🔐 Sessão deslizante: renova o access token enquanto a aba estiver aberta
  // (evita expiração no meio de uma análise ou da leitura de um laudo)
  useEffect(() => startSessionKeepAlive(), []);

  useEffect(() => {
    const handleContextUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ActiveContextEventDetail>).detail;
      if (!detail?.active_cnpj) return;

      setUserData(prev => prev ? { ...prev, active_cnpj: detail.active_cnpj } : prev);
      setRenovacoesCount(null);
    };

    window.addEventListener(ACTIVE_CONTEXT_EVENT, handleContextUpdate);
    return () => window.removeEventListener(ACTIVE_CONTEXT_EVENT, handleContextUpdate);
  }, []);

  useEffect(() => {
    const loadUnifiedData = async () => {
      const savedToken = await initSession();
      if (!savedToken) { setIsCheckingAuth(false); return; }
      setToken(savedToken);

      const urlParams = new URLSearchParams(window.location.search);
      const isSuccessReturn = urlParams.get('success') === 'true';

      // Parâmetros de link de email / notificação de radar
      const qParam  = urlParams.get('q')  || '';
      const ufParam = urlParams.get('uf') || '';
      if (qParam && qParam.length >= 3) {
        setInitialPncpQuery(qParam);
        setInitialPncpUf(ufParam);
        // Limpa a URL para não re-disparar ao recarregar manualmente
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const fetchWithRetry = async (attemptsLeft = 5) => {
        try {
          const [userRes, wsRes] = await Promise.all([
            apiFetch(`${API_URL}/api/users/me`),
            apiFetch(`${API_URL}/api/workspace/details`),
          ]);

          if (userRes.status === 401) {
            clearSession();
            return;
          }

          if (userRes.ok && wsRes.ok) {
            const uData = await userRes.json() as UserData;
            const wData = await wsRes.json() as { tier?: number; companies?: Empresa[]; workspace_users_count?: number; vagas_totais?: number; company?: Empresa };

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

            const companiesArr: Empresa[] = (wData.companies ?? []).length > 0 ? (wData.companies as Empresa[]) : (uData.company ? [uData.company as Empresa] : []);
            const activeCnpj = getPreferredActiveCnpj(companiesArr, uData.active_cnpj as string | undefined);
            if (activeCnpj) setActiveCompanyContext(activeCnpj, false);

            const blendedUserData = {
              ...uData,
              name: uData.name || uData.nome,
              tier: nivelFinal,
              workspace_users_count: wData.workspace_users_count,
              vagas_totais: wData.vagas_totais,
              companies: companiesArr,
              active_cnpj: activeCnpj,
            };

            setUserData(blendedUserData);
            window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: nivelFinal } }));

            // Salva info de promo no localStorage para o Header exibir a barra
            if (uData.promo_expires_at) {
              localStorage.setItem('bawzi_promo', JSON.stringify({
                is_promo: uData.is_promo ?? false,
                promo_expires_at: uData.promo_expires_at,
              }));
            } else {
              localStorage.removeItem('bawzi_promo');
            }

            // Onboarding: exibir se o usuário não completou e ainda não tem empresa
            if (!localStorage.getItem('bawzi_onboarding_done')) {
              const semEmpresa = !((wData.companies ?? []).length > 0 || uData.company?.cnpj);
              if (semEmpresa) setShowOnboarding(true);
            }

            // Contagem silenciosa de contratos a vencer (só tier 4)
            if (nivelFinal >= 4 && companiesArr.length > 0) {
              const companies = orderCompaniesByActive(companiesArr, activeCnpj);
              const cnpjs = companies.map((c: Empresa) => c.cnpj).filter(Boolean);
              if (cnpjs.length > 0) {
                try {
                  const params = new URLSearchParams({ cnpj: cnpjs[0], dias: '90' });
                  const r = await apiFetch(`${API_URL}/api/contratos-vencendo?${params}`);
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

            // Busca quota mensal (silenciosa)
            try {
              const qRes = await apiFetch(`${API_URL}/api/analyses/quota`);
              if (qRes.ok) setQuota(await qRes.json());
            } catch { /* silencioso */ }
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
      const mode = (e as CustomEvent<'login' | 'register'>).detail || 'login';
      setAuthMode(mode);
      setShowAuthModal(true);
    };
    window.addEventListener('bawzi_open_auth', handleOpenAuth);
    return () => window.removeEventListener('bawzi_open_auth', handleOpenAuth);
  }, []);

  // ─── useEffect: sessão expirada (disparado pelo apiClient) ───────────────────
  useEffect(() => {
    const handleSessionExpired = () => {
      setToken(null);
      setUserData(null);
      setUserTier(1);
      setSessionExpired(true);
    };
    window.addEventListener('bawzi_session_expired', handleSessionExpired);
    return () => window.removeEventListener('bawzi_session_expired', handleSessionExpired);
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────────

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
      const response = await apiFetch(`${API_URL}/api/analyses/${analysisId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // handleAnalyze delegado ao hook useAnalysis (ver @/hooks/useAnalysis.ts)
  // Wrapper para guardar compatibilidade com requiresAuth
  const handleAnalyzeWithAuth = (motor: 'openai' | 'claude') => {
    if (requiresAuth) { setAuthMode('register'); setShowAuthModal(true); return; }
    handleAnalyze(motor);
  };

  const handleUpgrade = async (tier: number) => {
    if (!token) { setAuthMode('register'); setShowAuthModal(true); return; }
    // Assinantes pagos: a troca/gestão de plano tem UI completa na página de perfil
    // (modal de confirmação, cupom, info de próxima cobrança). Redireciona para lá.
    // Usa router.push (client-side) para preservar _accessToken na memória.
    if (userTier > 1) {
      sessionStorage.setItem('goto_section', 'sec-assinatura');
      router.push('/profile');
      return;
    }
    setSelectedTier(tier);
    setIsCheckoutLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.updated) {
          const syncRes = await apiFetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`);
          const syncData = await syncRes.json().catch(() => null);
          if (syncRes.ok && syncData?.tier !== undefined) {
            localStorage.setItem('bawzi_tier', String(syncData.tier));
          }
          window.location.reload();
        } else if (data.url) {
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

  const handleChangePlanInWorkspace = async (tier: number, coupon?: string) => {
    setIsChangingPlan(true);
    try {
      const body: Record<string, unknown> = { tier };
      if (coupon) body.coupon_code = coupon;
      const res = await apiFetch(`${API_URL}/api/billing/update-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || 'Erro ao alterar plano.');
      // Sincroniza e atualiza tier na UI
      const syncRes = await apiFetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`).catch(() => null);
      if (syncRes?.ok) {
        const syncData = await syncRes.json().catch(() => null);
        if (syncData?.tier) {
          const newTier = Number(syncData.tier);
          setUserTier(newTier);
          localStorage.setItem('bawzi_tier', String(newTier));
          localStorage.setItem('bawzi_tier_ts', String(Date.now()));
          window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: newTier } }));
        }
      }
      setChangePlanTargetTier(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao alterar plano.');
    } finally {
      setIsChangingPlan(false);
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
    if (result) exportPdf(result, showError);
  };

  // ─── Renderização ────────────────────────────────────────────────────────────
  const contextCompanies = userData?.companies?.length
    ? userData.companies
    : userData?.company ? [userData.company] : [];
  const activeCompany = resolveActiveCompany(contextCompanies, userData?.active_cnpj);
  const activeOrderedCompanies = orderCompaniesByActive(contextCompanies, userData?.active_cnpj);

  // ─── Banner de sessão expirada ───────────────────────────────────────────────
  if (sessionExpired) {
    return (
      <div className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center flex flex-col items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 mb-1">Sessão expirada</h2>
            <p className="text-sm text-slate-500 font-medium">
              A sua sessão terminou por inatividade. Faça login novamente para continuar.
            </p>
          </div>
          <button
            onClick={() => {
              setSessionExpired(false);
              setAuthMode('login');
              setShowAuthModal(true);
            }}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm transition-colors shadow-sm"
          >
            Fazer login novamente
          </button>
        </div>
      </div>
    );
  }


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
                            userUf={activeCompany?.uf || userData?.company?.uf}
                            contextCompanies={contextCompanies}
                            activeCnpj={userData?.active_cnpj}
                            onActiveCnpjChange={(cnpj) => {
                              setUserData(prev => prev ? { ...prev, active_cnpj: cnpj } : prev);
                              setRenovacoesCount(null);
                            }}
                            initialQuery={initialPncpQuery}
                            initialUf={initialPncpUf}
                            onMedirFolego={(valor, objeto) => {
                              setCapitalPrefilledValor(valor || 0);
                              setCapitalPrefilledObjeto(objeto || '');
                              setActiveTab('capital');
                              setTimeout(() => {
                                document.getElementById('capital-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 150);
                            }}
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
                      <div id="area-submissao" className="scroll-mt-24">
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
                        onAnalyze={handleAnalyzeWithAuth}
                        onShowAuthModal={(mode) => { setAuthMode(mode); setShowAuthModal(true); }}
                        quota={token ? quota : guestQuota}
                        onUpgradeClick={() => handleUpgrade(currentTier + 1)}
                      />
                      </div>
                    </>
                  ) : isAnalyzing ? (
                    <AnalysisLoadingOverlay
                      loadingStep={loadingStep}
                      loadingMessages={LOADING_MESSAGES}
                      loadingProgress={loadingProgress}
                      remainingSeconds={loadingRemainingSeconds}
                      estimatedSeconds={loadingEstimateSeconds}
                      isLive={progressoAoVivo}
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
                      resetLabel="Buscar outra oportunidade"
                      onExportPDF={handleExportPDF}
                      modelSource={modelSource}
                      isCachedResult={isCachedResult}
                      onUpgradeClick={() => handleUpgrade(selectedTier || 2)}
                      onGoToCapital={(valor) => {
                        setCapitalPrefilledValor(valor);
                        setActiveTab('capital');
                        setTimeout(() => {
                          document.getElementById('capital-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 150);
                      }}
                    />
                  ) : null}
                </div>
              )}

              {/* Aba Renovações */}
              {activeTab === 'renovacoes' && (() => {
                const companies = activeOrderedCompanies;

                if (!companies.length) {
                  return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-5">
                          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <p className="text-base font-black text-slate-900 mb-2">Nenhuma empresa cadastrada</p>
                        <p className="text-sm text-slate-500 font-medium mb-6 max-w-xs mx-auto leading-relaxed">
                          Configure o CNPJ da sua empresa para monitorar contratos a vencer.
                        </p>
                        <a
                          href="/profile"
                          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                        >
                          Configurar empresa
                        </a>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ContratosVencendo
                      token={token ?? ''}
                      companies={companies}
                      defaultUf={activeCompany?.uf || userData?.company?.uf || ''}
                    />
                  </div>
                );
              })()}

              {/* Aba Capital */}
              {activeTab === 'capital' && (
                <div id="capital-section" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {currentTier < 3 ? (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center shadow-sm">
                      <p className="text-slate-600 font-medium">Fôlego financeiro disponível a partir do Nível 3.</p>
                    </div>
                  ) : (
                    <CapitalIntelligence
                      token={token ?? ''}
                      tier={currentTier}
                      companies={activeOrderedCompanies}
                      defaultCnpj={activeCompany?.cnpj || userData?.company?.cnpj || ''}
                      defaultUf={activeCompany?.uf || userData?.company?.uf || ''}
                      defaultValorEdital={capitalPrefilledValor || undefined}
                      defaultObjeto={capitalPrefilledObjeto || undefined}
                    />
                  )}
                </div>
              )}

              {/* Aba Alertas PNCP */}
              {activeTab === 'alertas' && token && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {currentTier < 3 ? (
                    <TierGateTab
                      requiredTier={3}
                      featureName="Monitor Inteligente PNCP"
                      onUpgrade={() => handleUpgrade(3)}
                    />
                  ) : (
                    <RadarAlertas token={token} />
                  )}
                </div>
              )}

              {/* Aba Oportunidades (Feed CNAE) */}
              {activeTab === 'cnae' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {currentTier < 3 ? (
                    <TierGateTab
                      requiredTier={3}
                      featureName="Oportunidades com fit CNAE"
                      onUpgrade={() => handleUpgrade(3)}
                    />
                  ) : (
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
                  )}
                </div>
              )}

              {/* Aba Histórico */}
              {activeTab === 'parametrizacao' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white rounded-[2rem] border border-slate-200 shadow-sm min-h-[600px]">
                  <ParametrizacaoPanel />
                </div>
              )}

              {activeTab === 'history' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {isCheckingAuth ? (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center shadow-sm flex flex-col items-center animate-pulse">
                      <div className="w-16 h-16 bg-slate-100 rounded-full mb-4"></div>
                      <div className="h-5 w-48 bg-slate-100 rounded-lg mb-2"></div>
                      <div className="h-4 w-64 bg-slate-50 rounded-lg"></div>
                    </div>
                  ) : (token && userTier !== -1 && currentTier < 2) ? (
                    <TierGateTab
                      requiredTier={2}
                      featureName="Central de Decisões"
                      onUpgrade={() => handleUpgrade(2)}
                    />
                  ) : (token && userTier !== -1) ? (
                    <HistoryTab
                      token={token}
                      userTier={userTier}
                      onRedoAnalysis={(analiseAntiga) => {
                        setText(typeof analiseAntiga.raw_text === 'string' ? analiseAntiga.raw_text : '');
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

              {/* Aba Gestão */}
              {activeTab === 'gestao' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {!token ? (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center shadow-sm">
                      <h3 className="text-lg font-black text-slate-800 mb-2">Inicie sessão para gerir decisões</h3>
                      <p className="text-slate-500 font-medium mb-6">A gestão de execução usa as análises salvas e o cockpit pós-veredito.</p>
                      <button
                        onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md"
                      >
                        Entrar na Conta
                      </button>
                    </div>
                  ) : currentTier < 2 ? (
                    <TierGateTab
                      requiredTier={2}
                      featureName="Gestão do Fluxo dos Editais"
                      onUpgrade={() => handleUpgrade(2)}
                    />
                  ) : (
                    <DecisionManagementTab token={token} userTier={userTier} />
                  )}
                </div>
              )}
              {/* Aba Comparar */}
              {activeTab === 'comparar' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {!token ? (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center shadow-sm">
                      <h3 className="text-lg font-black text-slate-800 mb-2">Inicie sessão para comparar</h3>
                      <p className="text-slate-500 font-medium mb-6">O modo comparação requer um histórico de análises salvas.</p>
                      <button
                        onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md"
                      >
                        Entrar na Conta
                      </button>
                    </div>
                  ) : currentTier < 2 ? (
                    <TierGateTab
                      requiredTier={2}
                      featureName="Priorização de Disputas"
                      onUpgrade={() => handleUpgrade(2)}
                    />
                  ) : (
                    <CompareTab token={token} />
                  )}
                </div>
              )}
            </div>

            {/* ── SIDEBAR DIREITA (desktop: inline, mobile: drawer) ── */}

            {/* Mobile: drawer overlay */}
            {sidebarMobileOpen && (
              <div className="fixed inset-0 z-[600] lg:hidden flex">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                  onClick={() => setSidebarMobileOpen(false)}
                />
                {/* Drawer */}
                <div className="relative ml-auto w-[340px] max-w-[90vw] h-full bg-slate-50 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
                  <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Navegação</span>
                    <button onClick={() => setSidebarMobileOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="p-4">
                    <AppSidebar
                      token={token}
                      userData={userData}
                      currentTier={currentTier}
                      activeTab={activeTab}
                      onSetActiveTab={(tab) => { setActiveTab(tab); setSidebarMobileOpen(false); }}
                      renovacoesCount={renovacoesCount}
                      onNotifCountChange={setNotifCount}
                      onShowAuthModal={(mode) => { setAuthMode(mode); setShowAuthModal(true); setSidebarMobileOpen(false); }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Desktop: sidebar normal */}
            <div className="hidden lg:block">
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
              onChangePlan={userTier > 1 ? setChangePlanTargetTier : undefined}
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

      <ChangePlanModal
        currentTier={userTier}
        targetTier={changePlanTargetTier}
        onClose={() => setChangePlanTargetTier(null)}
        onConfirm={handleChangePlanInWorkspace}
        isConfirming={isChangingPlan}
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={async () => {
          setShowUpgradeModal(false);
          setStripeSecret(null);
          try {
            const res = await apiFetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`);
            const data = await res.json();
            if (res.ok && data.tier !== undefined) {
              localStorage.setItem('bawzi_tier', String(data.tier));
              window.location.reload();
            }
          } catch { /* silencioso — reload será feito de qualquer forma */ }
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
        title="Desbloqueie o plano Avançado (Nível 4)"
        description="Antecipe movimentos do mercado, acompanhe concorrentes e tenha inteligência operacional para disputar com mais segurança."
        features={avancadoFeatures}
      />

      {/* ── BOTÃO MOBILE SIDEBAR ── */}
      {token && (
        <button
          onClick={() => setSidebarMobileOpen(true)}
          className="fixed bottom-6 right-6 z-[500] lg:hidden w-14 h-14 bg-slate-900 hover:bg-emerald-700 text-white rounded-2xl shadow-xl flex items-center justify-center transition-all active:scale-95 print:hidden"
          aria-label="Abrir menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {notifCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>
      )}

      {/* ── ONBOARDING ── */}
      {showOnboarding && token && (
        <OnboardingModal
          userName={userData?.name || userData?.nome || 'usuário'}
          hasCompany={!!(userData?.companies?.length || userData?.company?.cnpj)}
          onClose={() => setShowOnboarding(false)}
          onGoToProfile={() => window.location.href = '/profile'}
          onGoToRadar={() => {
            setShowOnboarding(false);
            document.getElementById('radar-pncp-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      )}

      {/* ── AVISO DE INATIVIDADE ── */}
      {showInactivityWarning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[800] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-xl px-5 py-4 flex items-center gap-4 max-w-sm">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M12 6v6l4 2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-amber-900">Sessão prestes a expirar</p>
              <p className="text-xs text-amber-700 font-medium">
                Sua sessão expira em <span className="font-black">{inactivitySecondsLeft}s</span>. Mova o mouse para continuar.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
