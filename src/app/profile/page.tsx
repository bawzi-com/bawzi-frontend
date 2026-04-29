'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import UserProfileCard from '../../components/UserProfileCard'; 
import CompanyProfileForm from '../../components/CompanyProfileForm'; 
import PricingSection from '../../components/PricingSection';

// Criamos um subcomponente para a lógica que usa o useSearchParams
function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeSuccess = searchParams.get('success');

  // ==========================================
  // ESTADOS DO COMPONENTE
  // ==========================================
  const [userData, setUserData] = useState<any>(null);
  const [userTier, setUserTier] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados para Gestão de Equipe
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Estados Financeiros
  const [invoices, setInvoices] = useState<any[]>([]);
  const [subDetails, setSubDetails] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // ==========================================
  // CARREGAMENTO DE DADOS (Agora com no-cache nativo)
  // ==========================================
  const fetchData = async () => {
    const token = localStorage.getItem('bawzi_token');
    if (!token) {
      router.push('/');
      return;
    }

    try {
      // 🟢 O SEGREDO 1: Cabeçalhos que matam o cache na hora
      const headers = { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };
      
      // 🟢 O SEGREDO 2: O parâmetro 'cache: no-store'
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
  // EFEITOS E GATILHOS (Aqui mora a mágica)
  // ==========================================
  useEffect(() => {
    // Carregamento normal ao abrir a tela
    fetchData();

    // 🟢 O GATILHO DA VOLTA DO STRIPE: Se tiver success na URL
    if (stripeSuccess) {
      console.log("Volta do Stripe detectada! Atualizando...");
      // Espera 2 segundos pro backend terminar de gravar no Mongo e busca de novo
      setTimeout(() => {
        fetchData(); 
      }, 2000);
      
      // Limpa a URL (Tira o ?success=true para não ficar estranho)
      window.history.replaceState(null, '', '/profile');
    }
  }, [stripeSuccess, API_URL, router]); 

  // 🟢 BÔNUS: O GATILHO DE MUDANÇA DE ABA
  // Atualiza automaticamente quando o usuário volta para esta aba no navegador
  useEffect(() => {
    const onFocus = () => {
      fetchData();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // ==========================================
  // HANDLERS (Ações do Usuário)
  // ==========================================
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    
    try {
      const token = localStorage.getItem('bawzi_token');
      const res = await fetch(`${API_URL}/api/workspace/invite`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail })
      });

      if (res.ok) {
        alert("Convite enviado com sucesso!");
        setInviteEmail('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.detail || "Erro ao enviar convite.");
      }
    } catch (err) {
      alert("Falha na conexão.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Tem certeza que deseja remover este membro da equipe?")) return;

    try {
      const token = localStorage.getItem('bawzi_token');
      const res = await fetch(`${API_URL}/api/workspace/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        fetchData();
      } else {
        alert("Erro ao remover membro.");
      }
    } catch (err) {
      alert("Erro de conexão.");
    }
  };

  const handleManageSubscription = async () => {
    try {
      const token = localStorage.getItem('bawzi_token');
      const res = await fetch(`${API_URL}/api/billing/customer-portal`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
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

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-400 uppercase text-xs animate-pulse">Carregando Bawzi...</div>;
  }

  // A partir daqui vem o return com a sua UI (HTML) normal do perfil
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* HEADER */}
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

          {/* LADO DIREITO: ABAS DE CONTEÚDO */}
          <div className="space-y-8">
            
            {/* 1. GESTÃO DE EQUIPE */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <span className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center text-lg">👥</span> 
                  Gestão da Equipe
                </h2>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                  {userData?.workspace_users_count} / {userData?.vagas_totais} Vagas ocupadas
                </span>
              </div>

              {isAdmin ? (
                <>
                  <form onSubmit={handleInvite} className="flex gap-3 mb-10">
                    <input 
                      type="email" 
                      placeholder="E-mail do novo membro..." 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none transition-all"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button 
                      type="submit" 
                      disabled={inviteLoading || userData?.workspace_users_count >= userData?.vagas_totais}
                      className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-violet-600 transition-all disabled:opacity-30"
                    >
                      {inviteLoading ? 'Enviando...' : 'Convidar'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs font-bold">
                  ⚠️ Apenas administradores podem convidar ou remover membros.
                </div>
              )}

              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400 text-xs">
                        {member.name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{member.name || 'Usuário Pendente'}</h4>
                        <p className="text-xs font-medium text-slate-400">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${member.is_admin ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {member.is_admin ? 'Admin' : 'Membro'}
                      </span>
                      {isAdmin && !member.is_admin && (
                        <button onClick={() => handleRemoveMember(member.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. DADOS DA EMPRESA */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
              <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <span className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-lg">🏢</span> 
                Inteligência de Mercado (CNAE)
              </h2>
              <CompanyProfileForm token={localStorage.getItem('bawzi_token') || ''} />
            </div>

            {/* 3. PLANO E FATURAMENTO */}
            <div id="planos" className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="mb-8">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <span className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-lg">💎</span> 
                  Plano e Faturamento
                </h2>
              </div>

              {/* EXIBIÇÃO DE DADOS INTERNOS (Se for pagante) */}
              {userTier > 1 && subDetails?.status === 'active' ? (
                <div className="mb-10 space-y-4">
                  {/* Banner Principal de Gestão */}
                  <div className="bg-slate-50 border border-slate-100 p-6 md:p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3">
                      <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-lg">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Assinatura Ativa
                      </span>
                      <h3 className="text-lg font-black text-slate-900">
                        Seu plano atual é o Nível {userTier}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 max-w-xl leading-relaxed">
                        Você tem acesso total aos recursos premium do seu plano. Para visualizar o seu histórico de faturas, alterar o método de pagamento ou cancelar a renovação automática, acesse o painel seguro.
                      </p>
                    </div>
                    <button 
                      onClick={handleManageSubscription}
                      className="shrink-0 bg-slate-900 text-white hover:bg-violet-600 px-6 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm w-full md:w-auto text-center"
                    >
                      Gerenciar Assinatura ↗
                    </button>
                  </div>

                  {/* Informações Resumidas de Cobrança */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Próxima Cobrança</p>
                      <span className="text-sm font-bold text-slate-700">{subDetails.current_period_end}</span>
                    </div>
                    <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Valor do Plano</p>
                      <span className="text-sm font-bold text-slate-700">{subDetails.amount}<span className="text-[10px] text-slate-400 font-medium"> /mês</span></span>
                    </div>
                  </div>
                  
                  {/* Alerta de Cancelamento (Só aparece se o usuário tiver pedido para cancelar) */}
                  {subDetails.cancel_at_period_end && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-bold flex items-center gap-3">
                      <span className="text-lg">⚠️</span>
                      Sua assinatura foi cancelada e expirará em {subDetails.current_period_end}.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-10">
                  <PricingSection currentTier={userTier} />
                </div>
              )}

              {/* HISTÓRICO DE PAGAMENTOS */}
              {invoices.length > 0 && (
                <div className="mt-10 animate-in fade-in slide-in-from-top-4">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 px-1">
                    Histórico de Pagamentos
                  </h3>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                        <thead>
                          <tr className="border-b border-slate-200/60 bg-slate-100/50">
                            <th className="px-6 py-4 font-black text-slate-900">Data</th>
                            <th className="px-6 py-4 font-black text-slate-900">Fatura</th>
                            <th className="px-6 py-4 font-black text-slate-900">Valor</th>
                            <th className="px-6 py-4 font-black text-slate-900">Status</th>
                            <th className="px-6 py-4 font-black text-slate-900 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-white transition-colors">
                              <td className="px-6 py-4 text-slate-500 font-medium">{inv.date}</td>
                              <td className="px-6 py-4 text-slate-900 font-bold">{inv.number}</td>
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

// 🟢 ENVOLVEDOR OBRIGATÓRIO PARA O NEXT.JS 13+ QUANDO SE USA useSearchParams
export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-400 uppercase text-xs animate-pulse">Verificando Conta...</div>}>
      <ProfileContent />
    </Suspense>
  );
}