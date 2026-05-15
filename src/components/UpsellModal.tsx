'use client';

import React from 'react';
import { 
  Zap, CheckCircle2, Rocket, X, ShieldCheck, Cpu 
} from 'lucide-react';
import { useRouter } from 'next/navigation'; // Adicionado para navegação suave

interface UpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  features?: { title: string; desc: string }[];
}

export default function UpsellModal({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  features 
}: UpsellModalProps) {
  
  const router = useRouter();

  if (!isOpen) return null;

  // Benefícios padrão focados no Tier 3 (O Carro-Chefe da Bawzi)
  const defaultFeatures = [
    { title: "Análises Ilimitadas", desc: "Sem travas de quantidade por mês. Analise tudo." },
    { title: "Motores de Elite", desc: "Acesso total ao GPT-4o e Claude 3.5 Sonnet." },
    { title: "Mapeamento de Riscos", desc: "Identificação de pegadinhas e roteiros de impugnação." }
  ];

  const displayFeatures = features || defaultFeatures;

  const handleUpgradeClick = () => {
    onClose(); // Fecha o modal
    router.push('/billing'); // Redireciona para a página de planos
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Banner de Gradiente Superior (Background) */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-600/10 via-violet-600/10 to-fuchsia-600/10 blur-2xl -z-10" />

        {/* Botão de Fechar */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 w-8 h-8 bg-white/50 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all z-50 border border-slate-200"
        >
          <X size={16} />
        </button>

        <div className="p-6 sm:p-8 flex flex-col items-center">
          {/* Ícone Animado */}
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-3xl flex items-center justify-center text-indigo-600 mb-6 shadow-inner border border-white">
            <Rocket size={40} className="animate-bounce" />
          </div>

          {/* Título e Descrição */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">
              {title || "Desbloqueie o Poder Total"}
            </h2>
            <p className="mt-3 text-slate-500 font-medium text-sm leading-relaxed">
              {description || "Você atingiu o limite do seu plano. Não pare agora, a Bawzi te leva ao próximo nível na licitação."}
            </p>
          </div>

          {/* Lista de Benefícios */}
          <div className="w-full space-y-4 mb-8 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            {displayFeatures.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-700">{feat.title}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="w-full flex flex-col gap-3">
            <button 
              onClick={handleUpgradeClick}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
            >
              Fazer Upgrade Agora <Zap size={14} className="fill-white group-hover:scale-125 transition-transform" />
            </button>
            
            <button 
              onClick={onClose}
              className="w-full py-3 text-slate-400 hover:text-slate-600 font-bold text-[10px] uppercase tracking-widest transition-all"
            >
              Continuar com limitações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}