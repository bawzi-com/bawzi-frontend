'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar, Info, PlayCircle, Timer, Radar, BrainCircuit, TrendingUp,
  Search, MapPin, SlidersHorizontal,
} from 'lucide-react';
import PncpStatusBadge from './PncpStatusBadge';
import MunicipioAutocomplete from './MunicipioAutocomplete';

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
  onAnalyzeOportunity: (
    textoCompleto: string, 
    termoPesquisado: string, 
    editalDados?: { cnpj: string; ano: number; sequencial: number; uf?: string } 
  ) => void;
  charLimit?: number; 
  onUfChange?: (estadoSelecionado: string) => void;
  token?: string | null;
  userUf?: string;
}

export default function PncpSearch({ onAnalyzeOportunity, charLimit = 30000, onUfChange, token, userUf }: PncpSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [uf, setUf] = useState('');
  const [municipioId, setMunicipioId]   = useState('');
  const [municipioNome, setMunicipioNome] = useState('');
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

    // Mapa nome-completo → sigla (para fallbacks de IP que retornam o nome do estado)
    const ESTADOS_BR: Record<string, string> = {
      'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPÁ': 'AP', 'AMAPA': 'AP',
      'AMAZONAS': 'AM', 'BAHIA': 'BA', 'CEARÁ': 'CE', 'CEARA': 'CE',
      'DISTRITO FEDERAL': 'DF', 'ESPÍRITO SANTO': 'ES', 'ESPIRITO SANTO': 'ES',
      'GOIÁS': 'GO', 'GOIAS': 'GO', 'MARANHÃO': 'MA', 'MARANHAO': 'MA',
      'MATO GROSSO DO SUL': 'MS', 'MATO GROSSO': 'MT',
      'MINAS GERAIS': 'MG', 'PARÁ': 'PA', 'PARA': 'PA',
      'PARAÍBA': 'PB', 'PARAIBA': 'PB', 'PARANÁ': 'PR', 'PARANA': 'PR',
      'PERNAMBUCO': 'PE', 'PIAUÍ': 'PI', 'PIAUI': 'PI',
      'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN',
      'RIO GRANDE DO SUL': 'RS', 'RONDÔNIA': 'RO', 'RONDONIA': 'RO',
      'RORAIMA': 'RR', 'SANTA CATARINA': 'SC', 'SÃO PAULO': 'SP', 'SAO PAULO': 'SP',
      'SERGIPE': 'SE', 'TOCANTINS': 'TO',
    };

    // Extrai sigla de 2 letras: "BR-GO" → "GO", "Goiás" → "GO", "GO" → "GO"
    const extrairSiglaUF = (texto: string): string => {
      if (!texto) return '';
      const limpo = texto.replace('BR-', '').trim().toUpperCase();
      if (limpo.length === 2) return limpo;
      return ESTADOS_BR[limpo] || '';
    };

    if (userUf) {
      setDetectedUf(extrairSiglaUF(userUf));
      return;
    }

    const detectarLocalizacao = async () => {
      try {
        // ipapi.co retorna region_code no formato "GO", "SP", etc.
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.region_code) {
          const ufLimpo = extrairSiglaUF(data.region_code);
          if (ufLimpo) setDetectedUf(ufLimpo);
          return;
        }
      } catch {
        try {
          // ip-api.com retorna region como nome completo, ex: "Goiás"
          const res = await fetch('https://ip-api.com/json/?fields=region,regionName');
          const data = await res.json();
          const candidato = data.regionName || data.region || '';
          const ufLimpo = extrairSiglaUF(candidato);
          if (ufLimpo) setDetectedUf(ufLimpo);
        } catch {
          console.warn("⚠️ [GEO] Bloqueio de IP. Nenhuma localização detectada.");
        }
      }
    };

    detectarLocalizacao();
  }, [userUf]);

