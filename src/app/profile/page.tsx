'use client';

import Image from 'next/image';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Building2, Users, AlertTriangle, Sparkles, LogOut, RefreshCw, ChevronUp, ChevronDown, Lock } from 'lucide-react';

import CompanyProfileForm from '../../components/CompanyProfileForm'; 
import PersonalDataForm from '../../components/PersonalDataForm';
import PasswordChangeForm from '../../components/PasswordChangeForm';
import TeamManager from '../../components/TeamManager';
import CompliancePanel from '../../components/CompliancePanel';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeSuccess = searchParams.get('success');

  const [authToken, setAuthToken] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [userTier, setUserTier] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado para controlar qual CNPJ o painel da CGU deve analisar em tempo real
  const [activeCnpj, setActiveCnpj] = useState<string>('');
  
  const [members, setMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false); 
  const [isSyncing, setIsSyncing] = useState(false);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const fetchData = async () => {
    const token = localStorage.getItem('bawzi_token');
    if (!token) { router.push('/'); return; }
    setAuthToken(token);

    try {
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

      const [userRes, wsRes, membersRes, invRes] = await Promise.all([
        fetch(`${API_URL}/api/users/me`, { headers }),
        fetch(`${API_URL}/api/workspace/details`, { headers }),
        fetch(`${API_URL}/api/workspace/members`, { headers }),
        fetch(`${API_URL}/api/billing/invoices`, { headers })
      ]);

      if (userRes.status === 401) { localStorage.clear(); router.push('/'); return; }

      if (userRes.ok && wsRes.ok) {
        const uData = await userRes.json();
        const wData = await wsRes.json();

        const companies = wData.companies || (wData.company ? [wData.company] : []);
        const nivelAtualizado = Math.max(uData.tier || 1, wData.tier || 1);

        setUserData({ 
          ...uData, 
          workspace_users_count: wData.workspace_users_count, 
          vagas_totais: wData.vagas_totais, 
          companies: companies 
        });

        if (companies.length > 0 && !activeCnpj) {
          setActiveCnpj(companies[0].cnpj);
        }

        setUserTier(nivelAtualizado);
        setIsAdmin(wData.is_admin);

        // 🟢 1. Atualiza o LocalStorage
        localStorage.setItem('bawzi_tier', String(nivelAtualizado));
        
        // 🟢 2. DISPARA EVENTO GLOBAL: Avisa o Menu Lateral/Cabeçalho para mudar na hora!
        window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: nivelAtualizado } }));

        // 🟢 3. AUTO-SYNC À PROVA DE FALHAS: 
        // 1. Manda o backend verificar o Stripe
        fetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`, { headers })
          .then(async (res) => {
            if (!res.ok) return;
            
            // 2. Pergunta ao banco de dados qual é o nível real agora
            const checkRes = await fetch(`${API_URL}/api/workspace/details`, { headers });
            const checkData = await checkRes.json();
            
            // 3. Pega no nível atualizado
            const tierReal = checkData.tier || 1;

            // 4. Se o Stripe atualizou o banco e o nível é maior, forçamos a tela a mudar!
            if (tierReal > nivelAtualizado) {
              setUserTier(tierReal);
              localStorage.setItem('bawzi_tier', String(tierReal));
              window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: tierReal } }));
            }
          })
          .catch(() => console.log("Auto-Sync em background ignorado."));
      }
      
      if (membersRes.ok) setMembers(await membersRes.json());
      if (invRes && invRes.ok) setInvoices(await invRes.json());
      
    } catch (error) {
      console.error("Erro ao sincronizar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
            const nivelAtualizado = Math.max(uData.tier || 1, wData.tier || 1);
            const nivelAntigo = Number(localStorage.getItem('bawzi_tier') || 1);

            if (nivelAtualizado > nivelAntigo || attempts >= maxAttempts) {
              localStorage.setItem('bawzi_tier', String(nivelAtualizado));
              window.location.href = '/profile'; 
            } else {
              setTimeout(waitForWebhookAndReload, 2000);
            }
          }
        } catch (error) {
          console.error("Erro na verificação de pagamento:", error);
        }
      };
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
    } catch (error) { alert("Erro ao aceder ao faturamento."); }
  };

  const forceManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${authToken}`, 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (res.ok) window.location.reload(); 
    } catch (error) { console.error("Erro ao forçar sync", error); }
    finally { setIsSyncing(false); }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Eliminar conta permanentemente?")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) { localStorage.clear(); window.location.href = '/'; } 
    } catch (error) { setIsDeleting(false); }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-black text-slate-400 uppercase animate-pulse">A carregar perfil...</div>;
  }

  const initial = (userData?.name || userData?.email || 'B').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg border-2 border-white">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900">{userData?.name || 'Utilizador Bawzi'}</h1>
                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                  ⭐ Nível {userTier}
                </span>
              </div>
              <p className="text-slate-500 font-medium">{userData?.email}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button onClick={() => { localStorage.clear(); router.push('/'); }} className="text-sm font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1.5 transition-colors">
              <LogOut size={16} /> Terminar Sessão
            </button>
            <button onClick={() => router.push('/workspace')} className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
              Voltar ao Radar ↗
            </button>
          </div>
        </div>

        {/* ======================================================= */}
        {/* ESTRUTURA VERTICAL: CONTA > EMPRESAS > SEGURANÇA       */}
        {/* ======================================================= */}
        <div className="flex flex-col gap-8 mb-8">
          
          {/* 🛡️ CARTÃO 1: CONFIGURAÇÕES DA CONTA */}
          <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-sm border border-slate-200 flex flex-col w-full">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-slate-50 text-slate-700 rounded-2xl border border-slate-100">
                <User size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Configurações da Conta</h2>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Dados do Perfil</p>
              </div>
            </div>
            
            <PersonalDataForm userData={userData} token={authToken} onUpdate={fetchData} />
          </div>

          {/* 🏢 CARTÃO 2: EMPRESAS EM MONITORIZAÇÃO (WORKSPACE) */}
          <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-sm border border-slate-200 flex flex-col w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                  <Building2 size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Empresas em Monitorização</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Slots do Workspace</p>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100">
              <CompanyProfileForm 
                token={authToken} 
                userTier={userTier} 
                companyData={userData?.companies} 
                onCnpjDetected={(cnpj: string) => {
                  setActiveCnpj(cnpj);
                  localStorage.setItem('bawzi_active_cnpj', cnpj);
                }}
                onUpdate={fetchData}
              />
            </div>
          </div>
          
        </div>


        {/* ======================================================= */}
        {/* LINHA 2: SEGURANÇA DA CONTA (1 COLUNA - LARGURA TOTAL)  */}
        {/* ======================================================= */}
        <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-sm border border-slate-200 mb-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md">
              <Lock size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Segurança da Conta</h2>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Atualize a sua senha de acesso</p>
            </div>
          </div>

          {/* O COMPONENTE DE SENHA É INJETADO AQUI */}
          <PasswordChangeForm token={authToken} />
        </div>

        {/* WORKSPACE E EQUIPA */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
          <TeamManager userToken={authToken} tier={userTier} members={members} is_admin={isAdmin} onUpdate={fetchData} />
        </div>

        {/* FATURAMENTO */}
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
              <div className="flex items-center gap-3">
                <button onClick={forceManualSync} disabled={isSyncing} className="px-5 py-3.5 bg-white border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
                  <RefreshCw className={isSyncing ? 'animate-spin' : ''} size={16} /> Sync
                </button>
                <button onClick={handleManageSubscription} className="px-6 py-3.5 bg-slate-900 text-white hover:bg-violet-600 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                  Gerir Faturas ↗
                </button>
              </div>
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
          <div className="bg-slate-950 rounded-[2rem] p-10 border border-slate-800 relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-violet-600/30 blur-[80px] rounded-full group-hover:bg-violet-500/40 transition-colors duration-700"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={20} className="text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Funcionalidade Premium Bloqueada</span>
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Inteligência Competitiva</h3>
                <p className="text-slate-400 text-sm font-medium max-w-xl">Desbloqueie o motor de análise de riscos e compliance total para vencer licitações.</p>
              </div>
              <Link href="/plans" className="px-8 py-4 bg-white text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl hover:scale-105 transition-all">
                Ver Planos 🚀
              </Link>
            </div>
          </div>
        )}

        {/* ZONA DE RISCO */}
        <div className="mt-12 border border-red-200 bg-red-50/50 rounded-[2rem] p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white text-red-500 rounded-xl border border-red-100 shadow-sm"><AlertTriangle size={24} /></div>
              <div>
                <h3 className="text-lg font-black text-red-900 mb-1">Zona de Risco</h3>
                <p className="text-red-700 font-medium text-sm max-w-xl">A exclusão da conta eliminará permanentemente todos os seus dados e histórico.</p>
              </div>
            </div>
            <button onClick={handleDeleteAccount} disabled={isDeleting} className="px-6 py-3.5 bg-white border border-red-200 text-red-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-red-600 hover:text-white transition-all">
              {isDeleting ? 'A apagar...' : 'Excluir Conta'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-400 uppercase text-xs">A carregar...</div>}>
      <ProfileContent />
    </Suspense>
  );
}