'use client';

/**
 * ShareModal.tsx
 * Modal para partilhar o relatório estratégico por e-mail.
 */

import React from 'react';
import { Mail } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareEmail: string;
  onEmailChange: (email: string) => void;
  onConfirm: () => void;
  isSharing: boolean;
}

export default function ShareModal({
  isOpen,
  onClose,
  shareEmail,
  onEmailChange,
  onConfirm,
  isSharing,
}: ShareModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-900"></div>
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors text-2xl font-bold bg-slate-50 w-8 h-8 rounded-full flex items-center justify-center"
        >
          &times;
        </button>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mb-6 border border-slate-200">
            <Mail size={28} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Enviar para C-Level</h2>
          <p className="text-slate-500 text-sm mt-2 px-4 font-medium leading-relaxed">
            Partilhe esta análise estratégica diretamente com os tomadores de decisão da sua empresa.
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="E-mail do destinatário..."
            value={shareEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full p-4 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-400/10 outline-none bg-slate-50 transition-all font-bold text-slate-700"
          />
          <button
            onClick={onConfirm}
            disabled={isSharing}
            className="w-full py-4 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSharing ? 'A enviar...' : 'Enviar Relatório Estratégico 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
}
