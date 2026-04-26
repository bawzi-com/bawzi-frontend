'use client';

import { useRouter } from 'next/navigation';

interface PricingSectionProps {
  onRegister?: () => void;
  onUpgrade?: (tier: number) => void;
}

export default function PricingSection({ onRegister, onUpgrade }: PricingSectionProps) {
  const router = useRouter();

  // Função inteligente para o botão de Registar
  const handleRegisterClick = () => {
    if (onRegister) {
      onRegister(); // Se estiver no Dashboard, abre o modal
    } else {
      router.push('/login'); // Se estiver noutra página, manda para o login
    }
  };

  // Função inteligente para o botão de Assinar
  const handleUpgradeClick = async (tier: number) => {
    if (onUpgrade) {
      onUpgrade(tier); // Se estiver no Dashboard, usa a sua função já existente
    } else {
      // Lógica de fallback (ex: se estiver na página /plans)
      const token = typeof window !== 'undefined' ? localStorage.getItem('bawzi_token') : null;
      if (!token) {
        handleRegisterClick();
        return;
      }
      try {
        const response = await fetch('http://localhost:8000/api/billing/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ tier }),
        });
        const data = await response.json();
        if (data.url) window.location.href = data.url;
      } catch (err) {
        alert("Erro ao iniciar processo de pagamento.");
      }
    }
  };

  // Os planos são definidos AQUI, o HTML vai ler automaticamente desta lista
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
      popular: true // Este é o nosso plano em Destaque
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
      {/* GRID DE PREÇOS GERADO DINAMICAMENTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-stretch mb-16">
        {tiers.map((tier, index) => (
          <div 
            key={index} 
            className={`p-8 rounded-[2rem] flex flex-col transition-all duration-300 ${
              tier.popular 
                ? "bg-slate-950 border border-slate-800 text-white shadow-2xl relative lg:-translate-y-4 z-10 transform hover:scale-[1.02]" 
                : "bg-white border border-slate-200 shadow-xl shadow-slate-100 hover:border-violet-200"
            } ${tier.tierLevel === -1 ? "bg-slate-50" : ""}`}
          >
            
            {/* Tag de destaque para o plano mais popular */}
            {tier.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-pink-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-lg">
                Melhor Escolha
              </div>
            )}

            <span className={`text-xs font-black uppercase tracking-widest mb-2 ${tier.popular ? 'text-slate-400' : 'text-slate-500'}`}>
              {tier.badge}
            </span>
            
            <h3 className={`text-2xl font-black mb-4 ${tier.popular ? 'text-white' : 'text-slate-900'}`}>
              {tier.name}
            </h3>
            
            <div className={`text-4xl font-black mb-6 ${tier.popular ? 'text-white' : 'text-slate-900'}`}>
              {tier.price.includes('/') ? (
                <>
                  {tier.price.split('/')[0]}
                  <span className={`text-lg ${tier.popular ? 'text-slate-400' : 'text-slate-400'}`}>/{tier.price.split('/')[1]}</span>
                </>
              ) : tier.price.includes('*') ? (
                <>
                  {tier.price.replace('*', '')}
                  <span className="text-lg text-slate-400">*</span>
                </>
              ) : (
                tier.price
              )}
            </div>

            <div className={`px-3 py-2 rounded-lg border text-sm font-bold w-fit mb-6 shadow-sm ${
              tier.popular ? 'bg-white/10 border-white/20 text-white backdrop-blur-sm' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              {tier.ai}
            </div>

            <ul className={`space-y-4 mb-8 flex-1 text-sm font-medium ${tier.popular ? 'text-slate-300' : 'text-slate-600'}`}>
              {tier.features.map((feature, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`font-bold ${tier.popular ? 'text-emerald-400' : 'text-emerald-500'}`}>✓</span> 
                  {feature}
                </li>
              ))}
            </ul>

            <button 
              onClick={() => {
                if (tier.tierLevel === -1) window.scrollTo({top: 0, behavior: 'smooth'});
                else if (tier.tierLevel === 1) handleRegisterClick();
                else handleUpgradeClick(tier.tierLevel);
              }} 
              className={`w-full py-3 rounded-xl font-bold transition-colors active:scale-[0.98] ${
                tier.popular 
                  ? 'bg-white text-slate-900 shadow-lg hover:bg-slate-100' 
                  : tier.tierLevel === -1 
                    ? 'bg-white border-2 border-slate-200 text-slate-900 hover:border-slate-300'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              {tier.buttonText}
            </button>
          </div>
        ))}
      </div>

      {/* BANNER ENTERPRISE */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 lg:p-16 flex flex-col lg:flex-row justify-between items-center gap-10 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-violet-600/30 blur-[100px] rounded-full group-hover:bg-violet-500/40 transition-colors duration-700"></div>
        <div className="relative z-10 flex-1 max-w-2xl">
          <span className="bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase mb-6 inline-block">Enterprise API</span>
          <h3 className="text-3xl md:text-4xl font-black mb-4">Integração Customizada</h3>
          <p className="text-slate-300 text-lg leading-relaxed m-0">
            Ligamos a inteligência da Bawzi diretamente ao seu ERP. Treinamos modelos exclusivos com o histórico de licitações da sua empresa para previsões impecáveis.
          </p>
        </div>
        <button className="relative z-10 px-8 py-5 rounded-2xl bg-white text-slate-900 font-black text-lg hover:-translate-y-1 hover:shadow-2xl transition-all whitespace-nowrap active:scale-[0.98]">
          Falar com Especialistas
        </button>
      </div>
    </>
  );
}