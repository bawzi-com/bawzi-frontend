'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { BrainCircuit, ScanSearch, Radar, Award, Globe, MapPin, SearchX, MapPinOff, FileText, Lock, Crown } from 'lucide-react';
import { fetchUserProfile } from '../services/api';
import Image from 'next/image'
import UserProfileCard from './UserProfileCard';
import BawziShadowSimulator from '../components/BawziShadowSimulator';
import ReverseEngineeringBlock from '../components/ReverseEngineeringBlock'; 
import HistoryTab from './HistoryTab';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PricingSection from './PricingSection';
import PncpSearch from '../components/PncpSearch';
import ContratosVencendo from '../components/ContratosVencendo';
import UpgradeModal from './UpgradeModal';
import { useTierConfig } from '../Contexts/TierContext';
import AuthModal from './AuthModal';
import PremiumLock from '../components/PremiumLock';
import CompliancePanel from '../components/CompliancePanel';
import UpsellModal from './UpsellModal';
import CompetitorWarRoom from '../components/CompetitorWarRoom';
import TacticalSimulator from '../components/TacticalSimulator';
import NotificationPanel, { useNotificacoes } from '../components/NotificationPanel';

const logout = () => {
  localStorage.clear();
  window.location.reload();
};

// --- Interfaces ---
interface EngenhariaReversa {
  setor_identificado: string;
  margem_media_setor_pct: number;
}

interface PricingIntelligence {
  desagioPreditivoOrgao: number;
  nivelAmeaca: string;
  perfilVencedor: string;
  valor_estimado_raw?: number;
  financial_verdict?: string;
  estimated_discount?: number;
  valorMedioMercado?: number; 
  engenharia_reversa?: EngenhariaReversa; 
}

interface HighlightItem { title: string; quote: string; }

interface SemaforoSinal {
  status: 'ok' | 'alerta' | 'risco';
  motivo: string;
}

interface DataCritica {
  label: string;
  data_iso: string | null;
  urgente: boolean;
}

interface RiskItem {
  titulo: string;
  descricao: string;
  impacto?: 'alto' | 'medio' | 'baixo';
}

interface AnalysisResult {
  id?: string;
  title: string;
  summary: string;
  score: number;
  classification: string;
  effort: string;
  estimated_value: string;
  recommendation: string;
  rationale: string;
  // New structured dates (replaces datas_criticas_extraidas)
  datas_criticas?: DataCritica[];
  // Legacy — kept for backwards compat with older saved analyses
  datas_criticas_extraidas?: {
    data_limite_propostas?: string;
    data_impugnacao?: string;
  };
  // Semáforo de Viabilidade
  semaforo?: {
    tecnica: SemaforoSinal;
    financeira: SemaforoSinal;
    juridica: SemaforoSinal;
    documentacao: SemaforoSinal;
  };
  probabilidade_de_sucesso?: string;
  vantagens?: string[];
  desvantagens?: string[];
  exigencias_criticas?: string[];
  prazos?: string[];
  documentos_necessarios?: string[];
  criterios_de_julgamento?: string[];
  concorrentes_provaveis?: any[];
  concorrentes_regionais?: any[];
  uf?: string;
  estado?: string;
  risks?: RiskItem[];
  checklist?: any[];
  pricing_intelligence?: PricingIntelligence;
  orgao_risk?: any;
  created_at?: string;
  parecer_especialista?: string;
  pegadinha?: PegadinhaData;
}

interface PegadinhaData {
  detectada: boolean;
  tipo?: string;
  descricao?: string;
  base_legal?: string;
}

// --- Utilitários ---
const getScoreColor = (score: number) => score >= 70 ? 'text-emerald-600 border-emerald-500' : score >= 45 ? 'text-amber-500 border-amber-400' : 'text-red-600 border-red-500';
const getScoreBg = (score: number) => score >= 70 ? 'bg-emerald-50' : score >= 45 ? 'bg-amber-50' : 'bg-red-50';
const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

const extrairValorNumerico = (val: string | number | undefined): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;

  let str = val.toString().trim();

  if (str.includes(',')) {
    str = str.replace(/[^\d,-]/g, '');
    str = str.replace(',', '.');
  } 
  else {
    str = str.replace(/[^\d.-]/g, '');
  }

  const num = Number(str);
  return isNaN(num) ? 0 : num;
};

