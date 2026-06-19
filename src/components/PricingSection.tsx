'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Lock, Check, RefreshCw, Sparkles, CalendarClock, ChevronRight } from 'lucide-react';
import UpgradeModal from './UpgradeModal';
import { useTier } from '@/hooks/useTier';
import { getAuthToken } from '@/lib/apiClient';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

interface PricingSectionProps {
  onRegister?: () => void;
  onUpgrade?: (tier: number) => void;
  onChangePlan?: (tier: number) => void;   // Abre o modal de troca de plano (para assinantes pagos)
  currentTier?: number;
}

// Dados dos tiers: features são o DELTA de cada nível (o que é exclusivo deste tier).
// O campo `inherits` indica qual tier anterior está incluso (para exibir "Tudo do Nível N +").
const tiers = [
  {
    name: 'Teste', badge: 'NÍVEL 0', price: 'Grátis', period: '',
    inherits: null,
    features: [
      '1 análise por dia · sem cadastro',
      'Nova Análise — score Go/No-Go',
      'Resumo executivo do edital',
      'Semáforo de viabilidade',
      'Editais até 10.000 caracteres',
      'PDF até 3 MB',
    ],
    buttonText: 'Testar agora', tierLevel: -1, popular: false, label: null,
  },
  {
    name: 'Gratuito', badge: 'NÍVEL 1', price: 'Grátis', period: '',
    inherits: null,
    features: [
      '5 análises/mês',
      'Análise completa com mapa de riscos jurídicos',
      'Editais até 25.000 caracteres',
      'PDF até 5 MB',
    ],
    buttonText: 'Criar conta', tierLevel: 1, popular: false, label: null,
  },
  {
    name: 'Essencial', badge: 'NÍVEL 2', price: 'R$ 79', period: '/mês',
    inherits: 1,
    features: [
      '1.000 análises/mês',
      'Perfil da empresa (CNPJ/UF)',
      'Central de decisões e laudos salvos',
      'Priorização entre editais',
      'Radar 360 — busca PNCP',
      'Editais até 80.000 caracteres',
      'PDF até 15 MB',
    ],
    buttonText: 'Assinar Essencial', tierLevel: 2, popular: false, label: null,
  },
  {
    name: 'Profissional', badge: 'NÍVEL 3', price: 'R$ 197', period: '/mês',
    inherits: 2,
    features: [
      '3.000 análises/mês',
      'Oportunidades com fit CNAE e perfil',
      'Monitor inteligente PNCP (e-mail + sino)',
      'Fôlego financeiro e capital de execução',
      '4 Agentes IA em paralelo',
      'Editais até 180.000 caracteres',
      'PDF até 30 MB',
    ],
    buttonText: 'Assinar Profissional', tierLevel: 3, popular: true, label: 'Mais popular',
  },
  {
    name: 'Avançado', badge: 'NÍVEL 4', price: 'R$ 497', period: '/mês',
    inherits: 3,
    features: [
      'Análises ilimitadas',
      'Gestão do fluxo completo dos editais',
      'Pipeline de renovações e contratos vencendo',
      'War Room de concorrentes',
      'Simulador tático de preços',
      'Editais até 400.000 caracteres',
      'PDF até 100 MB · suporte prioritário',
    ],
    buttonText: 'Assinar Avançado', tierLevel: 4, popular: false, label: 'Elite',
  },
] as const;

