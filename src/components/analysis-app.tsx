'use client';

import { useState, useEffect } from 'react';
import { fetchUserProfile } from '../services/api';
import CompanyProfileForm from './CompanyProfileForm';
import Image from 'next/image';
import UserProfileCard from './UserProfileCard';
import HistoryTab from './HistoryTab';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PricingSection from './PricingSection';
import PncpSearch from '../components/PncpSearch';
import UpgradeModal from './UpgradeModal';

const logout = () => {
  localStorage.clear();
  window.location.reload();
};

// --- Interfaces ---
interface PricingIntelligence {
  estimated_discount: string;
  market_analysis: string;
  financial_verdict: string;
}

interface HighlightItem { title: string; quote: string; }

interface AnalysisResult {
  title: string; 
  summary: string; 
  score: number; 
  classification: string;
  effort: string; 
  estimated_value: string; 
  recommendation: string;
  rationale: string; 
  
  // NOVAS CHAVES ESTRATÉGICAS (Opcionais para não quebrar cache antigo)
  probabilidade_de_sucesso?: string;
  vantagens?: string[];
  desvantagens?: string[];
  exigencias_criticas?: string[];
  prazos?: string[];
  documentos_necessarios?: string[];
  criterios_de_julgamento?: string[];
  concorrentes_provaveis?: ConcorrenteProvavel[];

  // Chaves de objetos e arrays originais
  risks?: any[]; 
  checklist?: any[]; 
  pricing_intelligence?: PricingIntelligence;
  orgao_risk?: OrgaoRisk; 
}

