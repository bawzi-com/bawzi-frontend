'use client';

import React, { useState } from 'react';

export default function UpgradeModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full shadow-2xl relative overflow-hidden border border-slate-100">
        
        {/* Decoração de fundo */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-violet-100 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-violet-100 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm">
            🚀
          </div>
          
          <h2 className="text-3xl font-black text-slate-900 mb-4 leading-tight">
            Você atingiu o topo do Plano Grátis!
          </h2>
          
          <div className="space-y-4 mb-8">
            <p className="text-slate-500 font-medium leading-relaxed">
              As suas 10 análises gratuitas foram concluídas. 
              <span className="block mt-2 text-slate-700 font-bold">
                Fique tranquilo: todo o seu histórico de estratégias permanece totalmente acessível para consulta.
              </span>
            </p>
            <p className="text-slate-500 font-medium leading-relaxed">
              Para continuar analisando novos editais com precisão cirúrgica e IA avançada, mude para o Plano Profissional.
            </p>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => window.location.href = '/plans'}
              className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl shadow-lg shadow-violet-200 transition-all active:scale-95 uppercase tracking-widest text-[10px]"
            >
              Ver Planos e Fazer Upgrade
            </button>
            
            <button 
              onClick={onClose}
              className="w-full py-4 bg-transparent text-slate-400 font-bold hover:text-slate-600 transition-all text-[10px] uppercase tracking-widest"
            >
              Continuar navegando no histórico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}