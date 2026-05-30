'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Lock, Check, RefreshCw } from 'lucide-react';
import UpgradeModal from './UpgradeModal';

interface PricingSectionProps {
  onRegister?: () => void;
  onUpgrade?: (tier: number) => void;
  currentTier?: number;
}

export default function PricingSection({ onRegister, onUpgrade, currentTier: propCurrentTier }: PricingSectionProps) {
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [stripeSecret, setStripeSecret] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<number>(propCurrentTier ?? 0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const showCheckoutError = (msg: string) => {
    setCheckoutError(msg);
    setTimeout(() => setCheckoutError(null), 5000);
  };

  const refreshTier = useCallback(async () => {
    const token = localStorage.getItem('bawzi_token') || localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/users/me?_t=${Date.now()}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      const data = await res.json();
      
      if (res.ok && data.tier !== undefined) {
        setActiveTier(data.tier);
        localStorage.setItem('user_tier', String(data.tier));
        localStorage.setItem('bawzi_tier', String(data.tier));
      }
    } catch (error) {
      console.error("Erro ao atualizar tier", error);
    }
  }, [API_URL]);

  // 🟢 FUNÇÃO MESTRA DE SYNC: Vai diretamente ao Stripe!
  const forceManualSync = async () => {
    const token = localStorage.getItem('bawzi_token') || localStorage.getItem('token');
    if (!token) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store'
        }
      });
      const data = await res.json();

      if (res.ok && data.tier !== undefined) {
        localStorage.setItem('user_tier', String(data.tier));
        localStorage.setItem('bawzi_tier', String(data.tier));
        window.location.reload(); // Recarrega para destrancar cadeados!
      }
    } catch (error) {
      console.error("Erro ao forçar sync", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // 🟢 VERIFICA SE O UTILIZADOR ESTÁ A VOLTAR DO PORTAL DO STRIPE
  useEffect(() => {
    const checkPortalReturn = async () => {
      if (sessionStorage.getItem('returning_from_portal') === 'true') {
        // Remove a marca para não ficar em loop
        sessionStorage.removeItem('returning_from_portal');
        
        // Dispara o sync com o Stripe na hora!
        await forceManualSync();
      } else {
        // Fluxo normal
        if (propCurrentTier !== undefined && propCurrentTier > 0) {
          setActiveTier(propCurrentTier);
        } else {
          refreshTier();
        }
      }
    };
    checkPortalReturn();
  }, [propCurrentTier, refreshTier]);

  const handleRegisterClick = () => {
    if (onRegister) onRegister(); 
    else router.push('/login'); 
  };

  const handleManageSubscription = async () => {
    setIsCheckoutLoading(true);
    try {
      const token = localStorage.getItem('bawzi_token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/billing/customer-portal`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.url) {
        // 🟢 MARCA QUE VAI SAIR PARA O PORTAL
        sessionStorage.setItem('returning_from_portal', 'true');
        window.location.href = data.url; 
      } else {
        setIsCheckoutLoading(false);
        showCheckoutError(data.detail || "Erro ao abrir faturamento.");
      }
    } catch {
      setIsCheckoutLoading(false);
      showCheckoutError("Erro de conexão. Tente novamente.");
    }
  };

  const handleUpgradeClick = async (tier: number) => {
    const token = localStorage.getItem('bawzi_token') || localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    setSelectedTier(tier);
    setIsCheckoutLoading(true); 
    
    try {
      const res = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tier })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.url) {
          // Portal/Checkout Stripe — redireciona para lá.
          // Safety net: reseta o loading se a navegação não acontecer em 8s.
          sessionStorage.setItem('returning_from_portal', 'true');
          const navTimeout = setTimeout(() => {
            setIsCheckoutLoading(false);
            showCheckoutError('Redirecionamento demorou. Tente novamente ou acesse o portal pelo perfil.');
          }, 8000);
          window.addEventListener('beforeunload', () => clearTimeout(navTimeout), { once: true });
          window.location.href = data.url;
        } else if (data.client_secret) {
          // Embedded checkout: abre o modal com o formulário do Stripe
          setStripeSecret(data.client_secret);
          setShowUpgradeModal(true);
          setIsCheckoutLoading(false);
        } else {
          // Resposta inesperada do backend (sem url nem client_secret)
          setIsCheckoutLoading(false);
          showCheckoutError(data.detail || "Erro inesperado ao processar o pagamento. Tente novamente.");
        }
      } else {
        throw new Error(data.detail || "Erro no processamento");
      }
    } catch {
      setIsCheckoutLoading(false);
      showCheckoutError("Erro de ligação ao servidor. Tente novamente.");
    }
  };

  const tiers = [
    {
      name: "Explorador", badge: "NÍVEL 0", price: "Grátis",
      features: [
        "Nova Análise — score Go/No-Go",
        "Resumo executivo do edital",
        "Semáforo de viabilidade",
        "Editais até 10.000 caracteres",
        "PDF até 3 MB · sem cadastro",
      ],
      buttonText: "Testar Agora", tierLevel: -1, popular: false,
    },
    {
      name: "Potencial", badge: "NÍVEL 1", price: "Grátis*",
      features: [
        "Análise completa (5×/mês)",
        "Mapa de riscos jurídicos",
        "Editais até 25.000 caracteres",
        "PDF até 5 MB",
      ],
      buttonText: "Criar Conta", tierLevel: 1, popular: false,
    },
    {
      name: "Essencial", badge: "NÍVEL 2", price: "R$ 79/mês",
      features: [
        "Perfil da empresa (CNPJ/UF)",
        "Histórico de análises salvo",
        "Comparar editais lado a lado",
        "Radar 360 — busca PNCP",
        "Editais até 80.000 caracteres",
        "PDF até 15 MB",
      ],
      buttonText: "Assinar Essencial", tierLevel: 2, popular: false,
    },
    {
      name: "Especialista", badge: "NÍVEL 3", price: "R$ 197/mês",
      features: [
        "Para Você — oportunidades por CNAE",
        "Alertas proativos PNCP (e-mail + sino)",
        "Capital Inteligente — crédito e pré-qualificação",
        "4 Agentes IA em paralelo",
        "Editais até 180.000 caracteres",
        "PDF até 30 MB",
      ],
      buttonText: "Assinar Pro", tierLevel: 3, popular: true,
    },
    {
      name: "Dominador", badge: "NÍVEL 4", price: "R$ 497/mês",
      features: [
        "Renovações — radar de contratos a vencer",
        "War Room de concorrentes",
        "Simulador tático de preços",
        "Editais até 400.000 caracteres",
        "PDF até 100 MB · suporte prioritário",
      ],
      buttonText: "Assinar Elite", tierLevel: 4, popular: false,
    },
  ];

  return (
    <>
      {checkoutError && (
        <div className="fixed bottom-5 right-5 z-[200] max-w-sm rounded-2xl border bg-red-50 border-red-200 text-red-800 px-4 py-3 text-sm font-semibold shadow-xl">
          {checkoutError}
        </div>
      )}
      {activeTier > 1 && (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end mb-16">
        {tiers.map((tier, index) => {
          const isCurrentPlan = tier.tierLevel === activeTier;
          const isDark = tier.popular;
          return (
            <div
              key={index}
              className={`rounded-2xl flex flex-col transition-all duration-300 overflow-hidden
                ${isDark ? 'bg-slate-950 shadow-xl lg:-translate-y-3 z-10 relative' : tier.tierLevel === -1 ? 'bg-slate-50' : 'bg-white'}
                ${isCurrentPlan ? 'ring-2 ring-emerald-500 ring-offset-2' : 'border border-slate-200'}`}
            >
              {/* Topo colorido */}
              <div className={`px-5 pt-5 pb-4 ${isDark ? '' : 'border-b border-slate-100'}`}>
                <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {tier.badge}
                </span>
                <h3 className={`text-[17px] font-black mt-0.5 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {tier.name}
                </h3>
                <div className={`text-[22px] font-black mt-2 leading-none ${isDark ? 'text-emerald-400' : 'text-slate-900'}`}>
                  {tier.price}
                </div>
              </div>

              {/* Features */}
              <ul className={`px-5 py-4 space-y-2.5 flex-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] font-medium leading-snug">
                    <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Botão */}
              <div className="px-5 pb-5">
                <button
                  onClick={() => {
                    if (isCurrentPlan) handleManageSubscription();
                    else if (tier.tierLevel === -1) window.scrollTo({ top: 0, behavior: 'smooth' });
                    else if (tier.tierLevel === 1) handleRegisterClick();
                    else handleUpgradeClick(tier.tierLevel);
                  }}
                  className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]
                    ${isCurrentPlan
                      ? 'bg-emerald-500/20 text-emerald-600 cursor-default'
                      : isDark
                        ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-lg'
                        : 'bg-slate-900 text-white hover:bg-slate-700'}`}
                >
                  {isCurrentPlan ? '✓ Plano Atual' : tier.buttonText}
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
          forceManualSync(); // Se o modal em pop-up for fechado, força o sync também!
        }} 
        tier={selectedTier} 
        clientSecret={stripeSecret} 
      />

      {isCheckoutLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-[90%] mx-auto text-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-violet-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-violet-600 rounded-full border-t-transparent animate-spin"></div>
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