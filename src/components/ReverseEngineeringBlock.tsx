'use client';

import React from 'react';
import { Calculator, Target, TrendingDown, Lock, Crown, Activity, ShoppingBag } from 'lucide-react';

interface ReverseEngineeringProps {
  valorReferencia: number;
  desagio: number;
  engenhariaData: any;
  userTier?: number;
  quantidade?: number; // 🟢 NOVA PROP: Quantidade de itens no lote
}

export default function ReverseEngineeringBlock({ 
  valorReferencia = 0, 
  desagio = 0, 
  engenhariaData,
  userTier = 1,
  quantidade = 1000 // 🟢 Padrão 1000 para o teste fazer sentido
}: ReverseEngineeringProps) {
  
  const isLocked = userTier < 4;
  const qtdSegura = quantidade > 0 ? quantidade : 1;

  const formatMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const margemSetor = engenhariaData?.margem_media_setor_pct || 20;
  
  let setorNome = engenhariaData?.setor_identificado || 'Média Padrão do Mercado';
  if (setorNome.toLowerCase().includes('não identificado')) {
    setorNome = 'Média Padrão do Mercado (Geral)';
  }

  // CÁLCULOS GLOBAIS (CONTRATO INTEGRAL)
  const precoPraticadoGlobal = valorReferencia * (1 - (desagio / 100));
  const custoRealGlobal = precoPraticadoGlobal * (1 - (margemSetor / 100));

  // 🟢 CÁLCULOS UNITÁRIOS (O QUE O EMPRESÁRIO DIGITA NO PORTAL)
  const tetoUnitario = valorReferencia / qtdSegura;
  const precoPraticadoUnitario = precoPraticadoGlobal / qtdSegura;
  const custoRealUnitario = custoRealGlobal / qtdSegura;

  if (isLocked) {
    return (
      <div className="relative border border-slate-200 rounded-[1.5rem] bg-slate-50 p-8 flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="w-16 h-16 bg-white shadow-md border border-slate-100 rounded-full flex items-center justify-center mb-4 relative z-10">
          <Lock size={28} className="text-slate-300" />
        </div>
        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2 relative z-10 flex items-center gap-2">
          <Crown size={16} className="text-amber-500" /> Engenharia Reversa Bloqueada
        </h4>
        <p className="text-slate-500 text-xs font-medium max-w-sm relative z-10">
          Descubra o <strong>cenário preditivo unitário</strong> e a margem real que os seus adversários vão usar na disputa.
        </p>
        <button className="mt-6 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg transition-all relative z-10">
          Desbloquear Nível Dominador
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* INDICADOR DE PORTE DA DEMANDA */}
      <div className="bg-slate-100/80 rounded-xl px-4 py-3 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <ShoppingBag size={14} className="text-indigo-500" /> Dimensão do Lote Detectada
        </span>
        <span className="text-xs font-black text-slate-800 bg-white border border-slate-200 px-3 py-1 rounded-lg">
          Volume Estimado: {qtdSegura.toLocaleString('pt-BR')} unidades
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Teto Unitário */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 transition-colors">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">1. Teto de Referência Unitário</span>
          <h4 className="text-2xl font-black text-slate-800 tracking-tight">{formatMoeda(tetoUnitario)}</h4>
          <p className="text-[9px] font-bold text-slate-400 mt-1">Global: {formatMoeda(valorReferencia)}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-3 flex items-center gap-1.5 border-t border-slate-200/60 pt-2">
            <Activity size={12} className="text-indigo-400" /> {setorNome}
          </p>
        </div>

        {/* Projeção de Lance Unitário */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1 block">2. Projeção de Lance Unitário</span>
          <h4 className="text-2xl font-black text-indigo-700 tracking-tight">{formatMoeda(precoPraticadoUnitario)}</h4>
          <p className="text-[9px] font-bold text-indigo-400 mt-1">Global: {formatMoeda(precoPraticadoGlobal)}</p>
          <div className="flex items-center gap-2 mt-3 border-t border-indigo-100/60 pt-2">
            <span className="bg-white text-indigo-600 border border-indigo-200 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
              <TrendingDown size={10} /> {desagio.toFixed(1)}%
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Deságio de Mercado</span>
          </div>
        </div>
      </div>

      {/* Conclusão Estratégica Unitária */}
      <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
        <div className="flex items-center gap-2 mb-3 relative z-10">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-amber-500/20 text-amber-400">
            <TrendingDown size={14} />
          </div>
          <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Análise de Viabilidade por Embalagem</h4>
        </div>
        
        <p className="text-sm text-slate-300 font-medium leading-relaxed relative z-10">
          Para que um concorrente sustente o lance projetado de <strong>{formatMoeda(precoPraticadoUnitario)}</strong> mantendo a margem líquida de <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded">{margemSetor}%</strong>, o custo real de aquisição/logística dele por embalagem deve ser de no máximo <strong className="text-amber-400 text-base">{formatMoeda(custoRealUnitario)}</strong>.
        </p>
        
        <div className="mt-4 pt-4 border-t border-slate-800 relative z-10">
          <p className="text-xs text-slate-400 font-bold">
            <strong className="text-white">O Cenário Operacional:</strong> Se o seu custo de nota fiscal + frete para o pacote de café de 250g for menor do que <span className="text-amber-400">{formatMoeda(custoRealUnitario)}</span>, você tem a faca e o queijo na mão para cobrir o rival no tapetão dos lances com lucro garantido.
          </p>
        </div>
      </div>

    </div>
  );
}