interface OrgaoRisk {
  risco: string;
  score_pagamento: number | string; 
  status: string;
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

interface ConcorrenteProvavel {
  empresa: string;
  probabilidade: number;
  forca: string;
}

// --- Utilitários ---
const getScoreColor = (score: number) => score >= 70 ? 'text-emerald-600 border-emerald-500' : score >= 45 ? 'text-amber-500 border-amber-400' : 'text-red-600 border-red-500';
const getScoreBg = (score: number) => score >= 70 ? 'bg-emerald-50' : score >= 45 ? 'bg-amber-50' : 'bg-red-50';
const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

export default function AnalysisApp() {
  const [activeTab, setActiveTab] = useState('workspace');
  const router = useRouter();
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // ==========================================
  // ESTADOS PRINCIPAIS
  // ==========================================
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelSource, setModelSource] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<number>(-1);
  const [hasProfile, setHasProfile] = useState<boolean>(true);
  const [userData, setUserData] = useState<any>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', cnpj: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasUsedFreeTrial, setHasUsedFreeTrial] = useState(false);
  const [isCachedResult, setIsCachedResult] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // ==========================================
  // ESTADOS DE PARTILHA DE ANÁLISE
  // ==========================================
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // ==========================================
  // ESTADOS DE ANIMAÇÃO DE CARREGAMENTO
  // ==========================================
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingMessages = [
    { title: "A Orquestrar Motores LLM", desc: "A selecionar o modelo neural mais eficiente para o volume deste edital..." },
    { title: "A Varrer Cláusulas de Risco", desc: "A analisar o documento linha a linha em busca de armadilhas e multas..." },
    { title: "Inteligência de Precificação", desc: "A cruzar valores com a base do PNCP para calcular o deságio ideal..." },
    { title: "A Mapear Concorrentes", desc: "A identificar quem são os predadores que costumam vencer este objeto..." },
    { title: "A Emitir Veredito Financeiro", desc: "A compilar a matriz de decisão Go/No-Go. Quase pronto..." }
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing) {
      setLoadingStep(0); // Reinicia sempre que começa uma nova análise
      interval = setInterval(() => {
        // Passa para a próxima mensagem, ou volta à primeira se chegar ao fim
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 3500); // Muda a cada 3.5 segundos
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // ==========================================
  // REGRAS DINÂMICAS
  // ==========================================
  const [tierLimits, setTierLimits] = useState<Record<number, number>>({ [-1]: 10000, 1: 20000, 2: 60000, 3: 150000, 4: 300000 });
  const [tierFileLimits, setTierFileLimits] = useState<Record<number, number>>({ [-1]: 3, 1: 5, 2: 10, 3: 20, 4: 50 });

  const currentCharLimit = tierLimits[userTier] || 3000;
  const currentFileLimitMB = tierFileLimits[userTier] || 1;
  const currentFileLimitBytes = currentFileLimitMB * 1024 * 1024;

  const totalFileSize = files.reduce((acc, file) => acc + file.size, 0);
  const isOverTextLimit = text.length > currentCharLimit;
  const isOverFileLimit = totalFileSize > currentFileLimitBytes;
  const isOverLimit = isOverTextLimit || isOverFileLimit;
  const requiresAuth = (!token) && (hasUsedFreeTrial);

  // ==========================================
  // ESTADOS DO RADAR FISCAL (CND)
  // ==========================================
  // Simulando a resposta do backend para um utilizador Tier 1
  const [cndRiskCount, setCndRiskCount] = useState(3);

// ==========================================
  // EFEITOS
  // ==========================================
  useEffect(() => {
    fetch(`${API_URL.replace(/\/$/, '')}/api/config/tiers`)
      .then(res => res.json())
      .then(data => {
         if(data.tiers) {
            const newLimits: Record<number, number> = {};
            const newFileLimits: Record<number, number> = {};
            
            Object.entries(data.tiers).forEach(([tierId, config]: [string, any]) => {
                newLimits[Number(tierId)] = config.max_chars;
                newFileLimits[Number(tierId)] = config.max_mb;
            });
            
            setTierLimits(newLimits);
            setTierFileLimits(newFileLimits);
         }
      })
      .catch(err => console.error("⚠️ Usando limites locais.", err));
  }, [API_URL]);

  // 🟢 1. ÚNICO EFEITO DE INICIALIZAÇÃO (Sem conflitos)
  useEffect(() => {
    const initializeData = async () => {
      const savedToken = localStorage.getItem('bawzi_token');
      if (!savedToken) return;

      setToken(savedToken);

      try {
        const headers = { 
          'Authorization': `Bearer ${savedToken}`,
          'Content-Type': 'application/json'
        };

        const [userRes, wsRes, companyRes] = await Promise.all([
          fetch(`${API_URL}/api/users/me`, { headers }),
          fetch(`${API_URL}/api/workspace/details`, { headers }),
          fetch(`${API_URL}/api/workspace/company`, { headers }) 
        ]);

        if (userRes.status === 401 || wsRes.status === 401) {
          logout();
          return;
        }

        if (userRes.ok && wsRes.ok && companyRes.ok) {
          const userDataInfo = await userRes.json();
          const wsData = await wsRes.json();
          const companyData = await companyRes.json(); 

          const currentTier = userDataInfo.tier !== undefined ? userDataInfo.tier : 1;
          setUserTier(currentTier);
          localStorage.setItem('bawzi_tier', currentTier.toString());

          // O CNPJ é gravado com sucesso aqui
          setUserData({
            ...userDataInfo,
            workspace_users_count: wsData.workspace_users_count,
            vagas_totais: wsData.vagas_totais,
            company: companyData.cnpj ? companyData : userDataInfo.company
          });
        }
      } catch (error) {
        console.error("Erro crítico ao sincronizar dados:", error);
      }
    };

    initializeData();
  }, [API_URL]);

  // 🟢 2. EFEITO DO RADAR FISCAL (Só dispara quando o CNPJ for encontrado)
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

  // ==========================================
  // HANDLERS
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

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  
// 1. Apenas abre o modal
const handleShare = () => {
  if (!analysisId) return;
  setShareEmail('');
  setShowShareModal(true);
};

// 2. Faz o envio real (chame esta função no botão do novo modal)
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

  const handleAnalyze = async () => {
    if (requiresAuth) { setAuthMode('register'); setShowAuthModal(true); return; }
    if (!text.trim() && files.length === 0) { setError("Cole o texto ou adicione documentos."); return; }
    if (isOverLimit) { window.location.href = '#planos'; return; }

    setIsAnalyzing(true); 
    setError(null); 
    setResult(null); 
    setIsCachedResult(false);
    
    setTimeout(() => {
      const areaLoading = document.getElementById('area-loading');
      if (areaLoading) {
        const y = areaLoading.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 50);

    try {
      const formData = new FormData();
      if (text.trim()) formData.append('raw_text', text.trim());
      files.forEach(f => formData.append('files', f));

      const headers: Record<string, string> = {};
      const currentToken = localStorage.getItem('bawzi_token');
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

      const response = await fetch(`${API_URL.replace(/\/$/, '')}/api/analyze`, {
        method: 'POST', 
        headers: headers, 
        body: formData,
      });

      if (response.status === 401) {
        alert("Sua sessão expirou por segurança (8 horas). Faça login novamente.");
        logout();
        return;
      }

      if (response.status === 402) {
        setShowUpgradeModal(true);
        setIsAnalyzing(false);     
        return;                    
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || 'Erro no servidor.');
      }

      // 🟢 CORREÇÃO CRÍTICA: O backend pode devolver embrulhado em "analysis" ou o objeto diretamente
      const analysisData = data.analysis || data;

      // 🟢 PREVENÇÃO DE FALHA SILENCIOSA: Se a IA falhar o formato e devolver vazio
      if (!analysisData || Object.keys(analysisData).length === 0 || !analysisData.score) {
        throw new Error("A IA processou o documento, mas não conseguiu estruturar o formato final. Por favor, clique em Iniciar Análise novamente.");
      }

      // 🟢 GUARDAMOS OS DADOS COM SEGURANÇA MÁXIMA
      setResult(analysisData);
      setAnalysisId(data.id || data.record_id || data.analysis_hash); // Cobre os vários formatos de ID
      setModelSource(data.source || data.model_source || 'Motor Bawzi IA'); // Cobre a chave 'source' do novo LLMRouter
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

  // ==========================================
  // ESTADOS DO RADAR FISCAL (CND)
  // ==========================================
  const [cndData, setCndData] = useState<CndData | null>(null);
  const [isLoadingCnd, setIsLoadingCnd] = useState(false);

  // 🟢 FUNÇÃO AUXILIAR: Lê a string da IA e gera estilos dinâmicos
  const getProbabilityStyles = (probabilidade?: string) => {
    const text = (probabilidade || '').toLowerCase();
    
    if (text.includes('alta') || text.includes('alto')) {
      return { 
        bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', 
        bar: 'bg-emerald-500', width: 'w-[85%]', icon: '🚀', label: 'ALTA PROPENSÃO' 
      };
    }
    if (text.includes('média') || text.includes('media')) {
      return { 
        bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', 
        bar: 'bg-amber-500', width: 'w-[50%]', icon: '⚖️', label: 'RISCO CALCULADO' 
      };
    }
    if (text.includes('baixa') || text.includes('baixo')) {
      return { 
        bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', 
        bar: 'bg-rose-500', width: 'w-[15%]', icon: '⚠️', label: 'BAIXA PROPENSÃO' 
      };
    }
    
    // Fallback caso a IA invente outra palavra
    return { 
      bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', 
      bar: 'bg-slate-400', width: 'w-[0%]', icon: '❓', label: 'A APURAR' 
    };
  };

  // ==========================================
  // RENDERIZAÇÃO VISUAL
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-violet-200/50 to-transparent rounded-full blur-[100px]"></div>
      </div>

      <main>
        <div className="relative pt-12 pb-12 lg:pt-28 lg:pb-20 overflow-hidden bg-slate-50">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-[600px] h-[600px] bg-gradient-to-br from-violet-200/40 to-transparent blur-[100px] rounded-full pointer-events-none"></div>

          <div className="container mx-auto px-4 relative z-10 max-w-[1400px]">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-black uppercase tracking-widest mb-6 border border-violet-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                  Multi-LLM Routing Ativado
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
                  Pare de assumir riscos cegos em <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">contratos e editais.</span>
                </h1>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  O motor da Bawzi analisa dezenas de páginas em segundos, blindando a sua equipe contra cláusulas abusivas.
                </p>
              </div>

              <div className="hidden lg:block relative perspective-1000">
                <div className="relative w-full max-w-lg mx-auto transform rotate-[-2deg] hover:rotate-0 transition-transform duration-700 ease-out">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-indigo-500 transform translate-x-4 translate-y-6 rounded-[3rem] blur-2xl opacity-30"></div>
                  
                  <div className="relative bg-white/90 backdrop-blur-xl border border-white p-8 rounded-[3rem] shadow-2xl pointer-events-none">
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl font-black">98</div>
                        <div>
                          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Score de Segurança Jurídica</h3>
                          <p className="text-lg font-bold text-emerald-600">Pronto para Assinatura</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg border border-slate-200">Claude 3.5 Sonnet</div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 font-bold">💡</div>
                        <div>
                          <h4 className="font-bold text-slate-900 mb-1">Oportunidade de Negociação</h4>
                          <p className="text-sm text-slate-600 font-medium">A cláusula de reajuste pode ser indexada ao IPCA para proteger a margem a longo prazo.</p>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center shrink-0 font-bold">!</div>
                        <div>
                          <h4 className="font-bold text-amber-900 mb-1">Risco Financeiro Identificado</h4>
                          <p className="text-sm text-amber-700/80 font-medium">Multa rescisória unilateral de 30% (cláusula 7.4). Sugestão automática de revisão gerada.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute -right-8 -bottom-8 bg-slate-950 text-white p-5 rounded-3xl shadow-xl border border-slate-800 transform rotate-[5deg]">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">Valor Protegido</span>
                      <span className="text-2xl font-black">R$ 145.000</span>
                    </div>
                  </div>
                </div>
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
                        <div className="mb-6 p-6 bg-gradient-to-r from-indigo-50/80 to-white border border-indigo-100 rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-sm transition-all hover:shadow-md">
                          <div className="w-14 h-14 bg-white text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 text-2xl shadow-sm border border-indigo-50">📡</div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="text-base font-black text-slate-900 tracking-tight">O que é o Radar PNCP?</h4>
                              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Online
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed">
                              A base de dados oficial do Governo. Busque licitações em tempo real e envie o edital para a nossa IA analisar com apenas um clique.
                            </p>
                          </div>
                        </div>

                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                          <PncpSearch 
                            charLimit={currentCharLimit}
                            onAnalyzeOportunity={(textoSimulado: string) => {
                              setText(textoSimulado);
                              setFiles([]);
                              document.getElementById('area-submissao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

                        <form onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }} className="space-y-6 w-full">
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

                          <button 
                            type="submit" 
                            disabled={isAnalyzing || isOverLimit} 
                            className="w-full bg-slate-900 text-white font-black text-base md:text-lg py-5 rounded-2xl shadow-xl hover:bg-violet-600 hover:shadow-violet-600/30 transition-all duration-300 disabled:opacity-50 disabled:hover:bg-slate-900 disabled:cursor-not-allowed relative overflow-hidden group"
                          >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                            <span className="relative flex items-center justify-center gap-3">
                              {isAnalyzing ? (
                                <>
                                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  A Orquestrar Inteligência...
                                </>
                              ) : (
                                <>
                                  {isOverLimit ? 'Limite de caracteres excedido' : 'Iniciar Análise Estratégica'}
                                  <span className="group-hover:translate-x-1 transition-transform">🚀</span>
                                </>
                              )}
                            </span>
                          </button>
                        </form>
                      </div>
                    </>

                    ) : isAnalyzing ? (
                    // 🟢 TELA DE CARREGAMENTO ESTRATÉGICA (DENTRO DO CONTEXTO DE ANÁLISE)
                    <div id="area-loading" className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-12 animate-in fade-in duration-700 relative overflow-hidden">
                      
                      {/* Efeito de brilho sutil ao fundo do card */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                      
                      <div className="relative flex flex-col items-center z-10 text-center space-y-8">
                        {/* Logo da Bawzi Pulsante */}
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

                        {/* Spinner Progressivo */}
                        <div className="relative w-16 h-16">
                          <div className="absolute inset-0 border-4 border-violet-50 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-t-violet-600 rounded-full animate-spin shadow-sm"></div>
                        </div>

                        {/* Texto de Status C-Level Dinâmico */}
                        <div className="relative h-20 max-w-sm w-full">
                          {/* O segredo da animação: ao usar key={loadingStep}, o React recria a div, forçando a animação do Tailwind a rodar de novo! */}
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

                        {/* Tag de Motor Ativo */}
                        <div className="pt-4">
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                            Neural Routing Ativado
                          </span>
                        </div>
                      </div>
                    </div>

                  ) : result ? (
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative animate-in fade-in duration-500" id="area-resultados">
                      <div className={`h-4 ${getScoreBg(result.score)}`}></div>
                      <div className="p-8 md:p-12">
                        
                        {/* 🟢 CABEÇALHO SÓ PARA IMPRESSÃO */}
                        <div className="hidden print:flex items-center justify-between border-b-2 border-slate-900 pb-6 mb-8 w-full">
                          <div className="flex flex-col">
                            <h1 className="text-2xl font-black text-slate-900">BAWZI | Inteligência em Editais</h1>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Relatório Estratégico de Viabilidade</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Data da Análise</p>
                            <p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10 pb-10 border-b border-slate-100">
                          {/* SCORE DINÂMICO COM GRÁFICO CIRCULAR */}
                            <div className="flex items-center gap-5">
                              {/* Gráfico SVG */}
                              <div className="relative w-20 h-20 shrink-0">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                  <circle 
                                    cx="50" cy="50" r="42" 
                                    className="stroke-slate-100" 
                                    strokeWidth="8" 
                                    fill="none" 
                                  />
                                  <circle 
                                    cx="50" cy="50" r="42" 
                                    className={`transition-all duration-1000 ease-out ${
                                      result.score >= 70 ? 'stroke-emerald-500' : 
                                      result.score >= 45 ? 'stroke-amber-500' : 
                                      'stroke-red-500'
                                    }`} 
                                    strokeWidth="8" 
                                    fill="none" 
                                    strokeLinecap="round"
                                    style={{ 
                                      strokeDasharray: 264,
                                      strokeDashoffset: 264 - (264 * result.score) / 100 
                                    }} 
                                  />
                                </svg>
                                {/* Ícone Centralizado */}
                                <div className="absolute inset-0 flex items-center justify-center text-2xl drop-shadow-sm">
                                  {result.score >= 70 ? '🎯' : result.score >= 45 ? '⚠️' : '🚨'}
                                </div>
                              </div>

                              {/* Textos e Valores */}
                              <div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md mb-1 inline-block border shadow-sm ${getScoreBg(result.score)} ${getScoreColor(result.score)}`}>
                                  Veredito da IA
                                </span>
                                <div className="flex flex-col mt-0.5">
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">
                                      {result.score}
                                    </span>
                                    <span className="text-sm font-bold text-slate-400">/100</span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <p className={`text-[11px] font-black uppercase tracking-widest ${
                                        result.score >= 70 ? 'text-emerald-600' : 
                                        result.score >= 45 ? 'text-amber-600' : 
                                        'text-red-600'
                                      }`}>
                                      {result.score >= 70 ? 'Alta Viabilidade (Go)' : 
                                       result.score >= 45 ? 'Avançar com Cautela' : 
                                       'Risco Crítico (No-Go)'}
                                    </p>
                                    
                                    {/* Probabilidade de Sucesso (Visual Compacto Premium) */}
                                    {result.probabilidade_de_sucesso && (() => {
                                      const probText = String(result.probabilidade_de_sucesso).toLowerCase();
                                      
                                      // Tema padrão (Fallback)
                                      let theme = { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: '🎯', label: 'A APURAR' };

                                      if (probText.includes('alta') || probText.includes('alto')) {
                                        theme = { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: '🚀', label: 'ALTA' };
                                      } else if (probText.includes('média') || probText.includes('media')) {
                                        theme = { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: '⚖️', label: 'MÉDIA' };
                                      } else if (probText.includes('baixa') || probText.includes('baixo')) {
                                        theme = { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: '⚠️', label: 'BAIXA' };
                                      }

                                      return (
                                        <span 
                                          title={result.probabilidade_de_sucesso} // 🔥 Tooltip: Mostra o texto completo da IA ao passar o rato!
                                          className={`flex items-center gap-1.5 w-max text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border shadow-sm transition-all hover:scale-105 cursor-help
                                            ${theme.bg} ${theme.text} ${theme.border}`}
                                        >
                                          <span className="text-[11px]">{theme.icon}</span>
                                          PROPENSÃO: {theme.label}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          
                          {/* 🟢 BOTÕES ESCONDIDOS NA IMPRESSÃO */}
                          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0 border-t md:border-t-0 pt-6 md:pt-0 border-slate-100 print:hidden"> 
                            <button 
                              onClick={() => window.print()} 
                              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-colors text-sm flex items-center justify-center gap-2"
                            >
                              🖨️ <span className="hidden sm:inline">Imprimir</span>
                            </button>
                            {token && analysisId && (
                                <button onClick={handleShare} disabled={isSharing} className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold rounded-xl border border-violet-200 transition-colors text-sm flex items-center justify-center gap-2">
                                  {isSharing ? 'A Enviar...' : '📧 Partilhar'}
                                </button>
                            )}
                            <button onClick={handleResetAnalysis} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-2">
                              Nova Análise
                            </button>
                          </div>
                        </div>

                        {/* ========================================== */}
                        {/* MONITORIZAÇÃO DE RISCO FISCAL (CND)        */}
                        {/* ========================================== */}
                        <div className="mb-10">
                          {!userData?.company?.cnpj && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in">
                              <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl border border-slate-100 shrink-0">🕵️</div>
                                <div className="space-y-1">
                                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Radar Fiscal (Inativo)</h3>
                                  <p className="text-slate-900 font-black text-xl md:text-2xl tracking-tight">Monitorização Desligada</p>
                                  <p className="text-slate-500 text-sm font-medium">Cadastre o CNPJ da sua empresa no seu painel para a IA rastrear certidões automaticamente.</p>
                                </div>
                              </div>
                              <button onClick={() => { document.getElementById('perfil-tab')?.click(); window.scrollTo(0,0); }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors whitespace-nowrap shadow-md">
                                Configurar CNPJ
                              </button>
                            </div>
                          )}
                          {userData?.company?.cnpj && isLoadingCnd && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 flex items-center gap-5 opacity-70 animate-in fade-in">
                              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center border border-violet-100 shrink-0">
                                <div className="w-6 h-6 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                              <div>
                                <h3 className="text-[11px] font-black text-violet-600 uppercase tracking-widest">Radar Fiscal Automático</h3>
                                <p className="text-slate-900 font-black text-xl tracking-tight">A consultar bases governamentais...</p>
                              </div>
                            </div>
                          )}
                          {userData?.company?.cnpj && !cndData && !isLoadingCnd && (
                            <div className="bg-white rounded-3xl border border-amber-200 shadow-sm p-6 md:p-8 flex items-center gap-5 animate-in fade-in">
                              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl border border-amber-100 shrink-0">⚠️</div>
                              <div>
                                <h3 className="text-[11px] font-black text-amber-600 uppercase tracking-widest">Radar Fiscal Interrompido</h3>
                                <p className="text-slate-900 font-black text-xl tracking-tight">Falha de Comunicação</p>
                                <p className="text-slate-500 text-sm mt-1">O seu CNPJ ({userData.company.cnpj}) está configurado, mas os nossos servidores não conseguiram validar os dados agora. Tente novamente mais tarde.</p>
                              </div>
                            </div>
                          )}
                          {cndData && !isLoadingCnd && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                              {cndData.certidoes_pendentes === 0 && (
                                <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm overflow-hidden relative">
                                  <div className="absolute inset-0 bg-emerald-50/40 pointer-events-none"></div>
                                  <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row items-center gap-6 justify-between">
                                    <div className="flex items-center gap-5">
                                      <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl border border-emerald-200 shrink-0">🛡️</div>
                                      <div className="space-y-1.5">
                                        <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em]">Radar Fiscal Automático</h3>
                                        <p className="text-slate-900 font-black text-xl md:text-2xl tracking-tight leading-none">
                                          Organização <span className="text-emerald-700 bg-emerald-100/80 px-2 rounded-md">100% Regular</span>
                                        </p>
                                        <p className="text-slate-500 text-sm font-medium">Nenhuma pendência detetada. Apta para assinatura de contrato.</p>
                                      </div>
                                    </div>
                                    <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white border border-emerald-100 rounded-xl shadow-sm text-emerald-700 font-bold text-xs uppercase tracking-widest">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                      Monitorização Ativa
                                    </div>
                                  </div>
                                </div>
                              )}
                              {cndData.certidoes_pendentes > 0 && (
                                <>
                                  {userTier <= 1 ? (
                                    <div className="bg-white rounded-3xl border border-red-200 shadow-sm overflow-hidden relative group">
                                      <div className="absolute inset-0 bg-red-50/40 pointer-events-none"></div>
                                      <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row items-center gap-6 justify-between">
                                        <div className="flex items-center gap-5">
                                          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl shrink-0 border border-red-200 relative">
                                            <span className="relative z-10">🚨</span>
                                            <span className="absolute inset-0 rounded-2xl border-2 border-red-500 animate-ping opacity-20"></span>
                                          </div>
                                          <div className="space-y-1.5">
                                            <h3 className="text-[11px] font-black text-red-600 uppercase tracking-[0.2em]">Monitorização de Risco Fiscal</h3>
                                            <p className="text-slate-900 font-black text-xl md:text-2xl tracking-tight leading-none">
                                              Atenção: Você tem <span className="text-red-600 bg-red-100 px-2 rounded-md">{cndData.certidoes_pendentes} certidão(ões)</span> em risco.
                                            </p>
                                            <p className="text-slate-500 text-sm font-medium">Detectámos inconformidades reais. Risco iminente de inabilitação no PNCP.</p>
                                          </div>
                                        </div>
                                        <div className="flex flex-col w-full md:w-auto gap-2.5 shrink-0 mt-4 md:mt-0">
                                          <button onClick={() => setShowUpgradeModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-xl text-sm font-black transition-all shadow-lg flex items-center justify-center gap-2.5">
                                            <span className="text-lg">🔒</span> Revelar Certidões
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-white rounded-3xl border border-red-200 shadow-sm overflow-hidden relative">
                                      <div className="p-6 md:p-8">
                                        <div className="flex items-center gap-4 mb-6">
                                          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-2xl border border-red-200 shrink-0">🚨</div>
                                          <div>
                                            <h3 className="text-[11px] font-black text-red-600 uppercase tracking-[0.2em]">Monitorização Fiscal Automática</h3>
                                            <p className="text-slate-900 font-black text-xl tracking-tight">{cndData.certidoes_pendentes} Certidão(ões) com Pendência</p>
                                          </div>
                                        </div>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                          {cndData.detalhes.map((cert, idx) => (
                                            <div key={idx} className={`p-4 border rounded-xl flex flex-col gap-2 ${cert.status === 'REGULAR' ? 'bg-slate-50 border-slate-100' : 'bg-red-50/50 border-red-100'}`}>
                                              <span className="text-xs font-bold text-slate-700">{cert.orgao}</span>
                                              <div className="flex items-center justify-between">
                                                <span className={`text-[10px] px-2.5 py-1 rounded-md font-black uppercase tracking-widest ${cert.status === 'REGULAR' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{cert.status}</span>
                                                <span className="text-xs font-medium text-slate-500">Venc: {cert.vencimento}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* EXIBIÇÃO DO RISCO DO ÓRGÃO (Módulo PNCP) */}
                        {result.orgao_risk && (
                          (() => {
                            const isOffline = result.orgao_risk.score_pagamento === '-' || String(result.orgao_risk.status).includes('Falha');
                            const risco = result.orgao_risk.risco;
                            
                            let bgColor = 'bg-emerald-50 border-emerald-100';
                            let iconColor = 'text-emerald-500 border-emerald-100';
                            let textColor = 'text-emerald-700';
                            let icon = '✅';

                            if (isOffline) {
                              bgColor = 'bg-slate-50 border-slate-200'; iconColor = 'text-slate-500 border-slate-200'; textColor = 'text-slate-700'; icon = '📡'; 
                            } else if (risco === 'Alto Risco') {
                              bgColor = 'bg-red-50 border-red-100'; iconColor = 'text-red-500 border-red-100'; textColor = 'text-red-700'; icon = '🚨';
                            } else if (risco === 'Atenção') {
                              bgColor = 'bg-amber-50 border-amber-100'; iconColor = 'text-amber-500 border-amber-100'; textColor = 'text-amber-700'; icon = '⚠️';
                            }

                            return (
                              <div className={`mb-10 p-6 rounded-2xl border flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 ${bgColor}`}>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border bg-white ${iconColor}`}>
                                  <span className="text-xl">{icon}</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-1">
                                    <h3 className={`text-sm font-black uppercase tracking-widest ${textColor}`}>Radar de Pagamento (Órgão Público)</h3>
                                    {isOffline && (
                                       <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black rounded uppercase tracking-widest">SISTEMA DO GOVERNO OFFLINE</span>
                                    )}
                                  </div>
                                  {isOffline ? (
                                    <p className="text-slate-600 text-sm font-medium leading-relaxed">Não foi possível analisar o histórico de calotes deste órgão agora. Os servidores federais (PNCP) não estão a responder.</p>
                                  ) : (
                                    <p className="text-slate-700 text-sm font-medium leading-relaxed">
                                      Status histórico: <strong className="font-black">{result.orgao_risk.status}</strong>. 
                                      Pontuação de confiabilidade: <span className="bg-white/60 px-2 py-0.5 rounded border border-slate-200/50 font-mono">{result.orgao_risk.score_pagamento}/100</span>.
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        )}

                        {/* ========================================== */}
                        {/* 1. RESUMO EXECUTIVO E VANTAGEM COMPETITIVA */}
                        {/* ========================================== */}
                        <div className="grid lg:grid-cols-2 gap-6 mb-6">
                          <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 h-full">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <span className="text-lg">🎯</span> Resumo Executivo
                            </h3>
                            <p className="text-slate-700 leading-relaxed font-medium text-sm lg:text-base">{result.summary}</p>
                          </div>

                          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-8 rounded-[2rem] text-white shadow-xl h-full relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-colors"></div>
                            <h3 className="text-[10px] font-black text-violet-200 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                              <span className="text-lg">👑</span> Inteligência Competitiva
                            </h3>
                            <p className="text-white/90 leading-relaxed font-medium text-sm lg:text-base mb-6 relative z-10">
                              {result.recommendation}
                            </p>
                            {result.pricing_intelligence && (
                              <div className="mt-auto bg-black/20 p-5 rounded-2xl border border-white/10 relative z-10">
                                <h4 className="text-[10px] uppercase tracking-widest font-black text-violet-300 mb-2">Veredito Financeiro</h4>
                                <p className="text-sm font-bold text-emerald-300">{result.pricing_intelligence.financial_verdict}</p>
                                {result.pricing_intelligence.estimated_discount && (
                                  <p className="text-xs text-white/70 mt-1">Deságio Médio: {result.pricing_intelligence.estimated_discount}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 🔥 RADAR DE CONCORRENTES */}
                        {/* CENÁRIO A: USUÁRIO É TIER 4 (Exibe o Radar Real ou Empty State) */}
                        {userTier === 4 && result.concorrentes_provaveis && (
                          <div className="mb-6 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                              <span className="text-lg">⚔️</span> Radar de Ameaças (Top 5)
                            </h4>
                            
                            {/* Verificação: Tem concorrentes? Mostra o grid. Se não, mostra o alerta de sigilo. */}
                            {result.concorrentes_provaveis.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {result.concorrentes_provaveis.slice(0, 5).map((concorrente: any, idx: number) => {
                                  const probPercent = Math.round((concorrente.probabilidade || 0) * 100);
                                  const forcaTexto = String(concorrente.forca || '').toLowerCase();

                                  let theme = { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', bar: 'bg-slate-400' };
                                  if (forcaTexto.includes('alta') || forcaTexto.includes('forte')) {
                                    theme = { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', bar: 'bg-rose-500' };
                                  } else if (forcaTexto.includes('média') || forcaTexto.includes('media')) {
                                    theme = { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', bar: 'bg-amber-400' };
                                  } else if (forcaTexto.includes('baixa') || forcaTexto.includes('fraca')) {
                                    theme = { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', bar: 'bg-emerald-400' };
                                  }

                                  return (
                                    <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-3 transition-all hover:bg-white hover:shadow-md hover:border-slate-300 group">
                                      <div className="flex justify-between items-start">
                                        <span className="text-sm font-bold text-slate-800 line-clamp-1 pr-2 group-hover:text-violet-700 transition-colors">
                                          {idx + 1}. {concorrente.empresa}
                                        </span>
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded flex items-center gap-1.5 shrink-0 border ${theme.bg} ${theme.text} border-${theme.text.split('-')[1]}-200`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} ${forcaTexto.includes('alta') ? 'animate-pulse' : ''}`}></span>
                                          Força {concorrente.forca}
                                        </span>
                                      </div>
                                      <div>
                                        <div className="flex justify-between items-end mb-1.5">
                                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Probabilidade</span>
                                          <span className="text-xs font-black text-slate-700">{probPercent}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all duration-1000 ease-out ${theme.bar}`} style={{ width: `${probPercent}%` }}></div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              /* 🟢 O NOVO ESTADO VAZIO (EMPTY STATE) ESTRATÉGICO */
                              <div className="bg-slate-50 border-2 border-slate-200 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 bg-white text-slate-400 shadow-sm border border-slate-100 rounded-full flex items-center justify-center text-2xl mb-4">
                                  🕵️‍♂️
                                </div>
                                <h5 className="text-sm font-black text-slate-800 mb-2">Ponto Cego (Sigilo Governamental)</h5>
                                <p className="text-xs text-slate-500 font-medium max-w-md leading-relaxed">
                                  A base oficial de dados do PNCP ocultou a identidade dos vencedores recentes para este objeto. Os seus concorrentes atuarão nas sombras, sendo recomendado o foco absoluto no cálculo da sua margem de preço.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* CENÁRIO B: USUÁRIO NÃO É TIER 4 (Paywall / Upsell) */}
                        {userTier !== 4 && (
                          <div className="mb-6 relative overflow-hidden rounded-3xl border border-slate-200 bg-white group shadow-sm">
                            <div className="p-6">
                              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                                <span className="text-lg">⚔️</span> Radar de Ameaças (Top 5)
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 blur-[6px] select-none opacity-50">
                                <div className="h-[100px] bg-slate-100 border border-slate-200 rounded-xl"></div>
                                <div className="h-[100px] bg-slate-100 border border-slate-200 rounded-xl hidden md:block"></div>
                              </div>
                            </div>

                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] z-10 p-4">
                              <span className="text-3xl mb-3 drop-shadow-sm">🔒</span>
                              <p className="text-sm font-bold text-slate-800 mb-5 text-center max-w-md leading-relaxed">
                                O mapeamento preditivo de concorrentes é exclusivo do <br className="hidden md:block" />
                                <span className="text-violet-600 font-black">Plano Enterprise (Tier 4)</span>.
                              </p>
                              <button 
                                onClick={() => setShowUpgradeModal(true)}
                                className="px-8 py-3 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-violet-600 transition-all shadow-lg hover:shadow-violet-500/30 active:scale-95 flex items-center gap-2"
                              >
                                Desbloquear Radar 🚀
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ========================================== */}
                        {/* 2. PRAZOS E CRITÉRIOS DE JULGAMENTO        */}
                        {/* ========================================== */}
                        {((result.prazos && result.prazos.length > 0) || (result.criterios_de_julgamento && result.criterios_de_julgamento.length > 0)) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Bloco de Prazos */}
                            {result.prazos && result.prazos.length > 0 && (
                              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-violet-200 transition-colors">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                  ⏱️ Linha do Tempo
                                </h3>
                                <ul className="space-y-3">
                                  {result.prazos.map((prazo: string, idx: number) => (
                                    <li key={idx} className="text-sm text-slate-600 font-medium flex items-start gap-3">
                                      <span className="text-violet-500 mt-0.5 text-lg leading-none">•</span> {prazo}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Bloco de Critérios */}
                            {result.criterios_de_julgamento && result.criterios_de_julgamento.length > 0 && (
                              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                  ⚖️ Critério de Julgamento
                                </h3>
                                <ul className="space-y-3">
                                  {result.criterios_de_julgamento.map((criterio: string, idx: number) => (
                                    <li key={idx} className="text-sm text-slate-600 font-medium flex items-start gap-3">
                                      <span className="text-emerald-500 mt-0.5 text-lg leading-none">✓</span> {criterio}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ========================================== */}
                        {/* 3. MATRIZ DE DECISÃO (SWOT RÁPIDO)         */}
                        {/* ========================================== */}
                        {((result.vantagens && result.vantagens.length > 0) || (result.desvantagens && result.desvantagens.length > 0)) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            {/* Vantagens */}
                            <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
                              <h3 className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                👍 Vantagens Competitivas
                              </h3>
                              <ul className="space-y-3">
                                {result.vantagens?.map((vantagem: string, idx: number) => (
                                  <li key={idx} className="text-sm text-emerald-900 font-medium flex items-start gap-3">
                                    <span className="text-emerald-500 font-bold">＋</span> {vantagem}
                                  </li>
                                ))}
                                {(!result.vantagens || result.vantagens.length === 0) && (
                                  <li className="text-sm text-emerald-600/50 italic">Nenhuma vantagem clara detetada.</li>
                                )}
                              </ul>
                            </div>

                            {/* Desvantagens */}
                            <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100">
                              <h3 className="text-xs font-black text-orange-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                👎 Desvantagens & Barreiras
                              </h3>
                              <ul className="space-y-3">
                                {result.desvantagens?.map((desvantagem: string, idx: number) => (
                                  <li key={idx} className="text-sm text-orange-900 font-medium flex items-start gap-3">
                                    <span className="text-orange-500 font-bold">−</span> {desvantagem}
                                  </li>
                                ))}
                                {(!result.desvantagens || result.desvantagens.length === 0) && (
                                  <li className="text-sm text-orange-600/50 italic">Nenhuma barreira aparente.</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* ========================================== */}
                        {/* 4. REQUISITOS OPERACIONAIS                 */}
                        {/* ========================================== */}
                        {((result.exigencias_criticas && result.exigencias_criticas.length > 0) || (result.documentos_necessarios && result.documentos_necessarios.length > 0)) && (
                          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
                            <div className="p-6 border-b border-slate-100 bg-slate-50">
                              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Carga Operacional</h3>
                              <p className="text-slate-900 font-black text-lg">Exigências & Documentação Obrigatória</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                              <div className="p-6 md:p-8">
                                <h4 className="text-xs font-bold text-slate-800 mb-5 flex items-center gap-2">📌 Exigências Críticas</h4>
                                <ul className="space-y-4">
                                  {result.exigencias_criticas?.map((exigencia: string, idx: number) => (
                                    <li key={idx} className="text-sm text-slate-600 font-medium flex items-start gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0"></div>
                                      {exigencia}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="p-6 md:p-8">
                                <h4 className="text-xs font-bold text-slate-800 mb-5 flex items-center gap-2">📁 Documentos Chave</h4>
                                <ul className="space-y-4">
                                  {result.documentos_necessarios?.map((doc: string, idx: number) => (
                                    <li key={idx} className="text-sm text-slate-600 font-medium flex items-start gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0"></div>
                                      {doc}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ========================================== */}
                        {/* 5. MATRIZ DE RISCO                         */}
                        {/* ========================================== */}
                        {(result.risks?.length ?? 0) > 0 && (
                          <div className="mb-12 animate-in fade-in slide-in-from-top-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2 flex items-center gap-2">
                              <span className="text-lg">🛡️</span> Matriz de Riscos Críticos
                            </h3>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {result.risks?.map((risk: any, i: number) => {
                                const tituloRisk = typeof risk === 'string' ? risk : (risk.title || risk.risk || risk.perigo || risk.nome || risk.titulo);
                                const trechoRisk = risk.quote || risk.snippet || risk.texto || risk.trecho;
                                const impactoRisk = risk.impact || risk.consequence || risk.impacto || risk.consequencia || risk.descricao;

                                return (
                                  <div key={i} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-red-200 hover:shadow-md transition-all group relative overflow-hidden flex flex-col">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                                    <div className="flex items-start justify-between mb-4">
                                      <span className="px-2.5 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-100">
                                        Alto Risco
                                      </span>
                                    </div>
                                    <h4 className="font-black text-slate-900 mb-3 leading-snug text-sm">
                                      {tituloRisk || "Risco Identificado"}
                                    </h4>
                                    {trechoRisk && (
                                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                                        <p className="text-[11px] text-slate-600 font-medium italic leading-relaxed">"{trechoRisk}"</p>
                                      </div>
                                    )}
                                    {impactoRisk && (
                                      <p className="text-xs text-slate-500 font-medium mt-auto pt-2 border-t border-slate-50">
                                        <strong className="text-red-700">Impacto:</strong> {impactoRisk}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ========================================== */}
                        {/* 6. CHECKLIST DE AÇÃO                       */}
                        {/* ========================================== */}
                        {(result.checklist?.length ?? 0) > 0 && (
                          <div className="animate-in fade-in slide-in-from-top-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2 flex items-center gap-2">
                              <span className="text-lg">📋</span> Plano de Ação (Checklist)
                            </h3>
                            <div className="space-y-3">
                              {result.checklist?.map((item: any, i: number) => {
                                const titulo = typeof item === 'string' ? item : (item.title || item.task || item.item || item.tarefa || item.acao || item.nome);
                                const descricao = typeof item === 'object' ? (item.quote || item.description || item.descrição || item.detalhe || item.contexto || item.obs) : null;

                                return (
                                  <div key={i} className="flex gap-4 p-5 bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-300 rounded-2xl transition-all shadow-sm group">
                                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 group-hover:border-violet-500 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                                      <span className="text-[10px] font-black text-slate-400 group-hover:text-violet-500">{i + 1}</span>
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-slate-900 text-sm mb-1">{titulo || "Ação Recomendada"}</h4>
                                      {descricao && descricao !== titulo && (
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed">{descricao}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* RODAPÉ DO RESULTADO COM METADADOS */}
                        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium">
                          <div className="flex items-center gap-2">
                            <span>Gerado por:</span>
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold uppercase tracking-widest">{modelSource || 'Motor Bawzi IA'}</span>
                          </div>
                          {isCachedResult && (
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                              <span className="text-sm">⚡</span>
                              <span className="font-bold uppercase tracking-widest text-[10px]">Recuperado do Cache (Ultrarrápido)</span>
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
                      // Quando ele clicar em refazer, voltamos à tela inicial com o texto pronto
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
                     <UserProfileCard user={userData} currentTier={userTier} />
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
              
              {/* Box: Inteligência de Avaliação Neural */}
              <div className="bg-slate-950 rounded-[2.5rem] p-8 text-white shadow-2xl border border-slate-800 relative overflow-hidden group">
                {/* Efeitos de Fundo (Glow Estático) */}
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
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-xs font-black text-violet-400 group-hover/item:border-violet-500 group-hover/item:bg-violet-500/10 transition-all duration-300">
                      01
                    </div>
                    <div className="space-y-1">
                      <strong className="text-white block text-sm font-black tracking-tight group-hover/item:text-violet-300 transition-colors">
                        Veredito Go/No-Go
                      </strong> 
                      <p className="text-slate-400 text-xs leading-relaxed font-medium">
                        Cálculo probabilístico de lucro e viabilidade real para evitar "barcas furadas".
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-5 group/item">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-xs font-black text-amber-400 group-hover/item:border-amber-500 group-hover/item:bg-amber-500/10 transition-all duration-300">
                      02
                    </div>
                    <div className="space-y-1">
                      <strong className="text-white block text-sm font-black tracking-tight group-hover/item:text-amber-300 transition-colors">
                        Blindagem Jurídico-Financeira
                      </strong> 
                      <p className="text-slate-400 text-xs leading-relaxed font-medium">
                        Identificação imediata de multas abusivas, prazos irreais e armadilhas contratuais.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-5 group/item">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-xs font-black text-emerald-400 group-hover/item:border-emerald-500 group-hover/item:bg-emerald-500/10 transition-all duration-300">
                      03
                    </div>
                    <div className="space-y-1">
                      <strong className="text-white block text-sm font-black tracking-tight group-hover/item:text-emerald-300 transition-colors">
                        Neural Matchmaker
                      </strong> 
                      <p className="text-slate-400 text-xs leading-relaxed font-medium">
                        Cruzamento semântico entre o objeto do edital e o seu CNAE/Capacidade Técnica.
                      </p>
                    </div>
                  </li>
                </ul>

                {/* Footer do Card */}
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

      {/* --- MODAL DE AUTENTICAÇÃO --- */}
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
              <p className="text-slate-500 text-sm mt-2 px-4 font-medium font-medium">
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

      {/* O modal de partilha agora está FORA do AuthModal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 to-indigo-600"></div>
            
            <button 
              onClick={() => setShowShareModal(false)} 
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors text-2xl font-bold bg-slate-50 w-8 h-8 rounded-full flex items-center justify-center"
            >
              &times;
            </button>
            
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center text-3xl mb-6 border border-violet-100">
                📧
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
                Enviar para C-Level
              </h2>
              <p className="text-slate-500 text-sm mt-2 px-4 font-medium leading-relaxed">
                Partilhe esta análise estratégica diretamente com os tomadores de decisão da sua empresa.
              </p>
            </div>

            <div className="space-y-4">
              <input 
                type="email" 
                placeholder="E-mail do destinatário..." 
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none bg-slate-50 transition-all font-bold text-slate-700"
              />
              <button 
                onClick={confirmShare}
                disabled={isSharing}
                className="w-full py-4 bg-slate-900 text-white font-black rounded-xl hover:bg-violet-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSharing ? 'A enviar...' : 'Enviar Relatório Estratégico 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />}
    </div> 
  );
}