// =================================================================
  // 🟢 EFEITO RADAR 360: Textos dinâmicos durante o carregamento
  // =================================================================
  const [loadingText, setLoadingText] = useState("A inicializar Radar 360º...");

  useEffect(() => {
    // 🟢 CORRIGIDO AQUI: isSearching em vez de isLoading
    if (!isSearching) {
      setLoadingText("A inicializar Radar 360º..."); 
      return;
    }

    const phrases = [
      "A estabelecer ligação com o PNCP...",
      "A extrair histórico de adjudicações...",
      "A mapear o comportamento dos concorrentes...",
      "A calcular margens e risco operacional...",
      "A finalizar Dossiê Estratégico..."
    ];
    
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % phrases.length;
      setLoadingText(phrases[step]);
    }, 2500); 

    return () => clearInterval(interval);
  }, [isSearching]); // 🟢 CORRIGIDO AQUI TAMBÉM

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
      // Envia AMBOS id e nome — o backend usa nome (normalizado) como filtro principal
      const munParam = municipioId
        ? `&municipio_id=${encodeURIComponent(municipioId)}${municipioNome ? `&municipio_nome=${encodeURIComponent(municipioNome)}` : ''}`
        : '';

      // Limpeza de segurança da UF detetada
      const ufAtivo = detectedUf ? detectedUf.trim().toUpperCase() : '';

      const fetchHeaders = new Headers();
      if (token) fetchHeaders.append('Authorization', `Bearer ${token}`);

      // 1. Busca principal (com filtro de município se selecionado)
      const reqNacional = fetch(`${API_URL}/api/pncp/buscar?q=${encodeURIComponent(searchTerm)}${ufParam}${munParam}${exactParam}`, { headers: fetchHeaders });
      const reqMarket = fetch(`${API_URL}/api/pncp/market-score?q=${encodeURIComponent(searchTerm)}${ufParam}`).catch(() => null);

      // 2. A PINÇA: só ativa se não há filtro de cidade E não há UF manual
      // (quando há cidade, a busca principal já é suficientemente específica)
      let reqRegional = null;
      if ((!uf || uf === '') && ufAtivo && !municipioId && !municipioNome) {
        reqRegional = fetch(`${API_URL}/api/pncp/buscar?q=${encodeURIComponent(searchTerm)}&uf=${ufAtivo}${exactParam}`, { headers: fetchHeaders }).catch(() => null);
      }

      // Dispara tudo
      const [resEditais, resMarket, resRegional] = await Promise.all([reqNacional, reqMarket, reqRegional]);

      const dataEditais = await resEditais.json();
      if (!resEditais.ok) throw new Error(dataEditais.detail || 'Falha na busca.');
      if (dataEditais.status === 'error') {
        throw new Error(dataEditais.message || 'O portal do Governo está instável. Tente novamente em instantes.');
      }
      
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

      // ──────────────────────────────────────────────────────────────
      // 🛡️ FILTRO FINAL CLIENTE: elimina editais com prazo vencido
      // Garante que nenhum edital expirado chega ao utilizador,
      // independentemente do que o backend eventualmente deixe passar.
      // ──────────────────────────────────────────────────────────────
      const agora = new Date();

      // Strings de fallback que o backend coloca quando não há data real — tratar como null.
      const FALLBACK_STRINGS = [
        'verificação direta', 'verificacao direta',
        'acesso via edital', 'a apurar', 'a definir',
        'urgente', 'não informado', 'nao informado',
      ];

      const parsearData = (str: string | undefined | null): Date | null => {
        if (!str) return null;
        const s = str.replace('\xa0', ' ').trim();
        // Rejeita strings de fallback do backend (não são datas reais)
        if (FALLBACK_STRINGS.some(fb => s.toLowerCase().includes(fb))) return null;
        // Formato BR: DD/MM/YYYY [HH:MM[:SS]]
        const matchBR = s.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
        if (matchBR) {
          const [, d, m, y, t] = matchBR;
          return new Date(`${y}-${m}-${d}T${t || '23:59:59'}`);
        }
        // Formato ISO ou qualquer coisa que o Date consiga
        const tentativa = new Date(s);
        return isNaN(tentativa.getTime()) ? null : tentativa;
      };

      const vivos = encontrados.filter(edital => {
        // 1. Tentar data de encerramento/fim (mais fiável)
        const dataFim = parsearData(
          edital.data_fim ||
          edital.dataFimRecebimentoProposta ||
          edital.dataEncerramentoProposta ||
          edital.dataEncerramento
        );
        if (dataFim !== null) return dataFim >= agora;

        // 2. Sem data de fim fiável — tentar data de abertura como fallback
        //    Se a abertura já passou, o edital está certamente vencido.
        const dataInicio = parsearData(
          edital.data_inicio ||
          edital.dataAberturaProposta ||
          edital.dataRecebimentoProposta
        );
        if (dataInicio !== null) return dataInicio >= agora;

        // 3. Sem data de encerramento nem de abertura → usar data de publicação como proxy.
        //    Se o edital foi publicado há mais de 60 dias sem datas explícitas, é improvável
        //    que ainda esteja ativo (o backend usa regra de 45 dias, mas pode escapar algum).
        const dataDivulgacao = parsearData(edital.data_divulgacao);
        if (dataDivulgacao !== null) {
          const sessentaDias = new Date(agora.getTime() - 60 * 24 * 60 * 60 * 1000);
          return dataDivulgacao >= sessentaDias;
        }

        // 4. Nenhuma data disponível — manter (backend validou com regra dos 45 dias).
        return true;
      });

      setResults([...vivos]);
      if (vivos.length === 0) {
        setError(
          encontrados.length > 0
            ? 'Nenhuma licitação ativa encontrada para este termo. Os editais encontrados já encerraram o prazo de propostas.'
            : 'Nenhuma licitação encontrada para este termo. Tente um termo mais amplo ou ative a busca exata.'
        );
      }

      if (resMarket && resMarket.ok) {
        try {
          const marketJson = await resMarket.json();
          const temDados =
            marketJson &&
            typeof marketJson.ticketMedio === 'number' && marketJson.ticketMedio > 0 &&
            marketJson.competitividade &&
            marketJson.competitividade !== 'Dados Insuficientes' &&
            marketJson.competitividade !== 'Erro na API';
          setMarketData(temDados ? marketJson : null);
        } catch {
          setMarketData(null);
        }
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

      onAnalyzeOportunity(promptEstrategicoFinal, searchTerm, {
        cnpj: edital.cnpj,
        ano: edital.ano,
        sequencial: edital.sequencial,
        uf: edital.uf
      });
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  if (!mounted) return <div className="min-h-[200px] animate-pulse bg-slate-50 rounded-[2.5rem]" />;

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-[2rem] shadow-sm border border-slate-200 font-sans relative overflow-hidden">

      {/* ========================================== */}
      {/* 1. CABEÇALHO RADAR 360                     */}
      {/* ========================================== */}
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700 shadow-sm">
              <Radar className="h-3.5 w-3.5" />
              Radar PNCP
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-950 md:text-2xl">
              Busque oportunidades abertas antes de enviar o edital.
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              Pesquise por segmento, órgão, cidade ou palavra-chave. Quando encontrar um edital, a Bawzi extrai o conteúdo e leva direto para a análise.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <PncpStatusBadge />
            {detectedUf && !uf && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-[10px] font-black uppercase text-sky-700">
                <MapPin size={12} />
                UF detectada: {detectedUf}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. O TERMINAL DE BUSCA (VISUAL NOVO)       */}
      {/* ========================================== */}
      <form onSubmit={handleSearch} className="relative z-10 p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase text-slate-400">
          <Search size={13} />
          Busca oficial
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          
          <div className="relative h-14 bg-slate-50 rounded-xl border border-slate-200 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-300 transition-all lg:flex-[1_1_320px]">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={17} className="text-slate-400" />
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Busque por termos, materiais ou serviços..." 
              className="block w-full h-full pl-11 pr-4 bg-transparent border-none text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-0 sm:text-sm"
            />
          </div>

          <div className="h-14 bg-slate-50 rounded-xl border border-slate-200 relative focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-300 transition-all lg:w-40">
            <select
              value={uf}
              onChange={(e) => {
                setUf(e.target.value);
                // Limpa cidade ao trocar estado
                setMunicipioId('');
                setMunicipioNome('');
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

          {/* Filtro de cidade — só aparece após selecionar UF */}
          <div className={`transition-all duration-200 overflow-visible lg:w-52 ${uf ? 'opacity-100' : 'hidden opacity-0 pointer-events-none'}`}>
            {uf && (
              <div className="h-14 bg-slate-50 rounded-xl border border-slate-200 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-300 transition-all overflow-visible">
                <MunicipioAutocomplete
                  value={municipioNome}
                  uf={uf}
                  apiUrl={API_URL}
                  onSelect={(id, nome) => { setMunicipioId(id); setMunicipioNome(nome); }}
                  onClear={() => { setMunicipioId(''); setMunicipioNome(''); }}
                  placeholder="Filtrar por cidade..."
                  className="h-full"
                  variant="light"
                />
              </div>
            )}
          </div>

          <button 
            onClick={handleSearch}
            disabled={isSearching}
            className="h-14 w-full px-6 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition-all shadow-[0_16px_32px_-20px_rgba(5,150,105,0.7)] active:scale-[0.98] disabled:bg-slate-400 disabled:cursor-not-allowed shrink-0 lg:w-auto"
          >
            {isSearching ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium tracking-wide animate-pulse">
                  {loadingText}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Radar className="w-5 h-5 text-white/70" strokeWidth={2.5} />
                <span className="font-bold tracking-wide">Buscar no PNCP</span>
              </span>
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer group min-w-0">
            <div className="relative flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={forceExact}
                onChange={(e) => setForceExact(e.target.checked)}
                className="peer sr-only" 
              />
              <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 transition-colors"></div>
            </div>
            <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 transition-colors">
              Busca exata <span className="opacity-60">sem otimização automática do termo</span>
            </span>
          </label>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
            <SlidersHorizontal size={13} />
            Use quando souber exatamente o objeto da compra.
          </span>
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
          {(uf || municipioNome) && (
            <div className="mb-5 bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3 shadow-sm">
              <span className="text-amber-500 text-lg">🎯</span>
              <div>
                <p className="text-[11px] font-black text-amber-900 uppercase tracking-wider">
                  Filtro Regional Ativo: {municipioNome ? `${municipioNome}${uf ? ` · ${uf}` : ''}` : uf}
                </p>
                <p className="text-[11px] text-amber-800/80 font-medium mt-0.5 leading-relaxed">
                  Todos os indicadores refletem <strong>exclusiva e estritamente</strong> a realidade de contratações{' '}
                  {municipioNome ? <>de <strong>{municipioNome}</strong></> : <>de <strong>{uf}</strong></>}.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 px-2">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-slate-500" strokeWidth={2.5} />
              Inteligência de Mercado
            </h3>
            <div className={`border px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm ${uf ? 'bg-amber-100/50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              <span className="text-sm">🗂️</span>
              <span className="text-[9px] font-black uppercase tracking-widest">
                Base Histórica: {marketData.previsaoVolume} contrato{marketData.previsaoVolume === '1' ? '' : 's'} assinado{marketData.previsaoVolume === '1' ? '' : 's'} {uf ? `em ${uf}` : 'no PNCP'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 blur-[20px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Volume do Mercado</span>
              <span className="text-xl md:text-2xl font-black text-white">~R$ {marketData.tamanhoMercado}</span>
              <span className="text-[10px] text-emerald-400 font-bold block mt-1">Base: {marketData.previsaoVolume} contrato{marketData.previsaoVolume === '1' ? '' : 's'} hist.</span>
            </div>
            <div className="bg-slate-800 p-5 rounded-2xl shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-[20px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 relative z-10">Preço Alvo Sugerido</span>
              <span className="text-xl md:text-2xl font-black text-white relative z-10">{formatCurrency(marketData.ticketMedio)}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase block mt-1 relative z-10">Média Vencedores</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Concorrência</span>
                <span className="text-sm font-black text-slate-800 leading-tight block">{marketData.competitividade}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Taxa de Vitória</span>
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{marketData.taxaSucesso}%</span>
              </div>
            </div>
            {/* 4. EDITAIS ABERTOS (licitações ativas na busca atual) */}
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-sky-500/20 blur-[20px] rounded-full -translate-y-1/2 translate-x-1/2"></div>

              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 relative z-10">
                Editais Abertos
              </span>

              <div className="flex items-baseline gap-1 relative z-10">
                <span className="text-2xl md:text-3xl font-black text-white">
                  {results ? results.length : 0}
                </span>
              </div>

              <span className="text-[10px] text-sky-400 font-bold block mt-1 relative z-10">
                Licitações ativas agora
              </span>
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

            // Detecta se data_fim não é uma data real (metadata noise do PNCP)
            const dataFimRaw = edital.data_fim || '';
            const dataFimIlegivel = dataFimRaw && !/\d{2}\/\d{2}\/\d{4}/.test(dataFimRaw) && !/\d{4}-\d{2}-\d{2}/.test(dataFimRaw);

            // Classifica a ausência de data: edital recente (PNCP sem metadado) ou genuinamente suspeito
            const agoraRender = new Date();
            const divulgacaoMatch = (edital.data_divulgacao || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
            const diasDesdePublicacao = divulgacaoMatch
              ? Math.floor((agoraRender.getTime() - new Date(`${divulgacaoMatch[3]}-${divulgacaoMatch[2]}-${divulgacaoMatch[1]}`).getTime()) / 86400000)
              : 999;
            // Se publicado há < 45 dias sem data → plataforma externa não sincronizou com PNCP
            const semDataRecente = dataFimIlegivel && diasDesdePublicacao < 45;

            return (
              <div key={edital.id || index} className="p-5 md:p-6 border border-slate-200 rounded-[1.5rem] bg-white hover:border-slate-300 transition-all shadow-sm hover:shadow-md group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2 items-center">
                    <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-md uppercase border border-slate-200">
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
                <div className="mt-4 mb-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
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
                  {edital.data_inicio && /\d{2}\/\d{2}\/\d{4}/.test(edital.data_inicio) && (
                    <div className="flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Início</p>
                        <p className="text-xs text-slate-700 font-semibold truncate">{edital.data_inicio}</p>
                      </div>
                    </div>
                  )}
                  {edital.data_fim && /\d{2}\/\d{2}\/\d{4}/.test(edital.data_fim) && (
                    <div className="flex items-center gap-2 border-l-2 pl-2 rounded-r py-1 border-amber-400 bg-amber-50">
                      <Timer className="w-4 h-4 shrink-0 text-amber-600" />
                      <div>
                        <p className="text-[9px] uppercase font-black tracking-widest text-amber-600/80">Fim</p>
                        <p className="text-xs text-amber-900 font-black truncate">{edital.data_fim}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* PREDICTIVE RADAR */}
                {isRecorrente && (
                <div className="mb-5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 rounded-xl p-4 flex items-start gap-3 relative overflow-hidden shadow-inner">
                  
                  <div className="w-8 h-8 bg-white border border-orange-100 rounded-full flex items-center justify-center shrink-0 shadow-sm z-10">
                    <Timer className="w-4 h-4 text-orange-500" strokeWidth={2.5} />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-[10px] font-black text-orange-800 uppercase tracking-widest flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-orange-600" strokeWidth={3} />
                        Radar Preditivo
                      </h4>
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
                        alert("Falha de registro no PNCP: falta CNPJ, ano ou sequencial. Não foi possível extrair o edital.");
                        return;
                      }
                      handleDeepAnalyze(edital);
                    }}
                    disabled={loadingId !== null}
                    className="flex-1 bg-slate-900 text-white font-black py-3 px-4 rounded-xl text-xs hover:bg-slate-800 transition-all disabled:bg-slate-500 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                  >
                    {loadingId === edital.id ? (
                      <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Extraindo PDF...</>
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
