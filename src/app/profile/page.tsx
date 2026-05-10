'use client';
import Image from 'next/image';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Building2, Users, AlertTriangle, Sparkles, LogOut } from 'lucide-react'; // 🟢 Certifique-se de importar os ícones

import CompanyProfileForm from '../../components/CompanyProfileForm'; 
import PersonalDataForm from '../../components/PersonalDataForm';
import TeamManager from '../../components/TeamManager';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeSuccess = searchParams.get('success');

  const [authToken, setAuthToken] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [userTier, setUserTier] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  
  const [members, setMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false); 

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const fetchData = async () => {
    const token = localStorage.getItem('bawzi_token');
    
    // 1. Verificação de segurança: se não há token, volta para o início
    if (!token) { 
      router.push('/'); 
      return; 
    }
    setAuthToken(token);

    try {
      const headers = { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      };

      // 2. Dispara todas as consultas ao MongoDB em paralelo para máxima performance
      const [userRes, wsRes, membersRes, invRes] = await Promise.all([
        fetch(`${API_URL}/api/users/me`, { headers }),
        fetch(`${API_URL}/api/workspace/details`, { headers }),
        fetch(`${API_URL}/api/workspace/members`, { headers }),
        fetch(`${API_URL}/api/billing/invoices`, { headers })
      ]);

      // 3. Gestão de Sessão: se o token for inválido/expirado, limpa tudo
      if (userRes.status === 401) { 
        localStorage.clear(); 
        router.push('/'); 
        return; 
      }

      if (userRes.ok && wsRes.ok) {
        const uData = await userRes.json();
        const wData = await wsRes.json();

        // 4. Atualiza o Estado Local da Página
        setUserData({ 
          ...uData, 
          workspace_users_count: wData.workspace_users_count, 
          vagas_totais: wData.vagas_totais, 
          company: wData.company 
        });

        // 5. CÁLCULO DO NÍVEL REAL:
        // Comparamos o tier do utilizador com o do workspace e pegamos o maior (o pago)
        const nivelAtualizado = Math.max(uData.tier || 1, wData.tier || 1);
        setUserTier(nivelAtualizado);
        setIsAdmin(wData.is_admin);

        // 6. SINCRONIZAÇÃO COM O HEADER (Cache do Navegador):
        // Gravamos os dados frescos no localStorage para que o Header e o Avatar 
        // atualizem sem precisar de um novo Login ou Refresh manual.
        localStorage.setItem('bawzi_tier', String(nivelAtualizado));
        localStorage.setItem('bawzi_user', JSON.stringify({
          name: uData.name,
          email: uData.email
        }));
      }
      
      // 7. Atualiza listas de equipa e faturas se as respostas forem positivas
      if (membersRes.ok) setMembers(await membersRes.json());
      if (invRes && invRes.ok) {
        const invoicesData = await invRes.json();
        setInvoices(invoicesData);
      }
      
    } catch (error) {
      console.error("Erro crítico ao sincronizar dados com o MongoDB:", error);
    } finally {
      // Finaliza o estado de loading para mostrar a interface
      setIsLoading(false);
    }
  };

  // 🟢 SMART POLLING SUBSTITUINDO O USE-EFFECT ANTIGO
  useEffect(() => {
    if (stripeSuccess) {
      let attempts = 0;
      const maxAttempts = 6;

      const waitForWebhookAndReload = async () => {
        attempts++;
        const token = localStorage.getItem('bawzi_token');
        if (!token) return;
        
        try {
          const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
          const [userRes, wsRes] = await Promise.all([
            fetch(`${API_URL}/api/users/me`, { headers }),
            fetch(`${API_URL}/api/workspace/details`, { headers })
          ]);

          if (userRes.ok && wsRes.ok) {
            const uData = await userRes.json();
            const wData = await wsRes.json();
            
            // Calcula o nível que veio AGORA do banco de dados
            const nivelAtualizado = Math.max(uData.tier || 1, wData.tier || 1);
            // Vê o nível que o navegador tinha guardado antes da compra
            const nivelAntigo = Number(localStorage.getItem('bawzi_tier') || 1);

            // Se o nível subiu no Mongo, o Webhook da Stripe já fez o seu trabalho!
            if (nivelAtualizado > nivelAntigo || attempts >= maxAttempts) {
              // 1. Atualiza o cache imediatamente
              localStorage.setItem('bawzi_tier', String(nivelAtualizado));
              localStorage.setItem('bawzi_user', JSON.stringify({ name: uData.name, email: uData.email }));
              
              // 2. Faz UM ÚNICO refresh limpo para carregar a nova interface (Header, Limites, Crachás)
              window.location.href = '/profile'; 
            } else {
              // Se ainda é Nível antigo, o Webhook ainda está a processar. Espera 2 seg e tenta de novo.
              setTimeout(waitForWebhookAndReload, 2000);
            }
          }
        } catch (error) {
          console.error("Erro na verificação de pagamento:", error);
        }
      };

      // Inicia a vigia
      waitForWebhookAndReload();

    } else {
      fetchData();
    }
  }, [stripeSuccess, API_URL]);

  const handleManageSubscription = async () => {
    try {
      const res = await fetch(`${API_URL}/api/billing/customer-portal`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else alert(data.detail || "Erro ao abrir o faturamento.");
    } catch (error) { alert("Erro de conexão ao acessar faturamento."); }
  };

  // 🟢 NOVA FUNÇÃO MOVIDA PARA AQUI: Excluir Conta
  const handleDeleteAccount = async () => {
    const msg = "Atenção: Se for o único membro, o seu Workspace e histórico serão eliminados permanentemente. Continuar?";
    if (!window.confirm(msg)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) { localStorage.clear(); window.location.href = '/?account_deleted=true'; } 
      else throw new Error("Erro ao eliminar conta");
    } catch (error: any) {
      alert(error.message);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-400">A carregar perfil...</div>;
  }

  const initial = (userData?.name || userData?.email || 'B').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* ======================================================= */}
        {/* CABEÇALHO DO PERFIL                                     */}
        {/* ======================================================= */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-200 border-2 border-white">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900">{userData?.name || 'Utilizador Bawzi'}</h1>
                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest hidden sm:block">
                  ⭐ Nível {userTier}
                </span>
              </div>
              <p className="text-slate-500 font-medium">{userData?.email}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest sm:hidden w-fit">
              ⭐ Nível {userTier}
            </span>
            <button onClick={() => { localStorage.clear(); router.push('/'); }} className="text-sm font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1.5 transition-colors">
              <LogOut size={16} /> Terminar Sessão
            </button>
            <button onClick={() => router.push('/workspace')} className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
              Voltar ao Radar ↗
            </button>
          </div>
        </div>

        {/* ======================================================= */}
        {/* CARTÃO 1 E 2: DADOS PESSOAIS E EMPRESA                  */}
        {/* ======================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-100"><User size={20} /></div>
              <h2 className="text-lg font-black text-slate-900">Dados do Utilizador</h2>
            </div>
            <PersonalDataForm userData={userData} token={authToken} onUpdate={fetchData} />
          </div>

          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-100"><Building2 size={20} /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Empresa Vinculada</h2>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Inteligência CNAE Ativa
                  </span>
                </div>
              </div>
            </div>
            <CompanyProfileForm token={authToken} userTier={userTier} />
          </div>
        </div>

        {/* ======================================================= */}
        {/* CARTÃO 3: WORKSPACE E EQUIPA                            */}
        {/* ======================================================= */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
          <TeamManager userToken={authToken} tier={userTier} members={members} is_admin={isAdmin} onUpdate={fetchData} />
        </div>

        {/* ======================================================= */}
        {/* CARTÃO 4: FATURAMENTO OU UPSELL                         */}
        {/* ======================================================= */}
        {userTier > 1 ? (
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md mb-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Assinatura Ativa
                </span>
                <h3 className="text-2xl font-black text-slate-900">Nível {userTier}</h3>
                <p className="text-sm font-medium text-slate-500">Acesso total aos recursos premium.</p>
              </div>
              <button onClick={handleManageSubscription} className="bg-slate-900 text-white hover:bg-violet-600 px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 text-center">
                Gerir Pagamentos e Faturas ↗
              </button>
            </div>
            
            {invoices.length > 0 && (
               <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                 <table className="w-full text-left text-xs md:text-sm">
                   <thead className="bg-slate-100/50">
                     <tr>
                       <th className="px-5 py-3 font-black text-slate-700">Data</th>
                       <th className="px-5 py-3 font-black text-slate-700">Fatura</th>
                       <th className="px-5 py-3 font-black text-slate-700">Valor</th>
                       <th className="px-5 py-3 font-black text-slate-700">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {invoices.map((inv) => (
                       <tr key={inv.id} className="hover:bg-white transition-colors">
                         <td className="px-5 py-3 text-slate-500 font-medium">{inv.date}</td>
                         <td className="px-5 py-3 text-slate-900 font-bold">{inv.number}</td>
                         <td className="px-5 py-3 text-slate-900 font-black">{inv.amount}</td>
                         <td className="px-5 py-3"><span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Pago</span></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-950 rounded-[2rem] p-10 shadow-xl relative overflow-hidden group border border-slate-800">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-violet-600/30 blur-[80px] rounded-full group-hover:bg-violet-500/40 transition-colors duration-700"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={20} className="text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Funcionalidade Premium Bloqueada</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight">Inteligência Competitiva e Análise de Riscos</h3>
                <p className="text-slate-400 text-sm font-medium max-w-xl leading-relaxed">
                  Faça o upgrade para o Nível Essencial e desbloqueie o motor Multi-LLM da Bawzi, mapeando armadilhas jurídicas e prevendo margens no PNCP.
                </p>
              </div>
              <Link href="/plans" className="w-full md:w-auto px-8 py-4 bg-white text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg text-center shrink-0">
                Ver Planos Disponíveis 🚀
              </Link>
            </div>
          </div>
        )}

        {/* ======================================================= */}
        {/* CARTÃO 5: ZONA DE RISCO                                 */}
        {/* ======================================================= */}
        <div className="mt-12 border border-red-200 bg-red-50/50 rounded-[2rem] p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white text-red-500 rounded-xl border border-red-100 shadow-sm shrink-0"><AlertTriangle size={24} /></div>
              <div>
                <h3 className="text-lg font-black text-red-900 mb-1">Zona de Risco (Exclusão)</h3>
                <p className="text-red-700 font-medium text-sm leading-relaxed max-w-xl">
                  Ao excluir a sua conta permanentemente, não será possível recuperar os seus créditos, configurações de workspace ou histórico de análises.
                </p>
              </div>
            </div>
            <button onClick={handleDeleteAccount} disabled={isDeleting} className="px-6 py-3.5 bg-white border border-red-200 text-red-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm shrink-0 disabled:opacity-50">
              {isDeleting ? 'A apagar...' : 'Excluir Minha Conta'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-400 uppercase text-xs animate-pulse">A carregar...</div>}>
      <ProfileContent />
    </Suspense>
  );
}