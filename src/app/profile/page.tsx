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
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'company' | 'personal' | 'billing'>('company');

  const loadData = async () => {
    const savedToken = localStorage.getItem('bawzi_token');
    if (!savedToken) { router.push('/'); return; }
    setToken(savedToken);
    try {
      const res = await fetch('http://localhost:8000/api/users/me', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserData(data);
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    } finally {
      setIsLoading(false);
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
      
      <header className="mb-10 p-8 rounded-[2rem] bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg relative overflow-hidden">
        {/* Efeito de brilho decorativo */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-white tracking-tight">
            Definições
          </h1>
          <p className="text-violet-100 font-medium">
            Gira a tua conta e perfil estratégico.
          </p>
        </div>
      </header>

      {/* CONTEÚDO SOBREPOSTO */}
      <main className="max-w-[900px] mx-auto px-6 -mt-20 relative z-10 space-y-8">
        
        {/* CARTÃO DE UTILIZADOR */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/60 border border-slate-100">
          <UserProfileCard user={userData} />
        </div>

        {/* NAVEGAÇÃO EM PÍLULAS */}
        <div className="flex justify-center">
          <div className="inline-flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto max-w-full no-scrollbar">
            <button 
              onClick={() => setActiveTab('company')} 
              className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'company' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              🏢 Perfil da Empresa
            </button>
            <button 
              onClick={() => setActiveTab('personal')} 
              className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'personal' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              👤 Dados de Utilizador
            </button>
            <button 
              onClick={() => setActiveTab('billing')} 
              className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'billing' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              💳 Faturação e Planos
            </button>
          </div>
        </div>

        {/* ÁREA DINÂMICA DAS TABS */}
        <div className="pt-2">
          
          {/* TAB: EMPRESA E EQUIPE */}
          {activeTab === 'company' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6"> {/* 🟢 space-y-6 dá o distanciamento perfeito */}
              
              <CompanyProfileForm 
                userToken={token!} 
                initialData={userData?.company} 
                is_admin={userData?.is_admin} 
                onSuccess={loadData} 
              />

              <TeamManager 
                userToken={token!} 
                tier={userData?.tier || 1} 
                members={userData?.team_members}
                is_admin={userData?.is_admin}
                onUpdate={loadData} 
              />
              
            </div>
          )}

          {activeTab === 'personal' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <PersonalDataForm 
                userData={userData} 
                token={token} 
                onUpdate={loadData} 
              />
            </div>
          )}

          {/* TAB: FATURAÇÃO E PLANOS */}
          {activeTab === 'billing' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              
              {/* CARTÃO DO PLANO ATUAL */}
              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 relative overflow-hidden">
                {/* Efeito visual de fundo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-100 to-pink-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                
                <div className="relative z-10">
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 mb-6">
                    💳 Assinatura Atual
                  </h2>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="w-14 h-14 bg-gradient-to-br from-violet-600 to-pink-600 rounded-xl flex items-center justify-center text-white text-2xl font-black shadow-lg">
                        {userData?.tier || 1}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Plano Ativo
                        </p>
                        <h3 className="text-xl font-bold text-slate-900">
                          {userData?.tier === 1 ? 'Bawzi Free (Demonstração)' : 
                           userData?.tier === 2 ? 'Bawzi Pro' : 
                           userData?.tier === 3 ? 'Bawzi Business' : 'Bawzi Enterprise'}
                        </h3>
                      </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                    <button className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                      Ver Faturas
                    </button>

                    {/* 🟢 BOTÃO DE UPGRADE: aparece para Tiers 1, 2 e 3 */}
                    {userData?.tier < 4 && (
                      <button 
                        onClick={() => router.push('/plans')}
                        className="flex-1 md:flex-none px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-md"
                      >
                        {userData?.tier === 1 ? 'Fazer Upgrade' : 'Mudar de Plano'}
                      </button>
                    )}
                  </div>
                  </div>
                </div>
              </div>

              {/* TABELA DE LIMITES E RECURSOS (BASEADA NO BACKEND) */}
              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">
                  Uso e Limites do Workspace
                </h3>
                
                {/* 🟢 GRID RESPONSIVO: Lado a lado no Desktop, Empilhado no Mobile */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* CARTÃO 1: Limite de Utilizadores */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-end mb-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">🤝</span>
                        <span className="text-sm font-bold text-slate-700 truncate">Vagas da Equipa</span>
                      </div>
                      <span className="text-sm font-black text-slate-900 shrink-0">
                        {userData?.workspace_users_count || 1} / {
                          userData?.tier === 1 ? 1 : 
                          userData?.tier === 2 ? 2 : 
                          userData?.tier === 3 ? 5 : 10
                        }
                      </span>
                    </div>
                    
                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden mt-auto">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          ((userData?.workspace_users_count || 1) / (userData?.tier === 1 ? 1 : userData?.tier === 2 ? 2 : userData?.tier === 3 ? 5 : 10)) >= 1 
                          ? 'bg-red-500' 
                          : 'bg-emerald-400'
                        }`}
                        style={{ 
                          width: `${((userData?.workspace_users_count || 1) / (userData?.tier === 1 ? 1 : userData?.tier === 2 ? 2 : userData?.tier === 3 ? 5 : 10)) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* CARTÃO 2: Motor de Análise (LLM) */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 min-w-0 flex flex-col justify-center">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">⚡</span>
                        <span className="text-sm font-bold text-slate-700 truncate">Motor de Análise</span>
                      </div>
                      
                      {/* Tag adaptável: Vai para a linha de baixo se faltar espaço */}
                      <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-md uppercase tracking-wider shrink-0 self-start sm:self-auto">
                        {userData?.tier === 1 ? 'Tier 1 (GPT-4o-mini)' : 'Multi-LLM Avançado'}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      {userData?.tier === 1 
                        ? 'O plano Free processa documentos menores e possui limite mensal de demonstração.' 
                        : 'Acesso total aos modelos da OpenAI, Anthropic e Llama com limites expandidos por edital.'}
                    </p>
                  </div>

                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}