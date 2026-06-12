'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Building2,
  AlertTriangle,
  Sparkles,
  LogOut,
  RefreshCw,
  Lock,
  CreditCard,
  Shield,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Users,
  Activity,
  Crown,
} from 'lucide-react';

import CompanyProfileForm from '../../components/CompanyProfileForm';
import PersonalDataForm from '../../components/PersonalDataForm';
import PasswordChangeForm from '../../components/PasswordChangeForm';
import TwoFactorSettings from '../../components/TwoFactorSettings';
import TeamManager from '../../components/TeamManager';
import { resolveEffectiveTier } from '@/lib/tier';

type ProfileIcon = React.ComponentType<{ size?: number; className?: string }>;
type SectionTone = 'emerald' | 'sky' | 'slate' | 'amber' | 'red';

const sectionToneClasses: Record<SectionTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  sky: 'bg-sky-50 text-sky-700 border-sky-100',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  red: 'bg-red-50 text-red-700 border-red-100',
};

function SectionHeading({
  icon: Icon,
  title,
  eyebrow,
  tone = 'emerald',
  actions,
}: {
  icon: ProfileIcon;
  title: string;
  eyebrow: string;
  tone?: SectionTone;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${sectionToneClasses[tone]}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
        </div>
      </div>
      {actions}
    </div>
  );
}

function getFallbackSeats(tier: number) {
  if (tier === 4) return 10;
  if (tier === 3) return 5;
  if (tier === 2) return 3;
  return 1;
}

