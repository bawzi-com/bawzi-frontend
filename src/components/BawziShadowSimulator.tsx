import React, { useState } from 'react';
import { Crosshair, BrainCircuit, Target, ShieldAlert, Cpu } from 'lucide-react';

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
}

const BawziShadowSimulator: React.FC<BawziShadowSimulatorProps> = ({
  desagioPreditivo = 28.5,
  nivelAmeaca = "ALTO",
  perfilVencedor = "Tubarão Agressivo",
  valorReferenciaInicial = 150000, // Teto lido do PDF pela IA
  engenhariaReversa = {
    setor_identificado: "Comércio Atacadista",
    margem_media_setor_pct: 12.0
  }
}) => {
  // Controle do Slider de Estratégia (Zero-Click)
  const [estrategia, setEstrategia] = useState<'CONSERVADOR' | 'SNIPER' | 'KAMIKAZE'>('SNIPER');

  const formatToBRL = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // MATEMÁTICA DA ENGENHARIA REVERSA
  const [teto, setTeto] = useState<number>(valorReferenciaInicial || 0);
  
  // 1. O que o Concorrente faz:
  const precoHistoricoVencedor = teto * (1 - (desagioPreditivo / 100));
  const custoPresumidoConcorrente = precoHistoricoVencedor * (1 - (engenhariaReversa.margem_media_setor_pct / 100));

  // 2. A Estratégia do Nosso Cliente:
  let margemSugerida = 0;
  if (estrategia === 'CONSERVADOR') margemSugerida = engenhariaReversa.margem_media_setor_pct + 5; // Quer lucrar mais que a média
  if (estrategia === 'SNIPER') margemSugerida = engenhariaReversa.margem_media_setor_pct; // Iguala a média para brigar de frente
  if (estrategia === 'KAMIKAZE') margemSugerida = engenhariaReversa.margem_media_setor_pct / 2; // Esmaga a margem para destruir o concorrente

  const nossoLanceSugerido = estrategia === 'KAMIKAZE' 
    ? precoHistoricoVencedor * 0.95 // 5% mais barato que o vencedor histórico
    : precoHistoricoVencedor;

  const nossaMetaCusto = nossoLanceSugerido * (1 - (margemSugerida / 100));
  const lucroProjetado = nossoLanceSugerido - nossaMetaCusto;

  return (
    <div className="w-full bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden mt-8 text-white font-sans">
      
      {/* HEADER HACKER */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center border border-violet-500/30">
            <Cpu className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-black text-lg tracking-tight flex items-center gap-2">
              ENGENHARIA REVERSA <span className="bg-violet-600 text-white text-[9px] px-2 py-0.5 rounded uppercase tracking-widest">Ativada</span>
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">Cruzamento PNCP + Receita Federal (CNAE)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        
        {/* LADO ESQUERDO: O Raio-X do Concorrente */}
        <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-6">
            <BrainCircuit className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Raio-X do Adversário</h4>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">1. Valor de Referência (Teto do Edital)</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                <input 
                  type="number"
                  value={teto === 0 ? '' : teto}
                  onChange={(e) => setTeto(Number(e.target.value))} 
                  placeholder="Insira o valor do edital..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-white font-bold focus:border-violet-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Setor Identificado (CNAE)</p>
              <p className="text-slate-200 font-bold">{engenhariaReversa.setor_identificado}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Preço Praticado</p>
                <p className="text-xl font-black text-white">{formatToBRL(precoHistoricoVencedor)}</p>
                <p className="text-[10px] text-slate-500 mt-1">-{desagioPreditivo}% sobre Teto</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-16 h-16 bg-red-500/10 rounded-full blur-xl" />
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                  Custo Presumido <ShieldAlert className="w-3 h-3 text-amber-500" />
                </p>
                <p className="text-xl font-black text-amber-400">{formatToBRL(custoPresumidoConcorrente)}</p>
                <p className="text-[10px] text-slate-500 mt-1">Margem média {engenhariaReversa.margem_media_setor_pct}%</p>
              </div>
            </div>

            <div className="bg-indigo-950/30 border border-indigo-500/20 p-4 rounded-xl">
              <p className="text-xs text-indigo-300 leading-relaxed font-medium">
                <strong className="text-indigo-200">Conclusão da IA:</strong> Para o concorrente entregar este preço tendo {engenhariaReversa.margem_media_setor_pct}% de lucro padrão do setor, o produto custa-lhe cerca de <strong>{formatToBRL(custoPresumidoConcorrente)}</strong>. Este é o número que você tem de bater.
              </p>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: A Sua Estratégia */}
        <div className="p-6 md:p-8 flex flex-col relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 to-transparent pointer-events-none" />
          
          <div className="flex flex-col flex-1 relative z-10">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Target className="w-5 h-5 text-emerald-400" /> Meta do Seu Fornecedor
            </h4>

            {/* SELETOR DE ESTRATÉGIA (ZERO-CLICK) */}
            <div className="flex bg-slate-800 rounded-xl p-1 mb-8">
              {(['CONSERVADOR', 'SNIPER', 'KAMIKAZE'] as const).map((est) => (
                <button
                  key={est}
                  onClick={() => setEstrategia(est)}
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                    estrategia === est 
                      ? est === 'KAMIKAZE' ? 'bg-red-500 text-white shadow-lg' : 'bg-violet-600 text-white shadow-lg' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>

            {/* O ALVO A BATER */}
            <div className="flex-1 flex flex-col justify-center items-center text-center space-y-2 mb-8">
              <p className="text-slate-400 text-sm font-medium">Para vencer com {margemSugerida.toFixed(1)}% de margem, o seu custo total deve ser de no máximo:</p>
              <div className={`text-5xl md:text-6xl font-black tracking-tighter ${estrategia === 'KAMIKAZE' ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatToBRL(nossaMetaCusto)}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800 w-full justify-center">
                <div className="text-center">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-0.5">O Seu Lance Final</p>
                  <p className="text-lg font-bold text-white">{formatToBRL(nossoLanceSugerido)}</p>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div className="text-center">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-0.5">Lucro Limpo</p>
                  <p className="text-lg font-bold text-white">{formatToBRL(lucroProjetado)}</p>
                </div>
              </div>
            </div>

            <button className="w-full py-4 rounded-xl bg-white text-slate-900 font-black uppercase tracking-wide hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              Enviar Meta para Compras / Fornecedores
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BawziShadowSimulator;