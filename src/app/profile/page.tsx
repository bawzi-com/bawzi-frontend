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
  Crown,
  Bell,
} from 'lucide-react';
import { subscribeToPush, unsubscribeFromPush } from '../../lib/pushNotifications';

import CompanyProfileForm from '../../components/CompanyProfileForm';
import PersonalDataForm from '../../components/PersonalDataForm';
import PasswordChangeForm from '../../components/PasswordChangeForm';
import TwoFactorSettings from '../../components/TwoFactorSettings';
import TeamManager from '../../components/TeamManager';
import CardUpdateModal from '../../components/CardUpdateModal';
import ActiveContextSwitcher from '../../components/ActiveContextSwitcher';
import {
  ACTIVE_CONTEXT_EVENT,
  getPreferredActiveCnpj,
  getStoredActiveCnpj,
  setActiveCompanyContext,
  type ActiveContextEventDetail,
} from '@/lib/activeContext';
import { resolveEffectiveTier } from '@/lib/tier';
import { apiFetch, getAuthToken, clearSession, SessionExpiredError } from '@/lib/apiClient';

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
  const [activeCnpj, setActiveCnpj] = useState<string>(() => getStoredActiveCnpj());
  
  const [members, setMembers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [billingAction, setBillingAction] = useState<string | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savedCard, setSavedCard] = useState<{ brand: string; last4: string; exp_month: number; exp_year: number } | null>(null);
  const [changePlanModal, setChangePlanModal] = useState<{ tier: number } | null>(null);
  const [invoicesVisible, setInvoicesVisible] = useState(5);
  const [cleanupRequired, setCleanupRequired] = useState(false);
  const [membersOverflow, setMembersOverflow] = useState(0);
  const [cleanupDeadline, setCleanupDeadline] = useState<string | null>(null);
  // UX: seção ativa no menu (scroll-spy) + status 2FA no card do avatar
  const [activeSection, setActiveSection] = useState('sec-perfil');
  const [twoFAOn, setTwoFAOn] = useState<boolean | null>(null);

  useEffect(() => {
    const handleContextUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ActiveContextEventDetail>).detail;
      if (!detail?.active_cnpj) return;

      setActiveCnpj(detail.active_cnpj);
      setUserData((prev: any) => prev ? { ...prev, active_cnpj: detail.active_cnpj } : prev);
    };

    window.addEventListener(ACTIVE_CONTEXT_EVENT, handleContextUpdate);
    return () => window.removeEventListener(ACTIVE_CONTEXT_EVENT, handleContextUpdate);
  }, []);

  // Scroll-spy: destaca no menu a seção visível
  useEffect(() => {
    if (isLoading || typeof window === 'undefined') return;
    const ids = ['sec-perfil', 'sec-empresas', 'sec-seguranca', 'sec-equipe', 'sec-assinatura', 'sec-privacidade', 'sec-risco'];
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
    apiFetch(`${API_URL}/api/auth/2fa/status`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setTwoFAOn(d ? !!d.ativo : null))
      .catch(() => setTwoFAOn(null));
  }, [authToken]);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const fetchData = async () => {
    const token = getAuthToken();
    if (!token) { router.push('/'); return; }
    setAuthToken(token);

    try {
      const [userRes, wsRes, membersRes, invRes, subRes, pmRes] = await Promise.all([
        apiFetch(`${API_URL}/api/users/me`),
        apiFetch(`${API_URL}/api/workspace/details`),
        apiFetch(`${API_URL}/api/workspace/members`),
        apiFetch(`${API_URL}/api/billing/invoices`),
        apiFetch(`${API_URL}/api/billing/subscription-details`),
        apiFetch(`${API_URL}/api/billing/payment-method`),
      ]);

      if (userRes.ok && wsRes.ok) {
        const uData = await userRes.json();
        const wData = await wsRes.json();

        const companies = wData.companies || (wData.company ? [wData.company] : []);
        const nivelAtualizado = resolveEffectiveTier(uData.tier, wData.tier);
        const nextActiveCnpj = getPreferredActiveCnpj(companies, activeCnpj);
        if (nextActiveCnpj) setActiveCompanyContext(nextActiveCnpj, false);

        setUserData({
          ...uData,
          workspace_users_count: wData.workspace_users_count,
          vagas_totais: wData.vagas_totais,
          workspace_name: wData.workspace_name,
          companies: companies,
          active_cnpj: nextActiveCnpj,
        });

        setCleanupRequired(!!wData.cleanup_required);
        setMembersOverflow(wData.members_overflow ?? 0);
        setCleanupDeadline(wData.cleanup_deadline ?? null);

        if (nextActiveCnpj) setActiveCnpj(nextActiveCnpj);

        setUserTier(nivelAtualizado);
        setIsAdmin(wData.is_admin);

        // 🟢 1. Atualiza o LocalStorage
        localStorage.setItem('bawzi_tier', String(nivelAtualizado));
        
        // 🟢 2. DISPARA EVENTO GLOBAL: Avisa o Menu Lateral/Cabeçalho para mudar na hora!
        window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: nivelAtualizado } }));

        // 🟢 3. AUTO-SYNC À PROVA DE FALHAS:
        // 1. Manda o backend verificar o Stripe e actualizar workspace + user
        apiFetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`)
          .then(async (res) => {
            if (!res.ok) return;

            // 2. Re-busca TANTO workspace COMO user — igual à lógica inicial.
            //    Só workspace.tier causava regressão: se ws=1 mas user=4, ficava em 1.
            const [checkWsRes, checkUserRes] = await Promise.all([
              apiFetch(`${API_URL}/api/workspace/details`),
              apiFetch(`${API_URL}/api/users/me`),
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
      if (subRes && subRes.ok) setSubscriptionDetails(await subRes.json());
      if (pmRes && pmRes.ok) { const pmData = await pmRes.json(); setSavedCard(pmData.card ?? null); }
      
    } catch (error) {
      if (error instanceof SessionExpiredError) { clearSession(); return; }
      console.error("Erro ao sincronizar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Carrega o perfil imediatamente — garante que isLoading sai de true
    // independentemente do fluxo (stripe success ou acesso direto).
    fetchData();

    if (!stripeSuccess) return;

    // Fluxo pós-Stripe: verifica em background se o tier foi atualizado pelo webhook.
    // Se mudar, recarrega a página limpa (sem ?success). Se não mudar em 6 tentativas,
    // permanece na página já carregada — sem tela de loading infinito.
    let attempts = 0;
    const maxAttempts = 6;

    const waitForWebhookAndReload = async () => {
      attempts++;
      const token = getAuthToken();
      if (!token) return;

      try {
        await apiFetch(`${API_URL}/api/billing/sync`).catch(() => {});

        const [userRes, wsRes] = await Promise.all([
          apiFetch(`${API_URL}/api/users/me`),
          apiFetch(`${API_URL}/api/workspace/details`),
        ]);

        if (userRes.ok && wsRes.ok) {
          const uData = await userRes.json();
          const wData = await wsRes.json();
          const nivelAtualizado = wData.tier || uData.tier || 1;
          const nivelAntigo = Number(localStorage.getItem('bawzi_tier') || 1);

          if (nivelAtualizado !== nivelAntigo) {
            // Tier confirmado pelo Stripe — recarrega limpo
            localStorage.setItem('bawzi_tier', String(nivelAtualizado));
            window.location.href = '/profile';
            return;
          }
        }
      } catch (error) {
        console.error("Erro na verificação de pagamento:", error);
      }

      if (attempts < maxAttempts) {
        setTimeout(waitForWebhookAndReload, 2000);
      }
      // Se esgotou tentativas sem mudança de tier, permanece na página já carregada
    };

    waitForWebhookAndReload();
  }, [stripeSuccess, API_URL]);

  const syncAndReload = async () => {
    await apiFetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`).catch(() => {});
    window.location.reload();
  };

  const handleChangePlan = async (tier: number) => {
    if (!window.confirm(`Confirmar mudança para o nível ${tier}? A Stripe pode aplicar ajustes proporcionais no ciclo atual.`)) return;
    setBillingAction(`tier-${tier}`);
    try {
      const res = await apiFetch(`${API_URL}/api/billing/update-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || 'Erro ao alterar plano.');
      await syncAndReload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao alterar plano.');
      setBillingAction(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Cancelar a renovação automática deste plano? Você mantém o acesso até o fim do ciclo já pago.')) return;
    setBillingAction('cancel');
    try {
      const res = await apiFetch(`${API_URL}/api/billing/cancel-subscription`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || 'Erro ao cancelar assinatura.');
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao cancelar assinatura.');
    } finally {
      setBillingAction(null);
    }
  };

  const handleReactivateSubscription = async () => {
    setBillingAction('reactivate');
    try {
      const res = await apiFetch(`${API_URL}/api/billing/reactivate-subscription`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || 'Erro ao reativar assinatura.');
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao reativar assinatura.');
    } finally {
      setBillingAction(null);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    setBillingAction('payment');
    try {
      const res = await apiFetch(`${API_URL}/api/billing/setup-intent`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.client_secret) throw new Error(data?.detail || 'Erro ao preparar atualização de cartão.');
      setPaymentClientSecret(data.client_secret);
      setShowPaymentModal(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao aceder ao faturamento.');
    } finally {
      setBillingAction(null);
    }
  };

  const forceManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await apiFetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`);
      const data = await res.json();
      if (res.ok) window.location.reload(); 
    } catch (error) { console.error("Erro ao forçar sync", error); }
    finally { setIsSyncing(false); }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch { /* sessão local sempre é limpa */ }
    clearSession({ notifyExpired: false });
    setAuthToken('');
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Eliminar conta permanentemente?")) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`${API_URL}/api/users/me`, { method: 'DELETE' });
      if (res.ok) { clearSession({ notifyExpired: false }); window.location.href = '/'; } 
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
    { id: 'sec-perfil',        label: 'Perfil',        icon: User },
    { id: 'sec-empresas',      label: 'Empresas',      icon: Building2 },
    { id: 'sec-seguranca',     label: 'Segurança',     icon: Shield },
    { id: 'sec-equipe',        label: 'Equipe',        icon: Users },
    { id: 'sec-assinatura',    label: 'Assinatura',    icon: CreditCard },
    { id: 'sec-privacidade',   label: 'Privacidade',   icon: Bell },
    { id: 'sec-risco',         label: 'Risco',         icon: AlertTriangle },
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
              onClick={handleLogout}
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
                <ActiveContextSwitcher
                  companies={companies}
                  activeCnpj={activeCnpj}
                  compact
                  onChange={(cnpj) => {
                    setActiveCnpj(cnpj);
                    setUserData((prev: any) => prev ? { ...prev, active_cnpj: cnpj } : prev);
                  }}
                  className="mt-4"
                />
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
            {/* Banner de downgrade — prazo de ajuste após mudança de plano */}
            {cleanupRequired && (() => {
              const suspendedCount = companies.filter((c: any) => c.suspended).length;
              const disabledCount  = companies.filter((c: any) => c.disabled).length;
              const hasCompanyIssue = suspendedCount > 0 || disabledCount > 0;
              const hasMemberIssue  = membersOverflow > 0;
              if (!hasCompanyIssue && !hasMemberIssue) return null;

              // Calcula dias restantes até o prazo
              let diasRestantes: number | null = null;
              if (cleanupDeadline) {
                const diff = new Date(cleanupDeadline).getTime() - Date.now();
                diasRestantes = Math.max(0, Math.ceil(diff / 86_400_000));
              }
              const prazoExpirou = diasRestantes !== null && diasRestantes === 0;
              const isRed = prazoExpirou || disabledCount > 0;

              return (
                <div className={`rounded-lg border p-4 ${isRed ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-lg leading-none">{isRed ? '🚫' : '⚠️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`text-sm font-black ${isRed ? 'text-red-900' : 'text-amber-900'}`}>
                          {isRed ? 'Prazo encerrado — empresas desabilitadas' : 'Plano alterado — ação necessária'}
                        </p>
                        {diasRestantes !== null && !prazoExpirou && (
                          <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-800">
                            {diasRestantes} dia{diasRestantes !== 1 ? 's' : ''} restante{diasRestantes !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className={`mt-1 text-xs font-medium leading-5 ${isRed ? 'text-red-800' : 'text-amber-800'}`}>
                        {disabledCount > 0 && (
                          <><strong>{disabledCount} empresa{disabledCount > 1 ? 's desabilitadas' : ' desabilitada'}</strong> — indisponíveis para análise até você removê-las ou fazer upgrade. {' '}</>
                        )}
                        {suspendedCount > 0 && !prazoExpirou && (
                          <><strong>{suspendedCount} empresa{suspendedCount > 1 ? 's suspensas' : ' suspensa'}</strong> — radar parado. Remova ou troque a privilegiada antes do prazo. {' '}</>
                        )}
                        {hasMemberIssue && (
                          <><strong>{membersOverflow} membro{membersOverflow > 1 ? 's' : ''} além do limite</strong> — novos convites bloqueados.</>
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {hasCompanyIssue && (
                          <button
                            onClick={() => scrollTo('sec-empresas')}
                            className={`text-[11px] font-black uppercase tracking-wider transition-colors underline underline-offset-2 ${isRed ? 'text-red-700 hover:text-red-900' : 'text-amber-700 hover:text-amber-900'}`}
                          >
                            Gerenciar empresas ↓
                          </button>
                        )}
                        {hasMemberIssue && (
                          <button
                            onClick={() => scrollTo('sec-equipe')}
                            className={`text-[11px] font-black uppercase tracking-wider transition-colors underline underline-offset-2 ${isRed ? 'text-red-700 hover:text-red-900' : 'text-amber-700 hover:text-amber-900'}`}
                          >
                            Gerenciar equipe ↓
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                    const nextCnpj = setActiveCompanyContext(cnpj);
                    setActiveCnpj(nextCnpj);
                    setUserData((prev: any) => prev ? { ...prev, active_cnpj: nextCnpj } : prev);
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
                <TeamManager
                  userToken={authToken}
                  tier={userTier}
                  members={members}
                  is_admin={isAdmin}
                  workspaceName={userData?.workspace_name}
                  onUpdate={fetchData}
                />
              </div>
            </section>

            <section id="sec-assinatura" className={panelClass}>
              {userTier > 1 ? (
                <>
                  <SectionHeading
                    icon={CreditCard}
                    title="Assinatura"
                    eyebrow={`Plano ${planName} · Nível ${userTier}`}
                    tone="emerald"
                    actions={
                      <button
                        onClick={forceManualSync}
                        disabled={isSyncing}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                      >
                        <RefreshCw className={isSyncing ? 'animate-spin' : ''} size={13} />
                        Sincronizar
                      </button>
                    }
                  />

                  {/* ── Plano atual + próxima cobrança ── */}
                  <div className="border-b border-slate-100 p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                      {/* LEFT — info do plano */}
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">
                          <Crown size={18} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Plano ativo</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-2xl font-black leading-none text-slate-950">{planName}</span>
                            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                              Nível {userTier}
                            </span>
                          </div>
                          {subscriptionDetails?.amount && (
                            <p className="mt-1 text-sm font-semibold text-slate-500">{subscriptionDetails.amount}/mês</p>
                          )}
                          {subscriptionDetails?.current_period_end && (
                            <p className="mt-1 text-xs font-medium text-slate-400">
                              Próxima cobrança em{' '}
                              <span className="font-semibold text-slate-600">{subscriptionDetails.current_period_end}</span>
                            </p>
                          )}
                          {subscriptionDetails?.cancel_at_period_end && (
                            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                              <span>⏸</span> Renovação cancelada — acesso até o fim do ciclo
                            </div>
                          )}
                        </div>
                      </div>

                      {/* RIGHT — cartão + ações */}
                      <div className="flex flex-col items-start gap-3 lg:items-end">
                        {/* Mini-card visual */}
                        {savedCard ? (
                          <div className="inline-flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                              <CreditCard size={15} className="text-white/60" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 capitalize">{savedCard.brand}</p>
                              <p className="font-black tracking-widest text-white">•••• {savedCard.last4}</p>
                            </div>
                            <div className="border-l border-white/10 pl-3">
                              <p className="text-[10px] text-white/30">Exp.</p>
                              <p className="text-xs font-bold text-white/60">
                                {String(savedCard.exp_month).padStart(2, '0')}/{String(savedCard.exp_year).slice(-2)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-400">
                            <CreditCard size={14} />
                            Nenhum cartão cadastrado
                          </div>
                        )}

                        {/* Botões de ação */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleUpdatePaymentMethod}
                            disabled={billingAction === 'payment'}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <CreditCard size={13} className="text-slate-400" />
                            {billingAction === 'payment' ? 'Aguarde...' : savedCard ? 'Alterar cartão' : 'Adicionar cartão'}
                          </button>

                          {subscriptionDetails?.status === 'active' && (
                            subscriptionDetails.cancel_at_period_end ? (
                              <button
                                onClick={handleReactivateSubscription}
                                disabled={!!billingAction}
                                className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {billingAction === 'reactivate' ? 'Reativando...' : 'Reativar renovação'}
                              </button>
                            ) : (
                              <button
                                onClick={handleCancelSubscription}
                                disabled={!!billingAction}
                                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                              >
                                {billingAction === 'cancel' ? 'Cancelando...' : 'Cancelar renovação'}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ── Trocar plano — só com assinatura Stripe real ── */}
                  {subscriptionDetails && (
                    <div className="border-b border-slate-100 p-5 sm:p-6">
                      <p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Trocar plano</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {([
                          { tier: 2, name: 'Essencial',    price: 'R$ 79/mês'  },
                          { tier: 3, name: 'Profissional', price: 'R$ 197/mês' },
                          { tier: 4, name: 'Avançado',     price: 'R$ 497/mês' },
                        ] as const).map(({ tier, name, price }) => {
                          const isCurrent = tier === userTier;
                          const isUp = tier > userTier;
                          return (
                            <button
                              key={tier}
                              onClick={() => !isCurrent && setChangePlanModal({ tier })}
                              disabled={isCurrent || !!billingAction}
                              className={`relative flex flex-col gap-0.5 rounded-xl border p-4 text-left transition ${
                                isCurrent
                                  ? 'border-emerald-200 bg-emerald-50 cursor-default'
                                  : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
                              }`}
                            >
                              {isCurrent && (
                                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600">
                                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                              )}
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${isCurrent ? 'text-emerald-600' : 'text-slate-400'}`}>
                                Nível {tier}
                              </span>
                              <span className={`text-sm font-black ${isCurrent ? 'text-emerald-900' : 'text-slate-800'}`}>{name}</span>
                              <span className={`text-xs font-semibold ${isCurrent ? 'text-emerald-700' : 'text-slate-500'}`}>{price}</span>
                              {!isCurrent && (
                                <span className={`mt-1.5 text-[10px] font-bold ${isUp ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {billingAction === `tier-${tier}` ? 'Alterando...' : isUp ? '↑ Upgrade' : '↓ Downgrade'}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                          {invoices.slice(0, invoicesVisible).map((inv) => (
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
                      {invoicesVisible < invoices.length && (
                        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-400">
                            {invoicesVisible} de {invoices.length} faturas
                          </span>
                          <button
                            onClick={() => setInvoicesVisible(v => Math.min(v + 10, invoices.length))}
                            className="text-[11px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            Mostrar mais 10
                          </button>
                        </div>
                      )}
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

            <section id="sec-privacidade" className={panelClass}>
              <SectionHeading icon={Bell} title="Privacidade & Notificações" eyebrow="Notificações push, cache e consentimento" tone="slate" />
              <div className="divide-y divide-slate-100">

                {/* Push notifications */}
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Notificações push</p>
                    <p className="mt-0.5 text-xs text-slate-500">Receba alertas de novos editais e contratos vencendo direto no navegador.</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => subscribeToPush()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Bell size={13} /> Ativar
                    </button>
                    <button
                      onClick={() => unsubscribeFromPush()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Desativar
                    </button>
                  </div>
                </div>

                {/* Cache */}
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Cache do site</p>
                    <p className="mt-0.5 text-xs text-slate-500">Remove dados temporários salvos pelo navegador (preferências locais, tier em cache).</p>
                  </div>
                  <button
                    onClick={() => {
                      const keep = ['bawzi_consent_accepted'];
                      const saved: Record<string, string> = {};
                      keep.forEach(k => { const v = localStorage.getItem(k); if (v) saved[k] = v; });
                      localStorage.clear();
                      keep.forEach(k => { if (saved[k]) localStorage.setItem(k, saved[k]); });
                      window.location.reload();
                    }}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <RefreshCw size={13} /> Limpar cache
                  </button>
                </div>

                {/* Consentimento LGPD */}
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Consentimento LGPD</p>
                    <p className="mt-0.5 text-xs text-slate-500">Revoga o aceite dos termos e exibe novamente o banner de privacidade na próxima visita.</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/users/me/lgpd-consent`, {
                          method: 'DELETE',
                        });
                      } catch {
                        // continua mesmo se a rede falhar
                      }
                      localStorage.removeItem('bawzi_consent_accepted');
                      window.location.reload();
                    }}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    Revogar consentimento
                  </button>
                </div>

              </div>
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

            {/* ── Modal: Atualizar cartão ── */}
            <CardUpdateModal
              isOpen={showPaymentModal}
              clientSecret={paymentClientSecret}
              onClose={() => { setShowPaymentModal(false); setPaymentClientSecret(null); }}
              onSuccess={async () => {
                setShowPaymentModal(false);
                setPaymentClientSecret(null);
                // Recarrega só o cartão — não precisa de fetchData completo
                try {
                  const r = await apiFetch(`${API_URL}/api/billing/payment-method`);
                  if (r.ok) { const d = await r.json(); setSavedCard(d.card ?? null); }
                } catch { /* silencioso */ }
              }}
            />

            {/* ── Modal: Confirmação de troca de plano ── */}
            {changePlanModal && (() => {
              const PLANS: Record<number, { name: string; price: string; features: string[] }> = {
                2: { name: 'Essencial',    price: 'R$ 79/mês',  features: ['Perfil da empresa (CNPJ/UF)', 'Central de decisões', 'Radar 360 — busca PNCP', 'Editais até 80.000 chars', 'PDF até 15 MB'] },
                3: { name: 'Profissional', price: 'R$ 197/mês', features: ['Oportunidades com fit CNAE', 'Monitor inteligente PNCP', 'Fôlego financeiro', '4 Agentes IA em paralelo', 'Editais até 180.000 chars'] },
                4: { name: 'Avançado',     price: 'R$ 497/mês', features: ['Pipeline de renovações', 'War Room de concorrentes', 'Simulador tático de preços', 'Editais até 400.000 chars', 'PDF até 100 MB'] },
              };
              const current = PLANS[userTier];
              const next    = PLANS[changePlanModal.tier];
              const isUp    = changePlanModal.tier > userTier;
              return (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
                  <div className="absolute inset-0" onClick={() => setChangePlanModal(null)} aria-hidden />
                  <div
                    className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
                    style={{ animation: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)' }}
                  >
                    <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

                    {/* Header */}
                    <div className={`px-6 py-5 ${isUp ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                        {isUp ? 'Upgrade de plano' : 'Downgrade de plano'}
                      </p>
                      <h2 className="mt-1 text-lg font-black text-white">
                        {current?.name ?? `Nível ${userTier}`} → {next?.name ?? `Nível ${changePlanModal.tier}`}
                      </h2>
                      <p className="mt-0.5 text-sm text-white/70">
                        {next?.price} · A Stripe aplica ajuste proporcional no ciclo atual
                      </p>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-5">
                      {/* Comparativo */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Plano atual</p>
                          <p className="font-black text-slate-950">{current?.name ?? `Nível ${userTier}`}</p>
                          <ul className="mt-2 space-y-1">
                            {current?.features.slice(0, 3).map(f => (
                              <li key={f} className="text-[11px] text-slate-500 flex items-start gap-1.5">
                                <span className="text-slate-300 mt-0.5 shrink-0">—</span>{f}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className={`rounded-xl border p-4 ${isUp ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isUp ? 'text-emerald-600' : 'text-amber-600'}`}>Novo plano</p>
                          <p className="font-black text-slate-950">{next?.name ?? `Nível ${changePlanModal.tier}`}</p>
                          <ul className="mt-2 space-y-1">
                            {next?.features.slice(0, 3).map(f => (
                              <li key={f} className={`text-[11px] flex items-start gap-1.5 ${isUp ? 'text-emerald-700' : 'text-amber-800'}`}>
                                <span className="mt-0.5 shrink-0">{isUp ? '✓' : '—'}</span>{f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Nota de cobrança */}
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                        {isUp
                          ? 'O upgrade é imediato. A diferença proporcional do ciclo atual será cobrada no cartão cadastrado.'
                          : 'O downgrade ocorre no próximo ciclo. Você mantém os recursos atuais até o fim do período já pago.'}
                      </p>

                      {/* Botões */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => setChangePlanModal(null)}
                          className="h-11 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={async () => { setChangePlanModal(null); await handleChangePlan(changePlanModal.tier); }}
                          disabled={!!billingAction}
                          className={`h-11 flex-1 rounded-lg text-sm font-black uppercase tracking-wide text-white transition disabled:opacity-50 ${isUp ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-700'}`}
                        >
                          {billingAction ? 'Alterando...' : `Confirmar ${isUp ? 'upgrade' : 'downgrade'}`}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
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
