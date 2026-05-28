'use client';

/**
 * ImpugnacaoModal.tsx
 * Modal de visualização e cópia da peça de impugnação gerada pela IA.
 */

import React from 'react';
import { Scale, ClipboardList } from 'lucide-react';

interface ImpugnacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  impugnacaoText: string;
  copiado: boolean;
  onCopy: () => void;
}

export default function ImpugnacaoModal({
  isOpen,
  onClose,
  impugnacaoText,
  copiado,
  onCopy,
}: ImpugnacaoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2rem] flex flex-col shadow-2xl relative overflow-hidden">

        {/* Cabeçalho */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-inner">
              <Scale size={18} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-none">Peça de Impugnação</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gerado pela Bawzi Legal AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCopy}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition-colors border border-slate-200 shadow-sm"
            >
              <ClipboardList size={13} className="inline mr-1" />
              {copiado ? '✓ Copiado!' : 'Copiar Texto'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              ✖
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-100/50">
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-8 max-w-3xl mx-auto font-serif text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
            {impugnacaoText}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-white border-t border-slate-100 text-center">
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
            * Revisão humana obrigatória. Preencha as lacunas com os dados da sua empresa antes de protocolar no órgão.
          </p>
        </div>
      </div>
    </div>
  );
}