// Paleta visual por tier
const tierStyle: Record<string, Record<string, string>> = {
  '-1': {
    strip:       'bg-slate-200',
    card:        'bg-white border border-slate-200 hover:shadow-md hover:-translate-y-0.5',
    badge:       'text-slate-400',
    name:        'text-slate-700',
    price:       'text-slate-800',
    period:      'text-slate-400',
    feature:     'text-slate-500',
    check:       'text-slate-400',
    inherit:     'text-slate-400 bg-slate-50 border-slate-200',
    btn:         'bg-slate-800 text-white hover:bg-slate-700',
    btnActive:   'bg-slate-200 text-slate-500 cursor-default',
    btnOther:    'bg-slate-100 text-slate-500 hover:bg-slate-200',
    divider:     'bg-slate-100',
  },
  '1': {
    strip:       'bg-slate-300',
    card:        'bg-white border border-slate-200 hover:shadow-md hover:-translate-y-0.5',
    badge:       'text-slate-400',
    name:        'text-slate-800',
    price:       'text-slate-900',
    period:      'text-slate-400',
    feature:     'text-slate-500',
    check:       'text-slate-400',
    inherit:     'text-slate-400 bg-slate-50 border-slate-200',
    btn:         'bg-slate-900 text-white hover:bg-slate-700',
    btnActive:   'bg-emerald-100 text-emerald-700 cursor-default',
    btnOther:    'bg-slate-100 text-slate-500 hover:bg-slate-200',
    divider:     'bg-slate-100',
  },
  '2': {
    strip:       'bg-sky-500',
    card:        'bg-white border border-slate-200 hover:shadow-md hover:-translate-y-0.5',
    badge:       'text-sky-500',
    name:        'text-slate-900',
    price:       'text-slate-900',
    period:      'text-slate-400',
    feature:     'text-slate-600',
    check:       'text-sky-500',
    inherit:     'text-sky-600 bg-sky-50 border-sky-100',
    btn:         'bg-sky-600 text-white hover:bg-sky-700',
    btnActive:   'bg-emerald-100 text-emerald-700 cursor-default',
    btnOther:    'bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200',
    divider:     'bg-slate-100',
  },
  '3': {
    strip:       'bg-emerald-500',
    card:        'bg-white border border-emerald-200 shadow-xl lg:-translate-y-4 hover:shadow-2xl hover:-translate-y-5 z-10 relative',
    badge:       'text-emerald-600',
    name:        'text-slate-900',
    price:       'text-slate-900',
    period:      'text-slate-400',
    feature:     'text-slate-600',
    check:       'text-emerald-500',
    inherit:     'text-emerald-700 bg-emerald-50 border-emerald-100',
    btn:         'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200',
    btnActive:   'bg-emerald-100 text-emerald-700 cursor-default',
    btnOther:    'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200',
    divider:     'bg-emerald-100',
  },
  '4': {
    strip:       'bg-gradient-to-r from-violet-600 to-indigo-600',
    card:        'bg-slate-950 border border-slate-800 hover:shadow-xl hover:-translate-y-0.5',
    badge:       'text-violet-400',
    name:        'text-white',
    price:       'text-white',
    period:      'text-slate-400',
    feature:     'text-slate-400',
    check:       'text-violet-400',
    inherit:     'text-violet-400 bg-violet-950/50 border-violet-800',
    btn:         'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-900/40',
    btnActive:   'bg-violet-900/50 text-violet-300 cursor-default',
    btnOther:    'bg-violet-950/50 text-violet-400 hover:bg-violet-900/50 border border-violet-800',
    divider:     'bg-slate-800',
  },
};

// Nome curto dos tiers para o label "Inclui tudo do Nível N +"
const TIER_SHORT: Record<number, string> = { 1: 'Gratuito', 2: 'Essencial', 3: 'Profissional' };

