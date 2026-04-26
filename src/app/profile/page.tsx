'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UserProfileCard from '../../components/UserProfileCard';
import CompanyProfileForm from '../../components/CompanyProfileForm';
import PersonalDataForm from '../../components/PersonalDataForm';
import TeamManager from '../../components/TeamManager';

export default function ProfilePage() {
  const router = useRouter(); 
  const [token, setToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [wsData, setWsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'company' | 'personal' | 'billing'>('company');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const loadData = async () => {
    const savedToken = localStorage.getItem('bawzi_token');
    if (!savedToken) { router.push('/'); return; }
    setToken(savedToken);
    try {
      const [userRes, wsRes] = await Promise.all([
        fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${savedToken}` } }),
        fetch(`${API_URL}/api/workspace/details`, { headers: { 'Authorization': `Bearer ${savedToken}` } })
      ]);

      if (userRes.ok && wsRes.ok) {
        setUserData(await userRes.json());
        setWsData(await wsRes.json());
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleViewInvoices = async () => {
    setIsRedirecting(true);
    try {
      const savedToken = localStorage.getItem('bawzi_token');
      const res = await fetch(`${API_URL}/api/billing/customer-portal`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${savedToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();

      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.detail || "Não foi possível carregar o portal de faturas. Verifique se você já possui uma assinatura ativa.");
        setIsRedirecting(false);
      }
    } catch (err) {
      console.error("Erro ao abrir portal de faturas:", err);
      alert("Erro de conexão. Tente novamente em instantes.");
      setIsRedirecting(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      
      <main className="max-w-[900px] mx-auto px-6 pt-12 space-y-10">
        
        {/* HEADER LIMPO E ELEGANTE */}
        <header>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-lg shadow-violet-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <span onClick={() => router.push('/dashboard')} className="hover:text-slate-600 cursor-pointer transition-colors">Painel</span>
              <span className="text-slate-300">/</span>
              <span className="text-violet-600 bg-violet-50 px-2 py-0.5 rounded">Configurações</span>
            </div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Definições</h1>
          <p className="text-slate-500 font-medium text-lg max-w-2xl leading-relaxed">
            Gira a tua conta, equipa e o perfil estratégico da <span className="text-violet-600 font-bold">Bawzi</span>.
          </p>
        </header>

        {/* CARTÃO DE PERFIL */}
        <section>
          <UserProfileCard user={userData} workspace={wsData} />
        </section>

        {/* MENU DE ABAS EM FORMATO CÁPSULA */}
        <div className="flex justify-center">
          <div className="inline-flex bg-slate-200/50 p-1.5 rounded-2xl shadow-inner overflow-x-auto max-w-full no-scrollbar">
            <button onClick={() => setActiveTab('company')} className={`px-6 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-200 ${activeTab === 'company' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>
              🏢 Perfil da Empresa
            </button>
            <button onClick={() => setActiveTab('personal')} className={`px-6 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-200 ${activeTab === 'personal' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>
              👤 Dados de Utilizador
            </button>
            <button onClick={() => setActiveTab('billing')} className={`px-6 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-200 ${activeTab === 'billing' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}>
              💳 Faturação e Planos
            </button>
          </div>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <section className="pt-2">
          
          {activeTab === 'company' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <CompanyProfileForm 
                userToken={token!} 
                initialData={wsData?.company} 
                is_admin={wsData?.is_admin} 
                onSuccess={loadData} 
              />
              <TeamManager 
                userToken={token!} 
                tier={wsData?.tier || 1} 
                members={wsData?.team_members}
                is_admin={wsData?.is_admin}
                onUpdate={loadData} 
              />
            </div>
          )}

          {activeTab === 'personal' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PersonalDataForm userData={userData} token={token} onUpdate={loadData} />
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              
              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 relative overflow-hidden">
                {/* 🟢 BLUR RESTAURADO: Decorativo suave ao fundo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-100 to-pink-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                
                <div className="relative z-10">
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 mb-6">
                    💳 Assinatura Atual
                  </h2>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-14 h-14 bg-gradient-to-br from-violet-600 to-pink-600 rounded-xl flex items-center justify-center text-white text-2xl font-black shadow-lg">
                        {wsData?.tier || 1}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plano Ativo</p>
                        <h3 className="text-xl font-bold text-slate-900">
                          {wsData?.tier === 1 ? 'Bawzi Free (Demonstração)' : 
                           wsData?.tier === 2 ? 'Bawzi Pro' : 
                           wsData?.tier === 3 ? 'Bawzi Business' : 'Bawzi Enterprise'}
                        </h3>
                      </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                      {/* SOMENTE O PROPRIETÁRIO VÊ FATURAS */}
                      {wsData?.is_owner && (
                        <button 
                          onClick={handleViewInvoices}
                          disabled={isRedirecting}
                          className="w-full flex items-center justify-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group disabled:opacity-50"
                        >
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg group-hover:bg-white transition-colors">
                            {isRedirecting ? '⏳' : '🧾'}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                              {isRedirecting ? 'A carregar portal...' : 'Ver Faturas'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Histórico</p>
                          </div>
                        </button>
                      )}

                      {wsData?.is_owner && wsData?.tier < 4 && (
                        <button onClick={() => router.push('/plans')} className="flex-1 md:flex-none px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-md">
                          Upgrade
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* TABELA DE LIMITES E RECURSOS */}
              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">
                  Uso e Limites do Workspace
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-end mb-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">🤝</span>
                        <span className="text-sm font-bold text-slate-700 truncate">Vagas da Equipa</span>
                      </div>
                      <span className="text-sm font-black text-slate-900 shrink-0">
                        {wsData?.workspace_users_count || 1} / {wsData?.vagas_totais || 1}
                      </span>
                    </div>
                    
                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden mt-auto">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          ((wsData?.workspace_users_count || 1) / (wsData?.vagas_totais || 1)) >= 1 ? 'bg-red-500' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${((wsData?.workspace_users_count || 1) / (wsData?.vagas_totais || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 min-w-0 flex flex-col justify-center">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">⚡</span>
                        <span className="text-sm font-bold text-slate-700 truncate">Motor de Análise</span>
                      </div>
                      <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-md uppercase tracking-wider shrink-0 self-start sm:self-auto">
                        {wsData?.tier === 1 ? 'Tier 1 (GPT-4o-mini)' : 'Multi-LLM Avançado'}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      {wsData?.tier === 1 
                        ? 'O plano Free processa documentos menores e possui limite mensal de demonstração.' 
                        : 'Acesso total aos modelos da OpenAI, Anthropic e Llama com limites expandidos por edital.'}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </section>
      </main>
    </div>
  );
}