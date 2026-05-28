'use client';

/**
 * AnalysisLoadingOverlay.tsx
 * Painel de loading durante o processamento multi-agente.
 * Exibe logo animado, spinner, mensagens rotativas e botão de cancelar.
 */

import React from 'react';
import Image from 'next/image';

interface LoadingMessage {
  title: string;
  desc: string;
}

interface AnalysisLoadingOverlayProps {
  loadingStep: number;
  loadingMessages: LoadingMessage[];
  onCancel: () => void;
}

export default function AnalysisLoadingOverlay({
  loadingStep,
  loadingMessages,
  onCancel,
}: AnalysisLoadingOverlayProps) {
  return (
    <div
      id="area-loading"
      className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-12 animate-in fade-in duration-700 relative overflow-hidden"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-slate-100/50 blur-[80px] rounded-full pointer-events-none"></div>

      <div className="relative flex flex-col items-center z-10 text-center space-y-8">
        {/* Logo */}
        <div className="animate-pulse transform hover:scale-105 transition-transform duration-500">
          <Image
            src="/logo-bawzi.png"
            alt="Bawzi Logo"
            width={140}
            height={40}
            className="object-contain opacity-80"
            priority
          />
        </div>

        {/* Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-slate-900 rounded-full animate-spin shadow-sm"></div>
        </div>

        {/* Mensagem rotativa */}
        <div className="relative h-20 max-w-sm w-full">
          <div
            key={loadingStep}
            className="absolute inset-0 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            <h3 className="text-xl font-black text-slate-900 tracking-tight text-center">
              {loadingMessages[loadingStep].title}
            </h3>
            <p className="text-sm font-medium text-slate-400 leading-relaxed text-center mt-2">
              {loadingMessages[loadingStep].desc}
            </p>
          </div>
        </div>

        {/* Status + cancelar */}
        <div className="pt-4 flex flex-col items-center gap-6">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            Neural Routing Ativado
          </span>

          <button
            onClick={onCancel}
            className="group flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <span className="text-lg group-hover:rotate-90 transition-transform">✖</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Cancelar Processamento</span>
          </button>
        </div>
      </div>
    </div>
  );
}
