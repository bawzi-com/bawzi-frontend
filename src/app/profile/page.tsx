'use client';

import Image from 'next/image';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Building2, AlertTriangle, Sparkles, LogOut, RefreshCw, Lock, CreditCard, Shield, ChevronRight, ArrowLeft } from 'lucide-react';

import CompanyProfileForm from '../../components/CompanyProfileForm';
import PersonalDataForm from '../../components/PersonalDataForm';
import PasswordChangeForm from '../../components/PasswordChangeForm';
import TeamManager from '../../components/TeamManager';
import CompliancePanel from '../../components/CompliancePanel';
import { resolveEffectiveTier } from '@/lib/tier';

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
        const nivelAtualizado = resolveEffectiveTier(uData.tier, wData.tier);

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
        // 1. Manda o backend verificar o Stripe e actualizar workspace + user
        fetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`, { headers })
          .then(async (res) => {
            if (!res.ok) return;

            // 2. Re-busca TANTO workspace COMO user — igual à lógica inicial.
            //    Só workspace.tier causava regressão: se ws=1 mas user=4, ficava em 1.
            const [checkWsRes, checkUserRes] = await Promise.all([
              fetch(`${API_URL}/api/workspace/details`, { headers }),
              fetch(`${API_URL}/api/users/me`, { headers }),
            ]);
            if (!checkWsRes.ok || !checkUserRes.ok) return;

            const checkWs   = await checkWsRes.json();
            const checkUser = await checkUserRes.json();

            // 3. Mesma lógica que o fetch inicial: o maior dos dois vence
            const tierReal = resolveEffectiveTier(checkUser.tier, checkWs.tier);

            // 4. Actualiza UI só se o tier mudou (upgrade OU downgrade)
            if (tierReal !== nivelAtualizado) {
              setUserTier(tierReal);
              localStorage.setItem('bawzi_tier', String(tierReal));
              window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: tierReal } }));
            }
          })
          .catch(() => { /* auto-sync em background — silencioso */ });
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

          // Força o sync com Stripe antes de ler os dados
          await fetch(`${API_URL}/api/billing/sync`, { headers }).catch(() => {});

          const [userRes, wsRes] = await Promise.all([
            fetch(`${API_URL}/api/users/me`, { headers }),
            fetch(`${API_URL}/api/workspace/details`, { headers })
          ]);

          if (userRes.ok && wsRes.ok) {
            const uData = await userRes.json();
            const wData = await wsRes.json();
            // Workspace é a fonte de verdade — user.tier pode estar stale
            const nivelAtualizado = wData.tier || uData.tier || 1;
            const nivelAntigo = Number(localStorage.getItem('bawzi_tier') || 1);

            // Recarrega se o tier mudou (upgrade OU downgrade) ou se esgotaram as tentativas
            if (nivelAtualizado !== nivelAntigo || attempts >= maxAttempts) {
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
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 animate-pulse" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">A carregar perfil...</p>
        </div>
      </div>
    );
  }

  const initial = (userData?.name || userData?.email || 'B').charAt(0).toUpperCase();

  const navItems = [
    { id: 'sec-perfil',      label: 'Dados do Perfil',    icon: User },
    { id: 'sec-empresas',    label: 'Empresas',            icon: Building2 },
    { id: 'sec-seguranca',   label: 'Segurança',           icon: Shield },
    { id: 'sec-equipa',      label: 'Equipe',              icon: User },
    { id: 'sec-assinatura',  label: 'Assinatura',          icon: CreditCard },
    { id: 'sec-risco',       label: 'Zona de Risco',       icon: AlertTriangle },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Top bar (mobile only) ── */}
      <div className="lg:hidden sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push('/workspace')} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={16} /> Radar
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-black">{initial}</div>
          <span className="text-sm font-black text-slate-900">{userData?.name?.split(' ')[0]}</span>
        </div>
        <button onClick={() => { localStorage.clear(); router.push('/'); }} className="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors">
          <LogOut size={16} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:flex lg:gap-8 xl:gap-10 lg:items-start">

          {/* ══════════════════════════════════════════════
              SIDEBAR — sticky, desktop only
          ══════════════════════════════════════════════ */}
          <aside className="hidden lg:flex flex-col gap-4 w-60 xl:w-64 shrink-0 sticky top-10 self-start">

            {/* Avatar card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-2xl font-black shadow-md ring-4 ring-indigo-100">
                {initial}
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm leading-tight">{userData?.name || 'Usuário Bawzi'}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate max-w-[180px]">{userData?.email}</p>
              </div>
              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                ⭐ Nível {userTier}
              </span>
            </div>

            {/* Nav */}
            <nav className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {navItems.map((item, i) => {
                const Icon = item.icon;
                const isDanger = item.id === 'sec-risco';
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors text-left group',
                      i < navItems.length - 1 ? 'border-b border-slate-100' : '',
                      isDanger
                        ? 'text-red-500 hover:bg-red-50'
                        : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700',
                    ].join(' ')}
                  >
                    <Icon size={15} className={isDanger ? 'text-red-400' : 'text-slate-400 group-hover:text-indigo-500 transition-colors'} />
                    {item.label}
                    <ChevronRight size={13} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </nav>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push('/workspace')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors"
              >
                <ArrowLeft size={14} /> Voltar ao Radar
              </button>
              <button
                onClick={() => { localStorage.clear(); router.push('/'); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-rose-600 text-xs font-bold rounded-xl transition-colors"
              >
                <LogOut size={14} /> Terminar Sessão
              </button>
            </div>
          </aside>

          {/* ══════════════════════════════════════════════
              MAIN CONTENT
          ══════════════════════════════════════════════ */}
          <main className="flex-1 min-w-0 flex flex-col gap-5">

            {/* Page title (desktop) */}
            <div className="hidden lg:block mb-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Definições</h1>
              <p className="text-sm text-slate-500 font-medium mt-1">Gerenciar seu perfil, segurança e assinatura.</p>
            </div>

            {/* ── SECÇÃO: DADOS DO PERFIL ── */}
            <section id="sec-perfil" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100">
                <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                  <User size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Dados do Perfil</h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Nome e e-mail da conta</p>
                </div>
              </div>
              <div className="p-6">
                <PersonalDataForm userData={userData} token={authToken} onUpdate={fetchData} />
              </div>
            </section>

            {/* ── SECÇÃO: EMPRESAS ── */}
            <section id="sec-empresas" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Empresas em Monitorização</h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Slots do workspace</p>
                </div>
              </div>
              <div className="p-6">
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
            </section>

            {/* ── SECÇÃO: SEGURANÇA ── */}
            <section id="sec-seguranca" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl">
                  <Lock size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Segurança da Conta</h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Actualizar senha de acesso</p>
                </div>
              </div>
              <div className="p-6">
                <PasswordChangeForm token={authToken} />
              </div>
            </section>

            {/* ── SECÇÃO: EQUIPA ── */}
            <section id="sec-equipa" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6">
                <TeamManager userToken={authToken} tier={userTier} members={members} is_admin={isAdmin} onUpdate={fetchData} />
              </div>
            </section>

            {/* ── SECÇÃO: ASSINATURA ── */}
            <section id="sec-assinatura" className="scroll-mt-24">
              {userTier > 1 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-black text-slate-900">Assinatura Ativa</h2>
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Nível {userTier}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Acesso total aos recursos premium</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-0 sm:pl-4">
                      <button
                        onClick={forceManualSync}
                        disabled={isSyncing}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all"
                      >
                        <RefreshCw className={isSyncing ? 'animate-spin' : ''} size={14} /> Sync
                      </button>
                      <button
                        onClick={handleManageSubscription}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-violet-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all"
                      >
                        Gerir Faturas <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                  {invoices.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-3 font-black text-slate-500 uppercase tracking-wider">Data</th>
                            <th className="px-6 py-3 font-black text-slate-500 uppercase tracking-wider">Fatura</th>
                            <th className="px-6 py-3 font-black text-slate-500 uppercase tracking-wider">Valor</th>
                            <th className="px-6 py-3 font-black text-slate-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3.5 text-slate-500 font-medium">{inv.date}</td>
                              <td className="px-6 py-3.5 text-slate-900 font-bold">{inv.number}</td>
                              <td className="px-6 py-3.5 text-slate-900 font-black">{inv.amount}</td>
                              <td className="px-6 py-3.5">
                                {(() => {
                                  const s = inv.status as string;
                                  const cfg =
                                    s === 'Pago'        ? { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' } :
                                    s === 'Aberto'      ? { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200' }   :
                                    s === 'Inadimplente'? { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200' }        :
                                                          { dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 border-slate-200' };
                                  return (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase border px-2.5 py-1 rounded-full ${cfg.badge}`}>
                                      <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                                      {s || 'Pendente'}
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-8 relative overflow-hidden group">
                  <div className="absolute -right-16 -top-16 w-56 h-56 bg-violet-600/25 blur-[72px] rounded-full group-hover:bg-violet-500/35 transition-colors duration-700 pointer-events-none" />
                  <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Premium Bloqueado</span>
                      </div>
                      <h3 className="text-xl font-black text-white mb-1.5">Inteligência Competitiva</h3>
                      <p className="text-slate-400 text-sm font-medium max-w-sm">Análise de riscos e compliance total para vencer licitações.</p>
                    </div>
                    <Link
                      href="/plans"
                      className="shrink-0 px-6 py-3 bg-white text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-md"
                    >
                      Ver Planos 🚀
                    </Link>
                  </div>
                </div>
              )}
            </section>

            {/* ── SECÇÃO: ZONA DE RISCO ── */}
            <section id="sec-risco" className="scroll-mt-24">
              <div className="rounded-2xl border border-red-200 bg-white overflow-hidden">
                <div className="flex items-center gap-4 px-6 py-5 bg-red-50 border-b border-red-100">
                  <div className="p-2.5 bg-white text-red-500 rounded-xl border border-red-100 shadow-sm">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-red-900">Zona de Risco</h2>
                    <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest mt-0.5">Acções irreversíveis</p>
                  </div>
                </div>
                <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-sm font-medium text-slate-600 max-w-md">A exclusão da conta eliminará permanentemente todos os seus dados e histórico.</p>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="shrink-0 px-5 py-2.5 bg-white border border-red-200 text-red-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                  >
                    {isDeleting ? 'A apagar...' : 'Excluir Conta'}
                  </button>
                </div>
              </div>
            </section>

          </main>
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