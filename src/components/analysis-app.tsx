'use client';

import { useState, useEffect } from 'react';
import { fetchUserProfile } from '../services/api';
import CompanyProfileForm from './CompanyProfileForm';
import Image from 'next/image';
import UserProfileCard from './UserProfileCard';
import HistoryTab from './HistoryTab';
import { useRouter } from 'next/navigation';
import PricingSection from './PricingSection';
import PncpSearch from '../components/PncpSearch';
import UpgradeModal from './UpgradeModal';

// --- Interfaces ---

interface PricingIntelligence {
  estimated_discount: string;
  market_analysis: string;
  financial_verdict: string;
}

interface HighlightItem { title: string; quote: string; }

// 🟢 Nova interface adicionada para o risco do órgão
interface OrgaoRisk {
  risco: string;
  score_pagamento: number | string; 
  status: string;
}

interface AnalysisResult {
  title: string; summary: string; score: number; classification: string;
  effort: string; estimated_value: string; recommendation: string;
  rationale: string; 
  risks: any[]; 
  checklist: any[]; 
  pricing_intelligence?: PricingIntelligence;
  orgao_risk?: OrgaoRisk; 
}

// --- Utilitários ---
const getScoreColor = (score: number) => score >= 70 ? 'text-emerald-600 border-emerald-500' : score >= 45 ? 'text-amber-500 border-amber-400' : 'text-red-600 border-red-500';
const getScoreBg = (score: number) => score >= 70 ? 'bg-emerald-50' : score >= 45 ? 'bg-amber-50' : 'bg-red-50';
const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