export default function PricingSection({ onRegister, onUpgrade, onChangePlan, currentTier: propCurrentTier }: PricingSectionProps) {
  const router = useRouter();

  const { tier: hookTier, isPromo, promoExpiresAt, refresh: refreshTier } = useTier();
  const activeTier = propCurrentTier && propCurrentTier > 0 ? propCurrentTier : hookTier;

  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isSyncing, setIsSyncing]                 = useState(false);
  const [showUpgradeModal, setShowUpgradeModal]   = useState(false);
  const [selectedTier, setSelectedTier]           = useState<number>(1);
  const [stripeSecret, setStripeSecret]           = useState<string | null>(null);
  const [checkoutError, setCheckoutError]         = useState<string | null>(null);

  const showCheckoutError = (msg: string) => {
    setCheckoutError(msg);
    setTimeout(() => setCheckoutError(null), 5000);
  };

  const forceManualSync = async () => {
    const token = getAuthToken();
    if (!token) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache, no-store' },
      });
      const data = await res.json();
      if (res.ok && data.tier !== undefined) {
        localStorage.setItem('bawzi_tier', String(data.tier));
        localStorage.setItem('bawzi_tier_ts', String(Date.now()));
        window.location.reload();
      }
    } catch { /* silencioso */ } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem('returning_from_portal') === 'true') {
      sessionStorage.removeItem('returning_from_portal');
      forceManualSync();
    } else if (!propCurrentTier) {
      refreshTier();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegisterClick = () => {
    if (onRegister) onRegister();
    else router.push('/login');
  };

  const handleManageSubscription = () => {
    sessionStorage.setItem('goto_section', 'sec-assinatura');
    router.push('/profile');
  };

  // Inicia checkout para usuário não-assinante
  const handleUpgradeClick = async (tier: number) => {
    if (onUpgrade) { onUpgrade(tier); return; }

    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }

    setSelectedTier(tier);
    setIsCheckoutLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.updated) {
          await forceManualSync();
        } else if (data.url) {
          sessionStorage.setItem('returning_from_portal', 'true');
          const navTimeout = setTimeout(() => {
            setIsCheckoutLoading(false);
            showCheckoutError('Redirecionamento demorou. Tente novamente ou acesse o portal pelo perfil.');
          }, 8000);
          window.addEventListener('beforeunload', () => clearTimeout(navTimeout), { once: true });
          window.location.href = data.url;
        } else if (data.client_secret) {
          setStripeSecret(data.client_secret);
          setShowUpgradeModal(true);
          setIsCheckoutLoading(false);
        } else {
          setIsCheckoutLoading(false);
          showCheckoutError(data.detail || 'Erro inesperado ao processar o pagamento. Tente novamente.');
        }
      } else {
        throw new Error(data.detail || 'Erro no processamento');
      }
    } catch {
      setIsCheckoutLoading(false);
      showCheckoutError('Erro de ligação ao servidor. Tente novamente.');
    }
  };

  // Decide a ação do botão de cada card
  const handleCardButton = (tierLevel: number) => {
    if (tierLevel === -1) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (tierLevel === 1)  { handleRegisterClick(); return; }

    // Plano atual do assinante pago
    if (!isPromo && tierLevel === activeTier) { handleManageSubscription(); return; }

    // Assinante pago clicando em outro plano pago → modal de troca
    if (!isPromo && activeTier > 1 && tierLevel > 1) {
      if (onChangePlan) { onChangePlan(tierLevel); return; }
      // Fallback: redireciona para o perfil quando não há modal disponível
      handleManageSubscription();
      return;
    }

    // Usuário gratuito clicando em plano pago
    handleUpgradeClick(tierLevel);
  };

  // Texto do botão de cada card
  const buttonLabel = (tier: typeof tiers[number], isActivePaid: boolean, isPromoActive: boolean): string => {
    if (isPromoActive)  return 'Assinar e manter acesso';
    if (isActivePaid)   return '✓ Plano Atual';
    if (!isPromo && activeTier > 1 && tier.tierLevel > 1 && tier.tierLevel !== activeTier) {
      return tier.tierLevel > activeTier ? '↑ Fazer upgrade' : '↓ Fazer downgrade';
    }
    return tier.buttonText;
  };

  return (
    <>
      {checkoutError && (
        <div className="fixed bottom-5 right-5 z-[200] max-w-sm rounded-2xl border bg-red-50 border-red-200 text-red-800 px-4 py-3 text-sm font-semibold shadow-xl">
          {checkoutError}
        </div>
      )}

      {/* Banner: Convite Promocional */}
      {isPromo && (
        <div className="flex flex-wrap items-center gap-3 bg-violet-50 border border-violet-200 px-5 py-4 rounded-2xl mb-6">
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-700 bg-violet-100 border border-violet-200 px-2.5 py-1 rounded-lg">
              Convite Promocional
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-violet-900">
              Você tem acesso completo ao plano <strong>Avançado</strong> via convite.
            </p>
            {promoExpiresAt && (
              <p className="flex items-center gap-1 text-[11px] text-violet-500 font-medium mt-0.5">
                <CalendarClock className="w-3 h-3" />
                Expira em {new Date(promoExpiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                {' '}— assine abaixo para manter o acesso.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Banner: Assinatura Paga Ativa */}
      {activeTier > 1 && !isPromo && (
        <div className="flex flex-wrap items-center gap-3 bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-2xl mb-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
            Assinatura Ativa
          </span>
          <p className="text-[12px] font-semibold text-emerald-800 flex-1 min-w-0">
            Nível {activeTier} — acesso total aos recursos premium.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={forceManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded-xl hover:bg-emerald-50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando…' : 'Atualizar'}
            </button>
            <button
              onClick={handleManageSubscription}
              className="px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-black rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
            >
              Gerenciar ↗
            </button>
          </div>
        </div>
      )}

      {/* Grid de cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end mb-16">
        {tiers.map((tier) => {
          const s            = tierStyle[String(tier.tierLevel)];
          const isActivePaid = !isPromo && tier.tierLevel === activeTier;
          const isPromoActive= isPromo  && tier.tierLevel === activeTier;
          const isOtherPaid  = !isPromo && activeTier > 1 && tier.tierLevel > 1 && tier.tierLevel !== activeTier;

          return (
            <div
              key={tier.tierLevel}
              className={`rounded-2xl flex flex-col transition-all duration-300 overflow-hidden ${s.card}
                ${isActivePaid  ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}
                ${isPromoActive ? 'ring-2 ring-violet-400 ring-offset-2'  : ''}`}
            >
              {/* Faixa colorida */}
              <div className={`h-1 w-full ${s.strip}`} />

              {/* Cabeçalho */}
              <div className="px-5 pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${s.badge}`}>
                    {tier.badge}
                  </span>
                  {tier.label && (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border
                      ${tier.tierLevel === 3
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                      {tier.label}
                    </span>
                  )}
                </div>
                <h3 className={`text-[18px] font-black leading-tight ${s.name}`}>{tier.name}</h3>
                <div className="flex items-baseline gap-0.5 mt-2">
                  <span className={`text-[24px] font-black leading-none ${s.price}`}>{tier.price}</span>
                  {tier.period && (
                    <span className={`text-[12px] font-medium ${s.period}`}>{tier.period}</span>
                  )}
                </div>
              </div>

              {/* Separador */}
              <div className={`h-px mx-5 ${s.divider}`} />

              {/* Features */}
              <ul className="px-5 py-4 space-y-2 flex-1">
                {/* Tag de progressão — "Tudo do Nível N +" */}
                {tier.inherits !== null && (
                  <li className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide rounded-lg px-2 py-1.5 border mb-1 ${s.inherit}`}>
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    Tudo do {TIER_SHORT[tier.inherits]} +
                  </li>
                )}

                {tier.features.map((feature, i) => (
                  <li key={i} className={`flex items-start gap-2 text-[11px] font-medium leading-snug ${s.feature}`}>
                    <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${s.check}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Botão */}
              <div className="px-5 pb-5 pt-1 space-y-2">
                {isPromoActive && (
                  <div className="flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg">
                    <Sparkles className="w-2.5 h-2.5" />
                    Acesso via convite ativo
                  </div>
                )}
                <button
                  onClick={() => handleCardButton(tier.tierLevel)}
                  disabled={isActivePaid && !onChangePlan}
                  className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.98]
                    ${isActivePaid
                      ? s.btnActive
                      : isPromoActive
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : isOtherPaid
                          ? s.btnOther
                          : s.btn}`}
                >
                  {buttonLabel(tier, isActivePaid, isPromoActive)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false);
          setStripeSecret(null);
          forceManualSync();
        }}
        tier={selectedTier}
        clientSecret={stripeSecret}
      />

      {isCheckoutLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-[90%] mx-auto text-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-violet-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-violet-600 rounded-full border-t-transparent animate-spin" />
              <Lock className="absolute inset-0 m-auto text-violet-600" size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Ambiente Seguro</h3>
            <p className="text-slate-500 font-medium leading-relaxed">A Sincronizar com o Stripe...</p>
          </div>
        </div>
      )}
    </>
  );
}