function getTierName(tier: number) {
  if (tier >= 4) return 'Enterprise';
  if (tier === 3) return 'Scale';
  if (tier === 2) return 'Pro';
  return 'Gratuito';
}

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
  // UX: seção ativa no menu (scroll-spy) + status 2FA no card do avatar
  const [activeSection, setActiveSection] = useState('sec-perfil');
  const [twoFAOn, setTwoFAOn] = useState<boolean | null>(null);

  // Scroll-spy: destaca no menu a seção visível
  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;
    const ids = ['sec-perfil', 'sec-empresas', 'sec-seguranca', 'sec-equipe', 'sec-assinatura', 'sec-risco'];
    const observer = new IntersectionObserver(
      (entries) => {
        const visivel = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visivel?.target?.id) setActiveSection(visivel.target.id);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: [0, 0.2, 0.5] },
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isLoading]);

  // Status do 2FA para o chip do avatar
  useEffect(() => {
    if (!authToken) return;
    fetch(`${API_URL}/api/auth/2fa/status`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setTwoFAOn(d ? !!d.ativo : null))
      .catch(() => setTwoFAOn(null));
  }, [authToken]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-emerald-600" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  const initial = (userData?.name || userData?.email || 'B').charAt(0).toUpperCase();

  const navItems = [
    { id: 'sec-perfil',      label: 'Perfil',      icon: User },
    { id: 'sec-empresas',    label: 'Empresas',    icon: Building2 },
    { id: 'sec-seguranca',   label: 'Segurança',   icon: Shield },
    { id: 'sec-equipe',      label: 'Equipe',      icon: Users },
    { id: 'sec-assinatura',  label: 'Assinatura',  icon: CreditCard },
    { id: 'sec-risco',       label: 'Risco',       icon: AlertTriangle },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const companies = userData?.companies ?? [];
  const totalEmpresas = companies.length;
  const displayName = userData?.name || userData?.nome || 'Usuário Bawzi';
  const firstName = displayName.split(' ')[0];
  const memberCount = members.length || userData?.workspace_users_count || 1;
  const seatLimit = userData?.vagas_totais || getFallbackSeats(userTier);
  const seatPercent = Math.min(Math.round((memberCount / seatLimit) * 100), 100);
  const activeCompany = companies.find((company: any) => company.cnpj === activeCnpj) || companies[0] || userData?.company;
  const companyName = activeCompany?.nome_fantasia || activeCompany?.razao_social || 'Nenhuma empresa ativa';
  const planName = getTierName(userTier);

  const summaryCards = [
    { label: 'Plano', value: `Nível ${userTier}`, description: planName, icon: Crown, tone: 'emerald' as const },
    { label: 'Empresas', value: String(totalEmpresas), description: totalEmpresas === 1 ? 'empresa monitorada' : 'empresas monitoradas', icon: Building2, tone: 'sky' as const },
    { label: 'Equipe', value: `${memberCount}/${seatLimit}`, description: `${seatPercent}% das vagas usadas`, icon: Users, tone: 'slate' as const },
    {
      label: 'Segurança',
      value: twoFAOn === null ? 'Verificando' : twoFAOn ? '2FA ativa' : '2FA pendente',
      description: twoFAOn ? 'Conta reforçada' : 'Recomendado ativar',
      icon: Shield,
      tone: twoFAOn ? 'emerald' as const : 'amber' as const,
    },
  ];

  const panelClass = 'scroll-mt-32 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm';

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="lg:hidden sticky top-[72px] z-30 overflow-x-auto border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
        <div className="flex w-max gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isDanger = item.id === 'sec-risco';
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={[
                  'flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-[11px] font-black uppercase tracking-wide transition-colors',
                  isDanger
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : isActive
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600',
                ].join(' ')}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <button
              onClick={() => router.push('/workspace')}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              Voltar ao radar
            </button>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Conta Bawzi</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Perfil e workspace</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Gerencie dados de acesso, empresas monitoradas, equipe, segurança e assinatura em um único painel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-700">
              <CheckCircle2 size={14} />
              {planName}
            </span>
            <button
              onClick={() => { localStorage.clear(); router.push('/'); }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>

        <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-sky-600 text-xl font-black text-white shadow-sm">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-black text-slate-950">{displayName}</h2>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Nível {userTier}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-slate-500">{userData?.email}</p>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <Activity size={13} />
                    Contexto ativo
                  </div>
                  <p className="mt-2 truncate text-sm font-black text-slate-800">{companyName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.label}
                  onClick={() => {
                    if (card.label === 'Empresas') scrollTo('sec-empresas');
                    if (card.label === 'Equipe') scrollTo('sec-equipe');
                    if (card.label === 'Segurança') scrollTo('sec-seguranca');
                    if (card.label === 'Plano') scrollTo('sec-assinatura');
                  }}
                  className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
                >
                  <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg border ${sectionToneClasses[card.tone]}`}>
                    <Icon size={17} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                  <p className="mt-1 text-xl font-black text-slate-950">{card.value}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{card.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-3">
              <nav className="overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isDanger = item.id === 'sec-risco';
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollTo(item.id)}
                      className={[
                        'group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-bold transition-colors',
                        isDanger
                          ? 'text-red-600 hover:bg-red-50'
                          : isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                      ].join(' ')}
                    >
                      <Icon size={16} className={isDanger ? 'text-red-500' : isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'} />
                      <span>{item.label}</span>
                      <ChevronRight size={14} className={`ml-auto ${isActive ? 'text-emerald-600 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`} />
                    </button>
                  );
                })}
              </nav>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Olá, {firstName}</p>
                <p className="mt-2 text-sm font-bold leading-5 text-slate-700">
                  {twoFAOn ? 'Sua conta está com autenticação em dois fatores ativa.' : 'Ative a autenticação em dois fatores para reforçar a proteção.'}
                </p>
                <button
                  onClick={() => scrollTo('sec-seguranca')}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700 transition-colors hover:text-emerald-800"
                >
                  Revisar segurança
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </aside>

          <main className="min-w-0 space-y-4">
            <section id="sec-perfil" className={panelClass}>
              <SectionHeading icon={User} title="Dados do perfil" eyebrow="Nome e e-mail da conta" tone="slate" />
              <div className="p-5 sm:p-6">
                <PersonalDataForm userData={userData} token={authToken} onUpdate={fetchData} />
              </div>
            </section>

            <section id="sec-empresas" className={panelClass}>
              <SectionHeading icon={Building2} title="Empresas monitoradas" eyebrow="Slots e contexto operacional" tone="sky" />
              <div className="p-5 sm:p-6">
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

            <section id="sec-seguranca" className={panelClass}>
              <SectionHeading icon={Lock} title="Segurança da conta" eyebrow="Senha de acesso e autenticação em dois fatores" tone="slate" />
              <div className="space-y-6 p-5 sm:p-6">
                <PasswordChangeForm token={authToken} />
                <div className="border-t border-slate-200 pt-6">
                  <TwoFactorSettings />
                </div>
              </div>
            </section>

            <section id="sec-equipe" className={panelClass}>
              <SectionHeading icon={Users} title="Equipe" eyebrow="Acessos e permissões do workspace" tone="emerald" />
              <div className="p-5 sm:p-6">
                <TeamManager userToken={authToken} tier={userTier} members={members} is_admin={isAdmin} onUpdate={fetchData} />
              </div>
            </section>

            <section id="sec-assinatura" className={panelClass}>
              {userTier > 1 ? (
                <>
                  <SectionHeading
                    icon={CreditCard}
                    title="Assinatura ativa"
                    eyebrow={`Plano ${planName} em uso`}
                    tone="emerald"
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={forceManualSync}
                          disabled={isSyncing}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                        >
                          <RefreshCw className={isSyncing ? 'animate-spin' : ''} size={14} />
                          Sincronizar
                        </button>
                        <button
                          onClick={handleManageSubscription}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700"
                        >
                          Faturas
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    }
                  />
                  {invoices.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-5 py-3 font-black uppercase tracking-wider text-slate-500">Data</th>
                            <th className="px-5 py-3 font-black uppercase tracking-wider text-slate-500">Fatura</th>
                            <th className="px-5 py-3 font-black uppercase tracking-wider text-slate-500">Valor</th>
                            <th className="px-5 py-3 font-black uppercase tracking-wider text-slate-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="transition-colors hover:bg-slate-50">
                              <td className="px-5 py-3.5 font-medium text-slate-500">{inv.date}</td>
                              <td className="px-5 py-3.5 font-bold text-slate-900">{inv.number}</td>
                              <td className="px-5 py-3.5 font-black text-slate-900">{inv.amount}</td>
                              <td className="px-5 py-3.5">
                                {(() => {
                                  const s = inv.status as string;
                                  const cfg =
                                    s === 'Pago' ? { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' } :
                                    s === 'Aberto' ? { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' } :
                                    s === 'Inadimplente' ? { dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' } :
                                    { dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600 border-slate-200' };
                                  return (
                                    <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-black uppercase ${cfg.badge}`}>
                                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
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
                  ) : (
                    <div className="p-5">
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                        Nenhuma fatura disponível no momento.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-slate-950 p-6 text-white sm:p-7">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                        <Sparkles size={14} />
                        Plano gratuito
                      </div>
                      <h3 className="text-xl font-black">Desbloqueie inteligência competitiva</h3>
                      <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-300">
                        Recursos de compliance avançado, equipe e análises premium ficam disponíveis nos planos pagos.
                      </p>
                    </div>
                    <Link
                      href="/plans"
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 text-xs font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-emerald-50"
                    >
                      Ver planos
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <section id="sec-risco" className={panelClass}>
              <SectionHeading icon={AlertTriangle} title="Zona de risco" eyebrow="Ações irreversíveis" tone="red" />
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <p className="max-w-xl text-sm font-medium leading-6 text-slate-600">
                  A exclusão da conta eliminará permanentemente todos os seus dados, empresas monitoradas e histórico.
                </p>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-[10px] font-black uppercase tracking-widest text-red-600 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white disabled:opacity-60"
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir conta'}
                </button>
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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-xs font-black uppercase text-slate-400">Carregando...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
