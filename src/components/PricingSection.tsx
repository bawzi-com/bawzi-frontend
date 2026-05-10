'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Lock, Check } from 'lucide-react';
import UpgradeModal from './UpgradeModal';

interface PricingSectionProps {
  onRegister?: () => void;
  onUpgrade?: (tier: number) => void;
  currentTier?: number;
}

export default function PricingSection({ onRegister, onUpgrade, currentTier: propCurrentTier }: PricingSectionProps) {
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // ESTADOS
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(1); 
  const [stripeSecret, setStripeSecret] = useState<string | null>(null); 
  
  // 🟢 ESTADO INTELIGENTE DO TIER (Começa no 0 = Visitante)
  const [activeTier, setActiveTier] = useState<number>(propCurrentTier ?? 0);

  // 🟢 AUTO-BUSCA: Deteta automaticamente o nível se acedido via Menu
  useEffect(() => {
    // Se o pai (ex: Dashboard) já passar a prop corretamente, usamos a prop.
    if (propCurrentTier !== undefined && propCurrentTier > 0) {
      setActiveTier(propCurrentTier);
      return;
    }

    // Se não foi passada prop (ex: página pública), tenta buscar o tier real
    const fetchRealTier = async () => {
      const token = localStorage.getItem('bawzi_token') || localStorage.getItem('token');
      if (!token) return; // Utilizador deslogado, mantém tier 0

      try {
        const res = await fetch(`${API_URL}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.tier !== undefined) {
          setActiveTier(data.tier);
        }
      } catch (error) {
        console.error("Erro ao detetar tier automático", error);
      }
    };

    fetchRealTier();
  }, [propCurrentTier, API_URL]);

  const handleRegisterClick = () => {
    if (onRegister) {
      onRegister(); 
    } else {
      router.push('/login'); 
    }
  };

  // GESTÃO DE ASSINATURA (Portal do Cliente Stripe)
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
        window.location.href = data.url; 
      } else {
        setIsCheckoutLoading(false);
        alert(data.detail || "Erro ao abrir faturamento.");
      }
    } catch (error) {
      setIsCheckoutLoading(false);
      alert("Erro de conexão ao tentar acessar o faturamento.");
    }
  };

  // UPGRADE DE PLANO
  const handleUpgradeClick = async (tier: number) => {
    setSelectedTier(tier);
    setIsCheckoutLoading(true); 
    
    try {
      const token = localStorage.getItem('bawzi_token') || localStorage.getItem('token');
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
          window.location.href = data.url;
        } else if (data.client_secret) {
          setStripeSecret(data.client_secret);
          setShowUpgradeModal(true);
          setIsCheckoutLoading(false); 
        }
      } else {
        throw new Error(data.detail || "Erro no processamento");
      }
    } catch (error) {
      setIsCheckoutLoading(false);
      alert("Erro ao processar plano. Tente novamente.");
    }
  };

  const tiers = [
    {
      name: "Explorador",
      badge: "NÍVEL 0",
      price: "Grátis",
      ai: "⚡ Groq (Llama 3)",
      features: ["Até 10.000 caracteres", "Arquivos até 3MB", "Sem login exigido"],
      buttonText: "Testar Agora",
      tierLevel: -1,
      popular: false
    },
    {
      name: "Potencial",
      badge: "NÍVEL 1",
      price: "Grátis*",
      ai: "🤖 GPT-4o-mini",
      features: ["Até 20.000 caracteres", "Arquivos até 5MB", "Histórico e Perfil Salvo"],
      buttonText: "Criar Conta",
      tierLevel: 1,
      popular: false
    },
    {
      name: "Essencial",
      badge: "NÍVEL 2",
      price: "R$ 79/mês",
      ai: "🧠 GPT-4o (Advanced)",
      features: ["Até 60.000 caracteres", "Arquivos até 10MB", "Mapeamento de Riscos"],
      buttonText: "Assinar Essencial",
      tierLevel: 2,
      popular: false
    },
    {
      name: "Especialista",
      badge: "NÍVEL 3",
      price: "R$ 197/mês",
      ai: "🎯 Claude 3.5 Sonnet",
      features: ["Até 150.000 caracteres", "Arquivos até 20MB", "Checklist Documental IA"],
      buttonText: "Assinar Pro",
      tierLevel: 3,
      popular: true
    },
    {
      name: "Dominador",
      badge: "NÍVEL 4",
      price: "R$ 497/mês",
      ai: "🏆 GPT-4o + Claude Opus", 
      features: ["Até 300.000 caracteres", "Arquivos até 50MB", "Consultoria Ilimitada"],
      buttonText: "Assinar Elite",
      tierLevel: 4,
      popular: false
    }
  ];

  return (
    <>
      {/* SEÇÃO DE GESTÃO PARA ASSINANTES */}
      {activeTier > 1 && (
        <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm mb-12">
          <div className="flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-md mb-4 inline-block shadow-sm">
              Assinatura Ativa
            </span>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Seu plano atual é o Nível {activeTier}</h3>
            <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-xl">
              Você tem acesso total aos recursos premium. Para gerenciar pagamentos ou faturas, acesse o painel seguro.
            </p>
          </div>
          <button 
            onClick={handleManageSubscription}
            className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white font-black text-sm rounded-2xl hover:bg-violet-600 transition-all shadow-xl hover:shadow-violet-600/30 whitespace-nowrap active:scale-[0.98]"
          >
            Gerenciar Assinatura ↗
          </button>
        </div>
      )}

      {/* GRADE DE PLANOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-stretch mb-16">
        {tiers.map((tier, index) => {
          // 🟢 AGORA COMPARA COM O activeTier
          const isCurrentPlan = tier.tierLevel === activeTier;

          return (
            <div 
              key={index} 
              className={`p-8 rounded-[2rem] flex flex-col transition-all duration-300 ${
                tier.popular 
                  ? "bg-slate-950 shadow-2xl relative lg:-translate-y-4 z-10 transform hover:scale-[1.02]" 
                  : tier.tierLevel === -1 
                    ? "bg-slate-50 shadow-xl shadow-slate-100" 
                    : "bg-white shadow-xl shadow-slate-100"
              } ${
                isCurrentPlan 
                  ? "border-2 border-violet-500 ring-4 ring-violet-500/10" 
                  : tier.popular 
                    ? "border border-slate-800" 
                    : "border border-slate-200"
              }`}
            >

              <span className={`text-xs font-black uppercase tracking-widest mb-2 ${tier.popular ? 'text-slate-400' : 'text-slate-500'}`}>
                {tier.badge}
              </span>
              
              <h3 className={`text-2xl font-black mb-4 ${tier.popular ? 'text-white' : 'text-slate-900'}`}>
                {tier.name}
              </h3>
              
              <div className={`text-4xl font-black mb-6 ${tier.popular ? 'text-white' : 'text-slate-900'}`}>
                {tier.price}
              </div>

              <div className={`px-3 py-2 rounded-lg border text-sm font-bold w-fit mb-6 shadow-sm ${
                tier.popular ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                {tier.ai}
              </div>

              <ul className={`space-y-4 mb-8 flex-1 text-sm font-medium ${tier.popular ? 'text-slate-300' : 'text-slate-600'}`}>
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className={`w-4 h-4 ${tier.popular ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => {
                  if (isCurrentPlan) handleManageSubscription();
                  else if (tier.tierLevel === -1) window.scrollTo({top: 0, behavior: 'smooth'});
                  else if (tier.tierLevel === 1) handleRegisterClick();
                  else handleUpgradeClick(tier.tierLevel);
                }} 
                disabled={isCheckoutLoading}
                className={`w-full py-3 rounded-xl font-bold transition-all active:scale-[0.98] ${
                  isCurrentPlan 
                    ? 'bg-slate-200 text-slate-500 cursor-default border border-slate-300'
                    : tier.popular 
                      ? 'bg-white text-slate-900 hover:bg-slate-100' 
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                }`}
              >
                {isCurrentPlan ? 'Plano Atual' : tier.buttonText}
              </button>
            </div>
          );
        })}
      </div>

      {/* ENTERPRISE SECTION */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 lg:p-16 flex flex-col lg:flex-row justify-between items-center gap-10 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-violet-600/30 blur-[100px] rounded-full"></div>
        <div className="relative z-10 flex-1 max-w-2xl">
          <span className="bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase mb-6 inline-block">Enterprise API</span>
          <h3 className="text-3xl md:text-4xl font-black mb-4">Integração Customizada</h3>
          <p className="text-slate-300 text-lg leading-relaxed m-0">
            Ligamos a inteligência da Bawzi diretamente ao seu ERP para previsões impecáveis.
          </p>
        </div>
        <button className="relative z-10 px-8 py-5 rounded-2xl bg-white text-slate-900 font-black text-lg hover:-translate-y-1 transition-all">
          Falar com Especialistas
        </button>
      </div>

      {/* MODAL DE UPGRADE */}
      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => {
          setShowUpgradeModal(false);
          setStripeSecret(null);
        }} 
        tier={selectedTier} 
        clientSecret={stripeSecret} 
      />

      {/* OVERLAY DE CARREGAMENTO SEGURO */}
      {isCheckoutLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-[90%] mx-auto text-center animate-in fade-in zoom-in duration-200">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-violet-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-violet-600 rounded-full border-t-transparent animate-spin"></div>
              <Lock className="absolute inset-0 m-auto text-violet-600" size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Ambiente Seguro</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              Preparando seu ambiente 100% criptografado no <span className="font-bold text-slate-700">Stripe</span>. Aguarde...
            </p>
          </div>
        </div>
      )}
    </>
  );
}