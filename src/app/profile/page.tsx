'use client';
import Image from 'next/image';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// Importação de todos os seus componentes modulares
import UserProfileCard from '../../components/UserProfileCard'; 
import CompanyProfileForm from '../../components/CompanyProfileForm'; 
import PersonalDataForm from '../../components/PersonalDataForm';
import TeamManager from '../../components/TeamManager';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeSuccess = searchParams.get('success');

  // ==========================================
  // ESTADOS DO COMPONENTE
  // ==========================================
  const [authToken, setAuthToken] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [userTier, setUserTier] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados para Gestão de Equipe (reduzidos, pois o TeamManager cuida do resto)
  const [members, setMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Estados Financeiros
  const [invoices, setInvoices] = useState<any[]>([]);
  const [subDetails, setSubDetails] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // ==========================================
  // CARREGAMENTO DE DADOS 
  // ==========================================
  const fetchData = async () => {
    const token = localStorage.getItem('bawzi_token');
    if (!token) {
      router.push('/');
      return;
    }
    setAuthToken(token); // Guarda o token no estado para passar aos componentes

    try {
      const headers = { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };
      
      const fetchConfig: RequestInit = { headers, cache: 'no-store' };

      const [userRes, wsRes, membersRes, invRes, subRes] = await Promise.all([
        fetch(`${API_URL}/api/users/me`, fetchConfig),
        fetch(`${API_URL}/api/workspace/details`, fetchConfig),
        fetch(`${API_URL}/api/workspace/members`, fetchConfig),
        fetch(`${API_URL}/api/billing/invoices`, fetchConfig),
        fetch(`${API_URL}/api/billing/subscription-details`, fetchConfig)
      ]);

      if (userRes.status === 401 || wsRes.status === 401) {
        localStorage.clear();
        router.push('/');
        return;
      }

      if (userRes.ok && wsRes.ok) {
        const uData = await userRes.json();
        const wData = await wsRes.json();
        
        setUserData({
          ...uData,
          workspace_users_count: wData.workspace_users_count,
          vagas_totais: wData.vagas_totais,
          company: wData.company
        });
        setUserTier(wData.tier);
        setIsAdmin(wData.is_admin);
      }

      if (membersRes.ok) {
        const mData = await membersRes.json();
        setMembers(mData);
      }

      if (invRes && invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData);
      }

      if (subRes && subRes.ok) {
        const subData = await subRes.json();
        setSubDetails(subData);
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // EFEITOS E GATILHOS
  // ==========================================
  useEffect(() => {
    fetchData();

    if (stripeSuccess) {
      setTimeout(() => {
        fetchData(); 
      }, 2000);
      window.history.replaceState(null, '', '/profile');
    }
  }, [stripeSuccess, API_URL, router]); 

  useEffect(() => {
    const onFocus = () => {
      fetchData();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // ==========================================
  // HANDLERS FINANCEIROS
  // ==========================================
  const handleManageSubscription = async () => {
    try {
      const res = await fetch(`${API_URL}/api/billing/customer-portal`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.detail || "Erro ao abrir o painel de faturamento.");
      }
    } catch (error) {
      alert("Erro de conexão ao tentar acessar o faturamento.");
    }
  };

  // ==========================================
  // TELA DE CARREGAMENTO
  // ==========================================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] bg-violet-600/10 blur-[100px] rounded-full animate-pulse"></div>
        <div className="relative flex flex-col items-center z-10">
          <div className="animate-pulse mb-8 transform hover:scale-105 transition-transform duration-500">
            <Image 
              src="/logo-bawzi.png" 
              alt="Bawzi Logo" 
              width={160} 
              height={45} 
              className="object-contain drop-shadow-md" 
              priority
            />
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin shadow-sm"></div>
            <span className="font-black text-slate-400 uppercase tracking-widest text-[10px] animate-pulse">
              A orquestrar inteligência...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDERIZAÇÃO FINAL (LAYOUT C-LEVEL)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* HEADER BREADCRUMB */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/workspace')} className="w-10 h-10 bg-slate-100 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-xl flex items-center justify-center transition-colors">←</button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Painel de Controle</h1>
              <p className="text-sm font-medium text-slate-500">Gestão de conta, equipe e faturamento.</p>
            </div>
          </div>
          <button onClick={() => { localStorage.clear(); router.push('/'); }} className="px-5 py-2.5 bg-red-50 text-red-600 font-bold text-sm rounded-xl hover:bg-red-100 transition-colors">Sair</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
          
          {/* LADO ESQUERDO: CARD FIXO */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm sticky top-6">
              <UserProfileCard user={userData} currentTier={userTier} />
            </div>
          </div>

          {/* LADO DIREITO: COMPONENTES MODULARES */}
          <div className="space-y-8">
            
            {/* 1. DADOS PESSOAIS E ZONA DE RISCO */}
            <PersonalDataForm 
              userData={userData} 
              token={authToken} 
              onUpdate={fetchData} 
            />

            {/* 2. GESTÃO DE EQUIPE */}
            <TeamManager 
              userToken={authToken} 
              tier={userTier} 
              members={members} 
              is_admin={isAdmin} 
              onUpdate={fetchData} 
            />

            {/* 3. INTELIGÊNCIA DE MERCADO (CNAE) */}
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-3">
                  <span className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-base">🏢</span> 
                  Inteligência de Mercado (CNAE)
                </h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full w-fit">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DNA Empresarial Ativo</span>
                </div>
              </div>
              
              <CompanyProfileForm 
                token={authToken} 
                userTier={userTier} 
              />
            </div>

            {/* 4. PLANO E FATURAMENTO */}
            <div id="planos" className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="mb-8">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <span className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-lg">💎</span> 
                  Plano e Faturamento
                </h2>
              </div>

              {userTier > 1 ? (
                <div className="animate-in fade-in duration-500">
                  <div className="bg-slate-50 border border-slate-100 p-6 md:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                    <div className="space-y-3">
                      <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-lg">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Assinatura Ativa
                      </span>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">
                        Seu plano atual é o Nível {userTier}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 max-w-xl leading-relaxed">
                        Você tem acesso total aos recursos premium. Gerencie faturas e métodos de pagamento no painel seguro.
                      </p>
                    </div>
                    <button 
                      onClick={handleManageSubscription}
                      className="shrink-0 bg-slate-900 text-white hover:bg-violet-600 px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md hover:-translate-y-1 w-full md:w-auto text-center"
                    >
                      Gerenciar Assinatura ↗
                    </button>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-500">
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-8 md:p-10 relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/20 blur-[80px] rounded-full -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/10 blur-[60px] rounded-full -ml-10 -mb-10"></div>
                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                      <div className="space-y-4 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded-full">
                          <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Upgrade Disponível</span>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                          Desbloqueie o Poder Total <br />da Inteligência Bawzi
                        </h3>
                        <p className="text-slate-400 font-medium max-w-md">
                          Seu plano atual (Nível 1) possui limites de análise. Faça o upgrade para acessar o motor Multi-LLM, monitoramento de CND e suporte prioritário.
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-4 shrink-0">
                        <Link 
                          href="/plans"
                          className="bg-violet-600 hover:bg-violet-500 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-violet-600/20 hover:-translate-y-1 active:scale-95 w-full sm:w-auto text-center"
                        >
                          Escolher Plano de Assinatura
                        </Link>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                          Planos a partir de R$ 79/mês
                        </p>
                      </div>
                    </div>
                    <div className="relative z-10 mt-10 pt-8 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { icon: '🧠', label: 'GPT-4o & Claude 3.5' },
                        { icon: '🛡️', label: 'Blindagem de CND' },
                        { icon: '📈', label: 'Análise de Riscos' },
                        { icon: '⚡', label: 'Processamento Prioritário' }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 justify-center lg:justify-start">
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {invoices.length > 0 && (
                <div className="mt-10 animate-in fade-in slide-in-from-top-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 px-1">
                    Histórico de Pagamentos
                  </h3>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                        <thead>
                          <tr className="border-b border-slate-200/60 bg-slate-100/50">
                            <th className="px-6 py-4 font-black text-slate-900">Emissão</th>
                            <th className="px-6 py-4 font-black text-slate-900">Vencimento</th>
                            <th className="px-6 py-4 font-black text-slate-900">Fatura</th>
                            <th className="px-6 py-4 font-black text-slate-900">Valor</th>
                            <th className="px-6 py-4 font-black text-slate-900">Status</th>
                            <th className="px-6 py-4 font-black text-slate-900 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-white transition-colors">
                              <td className="px-6 py-4 text-slate-500 font-medium text-xs">{inv.date}</td>
                              <td className="px-6 py-4 text-slate-900 font-bold text-xs">{inv.vencimento}</td>
                              <td className="px-6 py-4 text-slate-500 text-xs font-mono">{inv.number}</td>
                              <td className="px-6 py-4 text-slate-900 font-black">{inv.amount}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 text-[10px] font-black rounded-md uppercase tracking-widest ${
                                  inv.status === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {inv.pdf_url && (
                                <a 
                                  href={inv.pdf_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center px-4 py-2 bg-slate-100 text-slate-500 hover:bg-violet-50 hover:text-violet-700 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-200"
                                >
                                  Comprovante
                                </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-400 uppercase text-xs animate-pulse">Verificando Conta...</div>}>
      <ProfileContent />
    </Suspense>
  );
}