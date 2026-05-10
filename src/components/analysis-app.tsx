'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { BrainCircuit, Award, Globe, MapPin, SearchX, MapPinOff, FileText, Lock } from 'lucide-react';
import { fetchUserProfile } from '../services/api';
import CompanyProfileForm from './CompanyProfileForm';
import Image from 'next/image';
import UserProfileCard from './UserProfileCard';
import BawziShadowSimulator from '../components/BawziShadowSimulator';
import ReverseEngineeringBlock from '../components/ReverseEngineeringBlock'; 
import HistoryTab from './HistoryTab';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PricingSection from './PricingSection';
import PncpSearch from '../components/PncpSearch';
import UpgradeModal from './UpgradeModal';
import { useTierConfig } from '../Contexts/TierContext';
import AuthModal from './AuthModal';

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
  const [pncpData, setPncpData] = useState<{cnpj: string, ano: number, sequencial: number, uf?: string} | null>(null);
  
// Estados para o Modal de Autenticação e Upsell
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(2);

  const [stripeSecret, setStripeSecret] = useState<string | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

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

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [abaConcorrentes, setAbaConcorrentes] = useState<'nacional' | 'regional'>('nacional');
  const [provider, setProvider] = useState<string>('openai');
  const [selectedCompetitor, setSelectedCompetitor] = useState<any | null>(null);

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

            if (isSuccessReturn && currentTier === 1 && attemptsLeft > 0) {
              console.log(`⏳ Aguardando confirmação do pagamento... (Tentativas restantes: ${attemptsLeft})`);
              setTimeout(() => fetchWithRetry(attemptsLeft - 1), 2000);
              return;
            }

            setUserTier(currentTier);
            localStorage.setItem('bawzi_tier', currentTier.toString());
            window.dispatchEvent(new Event('storage'));

            setUserData({
              ...userDataInfo,
              workspace_users_count: wsData.workspace_users_count,
              vagas_totais: wsData.vagas_totais,
              company: companyData.cnpj ? companyData : userDataInfo.company
            });

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
    
    if (!token || !cnpj) return; 

    const abortController = new AbortController();
    
    setIsLoadingCnd(true);
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    fetch(`${API_URL.replace(/\/$/, '')}/api/company/cnd/${cleanCnpj}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: abortController.signal 
    })
    .then(async res => {
      if (!res.ok) {
        throw new Error(`Erro na API: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (!data.detail) {
        setCndData(data);
      } else {
        console.warn("Aviso da API ao buscar CND:", data.detail);
      }
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        console.error("Erro ao buscar CNDs:", err);
      }
    })
    .finally(() => {
      setIsLoadingCnd(false);
    });

    return () => {
      abortController.abort();
    };
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

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAnalyzing(false);
    setLoadingStep(0);
    setError("Análise cancelada pelo utilizador.");
    setTimeout(() => setError(null), 4000);
  };

  useEffect(() => {
    const loadUser = async () => {
      const savedToken = localStorage.getItem('bawzi_token');
      if (savedToken) {
        try {
          const profile = await fetchUserProfile(savedToken);
          setToken(savedToken);
          setUserTier(profile.tier);
          const userDataInfo = { 
            name: profile.name || profile.nome, 
            email: profile.email 
          };
          localStorage.setItem('bawzi_user', JSON.stringify(userDataInfo));
        } catch (err) {
          console.error("Token inválido");
        }
      }
      setIsCheckingAuth(false);
    };
    loadUser();
  }, []);

  useEffect(() => {
    const syncAuth = (e: StorageEvent) => {
      if (e.key === 'bawzi_token' && e.newValue) {
        window.location.reload(); 
      }
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
      .then(res => {
        if (!res.ok) throw new Error("Erro na rota");
        return res.json();
      })
      .then(data => {
        setHistory(data);
      })
      .catch(err => {
        console.error("Erro ao buscar histórico:", err);
        setHistory([]);
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }
}, [selectedCompetitor]);

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

          </div>
        </div>

        <section className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 relative z-10 print:m-0 print:p-0">
          <div className="grid lg:grid-cols-[1fr_350px] gap-8 md:gap-12 items-start print:block">
            
            <div className="flex flex-col gap-8 w-full overflow-hidden print:m-0">
              {activeTab === 'workspace' && (
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

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 print:hidden">
                           <div className="flex items-center gap-3">
                             <h2 className="text-2xl font-black text-slate-900 tracking-tight">Análise de Viabilidade</h2>
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
                            const d = result?.datas_criticas_extraidas;
                            const propostas = String(d?.data_limite_propostas || "").trim();
                            const impugnacao = String(d?.data_impugnacao || "").trim();
                            
                            // 🟢 FILTRO INTELIGENTE: Bloqueia respostas vagas da IA
                            const isValida = (texto: string) => {
                               if (!texto) return false;
                               const t = texto.toLowerCase();
                               return !t.includes("não") && !t.includes("nao") && !t.includes("n/a") && !t.includes("informad") && !t.includes("localizad");
                            };

                            const propValida = isValida(propostas) ? propostas : null;
                            const impValida = isValida(impugnacao) ? impugnacao : null;

                            if (!propValida && !impValida) return null;
                            
                            return (
                              <div className="flex flex-col gap-3 pl-0 md:pl-8 border-t md:border-t-0 md:border-l border-slate-200 w-full md:w-auto pt-6 md:pt-0">
                                {propValida && (
                                  <div>
                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo de Propostas</span>
                                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><span className="text-amber-500">📅</span> {propValida}</span>
                                  </div>
                                )}
                                {impValida && (
                                  <div>
                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Limite Impugnação</span>
                                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><span className="text-rose-500">🚨</span> {impValida}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="relative border border-slate-200 rounded-2xl p-8 mb-12">
                          <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2">
                            <span className="text-lg">🎯</span>
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Resumo Executivo</h3>
                          </div>
                          <div className="text-slate-700 text-sm md:text-base leading-relaxed space-y-4 font-medium whitespace-pre-line mt-2">
                            {result.summary}
                          </div>
                        </div>

                        {(() => {
                          const pricing = result.pricing_intelligence as Record<string, any>;
                          
                          const extrairMaiorDinheiro = (textoBase: any): number => {
                            if (!textoBase) return 0;
                            if (typeof textoBase === 'number' && textoBase > 0) return textoBase;
                            
                            const texto = String(textoBase);
                            const matches = [...texto.matchAll(/R\$\s*([\d\.,]+)/g)];
                            
                            if (matches.length > 0) {
                              let maiorValor = 0;
                              matches.forEach(m => {
                                 const num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
                                 if (num > maiorValor) maiorValor = num;
                              });
                              return maiorValor;
                            }
                            
                            const floatDireto = parseFloat(texto);
                            if (!isNaN(floatDireto) && floatDireto > 0) return floatDireto;
                            return 0;
                          };

                          let valorEstimado = extrairMaiorDinheiro(result?.summary) 
                                           || extrairMaiorDinheiro(result?.estimated_value) 
                                           || extrairMaiorDinheiro(pricing?.valor_estimado_raw) 
                                           || 0;

                          if (!pricing || pricing.desagioPreditivoOrgao === undefined) return null;

                          return (
                            <div className="space-y-12 print:hidden">
                              
                              {/* BLOCO ORIGINAL DO SIMULADOR (ANTIGO PREÇO E ENGENHARIA) */}
                              <div className="relative border border-slate-200 rounded-2xl p-2">
                                <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2 z-10">
                                  <span className="text-lg">💰</span>
                                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Simulador de Lances</h3>
                                </div>
                                <BawziShadowSimulator 
                                  desagioPreditivo={result?.pricing_intelligence?.desagioPreditivoOrgao}
                                  nivelAmeaca={result?.pricing_intelligence?.nivelAmeaca}
                                  perfilVencedor={result?.pricing_intelligence?.perfilVencedor}
                                  valorReferenciaInicial={valorEstimado} 
                                  engenhariaReversa={result?.pricing_intelligence?.engenharia_reversa}
                                  userTier={userTier} 
                                  onUpgradeClick={() => setShowUpgradeModal(true)} 
                                />
                              </div>

                              {/* 🟢 O NOVO BLOCO DE ENGENHARIA REVERSA ISOLADO AQUI */}
                              <ReverseEngineeringBlock
                                userTier={userTier}
                                valorReferencia={valorEstimado}
                                desagio={pricing.desagioPreditivoOrgao}
                                engenhariaData={pricing.engenharia_reversa}
                                onUpgradeClick={() => setShowUpgradeModal(true)}
                              />
                            </div>
                          );
                        })()}

                        <div className="relative border border-slate-200 rounded-2xl p-8 mb-12 bg-white shadow-sm print:hidden">
                          <div className="absolute top-0 left-6 -translate-y-1/2 bg-white px-3 flex items-center gap-2.5">
                            <Award className="w-5 h-5 text-indigo-500" strokeWidth={2.5} />
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Inteligência Competitiva</h3>
                          </div>
                          
                          <div className="mb-8 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 shadow-inner">
                            <div className="flex border-b border-slate-200 bg-slate-100/50">
                              <button
                                onClick={() => setAbaConcorrentes('nacional')}
                                className={`flex-1 py-3.5 px-5 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                  abaConcorrentes === 'nacional' ? 'bg-white text-indigo-700 border-t-2 border-t-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                <Globe className="w-4 h-4" /> Nacionais
                              </button>
                              <button
                                onClick={() => setAbaConcorrentes('regional')}
                                className={`flex-1 py-3.5 px-5 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                  abaConcorrentes === 'regional' ? 'bg-white text-emerald-700 border-t-2 border-t-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                <MapPin className="w-4 h-4" /> Regionais ({result.uf || "GO"})
                              </button>
                            </div>

                            <div className="p-6 bg-white">
                              {['nacional', 'regional'].map((tipo) => (
                                abaConcorrentes === tipo && (
                                  <ul key={tipo} className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {(tipo === 'nacional' ? result.concorrentes_provaveis : result.concorrentes_regionais)?.slice(0, 6).map((item: any, index: number) => {
                                      
                                      let nomeEmpresa = "Empresa não identificada";
                                      let vitorias = "0";
                                      let cnpj = "";
                                      let dadosParaModal = item;

                                      if (typeof item === 'string') {
                                        let extraidoCnpj = "";
                                        
                                        const match = item.match(/(.*?)\s*\(([\d]+)\s*vitórias?\)(?:\s*-\s*CNPJ:\s*([\d]+))?/i);
                                        if (match) {
                                          nomeEmpresa = match[1].trim();
                                          vitorias = match[2];
                                          extraidoCnpj = match[3] || "";
                                        } else {
                                          nomeEmpresa = item;
                                        }

                                        if (!extraidoCnpj) {
                                          const matchFormatado = item.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/);
                                          if (matchFormatado) {
                                            extraidoCnpj = matchFormatado[0];
                                          } else {
                                            const matchMei = item.match(/\b\d{2}\.\d{3}\.\d{3}\b/);
                                            if (matchMei) extraidoCnpj = matchMei[0] + " (Raiz MEI)";
                                          }
                                        }

                                        cnpj = extraidoCnpj;
                                        dadosParaModal = { nome: nomeEmpresa, vitorias, cnpj, uf: tipo === 'nacional' ? 'Nacional' : (result.uf || 'GO') };
                                      
                                      } else {
                                        nomeEmpresa = item.empresa || item.nome || item.razao_social || "Empresa não identificada";
                                        vitorias = item.vitorias || item.quantidade_vitorias || "0";
                                        cnpj = item.cnpj || "";
                                      }

                                      return (
                                        <li 
                                          key={index} 
                                          onClick={() => setSelectedCompetitor(dadosParaModal)}
                                          className="text-[11px] text-slate-700 font-bold flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer group"
                                        >
                                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white text-indigo-600 font-black shrink-0 border border-indigo-100 shadow-sm text-[10px] group-hover:bg-indigo-600 group-hover:text-white transition-colors">{index + 1}</span>
                                          <div className="flex-1 min-w-0 flex flex-col">
                                            <span className="truncate uppercase tracking-tight">{nomeEmpresa}</span>
                                            <span className="text-[9px] text-slate-400 group-hover:text-indigo-500 font-mono mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Ver Raio-X &rarr;</span>
                                          </div>
                                          {Number(vitorias) > 0 && (
                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black shrink-0 flex items-center gap-1 shadow-sm border border-indigo-200/50">
                                              🏆 {vitorias}
                                            </span>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )
                              ))}
                            </div>
                          </div>
                        </div>

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

                        <div className="mt-8 pt-6 border-t border-slate-100 print:hidden">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4 text-indigo-400" strokeWidth={2} />
                            Raciocínio Estratégico da IA
                          </h4>
                          <div className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-line bg-slate-50 p-5 rounded-xl border border-slate-100">
                            {result.rationale || result.recommendation || "Sem dados estratégicos."}
                          </div>
                        </div>

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

                        <div className="mt-12 p-6 md:p-8 bg-slate-50 rounded-[2rem] border border-slate-200 border-dashed print:hidden">
                          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex-1 text-center md:text-left">
                              <h4 className="text-base font-black text-slate-900 mb-2 flex items-center justify-center md:justify-start gap-2">
                                <span className="text-xl">⚖️</span> Exportar Parecer Técnico-Jurídico
                              </h4>
                              <p className="text-sm text-slate-500 font-medium">
                                Gere uma minuta formal em PDF baseada na análise neural da Bawzi.
                              </p>
                              
                              <div className="mt-3">
                                <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg font-black border border-amber-200 uppercase tracking-widest shadow-sm">
                                  <span>⚠️</span> Requer validação de um advogado
                                </span>
                              </div>
                            </div>
                            
                            <button
                              onClick={handleExportPDF}
                              className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 hover:-translate-y-0.5 transition-all shadow-md flex items-center justify-center gap-3 shrink-0"
                            >
                              <FileText className="w-4 h-4" />
                              Gerar Parecer (PDF)
                            </button>
                          </div>
                        </div>

                        <div className="hidden print:block bg-white p-10 font-serif text-slate-900 leading-relaxed text-sm">
                          <div className="border-b-2 border-slate-900 pb-4 mb-6">
                            <h1 className="text-2xl font-black uppercase">Bawzi Intelligence</h1>
                            <p className="font-bold text-slate-500 uppercase">Parecer Técnico-Jurídico Preliminar</p>
                          </div>

                          <div className="bg-slate-100 p-4 mb-6 border-l-4 border-slate-900">
                            <p className="font-bold text-xs">
                              ⚠️ Nota de Responsabilidade: Este rascunho foi gerado por IA para facilitar a triagem. A revisão e validação por um profissional da área jurídica é indispensável.
                            </p>
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
                    </div>
                  ) : null}
                </div>
              )}

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

            <div className="flex flex-col gap-6 sticky top-28 print:hidden">
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

      {selectedCompetitor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            
            <div className="p-5 md:p-6 bg-slate-900 flex justify-between items-start shrink-0">
              <div className="pr-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-[10px] font-black text-indigo-300 uppercase tracking-wider">
                  Raio-X Competitivo
                </div>
                <h3 className="text-xl font-black text-white leading-tight line-clamp-2">
                  {selectedCompetitor.razao_social || selectedCompetitor.nome || 'Concorrente'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedCompetitor(null)} 
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition-colors"
              >
                ✖
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex items-center justify-between bg-amber-50 p-4 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🏆</span>
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Histórico no PNCP</p>
                    <p className="text-sm font-medium text-amber-800">Vitórias recentes</p>
                  </div>
                </div>
                <span className="text-3xl font-black text-amber-600">
                  {selectedCompetitor.quantidade_vitorias || selectedCompetitor.vitorias || selectedCompetitor.vitorias_pncp || 0}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CNPJ</p>
                  <p className="text-sm font-mono font-bold text-slate-700">
                    {(() => {
                      const rawCnpj = selectedCompetitor.cnpj || '';
                      const nums = rawCnpj.replace(/\D/g, '');
                      if (nums.length === 14) {
                        return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
                      }
                      return rawCnpj || 'Não identificado';
                    })()}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado (UF)</p>
                  <p className="text-sm font-bold text-slate-700">
                    {selectedCompetitor.uf || 'N/A'}
                  </p>
                </div>
              </div>

              {(selectedCompetitor.porte || selectedCompetitor.municipio) && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  {selectedCompetitor.porte && (
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">Porte</span>
                      <span className="text-sm font-bold text-slate-800">{selectedCompetitor.porte}</span>
                    </div>
                  )}
                  {selectedCompetitor.municipio && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase">Município</span>
                      <span className="text-sm font-bold text-slate-800">{selectedCompetitor.municipio}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="text-sm">🎯</span> Últimos Contratos Vencidos
                  </h4>
                </div>

                {loadingHistory ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map(i => (
                       <div key={i} className="h-24 bg-slate-50 border border-slate-100 rounded-xl"></div>
                    ))}
                  </div>
                ) : history.length > 0 ? (
                  <div className="space-y-3">
                    {history.map((h, i) => (
                      <a
                        key={i}
                        href={h.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-md transition-all group relative"
                      >
                        <div className="absolute top-4 right-4 text-slate-300 group-hover:text-indigo-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        </div>

                        <div className="pr-6">
                          <span className="block text-[10px] font-black text-slate-500 uppercase truncate mb-1.5">
                            {h.orgao}
                          </span>
                          <p className="text-xs text-slate-700 font-medium line-clamp-2 leading-relaxed mb-3">
                            {h.objeto}
                          </p>
                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1.5">
                              📅 {h.data ? new Date(h.data).toLocaleDateString('pt-BR') : 'Sem data'}
                            </span>
                            {h.valor > 0 ? (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                                💰 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(h.valor)}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                Valor Sigiloso
                              </span>
                            )}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                    <span className="text-2xl mb-2 block opacity-50">👻</span>
                    <p className="text-slate-400 text-xs font-medium px-4">
                      Nenhum contrato detalhado encontrado recentemente.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <button 
                onClick={() => {
                  const numerosLimpos = (selectedCompetitor.cnpj || '').replace(/\D/g, '');
                  if (numerosLimpos) {
                    navigator.clipboard.writeText(numerosLimpos);
                    alert(`CNPJ copiado com sucesso!`);
                  } else {
                    alert('Nenhum CNPJ disponível para copiar.');
                  }
                }}
                className="w-full py-3.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-black tracking-wide rounded-xl transition-all text-xs uppercase flex items-center justify-center gap-2 shadow-sm"
              >
                📋 Copiar CNPJ (Apenas Números)
              </button>
            </div>

          </div>
        </div>
      )}

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => {
          setShowUpgradeModal(false);
          setStripeSecret(null); 
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

    </div> 
  );
}