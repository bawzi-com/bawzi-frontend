'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchUserProfile } from '../services/api';
import CompanyProfileForm from './CompanyProfileForm';
import Image from 'next/image';
import UserProfileCard from './UserProfileCard';
import BawziShadowSimulator from '../components/BawziShadowSimulator';
import HistoryTab from './HistoryTab';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PricingSection from './PricingSection';
import PncpSearch from '../components/PncpSearch';
import UpgradeModal from './UpgradeModal';
import { useTierConfig } from '../Contexts/TierContext';
import ThreatRadar from './ThreatRadar';

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
  datas_criticas_extraidas?: {
    data_limite_propostas?: string;
    data_impugnacao?: string;
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
  risks?: any[]; 
  checklist?: any[]; 
  pricing_intelligence?: PricingIntelligence;
  orgao_risk?: any; 
  created_at?: string;
  parecer_especialista?: string;
  pegadinha?: PegadinhaData;
}

interface CndDetail {
  orgao: string;
  status: string;
  vencimento: string;
}

interface CndData {
  cnpj: string;
  risco_geral: string;
  certidoes_pendentes: number;
  detalhes: CndDetail[];
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
  const num = Number(val.toString().replace(/[^\d,-]/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function AnalysisApp() {
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // 🟢 1. ESTADOS PRINCIPAIS
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uf, setUf] = useState('');
  const [forceExact, setForceExact] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelSource, setModelSource] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<number>(-1);
  const [userData, setUserData] = useState<any>(null);

  const [activeTab, setActiveTab] = useState('workspace');
  const [hasUsedFreeTrial, setHasUsedFreeTrial] = useState(false);
  const [isCachedResult, setIsCachedResult] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [termoAlvo, setTermoAlvo] = useState('');
  const [pncpData, setPncpData] = useState<{cnpj: string, ano: number, sequencial: number} | null>(null);
  
  // Modais de Autenticação e Upsell
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', cnpj: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Estados de Partilha
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');

  // 🟢 2. PUXA OS LIMITES GLOBAIS DO TIER CONTEXT
  const { tierLimits, tierFileLimits } = useTierConfig();

  // 🟢 3. LÓGICA DE VALIDAÇÃO
  const currentCharLimit = tierLimits[userTier] || 10000;
  const currentChars = text.length; 
  const currentFileLimitMB = tierFileLimits[userTier] || 3;
  const currentFileLimitBytes = currentFileLimitMB * 1024 * 1024;
  const totalFileSize = files.reduce((acc, file) => acc + file.size, 0);

  const isOverTextLimit = currentChars > currentCharLimit;
  const isOverFileLimit = totalFileSize > currentFileLimitBytes;
  const isOverLimit = isOverTextLimit || isOverFileLimit;
  const requiresAuth = (!token) && (hasUsedFreeTrial);

  // ==========================================
  // ESTADOS DO RADAR FISCAL (CND)
  // ==========================================
  const [cndData, setCndData] = useState<CndData | null>(null);
  const [isLoadingCnd, setIsLoadingCnd] = useState(false);

  // ==========================================
  // ESTADOS DE ANIMAÇÃO DE CARREGAMENTO
  // ==========================================
  const [loadingStep, setLoadingStep] = useState(0);

const loadingMessages = [
    { 
      title: "A Orquestrar Swarm de Agentes", 
      desc: "A instanciar modelos neurais especializados (Jurídico, Financeiro e Estratégico) para análise simultânea do edital..." 
    },
    { 
      title: "Agente Jurídico em Operação", 
      desc: "A varrer as entrelinhas do documento à procura de multas ocultas, SLAs abusivos e riscos de inabilitação..." 
    },
    { 
      title: "Agente Financeiro a Calcular", 
      desc: "A cruzar o seu termo alvo com o histórico do PNCP para encontrar a margem exata de deságio predatório..." 
    },
    { 
      title: "Agente de Mercado a Rastrear", 
      desc: "A mapear o ecossistema da região para antecipar o comportamento e a agressividade dos concorrentes locais..." 
    },
    { 
      title: "A Consolidar Veredito do Comitê", 
      desc: "Os agentes estão a fundir os dados para emitir a matriz de decisão final (Go/No-Go). A gerar Dossiê Elite..." 
    }
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

  useEffect(() => {
    const initializeData = async () => {
      const savedToken = localStorage.getItem('bawzi_token');
      if (!savedToken) return;

      const urlParams = new URLSearchParams(window.location.search);
      const isSuccessReturn = urlParams.get('success') === 'true';

      const headers = { 
        'Authorization': `Bearer ${savedToken}`,
        'Content-Type': 'application/json'
      };

      // 🟢 FUNÇÃO DE BUSCA REPETITIVA (POLLING)
      const fetchWithRetry = async (attemptsLeft = 5) => {
        try {
          const [userRes, wsRes, companyRes] = await Promise.all([
            fetch(`${API_URL}/api/users/me`, { headers }),
            fetch(`${API_URL}/api/workspace/details`, { headers }),
            fetch(`${API_URL}/api/workspace/company`, { headers }) 
          ]);

          if (userRes.ok && wsRes.ok) {
            const userDataInfo = await userRes.json();
            const wsData = await wsRes.json();
            const companyData = await companyRes.json();

            const currentTier = wsData.tier !== undefined ? wsData.tier : (userDataInfo.tier !== undefined ? userDataInfo.tier : 1);

            // Se o usuário acabou de pagar mas o banco ainda diz Nível 1, tentamos de novo em 2s
            if (isSuccessReturn && currentTier === 1 && attemptsLeft > 0) {
              console.log(`⏳ Aguardando confirmação do pagamento... (Tentativas restantes: ${attemptsLeft})`);
              setTimeout(() => fetchWithRetry(attemptsLeft - 1), 2000);
              return;
            }

            // Se chegamos aqui, ou o nível atualizou ou esgotaram as tentativas
            setUserTier(currentTier);
            localStorage.setItem('bawzi_tier', currentTier.toString());
            window.dispatchEvent(new Event('storage'));

            setUserData({
              ...userDataInfo,
              workspace_users_count: wsData.workspace_users_count,
              vagas_totais: wsData.vagas_totais,
              company: companyData.cnpj ? companyData : userDataInfo.company
            });

            // Limpa a URL se o nível já estiver correto
            if (isSuccessReturn && currentTier > 1) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        } catch (err) {
          console.error("Erro na sincronização:", err);
        }
      };

      fetchWithRetry();
    };

    initializeData();
  }, [API_URL]);

  useEffect(() => {
    const cnpj = userData?.company?.cnpj;
    if (token && cnpj) {
      setIsLoadingCnd(true);
      const cleanCnpj = cnpj.replace(/\D/g, '');
      
      fetch(`${API_URL.replace(/\/$/, '')}/api/company/cnd/${cleanCnpj}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (!data.detail) setCndData(data);
      })
      .catch(err => console.error("Erro ao buscar CNDs:", err))
      .finally(() => setIsLoadingCnd(false));
    }
  }, [userData?.company?.cnpj, token, API_URL]);

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
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAnalyzing]);

  // 🟢 CONTROLADOR DE ABORTO DE REQUISIÇÃO
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Dispara o tiro letal na requisição
    }
    setIsAnalyzing(false);
    setLoadingStep(0);
    setError("Análise cancelada pelo utilizador.");
    setTimeout(() => setError(null), 4000);
  };

  // ==========================================
  // HANDLERS E FUNÇÕES DE AÇÃO
  // ==========================================
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    if (newText.length <= currentCharLimit) {
      setText(newText);
    } else {
      setText(newText.substring(0, currentCharLimit));
      setError(`O limite do seu plano é de ${currentCharLimit.toLocaleString()} caracteres. O texto foi truncado.`);
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

    setIsSharing(true);
    try {
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/analyses/${analysisId}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ target_email: shareEmail })
      });

      if (res.ok) {
        alert("✅ Análise partilhada com sucesso!");
        setShowShareModal(false);
      } else {
        const errorData = await res.json();
        alert(`Erro: ${errorData.detail || 'Falha ao partilhar.'}`);
      }
    } catch (error) {
      alert("❌ Erro de comunicação.");
    } finally {
      setIsSharing(false);
    }
  };

const handleAnalyze = async (motor: "openai" | "claude") => {
    if (requiresAuth) { setAuthMode('register'); setShowAuthModal(true); return; }
    if (!text.trim() && files.length === 0) { setError("Cole o texto ou adicione documentos."); return; }
    
    if (isOverLimit) { 
      setShowUpgradeModal(true); 
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
      }

      const headers: Record<string, string> = {};
      const currentToken = localStorage.getItem('bawzi_token');
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

      const response = await fetch(`${API_URL.replace(/\/$/, '')}/api/analyze`, {
        method: 'POST', 
        headers: headers, 
        body: formData,
        signal: abortControllerRef.current.signal
      });

      if (response.status === 401) {
        alert("Sua sessão expirou por segurança (8 horas). Faça login novamente.");
        logout();
        return;
      }

      // 🟢 O Backend barrou por limite de uso (Estourou a cota)
      if (response.status === 402) {
        setShowUpgradeModal(true);
        setIsAnalyzing(false);     
        return;                    
      }

      const data = await response.json();

      console.log("==== 📥 DEBUG 3: RESPOSTA DO BACKEND ====");
      console.log("JSON recebido:", data);

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
      console.error("Erro na análise:", err);
      
      if (err.name === 'AbortError') {
        console.log("Requisição abortada pelo utilizador.");
        return; 
      }

      // 🟢 MUDANÇA 2: Se o utilizador é anónimo e deu qualquer erro (ex: payload gigante), mostra o modal de conversão em vez de erro!
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

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError(null);
    
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload: any = { ...authForm };
      
      if (!payload.cnpj) delete payload.cnpj; 
      
      if (authMode === 'login') {
         delete payload.name; 
      } else {
         payload.plan = "free"; 
         payload.tier = 1; 
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 422 && Array.isArray(data.detail)) {
          const errorMessages = data.detail.map((err: any) => `O campo '${err.loc[err.loc.length - 1]}' ${err.msg}`).join(' | ');
          throw new Error(`Validação falhou: ${errorMessages}`);
        }
        throw new Error(data.detail || 'Falha na autenticação');
      }

      setToken(data.access_token);
      const userTierToSave = data.tier !== undefined ? data.tier : 1; 
      setUserTier(userTierToSave);
      
      localStorage.setItem('bawzi_token', data.access_token);
      localStorage.setItem('bawzi_tier', userTierToSave.toString());
      localStorage.setItem('bawzi_workspace_id', data.workspace_id);

      router.push('/workspace');
      setShowAuthModal(false);
      window.location.reload(); 
    } catch (err: any) { setAuthError(err.message); } 
    finally { setAuthLoading(false); }
  };

  const handleUpgrade = async (tier: number) => {
    if (!token) { setAuthMode('register'); setShowAuthModal(true); return; }
    try {
      const response = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tier }),
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url; 
    } catch (err) { alert("Erro ao iniciar processo de pagamento."); }
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

const handleGerarImpugnacao = async () => {
  // Vamos usar a lista de riscos (que é o que a IA devolve) ou a pegadinha
  const riscosParaEnviar = result?.risks || [];
  
  if (riscosParaEnviar.length === 0 && !result?.pegadinha) {
      alert("Nenhum risco detectado para impugnar.");
      return;
  }

  setIsGeneratingImpugnacao(true);
  
  try {
    // 1. Aponta para a URL correta e inclui o Token de segurança (boa prática)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL.replace(/\/$/, '')}/api/gerar-impugnacao`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        // 2. Chaves rigorosamente iguais ao modelo Pydantic do backend
        edital_texto: text, 
        riscos_identificados: riscosParaEnviar.length > 0 ? riscosParaEnviar : [result?.pegadinha],
        provedor: modelSource?.toLowerCase().includes("claude") ? "claude" : "openai" 
      })
    });

    const data = await response.json();

    // 3. Lê o retorno correto do backend
    if (response.ok && data.documento_markdown) {
      setImpugnacaoText(data.documento_markdown);
      setShowImpugnacaoModal(true);
    } else {
      throw new Error(data.detail || "Erro ao gerar a peça de impugnação.");
    }
  } catch (error: any) {
    console.error("Erro ao gerar impugnação:", error);
    alert(`Falha: ${error.message}`);
  } finally {
    setIsGeneratingImpugnacao(false);
  }
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
          
          {/* ========================================== */}
          {/* 🚀 MOTOR DE ANIMAÇÕES CSS NATIVAS          */}
          {/* ========================================== */}
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

            {/* ============================================================== */}
            {/* ⬅️ LADO ESQUERDO: 2/3 DA TELA (ORQUESTRAÇÃO DE AGENTES)      */}
            {/* ============================================================== */}
            <div className="xl:w-2/3 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 rounded-[2rem] border border-slate-100 p-8 md:p-12 flex flex-col lg:flex-row items-center gap-10 relative overflow-hidden">
              
              {/* Brilho de Fundo Dinâmico */}
              <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-100/30 blur-[120px] rounded-full -translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

              {/* TEXTO (O Pitch dos Agentes) */}
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
                  Por que depender de uma única IA genérica? A Bawzi divide o contrato e roteia as cláusulas para um time de especialistas. O Jurídico caça riscos, o Financeiro projeta margens e o Compliance blinda a entrega.
                </p>
              </div>

              {/* DIAGRAMA DOS AGENTES (Widescreen Action) */}
              <div className="flex-1 w-full relative h-[320px] hidden lg:flex items-center justify-center z-10">
                
                {/* Documento Central */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-32 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-col items-center justify-center gap-2 z-20">
                  <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
                  <div className="w-16 h-1 bg-slate-200 rounded-full"></div>
                  <div className="w-10 h-1 bg-slate-200 rounded-full"></div>
                  {/* Laser Scaneando */}
                  <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_12px_#6366f1]" style={{ animation: 'scan-laser 2.5s ease-in-out infinite' }}></div>
                </div>

                {/* Fiação SVG Animada Roteando para 3 Agentes */}
                <svg className="absolute left-24 w-[calc(100%-11rem)] h-full z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                  {/* Cabo Superior (Agente Jurídico) */}
                  <path d="M 0 50 C 30 50, 50 15, 100 15" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                  <path d="M 0 50 C 30 50, 50 15, 100 15" fill="none" stroke="#6366f1" strokeWidth="2" className="path-routing" />
                  
                  {/* Cabo Central (Agente Financeiro) */}
                  <path d="M 0 50 C 40 50, 60 50, 100 50" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                  <path d="M 0 50 C 40 50, 60 50, 100 50" fill="none" stroke="#10b981" strokeWidth="2" className="path-routing" />

                  {/* Cabo Inferior (Agente Compliance) */}
                  <path d="M 0 50 C 30 50, 50 85, 100 85" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                  <path d="M 0 50 C 30 50, 50 85, 100 85" fill="none" stroke="#f59e0b" strokeWidth="2" className="path-routing" />
                </svg>

                {/* Nós dos Agentes (Os 3 Especialistas) */}
                <div className="absolute right-0 top-[5%] flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm z-20" style={{ animation: 'float-agent 4s infinite' }}>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0">
                    <span className="text-indigo-500 text-sm">⚖️</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Agente Jurídico</span>
                    <span className="block text-xs font-bold text-slate-700 leading-none">Claude 3.5 Sonnet</span>
                  </div>
                </div>
                
                <div className="absolute right-0 top-[40%] flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm z-20" style={{ animation: 'float-agent 4.5s infinite 0.5s' }}>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100 shrink-0">
                    <span className="text-emerald-500 text-sm">💰</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Agente Financeiro</span>
                    <span className="block text-xs font-bold text-slate-700 leading-none">GPT-4o Omni</span>
                  </div>
                </div>

                <div className="absolute right-0 top-[75%] flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm z-20" style={{ animation: 'float-agent 5s infinite 1s' }}>
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

            {/* ============================================================== */}
            {/* ➡️ LADO DIREITO: 1/3 DA TELA (OS RESULTADOS DOS AGENTES)     */}
            {/* ============================================================== */}
            <div className="xl:w-1/3 flex flex-col gap-4">
              
              {/* RESULTADO 1: O SCORE (Consenso) */}
              <div className="flex-1 bg-white rounded-[2rem] p-5 border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="relative w-[80px] h-[80px] shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="3" stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-emerald-500 drop-shadow-[0_2px_4px_rgba(16,185,129,0.3)]" strokeDasharray="98, 100" strokeWidth="3" strokeLinecap="round" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style={{ animation: "draw-arc 1.5s ease-out forwards" }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">98</span>
                    </div>
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Score Consolidado</p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-100 uppercase mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Pronto para Assinar
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🤖</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Consenso dos 3 Agentes</span>
                    </div>
                </div>
              </div>

              {/* RESULTADO 2: A OPORTUNIDADE (Descoberta pelo Financeiro) */}
              <div className="flex-1 bg-sky-50/50 rounded-[2rem] p-5 border border-sky-100 flex flex-col justify-center relative overflow-hidden group hover:bg-sky-50 transition-colors cursor-default">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-sky-400"></div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sky-600 text-base">💡</span>
                    <h5 className="text-sky-800 font-black text-[10px] uppercase tracking-widest">Oportunidade (Alpha)</h5>
                  </div>
                  <span className="text-[8px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded uppercase font-black tracking-widest border border-sky-200">💰 Agente Financeiro</span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  A cláusula de reajuste omite o índice base. Indexar ao <span className="inline-block bg-white text-slate-900 px-1.5 py-0 rounded text-xs font-bold border border-slate-200 shadow-sm">IPCA</span> garante a blindagem da sua margem operacional.
                </p>
              </div>

              {/* RESULTADO 3: O RISCO (Descoberto pelo Jurídico) */}
              <div className="flex-1 bg-rose-50/50 rounded-[2rem] p-5 border border-rose-100 flex flex-col justify-center relative overflow-hidden group hover:bg-rose-50 transition-colors cursor-default">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-rose-400"></div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-rose-600 text-base font-black">!</span>
                    <h5 className="text-rose-800 font-black text-[10px] uppercase tracking-widest">Risco Contratual Oculto</h5>
                  </div>
                  <span className="text-[8px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded uppercase font-black tracking-widest border border-rose-200">⚖️ Agente Jurídico</span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  Detetada multa rescisória unilateral de <span className="inline-block bg-white text-slate-900 px-1.5 py-0 rounded text-xs font-bold border border-slate-200 shadow-sm">30%</span> (Item 7.4). Parecer de defesa técnica já elaborado e anexado.
                </p>
              </div>

            </div>

          </div>
        </div>

        <section className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="grid lg:grid-cols-[1fr_350px] gap-8 md:gap-12 items-start">
            
            {/* ========================================== */}
            {/* LADO ESQUERDO: CONTEÚDO PRINCIPAL          */}
            {/* ========================================== */}
            <div className="flex flex-col gap-8 w-full overflow-hidden">
              {activeTab === 'workspace' && (
                <div className="animate-in fade-in duration-500 flex flex-col gap-8 w-full">
                  
                  {!isAnalyzing && !result ? (
                    <>
                      {/* --- CARD: RADAR PNCP --- */}
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

                      {/* --- CARD: SUBMISSÃO DIRETA --- */}
                      <div id="area-submissao" className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 md:p-10 relative z-20 w-full">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-violet-100">📄</div>
                          <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Nova Submissão Direta</h2>
                            <p className="text-sm font-medium text-slate-400">Cole o texto do edital ou faça upload dos documentos</p>
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
                              <div className="flex flex-col sm:flex-row gap-4 w-full">
  
                              {/* ⚡ ANÁLISE PADRÃO (OPENAI) - Visual Clean e Ágil */}
                              <button
                                type="button" 
                                disabled={isAnalyzing}
                                onClick={() => handleAnalyze("openai")}
                                className="flex-1 bg-white hover:bg-slate-50 text-slate-800 py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-sm border-2 border-slate-200 hover:border-slate-300 disabled:opacity-50"
                              >
                                <span className="text-xl opacity-80">⚡</span>
                                <div className="flex flex-col items-start text-left">
                                  <span className="block leading-tight">Análise Padrão</span>
                                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">GPT-4o (Velocidade)</span>
                                </div>
                              </button>

                              {/* 🧠 ANÁLISE AVANÇADA (CLAUDE) - Visual Preto Premium (Enterprise) */}
                              <button
                                type="button"
                                disabled={isAnalyzing}
                                onClick={() => handleAnalyze("claude")}
                                className="flex-1 bg-slate-950 hover:bg-black text-white py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl shadow-slate-900/20 border border-slate-800 disabled:opacity-50 relative overflow-hidden group"
                              >
                                {/* Efeito de fundo subtil ao passar o rato */}
                                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                
                                <span className="text-xl relative z-10 drop-shadow-md">🧠</span>
                                <div className="flex flex-col items-start text-left relative z-10">
                                  <span className="block leading-tight">Análise Avançada</span>
                                  <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest mt-0.5">Claude 3.5 (Pente Fino)</span>
                                </div>
                              </button>
                              
                            </div>
                            ) : (
                              /* BOTÃO ÚNICO PARA TIERS 1, 2 e 3 */
                              <button
                                type="button" 
                                disabled={isAnalyzing}
                                onClick={() => handleAnalyze("openai")}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-sm border border-slate-700 disabled:opacity-50"
                              >
                                <span className="text-xl">⚡</span>
                                <div className="flex flex-col items-start text-left">
                                  <span className="block leading-tight text-base">Iniciar Análise Estratégica</span>
                                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Processamento Neural Padrão</span>
                                </div>
                              </button>
                            )}
                          </div>
                        </form>
                      </div>
                    </>

                    ) : isAnalyzing ? (
                    // 🟢 TELA DE CARREGAMENTO ESTRATÉGICA
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
                          
                          {/* 🟢 O BOTÃO DE CANCELAR */}
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
                        
                        {/* ========================================================== */}
                        {/* CABEÇALHO DO RELATÓRIO (IMPRESSÃO & AÇÕES)               */}
                        {/* ========================================================== */}
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

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                           <div className="flex items-center gap-3">
                             <h2 className="text-2xl font-black text-slate-900 tracking-tight">Análise de Viabilidade</h2>
                             <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-widest border border-slate-200">
                               {termoAlvo || "Visão Global"}
                             </span>
                           </div>
                           <div className="flex flex-wrap gap-3 w-full md:w-auto print:hidden"> 
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

                        {/* ========================================================== */}
                        {/* NOVO PADRÃO: "FIELDSET/LEGEND" LINE UI                     */}
                        {/* A Linha passa exatamente no meio do título                 */}
                        {/* ========================================================== */}

                        {/* 1. SCORE E VEREDITO (O GRANDE DESTAQUE INICIAL) */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-14 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-8">
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
                          
                          {/* PRAZOS (Alinhados à direita do Score) */}
                          {(() => {
                            const d = result?.datas_criticas_extraidas;
                            const propostas = String(d?.data_limite_propostas || "").trim();
                            const impugnacao = String(d?.data_impugnacao || "").trim();
                            
                            if (!propostas && !impugnacao) return null;
                            return (
                              <div className="flex flex-col gap-3 pl-0 md:pl-8 border-t md:border-t-0 md:border-l border-slate-200 w-full md:w-auto pt-6 md:pt-0">
                                {propostas && (
                                  <div>
                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo de Propostas</span>
                                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><span className="text-amber-500">📅</span> {propostas}</span>
                                  </div>
                                )}
                                {impugnacao && (
                                  <div>
                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Limite Impugnação</span>
                                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><span className="text-rose-500">🚨</span> {impugnacao}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* 2. RESUMO EXECUTIVO (WIRE FRAME) */}
                        <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
                          {/* A Mágica: Título "cortando" a borda superior */}
                          <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                            <span className="text-lg">🎯</span>
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Resumo Executivo</h3>
                          </div>
                          
                          <div className="text-slate-700 text-sm md:text-base leading-relaxed space-y-4 font-medium whitespace-pre-line mt-2">
                            {result.summary}
                          </div>
                        </div>

                        {/* 3. SIMULADOR SHADOW E PRECIFICAÇÃO (WIRE FRAME) */}
                        {(() => {
                          const pricing = result.pricing_intelligence as Record<string, any>;
                          
                          // 🟢 A FUNÇÃO "SACA-ROLHAS" SUPREMA
                          // Procura por todos os "R$" no texto e devolve o maior valor numérico
                          const extrairMaiorDinheiro = (textoBase: any): number => {
                            if (!textoBase) return 0;
                            if (typeof textoBase === 'number' && textoBase > 0) return textoBase;
                            
                            const texto = String(textoBase);
                            const matches = [...texto.matchAll(/R\$\s*([\d\.,]+)/g)];
                            
                            if (matches.length > 0) {
                              let maiorValor = 0;
                              matches.forEach(m => {
                                 // Transforma "2.755,20" em número matemático limpo (2755.20)
                                 const num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
                                 if (num > maiorValor) maiorValor = num;
                              });
                              return maiorValor;
                            }
                            
                            const floatDireto = parseFloat(texto);
                            if (!isNaN(floatDireto) && floatDireto > 0) return floatDireto;
                            return 0;
                          };

                          // 🟢 A ORDEM DE PRIORIDADE: O Resumo agora manda no Simulador!
                          let valorEstimado = extrairMaiorDinheiro(result?.summary) // 1º Puxa direto do texto do resumo
                                           || extrairMaiorDinheiro(result?.estimated_value) // 2º Puxa do campo de extração
                                           || extrairMaiorDinheiro(pricing?.valor_estimado_raw) // 3º Puxa da matemática
                                           || 0;

                          if (!pricing || pricing.desagioPreditivoOrgao === undefined) return null;

                          return (
                            <div className="relative border border-slate-200 rounded-2xl p-2 mb-12">
                              <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2 z-10">
                                <span className="text-lg">💰</span>
                                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Preço & Engenharia Reversa</h3>
                              </div>
                              <BawziShadowSimulator 
                                desagioPreditivo={result?.pricing_intelligence?.desagioPreditivoOrgao}
                                nivelAmeaca={result?.pricing_intelligence?.nivelAmeaca}
                                perfilVencedor={result?.pricing_intelligence?.perfilVencedor}
                                valorReferenciaInicial={result?.pricing_intelligence?.valor_estimado_raw}
                                engenhariaReversa={result?.pricing_intelligence?.engenharia_reversa}
                                userTier={userTier} 
                                onUpgradeClick={() => setShowUpgradeModal(true)} 
                              />
                            </div>
                          );
                        })()}

                        {/* 4. INTELIGÊNCIA COMPETITIVA (WIRE FRAME) */}
                        <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
                          <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                            <span className="text-lg">👑</span>
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Inteligência Competitiva</h3>
                          </div>
                          
                          <div className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-line mt-2">
                            {result.rationale || result.recommendation || "Sem dados estratégicos."}
                          </div>
                        </div>


                        {/* ======================================================= */}
                        {/* ⚖️ PARECER JURÍDICO ELITE (Bloqueio Tier -1, 1 e 2)      */}
                        {/* ======================================================= */}
                        {result && (  /* 🟢 AQUI ESTÁ A MUDANÇA: Tiramos o ?.parecer_especialista */
                          <div className="my-10 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
                            <div className="bg-indigo-900 p-4 border-b border-indigo-800 flex items-center justify-between">
                              <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                                <span className="text-xl">⚖️</span> PARECER TÉCNICO-JURÍDICO BAWZI
                              </h3>
                              <span className="text-[10px] uppercase tracking-widest text-amber-400 font-black px-2 py-1 bg-amber-400/10 rounded-md border border-amber-400/20">
                                Agente IA Especialista
                              </span>
                            </div>

                            {/* 🔴 LÓGICA DE BLOQUEIO: Se for menor ou igual a Tier 2, aplica o Paywall */}
                            {userTier <= 2 ? (
                              <div className="relative p-6">
                                
                                {/* TEXTO DE ISCA (As primeiras linhas do parecer) */}
                                <div className="prose prose-slate max-w-none mb-3 opacity-60">
                                  <p className="text-slate-700 text-sm font-medium italic">
                                    "Após análise minuciosa das cláusulas de habilitação técnica e financeira, 
                                    identificamos pontos de atenção..."
                                  </p>
                                </div>

                                {/* OVERLAY DE BLOQUEIO COM CADEADO (Mais compacto) */}
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

                                {/* EFEITO VISUAL BORRADO (Reduzido para encurtar a altura total do bloco) */}
                                <div className="space-y-3 blur-[5px] select-none pointer-events-none opacity-20 mt-2 min-h-[220px]">
                                  <div className="h-3 w-full bg-slate-300 rounded"></div>
                                  <div className="h-3 w-5/6 bg-slate-300 rounded"></div>
                                  <div className="h-3 w-4/6 bg-slate-300 rounded"></div>
                                  <div className="h-16 w-full bg-indigo-50 rounded-xl mt-4"></div>
                                </div>
                              </div>
                            ) : (
                              
                              /* ✅ VISUALIZAÇÃO COMPLETA (Tier 3 e 4) */
                              result.parecer_especialista && (
                                <div className="p-8 prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-indigo-600">
                                  <div className="whitespace-pre-wrap font-sans leading-relaxed">
                                    {result.parecer_especialista}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {/* 6. CARGA OPERACIONAL (WIRE FRAME) */}
                        {((result.exigencias_criticas && result.exigencias_criticas.length > 0) || (result.documentos_necessarios && result.documentos_necessarios.length > 0) || (result.vantagens && result.vantagens.length > 0) || (result.desvantagens && result.desvantagens.length > 0)) && (
                          <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
                            <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                              <span className="text-lg">📋</span>
                              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Carga Operacional & SWOT</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 mt-2">
                               {/* Vantagens / Desvantagens */}
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
                               
                               {/* Documentos e Exigências */}
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

                        {/* 7. CHECKLIST ROADMAP (WIRE FRAME) */}
                        {result.checklist && result.checklist.length > 0 && (
                          <div className="relative border border-slate-200 rounded-2xl p-8">
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

                        {/* ========================================================== */}
                        {/* RODAPÉ TÉCNICO MINIMALISTA                                 */}
                        {/* ========================================================== */}
                        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium">
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
                    </div>
                  ) : null}
                </div>
              )}

              {/* ABA HISTÓRICO */}
              {activeTab === 'history' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-8">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-amber-100">📚</div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">O Teu Histórico</h2>
                    </div>
                    <p className="text-slate-500 text-sm font-medium ml-16">Recupera estratégias de editais que já analisaste.</p>
                  </div>
                  {token ? (
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
                        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">🔒</div>
                        <p className="text-slate-500 font-medium">Inicie sessão para aceder ao histórico.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ========================================== */}
            {/* LADO DIREITO: BARRA LATERAL (SIDEBAR)      */}
            {/* ========================================== */}
            <div className="flex flex-col gap-6 sticky top-28">
              <div className="flex flex-col gap-3 mb-2 p-2 bg-slate-100/50 rounded-[2rem] border border-slate-200/50">
                <button onClick={() => setActiveTab('workspace')} className={`py-4 px-6 rounded-2xl font-black transition-all flex items-center justify-between group ${activeTab === 'workspace' ? 'bg-white text-slate-900 shadow-md border border-slate-200/60' : 'text-slate-500 hover:bg-white/60'}`}>
                  <span className="flex items-center gap-3"><span className="text-xl grayscale group-hover:grayscale-0 transition-all">⚡</span> Nova Análise</span>
                  {activeTab === 'workspace' && <span className="w-2 h-2 rounded-full bg-violet-500"></span>}
                </button>
                <button onClick={() => setActiveTab('history')} className={`py-4 px-6 rounded-2xl font-black transition-all flex items-center justify-between group ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-md border border-slate-200/60' : 'text-slate-500 hover:bg-white/60'}`}>
                  <span className="flex items-center gap-3"><span className="text-xl grayscale group-hover:grayscale-0 transition-all">📚</span> O Meu Histórico</span>
                  {activeTab === 'history' && <span className="w-2 h-2 rounded-full bg-violet-500"></span>}
                </button>
              </div>

              {token && userData ? (
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span> 
                    Identidade Estratégica
                  </h3>
                  <div className="space-y-4">
                     <UserProfileCard 
                        user={{
                          name: userData.name,
                          email: userData.email,
                          tier: userTier,
                          workspace_users_count: userData.workspace_users_count,
                          company: userData.company
                        }}
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
            </div>
          </div>
        </section>

        <section id="planos" className="bg-white py-24 px-6 border-t border-slate-100">
          <div className="max-w-[1400px] mx-auto">
            <div className="text-center mb-16">
              <span className="text-violet-700 bg-violet-50 px-5 py-2 rounded-full font-black uppercase text-xs tracking-widest">Transparência e Escala</span>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mt-6 mb-4 tracking-tight">A IA certa para o desafio certo</h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">Otimizamos o custo e a precisão roteando a sua análise automaticamente para os melhores modelos LLM do mundo.</p>
            </div>
            <PricingSection 
              onRegister={() => { setAuthMode('register'); setShowAuthModal(true); }}
              onUpgrade={handleUpgrade} 
            />
          </div>
        </section>
      </main>

      {/* --- MODAIS --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 to-pink-600"></div>
            <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors text-2xl font-bold bg-slate-50 w-8 h-8 rounded-full flex items-center justify-center">&times;</button>
            
            <div className="flex flex-col items-center text-center mb-8">
              <div className="mb-6 transform hover:scale-105 transition-transform">
                <Image src="/logo-bawzi.png" alt="Bawzi Logo" width={140} height={40} className="object-contain" priority />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                {authMode === 'register' ? 'Criar Conta' : 'Boas-vindas'}
              </h2>
              <p className="text-slate-500 text-sm mt-2 px-4 font-medium">
                {authMode === 'register' ? 'Começa a analisar editais em segundos com o poder da IA.' : 'Acesse ao teu painel estratégico e histórico de análises.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'register' && (
                <input type="text" required placeholder="Nome completo" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium" />
              )}
              <input type="email" required placeholder="E-mail profissional" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium" />
              <input type="password" required placeholder="Palavra-passe" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium" />
              <button type="submit" disabled={authLoading} className="w-full py-4 mt-2 bg-slate-950 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50">
                {authLoading ? 'A processar...' : authMode === 'register' ? 'Começar Gratuitamente' : 'Entrar na Conta'}
              </button>
            </form>
            
            <p className="text-center mt-8 text-sm text-slate-500 font-medium">
              {authMode === 'register' ? 'Já tens conta na Bawzi?' : 'És novo por aqui?'} 
              <button onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')} className="ml-2 text-violet-600 font-bold hover:underline underline-offset-4">
                {authMode === 'register' ? 'Fazer Login' : 'Criar Conta Grátis'}
              </button>
            </p>
          </div>
        </div>
      )}

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

      {/* MODAL DO DOCUMENTO DE IMPUGNAÇÃO */}
      {showImpugnacaoModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2rem] flex flex-col shadow-2xl relative overflow-hidden">
            
            {/* Header do Modal */}
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
            
            {/* Corpo do Documento (Rola se for grande) */}
            <div className="p-8 overflow-y-auto flex-1 bg-slate-100/50">
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-8 max-w-3xl mx-auto font-serif text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                {impugnacaoText}
              </div>
            </div>
            
            {/* Footer do Modal */}
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
        onClose={() => setShowUpgradeModal(false)} 
      />

    </div> 
  );
}