const dominadorFeatures = [
  { title: "Raio-X de Concorrentes", desc: "Veja capital social, sócios e volume de vitórias." },
  { title: "Engenharia Reversa", desc: "Descubra o custo real e a margem de lucro dos seus rivais." },
  { title: "Alertas de Vencimento", desc: "Saiba 30 dias antes quando o contrato milionário do seu rival vai vencer." }
];

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function AnalysisApp() {
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const [showUpsell, setShowUpsell] = useState(false);
  const [upsellData, setUpsellData] = useState({ title: '', desc: '' });
  
  // 🟢 ESTADOS (Nascem em 1 para não quebrar a Hidratação)
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uf, setUf] = useState('');
  const [forceExact, setForceExact] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelSource, setModelSource] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<number>(1); 
  const [userData, setUserData] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<string>('workspace');
  const [notifCount, setNotifCount] = useState(0);
  const [hasUsedFreeTrial, setHasUsedFreeTrial] = useState(false);
  const [isCachedResult, setIsCachedResult] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [termoAlvo, setTermoAlvo] = useState('');
  const [pncpData, setPncpData] = useState<{cnpj: string, ano: number, sequencial: number, uf?: string} | null>(null);
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(1);

  const [stripeSecret, setStripeSecret] = useState<string | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');

  const { tierLimits, tierFileLimits } = useTierConfig();

  // 🟢 CÁLCULOS SEGUROS
  const currentCharLimit = tierLimits[userTier] || 10000;
  const currentFileLimitMB = tierFileLimits[userTier] || 3;
  const currentFileLimitBytes = currentFileLimitMB * 1024 * 1024;
  
  const currentChars = text.length; 
  const totalFileSize = files.reduce((acc, file) => acc + file.size, 0);

  const isOverTextLimit = currentChars > currentCharLimit;
  const isOverFileLimit = totalFileSize > currentFileLimitBytes;
  const isOverLimit = isOverTextLimit || isOverFileLimit;
  const requiresAuth = (!token) && (hasUsedFreeTrial);

  const [isLoadingCnd, setIsLoadingCnd] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [abaConcorrentes, setAbaConcorrentes] = useState<'nacional' | 'regional'>('nacional');
  const [provider, setProvider] = useState<string>('openai');
  const [selectedCompetitor, setSelectedCompetitor] = useState<any | null>(null);
  
  const currentTier = Math.max(userTier, userData?.active_workspace?.tier || 1);

  const loadingMessages = [
    { title: "A Orquestrar Swarm de Agentes", desc: "A instanciar modelos neurais especializados..." },
    { title: "Agente Jurídico em Operação", desc: "A varrer as entrelinhas do documento..." },
    { title: "Agente Financeiro a Calcular", desc: "A cruzar histórico de PNCP para deságio preditivo..." },
    { title: "Agente de Mercado a Rastrear", desc: "A mapear concorrentes locais e agressividade..." },
    { title: "A Consolidar Veredito", desc: "A fundir os dados para emissão da matriz (Go/No-Go)." }
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      setLoadingStep(0); 
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 3500); 
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // 🟢 OUVINTE GLOBAL DE SOBERANIA DE TIER
  useEffect(() => {
    const cachedTier = localStorage.getItem('bawzi_tier');
    if (cachedTier) {
      const tierNum = Number(cachedTier);
      setUserTier(tierNum);
      setSelectedTier(tierNum);
    }

    const handleGlobalTierUpdate = (e: any) => {
      if (e.detail?.tier) {
        const novoTier = Number(e.detail.tier);
        setUserTier(prev => Math.max(prev, novoTier));
        setSelectedTier(prev => Math.max(prev, novoTier));
      }
    };

    window.addEventListener('bawzi_update', handleGlobalTierUpdate);
    return () => window.removeEventListener('bawzi_update', handleGlobalTierUpdate);
  }, []);

  // 🟢 UNIFICAÇÃO DA CHAMADA À API (Adeus "downgrade"!)
  useEffect(() => {
    const loadUnifiedData = async () => {
      const savedToken = localStorage.getItem('bawzi_token');
      if (!savedToken) {
        setIsCheckingAuth(false);
        return;
      }
      setToken(savedToken);

      const urlParams = new URLSearchParams(window.location.search);
      const isSuccessReturn = urlParams.get('success') === 'true';
      const headers = { 'Authorization': `Bearer ${savedToken}`, 'Content-Type': 'application/json' };

      const fetchWithRetry = async (attemptsLeft = 5) => {
        try {
          const [userRes, wsRes] = await Promise.all([
            fetch(`${API_URL}/api/users/me`, { headers }),
            fetch(`${API_URL}/api/workspace/details`, { headers })
          ]);

          if (userRes.status === 401) {
            localStorage.clear();
            window.location.reload();
            return;
          }

          if (userRes.ok && wsRes.ok) {
            const uData = await userRes.json();
            const wData = await wsRes.json();

            const nivelServidor = Math.max(uData.tier || 1, wData.tier || 1);
            const nivelDoCache = Number(localStorage.getItem('bawzi_tier') || 1);
            const nivelFinal = Math.max(nivelServidor, nivelDoCache);

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
              active_cnpj: wData.companies?.[0]?.cnpj || uData.company?.cnpj
            };

            setUserData(blendedUserData);
            window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: nivelFinal } }));

            if (isSuccessReturn && nivelFinal > 1) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        } catch (err) {
          console.error("Erro na sincronização:", err);
        } finally {
          setIsCheckingAuth(false);
        }
      };
      await fetchWithRetry();
    };
    loadUnifiedData();
  }, [API_URL]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isAnalyzing) {
      timeoutId = setTimeout(() => {
        const loadingEl = document.getElementById('area-loading');
        if (loadingEl) {
          loadingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [isAnalyzing]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsAnalyzing(false);
    setLoadingStep(0);
    setError("Análise cancelada pelo utilizador.");
    setTimeout(() => setError(null), 4000);
  };

  useEffect(() => {
    const syncAuth = (e: StorageEvent) => {
      if (e.key === 'bawzi_token' && e.newValue) window.location.reload(); 
    };
    window.addEventListener('storage', syncAuth);
    return () => window.removeEventListener('storage', syncAuth);
  }, []);

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (selectedCompetitor?.cnpj) {
      setLoadingHistory(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const cleanCnpj = selectedCompetitor.cnpj.replace(/\D/g, '');
      fetch(`${baseUrl.replace(/\/$/, '')}/api/competitor/history/${cleanCnpj}`)
        .then(res => { if (!res.ok) throw new Error("Erro na rota"); return res.json(); })
        .then(data => setHistory(data))
        .catch(err => setHistory([]))
        .finally(() => setLoadingHistory(false));
    }
  }, [selectedCompetitor]);

  useEffect(() => {
    const handleOpenAuth = (e: any) => {
      setAuthMode(e.detail || 'login'); 
      setShowAuthModal(true); 
    };
    window.addEventListener('bawzi_open_auth', handleOpenAuth);
    return () => window.removeEventListener('bawzi_open_auth', handleOpenAuth);
  }, []);

  // 🟢 FORÇA A LEITURA DO CACHE AO COLAR TEXTO
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const tierReal = typeof window !== 'undefined' ? Number(localStorage.getItem('bawzi_tier') || userTier) : userTier;
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
      const newFiles = Array.from(e.target.files);
      const newTotalSize = newFiles.reduce((acc, f) => acc + f.size, 0) + totalFileSize;
      if (newTotalSize > currentFileLimitBytes) {
        setError(`Arquivos somam ${formatMB(newTotalSize)}MB, excedendo o limite de ${currentFileLimitMB}MB.`);
        setTimeout(() => setError(null), 5000);
      } else {
        setFiles((prev) => [...prev, ...newFiles]);
      }
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };
  
  const handleShare = () => {
    if (!analysisId) return;
    setShareEmail('');
    setShowShareModal(true);
  };

  const confirmShare = async () => {
    if (!shareEmail || !shareEmail.includes('@')) {
      alert("Por favor, insira um e-mail válido.");
      return;
    }

    if (!analysisId) {
      alert("Erro: Não foi possível identificar o ID desta análise. Tente fazer a análise novamente.");
      return;
    }

    setIsSharing(true);
    try {
      const currentToken = localStorage.getItem('bawzi_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';
      
      const response = await fetch(`${apiUrl}/api/analyses/${analysisId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
        },
        body: JSON.stringify({ target_email: shareEmail })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Falha ao partilhar o relatório.");
      }

      alert("✅ Relatório estratégico enviado com sucesso para o C-Level!");
      setShowShareModal(false);
      setShareEmail(""); 
      
    } catch (err: any) {
      console.error("Erro no compartilhamento:", err);
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleAnalyze = async (motor: "openai" | "claude") => {
    if (requiresAuth) { setAuthMode('register'); setShowAuthModal(true); return; }
    
    if (!text.trim() && files.length === 0 && !pncpData) { 
      setError("Por favor, cole um texto, adicione um documento ou selecione um edital no Radar PNCP antes de analisar."); 
      setTimeout(() => setError(null), 5000); 
      return; 
    }
    
    if (isOverLimit) { 
      handleUpgrade(userTier >= 1 ? userTier + 1 : 2); 
      return; 
    }

    setIsAnalyzing(true); 
    setError(null); 
    setResult(null); 
    setIsCachedResult(false);
    
    abortControllerRef.current = new AbortController();

    setTimeout(() => {
      const areaLoading = document.getElementById('area-loading');
      if (areaLoading) {
        const y = areaLoading.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 50);

    try {
      const formData = new FormData();
      if (text.trim()) formData.set('raw_text', text.trim());
      files.forEach(f => formData.append('files', f));
      formData.set("uf", uf && uf.trim() !== '' ? uf.trim().toUpperCase() : "BR");
      formData.set('force_exact', forceExact ? 'true' : 'false');
      formData.set('provider', motor);

      if (pncpData) {
        formData.set('pncp_cnpj', pncpData.cnpj);
        formData.set('pncp_ano', pncpData.ano.toString());
        formData.set('pncp_sequencial', pncpData.sequencial.toString());
        
        if (pncpData.uf) {
          formData.set('uf', pncpData.uf); 
        }
      }

      const headers: Record<string, string> = {};
      const currentToken = localStorage.getItem('bawzi_token');
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

      // 🟢 1. PRIMEIRO FAZEMOS O PEDIDO À API
      const response = await fetch(`${API_URL.replace(/\/$/, '')}/api/analyze`, {
        method: 'POST', 
        headers: headers, 
        body: formData,
        signal: abortControllerRef.current.signal
      });

      // 🟢 2. DEPOIS VERIFICAMOS O ERRO 403 (O NOSSO NOVO CÓDIGO DE UPSELL)
      if (response.status === 403) {
        const errorData = await response.json();
        
        if (errorData.detail?.codigo === "LIMIT_REACHED") {
          setUpsellData({ 
            title: errorData.detail.titulo, 
            desc: errorData.detail.mensagem 
          });
          setShowUpsell(true); // Abre a modal linda que fizemos
          setIsAnalyzing(false); // Para o efeito de carregamento
          return; 
        }
      }

      // 3. OUTRAS VERIFICAÇÕES DE SEGURANÇA
      if (response.status === 401) {
        alert("Sua sessão expirou por segurança (8 horas). Faça login novamente.");
        logout();
        return;
      }

      // (Mantido por retrocompatibilidade caso ainda tenha algum 402 antigo a rodar)
      if (response.status === 402) {
        handleUpgrade(userTier >= 1 ? userTier + 1 : 2);
        setIsAnalyzing(false);     
        return;                    
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || 'Erro no servidor.');
      }

      const analysisData = data.analysis || data;

      if (!analysisData || Object.keys(analysisData).length === 0 || !analysisData.score) {
        throw new Error("A IA processou o documento, mas não conseguiu estruturar o formato final. Por favor, clique em Iniciar Análise novamente.");
      }

      setResult(analysisData);
      setAnalysisId(data.id || data.record_id || data.analysis_hash); 
      setModelSource(data.source || data.model_source || 'Motor Bawzi IA'); 
      setIsCachedResult(data.is_cached || false);

      setTimeout(() => {
        const areaResultados = document.getElementById('area-resultados');
        if (areaResultados) {
          const y = areaResultados.getBoundingClientRect().top + window.scrollY - 50;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 100);

      if (!token) {
        localStorage.setItem('bawzi_free_trial_used', 'true');
        setHasUsedFreeTrial(true);
      }

    } catch (err: any) {
      if (err.name === 'AbortError') return; 

      if (userTier === -1) {
        setShowUpgradeModal(true);
        setIsAnalyzing(false);
        return;
      }

      let mensagemParaExibir = "Ocorreu um erro inesperado. Por favor, tente novamente.";
      
      if (err.message.includes("NoneType") || err.message.includes("401")) {
        mensagemParaExibir = "Parece que a sua sessão expirou. Por favor, faça login novamente.";
      } else if (err.message.includes("500")) {
        mensagemParaExibir = "O nosso motor de IA está sobrecarregado. Tente novamente em instantes. ⚙️";
      } else {
        mensagemParaExibir = err.message;
      }

      setError(mensagemParaExibir);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpgrade = async (tier: number) => {
    if (!token) { 
      setAuthMode('register'); 
      setShowAuthModal(true); 
      return; 
    }
    
    setSelectedTier(tier); 
    setIsCheckoutLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tier })
      });
      
      const data = await res.json();

      if (res.ok) {
        if (data.url) {
          window.location.href = data.url;
        } else if (data.client_secret) {
          setStripeSecret(data.client_secret);
          setShowUpgradeModal(true);
          setIsCheckoutLoading(false);
        }
      } else {
        throw new Error(data.detail || "Erro no processamento");
      }
    } catch (error) {
      setIsCheckoutLoading(false);
      alert("Erro ao processar plano. Tente novamente.");
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
      if (target) {
        const y = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 50);
  };

  const [isGeneratingImpugnacao, setIsGeneratingImpugnacao] = useState(false);
  const [impugnacaoText, setImpugnacaoText] = useState("");
  const [showImpugnacaoModal, setShowImpugnacaoModal] = useState(false);

  // ==========================================
  // GERADOR DE PARECER PDF BLINDADO
  // ==========================================
  const handleExportPDF = () => {
    if (!result) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, permita pop-ups no seu navegador para gerar o PDF.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Parecer Técnico-Jurídico - Bawzi</title>
          <style>
            @page { size: A4; margin: 2.5cm 2cm; }
            body { font-family: 'Times New Roman', Times, serif; line-height: 1.6; color: #000; padding: 0; margin: 0; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 30px; }
            h1 { font-size: 20px; text-transform: uppercase; margin: 0 0 5px 0; font-weight: bold; letter-spacing: 1px; }
            .subtitle { font-size: 11px; font-weight: bold; color: #555; text-transform: uppercase; letter-spacing: 2px; margin: 0; }
            .warning { background: #f9f9f9; border-left: 3px solid #000; padding: 12px 15px; font-size: 11px; font-weight: bold; margin-bottom: 30px; color: #333; text-align: justify; }
            h3 { font-size: 13px; font-weight: bold; margin-top: 25px; border-bottom: 1px solid #ccc; padding-bottom: 5px; text-transform: uppercase; }
            p { font-size: 12px; text-align: justify; white-space: pre-wrap; margin-bottom: 15px; }
            .signature { margin-top: 80px; text-align: center; page-break-inside: avoid; }
            .line { width: 250px; border-top: 1px solid #000; margin: 0 auto 10px auto; }
            .sig-text { font-weight: bold; text-transform: uppercase; font-size: 11px; margin: 0; }
            .sig-sub { font-size: 10px; margin-top: 5px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Bawzi Intelligence</h1>
            <p class="subtitle">Parecer Técnico-Jurídico Preliminar</p>
          </div>
          
          <div class="warning">
            NOTA DE RESPONSABILIDADE: Este rascunho foi gerado por Inteligência Artificial para facilitar a triagem de editais. A revisão, validação e assinatura por um profissional habilitado da área jurídica é indispensável antes do uso oficial.
          </div>

          <h3>1. Resumo da Análise</h3>
          <p>${result.summary}</p>

          <h3>2. Fundamentação Legal e Riscos</h3>
          <p>${result.parecer_especialista || result.rationale || "Sem riscos críticos identificados nesta análise."}</p>

          <h3>3. Conclusão Estratégica</h3>
          <p>Veredito da Análise: <strong>${result.classification}</strong> (Bawzi Score: ${result.score}/100)</p>

          <div class="signature">
            <div class="line"></div>
            <p class="sig-text">Validação Jurídica</p>
            <p class="sig-sub">OAB/UF nº _________</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  // ==========================================
  // RENDERIZAÇÃO VISUAL ESTRATÉGICA
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-violet-200/50 to-transparent rounded-full blur-[100px]"></div>
      </div>

      <main>  
  
        <div className="w-full max-w-[1400px] mx-auto p-2 md:p-4 font-sans relative group">
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes route-data {
              0% { stroke-dashoffset: 60; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes scan-laser {
              0% { transform: translateY(-10px); opacity: 0; }
              15% { opacity: 1; }
              85% { opacity: 1; }
              100% { transform: translateY(100px); opacity: 0; }
            }
            @keyframes float-agent {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-5px); }
            }
            .path-routing {
              stroke-dasharray: 8;
              animation: route-data 1.2s linear infinite;
            }
            @keyframes draw-arc {
              0% { stroke-dasharray: 0, 100; }
              100% { stroke-dasharray: 98, 100; }
            }
          `}} />

          {/* CONTAINER PRINCIPAL */}
          <div className="bg-white rounded-[2.5rem] shadow-[0_15px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-200/80 overflow-hidden flex flex-col xl:flex-row p-4 md:p-6 gap-6">

            {token && userData && !isCheckingAuth ? (
              // ── HEADER COMPACTO (utilizador autenticado) ──
              <div className="w-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 rounded-[2rem] border border-slate-100 p-8 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-100/30 blur-[120px] rounded-full -translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col gap-5">

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-violet-200/60 shrink-0 select-none">
                        {(userData.name || userData.nome || 'B').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Central de Inteligência Bawzi</p>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
                          Olá, {(userData.name || userData.nome || 'Estrategista').split(' ')[0]} 👋
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border ${
                        currentTier >= 4 ? 'bg-violet-900 text-violet-200 border-violet-700' :
                        currentTier >= 3 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        currentTier >= 2 ? 'bg-sky-50 text-sky-700 border-sky-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <span>{currentTier >= 4 ? '👑' : currentTier >= 3 ? '⚡' : currentTier >= 2 ? '🎯' : '🔎'}</span>
                        {currentTier >= 4 ? 'Dominador' : currentTier >= 3 ? 'Estrategista' : currentTier >= 2 ? 'Explorador' : 'Gratuito'}
                      </div>
                      {userData?.company?.uf && (
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold border border-slate-200">
                          <MapPin size={11} />
                          {userData.company.uf}
                        </div>
                      )}
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black border border-emerald-100">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        PNCP Ativo
                      </div>
                      <button
                        onClick={() => setActiveTab('history')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-500 hover:text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        📚 Histórico
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center gap-2.5 flex-wrap">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Fluxo rápido:</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border bg-indigo-50 text-indigo-700 border-indigo-100">
                      🔍 ① Radar PNCP
                    </span>
                    <span className="text-slate-200 font-black text-base">›</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border bg-violet-50 text-violet-700 border-violet-100">
                      📋 ② Selecionar Edital
                    </span>
                    <span className="text-slate-200 font-black text-base">›</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-100">
                      ⚡ ③ Analisar
                    </span>
                  </div>

                </div>
              </div>
            ) : (
              <div className="xl:w-2/3 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 rounded-[2rem] border border-slate-100 p-8 md:p-12 flex flex-col lg:flex-row items-center gap-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-100/30 blur-[120px] rounded-full -translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

                <div className="flex-1 relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-6 w-max">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Orquestração Multi-Agentes</span>
                  </div>

                  <h2 className="text-4xl md:text-5xl lg:text-5xl font-black text-slate-900 leading-[1.1] mb-5 tracking-tight">
                    Um esquadrão de IAs <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500">
                      dissecando o seu edital.
                    </span>
                  </h2>
                  <p className="text-slate-500 text-base md:text-lg leading-relaxed font-medium mb-8 max-w-md">
                    Por que depender de uma única IA genérica? A Bawzi divide o contrato e roteia as cláusulas para um time de especialistas. O Jurídico redige defesas, o Financeiro projeta margens, o Auditor cruza legislações em busca de armadilhas e o Compliance blinda a entrega.
                  </p>
                </div>

                <div className="flex-1 w-full relative h-[380px] hidden lg:flex items-center justify-center z-10">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-32 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-col items-center justify-center gap-2 z-20">
                    <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
                    <div className="w-16 h-1 bg-slate-200 rounded-full"></div>
                    <div className="w-10 h-1 bg-slate-200 rounded-full"></div>
                    <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_12px_#6366f1]" style={{ animation: 'scan-laser 2.5s ease-in-out infinite' }}></div>
                  </div>

                  <svg className="absolute left-24 w-[calc(100%-11rem)] h-full z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path d="M 0 50 C 30 50, 50 10, 100 10" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                    <path d="M 0 50 C 30 50, 50 10, 100 10" fill="none" stroke="#6366f1" strokeWidth="2" className="path-routing" />

                    <path d="M 0 50 C 35 50, 55 35, 100 35" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                    <path d="M 0 50 C 35 50, 55 35, 100 35" fill="none" stroke="#8b5cf6" strokeWidth="2" className="path-routing" />

                    <path d="M 0 50 C 35 50, 55 65, 100 65" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                    <path d="M 0 50 C 35 50, 55 65, 100 65" fill="none" stroke="#10b981" strokeWidth="2" className="path-routing" />

                    <path d="M 0 50 C 30 50, 50 90, 100 90" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                    <path d="M 0 50 C 30 50, 50 90, 100 90" fill="none" stroke="#f59e0b" strokeWidth="2" className="path-routing" />
                  </svg>

                  <div className="absolute right-0 top-[0%] flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm z-20" style={{ animation: 'float-agent 4s infinite' }}>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0">
                      <span className="text-indigo-500 text-sm">⚖️</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Agente Jurídico</span>
                      <span className="block text-xs font-bold text-slate-700 leading-none">Claude 3.5 Sonnet</span>
                    </div>
                  </div>

                  <div className="absolute right-0 top-[26%] flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm z-20" style={{ animation: 'float-agent 4.2s infinite 0.2s' }}>
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center border border-violet-100 shrink-0">
                      <span className="text-violet-500 text-sm">🕵️</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-violet-500 uppercase tracking-widest leading-none mb-1">Agente Auditor</span>
                      <span className="block text-xs font-bold text-slate-700 leading-none">OpenAI o3-mini</span>
                    </div>
                  </div>

                  <div className="absolute right-0 top-[52%] flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm z-20" style={{ animation: 'float-agent 4.5s infinite 0.5s' }}>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100 shrink-0">
                      <span className="text-emerald-500 text-sm">💰</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Agente Financeiro</span>
                      <span className="block text-xs font-bold text-slate-700 leading-none">GPT-4o Omni</span>
                    </div>
                  </div>

                  <div className="absolute right-0 top-[78%] flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm z-20" style={{ animation: 'float-agent 5s infinite 1s' }}>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100 shrink-0">
                      <span className="text-amber-500 text-sm">🛡️</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Agente Compliance</span>
                      <span className="block text-xs font-bold text-slate-700 leading-none">Llama 3 (Local)</span>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {(!token || !userData || isCheckingAuth) && (
            <div className="xl:w-1/3 flex flex-col gap-3">
              <div className="flex-1 bg-white rounded-3xl p-4 md:p-5 border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center gap-4 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="relative w-[65px] h-[65px] shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-emerald-500 drop-shadow-[0_2px_4px_rgba(16,185,129,0.3)]" strokeDasharray="98, 100" strokeWidth="3" strokeLinecap="round" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style={{ animation: "draw-arc 1.5s ease-out forwards" }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-black text-slate-900 tracking-tighter">98</span>
                    </div>
                </div>
                <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Score Consolidado</p>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded border border-emerald-100 uppercase mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Pronto para Assinar
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🤖</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Consenso dos 4 Agentes</span>
                    </div>
                </div>
              </div>

              <div className="flex-1 bg-violet-50/50 rounded-3xl p-4 border border-violet-100 flex flex-col justify-center relative overflow-hidden group hover:bg-violet-50 transition-colors cursor-default">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-violet-400"></div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-violet-600 text-sm">🔎</span>
                    <h5 className="text-violet-800 font-black text-[9px] uppercase tracking-widest">Armadilha Legal Detetada</h5>
                  </div>
                  <span className="text-[7px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded uppercase font-black tracking-widest border border-violet-200">🕵️ Agente Auditor</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Exigência do Item 9.2 em conflito com o Art. 14 (14.133/21). Risco de <span className="inline-block bg-white text-slate-900 px-1 py-0 rounded text-[10px] font-bold border border-slate-200 shadow-sm">direcionamento de edital</span>.
                </p>
              </div>

              <div className="flex-1 bg-sky-50/50 rounded-3xl p-4 border border-sky-100 flex flex-col justify-center relative overflow-hidden group hover:bg-sky-50 transition-colors cursor-default">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-sky-400"></div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sky-600 text-sm">💡</span>
                    <h5 className="text-sky-800 font-black text-[9px] uppercase tracking-widest">Oportunidade (Alpha)</h5>
                  </div>
                  <span className="text-[7px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded uppercase font-black tracking-widest border border-sky-200">💰 Agente Financeiro</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  A cláusula de reajuste omite o índice base. Indexar ao <span className="inline-block bg-white text-slate-900 px-1 py-0 rounded text-[10px] font-bold border border-slate-200 shadow-sm">IPCA</span> blindará a sua margem.
                </p>
              </div>

              <div className="flex-1 bg-rose-50/50 rounded-3xl p-4 border border-rose-100 flex flex-col justify-center relative overflow-hidden group hover:bg-rose-50 transition-colors cursor-default">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-rose-400"></div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-rose-600 text-sm font-black">!</span>
                    <h5 className="text-rose-800 font-black text-[9px] uppercase tracking-widest">Risco Contratual Oculto</h5>
                  </div>
                  <span className="text-[7px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded uppercase font-black tracking-widest border border-rose-200">⚖️ Agente Jurídico</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                  Multa rescisória unilateral de <span className="inline-block bg-white text-slate-900 px-1 py-0 rounded text-[10px] font-bold border border-slate-200 shadow-sm">30%</span> (Item 7.4). Defesa técnica já anexada.
                </p>
              </div>
            </div>
            )}

          </div>
        </div>

        <section className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 relative z-10 print:m-0 print:p-0">
          <div className="grid lg:grid-cols-[1fr_350px] gap-8 md:gap-12 items-start print:block">
            
            <div className="flex flex-col gap-8 w-full overflow-hidden print:m-0">
              {(activeTab === 'workspace' || activeTab === 'analise' || activeTab === 'concorrentes') && (
                <div className="animate-in fade-in duration-500 flex flex-col gap-8 w-full print:m-0">
                  
                  {!isAnalyzing && !result ? (
                    <>
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
                              
                              if (editalDados) {
                                setPncpData(editalDados);
                              } else {
                                setPncpData(null);
                              }
                              
                              setTimeout(() => {
                                const element = document.getElementById('area-submissao');
                                if (element) {
                                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                              }, 150);
                            }} 
                          />
                        </div>
                      </div>

                      {text && text.length > 100 && (
                        <div className="flex items-center gap-4 animate-in fade-in duration-300">
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent"></div>
                          <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-xl shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Edital Carregado</span>
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent"></div>
                        </div>
                      )}

                      <div id="area-submissao" className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 md:p-10 relative z-20 w-full">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-500 text-white rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-md shadow-violet-200/60">⚡</div>
                          <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Analisar Edital</h2>
                            <p className="text-sm font-medium text-slate-400">Cole o texto completo ou envie o PDF — os agentes cuidam do resto</p>
                          </div>
                        </div>

                        {!token && (
                          <div className="mb-8 p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center text-xl shrink-0 shadow-sm">🕵️</div>
                              <div>
                                <h4 className="text-sm font-black text-slate-900">Modo Anónimo Ativo</h4>
                                <p className="text-xs text-slate-500 font-medium mt-1">Inicie sessão para guardar histórico e ativar o Matchmaker.</p>
                              </div>
                            </div>
                            <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors shrink-0">
                              Entrar na Conta
                            </button>
                          </div>
                        )}

                        {error && (
                          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                            <span className="text-xl leading-none mt-0.5">⚠️</span>
                            <p className="text-sm font-medium leading-relaxed">{error}</p>
                          </div>
                        )}

                        <form onSubmit={(e) => { e.preventDefault(); handleAnalyze("openai"); }} className="space-y-6 w-full">
                          <div className="relative group w-full">
                            <textarea 
                              value={text} 
                              onChange={handleTextChange}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all resize-none min-h-[180px] text-slate-700 font-medium placeholder:text-slate-400/70 outline-none leading-relaxed" 
                              placeholder="Cole o texto do edital aqui para uma análise profunda..."
                            ></textarea>
                            <div className="absolute bottom-4 right-4 flex items-center gap-2">
                              <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm text-xs font-bold text-slate-500">
                                <span className={text.length >= currentCharLimit ? 'text-red-500' : 'text-slate-900'}>{text.length.toLocaleString('pt-BR')}</span> 
                                <span className="opacity-50"> / {currentCharLimit.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-violet-400 hover:bg-violet-50/50 transition-all group flex flex-col items-center justify-center gap-3 overflow-hidden w-full bg-slate-50/50">
                            <input type="file" multiple accept=".pdf,.txt" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <div className="w-14 h-14 bg-white shadow-sm border border-slate-100 group-hover:border-violet-200 group-hover:bg-violet-100 group-hover:text-violet-600 text-slate-400 rounded-full flex items-center justify-center text-2xl transition-colors">📂</div>
                            <div>
                                <h4 className="text-sm font-black text-slate-700 group-hover:text-violet-700">Arraste documentos ou clique aqui</h4>
                                <p className="text-xs text-slate-400 font-medium mt-1">Suporta PDF ou TXT até {currentFileLimitMB}MB.</p>
                            </div>
                          </div>

                          {files.length > 0 && (
                            <div className="space-y-2 w-full bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Documentos Anexos</h5>
                              {files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white text-slate-700 text-sm font-bold border border-slate-200 rounded-xl w-full hover:border-violet-200 transition-colors shadow-sm">
                                  <span className="truncate flex-1 pr-2 flex items-center gap-2">
                                    <span className="text-violet-500">📄</span> {file.name}
                                  </span>
                                  <div className="flex items-center gap-4 shrink-0">
                                    <span className="text-slate-400 text-xs font-medium whitespace-nowrap bg-slate-100 px-2 py-1 rounded-md">{formatMB(file.size)} MB</span>
                                    <button type="button" onClick={() => removeFile(idx)} className="text-slate-300 hover:text-red-500 text-lg transition-colors p-1">&times;</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-6 w-full">
                          {userTier === 4 ? (
                            <>
                              {error && (
                                <div className="mb-2 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl shadow-sm flex items-center gap-3 transition-all duration-500 animate-in fade-in slide-in-from-top-4">
                                  <span className="text-xl shrink-0">⚠️</span>
                                  <p className="text-sm font-bold">{error}</p>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-8">
                                <div
                                  onClick={() => setProvider('openai')}
                                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col gap-3 group cursor-pointer ${
                                    provider === 'openai'
                                      ? 'border-violet-500 bg-violet-50/50 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                                      : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                      <span className="text-2xl">⚡</span>
                                      <span className="text-xl font-black text-slate-900 tracking-tight">Análise Rápida</span>
                                    </div>
                                    {provider === 'openai' && (
                                      <span className="w-3 h-3 rounded-full bg-violet-500 animate-pulse shadow-[0_0_10px_rgba(139,92,246,0.8)]"></span>
                                    )}
                                  </div>
                                  
                                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                    Foco em velocidade e extração de dados estruturados do edital. Entrega em ~5 segundos.
                                  </p>

                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-slate-200">
                                      🔎 GPT-4o
                                    </span>
                                    <span className="text-slate-300 font-bold">+</span>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-slate-200">
                                      ✍️ GPT-4o
                                    </span>
                                  </div>

                                  {provider === 'openai' && (
                                    <button
                                      type="button"
                                      onClick={() => handleAnalyze("openai")}
                                      className="mt-4 w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors shadow-md flex justify-center items-center gap-2 animate-fade-in-up"
                                    >
                                      <span>Iniciar Análise Rápida</span>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                    </button>
                                  )}
                                </div>

                                <div
                                  onClick={() => setProvider('claude')}
                                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col gap-3 group overflow-hidden cursor-pointer ${
                                    provider === 'claude'
                                      ? 'border-indigo-500 bg-slate-900 shadow-[0_0_30px_rgba(99,102,241,0.2)] ring-4 ring-indigo-500/10'
                                      : 'border-slate-800 bg-slate-950 hover:border-indigo-500/50 hover:bg-slate-900'
                                  }`}
                                >
                                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>

                                  <div className="flex items-center justify-between w-full relative z-10">
                                    <div className="flex items-center gap-2">
                                      <span className="text-2xl">🧠</span>
                                      <span className="text-xl font-black text-white tracking-tight">Auditoria Profunda</span>
                                    </div>
                                    {provider === 'claude' && (
                                      <span className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_10px_rgba(129,140,248,0.8)]"></span>
                                    )}
                                  </div>
                                  
                                  <p className="text-sm font-medium text-indigo-200/60 leading-relaxed relative z-10">
                                    Motor de raciocínio para cruzamento de leis e redação jurídica cirúrgica. Entrega em ~30 seg.
                                  </p>

                                  <div className="flex flex-wrap items-center gap-2 mt-1 relative z-10">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-black text-indigo-300 uppercase tracking-wider shadow-inner">
                                      🔎 O3-MINI
                                    </span>
                                    <span className="text-indigo-500/50 font-bold">+</span>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-black text-indigo-300 uppercase tracking-wider shadow-inner">
                                      ✍️ CLAUDE 3.5
                                    </span>
                                  </div>

                                  {provider === 'claude' && (
                                    <button
                                      type="button"
                                      onClick={() => handleAnalyze("claude")}
                                      className="mt-4 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] flex justify-center items-center gap-2 relative z-10 animate-fade-in-up"
                                    >
                                      <span>Executar Auditoria Profunda</span>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={isAnalyzing}
                              onClick={() => handleAnalyze("openai")}
                              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white py-5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] relative overflow-hidden group"
                            >
                              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                              <span className="text-2xl relative z-10">⚡</span>
                              <div className="flex flex-col items-start text-left relative z-10">
                                <span className="block leading-tight text-base font-black">Iniciar Análise Estratégica</span>
                                <span className="text-[10px] text-violet-200 font-bold uppercase tracking-widest">Multi-Agente · ~30 segundos</span>
                              </div>
                              <svg className="w-5 h-5 ml-auto relative z-10 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                        </form>
                      </div>
                    </>

                    ) : isAnalyzing ? (
                    <div id="area-loading" className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-12 animate-in fade-in duration-700 relative overflow-hidden">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                      
                      <div className="relative flex flex-col items-center z-10 text-center space-y-8">
                        <div className="animate-pulse transform hover:scale-105 transition-transform duration-500">
                          <Image 
                            src="/logo-bawzi.png" 
                            alt="Bawzi Logo" 
                            width={140} 
                            height={40} 
                            className="object-contain opacity-80"
                            priority
                          />
                        </div>

                        <div className="relative w-16 h-16">
                          <div className="absolute inset-0 border-4 border-violet-50 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-violet-600 rounded-full animate-spin shadow-sm"></div>
                        </div>

                        <div className="relative h-20 max-w-sm w-full">
                          <div 
                            key={loadingStep} 
                            className="absolute inset-0 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-500"
                          >
                            <h3 className="text-xl font-black text-slate-900 tracking-tight text-center">
                              {loadingMessages[loadingStep].title}
                            </h3>
                            <p className="text-sm font-medium text-slate-400 leading-relaxed text-center mt-2">
                              {loadingMessages[loadingStep].desc}
                            </p>
                          </div>
                        </div>

                        <div className="pt-4 flex flex-col items-center gap-6">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                            Neural Routing Ativado
                          </span>
                          
                          <button 
                            onClick={handleCancelAnalysis}
                            className="group flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition-all shadow-sm active:scale-95"
                          >
                            <span className="text-lg group-hover:rotate-90 transition-transform">✖</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Cancelar Processamento</span>
                          </button>
                        </div>
                      </div>
                    </div>

                  ) : result ? (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative animate-in fade-in duration-500 font-sans" id="area-resultados">
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

                        {/* TÍTULO E BOTÕES DE AÇÃO GLOBAIS */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 print:hidden">
                          <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Painel de Decisão</h2>
                            <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-widest border border-slate-200">
                              {termoAlvo || "Visão Global"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 w-full md:w-auto"> 
                            <button onClick={() => window.print()} className="px-4 py-2 hover:bg-slate-50 text-slate-600 font-bold rounded-lg border border-slate-200 transition-colors text-sm flex items-center justify-center gap-2">
                              🖨️ <span className="hidden sm:inline">Imprimir</span>
                            </button>
                            {token && analysisId && (
                                <button onClick={handleShare} disabled={isSharing} className="px-4 py-2 hover:bg-violet-50 text-violet-700 font-bold rounded-lg border border-violet-200 transition-colors text-sm flex items-center justify-center gap-2">
                                  {isSharing ? 'A Enviar...' : '📧 Partilhar'}
                                </button>
                            )}
                            <button onClick={handleResetAnalysis} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                              Nova Análise
                            </button>
                          </div>
                        </div>

                        {/* BARRA DE ABAS (TABS) */}
                        <div className="flex flex-wrap gap-3 mb-8 border-b border-slate-200 pb-4 print:hidden">
                          <button 
                            onClick={() => setActiveTab('analise')}
                            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all duration-300 ${
                              activeTab === 'analise' 
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 ring-1 ring-slate-900' 
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200'
                            }`}
                          >
                            <ScanSearch size={18} className={activeTab === 'analise' ? 'text-indigo-400' : 'text-slate-400'} />
                            Raio-X do Edital
                          </button>

                          <button 
                            onClick={() => setActiveTab('concorrentes')}
                            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all duration-300 ${
                              activeTab === 'concorrentes' 
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 ring-1 ring-slate-900' 
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200'
                            }`}
                          >
                            <Radar size={18} className={activeTab === 'concorrentes' ? 'text-rose-400' : 'text-slate-400'} />
                            Radar de Concorrentes
                          </button>
                        </div>

                        {/* ========================================================================= */}
                        {/* 🟢 CONTEÚDO DA ABA 1: O RELATÓRIO DA IA */}
                        {/* ========================================================================= */}
                        {((activeTab as string) === 'analise' || (activeTab as string) === 'workspace') && (
                          <div className="space-y-8 animate-in fade-in duration-500">

                            {/* ━━━ BANNER: EDITAL EXPIRADO ━━━ */}
                            {(() => {
                              if (!result.datas_criticas || result.datas_criticas.length === 0) return null;
                              const agora = new Date();
                              // Detecta se alguma data crítica principal está no passado
                              const labelsChave = ['abertura', 'proposta', 'recebimento', 'encerramento'];
                              const dataExpirada = result.datas_criticas.find(dc => {
                                if (!dc.data_iso) return false;
                                const isChave = labelsChave.some(k => dc.label.toLowerCase().includes(k));
                                return isChave && new Date(dc.data_iso) < agora;
                              });
                              if (!dataExpirada) return null;
                              const formatted = new Date(dataExpirada.data_iso!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                              return (
                                <div className="flex items-start gap-4 bg-red-950 border border-red-800 rounded-2xl px-6 py-4">
                                  <span className="text-2xl shrink-0 mt-0.5">🚫</span>
                                  <div>
                                    <p className="text-sm font-black text-red-300 uppercase tracking-widest mb-0.5">Prazo de Participação Encerrado</p>
                                    <p className="text-xs font-medium text-red-400 leading-relaxed">
                                      A <strong className="text-red-300">{dataExpirada.label}</strong> ocorreu em <strong className="text-red-300">{formatted}</strong>. Este edital já não aceita propostas — a análise serve apenas para referência histórica ou estudo de mercado.
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* SCORE E DATAS CRÍTICAS */}
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-14 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-8 print:border-none print:p-0">
                              <div className="flex items-center gap-6">
                                <div className="relative w-24 h-24 shrink-0">
                                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="42" className="stroke-slate-200" strokeWidth="6" fill="none" />
                                    <circle 
                                      cx="50" cy="50" r="42" 
                                      className={`transition-all duration-1000 ease-out ${
                                        result.score >= 70 ? 'stroke-emerald-500' : 
                                        result.score >= 45 ? 'stroke-amber-500' : 
                                        'stroke-red-500'
                                      }`} 
                                      strokeWidth="6" fill="none" strokeLinecap="round"
                                      style={{ strokeDasharray: 264, strokeDashoffset: 264 - (264 * result.score) / 100 }} 
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{result.score}</span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bawzi Score</p>
                                  <h3 className={`text-lg font-black uppercase tracking-widest ${getScoreColor(result.score)}`}>
                                    {result.classification}
                                  </h3>
                                  {result.pricing_intelligence?.financial_verdict && (
                                    <p className="text-sm text-slate-600 font-medium mt-1 max-w-sm">
                                      {result.pricing_intelligence.financial_verdict}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              {(() => {
                                // Prefer new datas_criticas array; fall back to legacy object
                                if (result.datas_criticas && result.datas_criticas.length > 0) {
                                  const visible = result.datas_criticas.filter(d => d.data_iso).slice(0, 3);
                                  if (visible.length === 0) return null;
                                  return (
                                    <div className="flex flex-col gap-3 pl-0 md:pl-8 border-t md:border-t-0 md:border-l border-slate-200 w-full md:w-auto pt-6 md:pt-0">
                                      {visible.map((dc, i) => {
                                        const date = dc.data_iso ? new Date(dc.data_iso) : null;
                                        const fmt = date ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : dc.data_iso;
                                        return (
                                          <div key={i}>
                                            <span className={`block text-[10px] font-black uppercase tracking-widest ${dc.urgente ? 'text-red-500' : 'text-slate-400'}`}>
                                              {dc.urgente ? '⚡ ' : ''}{dc.label}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900">{fmt}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                // Legacy fallback
                                const d = result?.datas_criticas_extraidas;
                                const propostas = String(d?.data_limite_propostas || "").trim();
                                const impugnacao = String(d?.data_impugnacao || "").trim();
                                const isValida = (t: string) => !!t && !t.toLowerCase().includes("não") && !t.toLowerCase().includes("n/a") && !t.toLowerCase().includes("informad") && !t.toLowerCase().includes("localizad");
                                const propValida = isValida(propostas) ? propostas : null;
                                const impValida = isValida(impugnacao) ? impugnacao : null;
                                if (!propValida && !impValida) return null;
                                return (
                                  <div className="flex flex-col gap-3 pl-0 md:pl-8 border-t md:border-t-0 md:border-l border-slate-200 w-full md:w-auto pt-6 md:pt-0">
                                    {propValida && <div><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo de Propostas</span><span className="text-sm font-bold text-slate-900">📅 {propValida}</span></div>}
                                    {impValida && <div><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Limite Impugnação</span><span className="text-sm font-bold text-slate-900">🚨 {impValida}</span></div>}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* ━━━ SEMÁFORO DE VIABILIDADE ━━━ */}
                            <div className="relative border border-slate-200 rounded-2xl p-8 mb-8">
                              <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                                <span className="text-lg">🚦</span>
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Semáforo de Viabilidade</h3>
                              </div>
                              {result.semaforo ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                  {([
                                    { key: 'tecnica' as const, label: 'Técnica', icon: '⚙️' },
                                    { key: 'financeira' as const, label: 'Financeira', icon: '💰' },
                                    { key: 'juridica' as const, label: 'Jurídica', icon: '⚖️' },
                                    { key: 'documentacao' as const, label: 'Documentação', icon: '📁' },
                                  ]).map(({ key, label, icon }) => {
                                    const sinal = result.semaforo![key];
                                    if (!sinal) return null;
                                    const cfg: Record<string, { bg: string; border: string; dot: string; txt: string; lbl: string }> = {
                                      ok: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', txt: 'text-emerald-700', lbl: 'OK' },
                                      alerta: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', txt: 'text-amber-700', lbl: 'ALERTA' },
                                      risco: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', txt: 'text-red-700', lbl: 'RISCO' },
                                    };
                                    const s = cfg[sinal.status] ?? { bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-400', txt: 'text-slate-600', lbl: sinal.status };
                                    return (
                                      <div key={key} className={`${s.bg} ${s.border} border rounded-xl p-4 flex flex-col gap-2`}>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xl">{icon}</span>
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
                                  <span className="text-3xl shrink-0">✨</span>
                                  <div>
                                    <p className="text-sm font-black text-slate-700">Nova análise necessária</p>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">Execute uma nova análise para ativar o Semáforo de Viabilidade — avaliação automática nos eixos <strong>Técnica · Financeira · Jurídica · Documentação</strong>.</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* ━━━ CRONOGRAMA CRÍTICO ━━━ */}
                            <div className="relative border border-slate-200 rounded-2xl p-8 mb-8">
                              <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                                <span className="text-lg">📅</span>
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Cronograma Crítico</h3>
                              </div>
                              {result.datas_criticas === undefined ? (
                                // Campo ausente → análise antiga, anterior à actualização
                                <div className="mt-4 flex items-center gap-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5">
                                  <span className="text-3xl shrink-0">📆</span>
                                  <div>
                                    <p className="text-sm font-black text-slate-700">Análise desatualizada</p>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">Esta análise foi gerada antes da atualização do cronograma. Execute uma nova análise para ativar os alertas de prazo automáticos.</p>
                                  </div>
                                </div>
                              ) : result.datas_criticas.length === 0 ? (
                                // LLM analisou mas não encontrou datas no documento
                                <div className="mt-4 flex items-center gap-4 bg-amber-50 border border-dashed border-amber-200 rounded-xl p-5">
                                  <span className="text-3xl shrink-0">🔍</span>
                                  <div>
                                    <p className="text-sm font-black text-amber-800">Datas não identificadas</p>
                                    <p className="text-xs text-amber-700 font-medium mt-0.5 leading-relaxed">O documento não continha datas de prazo explícitas. Consulte diretamente o edital para verificar os prazos de proposta e impugnação.</p>
                                  </div>
                                </div>
                              ) : (
                                // Tem entradas — mostrar todas, com ou sem data_iso
                                <div className="relative mt-2">
                                  <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />
                                  <div className="space-y-4">
                                    {result.datas_criticas.map((dc, i) => {
                                      const agora = new Date();
                                      const date = dc.data_iso ? new Date(dc.data_iso) : null;
                                      const expirado = date ? date < agora : false;
                                      const urgenteFuturo = date ? (!expirado && dc.urgente) : false;
                                      const formatted = date
                                        ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : 'Data não informada no edital';
                                      return (
                                        <div key={i} className="relative flex items-start gap-4 pl-12">
                                          <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center text-sm shrink-0 z-10 border-2 ${
                                            !date ? 'bg-slate-100 border-slate-200 text-slate-400' :
                                            expirado ? 'bg-slate-300 border-slate-200 text-slate-500' :
                                            urgenteFuturo ? 'bg-red-500 border-red-300 text-white' :
                                            'bg-white border-slate-300 text-slate-500'
                                          }`}>
                                            {!date ? '❓' : expirado ? '⏰' : urgenteFuturo ? '🚨' : '📌'}
                                          </div>
                                          <div className={`flex-1 p-4 rounded-xl border transition-all ${
                                            !date ? 'bg-slate-50 border-dashed border-slate-200' :
                                            expirado ? 'bg-slate-50 border-slate-200 opacity-60' :
                                            urgenteFuturo ? 'bg-red-50 border-red-200' :
                                            'bg-slate-50 border-slate-100'
                                          }`}>
                                            <div className="flex items-center justify-between gap-2">
                                              <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                !date ? 'text-slate-400' :
                                                expirado ? 'text-slate-400 line-through' :
                                                urgenteFuturo ? 'text-red-600' : 'text-slate-500'
                                              }`}>{dc.label}</p>
                                              {expirado && (
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">EXPIRADO</span>
                                              )}
                                              {urgenteFuturo && (
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-red-500 text-white px-2 py-0.5 rounded-full">URGENTE</span>
                                              )}
                                            </div>
                                            <p className={`text-sm font-bold mt-0.5 ${
                                              !date ? 'text-slate-400 italic' :
                                              expirado ? 'text-slate-400 line-through' : 'text-slate-900'
                                            }`}>{formatted}</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* RESUMO EXECUTIVO */}
                            <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
                              <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                                <span className="text-lg">🎯</span>
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Resumo Executivo</h3>
                              </div>
                              <div className="text-slate-700 text-sm md:text-base leading-relaxed space-y-4 font-medium whitespace-pre-line mt-2">
                                {result.summary}
                              </div>
                            </div>

                            {/* SIMULADOR TÁTICO GLOBAL (METAS DA DIRETORIA) */}
                            {result.pricing_intelligence && (
                                <div className="space-y-4 print:hidden mb-12">
                                  <TacticalSimulator 
                                    pricing={result.pricing_intelligence} 
                                    fullResult={result} 
                                    userTier={userTier} 
                                  />
                                </div>
                            )}

                            {/* SWOT & CARGA OPERACIONAL */}
                            {((result.exigencias_criticas && result.exigencias_criticas.length > 0) || (result.documentos_necessarios && result.documentos_necessarios.length > 0) || (result.vantagens && result.vantagens.length > 0) || (result.desvantagens && result.desvantagens.length > 0)) && (
                              <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
                                <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                                  <span className="text-lg">📋</span>
                                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Carga Operacional & SWOT</h3>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 mt-2">
                                  {result.vantagens && result.vantagens.length > 0 && (
                                    <div>
                                      <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">👍 Vantagens (Por que avançar?)</h4>
                                      <ul className="space-y-3">
                                          {result.vantagens.map((v: string, i: number) => <li key={i} className="text-sm text-slate-700 font-medium flex gap-2"><span className="text-emerald-500">＋</span> {v}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {result.desvantagens && result.desvantagens.length > 0 && (
                                    <div>
                                      <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4">👎 Barreiras (Por que recuar?)</h4>
                                      <ul className="space-y-3">
                                          {result.desvantagens.map((d: string, i: number) => <li key={i} className="text-sm text-slate-700 font-medium flex gap-2"><span className="text-orange-500">−</span> {d}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {result.exigencias_criticas && result.exigencias_criticas.length > 0 && (
                                    <div>
                                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">📌 Exigências Críticas</h4>
                                      <ul className="space-y-3">
                                          {result.exigencias_criticas.map((e: string, i: number) => <li key={i} className="text-sm text-slate-700 font-medium flex items-center gap-2"><div className="w-1 h-1 bg-slate-400 rounded-full shrink-0"></div> {e}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                  {result.documentos_necessarios && result.documentos_necessarios.length > 0 && (
                                    <div>
                                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">📁 Documentação Necessária</h4>
                                      <ul className="space-y-3">
                                          {result.documentos_necessarios.map((doc: string, i: number) => <li key={i} className="text-sm text-slate-700 font-medium flex items-center gap-2"><div className="w-1 h-1 bg-slate-400 rounded-full shrink-0"></div> {doc}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* ━━━ MATRIZ DE RISCOS (RANQUEADOS POR IMPACTO) ━━━ */}
                            <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
                              <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                                <span className="text-lg">⚠️</span>
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Matriz de Riscos</h3>
                              </div>
                              {result.risks && result.risks.length > 0 ? (
                                <div className="space-y-3 mt-2">
                                  {[...result.risks]
                                    .sort((a, b) => {
                                      const order: Record<string, number> = { alto: 0, medio: 1, baixo: 2 };
                                      return (order[a.impacto ?? 'medio'] ?? 1) - (order[b.impacto ?? 'medio'] ?? 1);
                                    })
                                    .map((risk, idx) => {
                                      const impactoCfg: Record<string, { bg: string; border: string; badge: string }> = {
                                        alto: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
                                        medio: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
                                        baixo: { bg: 'bg-slate-50', border: 'border-slate-100', badge: 'bg-slate-100 text-slate-500' },
                                      };
                                      const ic = impactoCfg[risk.impacto ?? 'medio'] ?? impactoCfg['medio'];
                                      const impactoLabel: Record<string, string> = { alto: 'ALTO', medio: 'MÉDIO', baixo: 'BAIXO' };
                                      return (
                                        <div key={idx} className={`${ic.bg} ${ic.border} border rounded-xl p-4`}>
                                          <div className="flex items-start justify-between gap-3 mb-1.5">
                                            <span className="text-sm font-black text-slate-800">{risk.titulo}</span>
                                            <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${ic.badge}`}>
                                              {impactoLabel[risk.impacto ?? 'medio'] ?? (risk.impacto || '—')}
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-600 font-medium leading-relaxed">{risk.descricao}</p>
                                        </div>
                                      );
                                    })}
                                </div>
                              ) : (
                                <div className="mt-4 flex items-center gap-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5">
                                  <span className="text-3xl shrink-0">🛡️</span>
                                  <div>
                                    <p className="text-sm font-black text-slate-700">Nova análise necessária</p>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">Execute uma nova análise para ver a matriz de riscos ranqueada por impacto — <strong>Alto · Médio · Baixo</strong> com fundamentação jurídica.</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* PARECER TÉCNICO-JURÍDICO BAWZI */}
                            {result && (
                              <div className="my-10 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
                                <div className="bg-indigo-900 p-4 border-b border-indigo-800 flex items-center justify-between">
                                  <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                                    <span className="text-xl">⚖️</span> PARECER TÉCNICO-JURÍDICO BAWZI
                                  </h3>
                                  <span className="text-[10px] uppercase tracking-widest text-amber-400 font-black px-2 py-1 bg-amber-400/10 rounded-md border border-amber-400/20">
                                    Agente IA Especialista
                                  </span>
                                </div>

                                {userTier <= 2 ? (
                                  <div className="relative p-6">
                                    <div className="prose prose-slate max-w-none mb-3 opacity-60">
                                      <p className="text-slate-700 text-sm font-medium italic">
                                        "Após análise minuciosa das cláusulas de habilitação técnica e financeira, 
                                        identificamos pontos de atenção..."
                                      </p>
                                    </div>

                                    <div className="absolute inset-0 top-[50px] z-20 flex flex-col items-center justify-center bg-white/50 backdrop-blur-md rounded-b-2xl pb-2">
                                      <div className="bg-slate-900 text-white p-5 md:p-6 rounded-2xl shadow-xl max-w-sm text-center border border-slate-700 mx-4">
                                        <div className="w-12 h-12 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-400/20">
                                          <span className="text-2xl">🔒</span>
                                        </div>
                                        <h4 className="font-black text-lg mb-1.5 text-white">Análise Jurídica Restrita</h4>
                                        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                                          O Parecer Jurídico detalhado (SWOT, risco e fundamentação legal) está disponível apenas para membros <strong className="text-indigo-400 uppercase">Especialistas</strong> e <strong className="text-amber-400 uppercase">Dominadores</strong>.
                                        </p>
                                        <button 
                                          onClick={() => setShowUpgradeModal(true)} 
                                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                                        >
                                          Fazer Upgrade Agora ⚡
                                        </button>
                                      </div>
                                    </div>

                                    <div className="space-y-3 blur-[5px] select-none pointer-events-none opacity-20 mt-2 min-h-[220px]">
                                      <div className="h-3 w-full bg-slate-300 rounded"></div>
                                      <div className="h-3 w-5/6 bg-slate-300 rounded"></div>
                                      <div className="h-3 w-4/6 bg-slate-300 rounded"></div>
                                      <div className="h-16 w-full bg-indigo-50 rounded-xl mt-4"></div>
                                    </div>
                                  </div>
                                ) : (
                                  result.parecer_especialista && (
                                    <div className="p-8 prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-indigo-600">
                                      <div className="whitespace-pre-wrap font-sans leading-relaxed text-sm">
                                        {result.parecer_especialista}
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {/* RACIOCÍNIO ESTRATÉGICO */}
                            <div className="mt-8 pt-6 border-t border-slate-100 print:hidden">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4 text-indigo-400" strokeWidth={2} />
                                Raciocínio Estratégico da IA
                              </h4>
                              <div className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-line bg-slate-50 p-5 rounded-xl border border-slate-100">
                                {result.rationale || result.recommendation || "Sem dados estratégicos."}
                              </div>
                            </div>

                            {/* ROADMAP / CHECKLIST */}
                            {result.checklist && result.checklist.length > 0 && (
                              <div className="relative border border-slate-200 rounded-2xl p-8 mt-12 print:hidden">
                                <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                                  <span className="text-lg">✅</span>
                                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Roadmap de Execução</h3>
                                </div>
                                
                                <div className="space-y-3 mt-2">
                                  {result.checklist.map((item: any, idx: number) => {
                                    const tarefa = item.tarefa || item.descricao || item;
                                    const fase = item.fase || "Preparação";
                                    const impacto = item.impacto || "Importante";
                                    
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
                            )}

                            {/* EXPORTAR PARECER PDF */}
                            <PremiumLock
                              isLocked={currentTier < 4}
                              featureTitle="Minuta de Parecer Técnico-Jurídico (PDF)"
                              requiredTierName="Nível 4 (Dominador)"
                              onUpgradeClick={() => setShowUpgradeModal(true)}
                            >
                              <div className="relative bg-slate-950 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mt-4 overflow-hidden">
                                {/* Fundo decorativo */}
                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.15),_transparent_60%)] pointer-events-none" />

                                <div className="flex items-start gap-5 flex-1 relative z-10">
                                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-2xl">
                                    ⚖️
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md">Exclusivo Dominador</span>
                                    </div>
                                    <h3 className="font-black text-white text-xl tracking-tight mb-2 leading-tight">Minuta de Parecer Técnico-Jurídico</h3>
                                    <p className="text-sm font-medium text-slate-400 leading-relaxed mb-4 max-w-lg">
                                      Documento formal gerado pela IA Bawzi com fundamentação na <strong className="text-slate-300">Lei 14.133/2021</strong>. Pronto para anexar a impugnações, recursos administrativos ou dossiês internos.
                                    </p>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                      {["Semáforo de Viabilidade", "Matriz de Riscos", "Cronograma Crítico", "Parecer Especialista", "Recomendação Final"].map(item => (
                                        <span key={item} className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 rounded-lg">✓ {item}</span>
                                      ))}
                                    </div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                      <span className="text-amber-400 text-sm">⚠️</span>
                                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Minuta — requer validação por advogado habilitado</span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={handleExportPDF}
                                  className="relative z-10 w-full md:w-auto px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-violet-900/40 active:scale-95 flex items-center justify-center gap-3 shrink-0"
                                >
                                  <span className="text-lg">📄</span> Gerar Minuta (PDF)
                                </button>
                              </div>
                            </PremiumLock>

                            {/* LAYOUT DE IMPRESSÃO */}
                            <div className="hidden print:block bg-white p-10 font-serif text-slate-900 leading-relaxed text-sm">
                              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                                <h1 className="text-2xl font-black uppercase">Bawzi Intelligence</h1>
                                <p className="font-bold text-slate-500 uppercase">Parecer Técnico-Jurídico Preliminar</p>
                              </div>
                              <div className="bg-slate-100 p-4 mb-6 border-l-4 border-slate-900">
                                <p className="font-bold text-xs">⚠️ Nota de Responsabilidade: Este rascunho foi gerado por IA para facilitar a triagem. A revisão e validação por um profissional da área jurídica é indispensável.</p>
                              </div>
                              <div className="space-y-6">
                                <section>
                                  <h3 className="font-bold border-b border-slate-200 mb-2">1. Resumo da Análise</h3>
                                  <p>{result.summary}</p>
                                </section>
                                <section>
                                  <h3 className="font-bold border-b border-slate-200 mb-2">2. Fundamentação e Riscos</h3>
                                  <p className="whitespace-pre-wrap">{result.parecer_especialista || result.rationale || "Sem riscos críticos identificados."}</p>
                                </section>
                                <section>
                                  <h3 className="font-bold border-b border-slate-200 mb-2">3. Conclusão Estratégica</h3>
                                  <p>Veredito da Análise: <strong>{result.classification}</strong> (Score: {result.score}/100)</p>
                                </section>
                              </div>
                              <div className="mt-20 pt-10 border-t border-slate-300 flex flex-col items-center">
                                <div className="w-64 h-px bg-slate-900 mb-2"></div>
                                <p className="font-bold uppercase text-xs">Validação Jurídica (Assinatura)</p>
                                <p className="text-xs mt-1">OAB/UF nº _________</p>
                              </div>
                            </div>

                            {/* RODAPÉ METADADOS */}
                            <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium print:hidden">
                              <div className="flex items-center gap-2">
                                <span>Gerado por:</span>
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold uppercase tracking-widest">{modelSource || 'Motor Bawzi IA'}</span>
                              </div>
                              {isCachedResult && (
                                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                  <span className="text-sm">⚡</span>
                                  <span className="font-bold uppercase tracking-widest text-[10px]">Recuperado do Cache</span>
                                </div>
                              )}
                            </div>

                          </div>
                        )}

                        {/* ========================================================================= */}
                        {/* 🟢 CONTEÚDO DA ABA 2: O WAR ROOM (Inteligência Ofensiva Nível 4)        */}
                        {/* ========================================================================= */}
                        {(activeTab as string) === 'concorrentes' && (
                          <div className="animate-in fade-in zoom-in-95 duration-500 mt-8">
                            <PremiumLock 
                              isLocked={Math.max(userTier, typeof window !== 'undefined' ? Number(localStorage.getItem('bawzi_tier') || 1) : 1) < 4} 
                              featureTitle="War Room (Inteligência Ofensiva)" 
                              requiredTierName="Nível 4 (Dominador)" 
                              onUpgradeClick={() => setShowUpgradeModal(true)}
                            >
                              <CompetitorWarRoom 
                                competitorsNacionais={result.concorrentes_provaveis || []} 
                                competitorsRegionais={result.concorrentes_regionais || []}
                                uf={result.uf || "GO"}
                                pricing={result.pricing_intelligence || {}}
                                analysisId={analysisId || ''}
                                userTier={userTier}
                                fullResult={result} 
                              />
                            </PremiumLock>
                          </div>
                        )}

                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* ========================================================================= */}
              {/* 🟢 O SEU TRECHO ENTRA DAQUI PARA BAIXO (EXATAMENTE COMO VOCÊ MANDOU)        */}
              {/* ========================================================================= */}
              {/* ABA DE RENOVAÇÕES */}
              {activeTab === 'renovacoes' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <ContratosVencendo
                    token={token ?? ''}
                    companies={userData?.companies?.length > 0
                      ? userData.companies
                      : userData?.company ? [userData.company] : []}
                    defaultUf={userData?.company?.uf || ''}
                  />
                </div>
              )}

              {/* ABA DE HISTÓRICO */}
              {activeTab === 'history' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-8">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-amber-100">📚</div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">O Teu Histórico</h2>
                    </div>
                    <p className="text-slate-500 text-sm font-medium ml-16">Recupera estratégias de editais que já analisaste.</p>
                  </div>

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
                        setText(analiseAntiga.raw_text || ""); 
                        setActiveTab('workspace');
                        setTimeout(() => {
                          document.getElementById('area-submissao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }} 
                    />
                  ) : (
                    <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center shadow-sm">
                      <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-slate-100 shadow-inner">
                        🕵️
                      </div>
                      <h3 className="text-lg font-black text-slate-800 mb-2">Modo Anónimo</h3>
                      <p className="text-slate-500 font-medium mb-6">
                        Inicie sessão para ativar o histórico de editais e aceder ao Matchmaker de CNAE.
                      </p>
                      <button 
                        onClick={() => {
                          setAuthMode('login');
                          setShowAuthModal(true);
                        }} 
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-md"
                      >
                        Entrar na Conta
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SIDEBAR DIREITA */}
            <div className="flex flex-col gap-6 sticky top-28 print:hidden">
              <div className="flex flex-col gap-3 mb-2 p-2 bg-slate-100/50 rounded-[2rem] border border-slate-200/50">

                {/* ── Cabeçalho sidebar: perfil + sino ─────────────────── */}
                {token && userData && (
                  <div className="flex items-center justify-between px-3 pt-1 pb-0">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm">
                        {(userData.name || userData.nome || 'B').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] font-black text-slate-700 truncate max-w-[90px]">
                        {(userData.name || userData.nome || '').split(' ')[0]}
                      </span>
                    </div>
                    <NotificationPanel
                      token={token ?? ''}
                      onNavigate={(tab) => setActiveTab(tab)}
                      onCountChange={setNotifCount}
                    />
                  </div>
                )}

                <button onClick={() => setActiveTab('workspace')} className={`py-4 px-6 rounded-2xl font-black transition-all flex items-center justify-between group ${activeTab === 'workspace' || activeTab === 'analise' || activeTab === 'concorrentes' ? 'bg-white text-slate-900 shadow-md border border-slate-200/60' : 'text-slate-500 hover:bg-white/60'}`}>
                  <span className="flex items-center gap-3"><span className="text-xl grayscale group-hover:grayscale-0 transition-all">⚡</span> Nova Análise</span>
                  {(activeTab === 'workspace' || activeTab === 'analise' || activeTab === 'concorrentes') && <span className="w-2 h-2 rounded-full bg-violet-500"></span>}
                </button>
                <button onClick={() => setActiveTab('history')} className={`py-4 px-6 rounded-2xl font-black transition-all flex items-center justify-between group ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-md border border-slate-200/60' : 'text-slate-500 hover:bg-white/60'}`}>
                  <span className="flex items-center gap-3"><span className="text-xl grayscale group-hover:grayscale-0 transition-all">📚</span> O Meu Histórico</span>
                  {activeTab === 'history' && <span className="w-2 h-2 rounded-full bg-violet-500"></span>}
                </button>
                {token && userData && (userData.companies?.length > 0 || userData.company) && (
                  <button onClick={() => setActiveTab('renovacoes')} className={`py-4 px-6 rounded-2xl font-black transition-all flex items-center justify-between group ${activeTab === 'renovacoes' ? 'bg-white text-slate-900 shadow-md border border-slate-200/60' : 'text-slate-500 hover:bg-white/60'}`}>
                    <span className="flex items-center gap-3"><span className="text-xl grayscale group-hover:grayscale-0 transition-all">🔔</span> Renovações</span>
                    {activeTab === 'renovacoes' && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                  </button>
                )}
              </div>

              {token && userData ? (
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span> 
                    Identidade Estratégica
                  </h3>
                  <div className="space-y-4">
                     <UserProfileCard 
                        user={userData} 
                        currentTier={currentTier} 
                      />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-200 to-slate-300"></div>
                  <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-3xl group-hover:scale-110 transition-transform shadow-inner">🕵️</div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">Modo Anónimo</h3>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed font-medium">Inicie sessão para ativar o Matchmaker de CNAE e salvar análises.</p>
                  <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className="w-full py-3.5 bg-slate-100 text-slate-900 font-black rounded-xl hover:bg-slate-200 transition-colors active:scale-95 border border-slate-200">
                    Entrar na Conta
                  </button>
                </div>
              )}
              
              {currentTier < 3 && (
              <div className="bg-slate-950 rounded-[2.5rem] p-8 text-white shadow-2xl border border-slate-800 relative overflow-hidden group">
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-violet-600/20 blur-[50px] rounded-full pointer-events-none group-hover:bg-violet-600/30 transition-colors duration-700"></div>
                <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-600/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-emerald-600/20 transition-colors duration-700"></div>
                
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8 relative z-10 flex items-center gap-3">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
                  </span>
                  Metodologia Neural Bawzi
                </h4>
                
                <ul className="space-y-8 relative z-10">
                  <li className="flex items-start gap-5 group/item">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-xs font-black text-violet-400 group-hover/item:border-violet-500 group-hover/item:bg-violet-500/10 transition-all duration-300">01</div>
                    <div className="space-y-1">
                      <strong className="text-white block text-sm font-black tracking-tight group-hover/item:text-violet-300 transition-colors">Veredito Go/No-Go</strong> 
                      <p className="text-slate-400 text-xs leading-relaxed font-medium">Cálculo probabilístico de lucro e viabilidade real para evitar "barcas furadas".</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-5 group/item">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-xs font-black text-amber-400 group-hover/item:border-amber-500 group-hover/item:bg-amber-500/10 transition-all duration-300">02</div>
                    <div className="space-y-1">
                      <strong className="text-white block text-sm font-black tracking-tight group-hover/item:text-amber-300 transition-colors">Blindagem Jurídico-Financeira</strong> 
                      <p className="text-slate-400 text-xs leading-relaxed font-medium">Identificação imediata de multas abusivas, prazos irreais e armadilhas contratuais.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-5 group/item">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-xs font-black text-emerald-400 group-hover/item:border-emerald-500 group-hover/item:bg-emerald-500/10 transition-all duration-300">03</div>
                    <div className="space-y-1">
                      <strong className="text-white block text-sm font-black tracking-tight group-hover/item:text-emerald-300 transition-colors">Neural Matchmaker</strong> 
                      <p className="text-slate-400 text-xs leading-relaxed font-medium">Cruzamento semântico entre o objeto do edital e o seu CNAE/Capacidade Técnica.</p>
                    </div>
                  </li>
                </ul>

                <div className="mt-10 pt-6 border-t border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter italic">
                    * Análise processada via Multi-LLM Routing (GPT-4o / Claude 3.5)
                  </p>
                </div>
              </div>
              )}
            </div>
          </div>
        </section>

        <section id="planos" className="bg-white py-24 px-6 border-t border-slate-100 print:hidden">
          <div className="max-w-[1400px] mx-auto">
            <div className="text-center mb-16">
              <span className="text-violet-700 bg-violet-50 px-5 py-2 rounded-full font-black uppercase text-xs tracking-widest">Transparência e Escala</span>
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

      {/* --- MODAIS --- */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        defaultView={authMode}
        onSuccess={() => {
          window.location.reload(); 
        }}
      />
      
      {showShareModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 to-indigo-600"></div>
            <button onClick={() => setShowShareModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors text-2xl font-bold bg-slate-50 w-8 h-8 rounded-full flex items-center justify-center">&times;</button>
            
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center text-3xl mb-6 border border-violet-100">📧</div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Enviar para C-Level</h2>
              <p className="text-slate-500 text-sm mt-2 px-4 font-medium leading-relaxed">Partilhe esta análise estratégica diretamente com os tomadores de decisão da sua empresa.</p>
            </div>

            <div className="space-y-4">
              <input type="email" placeholder="E-mail do destinatário..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none bg-slate-50 transition-all font-bold text-slate-700" />
              <button onClick={confirmShare} disabled={isSharing} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl hover:bg-violet-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                {isSharing ? 'A enviar...' : 'Enviar Relatório Estratégico 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImpugnacaoModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2rem] flex flex-col shadow-2xl relative overflow-hidden">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center text-xl shadow-inner">⚖️</div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-none">Peça de Impugnação</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gerado pela Bawzi Legal AI</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(impugnacaoText);
                    alert("Documento copiado para a área de transferência!");
                  }} 
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition-colors border border-slate-200 shadow-sm"
                >
                  📋 Copiar Texto
                </button>
                <button onClick={() => setShowImpugnacaoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-red-100 hover:text-red-600 transition-colors">
                  ✖
                </button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 bg-slate-100/50">
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-8 max-w-3xl mx-auto font-serif text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                {impugnacaoText}
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-slate-100 text-center">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                * Revisão humana obrigatória. Preencha as lacunas com os dados da sua empresa antes de protocolar no órgão.
              </p>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={async () => {
          setShowUpgradeModal(false);
          setStripeSecret(null); 
          
          const currentToken = localStorage.getItem('bawzi_token');
          if (currentToken) {
            try {
              const res = await fetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
              });
              const data = await res.json();
              if (res.ok && data.tier !== undefined) {
                localStorage.setItem('user_tier', String(data.tier));
                localStorage.setItem('bawzi_tier', String(data.tier));
                window.location.reload(); 
              }
            } catch (e) {
              console.error("Erro no sync após fechar modal", e);
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
              <div className="absolute inset-0 border-4 border-violet-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-violet-600 rounded-full border-t-transparent animate-spin"></div>
              <Lock className="absolute inset-0 m-auto text-violet-600" size={24} />
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