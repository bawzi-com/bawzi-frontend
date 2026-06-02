'use client';

import React, { useState, useMemo } from 'react';
import { Crosshair, Zap, Shield, EyeOff, Activity } from 'lucide-react';

interface TacticalSimulatorProps {
  pricing?: any;
  fullResult?: any;
  userTier?: number;
}

export default function TacticalSimulator({
  pricing = {},
  fullResult = {},
  userTier = 1
}: TacticalSimulatorProps) {
  
  const [modo, setModo] = useState<'CONSERVADOR' | 'SNIPER' | 'KAMIKAZE'>('SNIPER');
  const isLocked = userTier < 4;

  const extrairValorExato = (textoBase: any): number => {
    if (!textoBase) return 0;
    if (typeof textoBase === 'number') return textoBase > 0 ? textoBase : 0;
    const texto = String(textoBase);
    const matches = [...texto.matchAll(/R\$\s*([\d\.,]+)/g)];
    let valStr = matches.length > 0 ? matches[0][1] : texto.replace(/[^\d,.-]/g, '');
    
    if (valStr.includes('.') && !valStr.includes(',')) {
        const partes = valStr.split('.');
        if (partes[partes.length - 1].length !== 3) {
            return parseFloat(valStr) || 0;
        }
    }

    const limpo = valStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  };

  // 🟢 O MESMO MINERADOR SEMÂNTICO DA SALA DE GUERRA (Impede de ler R$ 0,60 como Global)
  const minerarDadosDoResumo = (texto: string) => {
    if (!texto) return { quantidade: 1, valorGlobal: 0 };
    let quantidade = 1;
    let valorGlobal = 0;
    let valorUnitario = 0;

    const matchQtd = texto.match(/quantidade[\s\S]*?de\s*([\d\.]+)/i);
    if (matchQtd) {
      quantidade = parseInt(matchQtd[1].replace(/\./g, ''), 10) || 1;
    }

    const matchUnit = texto.match(/valor\s+unitário[\s\S]*?R\$\s*([\d\.,]+)/i);
    if (matchUnit) {
      const valStr = matchUnit[1].replace(/\./g, '').replace(',', '.');
      valorUnitario = parseFloat(valStr) || 0;
    }

    const matchTotal = texto.match(/(?:totalizando|total\s+de|valor\s+de)\s*R\$\s*([\d\.,]+)/i);
    if (matchTotal) {
      const valStr = matchTotal[1].replace(/\./g, '').replace(',', '.');
      valorGlobal = parseFloat(valStr) || 0;
    }

    if (valorGlobal === 0 && valorUnitario > 0) valorGlobal = valorUnitario * quantidade;
    if (valorUnitario === 0 && valorGlobal > 0 && quantidade > 0) valorUnitario = valorGlobal / quantidade;

    return { quantidade, valorGlobal };
  };

  // 🟢 CÁLCULO DO VALOR GLOBAL COM INTELIGÊNCIA TEXTUAL
  const valorGlobal = useMemo(() => {
    if (pricing?.valor_estimado_sigiloso) return 0;

    let soma = 0;

    if (pricing?.itens_lotes && Array.isArray(pricing.itens_lotes) && pricing.itens_lotes.length > 0) {
        soma = pricing.itens_lotes.reduce((acc: number, item: any) => {
            return acc + extrairValorExato(item.valor_estimado_raw);
        }, 0);
    }

    if (soma > 0) return soma;

    // Tenta variáveis estruturadas do Governo
    const vEdital = extrairValorExato(pricing?.valor_estimado_raw) || extrairValorExato(fullResult?.estimated_value);
    if (vEdital > 0) return vEdital;

    // Se falhar, usa o Minerador Semântico para achar o "totalizando R$ X" no texto
    const dadosMinerados = minerarDadosDoResumo(fullResult?.summary || fullResult?.description);
    if (dadosMinerados.valorGlobal > 0) return dadosMinerados.valorGlobal;

    // Fallback absoluto (força bruta caso a IA mude a forma de escrever o resumo)
    return extrairValorExato(fullResult?.summary) || 0;
  }, [pricing, fullResult]);

  const desagioEstimado = pricing?.desagioPreditivoOrgao || 0;
  const isSigiloso = valorGlobal <= 0;

  const formatMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  if (isLocked) {
    return (
      <div className="border border-slate-200 rounded-[2rem] bg-slate-50 p-8 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase">Simulador de Estratégia Bloqueado</p>
      </div>
    );
  }

  if (isSigiloso) {
    return (
      <div className="bg-slate-900 rounded-[2rem] p-8 text-center text-white border border-slate-800">
        <EyeOff size={32} className="mx-auto text-slate-500 mb-3" />
        <h4 className="text-sm font-black uppercase tracking-widest text-amber-400">Simulador Oculto</h4>
        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">Orçamento sigiloso detectado. A projeção de metas operacionais globais requer o preço de referência aberto.</p>
      </div>
    );
  }

  // 🟢 MATEMÁTICA MACRO (GLOBAL)
  const precoAlvoVencedor = valorGlobal * (1 - (desagioEstimado / 100));
  const taxasMargem = { 'CONSERVADOR': 20, 'SNIPER': 12, 'KAMIKAZE': 5 };
  const margemAtual = taxasMargem[modo];
  
  const custoMaximoOperacional = precoAlvoVencedor * (1 - (margemAtual / 100));
  const lucroLimpo = precoAlvoVencedor - custoMaximoOperacional;

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Activity size={18} className="text-indigo-600" />
        <div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Simulador Tático Ativado</h3>
          <p className="text-[10px] text-slate-400 font-bold">Projeção Global Interativa (Metas da Diretoria)</p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-4">
        <div>
          <span className="text-[9px] font-black text-slate-400 uppercase block">1. Valor Global de Referência</span>
          <span className="text-sm font-black text-slate-800">{formatMoeda(valorGlobal)}</span>
        </div>
        <div>
          <span className="text-[9px] font-black text-indigo-500 uppercase block">Preço Alvo Vencedor (Histórico)</span>
          <span className="text-sm font-black text-indigo-700">{formatMoeda(precoAlvoVencedor)}</span>
          <span className="text-[9px] text-indigo-400 font-bold block">-{desagioEstimado.toFixed(1)}% sobre o Teto Global</span>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Sua Meta Estratégica Global</span>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
          <button onClick={() => setModo('CONSERVADOR')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg flex items-center justify-center gap-1 transition-all ${modo === 'CONSERVADOR' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/60' : 'text-slate-400'}`}><Shield size={12} /> Conservador</button>
          <button onClick={() => setModo('SNIPER')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg flex items-center justify-center gap-1 transition-all ${modo === 'SNIPER' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60' : 'text-slate-400'}`}><Crosshair size={12} /> Sniper</button>
          <button onClick={() => setModo('KAMIKAZE')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg flex items-center justify-center gap-1 transition-all ${modo === 'KAMIKAZE' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400'}`}><Zap size={12} /> Kamikaze</button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-5 text-white relative overflow-hidden shadow-inner">
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">📊 Margem de Jogo: {margemAtual.toFixed(1)}%</p>
        <p className="text-[11px] text-slate-400 leading-relaxed mb-4">Margem de lucro embutida no volume total do contrato.</p>
        
        <span className="text-[9px] font-black text-slate-400 uppercase block">Custo Máximo Global da Operação:</span>
        <h2 className="text-2xl font-black text-amber-400 border-b border-slate-800 pb-3 mb-3">{formatMoeda(custoMaximoOperacional)}</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
            <span className="text-[8px] text-slate-400 uppercase font-bold block">Seu Lance Final (Teto)</span>
            <span className="text-xs font-black text-white">{formatMoeda(precoAlvoVencedor)}</span>
          </div>
          <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40">
            <span className="text-[8px] text-emerald-400 uppercase font-bold block">Lucro Limpo Projetado</span>
            <span className="text-xs font-black text-emerald-400">{formatMoeda(lucroLimpo)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