export default function AnalysisApp() {
  const [activeTab, setActiveTab] = useState('workspace');
  const router = useRouter();
  
  // URL base movida para o topo para ser acessível pelos Hooks
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
  // REGRAS DINÂMICAS (Sincronizadas com o Backend)
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
  // EFEITOS (Sincronização e Validação)
  // ==========================================

  // 1. Vai buscar as configurações exatas dos limites ao Backend (SSOT)
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
      .catch(err => console.error("⚠️ Usando limites locais. Erro ao buscar tiers:", err));
  }, [API_URL]);

  // 2. Valida Token e Dados do Utilizador
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('bawzi_token');
      
      if (savedToken) {
        setToken(savedToken);

        fetchUserProfile(savedToken).then(user => {
          setUserData(user);

          if (user.tier !== undefined) {
            setUserTier(user.tier); 
            localStorage.setItem('bawzi_tier', user.tier.toString());
          }
        }).catch(() => logout());
      }
    }
  }, []);

  // 3. Efeito Visual de Loading
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

  // 4. Log de Acesso e Sincronização do Workspace
  useEffect(() => {
    const fetchAndLogUser = async () => {
      try {
        const token = localStorage.getItem('bawzi_token'); 
        if (!token) return;

        const headers = { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        const [userRes, wsRes] = await Promise.all([
          fetch(`${API_URL}/api/users/me`, { headers }),
          fetch(`${API_URL}/api/workspace/details`, { headers })
        ]);

        if (userRes.ok && wsRes.ok) {
          const userDataInfo = await userRes.json();
          const wsData = await wsRes.json();

          // 🟢 A CORREÇÃO ESTÁ AQUI: Guarda os dados do Workspace no estado
          setUserData((prev: any) => ({
            ...prev,
            ...userDataInfo,
            workspace_users_count: wsData.workspace_users_count,
            vagas_totais: wsData.vagas_totais,
            company: wsData.company || prev?.company
          }));

          console.group('%c🚀 [Bawzi] Acesso Validado', 'color: #8b5cf6; font-size: 14px; font-weight: bold;');
          console.log(`👤 Nome: %c${userDataInfo.name || userDataInfo.email}`, 'font-weight: bold; color: #334155');
          console.log(`⭐ Tier: %c${wsData.tier}`, 'font-weight: bold; color: #f59e0b');
          console.log(`👥 Vagas Usadas: ${wsData.workspace_users_count} de ${wsData.vagas_totais}`);
          console.groupEnd();
        }
      } catch (error) {
        console.error("Erro ao sincronizar dados:", error);
      }
    };

    fetchAndLogUser();
  }, [API_URL]);

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

  const handleShare = async () => {
    if (!analysisId) return;

    const targetEmail = prompt("Para qual e-mail deseja enviar esta análise?");
    if (!targetEmail || !targetEmail.includes('@')) {
      if (targetEmail) alert("E-mail inválido.");
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
        body: JSON.stringify({ target_email: targetEmail })
      });

      if (res.ok) {
        alert("✅ Análise partilhada com sucesso!");
      } else {
        const errorData = await res.json();
        alert(`Erro: ${errorData.detail || 'Falha ao partilhar.'}`);
      }
    } catch (error) {
      alert("❌ Erro de comunicação com o servidor.");
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

      if (response.status === 402) {
        setShowUpgradeModal(true);
        setIsAnalyzing(false);     
        return;                    
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || 'Erro no servidor.');
      }

      setResult(data.analysis);
      setAnalysisId(data.id); 
      setModelSource(data.model_source);
      setIsCachedResult(data.is_cached);

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

  const logout = () => {
    localStorage.clear();
    window.location.reload();
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
                          <div className="w-14 h-14 bg-white text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 text-2xl shadow-sm border border-indigo-50">
                            📡
                          </div>
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

                        {/* O Seu Componente PncpSearch continua a renderizar aqui dentro */}
                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                          <PncpSearch 
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
                          <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-violet-100">
                            📄
                          </div>
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
                          
                          {/* Caixa de Texto */}
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

                          {/* Área de Upload (Drag & Drop) */}
                          <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-violet-400 hover:bg-violet-50/50 transition-all group flex flex-col items-center justify-center gap-3 overflow-hidden w-full bg-slate-50/50">
                            <input type="file" multiple accept=".pdf,.txt" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <div className="w-14 h-14 bg-white shadow-sm border border-slate-100 group-hover:border-violet-200 group-hover:bg-violet-100 group-hover:text-violet-600 text-slate-400 rounded-full flex items-center justify-center text-2xl transition-colors">📂</div>
                            <div>
                                <h4 className="text-sm font-black text-slate-700 group-hover:text-violet-700">Arraste documentos ou clique aqui</h4>
                                <p className="text-xs text-slate-400 font-medium mt-1">Suporta PDF ou TXT até {currentFileLimitMB}MB.</p>
                            </div>
                          </div>

                          {/* Ficheiros Anexados */}
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

                          {/* Botão de Submissão */}
                          <button type="submit" disabled={isAnalyzing || isOverLimit} className="w-full bg-slate-900 text-white font-black text-base md:text-lg py-5 rounded-2xl shadow-xl hover:bg-violet-600 hover:shadow-violet-600/30 transition-all duration-300 disabled:opacity-50 disabled:hover:bg-slate-900 disabled:cursor-not-allowed relative overflow-hidden group">
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                            <span className="relative flex items-center justify-center gap-3">
                              {isAnalyzing ? "A Extrair Inteligência..." : "Iniciar Análise Estratégica"}
                              {!isAnalyzing && <span className="group-hover:translate-x-1 transition-transform">🚀</span>}
                            </span>
                          </button>
                        </form>
                      </div>
                    </>
                  ) : isAnalyzing ? (
                    // --- LOADING ESTADO (Mantido igual) ---
                    <div id="area-loading" className="...">...</div>
                  ) : (
                    // --- RESULTADO ESTADO (Mantido igual) ---
                    <div className="..." id="area-resultados">...</div>
                  )}
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
                  {token ? <HistoryTab token={token} /> : (
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
              
              {/* Botões de Navegação */}
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

              {/* Card de Identidade Estratégica */}
              {token && userData ? (
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span> 
                    Identidade Estratégica
                  </h3>
                  
                  {/* Container do Perfil */}
                  <div className="space-y-4">
                     <UserProfileCard user={userData} currentTier={userTier} />
                     {/* Nota: Pode precisar de ajustar o UserProfileCard internamente se ele já tiver muitas bordas, 
                         mas o container exterior agora é muito mais limpo */}
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
              
              {/* Box: Como a IA Avalia */}
              <div className="bg-slate-950 rounded-[2.5rem] p-8 text-white shadow-2xl border border-slate-800 relative overflow-hidden">
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-violet-600/20 blur-[50px] rounded-full pointer-events-none"></div>
                <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-600/10 blur-[50px] rounded-full pointer-events-none"></div>
                
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 relative z-10 flex items-center gap-2">
                  <span className="text-violet-400 text-lg">⚡</span> Como a IA avalia
                </h4>
                
                <ul className="space-y-6 relative z-10">
                  <li className="flex items-start gap-4 group">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-xs font-black text-slate-300 group-hover:bg-violet-900/50 group-hover:border-violet-500/50 group-hover:text-violet-300 transition-colors">1</div>
                    <span className="leading-relaxed font-medium mt-0.5">
                      <strong className="text-white block text-sm mb-0.5">Veredito Go/No-Go</strong> 
                      <span className="text-slate-400 text-xs">Viabilidade real de ganho.</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-4 group">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-xs font-black text-slate-300 group-hover:bg-amber-900/50 group-hover:border-amber-500/50 group-hover:text-amber-300 transition-colors">2</div>
                    <span className="leading-relaxed font-medium mt-0.5">
                      <strong className="text-white block text-sm mb-0.5">Riscos Ocultos</strong> 
                      <span className="text-slate-400 text-xs">Multas abusivas e prazos irreais.</span>
                    </span>
                  </li>
                  <li className="flex items-start gap-4 group">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-xs font-black text-slate-300 group-hover:bg-emerald-900/50 group-hover:border-emerald-500/50 group-hover:text-emerald-300 transition-colors">3</div>
                    <span className="leading-relaxed font-medium mt-0.5">
                      <strong className="text-white block text-sm mb-0.5">Matchmaker</strong> 
                      <span className="text-slate-400 text-xs">Cruzamento com o seu CNAE.</span>
                    </span>
                  </li>
                </ul>
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
            
            {authError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                <span className="text-xl leading-none">⚠️</span>
                <p className="text-sm font-medium leading-relaxed">{authError}</p>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'register' && (
                <input type="text" required placeholder="Nome completo" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium" />
              )}
              <input type="email" required placeholder="E-mail profissional" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium" />
              <input type="password" required placeholder="Palavra-passe" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium" />
              
              <button type="submit" disabled={authLoading} className="w-full py-4 mt-2 bg-slate-950 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50">
                {authLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    A processar...
                  </div>
                ) : authMode === 'register' ? 'Começar Gratuitamente' : 'Entrar na Conta'}
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
    {showUpgradeModal && <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />}
    </div> 
  );
}