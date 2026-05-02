import React, { useState } from 'react';

// Mock das tipagens que virão do nosso novo Backend Python
interface ShadowSimulatorProps {
  valorEstimadoOrgao?: number;
  nomeObjeto?: string;
  desagioPreditivoOrgao?: number;
  nivelAmeaca?: string;
  perfilVencedor?: string;
}

const BawziShadowSimulator: React.FC<ShadowSimulatorProps> = ({ 
  valorEstimadoOrgao = 54649.99, 
  nomeObjeto = "este objeto",
  desagioPreditivoOrgao = 18.5, // Recebe do pai em vez de ser mockado
  nivelAmeaca = "MODERADO",     // Recebe do pai
  perfilVencedor = "Estratégico"// Recebe do pai
}) => {
  const [custoOperacional, setCustoOperacional] = useState<number>(38000.00);
  
  // ==========================================
  // MOTOR MATEMÁTICO (Frontend UI)
  // ==========================================
  // 1. O Lance Sniper (Recomendação estatística para ganhar)
  const lanceSniper = valorEstimadoOrgao * (1 - (desagioPreditivoOrgao / 100));
  
  // 2. A Realidade do Utilizador
  const lucroProjetado = lanceSniper - custoOperacional;
  const margemLucroPercentual = (lucroProjetado / lanceSniper) * 100;
  
  // 3. Termómetro de Viabilidade
  const isPrejuizo = lucroProjetado <= 0;
  const isMargemApertada = margemLucroPercentual > 0 && margemLucroPercentual < 10;

  // Formatação de Moeda BRL
  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden font-sans">
      
      {/* HEADER: TÍTULO SHADOW */}
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚔️</span>
          <div>
            <h3 className="text-white font-black text-lg tracking-tight uppercase">Simulador Shadow 2.0</h3>
            <p className="text-slate-400 text-xs font-medium">Motor Preditivo de Licitações (Bottom-Up)</p>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-xs font-bold text-emerald-400">
          IA ATIVA
        </div>
      </div>

      <div className="p-6">
        
        {/* ZONA 1: O TABULEIRO (Inteligência do PNCP) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          
          {/* Card: Fator Aperto (Órgão) */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Fator Aperto (Órgão)</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-slate-800">-{desagioPreditivoOrgao}%</span>
              <span className="text-xs text-slate-500 mb-1 pb-0.5">Deságio Médio</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-tight">
              Estatística baseada no histórico de compras deste CNPJ.
            </p>
          </div>

          {/* Card: Radar de Concorrentes */}
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
            <p className="text-xs text-rose-800 font-bold uppercase tracking-wider mb-1">Radar de Ameaça</p>
            <div className="flex items-end gap-2">
              <span className="text-lg font-black text-rose-900 uppercase">{nivelAmeaca}</span>
            </div>
            <p className="text-[11px] text-rose-700 mt-2 leading-tight">
              Tubarões frequentes: <strong>{perfilVencedor}</strong>.
            </p>
          </div>

          {/* Card: Valor Teto */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Teto do Edital</p>
            <div className="flex items-end gap-2">
              <span className="text-lg font-black text-slate-800">{formatBRL(valorEstimadoOrgao)}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-tight">
              Valor máximo aceitável.
            </p>
          </div>
        </div>

        {/* ZONA 2 & 3: A CALCULADORA DE GUERRA (Bottom-Up) */}
        <div className="bg-slate-800 rounded-2xl p-1 shadow-inner">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px">
            
            {/* Esquerda: Custo do Utilizador (Input) */}
            <div className="bg-white rounded-l-[15px] rounded-r-none p-6 md:pr-8">
              <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>1.</span> O seu Chão de Fábrica
              </h4>
              
              <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                Custo Total Operacional (R$)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                <input 
                  type="number" 
                  value={custoOperacional}
                  onChange={(e) => setCustoOperacional(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-lg font-black rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-3">
                Inclua produto, frete, impostos e comissões. <strong className="text-slate-600">Nunca dê um lance abaixo deste valor.</strong>
              </p>
            </div>

            {/* Direita: O Lance Sniper (Output da IA) */}
            <div className="bg-slate-900 rounded-r-[15px] rounded-l-none p-6 relative overflow-hidden">
              {/* Efeito de Fundo */}
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
              
              <h4 className="text-sm font-bold text-emerald-400 mb-4 flex items-center gap-2 relative z-10">
                <span>🎯</span> O Lance Sniper (Recomendado)
              </h4>
              
              <div className="mb-4 relative z-10">
                <span className="text-4xl font-black text-white tracking-tight block">
                  {formatBRL(lanceSniper)}
                </span>
                <span className="text-xs text-slate-400 mt-1 block">
                  Cálculo preditivo p/ vitória ({desagioPreditivoOrgao}% de deságio)
                </span>
              </div>

              {/* Termómetro de Lucro Dinâmico */}
              <div className={`mt-6 p-4 rounded-xl border relative z-10 ${
                  isPrejuizo ? 'bg-rose-950/50 border-rose-800' : 
                  isMargemApertada ? 'bg-amber-950/50 border-amber-800' : 
                  'bg-emerald-950/50 border-emerald-800'
                }`}>
                
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Lucro Líquido Projetado</span>
                  <span className={`text-sm font-black ${isPrejuizo ? 'text-rose-400' : isMargemApertada ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {margemLucroPercentual.toFixed(1)}%
                  </span>
                </div>
                
                <span className={`text-lg font-black ${isPrejuizo ? 'text-rose-400' : 'text-white'}`}>
                  {isPrejuizo ? 'PREJUÍZO!' : formatBRL(lucroProjetado)}
                </span>

                {isPrejuizo && (
                  <p className="text-[10px] text-rose-300 mt-2 leading-tight">
                    Alerta Crítico: O lance necessário para ganhar este pregão não cobre a sua operação. Não entre, ou renegocie com fornecedores.
                  </p>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BawziShadowSimulator;