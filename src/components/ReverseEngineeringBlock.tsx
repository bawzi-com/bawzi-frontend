'use client';

import React, { useMemo } from 'react';
import { TrendingDown, Lock, Crown, Activity, ShoppingBag, EyeOff } from 'lucide-react';

interface ReverseEngineeringProps {
  valorReferencia: number;
  desagio: number;
  engenhariaData: any;
  userTier?: number;
  quantidade?: any;
}

export default function ReverseEngineeringBlock({ 
  valorReferencia = 0, 
  desagio = 0, 
  engenhariaData,
  userTier = 1,
  quantidade = 1 
}: ReverseEngineeringProps) {
  
  const isLocked = userTier < 4;

  // 🟢 PARSER DE QUANTIDADE INDESTRUTÍVEL (Evita que "1.000" vire "1" no JS)
  const qtdSegura = useMemo(() => {
    if (!quantidade) return 1;
    if (typeof quantidade === 'number') return quantidade > 0 ? quantidade : 1;
    const str = String(quantidade).replace(/\s/g, '');
    if (str.includes(',')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    }
    if (str.includes('.') && !str.includes(',')) {
      const partes = str.split('.');
      if (partes[partes.length - 1].length === 3) {
        return parseFloat(str.replace(/\./g, ''));
      }
    }
    const num = parseFloat(str);
    return isNaN(num) || num <= 0 ? 1 : num;
  }, [quantidade]);

  const isSigiloso = !valorReferencia || valorReferencia <= 0 || isNaN(valorReferencia); 

  const formatMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const margemSetor = engenhariaData?.margem_media_setor_pct || 20;
  const setorNome = engenhariaData?.setor_identificado || 'Item da Licitação';

  const isServico = /reforma|engenharia|obra|servi[çc]o|constru[çc][ãa]o|repar|loca[çc]|manuten[çc][ãa]o/i.test(setorNome);
  const isSoftwareOuLicenca = /licen[çc]a|software|sistema|windows|cloud|saas|assinatura|suporte|ti\b|tecnologia/i.test(setorNome);
  const termoUnidade = isServico
    ? 'por unidade de entrega/medição'
    : isSoftwareOuLicenca
      ? 'por licença/item'
      : 'por unidade/item';

  if (isLocked) {
    return (
      <div className="relative border border-slate-200 rounded-[1.5rem] bg-slate-50 p-8 flex flex-col items-center justify-center text-center overflow-hidden">
        <Lock size={28} className="text-slate-300 mb-4" />
        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Crown size={16} className="text-amber-500" /> Engenharia Reversa Bloqueada
        </h4>
        <p className="text-slate-500 text-xs font-medium max-w-sm">
          Descubra o cenário preditivo e a margem real que os seus adversários vão usar na disputa.
        </p>
      </div>
    );
  }

  if (isSigiloso) {
    return (
      <div className="bg-slate-900 rounded-[2rem] p-10 relative overflow-hidden shadow-xl text-center flex flex-col items-center justify-center border border-slate-800">
        <EyeOff size={40} className="text-slate-500 mb-4" />
        <h4 className="text-lg font-black text-white uppercase tracking-widest mb-2">Orçamento Sigiloso</h4>
        <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-md mx-auto">
          O órgão optou por manter o valor de referência <strong>oculto</strong> nesta fase da licitação. O cálculo reverso de lances unitários estará disponível assim que as propostas forem abertas.
        </p>
      </div>
    );
  }

  // Cálculos baseados na escala correta da quantidade corrigida
  const precoPraticadoGlobal = valorReferencia * (1 - (desagio / 100));
  const custoRealGlobal = precoPraticadoGlobal * (1 - (margemSetor / 100));
  const tetoUnitario = valorReferencia / qtdSegura;
  const precoPraticadoUnitario = precoPraticadoGlobal / qtdSegura;
  const custoRealUnitario = custoRealGlobal / qtdSegura;

  return (
    <div className="flex flex-col gap-6">
      
      <div className="bg-slate-100/80 rounded-xl px-4 py-3 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <ShoppingBag size={14} className="text-indigo-500" /> Dimensão do Lote Detectada
        </span>
        <span className="text-xs font-black text-slate-800 bg-white border border-slate-200 px-3 py-1 rounded-lg">
          Volume estimado: {qtdSegura.toLocaleString('pt-BR')} {qtdSegura === 1 ? 'unidade' : 'unidades'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative overflow-hidden">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">1. Teto unitário do edital</span>
          <h4 className="text-xl font-black text-slate-800 tracking-tight">{formatMoeda(tetoUnitario)}</h4>
          <p className="text-[9px] font-bold text-slate-400 mt-1">Global: {formatMoeda(valorReferencia)}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-3 flex items-center gap-1.5 border-t border-slate-200/60 pt-2 truncate">
            <Activity size={12} className="text-indigo-400 shrink-0" /> {setorNome}
          </p>
        </div>

        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 relative overflow-hidden">
          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1 block">2. Preço provável para competir</span>
          <h4 className="text-xl font-black text-indigo-700 tracking-tight">{formatMoeda(precoPraticadoUnitario)}</h4>
          <p className="text-[9px] font-bold text-indigo-400 mt-1">Global: {formatMoeda(precoPraticadoGlobal)}</p>
          <div className="flex items-center gap-2 mt-3 border-t border-indigo-100/60 pt-2">
            <span className="bg-white text-indigo-600 border border-indigo-200 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
              <TrendingDown size={10} /> {desagio.toFixed(1)}%
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Deságio estimado</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
        <div className="flex items-center gap-2 mb-3 relative z-10">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-amber-500/20 text-amber-400"><TrendingDown size={14} /></div>
          <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Estratégia de preço para competir</h4>
        </div>
        
        <p className="text-sm text-slate-300 font-medium leading-relaxed relative z-10">
          Para disputar contra esse padrão de preço, sua proposta precisa suportar algo próximo de <strong>{formatMoeda(precoPraticadoUnitario)}</strong> {termoUnidade}. Mantendo margem líquida estimada de <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded">{margemSetor}%</strong>, o custo máximo recomendado fica em <strong className="text-amber-400 text-base">{formatMoeda(custoRealUnitario)}</strong> {termoUnidade}.
        </p>
        
        <div className="mt-4 pt-4 border-t border-slate-800 relative z-10">
          <p className="text-xs text-slate-400 font-bold">
            <strong className="text-white">Leitura para sua decisão:</strong> se o seu custo direto para este item ficar abaixo de <span className="text-amber-400">{formatMoeda(custoRealUnitario)}</span>, a disputa tende a preservar margem. Acima desse ponto, vale revisar preço, escopo ou decidir não entrar.
          </p>
        </div>
      </div>
    </div>
  );
}
