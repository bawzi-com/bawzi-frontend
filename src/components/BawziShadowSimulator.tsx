import React, { useState } from 'react';
import { Crosshair, Target, Cpu } from 'lucide-react';

interface EngenhariaReversa {
  setor_identificado: string;
  margem_media_setor_pct: number;
}

interface BawziShadowSimulatorProps {
  desagioPreditivo?: number;
  nivelAmeaca?: string;
  perfilVencedor?: string;
  valorReferenciaInicial?: number;
  engenhariaReversa?: EngenhariaReversa;
  userTier?: number; 
  onUpgradeClick?: () => void;
}

const BawziShadowSimulator: React.FC<BawziShadowSimulatorProps> = ({
  desagioPreditivo = 28.5,
  nivelAmeaca = "ALTO",
  perfilVencedor = "Tubarão Agressivo",
  valorReferenciaInicial = 150000, 
  engenhariaReversa = {
    setor_identificado: "Comércio Atacadista",
    margem_media_setor_pct: 12.0
  },
  userTier = 4, 
  onUpgradeClick
}) => {
  const [estrategia, setEstrategia] = useState<'CONSERVADOR' | 'SNIPER' | 'KAMIKAZE'>('SNIPER');

  const formatToBRL = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const [teto, setTeto] = useState<number>(valorReferenciaInicial || 0);
  
  const precoHistoricoVencedor = teto * (1 - (desagioPreditivo / 100));

  let margemSugerida = 0;
  if (estrategia === 'CONSERVADOR') margemSugerida = engenhariaReversa.margem_media_setor_pct + 5; 
  if (estrategia === 'SNIPER') margemSugerida = engenhariaReversa.margem_media_setor_pct; 
  if (estrategia === 'KAMIKAZE') margemSugerida = engenhariaReversa.margem_media_setor_pct / 2; 

  const nossoLanceSugerido = estrategia === 'KAMIKAZE' 
    ? precoHistoricoVencedor * 0.95 
    : precoHistoricoVencedor;

  // 🟢 A variável está declarada corretamente aqui
  const nossaMetaCusto = nossoLanceSugerido * (1 - (margemSugerida / 100));
  const lucroProjetado = nossoLanceSugerido - nossaMetaCusto;

  return (
    <div className="w-full bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden text-white font-sans">
      
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
            <Crosshair className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-black text-lg tracking-tight flex items-center gap-2">
              SIMULADOR TÁTICO <span className="bg-emerald-600 text-white text-[9px] px-2 py-0.5 rounded uppercase tracking-widest">Ativado</span>
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">Projeção interativa de cenários e margens operacionais</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* ESQUERDA: Variáveis do Simulador */}
        <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Parâmetros de Simulação</h4>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">1. Valor de Referência (Teto do Edital)</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                <input 
                  type="number"
                  value={teto === 0 ? '' : teto}
                  onChange={(e) => setTeto(Number(e.target.value))} 
                  placeholder="Insira o valor do edital..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-9 pr-4 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
            
            <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Preço Alvo Vencedor (Histórico)</p>
              <p className="text-2xl font-black text-white">{formatToBRL(precoHistoricoVencedor)}</p>
              <p className="text-[10px] text-slate-500 mt-1">Estimativa de -{desagioPreditivo}% sobre o Teto</p>
            </div>
          </div>
        </div>

        {/* DIREITA: Sua Estratégia */}
        <div className="p-6 md:p-8 flex flex-col relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/10 to-transparent pointer-events-none" />
          
          <div className="flex flex-col flex-1 relative z-10">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Target className="w-5 h-5 text-emerald-400" /> Sua Meta Operacional
            </h4>

            <div className="flex bg-slate-800 rounded-xl p-1 mb-8">
              {(['CONSERVADOR', 'SNIPER', 'KAMIKAZE'] as const).map((est) => (
                <button
                  key={est}
                  onClick={() => setEstrategia(est)}
                  className={`flex-1 py-2 px-1 text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-wide rounded-lg transition-all ${
                    estrategia === est 
                      ? est === 'KAMIKAZE' ? 'bg-red-500 text-white shadow-lg' : 'bg-emerald-600 text-white shadow-lg' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800 mb-6 shadow-inner">
              <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center border border-sky-500/20 shrink-0">
                <span className="text-sky-400 text-lg">📊</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white">Margem de Jogo: {margemSugerida.toFixed(1)}%</h4>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1 leading-tight">
                  Com base na sua estratégia, esta é a margem de lucro embutida no seu lance.
                </p>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center text-center space-y-2 mb-8">
              <p className="text-slate-400 text-xs font-medium">Para atingir essa margem, seu custo operacional deve ser no máximo:</p>
              <div className={`text-3xl md:text-4xl font-black tracking-tighter ${estrategia === 'KAMIKAZE' ? 'text-red-400' : 'text-emerald-400'}`}>
                {/* 🟢 CORREÇÃO AQUI */}
                {formatToBRL(nossaMetaCusto)}
              </div>
              <div className="flex items-center gap-4 mt-6 pt-5 border-t border-slate-800 w-full justify-center">
                <div className="text-center">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Seu Lance Final</p>
                  <p className="text-xl font-bold text-white">{formatToBRL(nossoLanceSugerido)}</p>
                </div>
                <div className="w-px h-10 bg-slate-800" />
                <div className="text-center">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Lucro Limpo</p>
                  <p className="text-xl font-bold text-white">{formatToBRL(lucroProjetado)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BawziShadowSimulator;