import React, { useState } from 'react';
import { ShieldAlert, Building2, Briefcase, DollarSign, ChevronDown, ChevronUp, Globe, MapPin } from 'lucide-react';

export interface ConcorrenteProvavel {
  empresa: string;
  vitorias: number;
  forca: string;
  probabilidade: number;
  porte?: string;
  capital_social?: string;
  cnae?: string;
}

interface ThreatRadarProps {
  concorrentesGlobais?: ConcorrenteProvavel[];
  concorrentesRegionais?: ConcorrenteProvavel[];
  ufEdital?: string;
}

const ThreatRadar: React.FC<ThreatRadarProps> = ({ 
  concorrentesGlobais = [], 
  concorrentesRegionais = [], 
  ufEdital = "Local" 
}) => {
  // Controle de Aba (BR vs UF)
  const [activeTab, setActiveTab] = useState<'GLOBAL' | 'REGIONAL'>('GLOBAL');
  // Controle de Accordion (Qual card está aberto)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // A lista que vai ser renderizada depende da aba selecionada
  const concorrentes = activeTab === 'GLOBAL' ? concorrentesGlobais : concorrentesRegionais;

  const toggleCard = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const getBadgeColor = (forca?: string) => {
    switch (forca?.toUpperCase()) {
      case 'ALTA': return 'bg-red-100 text-red-700 border-red-200';
      case 'MÉDIA': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'BAIXA': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* 🟢 CABEÇALHO COM ABAS (TABS) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          Radar de Ameaças
        </h3>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-max">
          <button 
            onClick={() => { setActiveTab('GLOBAL'); setExpandedIndex(null); }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'GLOBAL' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Globe className="w-4 h-4" /> Global (BR)
          </button>
          <button 
            onClick={() => { setActiveTab('REGIONAL'); setExpandedIndex(null); }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'REGIONAL' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <MapPin className="w-4 h-4" /> Regional ({ufEdital})
          </button>
        </div>
      </div>

      {/* 🔴 ESTADO VAZIO (Sem histórico) */}
      {(!concorrentes || concorrentes.length === 0) && (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center animate-in fade-in">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl shadow-sm border border-slate-100 mb-3">👻</div>
          <h4 className="text-sm font-bold text-slate-700">Mercado Inexplorado ou em Sigilo</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {activeTab === 'REGIONAL' 
              ? `Não encontrámos vencedores frequentes para este produto na região de ${ufEdital} recentemente.` 
              : `Não há histórico nacional público suficiente para mapear os tubarões deste edital.`}
          </p>
        </div>
      )}

      {/* 🟢 LISTA DE CONCORRENTES */}
      {concorrentes && concorrentes.length > 0 && (
        <div className="space-y-3 animate-in fade-in duration-300">
          {concorrentes.map((empresa, index) => {
            const isExpanded = expandedIndex === index;

            return (
              <div 
                key={index} 
                className={`border rounded-xl transition-all duration-200 shadow-sm overflow-hidden ${isExpanded ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300 bg-white'}`}
              >
                {/* Linha Clicável */}
                <div 
                  className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleCard(index)}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm md:text-base">
                      {index + 1}. {empresa.empresa}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      {empresa.vitorias} vitórias confirmadas {activeTab === 'REGIONAL' ? `em ${ufEdital}` : 'no Brasil'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-md border uppercase tracking-widest ${getBadgeColor(empresa.forca)}`}>
                      Força {empresa.forca} ({(empresa.probabilidade * 100).toFixed(0)}%)
                    </span>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {/* Dados da Receita (BrasilAPI) */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-indigo-500 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Porte da Empresa</p>
                        <p className="text-sm text-slate-800 font-bold mt-0.5">{empresa.porte || "Não informado"}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <DollarSign className="w-5 h-5 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital Social</p>
                        <p className="text-sm text-slate-800 font-bold mt-0.5">{empresa.capital_social || "?"}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 md:col-span-2">
                      <Briefcase className="w-5 h-5 text-amber-500 mt-0.5 min-w-[20px]" />
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CNAE Principal</p>
                        <p className="text-sm text-slate-800 font-bold mt-0.5 leading-relaxed">
                          {empresa.cnae || "CNAE não localizado"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ThreatRadar;