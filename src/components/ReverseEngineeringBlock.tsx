'use client';

import { Lock, Zap, Target, Info } from 'lucide-react';

interface EngenhariaProps {
  userTier: number;
  valorReferencia: number;
  desagio: number;
  engenhariaData?: {
    setor_identificado?: string;
    margem_media_setor_pct?: number;
  };
  onUpgradeClick: () => void;
}

export default function ReverseEngineeringBlock({ userTier, valorReferencia, desagio, engenhariaData, onUpgradeClick }: EngenhariaProps) {
  // 🟢 Apenas o Nível 4 (Dominador) tem acesso total
  const isLocked = userTier < 4;

  // 🟢 Cálculos Dinâmicos com base nos dados reais do edital
  const margemPct = engenhariaData?.margem_media_setor_pct || 20;
  const setor = engenhariaData?.setor_identificado || 'Setor Econômico Não Identificado (CNAE 62)';
  const precoPraticado = valorReferencia * (1 - (desagio / 100));
  const custoPresumido = precoPraticado * (1 - (margemPct / 100));

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="relative group">
      <div className={`bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm p-8 transition-all ${isLocked ? 'grayscale-[0.5] opacity-80' : ''}`}>
        
        {/* CABEÇALHO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 pb-6 border-b border-slate-50">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${isLocked ? 'bg-slate-400' : 'bg-amber-500'}`}>
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {isLocked ? 'ENGENHARIA REVERSA BLOQUEADA' : 'ENGENHARIA REVERSA ATIVADA'}
              </h3>
              <p className="text-sm text-slate-400 font-bold">Cruzamento PNCP + Receita Federal (CNAE)</p>
            </div>
          </div>
          
          {!isLocked && (
            <div className="px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2">
              <Zap size={14} className="text-amber-600 fill-amber-600" />
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Inteligência Ativa</span>
            </div>
          )}
        </div>

        {/* CONTEÚDO (Borrado se bloqueado) */}
        <div className={`space-y-8 ${isLocked ? 'select-none blur-[4px]' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">1. Valor de Referência (Teto)</label>
              <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100">
                <span className="text-2xl font-black text-slate-900">{formatCurrency(valorReferencia)}</span>
                <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center gap-2">
                  <Info size={12} /> {setor}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">2. Preço Praticado</label>
              <div className="p-6 bg-emerald-50 rounded-2xl border-2 border-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-emerald-900">{formatCurrency(precoPraticado)}</span>
                  <span className="bg-emerald-200 text-emerald-900 text-[10px] font-black px-2 py-1 rounded-lg">-{desagio}%</span>
                </div>
                <p className="mt-2 text-[10px] font-bold text-emerald-700">Sobre o Teto do Edital</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-900 rounded-3xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="text-xs font-black text-violet-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Zap size={14} /> Conclusão da IA
              </h4>
              <p className="text-sm font-medium leading-relaxed text-slate-300">
                Para o concorrente entregar este preço tendo <span className="text-white font-bold text-lg">{margemPct}% de lucro</span> padrão do setor, o produto custa-lhe cerca de <span className="text-emerald-400 font-bold text-lg">{formatCurrency(custoPresumido)}</span>. Este é o número que você tem de bater.
              </p>
            </div>
          </div>
        </div>

        {/* 🔴 OVERLAY DE BLOQUEIO */}
        {isLocked && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center bg-white/40 backdrop-blur-[6px] rounded-[2.5rem]">
            <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-2xl mb-6 animate-bounce">
              <Lock size={32} />
            </div>
            <h4 className="text-2xl font-black text-slate-900 mb-2">Engenharia Reversa</h4>
            <p className="text-sm text-slate-600 font-medium max-w-xs mb-8">
              O mapeamento de custo presumido e margem de lucro dos adversários está disponível apenas no <span className="text-violet-600 font-bold">Nível 4 (Dominador)</span>.
            </p>
            <button 
              onClick={onUpgradeClick}
              className="px-8 py-4 bg-violet-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-violet-700 transition-all shadow-xl shadow-violet-200 active:scale-95"
            >
              Fazer Upgrade para o Nível 4
            </button>
          </div>
        )}
      </div>
    </div>
  );
}