import React, { useState, useEffect } from 'react';

interface BawziShadowSimulatorProps {
  valorEstimadoOrgao: number;
  desagioPreditivoOrgao: number;
  nivelAmeaca: string;
  perfilVencedor: string;
  valorMedioMercado?: number; 
  debugInfo?: any; // 🟢 NOVA PROP DE DEBUG
}

const formatBRL = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

export default function BawziShadowSimulator({
  valorEstimadoOrgao,
  desagioPreditivoOrgao,
  nivelAmeaca,
  perfilVencedor,
  valorMedioMercado,
  debugInfo
}: BawziShadowSimulatorProps) {
  
  const [tetoEditalRaw, setTetoEditalRaw] = useState<string>(
    valorEstimadoOrgao > 0 
      ? valorEstimadoOrgao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
      : ''
  );
  
  const [custoOperacionalRaw, setCustoOperacionalRaw] = useState<string>('');
  
  // 🟢 ESTADO DO PAINEL DE DEBUG
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (valorEstimadoOrgao > 0) {
      setTetoEditalRaw(valorEstimadoOrgao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [valorEstimadoOrgao]);

  const tetoEdital = parseFloat(tetoEditalRaw.replace(/\./g, '').replace(',', '.')) || 0;
  const custoOperacional = parseFloat(custoOperacionalRaw.replace(/\./g, '').replace(',', '.')) || 0;
  
  const lanceSniper = tetoEdital * (1 - (desagioPreditivoOrgao / 100));
  const lucroLiquidoAbsoluto = lanceSniper - custoOperacional;
  const lucroLiquidoPercentual = lanceSniper > 0 ? (lucroLiquidoAbsoluto / lanceSniper) * 100 : 0;

  const isPrejuizo = lucroLiquidoAbsoluto < 0;
  const isApertado = lucroLiquidoPercentual > 0 && lucroLiquidoPercentual < 10;
  
  let themeColor = "text-emerald-600"; let themeBg = "bg-emerald-50"; let themeBorder = "border-emerald-200";
  if (isPrejuizo) {
    themeColor = "text-red-600"; themeBg = "bg-red-50"; themeBorder = "border-red-200";
  } else if (isApertado) {
    themeColor = "text-amber-600"; themeBg = "bg-amber-50"; themeBorder = "border-amber-200";
  }

  const handleCurrencyChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') { setter(''); return; }
    const numberValue = parseInt(value, 10) / 100;
    setter(numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  return (
    <div className="bg-slate-950 rounded-[1.5rem] p-6 md:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-900/20 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-800 pb-6 relative z-10">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="text-2xl">⚔️</span> SIMULADOR SHADOW 2.0
          </h3>
          <p className="text-sm text-slate-400 font-medium mt-1">Motor Preditivo de Licitações (Bottom-Up)</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 🟢 BOTÃO DE DEBUG SECRETO */}
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showDebug ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
            title="Telemetria de Debug"
          >
            🐛
          </button>
          <div className="bg-violet-500/10 text-violet-400 px-3 py-1.5 rounded-lg border border-violet-500/20 flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-widest">IA ATIVA</span>
          </div>
        </div>
      </div>

      {/* 🟢 PAINEL DE DEBUG EXPANSÍVEL */}
      {showDebug && debugInfo && (
        <div className="mb-8 p-4 bg-slate-900 border border-amber-500/30 rounded-xl relative z-10 animate-in fade-in slide-in-from-top-2">
          <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">📡 Terminal de Debug: PNCP RAW DATA</h4>
          <pre className="text-xs text-amber-200/80 font-mono overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}

      {/* MÉTRICAS DE MERCADO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 relative z-10">
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Fator Aperto (Órgão)</h4>
          <p className="text-2xl font-black text-white">-{desagioPreditivoOrgao}%</p>
          <p className="text-xs text-slate-500 mt-2">Deságio médio histórico.</p>
        </div>
        
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Radar de Ameaça</h4>
          <p className={`text-xl mt-1 font-black ${nivelAmeaca === 'ALTO' ? 'text-red-400' : nivelAmeaca === 'MODERADO' ? 'text-amber-400' : 'text-emerald-400'}`}>
            {nivelAmeaca}
          </p>
          <p className="text-xs text-slate-500 mt-2 truncate">Tubarões: {perfilVencedor}</p>
        </div>

        <div className="bg-slate-900/80 p-5 rounded-2xl border border-violet-500/30 relative overflow-hidden group">
          <div className="absolute inset-0 bg-violet-500/5 group-hover:bg-violet-500/10 transition-colors"></div>
          <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1 relative z-10">Fechamentos Reais (Mercado)</h4>
          <p className="text-xl mt-1 font-black text-white relative z-10">
            {valorMedioMercado ? formatBRL(valorMedioMercado) : 'Dados Sigilosos/Insuficientes'}
          </p>
          <p className="text-xs text-slate-500 mt-2 relative z-10">Ticket médio do setor (B2B).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
        <div className="space-y-6">
          
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 focus-within:border-indigo-500/50 transition-colors">
            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">1. Valor Referência (Teto do Edital)</h4>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
              <input 
                type="text" 
                value={tetoEditalRaw}
                onChange={handleCurrencyChange(setTetoEditalRaw)}
                placeholder="0,00"
                className="w-full bg-slate-950 border border-slate-700 text-white font-bold text-lg rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-700"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Valor base da licitação. Extraído pela IA ou preencha se sigiloso.</p>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
            <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">2. Custo Total Operacional</h4>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
              <input 
                type="text" 
                value={custoOperacionalRaw}
                onChange={handleCurrencyChange(setCustoOperacionalRaw)}
                placeholder="0,00"
                className="w-full bg-slate-950 border border-slate-700 text-white font-bold text-lg rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-slate-700"
              />
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-3 leading-relaxed">
              Inclua produto, impostos e comissões. <strong className="text-slate-300">Evite lances abaixo deste valor.</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-col h-full space-y-4">
          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg relative overflow-hidden flex-1 flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <h4 className="text-sm font-black text-indigo-200 uppercase tracking-widest mb-2 flex items-center gap-2 relative z-10">
              <span className="text-xl">🎯</span> O Lance Sniper (Recomendado)
            </h4>
            <p className="text-3xl md:text-4xl font-black text-white tracking-tighter relative z-10">
              {formatBRL(lanceSniper)}
            </p>
            <p className="text-xs text-indigo-200/80 mt-2 font-medium relative z-10">
              Cálculo preditivo p/ vitória ({desagioPreditivoOrgao}% de deságio sobre o Teto).
            </p>
          </div>

          <div className={`p-6 rounded-2xl border transition-colors duration-300 ${themeBg} ${themeBorder} flex-1 flex flex-col justify-center`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className={`text-[10px] font-black uppercase tracking-widest ${themeColor} opacity-80`}>
                Lucro Líquido Projetado
              </h4>
              <span className={`text-lg font-black ${themeColor}`}>
                {custoOperacional > 0 && tetoEdital > 0 ? `${lucroLiquidoPercentual.toFixed(1)}%` : '---'}
              </span>
            </div>
            
            <p className={`text-3xl font-black tracking-tighter ${themeColor}`}>
              {custoOperacional > 0 && tetoEdital > 0 ? formatBRL(lucroLiquidoAbsoluto) : 'R$ 0,00'}
            </p>
            
            {isPrejuizo && custoOperacional > 0 && tetoEdital > 0 && (
              <p className="text-[11px] font-bold text-red-600 mt-2 bg-red-100 px-2 py-1 rounded w-max">
                🚨 Risco de Prejuízo! Lance menor que custo.
              </p>
            )}
            {isApertado && custoOperacional > 0 && tetoEdital > 0 && (
              <p className="text-[11px] font-bold text-amber-700 mt-2 bg-amber-100 px-2 py-1 rounded w-max">
                ⚠️ Margem perigosa (&lt;10%). Avalie viabilidade.
              </p>
            )}
            {!isPrejuizo && !isApertado && custoOperacional > 0 && tetoEdital > 0 && (
              <p className="text-[11px] font-bold text-emerald-700 mt-2 bg-emerald-100 px-2 py-1 rounded w-max">
                ✅ Margem saudável para executar.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}