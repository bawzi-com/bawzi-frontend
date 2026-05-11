'use client';

import { Lock } from 'lucide-react';
import React from 'react';

interface PremiumLockProps {
  isLocked: boolean;
  featureTitle: string;
  requiredTierName: string;
  onUpgradeClick: () => void;
  children: React.ReactNode;
}

export default function PremiumLock({ isLocked, featureTitle, requiredTierName, onUpgradeClick, children }: PremiumLockProps) {
  // Se não estiver bloqueado, renderiza a ferramenta normalmente
  if (!isLocked) {
    return <div className="mt-4">{children}</div>;
  }

  // Se estiver bloqueado, aplica o "blur" (desfoque) e o ecrã de upgrade
  return (
    <div className="relative group mt-4">
      
      {/* 1. FERRAMENTA ORIGINAL (Desfocada e desativada) */}
      <div className="blur-[6px] select-none pointer-events-none opacity-50 grayscale-[0.4] transition-all">
        {children}
      </div>

      {/* 2. OVERLAY DO CADEADO (Por cima da ferramenta) */}
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 text-center bg-slate-900/40 backdrop-blur-[2px] rounded-[2.5rem]">
        <div className="w-16 h-16 bg-slate-950 text-white rounded-3xl flex items-center justify-center shadow-2xl mb-6 border border-slate-700">
          <Lock size={32} className="text-amber-400" />
        </div>
        <h4 className="text-2xl font-black text-white mb-2">{featureTitle}</h4>
        <p className="text-sm text-slate-200 font-medium max-w-sm mb-8 leading-relaxed">
          Esta ferramenta é exclusiva para clientes com o plano <strong className="text-emerald-400 uppercase">{requiredTierName}</strong> ou superior.
        </p>
        <button 
          onClick={onUpgradeClick}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95"
        >
          Desbloquear Agora ⚡
        </button>
      </div>

    </div>
  );
}