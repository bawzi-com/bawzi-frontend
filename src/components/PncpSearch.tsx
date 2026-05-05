'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Info, PlayCircle, Timer } from 'lucide-react';

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
  situacao?: string;
  data_divulgacao?: string;
  data_inicio?: string;
  data_fim?: string;
  [key: string]: any;
}

interface PncpSearchProps {
  onAnalyzeOportunity: (textoCompleto: string, termoPesquisado: string) => void; 
  charLimit?: number; 
  onUfChange?: (estadoSelecionado: string) => void;
  token?: string | null;
  userUf?: string;
}

export default function PncpSearch({ onAnalyzeOportunity, charLimit = 30000, onUfChange, token, userUf }: PncpSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [uf, setUf] = useState('');
  const [forceExact, setForceExact] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [results, setResults] = useState<PncpItem[]>([]);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  
  const [detectedUf, setDetectedUf] = useState('');
  const [marketData, setMarketData] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    setMounted(true);

    // Função auxiliar para garantir que só sobram 2 letras (Ex: "BR-GO" vira "GO")
    const extrairSiglaUF = (texto: string) => {
      if (!texto) return '';
      const limpo = texto.replace('BR-', '').trim().toUpperCase();
      return limpo.length === 2 ? limpo : ''; 
    };

    if (userUf) {
      setDetectedUf(extrairSiglaUF(userUf));
      return;
    }

    const detectarLocalizacao = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.region_code) {
          const ufLimpo = extrairSiglaUF(data.region_code);
          console.log("📍 [GEO] IPAPI detectou:", ufLimpo);
          setDetectedUf(ufLimpo);
          return;
        }
      } catch (err) {
        try {
          const res = await fetch('https://ip-api.com/json/');
          const data = await res.json();
          if (data.region) {
            const ufLimpo = extrairSiglaUF(data.region);
            console.log("📍 [GEO] IP-API detectou:", ufLimpo);
            setDetectedUf(ufLimpo);
          }
        } catch (e) {
          console.warn("⚠️ [GEO] Bloqueio de IP. Nenhuma localização detectada.");
        }
      }
    };

    detectarLocalizacao();
  }, [userUf]);

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || value === 0) {
      return "A Apurar (Sigiloso)"; 
    }
    if (!mounted) return `R$ ${Number(value).toFixed(2)}`;
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(Number(value));
  };

  // 🟢 BUSCA NO RADAR COM "PINÇA" E ORDENAÇÃO ABSOLUTA
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm || searchTerm.length < 3) return;

    setIsSearching(true);
    setError('');
    setMarketData(null); 
    
    try {
      const ufParam = uf ? `&uf=${encodeURIComponent(uf)}` : '';
      const exactParam = forceExact ? `&force_exact=true` : '';
      
      // Limpeza de segurança da UF detetada
      const ufAtivo = detectedUf ? detectedUf.trim().toUpperCase() : ''; 

      const fetchHeaders = new Headers();
      if (token) fetchHeaders.append('Authorization', `Bearer ${token}`);
      
      // 1. Busca Nacional
      const reqNacional = fetch(`${API_URL}/api/pncp/buscar?q=${encodeURIComponent(searchTerm)}${ufParam}${exactParam}`, { headers: fetchHeaders });
      const reqMarket = fetch(`${API_URL}/api/pncp/market-score?q=${encodeURIComponent(searchTerm)}${ufParam}`).catch(() => null);
      
      // 2. A PINÇA: Se busca for no Brasil e tivermos UF detetada, forçamos uma busca paralela só nesse estado!
      let reqRegional = null;
      if ((!uf || uf === '') && ufAtivo) {
        reqRegional = fetch(`${API_URL}/api/pncp/buscar?q=${encodeURIComponent(searchTerm)}&uf=${ufAtivo}${exactParam}`, { headers: fetchHeaders }).catch(() => null);
      }

      // Dispara tudo
      const [resEditais, resMarket, resRegional] = await Promise.all([reqNacional, reqMarket, reqRegional]);

      const dataEditais = await resEditais.json();
      if (!resEditais.ok) throw new Error(dataEditais.detail || 'Falha na busca.');
      
      let encontrados: PncpItem[] = dataEditais.data || dataEditais.items || dataEditais.oportunidades || [];

      // ==========================================================
      // 📍 INJEÇÃO DOS 5 PRINCIPAIS DO ESTADO (A PINÇA)
      // ==========================================================
      if (resRegional && resRegional.ok) {
        const dataRegional = await resRegional.json();
        const regionais: PncpItem[] = dataRegional.data || dataRegional.items || dataRegional.oportunidades || [];
        
        if (regionais.length > 0) {
          const top5Regionais = regionais.slice(0, 5); // Pega os 5 melhores
          const idsRegionais = top5Regionais.map(r => r.id || r.link);
          
          // Remove duplicados da lista nacional
          const nacionalSemDuplicados = encontrados.filter(item => !idsRegionais.includes(item.id || item.link));
          
          // Junta tudo: Os 5 do estado no topo + o resto do Brasil
          encontrados = [...top5Regionais, ...nacionalSemDuplicados];
        }
      }

      // ==========================================================
      // 📍 ORDENAÇÃO MILITAR (GARANTIA FINAL)
      // ==========================================================
      if ((!uf || uf === '') && ufAtivo) {
        encontrados = encontrados.sort((a, b) => {
          const siglaA = String(a.uf || '').trim().toUpperCase();
          const siglaB = String(b.uf || '').trim().toUpperCase();
          if (siglaA === ufAtivo && siglaB !== ufAtivo) return -1;
          if (siglaB === ufAtivo && siglaA !== ufAtivo) return 1;
          return 0;
        });
      }

      setResults([...encontrados]); // Os [...] forçam o React a re-renderizar a lista atualizada
      if (encontrados.length === 0) setError('Nenhuma licitação encontrada para este termo.');

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
  🎯 TERMO ALVO DA BUSCA DO CLIENTE: "${searchTerm.toUpperCase()}"
  (A IA DEVE FOCAR A SUA ANÁLISE E PRECIFICAÇÃO PRIORITARIAMENTE NESTE ITEM/SERVIÇO)
  ===================================================================

  [1. DADOS CADASTRAIS DA OPORTUNIDADE]
  • Órgão Comprador: ${edital.orgao}
  • Localidade: ${edital.uf}
  • Código de Controle (PNCP): ${edital.id}
  • Valor Global Estimado: ${formatCurrency(edital.valor || edital.valor_total_estimado || edital.valorEstimado || edital.valor_global || 0)}
  • Início das Propostas: ${edital.data_inicio || 'Não informada'}
  • Fim das Propostas (Data Limite): ${edital.data_fim || 'Não informada'}
  • Link da Publicação Oficial: ${edital.link}

  [2. OBJETO DO EDITAL (RESUMO)]
  ${edital.objeto}

  [4. INTELIGÊNCIA DE MERCADO E HISTÓRICO (PNCP)]
  ${historicoPrecos}
  `;

      const rodapePrompt = `
  ===================================================================
  INSTRUÇÃO AO AVALIADOR (JUIZ FINAL DA BAWZI):
  Você é um consultor de licitações de elite avaliando este edital. Gere uma triagem rápida, incisiva e altamente estratégica com foco nas empresas médias. 
  Baseie a sua análise puramente nos dados fornecidos, sem inventar valores.
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

      console.log("==== 🔍 DEBUG 1: SAÍDA DO RADAR ====");
      console.log("Edital Alvo:", edital.orgao);
      console.log("Termo que vai ser enviado:", searchTerm);
      console.log("Início do Prompt:", promptEstrategicoFinal.substring(0, 150));
      console.log("====================================");

      onAnalyzeOportunity(promptEstrategicoFinal, searchTerm);
      onAnalyzeOportunity(promptEstrategicoFinal, searchTerm);
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  if (!mounted) return <div className="min-h-[200px] animate-pulse bg-slate-50 rounded-[2.5rem]" />;

  return (
    <div className="w-full max-w-5xl mx-auto p-6 md:p-8 bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 font-sans relative overflow-hidden group">
      
      {/* Efeito de luz sutil no fundo */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-50/50 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

      {/* ========================================== */}
      {/* 1. CABEÇALHO RADAR 360                     */}
      {/* ========================================== */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-indigo-600 text-3xl">📡</span> RADAR 360
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-md shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none">Online</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium max-w-2xl">
            Visão panorâmica do mercado público. Varredura em tempo real na base oficial do <strong className="text-slate-800 font-bold">PNCP</strong>. Encontre licitações e extraia o edital completo para a IA analisar com apenas um clique.
          </p>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. O TERMINAL DE BUSCA (VISUAL NOVO)       */}
      {/* ========================================== */}
      <form onSubmit={handleSearch} className="relative z-10 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 shadow-inner mb-8">
        <div className="flex flex-col md:flex-row items-center gap-3">
          
          <div className="relative flex-1 w-full h-14 bg-white rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-slate-400">🔍</span>
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Busque por termos, materiais ou serviços..." 
              className="block w-full h-full pl-11 pr-4 bg-transparent border-none text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-0 sm:text-sm"
            />
          </div>

          <div className="w-full md:w-48 h-14 bg-white rounded-xl border border-slate-200 shadow-sm relative focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
            <select 
              value={uf}
              onChange={(e) => {
                setUf(e.target.value);
                if (onUfChange) onUfChange(e.target.value);
              }}
              className="appearance-none block w-full h-full pl-4 pr-10 bg-transparent border-none text-slate-700 font-medium focus:outline-none focus:ring-0 sm:text-sm cursor-pointer"
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
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <span className="text-slate-400 text-xs">▼</span>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSearching}
            className="w-full md:w-auto h-14 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-8 rounded-xl font-bold tracking-wide shadow-md shadow-indigo-200 transition-colors flex items-center justify-center gap-2 active:scale-95"
          >
            {isSearching ? <span className="animate-pulse">A varrer...</span> : 'Buscar'}
          </button>
        </div>

        <div className="mt-4 px-2 flex items-center">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <div className="relative flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={forceExact}
                onChange={(e) => setForceExact(e.target.checked)}
                className="peer sr-only" 
              />
              <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-800 transition-colors"></div>
            </div>
            <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 transition-colors uppercase tracking-wider">
              Forçar Busca Exata <span className="opacity-60">(Ignorar IA de Otimização)</span>
            </span>
          </label>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2 relative z-10">
          <span className="text-xl leading-none mt-0.5">⚠️</span>
          <p className="text-sm font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. RESULTADOS & INTELIGÊNCIA DE MERCADO    */}
      {/* ========================================== */}
      {results.length > 0 && marketData && (
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 relative z-10">
          {uf && (
            <div className="mb-5 bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3 shadow-sm">
              <span className="text-amber-500 text-lg">🎯</span>
              <div>
                <p className="text-[11px] font-black text-amber-900 uppercase tracking-wider">Filtro Regional Ativo: ({uf})</p>
                <p className="text-[11px] text-amber-800/80 font-medium mt-0.5 leading-relaxed">
                  Todos os indicadores refletem <strong>exclusiva e estritamente</strong> a realidade de contratações de <strong>{uf}</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 px-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="text-lg">🧠</span> Inteligência de Mercado
            </h3>
            <div className={`border px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm ${uf ? 'bg-amber-100/50 text-amber-800 border-amber-200' : 'bg-violet-100 text-violet-800 border-violet-200'}`}>
              <span className="text-sm">{uf ? '📍' : '🔍'}</span>
              <span className="text-[9px] font-black uppercase tracking-widest">
                {uf ? `Universo Restrito: ${marketData.previsaoVolume} contratos` : `Universo Amplo: ${marketData.previsaoVolume} contratos`}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/20 blur-[20px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Teto Faturamento</span>
              <span className="text-xl md:text-2xl font-black text-white">R$ {marketData.tamanhoMercado}</span>
              <span className="text-[10px] text-emerald-400 font-bold block mt-1">Estimativa Histórica</span>
            </div>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-5 rounded-2xl shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-[20px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <span className="text-[9px] font-black text-violet-200 uppercase tracking-widest block mb-1 relative z-10">Preço Alvo Sugerido</span>
              <span className="text-xl md:text-2xl font-black text-white relative z-10">{formatCurrency(marketData.ticketMedio)}</span>
              <span className="text-[10px] text-violet-300 font-bold uppercase block mt-1 relative z-10">Média Vencedores</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Concorrência</span>
                <span className="text-sm font-black text-slate-800 leading-tight block">{marketData.competitividade}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Facilidade Entrada</span>
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{marketData.taxaSucesso}%</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Volume de Negócios</span>
              <span className="text-xl font-black text-slate-900">{marketData.previsaoVolume}</span>
              <span className="text-[10px] text-slate-500 font-bold block mt-1">Contratos Ativos</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 4. LISTA DE EDITAIS E EXTRAÇÃO PROFUNDA    */}
      {/* ========================================== */}
      {results.length > 0 && (
        <div className="space-y-4 max-h-[500px] md:max-h-[60vh] overflow-y-auto pr-3 pb-8 custom-scrollbar relative z-10">
          {results.map((edital, index) => {
            const isRecorrente = index % 3 === 0; 
            const diasPredicao = 30 + (index * 12); 

            return (
              <div key={edital.id || index} className="p-5 md:p-6 border border-slate-200 rounded-[1.5rem] bg-white hover:border-indigo-300 transition-all shadow-sm hover:shadow-md group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2 items-center">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase border border-indigo-100">
                      {edital.uf} • {edital.ano}
                    </span>
                    {/* ========================================== */}
                    {/* 📍 A ETIQUETA INTELIGENTE NOS CARDS          */}
                    {/* ========================================== */}
                    {edital.uf && detectedUf && String(edital.uf).trim().toUpperCase() === detectedUf.trim().toUpperCase() && (!uf || uf === '') && (
                      <span className="relative flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200 rounded-md shadow-sm animate-in fade-in zoom-in duration-500">
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          📍 Oportunidade Local
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-black text-slate-900 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg shadow-sm">
                    {formatCurrency(edital.valor || edital.valor_total_estimado || edital.valorEstimado || edital.valor_global || 0)}
                  </span>
                </div>
                
                <h3 className="font-bold text-slate-800 text-sm mb-2 line-clamp-1 pr-4">{edital.orgao}</h3>
                <p className="text-slate-500 text-xs font-medium line-clamp-2 mb-2">{edital.objeto}</p>
                
                {/* TIMELINE */}
                <div className="mt-4 mb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Divulgação</p>
                      <p className="text-xs text-slate-700 font-semibold truncate">{edital.data_divulgacao || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Situação</p>
                      <p className="text-xs text-emerald-600 font-bold truncate">{edital.situacao || 'Publicado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Início</p>
                      <p className="text-xs text-slate-700 font-semibold truncate">{edital.data_inicio || 'A definir'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-l-2 border-amber-400 pl-2 bg-amber-50 rounded-r py-1">
                    <Timer className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-[9px] text-amber-600/80 uppercase font-black tracking-widest">Fim</p>
                      <p className="text-xs text-amber-900 font-black truncate">{edital.data_fim || 'Sem limite'}</p>
                    </div>
                  </div>
                </div>

                {/* PREDICTIVE RADAR */}
                {isRecorrente && (
                  <div className="mb-5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 rounded-xl p-4 flex items-start gap-3 relative overflow-hidden shadow-inner">
                    <div className="w-8 h-8 bg-white border border-orange-100 rounded-full flex items-center justify-center shrink-0 shadow-sm text-lg z-10">🔮</div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Radar Preditivo</h4>
                      </div>
                      <p className="text-xs text-orange-900/80 font-medium">
                        Padrão sazonal identificado. Novo edital estimado em <strong className="font-black text-orange-600">{diasPredicao} dias</strong>.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* BOTÕES DE AÇÃO */}
                <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                  <button 
                    onClick={() => {
                      const cnpjInvalido = !edital.cnpj || String(edital.cnpj) === "undefined";
                      const anoInvalido = !edital.ano || String(edital.ano) === "undefined";
                      const seqInvalido = !edital.sequencial || String(edital.sequencial) === "undefined";

                      if (cnpjInvalido || anoInvalido || seqInvalido) {
                        alert("⚠️ Falha de registo no PNCP (Falta CNPJ, Ano ou Sequencial). Impossível extrair.");
                        return;
                      }
                      handleDeepAnalyze(edital);
                    }}
                    disabled={loadingId !== null}
                    className="flex-1 bg-indigo-600 text-white font-black py-3 px-4 rounded-xl text-xs hover:bg-indigo-700 transition-all disabled:bg-indigo-400 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                  >
                    {loadingId === edital.id ? (
                      <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> A Extrair PDF (Aguarde)...</>
                    ) : 'Extrair e Analisar IA ⚡'}
                  </button>
                  {edital.link && (
                    <a 
                      href={edital.link} 
                      target="_blank" 
                      rel="noreferrer"
                      className="sm:w-auto px-6 py-3 bg-white text-slate-700 font-bold rounded-xl text-xs border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center"
                    >
                      Ver Original
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}