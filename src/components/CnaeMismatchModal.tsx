'use client';

import { AlertTriangle } from 'lucide-react';

interface CnaeMismatchModalProps {
  isOpen: boolean;
  /** Nome/razão social da empresa ativa, para deixar claro qual CNAE está sendo comparado */
  empresaNome?: string;
  /** CNAE/descrição do negócio cadastrado */
  cnaeDescricao?: string;
  /** Trecho do objeto do edital, para o usuário comparar rapidamente */
  objetoEdital?: string;
  /** Linha extra opcional, usada no caso de análise em lote ("3 de 5 editais selecionados...") */
  notaAdicional?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function CnaeMismatchModal({
  isOpen,
  empresaNome,
  cnaeDescricao,
  objetoEdital,
  notaAdicional,
  onCancel,
  onConfirm,
}: CnaeMismatchModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md"
      style={{ animation: 'backdropIn 0.25s ease-out' }}
    >
      <style>{`
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>

      <div className="absolute inset-0" onClick={onCancel} aria-hidden="true" />

      <div
        className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="bg-gradient-to-br from-amber-500 via-amber-500 to-orange-600 px-6 py-5 flex items-center gap-3 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-gradient-to-br from-orange-400/30 to-amber-300/20 blur-xl pointer-events-none" />
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            <AlertTriangle size={20} className="text-white" strokeWidth={2.4} />
          </div>
          <div className="relative">
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.15em] leading-none mb-1">
              Antes de gastar uma análise
            </p>
            <p className="text-white text-[15px] font-black leading-tight drop-shadow-sm">
              Este edital parece fora do seu CNAE
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Não encontramos relação clara entre o objeto deste edital e o ramo de atividade
            {empresaNome ? <> cadastrado para <span className="font-bold text-slate-800">{empresaNome}</span></> : ' cadastrado da sua empresa'}.
            Pode ser um falso alarme — mas confirme antes de seguir, já que a análise consome um crédito.
          </p>

          {notaAdicional && (
            <p className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {notaAdicional}
            </p>
          )}

          {cnaeDescricao && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Seu CNAE / negócio</p>
              <p className="text-xs font-semibold text-slate-700 line-clamp-2">{cnaeDescricao}</p>
            </div>
          )}

          {objetoEdital && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">Objeto do edital</p>
              <p className="text-xs font-semibold text-amber-900 line-clamp-3">{objetoEdital}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-md"
          >
            Analisar mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
}
