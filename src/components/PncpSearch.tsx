'use client';

import React, { useState, useEffect } from 'react';

interface PncpItem {
  id: string;
  cnpj: string;
  ano: number;
  sequencial: number;
  orgao: string;
  uf: string;
  objeto: string;
  valor?: number; 
  valor_total_estimado?: number; 
  valorEstimado?: number;        
  valor_global?: number;         
  link: string;
  [key: string]: any;
}

interface PncpSearchProps {
  onAnalyzeOportunity: (textoCompleto: string) => void;
  charLimit?: number; 
}

export default function PncpSearch({ onAnalyzeOportunity, charLimit = 30000 }: PncpSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [uf, setUf] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [results, setResults] = useState<PncpItem[]>([]);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  
  // 🟢 ESTADO PARA OS DADOS REAIS DE MERCADO
  const [marketData, setMarketData] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || value === 0) {
      return "A Apurar (SRP / Sigiloso)"; 
    }
    if (!mounted) return `R$ ${Number(value).toFixed(2)}`;
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(Number(value));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm || searchTerm.length < 3) return;

    setIsSearching(true);
    setError('');
    setMarketData(null); // Limpa o dashboard anterior
    
    try {
      // 🟢 FAZEMOS DUAS BUSCAS SIMULTÂNEAS AO SEU BACKEND
      const ufParam = uf ? `&uf=${encodeURIComponent(uf)}` : '';

      const [resEditais, resMarket] = await Promise.all([
        fetch(`${API_URL}/api/pncp/buscar?q=${encodeURIComponent(searchTerm)}${ufParam}`),
        fetch(`${API_URL}/api/pncp/market-score?q=${encodeURIComponent(searchTerm)}${ufParam}`).catch(() => null) 
      ]);

      const finalURL = `${API_URL}/api/pncp/buscar?q=${encodeURIComponent(searchTerm)}${ufParam}`;

      console.log("Chamando URL:", finalURL);

      const dataEditais = await resEditais.json();
      
      if (!resEditais.ok) throw new Error(dataEditais.detail || 'Falha na busca.');
      
      setResults(dataEditais.data || []);
      if (dataEditais.data?.length === 0) setError('Nenhuma licitação encontrada para este termo.');

      // 🟢 INJETA OS DADOS REAIS SE A API DEVOLVER SUCESSO
      if (resMarket && resMarket.ok) {
         const marketJson = await resMarket.json();
         setMarketData(marketJson);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeepAnalyze = async (edital: PncpItem) => {
    setLoadingId(edital.id);
    try {
      const [resTexto, resMedia] = await Promise.all([
        fetch(`${API_URL}/api/pncp/texto-completo?cnpj=${edital.cnpj}&ano=${edital.ano}&seq=${edital.sequencial}`),
        fetch(`${API_URL}/api/pncp/media-precos?q=${encodeURIComponent(searchTerm)}${uf ? `&uf=${uf}` : ''}`)
      ]);

      const dataTexto = await resTexto.json();
      const dataMedia = await resMedia.json();

      if (!resTexto.ok) throw new Error("Falha ao carregar itens detalhados.");

      let detalhamentoTecnico = dataTexto.texto || "Detalhes técnicos não fornecidos pela API.";
      const historicoPrecos = dataMedia.texto || "Sem histórico recente para estabelecer média.";

      const cabecalhoPrompt = `
DOCUMENTO OFICIAL PARA ANÁLISE DE RISCO E ESTRATÉGIA DE LICITAÇÃO
===================================================================

[1. DADOS CADASTRAIS DA OPORTUNIDADE]
• Órgão Comprador: ${edital.orgao}
• Localidade: ${edital.uf}
• Código de Controle (PNCP): ${edital.id}
• Valor Global Estimado: ${formatCurrency(edital.valor || edital.valor_total_estimado || edital.valor_global || 0)}
• Link da Publicação Oficial: ${edital.link}

[2. OBJETO DO EDITAL (RESUMO)]
${edital.objeto}

[4. INTELIGÊNCIA DE MERCADO E HISTÓRICO (PNCP)]
${historicoPrecos}
`;

      const rodapePrompt = `
===================================================================
INSTRUÇÃO AO AVALIADOR (JUIZ FINAL DA BAWZI):
Você é um consultor de licitações de elite avaliando este edital. Gere uma triagem rápida, incisiva e altamente estratégica com foco nas empresas médias. Responda incluindo:
1. Veredicto Claro (Go / No-Go).
2. Riscos Ocultos ou "Pegadinhas" no escopo.
3. PREVISÃO DE PREÇO VENCEDOR (Pricing Intelligence): Utilize os dados da "Inteligência de Mercado" acima para atuar como uma bússola financeira, indicando qual seria uma faixa de deságio competitivo para vencer este pregão sem prejuízo.
`;

      const espacoOcupado = cabecalhoPrompt.length + rodapePrompt.length;
      const espacoLivre = charLimit - espacoOcupado - 500; 

      let conteudoDetalhamentoFinal = "";
      if (detalhamentoTecnico.length > espacoLivre && espacoLivre > 0) {
        conteudoDetalhamentoFinal = `
[3. DETALHAMENTO TÉCNICO E REGRAS]
${detalhamentoTecnico.substring(0, espacoLivre)}

[⚠️ ALERTA DO SISTEMA - DADOS TRUNCADOS]
O detalhamento técnico acima foi cortado pois excedeu o limite do plano atual do utilizador (${charLimit.toLocaleString()} caracteres). Baseie a sua análise nesta amostragem e, no seu Veredito Financeiro, informe ao utilizador que ele precisa fazer o upgrade (Plano Superior) para que a IA analise a totalidade dos itens e documentos desta licitação.
`;
      } else {
        conteudoDetalhamentoFinal = `
[3. DETALHAMENTO TÉCNICO E REGRAS]
${detalhamentoTecnico}
`;
      }

      const promptEstrategicoFinal = cabecalhoPrompt + conteudoDetalhamentoFinal + rodapePrompt;
      
      // 🟢 O NOSSO DETETIVE (Adicione esta linha)
      console.log("TEXTO QUE VAI PARA A IA:\n", promptEstrategicoFinal);

      onAnalyzeOportunity(promptEstrategicoFinal);
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  if (!mounted) return <div className="min-h-[200px] animate-pulse bg-slate-50 rounded-[2.5rem]" />;

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/20 to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Radar PNCP</h2>
            <p className="text-sm text-slate-500 font-medium">Busca em tempo real no Governo Federal.</p>
          </div>
          <div className="bg-emerald-100 text-emerald-700 font-black px-3 py-1 rounded-lg text-[10px] uppercase border border-emerald-200">
            Online
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-8">
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ex: Livro, Notebook, Limpeza..." 
            className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-violet-500 outline-none transition-all font-semibold text-slate-700"
          />
          
          {/* 🟢 DROPDOWN DE ESTADO (UF) */}
          <select
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-violet-500 outline-none transition-all font-bold text-slate-600 cursor-pointer appearance-none min-w-[140px]"
          >
            <option value="">Brasil (Todos)</option>
            <option value="AC">Acre</option>
            <option value="AL">Alagoas</option>
            <option value="AP">Amapá</option>
            <option value="AM">Amazonas</option>
            <option value="BA">Bahia</option>
            <option value="CE">Ceará</option>
            <option value="DF">Distrito Federal</option>
            <option value="ES">Espírito Santo</option>
            <option value="GO">Goiás</option>
            <option value="MA">Maranhão</option>
            <option value="MT">Mato Grosso</option>
            <option value="MS">Mato Grosso do Sul</option>
            <option value="MG">Minas Gerais</option>
            <option value="PA">Pará</option>
            <option value="PB">Paraíba</option>
            <option value="PR">Paraná</option>
            <option value="PE">Pernambuco</option>
            <option value="PI">Piauí</option>
            <option value="RJ">Rio de Janeiro</option>
            <option value="RN">Rio Grande do Norte</option>
            <option value="RS">Rio Grande do Sul</option>
            <option value="RO">Rondônia</option>
            <option value="RR">Roraima</option>
            <option value="SC">Santa Catarina</option>
            <option value="SP">São Paulo</option>
            <option value="SE">Sergipe</option>
            <option value="TO">Tocantins</option>
          </select>

          <button 
            type="submit" 
            disabled={isSearching}
            className="bg-slate-950 text-white px-8 py-4 sm:py-0 rounded-2xl font-black hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
          >
            {isSearching ? '...' : 'Buscar'}
          </button>
        </form>

        {error && <div className="mb-6 p-4 bg-amber-50 text-amber-700 rounded-2xl text-xs font-bold border border-amber-100">{error}</div>}

        {/* 🔥 SCORE DE MERCADO PÚBLICO (TAM/SAM/SOM DO GOVERNO) 🔥 */}
        {results.length > 0 && marketData && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
              <span className="text-lg">🧠</span> Score de Mercado Público: "{searchTerm}"
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Card 1: Tamanho do Mercado */}
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl shadow-slate-900/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/20 blur-[20px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tamanho (Gov TAM)</span>
                <span className="text-xl md:text-2xl font-black text-white">R$ {marketData.tamanhoMercado}</span>
                <span className="text-[10px] text-emerald-400 font-bold block mt-1">Estimativa Histórica</span>
              </div>

              {/* Card 2: Volume Previsto & Amostra */}
              <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-5 rounded-2xl shadow-xl shadow-violet-600/20 relative overflow-hidden group">
                {/* Efeito de brilho de fundo */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-[20px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                
                <span className="text-[9px] font-black text-violet-200 uppercase tracking-widest block mb-1 relative z-10">
                  Volume Histórico (PNCP)
                </span>
                
                <div className="flex items-baseline gap-1.5 relative z-10">
                  <span className="text-xl md:text-2xl font-black text-white">
                    {marketData.previsaoVolume}
                  </span>
                  <span className="text-[10px] text-violet-300 font-bold uppercase">
                    Contratos
                  </span>
                </div>
                
                {/* A "Badge" de Transparência da IA */}
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-1 bg-black/20 rounded-md border border-white/10 relative z-10">
                  <span className="text-[9px] font-black text-white/90 uppercase tracking-wider">
                    Amostra: Últimos 50
                  </span>
                </div>
              </div>

              {/* Card 3: Competitividade & Taxa */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Competitividade</span>
                  <span className="text-sm font-black text-slate-800 leading-tight block">{marketData.competitividade}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Taxa Sucesso</span>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{marketData.taxaSucesso}%</span>
                </div>
              </div>

              {/* Card 4: Ticket Médio */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ticket Médio (Gov SOM)</span>
                <span className="text-xl font-black text-slate-900">{formatCurrency(marketData.ticketMedio)}</span>
                <span className="text-[10px] text-slate-500 font-bold block mt-1">Por Contrato</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {results.map((edital, index) => {
            // Mantemos o mock visual preditivo APENAS nos cards da lista para demonstrar a ideia
            const isRecorrente = index % 3 === 0; 
            const diasPredicao = 30 + (index * 12); 

            return (
              <div key={edital.id} className="p-6 border border-slate-100 rounded-[1.5rem] bg-slate-50/30 hover:bg-white transition-all hover:shadow-lg group">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-1 rounded-md uppercase border border-violet-100">
                    {edital.uf} • {edital.ano}
                  </span>
                  <span className="text-sm font-black text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm">
                    {formatCurrency(edital.valor || edital.valor_total_estimado || edital.valorEstimado || edital.valor_global || 0)}
                  </span>
                </div>
                
                <h3 className="font-bold text-slate-800 text-sm mb-2 line-clamp-1 pr-4">{edital.orgao}</h3>
                <p className="text-slate-500 text-xs font-medium line-clamp-2 mb-5">{edital.objeto}</p>
                
                {/* RADAR PREDITIVO (MOCK VISUAL) */}
                {isRecorrente && (
                  <div className="mb-5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden group/preditivo shadow-inner">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 blur-[20px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="w-8 h-8 bg-white border border-orange-100 rounded-full flex items-center justify-center shrink-0 shadow-sm text-lg z-10">
                      🔮
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Radar Preditivo de Compras</h4>
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[8px] font-black rounded uppercase tracking-widest animate-pulse border border-orange-200/50">
                          Padrão Identificado
                        </span>
                      </div>
                      <p className="text-xs text-orange-900/80 font-medium leading-relaxed mt-1.5">
                        Este órgão tem um padrão sazonal de compra para este objeto. A nossa IA estima a abertura de um novo edital nos próximos <strong className="font-black text-orange-600 bg-white px-1 py-0.5 rounded shadow-sm mx-0.5">{diasPredicao} dias</strong>.
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                  <button 
                    onClick={() => handleDeepAnalyze(edital)}
                    disabled={loadingId !== null}
                    className="flex-1 bg-violet-600 text-white font-black py-3 px-4 rounded-xl text-xs hover:bg-violet-700 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md hover:shadow-violet-600/30 flex items-center justify-center gap-2"
                  >
                    {loadingId === edital.id ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        A Extrair Dados...
                      </>
                    ) : '🧠 Análise Profunda'}
                  </button>
                  {edital.link && (
                    <a 
                      href={edital.link} 
                      target="_blank" 
                      rel="noreferrer"
                      className="sm:w-auto px-4 py-3 bg-white text-slate-700 font-bold rounded-xl text-xs border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center whitespace-nowrap"
                    >
                      Ler Original
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}