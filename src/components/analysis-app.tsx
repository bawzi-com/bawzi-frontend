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
interface AnalysisResult {
  title: string; summary: string; score: number; classification: string;
  effort: string; estimated_value: string; recommendation: string;
  rationale: string; 
  risks: any[]; 
  checklist: any[]; 
  pricing_intelligence?: PricingIntelligence;
}

  // --- Utilitários ---
  const getScoreColor = (score: number) => score >= 70 ? 'text-emerald-600 border-emerald-500' : score >= 45 ? 'text-amber-500 border-amber-400' : 'text-red-600 border-red-500';
  const getScoreBg = (score: number) => score >= 70 ? 'bg-emerald-50' : score >= 45 ? 'bg-amber-50' : 'bg-red-50';
  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

export default function AnalysisApp() {
  const [activeTab, setActiveTab] = useState('workspace');

  // ==========================================
  // ESTADOS
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
  const router = useRouter();

// ==========================================
  // REGRAS ALINHADAS COM O MARKETING
  // ==========================================
  // Tier -1 = Nível 0 do Marketing (Anónimo/Sem conta)
  // Tier 1  = Nível 1 do Marketing (Conta Grátis Criada)
  const TIER_LIMITS: Record<number, number> = { [-1]: 10000, 1: 20000, 2: 60000, 3: 150000, 4: 300000 };
  const TIER_FILE_LIMITS_MB: Record<number, number> = { [-1]: 3, 1: 5, 2: 10, 3: 20, 4: 50 };

  const currentCharLimit = TIER_LIMITS[userTier] || 3000;
  const currentFileLimitMB = TIER_FILE_LIMITS_MB[userTier] || 1;
  const currentFileLimitBytes = currentFileLimitMB * 1024 * 1024;

  const totalFileSize = files.reduce((acc, file) => acc + file.size, 0);
  const isOverTextLimit = text.length > currentCharLimit;
  const isOverFileLimit = totalFileSize > currentFileLimitBytes;
  const textPercentage = (text.length / currentCharLimit) * 100;
  const filePercentage = (totalFileSize / currentFileLimitBytes) * 100;
  const requiresAuth = (!token) && (hasUsedFreeTrial);
  const isOverLimit = isOverTextLimit || isOverFileLimit;
  const [isCachedResult, setIsCachedResult] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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

  // ==========================================
  // ÍMAN DO LOADING: Foca a câmara no Robô
  // ==========================================
  useEffect(() => {
    if (isAnalyzing) {
      // Damos 100ms para o React desenhar o robô na tela antes de rolar
      setTimeout(() => {
        const loadingEl = document.getElementById('area-loading');
        if (loadingEl) {
          // O block: 'center' garante que o robô fica exatamente no meio do ecrã
          loadingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [isAnalyzing]);

const handleAnalyze = async () => {
    // 1. Validações Iniciais
    if (requiresAuth) { setAuthMode('register'); setShowAuthModal(true); return; }
    if (!text.trim() && files.length === 0) { setError("Cole o texto ou adicione documentos."); return; }
    if (isOverLimit) { window.location.href = '#planos'; return; }

    setIsAnalyzing(true); 
    setError(null); 
    setResult(null); 
    setIsCachedResult(false);
    
    // Foca no Loading
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
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Usando a variável de ambiente (mantendo o localhost como fallback)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST', 
        headers: headers, 
        body: formData,
      });

      // ==========================================
      // 🟢 O PONTO DE INTERCEÇÃO (PAYWALL PLG)
      // ==========================================
      if (response.status === 402) {
        setShowUpgradeModal(true); // Abre o popup
        setIsAnalyzing(false);     // Para o loading
        return;                    // Aborta a execução para não dar erro no ecrã
      }

      // Se houver outro erro (ex: 500, 400), disparamos para cair no catch
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Falha ao analisar o edital.");
      }

      // Se passou por tudo, é porque foi SUCESSO (Status 200)
      const data = await response.json();

      // --- VERIFICAÇÃO DE ERROS E PAYWALL ---
      if (!response.ok) {
        if (response.status === 402) {
          // Gatilho do Modal de Upgrade
          setShowUpgradeModal(true);
          setIsAnalyzing(false);
          return; // Para aqui
        }
        throw new Error(data?.detail || 'Erro no servidor.');
      }

      // --- SUCESSO: ATRIBUIÇÃO DOS RESULTADOS ---
      setResult(data.analysis);
      setModelSource(data.model_source);
      setIsCachedResult(data.is_cached);

      // Desliza para os resultados
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

      const response = await fetch(`http://localhost:8000${endpoint}`, {
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
      const response = await fetch('http://localhost:8000/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tier }),
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url; 
    } catch (err) { alert("Erro ao iniciar processo de pagamento."); }
  };

// Função para limpar dados e voltar ao início da submissão
  const handleResetAnalysis = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    // 1. Puxa a câmara instantaneamente para o topo ANTES da página encolher
    window.scrollTo({ top: 0, behavior: 'instant' });

    // 2. Limpa os estados (a página vai encolher agora, mas nós já estamos no topo seguro)
    setResult(null);
    setText('');
    setFiles([]);
    setActiveTab('workspace');

    // 3. Rola suavemente para focar o Radar / Área de Submissão com elegância
    setTimeout(() => {
      // Tenta encontrar o Radar, se não encontrar, foca na caixa de texto
      const target = document.getElementById('radar-pncp-section') || document.getElementById('area-submissao');
      
      if (target) {
        // Calcula a posição com um respiro de 80px do topo para ficar perfeito na vista
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

      {/* BACKGROUND EFFECTS */}
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-violet-200/50 to-transparent rounded-full blur-[100px]"></div>
      </div>

      <main>
        {/* ========================================== */}
        {/* 1. HERO SECTION (APENAS MARKETING E MOCKUP)*/}
        {/* ========================================== */}
        <div className="relative pt-20 pb-16 lg:pt-28 lg:pb-20 overflow-hidden bg-slate-50">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-gradient-to-br from-violet-200/50 to-indigo-100/50 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="container mx-auto px-4 relative z-10 max-w-[1400px]">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              
              {/* Textos de Marketing */}
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-800 text-xs font-black uppercase tracking-widest mb-8 border border-violet-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
                  </span>
                  Multi-LLM Routing Ativado
                </div>

                <h1 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.05] mb-6 animate-in fade-in slide-in-from-bottom-5 delay-150">
                  Pare de perder tempo com <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">editais sem futuro.</span>
                </h1>

                <p className="text-xl text-slate-600 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-6 delay-300 max-w-lg">
                  O motor da Bawzi analisa contratos em segundos, identificando riscos ocultos e sugerindo a estratégia certa para a sua empresa.
                </p>
              </div>

              {/* Mockup Flutuante da IA */}
              <div className="hidden lg:block relative perspective-1000">
                <div className="relative w-full max-w-lg mx-auto transform rotate-[-2deg] hover:rotate-0 transition-transform duration-700 ease-out">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-indigo-500 transform translate-x-4 translate-y-6 rounded-[3rem] blur-2xl opacity-30"></div>
                  
                  <div className="relative bg-white/90 backdrop-blur-xl border border-white p-8 rounded-[3rem] shadow-2xl pointer-events-none">
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl font-black">98</div>
                        <div>
                          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Score de Viabilidade</h3>
                          <p className="text-lg font-bold text-emerald-600">Avançar com Força</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg border border-slate-200">Llama 4 Scout</div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 font-bold">💡</div>
                        <div>
                          <h4 className="font-bold text-slate-900 mb-1">Estratégia Vencedora</h4>
                          <div className="h-2 w-full bg-slate-100 rounded-full mb-2"></div>
                          <div className="h-2 w-3/4 bg-slate-100 rounded-full"></div>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center shrink-0 font-bold">!</div>
                        <div>
                          <h4 className="font-bold text-amber-900 mb-1">Risco Logístico Identificado</h4>
                          <p className="text-sm text-amber-700/80 font-medium">Custo de frete não considerado na margem base do edital.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute -right-8 -bottom-8 bg-slate-950 text-white p-5 rounded-3xl shadow-xl border border-slate-800 transform rotate-[5deg]">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">Previsão PNCP</span>
                      <span className="text-2xl font-black">R$ 14.350</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. SECÇÃO PRINCIPAL DO DASHBOARD           */}
        {/* ========================================== */}
        <section className="max-w-[1400px] mx-auto px-6 py-8 relative z-10">
          <div className="grid md:grid-cols-[1fr_350px] gap-8 md:gap-12 items-start">
            
            {/* COLUNA ESQUERDA: ÁREA DINÂMICA (WORKSPACE OU HISTÓRICO) */}
            <div className="flex flex-col gap-8">
              
              {/* 🟢 ABA 1: WORKSPACE */}
              {activeTab === 'workspace' && (
                <div className="animate-in fade-in duration-500 flex flex-col gap-8">
                  
                  {!isAnalyzing && !result ? (
                    <>
                      {/* --- BLOCO 1: RADAR PNCP --- */}
                      <div id="radar-pncp-section" className="mb-8 animate-in fade-in slide-in-from-bottom-4">
                        
                        {/* TOAST INFORMATIVO: O QUE É O PNCP */}
                        <div className="mb-4 p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl flex items-start sm:items-center gap-4 text-indigo-900 shadow-sm transition-all hover:bg-indigo-50">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0 text-lg shadow-inner border border-indigo-200/50">
                            ℹ️
                          </div>
                          <div>
                            <h4 className="text-sm font-black mb-0.5">O que é o Radar PNCP?</h4>
                            <p className="text-xs font-medium text-indigo-700/90 leading-relaxed">
                              O <strong>Portal Nacional de Contratações Públicas (PNCP)</strong> é a base de dados oficial do Governo. Busque licitações em tempo real e envie o edital para a nossa IA analisar com apenas um clique.
                            </p>
                          </div>
                        </div>

                        {/* COMPONENTE DE BUSCA */}
                        <PncpSearch 
                          onAnalyzeOportunity={(textoSimulado: string) => {
                            setText(textoSimulado);
                            setFiles([]);
                            document.getElementById('area-submissao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }} 
                        />
                      </div>

                      {/* --- BLOCO 2: FORMULÁRIO DE SUBMISSÃO --- */}
                      <div id="area-submissao" className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-6 md:p-8 relative z-20 border-t-4 border-t-violet-500">
                        <h2 className="text-xl font-black text-slate-900 mb-6 border-b border-slate-100 pb-4 flex items-center gap-3">
                          <span className="text-2xl">📄</span> Nova Submissão Direta
                        </h2>

                        {/* Aviso Modo Anónimo */}
                        {!token && (
                          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center text-xl shrink-0">🕵️</div>
                              <div>
                                <h4 className="text-sm font-black text-slate-900">Modo Anónimo Ativo</h4>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Inicie sessão para guardar histórico e ativar o Matchmaker de CNAE.</p>
                              </div>
                            </div>
                            <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className="px-4 py-2 bg-white text-slate-900 text-sm font-bold rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors shrink-0">
                              Entrar na Conta
                            </button>
                          </div>
                        )}

                        {/* Erros de Limite/Envio */}
                        {error && (
                          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                            <span className="text-xl leading-none">⚠️</span>
                            <p className="text-sm font-medium leading-relaxed">{error}</p>
                          </div>
                        )}

                        <form onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }} className="space-y-5">
                          {/* Textarea */}
                          <div className="relative group">
                            <div className="absolute top-4 left-4 text-slate-400 group-focus-within:text-violet-500 transition-colors">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            </div>
                            <textarea 
                              value={text} 
                              onChange={handleTextChange}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 pt-4 pb-12 focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all resize-none min-h-[160px] text-slate-700 font-medium placeholder:text-slate-400 outline-none" 
                              placeholder="Cole o texto do edital aqui para uma análise profunda..."
                            ></textarea>
                            <div className="absolute bottom-4 right-4 text-xs font-bold text-slate-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md">
                              <span className={text.length >= currentCharLimit ? 'text-red-500' : ''}>{text.length.toLocaleString()}</span> <span className="opacity-50">/ {currentCharLimit.toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Drag & Drop Arquivos */}
                          <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-violet-400 hover:bg-violet-50/50 transition-all group flex flex-col items-center justify-center gap-2 overflow-hidden">
                            <input type="file" multiple accept=".pdf,.txt" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="w-12 h-12 bg-slate-100 group-hover:bg-violet-100 group-hover:text-violet-600 text-slate-400 rounded-full flex items-center justify-center text-xl transition-colors">📂</div>
                            <h4 className="text-sm font-bold text-slate-700 group-hover:text-violet-700">Arraste documentos ou clique aqui</h4>
                            <p className="text-xs text-slate-400 font-medium">Suporta PDF ou TXT até {currentFileLimitMB}MB.</p>
                          </div>

                          {/* Lista de Arquivos */}
                          {files.length > 0 && (
                            <div className="space-y-2">
                              {files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-violet-50 text-violet-900 text-sm font-bold border border-violet-100 rounded-xl">
                                  <span className="truncate flex-1">📄 {file.name}</span>
                                  <div className="flex items-center gap-4 shrink-0">
                                    <span className="opacity-60 text-xs">{formatMB(file.size)} MB</span>
                                    <button type="button" onClick={() => removeFile(idx)} className="text-violet-400 hover:text-red-500 text-lg transition-colors">&times;</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Botão Analisar */}
                          <button type="submit" disabled={isAnalyzing || isOverLimit} className="w-full bg-slate-950 text-white font-black text-lg py-4 rounded-xl shadow-xl shadow-slate-950/20 hover:bg-violet-600 hover:shadow-violet-600/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                            <span className="relative flex items-center justify-center gap-2">
                              {isAnalyzing ? "A Extrair Inteligência..." : "Iniciar Análise Estratégica"}
                              {!isAnalyzing && <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
                            </span>
                          </button>
                        </form>
                      </div>
                    </>
                  ) : isAnalyzing ? (
                    // ==========================================
                    // ESTADO DE LOADING (DURANTE A ANÁLISE)
                    // ==========================================
                    <div 
                      id="area-loading" 
                      className="bg-white rounded-[2.5rem] p-16 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 animate-in fade-in flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-[scan_2s_ease-in-out_infinite]"></div>
                      <div className="relative w-24 h-24 mb-10">
                        <div className="absolute inset-0 border-4 border-violet-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-violet-500 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-2 bg-violet-50 rounded-full flex items-center justify-center shadow-inner">
                          <span className="text-4xl animate-bounce">🤖</span>
                        </div>
                      </div>
                      <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Extraindo Inteligência...</h3>
                      <p className="text-slate-500 font-medium text-center max-w-md text-lg">
                        Os nossos modelos estão a ler as entrelinhas e a cruzar dados jurídicos. Isto leva apenas alguns segundos.
                      </p>
                      
                      {/* Barras de escaner falsas para dar aspeto de "A trabalhar" */}
                      <div className="w-full max-w-md mt-12 space-y-4 opacity-40">
                        <div className="h-3 bg-slate-200 rounded-full animate-pulse"></div>
                        <div className="h-3 bg-slate-200 rounded-full animate-pulse w-5/6 delay-75"></div>
                        <div className="h-3 bg-slate-200 rounded-full animate-pulse w-4/6 delay-150"></div>
                      </div>
                    </div>
                  ) : result ? (
                    // ESTADO DE RESULTADO (APÓS ANÁLISE)
                    <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500" id="area-resultados">
                      <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-xl border border-slate-100 flex flex-col md:flex-row gap-8 items-start relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${(result?.score || 0) >= 70 ? 'bg-emerald-500' : (result?.score || 0) >= 45 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-4">
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg uppercase tracking-widest border border-slate-200">Motor da IA: {modelSource || "Bawzi"}</span>
                            {result?.effort && (
                              <span className="text-[10px] font-black text-violet-700 bg-violet-50 px-3 py-1.5 rounded-lg uppercase tracking-widest border border-violet-100">Esforço: {result.effort}</span>
                            )}
                          </div>

                          {isCachedResult && (
                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 animate-in fade-in slide-in-from-top-4 shadow-sm">
                              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-xl shrink-0">⚡</div>
                              <div>
                                <strong className="block text-sm font-black">Recuperação Instantânea</strong>
                                <p className="text-sm font-medium text-emerald-700/90">Este edital já foi processado. O parecer foi carregado do histórico.</p>
                              </div>
                            </div>
                          )}
                          
                          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 leading-tight">{result?.title || result?.classification}</h2>
                          
                          <div className="flex items-center gap-2 mb-6">
                            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${result?.classification?.includes('Força') ? 'bg-green-100 text-green-700' : result?.classification?.includes('Atenção') ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {result?.classification}
                            </span>
                          </div>

                          <p className="text-slate-600 text-lg leading-relaxed">{result?.summary}</p>
                          
                          {result?.estimated_value && (
                            <div className="mt-6 inline-flex items-center gap-3 text-slate-600 font-bold text-sm bg-slate-50 px-5 py-3 rounded-xl border border-slate-200 shadow-sm">
                              <span className="text-xl">💰</span>
                              <span>Valor Estimado: <span className="text-slate-900">{result.estimated_value}</span></span>
                            </div>
                          )}
                        </div>

                        <div className={`shrink-0 self-center md:self-start min-w-[150px] h-[150px] rounded-[2rem] border-4 flex flex-col items-center justify-center shadow-lg ${(result?.score || 0) >= 70 ? 'text-emerald-600 border-emerald-500 bg-emerald-50' : (result?.score || 0) >= 45 ? 'text-amber-500 border-amber-400 bg-amber-50' : 'text-red-600 border-red-500 bg-red-50'}`}>
                          <span className="text-6xl font-black leading-none tracking-tighter">{result?.score || 0}</span>
                          <span className="text-xs font-black uppercase mt-2 tracking-widest opacity-60">Score</span>
                        </div>
                      </div>

                      {/* INTELIGÊNCIA DE PREÇOS */}
                      {result?.pricing_intelligence && (
                        <div className="bg-emerald-950 rounded-[2rem] p-8 md:p-10 shadow-2xl text-white relative overflow-hidden">
                          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/20 blur-[60px] rounded-full pointer-events-none"></div>
                          <h3 className="text-xl font-black mb-6 flex items-center gap-3 relative z-10">
                            <span className="bg-emerald-800/50 p-2.5 rounded-xl border border-emerald-700/50 text-2xl shadow-inner">📈</span> Inteligência de Preço
                            <span className="ml-auto text-[10px] font-black uppercase tracking-widest bg-emerald-800 text-emerald-300 px-3 py-1 rounded-full">Beta</span>
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                            <div className="bg-emerald-900/50 p-5 rounded-2xl border border-emerald-800/50 flex flex-col justify-center">
                              <span className="text-emerald-400/80 text-xs font-black uppercase tracking-widest block mb-2">Veredicto Financeiro</span>
                              <strong className={`text-2xl font-black ${result.pricing_intelligence.financial_verdict?.includes('Alta') ? 'text-emerald-300' : result.pricing_intelligence.financial_verdict?.includes('Apertada') ? 'text-amber-300' : 'text-red-400'}`}>
                                {result.pricing_intelligence.financial_verdict}
                              </strong>
                            </div>
                            <div className="bg-emerald-900/50 p-5 rounded-2xl border border-emerald-800/50 flex flex-col justify-center">
                              <span className="text-emerald-400/80 text-xs font-black uppercase tracking-widest block mb-2">Deságio de Mercado</span>
                              <strong className="text-2xl font-black text-white">{result.pricing_intelligence.estimated_discount}</strong>
                            </div>
                            <div className="bg-emerald-900/50 p-5 rounded-2xl border border-emerald-800/50 flex flex-col justify-center">
                              <span className="text-emerald-400/80 text-xs font-black uppercase tracking-widest block mb-2">Análise de Margem</span>
                              <p className="text-sm text-emerald-50 leading-relaxed font-medium">{result.pricing_intelligence.market_analysis}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PARECER ESTRATÉGICO */}
                      {result?.rationale && (
                        <div className="bg-slate-950 rounded-[2rem] p-8 md:p-10 shadow-2xl text-white relative overflow-hidden group">
                          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-violet-600/30 blur-[80px] rounded-full"></div>
                          <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-violet-200 relative z-10">
                            <span className="bg-white/10 p-2.5 rounded-xl border border-white/10">🧠</span> Parecer do Juiz Final
                          </h3>
                          <p className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap relative z-10 font-medium">{result.rationale}</p>
                        </div>
                      )}

                      {/* RECOMENDAÇÃO */}
                      <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-md border border-slate-100">
                        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3"><span className="text-2xl">💡</span> Recomendação Estratégica</h3>
                        <p className="text-slate-700 font-medium text-lg leading-relaxed bg-amber-50/50 p-6 rounded-2xl border border-amber-100/50">{result?.recommendation}</p>
                      </div>

                      {/* GRID: RISCOS E CHECKLIST */}
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-[2rem] p-8 shadow-md border border-slate-100">
                          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3"><span className="text-xl">🛡️</span> Matriz de Riscos</h3>
                          <div className="space-y-4">
                            {result?.risks && result.risks.length > 0 ? result.risks.map((risk: any, i: number) => {
                                const title = typeof risk === 'string' ? risk : (risk.title || 'Risco Identificado');
                                const desc = typeof risk === 'string' ? null : (risk.quote || risk.description || risk.text);
                                return (
                                  <div key={i} className="flex items-start gap-4 p-5 bg-red-50/50 rounded-2xl border border-red-100/50 hover:bg-red-50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0 font-bold">!</div>
                                    <div>
                                      <span className="text-red-900 text-sm font-bold leading-relaxed block">{title}</span>
                                      {desc && <span className="text-red-800/80 text-xs italic mt-1.5 block leading-relaxed">"{desc}"</span>}
                                    </div>
                                  </div>
                                );
                              }) : (
                              <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 p-5 rounded-2xl font-bold border border-emerald-100">
                                <span className="text-xl">✓</span> Nenhum risco fatal detetado.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-8 shadow-md border border-slate-100">
                          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3"><span className="text-xl">📋</span> Checklist Operacional</h3>
                          <div className="space-y-4">
                            {result?.checklist && result.checklist.length > 0 ? result.checklist.map((item: any, i: number) => {
                                const text = typeof item === 'string' ? item : (item.title || item.text || item.description);
                                return (
                                  <div key={i} className="flex items-start gap-4 p-5 bg-emerald-50/30 rounded-2xl border border-emerald-100/30 hover:bg-emerald-50/80 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold">✓</div>
                                    <span className="text-emerald-900 text-sm font-medium leading-relaxed mt-1">{text}</span>
                                  </div>
                                );
                              }) : <p className="text-slate-500 bg-slate-50 p-5 rounded-2xl text-sm italic font-medium">Nenhuma instrução adicional.</p>}
                          </div>
                        </div>
                      </div>

                      {/* ========================================== */}
                      {/* BOTÃO FINAL - NOVA ANÁLISE                 */}
                      {/* ========================================== */}
                      <button 
                        onClick={handleResetAnalysis} 
                        className="relative w-full mt-10 py-5 bg-slate-900 text-white font-black text-lg rounded-[2rem] shadow-xl hover:shadow-violet-500/40 hover:-translate-y-1 transition-all duration-500 overflow-hidden group border border-slate-800"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
                        
                        <span className="relative z-10 flex items-center justify-center gap-3">
                          <svg className="w-6 h-6 group-hover:-rotate-180 transition-transform duration-700 ease-in-out" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                          </svg>
                          Analisar Outro Edital
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* 🔵 ABA 2: HISTÓRICO */}
              {activeTab === 'history' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-6 px-4">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">O Teu Histórico</h2>
                    <p className="text-slate-500 text-sm">Recupera estratégias de editais que já analisaste.</p>
                  </div>
                  {token ? <HistoryTab token={token} /> : (
                    <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 text-center shadow-sm">
                        <p className="text-slate-500">Inicia sessão para acessar ao histórico.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* COLUNA DIREITA: NAVEGAÇÃO E IDENTIDADE ESTRATÉGICA (Sempre visível) */}
            <div className="flex flex-col gap-6 sticky top-28">
              
              {/* Botões de Navegação */}
              <div className="flex flex-col gap-2 mb-2">
                <button onClick={() => setActiveTab('workspace')} className={`py-4 px-5 rounded-2xl font-black transition-all text-left flex items-center gap-3 ${activeTab === 'workspace' ? 'bg-violet-600 text-white shadow-xl shadow-violet-600/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm'}`}>
                  <span className="text-xl">⚡</span> Nova Análise
                </button>
                <button onClick={() => setActiveTab('history')} className={`py-4 px-5 rounded-2xl font-black transition-all text-left flex items-center gap-3 ${activeTab === 'history' ? 'bg-violet-600 text-white shadow-xl shadow-violet-600/20' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm'}`}>
                  <span className="text-xl">📚</span> O Meu Histórico
                </button>
              </div>

              {/* Identidade Estratégica (Perfil do Utilizador ou Login) */}
              {token && userData ? (
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Identidade Estratégica
                  </h3>
                  <UserProfileCard user={userData} />
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-slate-200"></div>
                  <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 text-3xl group-hover:scale-110 transition-transform">🕵️</div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">Modo Anónimo</h3>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed font-medium">Inicie sessão para ativar o Matchmaker de CNAE exclusivo.</p>
                  <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className="w-full py-3.5 bg-slate-100 text-slate-900 font-black rounded-xl hover:bg-slate-200 transition-colors active:scale-95">
                    Entrar na Conta
                  </button>
                </div>
              )}
              
              {/* Box de Info Premium */}
              <div className="bg-slate-950 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute -right-12 -top-12 w-40 h-40 bg-violet-600/30 blur-[40px] rounded-full"></div>
                <h4 className="text-base font-black mb-6 relative z-10 flex items-center gap-2">
                  <span className="text-violet-400 text-xl">⚡</span> Como a IA avalia
                </h4>
                <ul className="space-y-5 text-sm text-slate-300 relative z-10 font-medium">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-bold text-violet-300 mt-0.5">1</div>
                    <span className="leading-relaxed"><strong className="text-white block">Veredito Go/No-Go</strong> Viabilidade real de ganho.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-bold text-violet-300 mt-0.5">2</div>
                    <span className="leading-relaxed"><strong className="text-white block">Riscos Ocultos</strong> Multas abusivas e prazos irreais.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-bold text-violet-300 mt-0.5">3</div>
                    <span className="leading-relaxed"><strong className="text-white block">Matchmaker</strong> Cruzamento com o seu CNAE.</span>
                  </li>
                </ul>
              </div>

            </div>

          </div>
        </section>

        {/* ========================================== */}
        {/* SEÇÃO DE PLANOS (INJETADA COM COMPONENTE)  */}
        {/* ========================================== */}
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

      {/* MODAL DE AUTH (Login / Registo) */}
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
    {/* 🟢 O MODAL DE UPGRADE VAI AQUI 🟢 */}
    {showUpgradeModal && <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />}
    </div> 
  );
}