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
import { apiFetch, getAuthToken, initSession, clearSession, SessionExpiredError } from '@/lib/apiClient';
import ChangePlanModal from '@/components/ChangePlanModal';

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

// Nomes alinhados com o resto do app (PricingSection, ChangePlanModal e a
// grade "Trocar plano" logo abaixo, nesta mesma página) — antes esta função
// usava um naming antigo (Pro/Scale/Enterprise) enquanto tudo o mais já
// tinha migrado para Essencial/Profissional/Avançado, fazendo o mesmo
// Nível 4 aparecer como "Enterprise" no topo da página e "Avançado" na
// seção de troca de plano, alguns parágrafos abaixo.
function getTierName(tier: number) {
  if (tier >= 4) return 'Avançado';
  if (tier === 3) return 'Profissional';
  if (tier === 2) return 'Essencial';
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('bawzi_consent_accepted') === 'true'
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [billingAction, setBillingAction] = useState<string | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savedCard, setSavedCard] = useState<{ brand: string; last4: string; exp_month: number; exp_year: number } | null>(null);
  const [changePlanModal, setChangePlanModal] = useState<{ tier: number } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [invoicesVisible, setInvoicesVisible] = useState(5);
  const [cleanupRequired, setCleanupRequired] = useState(false);
  const [membersOverflow, setMembersOverflow] = useState(0);
  const [cleanupDeadline, setCleanupDeadline] = useState<string | null>(null);
  // UX: seção ativa no menu (scroll-spy) + status 2FA no card do avatar
  const [activeSection, setActiveSection] = useState('sec-perfil');
  const [twoFAOn, setTwoFAOn] = useState<boolean | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null); // null = verificando
  const [pushLoading, setPushLoading] = useState(false);

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

  // Sincroniza consentimento LGPD: escuta banner + verifica backend no mount
  useEffect(() => {
    // Escuta o banner aceitar em outra aba ou na mesma página
    const onAccepted = () => setLgpdConsent(true);
    window.addEventListener('bawzi_lgpd_accepted', onAccepted);

    // Verifica estado real no backend (cobre revogação em outro dispositivo)
    apiFetch(`${API_URL}/api/users/me/lgpd-consent`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLgpdConsent(!!d.consented); })
      .catch(() => {});

    return () => window.removeEventListener('bawzi_lgpd_accepted', onAccepted);
  }, []);

  // Detecta se push já está ativo no browser
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setPushEnabled(false);
      return;
    }
    navigator.serviceWorker.getRegistration('/sw.js')
      .then(reg => reg ? reg.pushManager.getSubscription() : null)
      .then(sub => setPushEnabled(!!sub))
      .catch(() => setPushEnabled(false));
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

  const fetchData = async (isRetry = false) => {
    // Após navegação full-page, _accessToken está nulo e bawzi_token foi limpo
    // pelo initSession() anterior. Precisamos reidratar antes de ler o token.
    const token = getAuthToken() || await initSession();
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
      if (error instanceof SessionExpiredError) {
        // Sem isto, a tela ficava com dados vazios/parciais e nenhuma
        // indicação de que a sessão caiu — parecia um bug de carregamento,
        // não um logout. Redireciona para o login já preservando a volta.
        clearSession();
        router.push('/login?redirect=/profile');
        return;
      }
      console.error("Erro ao sincronizar dados:", error);
      // Falha de rede genérica (ex: timeout do apiFetch) — muito comum logo
      // após o notebook acordar de suspensão com a aba aberta desde antes:
      // a primeira requisição falha enquanto a rede ainda está se
      // restabelecendo. Uma retentativa automática evita cair numa tela
      // "quebrada" (sem dados) por causa de um hiccup passageiro; mantém o
      // spinner até essa segunda tentativa terminar.
      if (!isRetry) {
        setTimeout(() => fetchData(true), 1500);
        return;
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
  };

  // Scroll para seção solicitada via sessionStorage (definido antes do router.push)
  // Usa sessionStorage porque é síncrono, persiste na navegação client-side e não
  // depende de query param nem de hash (que são instáveis no App Router).
  useEffect(() => {
    if (isLoading) return;
    const targetId = sessionStorage.getItem('goto_section') || window.location.hash?.slice(1);
    if (!targetId) return;
    sessionStorage.removeItem('goto_section');
    setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

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

          // Mesmo sem mudança de tier, tenta atualizar o cartão salvo
          // (webhook pode ter chegado mas o tier já estava correto)
          const pmRes = await apiFetch(`${API_URL}/api/billing/payment-method`).catch(() => null);
          if (pmRes?.ok) {
            const pmData = await pmRes.json();
            if (pmData?.card) setSavedCard(pmData.card);
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

  const handleChangePlan = async (tier: number, coupon?: string) => {
    setBillingAction(`tier-${tier}`);
    try {
      const body: Record<string, unknown> = { tier };
      if (coupon) body.coupon_code = coupon;
      const res = await apiFetch(`${API_URL}/api/billing/update-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || 'Erro ao alterar plano.');
      // Sincroniza com o Stripe e recarrega os dados sem sair da página
      await apiFetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`).catch(() => {});
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao alterar plano.');
    } finally {
      setBillingAction(null);
    }
  };

  const handleCancelSubscription = async () => {
    setShowCancelModal(false);
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
    setIsDeleting(true);
    try {
      const res = await apiFetch(`${API_URL}/api/users/me`, { method: 'DELETE' });
      if (res.ok) { clearSession({ notifyExpired: false }); window.location.href = '/'; }
    } catch { setIsDeleting(false); }
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

                  {/* ── Plano atual ── */}
                  <div className="border-b border-slate-100">
                    {/* Banner do plano */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-700 px-5 py-5 sm:px-6">
                      {/* Decoração de fundo */}
                      <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/5" />
                      <div className="pointer-events-none absolute -bottom-4 right-8 h-20 w-20 rounded-full bg-white/5" />

                      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* Tier + nome + preço */}
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                            <Crown size={16} className="text-white/70" />
                            <span className="text-[10px] font-black text-white/70">N{userTier}</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Seu plano atual</p>
                            <p className="mt-0.5 text-xl font-black text-white">{planName}</p>
                            {subscriptionDetails?.amount && (
                              <p className="mt-0.5 text-sm font-semibold text-white/70">
                                {subscriptionDetails.amount}
                                <span className="ml-1 text-[10px] uppercase tracking-wide text-white/50">/mês</span>
                                {subscriptionDetails?.interval && (
                                  <span className="ml-2 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                                    {subscriptionDetails.interval}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Cartão salvo */}
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          {savedCard ? (
                            <div className="inline-flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5 backdrop-blur-sm">
                              <CreditCard size={14} className="text-white/60" />
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 capitalize">{savedCard.brand} •••• {savedCard.last4}</p>
                                <p className="text-[10px] text-white/40">
                                  Expira {String(savedCard.exp_month).padStart(2, '0')}/{String(savedCard.exp_year).slice(-2)}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white/50">
                              <CreditCard size={13} />
                              Nenhum cartão cadastrado
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={handleUpdatePaymentMethod}
                              disabled={billingAction === 'payment'}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-[11px] font-semibold text-white/80 transition hover:bg-white/20 disabled:opacity-50"
                            >
                              <CreditCard size={12} />
                              {billingAction === 'payment' ? 'Aguarde...' : savedCard ? 'Alterar cartão' : 'Adicionar cartão'}
                            </button>
                            {subscriptionDetails?.status === 'active' && (
                              subscriptionDetails.cancel_at_period_end ? (
                                <button
                                  onClick={handleReactivateSubscription}
                                  disabled={!!billingAction}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[11px] font-bold text-emerald-700 transition hover:bg-white/90 disabled:opacity-50"
                                >
                                  {billingAction === 'reactivate' ? 'Reativando...' : 'Reativar renovação'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setShowCancelModal(true)}
                                  disabled={!!billingAction}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-[11px] font-semibold text-white/60 transition hover:border-red-300/50 hover:bg-red-500/20 hover:text-white disabled:opacity-50"
                                >
                                  {billingAction === 'cancel' ? 'Cancelando...' : 'Cancelar renovação'}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vigência + progress bar */}
                    {subscriptionDetails?.current_period_start && subscriptionDetails?.current_period_end && (
                      <div className="px-5 py-3 sm:px-6">
                        {subscriptionDetails.cancel_at_period_end ? (
                          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            <span>⏸</span> Renovação cancelada — acesso até {subscriptionDetails.current_period_end}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            <p className="text-xs text-slate-400">
                              Vigência:{' '}
                              <span className="font-semibold text-slate-700">
                                {subscriptionDetails.current_period_start} → {subscriptionDetails.current_period_end}
                              </span>
                            </p>
                            {subscriptionDetails?.dias_total > 0 && (
                              <div className="flex flex-1 items-center gap-2" style={{ minWidth: '160px' }}>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-emerald-500 transition-all"
                                    style={{
                                      width: `${Math.max(4, Math.min(100, ((subscriptionDetails.dias_total - subscriptionDetails.dias_restantes) / subscriptionDetails.dias_total) * 100))}%`,
                                    }}
                                  />
                                </div>
                                <span className="shrink-0 text-[10px] font-bold text-slate-400">
                                  {subscriptionDetails.dias_restantes}d restantes
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-slate-400">
                              Próxima cobrança:{' '}
                              <span className="font-semibold text-slate-700">{subscriptionDetails.current_period_end}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
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
                                  ? 'border-emerald-300 bg-emerald-50 cursor-default ring-1 ring-emerald-200'
                                  : isUp
                                    ? 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm'
                              }`}
                            >
                              {isCurrent ? (
                                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  Atual
                                </span>
                              ) : (
                                <span className={`absolute right-3 top-3 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                                  isUp
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {billingAction === `tier-${tier}` ? '...' : isUp ? '↑ Upgrade' : '↓ Downgrade'}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${isCurrent ? 'text-emerald-600' : 'text-slate-400'}`}>
                                Nível {tier}
                              </span>
                              <span className={`mt-0.5 text-sm font-black ${isCurrent ? 'text-emerald-900' : 'text-slate-800'}`}>{name}</span>
                              <span className={`text-xs font-semibold ${isCurrent ? 'text-emerald-700' : isUp ? 'text-slate-500' : 'text-amber-700'}`}>{price}</span>
                              {!isCurrent && !isUp && (
                                <span className="mt-1 text-[10px] text-amber-600">Você perderá recursos do plano atual</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {invoices.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {invoices.slice(0, invoicesVisible).map((inv) => {
                        const coveredByCredit = !!inv.covered_by_credit;
                        const s = inv.status as string;
                        const statusCfg =
                          s === 'Pago'         ? { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' } :
                          s === 'Aberto'       ? { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200' } :
                          s === 'Inadimplente' ? { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200' } :
                                                 { dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 border-slate-200' };
                        return (
                          <div key={inv.id} className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50">
                            {/* Ícone + descrição */}
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="truncate text-xs font-bold text-slate-900">
                                    {inv.description || 'Cobrança'}
                                  </p>
                                  {coveredByCredit && (
                                    <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 border border-sky-100">
                                      Coberto por crédito
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400">{inv.date} · {inv.number}</p>
                              </div>
                            </div>

                            {/* Valor + status + PDF */}
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="text-sm font-black text-slate-950">
                                {inv.amount}
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${statusCfg.badge}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                                {s || 'Pendente'}
                              </span>
                              {inv.pdf_url && (
                                <a
                                  href={inv.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-600"
                                  title="Ver fatura"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {invoicesVisible < invoices.length && (
                        <div className="px-5 py-3 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-slate-400">
                            {invoicesVisible} de {invoices.length} faturas
                          </span>
                          <button
                            onClick={() => setInvoicesVisible(v => Math.min(v + 10, invoices.length))}
                            className="text-[11px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            Mostrar mais {Math.min(10, invoices.length - invoicesVisible)}
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
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700"
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
                  {!lgpdConsent ? (
                    <span className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      Requer consentimento LGPD
                    </span>
                  ) : pushEnabled === null ? (
                    <span className="shrink-0 text-xs text-slate-400">Verificando…</span>
                  ) : pushEnabled ? (
                    <button
                      disabled={pushLoading}
                      onClick={async () => {
                        setPushLoading(true);
                        try {
                          await unsubscribeFromPush();
                          setPushEnabled(false);
                        } catch {
                          alert('Não foi possível desativar as notificações. Tente novamente.');
                        } finally {
                          setPushLoading(false);
                        }
                      }}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {pushLoading ? 'Desativando…' : 'Desativar'}
                    </button>
                  ) : (
                    <button
                      disabled={pushLoading}
                      onClick={async () => {
                        setPushLoading(true);
                        try {
                          const ok = await subscribeToPush();
                          if (ok) {
                            setPushEnabled(true);
                          } else {
                            alert('Permissão negada ou navegador não suportado. Verifique as configurações do seu browser.');
                          }
                        } catch {
                          alert('Não foi possível ativar as notificações. Tente novamente.');
                        } finally {
                          setPushLoading(false);
                        }
                      }}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <Bell size={13} />
                      {pushLoading ? 'Ativando…' : 'Ativar'}
                    </button>
                  )}
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
                    <p className="mt-0.5 text-xs text-slate-500">
                      {lgpdConsent
                        ? 'Consentimento ativo. Notificações push habilitadas. Ao revogar, as notificações serão desativadas e o banner de privacidade reaparecerá.'
                        : 'Consentimento não concedido. Notificações push bloqueadas até o aceite dos termos.'}
                    </p>
                  </div>
                  {lgpdConsent ? (
                    <button
                      onClick={async () => {
                        try {
                          await unsubscribeFromPush();
                          await apiFetch(`${API_URL}/api/users/me/lgpd-consent`, { method: 'DELETE' });
                        } catch { /* continua mesmo se falhar */ }
                        localStorage.removeItem('bawzi_consent_accepted');
                        setLgpdConsent(false);
                      }}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      Revogar consentimento
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                      Não concedido
                    </span>
                  )}
                </div>

                {/* ── Exportar dados ── */}
                <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Exportar meus dados</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">
                      Baixe um arquivo JSON com todos os seus dados pessoais (portabilidade LGPD, Art. 18).
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await apiFetch(`${API_URL}/api/users/me/export`);
                        if (!res.ok) throw new Error('Falha ao exportar');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'meus-dados-bawzi.json';
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        alert('Não foi possível exportar os dados. Tente novamente.');
                      }
                    }}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                  >
                    Baixar meus dados
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
                  onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
                  disabled={isDeleting}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-[10px] font-black uppercase tracking-widest text-red-600 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white disabled:opacity-60"
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir conta'}
                </button>
              </div>
            </section>

            {/* ── Modal: Excluir conta ── */}
            {showDeleteModal && (
              <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
                <div className="absolute inset-0" onClick={() => !isDeleting && setShowDeleteModal(false)} aria-hidden />
                <div
                  className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                  style={{ animation: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)' }}
                >
                  {/* Header */}
                  <div className="bg-gradient-to-br from-red-600 to-rose-700 px-6 py-5 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-white/5 blur-xl pointer-events-none" />
                    <div className="flex items-center gap-3 relative">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                        <AlertTriangle size={18} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Ação irreversível</p>
                        <h2 className="text-lg font-black text-white leading-tight">Excluir conta</h2>
                      </div>
                    </div>
                  </div>

                  {/* Corpo */}
                  <div className="p-6 space-y-4">
                    {/* Lista de consequências */}
                    <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-2">
                      <p className="text-xs font-black text-red-900 uppercase tracking-wide">O que será excluído permanentemente:</p>
                      <ul className="space-y-1.5">
                        {[
                          'Sua conta e dados de acesso',
                          'Todas as empresas monitoradas',
                          'Histórico de análises e relatórios',
                          'Membros da equipe vinculados',
                          'Assinatura ativa (sem reembolso proporcional)',
                        ].map(item => (
                          <li key={item} className="flex items-start gap-2 text-xs text-red-800">
                            <span className="mt-0.5 shrink-0 text-red-400 font-bold">✗</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Confirmação por texto */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Para confirmar, digite <span className="font-black text-red-600">EXCLUIR</span> abaixo:
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={e => setDeleteConfirmText(e.target.value)}
                        placeholder="EXCLUIR"
                        autoComplete="off"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                      />
                    </div>

                    {/* Botões */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        disabled={isDeleting}
                        className="h-11 flex-1 rounded-lg border border-slate-200 bg-slate-50 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isDeleting || deleteConfirmText !== 'EXCLUIR'}
                        className="h-11 flex-1 rounded-lg bg-red-600 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? 'Excluindo...' : 'Excluir definitivamente'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {/* ── Modal: Cancelamento de assinatura ── */}
            {showCancelModal && (
              <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm">
                <div className="absolute inset-0" onClick={() => setShowCancelModal(false)} aria-hidden />
                <div
                  className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                  style={{ animation: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)' }}
                >
                  {/* Header vermelho */}
                  <div className="bg-gradient-to-br from-red-600 to-rose-700 px-6 py-5 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/5 blur-xl" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Cancelar assinatura</p>
                    <h2 className="mt-1 text-lg font-black text-white">Tem certeza?</h2>
                    <p className="mt-0.5 text-sm text-white/70">Esta ação não pode ser desfeita imediatamente.</p>
                  </div>

                  {/* Corpo */}
                  <div className="p-6 space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                      <p className="text-sm font-black text-amber-900">O que acontece ao cancelar:</p>
                      <ul className="space-y-1.5">
                        {[
                          subscriptionDetails?.current_period_end
                            ? `Acesso mantido até ${subscriptionDetails.current_period_end}`
                            : 'Acesso mantido até o fim do ciclo atual',
                          'Sem cobranças futuras automáticas',
                          'Você pode reativar antes do vencimento',
                          'Dados e histórico preservados',
                        ].map(item => (
                          <li key={item} className="flex items-start gap-2 text-xs text-amber-800">
                            <span className="mt-0.5 shrink-0 text-amber-500">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowCancelModal(false)}
                        className="h-11 flex-1 rounded-lg bg-emerald-600 text-sm font-black text-white transition hover:bg-emerald-700"
                      >
                        Manter plano
                      </button>
                      <button
                        onClick={handleCancelSubscription}
                        disabled={!!billingAction}
                        className="h-11 flex-1 rounded-lg border border-red-200 bg-red-50 text-sm font-black text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {billingAction === 'cancel' ? 'Cancelando...' : 'Cancelar renovação'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Modal: Confirmação de troca de plano ── */}
            <ChangePlanModal
              currentTier={userTier}
              targetTier={changePlanModal?.tier ?? null}
              onClose={() => setChangePlanModal(null)}
              onConfirm={async (tier, coupon) => {
                setChangePlanModal(null);
                await handleChangePlan(tier, coupon);
              }}
              isConfirming={billingAction?.startsWith('tier-') ?? false}
            />
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
