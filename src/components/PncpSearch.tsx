'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Info, PlayCircle, Timer, Radar, BrainCircuit,
  Search, MapPin, SlidersHorizontal, Layers, X, Zap, History, ArrowRight, Landmark,
} from 'lucide-react';
import PncpStatusBadge from './PncpStatusBadge';
import MunicipioAutocomplete from './MunicipioAutocomplete';
import OrgaoAutocomplete from './OrgaoAutocomplete';
import Tooltip from './Tooltip';
import ActiveContextSwitcher from './ActiveContextSwitcher';
import CnaeMismatchModal from './CnaeMismatchModal';
import { apiFetch, SessionExpiredError, clearSession, mensagemDeErro } from '@/lib/apiClient';
import { checarAderenciaObjetoEmpresa } from '@/lib/cnaeMatch';
import { resolveActiveCompany, getCompanyDisplayName } from '@/lib/activeContext';
import type { Empresa } from '@/lib/types';

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
  /** false quando o usuário já está no plano de maior capacidade — muda o
   *  texto do aviso de truncamento (não faz sentido pedir upgrade a quem já
   *  está no topo). */
  podeUpgrade?: boolean;
  onUfChange?: (estadoSelecionado: string) => void;
  token?: string | null;
  userUf?: string;
  /** Termo de busca pré-carregado (ex: vindo de link de email ou notificação) */
  initialQuery?: string;
  /** UF pré-carregada junto com o initialQuery */
  initialUf?: string;
  contextCompanies?: Empresa[];
  activeCnpj?: string;
  onActiveCnpjChange?: (cnpj: string, company: Empresa | null) => void;
  /** Abre a aba Capital com valor e objeto do edital pré-preenchidos */
  onMedirFolego?: (valor: number, objeto: string) => void;
  /** Abre no histórico o laudo já existente deste edital. */
  onAbrirAnalise?: (analysisId: string) => void;
}

export default function PncpSearch({
  onAnalyzeOportunity,
  charLimit = 30000,
  podeUpgrade = true,
  onUfChange,
  token,
  userUf,
  initialQuery,
  initialUf,
  contextCompanies = [],
  activeCnpj,
  onActiveCnpjChange,
  onMedirFolego,
  onAbrirAnalise,
}: PncpSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [uf, setUf] = useState('');
  const [municipioId, setMunicipioId]   = useState('');
  const [municipioNome, setMunicipioNome] = useState('');
  // Filtro por órgão comprador — nome OU CNPJ. Ver o cabeçalho de
  // OrgaoAutocomplete.tsx para por que ele não mora no campo de busca.
  const [orgaoFiltro, setOrgaoFiltro] = useState('');
  const [orgaoDescartados, setOrgaoDescartados] = useState(0);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [forceExact, setForceExact] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [results, setResults] = useState<PncpItem[]>([]);

  // ── Editais que este workspace já analisou ────────────────────────────
  // Consulta EM LOTE: uma página do Radar tem dezenas de cards, e perguntar
  // um a um seriam dezenas de round-trips para uma resposta que cabe em uma.
  // Chave canônica cnpj-ano-sequencial, com o sequencial sem zeros à esquerda
  // (o PNCP devolve `124` num lugar e `000124` noutro).
  const [jaAnalisados, setJaAnalisados] = useState<Record<string, {
    id: string; titulo: string; criada_em: string;
    score?: number | null; veredito?: string; em_gestao?: boolean;
  }>>({});

  const chaveAnalise = (cnpj: string, ano: number | string, seq: number | string) =>
    `${String(cnpj || '').replace(/\D/g, '')}-${String(ano ?? '').trim()}-${String(seq ?? '').trim().replace(/^0+/, '') || '0'}`;

  // ⚠️ FILTRO ATIVO NUNCA FICA ATRÁS DE PAINEL FECHADO.
  // O painel "Mais filtros" começa fechado, e tudo bem — mas se por qualquer
  // caminho existir um órgão aplicado (restauração de estado, link externo,
  // uma futura persistência de filtros), a lista chega recortada e o motivo
  // precisa estar em tela. Abrir é irreversível de propósito: só o usuário
  // fecha de novo, e limpar o órgão é o que remove o filtro — não fechar o
  // painel.
  useEffect(() => {
    if (orgaoFiltro) setFiltrosAbertos(true);
  }, [orgaoFiltro]);

  useEffect(() => {
    if (!token || results.length === 0) return;
    let cancelado = false;
    (async () => {
      try {
        const refs = results
          .filter(e => e.cnpj && e.ano && e.sequencial !== undefined)
          .map(e => ({ cnpj: e.cnpj, ano: e.ano, sequencial: e.sequencial }));
        if (!refs.length) return;
        const res = await apiFetch(`${API_URL}/api/analyses/ja-analisados`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refs }),
        });
        if (!res.ok || cancelado) return;
        const data = await res.json();
        setJaAnalisados(data?.encontrados || {});
      } catch { /* marcação é auxiliar: falhar aqui não pode quebrar a lista */ }
    })();
    return () => { cancelado = true; };
  }, [results, token]);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const [detectedUf, setDetectedUf] = useState('');
  const [editandoUf, setEditandoUf] = useState(false);
  const [marketData, setMarketData] = useState<any>(null);

  // ── Cancelamento da extração/análise em andamento ───────────────────────
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);

  // Objeto expandido por card (ver descrição completa)
  const [objetoExpandido, setObjetoExpandido] = useState<string | null>(null);

  // 💧 Hidratação lazy: dispara a fila de detalhes após cada nova busca
  const [hydrationKey, setHydrationKey] = useState(0);
  const hydrationCtl = useRef<{ cancel: boolean } | null>(null);

  // ── Modo de seleção (bulk) ───────────────────────────────────────────────
  const [bulkMode, setBulkMode]         = useState(false);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading]   = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const MAX_BULK = 5;

  // ── Confirmação de divergência de CNAE antes de gastar uma análise ──────
  // Usa o mesmo helper do resto do app (compara CNPJ normalizado, sem
  // pontuação) — comparar `c.cnpj === activeCnpj` direto falha sempre que um
  // dos dois vier formatado ("00.000.000/0000-00") e o outro não.
  const empresaAtiva = resolveActiveCompany(contextCompanies, activeCnpj);
  const [cnaeConfirm, setCnaeConfirm] = useState<
    | { tipo: 'unico'; edital: PncpItem }
    | { tipo: 'lote'; editais: PncpItem[]; totalFora: number }
    | null
  >(null);

  /** Garante que a auto-busca por initialQuery só dispara uma vez. */
  const autoSearchFired = useRef(false);

  /** As 27 unidades federativas, num lugar só.
 *  ⚠️ Estavam escritas à mão como 27 `<option>` no formulário de busca, e o
 *  editor de UF detectada abaixo precisava das mesmas. Duas listas de 27
 *  itens divergem no dia em que alguém corrige um acento em uma delas. */
const UFS: readonly { sigla: string; nome: string }[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

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

    // Prioridade 1: correção MANUAL do usuário (✎) — nunca é sobrescrita.
    // (Antes a UF da empresa vinha primeiro, e a correção do usuário era
    // ignorada a cada recarregamento — a "UF errada" sempre voltava.)
    const ufSalva = localStorage.getItem('bawzi_uf_override');
    if (ufSalva && (ESTADOS_BR[ufSalva.toUpperCase()] !== undefined || ufSalva.trim().length === 2)) {
      setDetectedUf(ufSalva.trim().toUpperCase());
      return;
    }

    // Prioridade 2: UF da empresa cadastrada (contexto ativo)
    if (userUf) {
      setDetectedUf(extrairSiglaUF(userUf));
      return;
    }

    const detectarLocalizacao = async () => {
      // Prioridade 3: Geolocalização nativa do browser (GPS/Wi-Fi — muito mais preciso que IP)
      const ufViaGPS = await new Promise<string>((resolve) => {
        if (!navigator.geolocation) { resolve(''); return; }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const { latitude: lat, longitude: lon } = pos.coords;
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt-BR`,
                { headers: { 'User-Agent': 'Bawzi/1.0' } }
              );
              const data = await res.json();
              // Nominatim retorna state como nome completo ex: "Goiás"
              const estado = (data.address?.state || '').toUpperCase();
              resolve(extrairSiglaUF(estado));
            } catch { resolve(''); }
          },
          () => resolve(''),   // negado ou timeout → fallback
          { timeout: 5000, maximumAge: 300_000 }
        );
      });

      if (ufViaGPS) {
        setDetectedUf(ufViaGPS);
        return;
      }

      // Prioridade 4: IP geolocation (menos preciso — GO/DF frequentemente se confundem)
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.region_code) {
          const ufLimpo = extrairSiglaUF(data.region_code);
          if (ufLimpo) { setDetectedUf(ufLimpo); return; }
        }
      } catch { /* fallback */ }

      try {
        // ip-api.com gratuito é HTTP-only → falhava silenciosamente em página
        // HTTPS (mixed content). ipwho.is oferece HTTPS grátis.
        const res = await fetch('https://ipwho.is/');
        const data = await res.json();
        const candidato = data.region_code || data.region || '';
        const ufLimpo = extrairSiglaUF(String(candidato));
        if (ufLimpo) setDetectedUf(ufLimpo);
      } catch {
        console.warn('⚠️ [GEO] Nenhuma localização detectada.');
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
  // runSearch(term, ufVal, munId?, munNome?): núcleo reutilizável — chamado pelo
  // submit, pela auto-busca e pelas mudanças de filtro UF/cidade (que disparam
  // SEMPRE uma nova requisição ao PNCP, nunca apenas um recorte local).
  const runSearch = async (
    term: string,
    ufVal: string,
    munId: string = municipioId,
    munNome: string = municipioNome,
    orgaoVal: string = orgaoFiltro,
  ) => {
    const termo = term.trim();
    // Termo vazio é válido: lista todos os editais vigentes do escopo (Brasil/UF/cidade)
    if (termo && termo.length < 3) {
      setError('Digite pelo menos 3 caracteres — ou deixe o campo vazio para listar todos os editais vigentes.');
      return;
    }

    setIsSearching(true);
    setError('');
    setMarketData(null);

    try {
      const ufParam = ufVal ? `&uf=${encodeURIComponent(ufVal)}` : '';
      const exactParam = forceExact ? `&force_exact=true` : '';
      const munParam = munId
        ? `&municipio_id=${encodeURIComponent(munId)}${munNome ? `&municipio_nome=${encodeURIComponent(munNome)}` : ''}`
        : '';
      const orgaoLimpo = (orgaoVal || '').trim();
      const orgaoParam = orgaoLimpo ? `&orgao=${encodeURIComponent(orgaoLimpo)}` : '';

      const ufAtivo = detectedUf ? detectedUf.trim().toUpperCase() : '';

      // 1. Busca principal (UF e cidade viram filtros REAIS na API do PNCP)
      const reqNacional = apiFetch(`${API_URL}/api/pncp/buscar?q=${encodeURIComponent(termo)}${ufParam}${munParam}${orgaoParam}${exactParam}`);
      // Inteligência de mercado só faz sentido com termo definido.
      //
      // ⚠️ O `market-score` NÃO recebe o filtro de órgão, e é intencional: ele
      // mede o mercado daquele objeto (mediana, deságio, concorrência), e um
      // mercado medido dentro de um único comprador não é mercado — é o
      // histórico daquele órgão, com amostra pequena demais para a estatística
      // que o cartão apresenta. O filtro estreita a LISTA, não a referência.
      const reqMarket = termo
        ? fetch(`${API_URL}/api/pncp/market-score?q=${encodeURIComponent(termo)}${ufParam}`).catch(() => null)
        : Promise.resolve(null);

      // 2. A PINÇA: só ativa se não há filtro de cidade E não há UF manual
      let reqRegional = null;
      if ((!ufVal || ufVal === '') && ufAtivo && !munId && !munNome) {
        reqRegional = apiFetch(`${API_URL}/api/pncp/buscar?q=${encodeURIComponent(termo)}&uf=${ufAtivo}${orgaoParam}${exactParam}`).catch(() => null);
      }

      // Dispara tudo
      const [resEditais, resMarket, resRegional] = await Promise.all([reqNacional, reqMarket, reqRegional]);

      const dataEditais = await resEditais.json();
      if (!resEditais.ok) throw new Error(mensagemDeErro(dataEditais.detail, 'Falha na busca.'));
      if (dataEditais.status === 'error') {
        throw new Error(dataEditais.message || 'O portal do Governo está instável. Tente novamente em instantes.');
      }
      
      // Recusa do PNCP (503/429). Içada para o escopo da função porque a
      // resposta regional vive dentro de um `if` e não alcançaria o ponto
      // onde a mensagem de erro é escolhida.
      let recusaPncp: number | null = (dataEditais as { pncp_recusou?: number | null })?.pncp_recusou ?? null;

      // Quantos editais o PNCP devolveu que NÃO eram do órgão pedido. Sem este
      // número, "zero resultados" por filtro de órgão e "zero resultados"
      // porque o portal não tem nada são a mesma tela — e o conselho certo em
      // cada caso é oposto (conferir o nome do órgão × tentar outro termo).
      setOrgaoDescartados(
        (dataEditais as { orgao_descartados?: number })?.orgao_descartados ?? 0,
      );

      let encontrados: PncpItem[] = dataEditais.data || dataEditais.items || dataEditais.oportunidades || [];

      // ==========================================================
      // 📍 INJEÇÃO DOS 5 PRINCIPAIS DO ESTADO (A PINÇA)
      // ==========================================================
      if (resRegional && resRegional.ok) {
        const dataRegional = await resRegional.json();
        recusaPncp = recusaPncp ?? ((dataRegional as { pncp_recusou?: number | null })?.pncp_recusou ?? null);
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
      if ((!ufVal || ufVal === '') && ufAtivo) {
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

      // ⚠️ REGRA ESTRITA (12/08/2026): edital vencido NUNCA aparece — decisão
      // de produto explícita. Só passa quem PROVA vigência com data real:
      // encerramento no futuro, ou (sem encerramento legível) abertura no
      // futuro. Sem data nenhuma → FORA. As regras antigas de "na dúvida,
      // mantém" (proxy de publicação, item sem data aceito) eram exatamente
      // as frestas por onde vencidos escapavam. O backend aplica a MESMA
      // regra na fonte (filtrar_editais_vivos estrito); esta é a segunda
      // camada, para o caso de cache antigo ou resposta fora do padrão.
      const vivos = encontrados.filter(edital => {
        // 1. Data de encerramento/fim REAL e futura → vigente.
        const dataFim = parsearData(
          edital.data_fim ||
          edital.dataFimRecebimentoProposta ||
          edital.dataEncerramentoProposta ||
          edital.dataEncerramento
        );
        if (dataFim !== null) return dataFim >= agora;

        // 2. Sem encerramento legível — abertura FUTURA ainda prova vigência.
        const dataInicio = parsearData(
          edital.data_inicio ||
          edital.dataAberturaProposta ||
          edital.dataRecebimentoProposta
        );
        if (dataInicio !== null) return dataInicio >= agora;

        // 3. Nenhuma data real → fora, sempre. Esconder um edital mal
        //    cadastrado custa menos que exibir um vencido.
        return false;
      });

      setResults([...vivos]);
      setHydrationKey(k => k + 1); // inicia a hidratação lazy dos cards
      if (vivos.length === 0) {
        // ⚠️ Recusa do portal NÃO é ausência de resultado.
        // Antes, um 503 do PNCP produzia a mesma lista vazia de "não existe
        // edital para este termo", e a tela mandava o cliente reformular a
        // busca. Ele tentava outro termo, e outro — cada tentativa uma nova
        // rajada contra o balanceador que já estava recusando. A mensagem
        // errada alimentava a causa, além de culpar o usuário por um problema
        // que não era dele.
        // Os nomes reais das respostas neste escopo são `dataEditais` (busca
        // nacional) e `dataRegional` (busca por UF, quando houve). Qualquer uma
        // das duas ter sido recusada já explica a lista vazia.
        const recusou = recusaPncp;
        // ⚠️ O FILTRO DE ÓRGÃO PRECISA DE MENSAGEM PRÓPRIA, antes das outras.
        // Sem ela, quem filtrou por "Prefeitura de Goiânia" e recebeu zero leria
        // "tente um termo mais amplo" — conselho que não resolve nada, porque o
        // problema não estava no termo. E se o PNCP trouxe 87 editais de OUTROS
        // compradores, dizer isso é a diferença entre "a Bawzi não achou nada" e
        // "achei bastante, nenhum deste órgão" — que sugerem ações opostas.
        const orgaoAtivo = (orgaoVal || '').trim();
        const descartadosOrgao =
          (dataEditais as { orgao_descartados?: number })?.orgao_descartados ?? 0;
        setError(
          recusou
            ? 'O Portal Nacional de Contratações Públicas está recusando consultas neste momento — não é o seu termo de busca. Isso costuma durar poucos minutos. Aguarde e tente de novo; evite repetir a busca em sequência, porque isso prolonga o bloqueio.'
          : orgaoAtivo && descartadosOrgao > 0
            ? `Nenhum edital aberto de "${orgaoAtivo}"${termo ? ` para "${termo}"` : ''} neste momento. O PNCP devolveu ${descartadosOrgao} edital${descartadosOrgao > 1 ? 'is' : ''} de outros compradores, que foram descartados. Confira a grafia do órgão — ou use o CNPJ, que não tem homônimo.`
          : orgaoAtivo
            ? `Nenhum edital aberto de "${orgaoAtivo}" no momento. Se o nome estiver certo, é porque esse órgão não tem licitação com proposta em aberto agora.`
          : encontrados.length > 0
            ? 'Nenhuma licitação ativa encontrada. Os editais encontrados já encerraram o prazo de propostas.'
            : termo
              ? 'Nenhuma licitação encontrada para este termo. Tente um termo mais amplo, ative a busca exata ou deixe o campo vazio para ver todos os editais vigentes da região.'
              : 'Nenhum edital vigente encontrado neste momento para a região selecionada.'
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
      if (err instanceof SessionExpiredError) { clearSession(); return; }
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  /** Wrapper do form — mantém compatibilidade com o submit do formulário. */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(searchTerm, uf);
  };

  /**
   * Dispara uma NOVA requisição ao PNCP quando os filtros de UF/cidade mudam,
   * em vez de apenas recortar os dados já listados. Termo vazio é válido
   * (lista todos os editais vigentes do escopo).
   */
  const autoSearchOnFilter = (
    ufVal: string,
    munId: string,
    munNome: string,
    orgaoVal: string = orgaoFiltro,
  ) => {
    const t = searchTerm.trim();
    if (t.length === 0 || t.length >= 3) {
      runSearch(searchTerm, ufVal, munId, munNome, orgaoVal);
    }
  };

  /**
   * Auto-busca quando o componente recebe initialQuery (ex: link de email ou notificação).
   * Dispara apenas uma vez por montagem.
   */
  useEffect(() => {
    if (!mounted || autoSearchFired.current) return;
    if (!initialQuery || initialQuery.length < 3) return;
    autoSearchFired.current = true;
    setSearchTerm(initialQuery);
    if (initialUf) setUf(initialUf);
    // Small delay para garantir que o estado de UF foi aplicado antes da busca
    setTimeout(() => runSearch(initialQuery, initialUf || ''), 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, initialQuery, initialUf]);

  /**
   * 💧 HIDRATAÇÃO LAZY DOS CARDS
   * O WAF do PNCP só tolera ~2 chamadas de detalhe em sequência rápida, então
   * a lista volta "crua" e cada card é enriquecido (valor, plataforma, datas)
   * um a um, em fila lenta, via /api/pncp/card-detalhe (cacheado 6h no backend).
   */
  useEffect(() => {
    if (hydrationKey === 0 || results.length === 0) return;

    // Cancela fila anterior (nova busca = nova fila)
    if (hydrationCtl.current) hydrationCtl.current.cancel = true;
    const ctl = { cancel: false };
    hydrationCtl.current = ctl;

    // O PNCP permite ~1-2 consultas de detalhe por janela de tempo (por IP).
    // Fila curta e LENTA: 8 cards, 1 a cada 15s — os chips vão aparecendo ao
    // longo de ~2 min e o cache de 6h no backend acumula entre buscas.
    const fila = results
      .filter(e =>
        e.cnpj && e.ano && e.sequencial &&
        (!e.plataforma || !((e.valor ?? 0) > 0))
      )
      .slice(0, 8);

    (async () => {
      // Respiro inicial: deixa a janela de rate-limit do PNCP reabrir após a busca
      await new Promise(res => setTimeout(res, 4000));
      let falhasSeguidas = 0;
      for (const ed of fila) {
        if (ctl.cancel) return;
        try {
          const r = await fetch(
            `${API_URL}/api/pncp/card-detalhe?cnpj=${ed.cnpj}&ano=${ed.ano}&seq=${ed.sequencial}`
          );
          if (r.ok) {
            const d = await r.json();
            if (ctl.cancel) return;
            if (d.status === 'success') {
              falhasSeguidas = 0;
              setResults(prev => prev.map(item => {
                if (item.id !== ed.id) return item;
                const temDataValida = (s?: string) => /\d{2}\/\d{2}\/\d{4}/.test(String(s || ''));
                return {
                  ...item,
                  valor: (item.valor ?? 0) > 0 ? item.valor : (d.valor || item.valor),
                  plataforma: item.plataforma || d.plataforma || '',
                  link_sistema_origem: item.link_sistema_origem || d.link_sistema_origem || '',
                  data_fim: !temDataValida(item.data_fim) && d.data_fim ? d.data_fim : item.data_fim,
                  data_inicio: !temDataValida(item.data_inicio) && d.data_inicio ? d.data_inicio : item.data_inicio,
                };
              }));
            } else {
              // Disjuntor: 2 falhas seguidas = PNCP em cooldown → para a fila
              falhasSeguidas++;
              if (falhasSeguidas >= 2) return;
            }
          }
        } catch { /* segue para o próximo card */ }
        // Conta-gotas: 1 chamada a cada 15s respeita o orçamento do PNCP
        await new Promise(res => setTimeout(res, 15000));
      }
    })();

    return () => { ctl.cancel = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationKey]);

  const handleDeepAnalyze = async (edital: PncpItem) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    cancelRequestedRef.current = false;
    setLoadingId(edital.id);
    try {
      const [resTexto, resMedia] = await Promise.all([
        // `limite` diz ao backend quanto orçamento de anexos ele tem: sem
        // isso ele usa o conservador de 30k e volta a descartar documentos.
        fetch(`${API_URL}/api/pncp/texto-completo?cnpj=${edital.cnpj}&ano=${edital.ano}&seq=${edital.sequencial}&limite=${charLimit}`, { signal: controller.signal }),
        fetch(`${API_URL}/api/pncp/media-precos?q=${encodeURIComponent(searchTerm)}${uf ? `&uf=${uf}` : ''}`, { signal: controller.signal })
      ]);

      const dataTexto = await resTexto.json();
      const dataMedia = await resMedia.json();

      if (!resTexto.ok) throw new Error("Falha ao carregar itens detalhados.");

      let detalhamentoTecnico = dataTexto.texto || "Detalhes técnicos não fornecidos pela API.";
      const historicoPrecos = dataMedia.texto || "Sem histórico recente para estabelecer média.";

  const termoAlvo = searchTerm.trim()
    ? `"${searchTerm.trim().toUpperCase()}"`
    : 'BUSCA GERAL DE EDITAIS VIGENTES (FOCAR NO OBJETO DO EDITAL ABAIXO)';

  const cabecalhoPrompt = `
  DOCUMENTO OFICIAL PARA ANÁLISE DE RISCO E ESTRATÉGIA DE LICITAÇÃO
  ===================================================================
  ▸ TERMO ALVO DA BUSCA DO CLIENTE: ${termoAlvo}
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
  O detalhamento técnico acima foi cortado por exceder ${charLimit.toLocaleString('pt-BR')} caracteres${podeUpgrade ? ' (limite do plano atual do utilizador)' : ' (capacidade máxima da plataforma para um único edital)'}. Baseie a sua análise nesta amostragem e declare explicitamente, na cobertura e na confiança, que a leitura foi parcial.${podeUpgrade ? ' Informe ao utilizador, no Veredito Financeiro, que um plano superior permite analisar a totalidade dos itens e documentos desta licitação.' : ' NÃO sugira upgrade de plano: o utilizador já está na maior capacidade disponível.'}
  `;
        } else {
          conteudoDetalhamentoFinal = `
  [3. DETALHAMENTO TÉCNICO E REGRAS]
  ${detalhamentoTecnico}
`;
      }

      const promptEstrategicoFinal = cabecalhoPrompt + conteudoDetalhamentoFinal + rodapePrompt;

      onAnalyzeOportunity(promptEstrategicoFinal, searchTerm, {
        cnpj: edital.cnpj,
        ano: edital.ano,
        sequencial: edital.sequencial,
        uf: edital.uf
      });

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Extração cancelada.');
      } else {
        setError(err.message || 'Erro ao carregar o edital. Tente novamente.');
      }
    } finally {
      setLoadingId(null);
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  // ── Cancela a extração/análise em andamento (botão vira "Cancelar" durante o loading) ──
  const handleCancelAnalyze = () => {
    cancelRequestedRef.current = true;
    abortControllerRef.current?.abort();
  };

  // ── Checagem de CNAE antes de disparar uma análise individual ───────────
  // Alerta preventivo: não bloqueia, só confirma antes de gastar o crédito
  // quando o objeto do edital não parece ter relação com o negócio cadastrado.
  const dispararAnaliseUnica = (edital: PncpItem) => {
    const resultado = checarAderenciaObjetoEmpresa(edital.objeto, empresaAtiva);
    // Log de diagnóstico: ajuda a entender, no console do navegador, por que
    // o alerta de CNAE apareceu ou não apareceu num teste específico.
    console.debug('[cnaeMatch]', {
      empresa: empresaAtiva?.razao_social || empresaAtiva?.nome_fantasia || null,
      cnaeDescricao: empresaAtiva?.cnae_descricao || null,
      coreBusiness: empresaAtiva?.core_business || null,
      objeto: edital.objeto,
      resultado,
    });
    if (!resultado.indeterminado && !resultado.compativel) {
      setCnaeConfirm({ tipo: 'unico', edital });
      return;
    }
    handleDeepAnalyze(edital);
  };

  // ── Analisar em lote ───────────────────────────────────────────────────
  const executarBulkAnalyze = async (editaisSelecionados: PncpItem[]) => {
    setBulkLoading(true);
    setBulkProgress(0);
    setBulkMode(false);
    setSelected(new Set());

    for (let i = 0; i < editaisSelecionados.length; i++) {
      const edital = editaisSelecionados[i];
      setBulkProgress(i + 1);
      await handleDeepAnalyze(edital);
      // Se o usuário cancelou a extração em andamento, interrompe o lote inteiro
      // em vez de seguir para o próximo edital selecionado.
      if (cancelRequestedRef.current) break;
      if (i < editaisSelecionados.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }
    setBulkLoading(false);
    setBulkProgress(0);
  };

  const handleBulkAnalyze = () => {
    if (selected.size === 0) return;
    const editaisSelecionados = results.filter(e => selected.has(e.id || e.link));
    const foraDoCnae = editaisSelecionados.filter((e) => {
      const { compativel, indeterminado } = checarAderenciaObjetoEmpresa(e.objeto, empresaAtiva);
      return !indeterminado && !compativel;
    });
    if (foraDoCnae.length > 0) {
      setCnaeConfirm({ tipo: 'lote', editais: editaisSelecionados, totalFora: foraDoCnae.length });
      return;
    }
    executarBulkAnalyze(editaisSelecionados);
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
              Radar PNCP · Decidir com a Bawzi
            </div>
            {/* ⚠️ O TÍTULO ERA UMA FRASE, E A FRASE REPETIA O SELO.
                O selo já diz "Radar PNCP · Decidir com a Bawzi" e o `<h2>` dizia
                "Busque oportunidades abertas e decida se vale participar" — a
                mesma promessa, duas vezes, uma embaixo da outra.
                E o subtítulo era o manual do formulário logo abaixo ("pesquise
                por segmento, estreite por UF, cidade e órgão"), que tem campos
                rotulados dizendo exatamente isso. Fui eu que escrevi essa linha
                ao acrescentar o filtro de órgão; fazia sentido como correção
                naquele dia e virou instrução relida todo dia depois. */}
            <h2 className="text-xl font-black tracking-tight text-slate-950 md:text-2xl">
              Editais abertos no PNCP
            </h2>

            {/* ⚠️ O CONTEXTO ERA UMA PILHA DE TRÊS SELOS SOLTOS: "Empresa
                analisada", o estado do PNCP e "UF detectada". Dois deles
                respondem à mesma pergunta — para quem e onde é esta busca — e o
                terceiro é saúde de sistema, coisa completamente diferente.
                Agora os dois primeiros formam UMA frase de estado, e o estado
                do PNCP fica sozinho do outro lado, que é o lugar de infra.

                ⚠️ E O SELETOR DE EMPRESA SÓ APARECE QUANDO HÁ O QUE TROCAR.
                Com uma empresa só — o caso da maioria — o `ActiveContextSwitcher`
                renderiza um `<p>` estático dentro de um cartão com borda, rótulo
                em caixa alta e 240px de largura mínima. Um controle inteiro de
                moldura para exibir um nome que cabe em duas palavras. */}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] font-medium text-slate-500">
              <span>Buscando para</span>
              {contextCompanies.length > 1 ? (
                <ActiveContextSwitcher
                  companies={contextCompanies}
                  activeCnpj={activeCnpj}
                  label="Empresa analisada"
                  compact
                  onChange={onActiveCnpjChange}
                  className="min-w-[220px] border-emerald-100 bg-white/90 shadow-sm"
                />
              ) : (
                <strong className="font-black text-slate-800">
                  {getCompanyDisplayName(empresaAtiva) || 'sua empresa'}
                </strong>
              )}
              {detectedUf && !uf && editandoUf && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase text-sky-700">
                  <MapPin size={12} className="shrink-0" />
                  <select
                    autoFocus
                    value={detectedUf}
                    aria-label="Corrigir a UF detectada"
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditandoUf(false);
                      if (v === 'AUTO') {
                        localStorage.removeItem('bawzi_uf_override');
                        window.location.reload();
                        return;
                      }
                      setDetectedUf(v);
                      localStorage.setItem('bawzi_uf_override', v);
                    }}
                    onBlur={() => setEditandoUf(false)}
                    className="cursor-pointer rounded-md border-none bg-transparent py-0.5 pr-1 text-[10px] font-black uppercase text-sky-700 outline-none"
                  >
                    {UFS.map((u) => (
                      <option key={u.sigla} value={u.sigla}>{u.sigla} — {u.nome}</option>
                    ))}
                    <option value="AUTO">Voltar ao automático</option>
                  </select>
                </span>
              )}
              {detectedUf && !uf && !editandoUf && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase text-sky-700">
                <MapPin size={12} />
                {detectedUf}
                {/* ⚠️ AQUI HAVIA UM `prompt()` NATIVO. Ele pedia a sigla por
                    digitação, e três coisas davam errado: o diálogo TRAVA a
                    página inteira enquanto está aberto, alguns navegadores o
                    bloqueiam sem aviso nenhum (o clique simplesmente não faz
                    nada), e digitar algo que não tivesse exatamente 2 letras
                    era descartado em silêncio — sem erro, sem nada, a UF
                    continuava a mesma e a pessoa não sabia por quê.
                    Um seletor com as 27 siglas não tem como receber entrada
                    inválida, e "Automático" vira uma opção da lista em vez de
                    uma palavra secreta que só o `prompt` ensinava. */}
                <button
                  type="button"
                  title="Corrigir a UF detectada"
                  aria-label="Corrigir a UF detectada"
                  onClick={() => setEditandoUf(true)}
                  className="ml-1 text-sky-400 transition-colors hover:text-sky-700"
                >
                  ✎
                </button>
              </span>
              )}
            </p>
          </div>

          {/* Saúde do sistema, sozinha do outro lado. É a única coisa aqui que
              não fala sobre a busca — misturá-la com empresa e UF fazia as três
              parecerem do mesmo tipo. */}
          <div className="shrink-0">
            <PncpStatusBadge />
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
              placeholder="O que você fornece: material, serviço ou segmento"
              className="block w-full h-full pl-11 pr-4 bg-transparent border-none text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-0 sm:text-sm"
            />
          </div>

          <div className="h-14 bg-slate-50 rounded-xl border border-slate-200 relative focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-300 transition-all lg:w-40">
            <select
              value={uf}
              onChange={(e) => {
                const novaUf = e.target.value;
                setUf(novaUf);
                // Limpa cidade ao trocar estado
                setMunicipioId('');
                setMunicipioNome('');
                if (onUfChange) onUfChange(novaUf);
                // 🔄 Nova requisição dedicada ao PNCP para o estado escolhido
                autoSearchOnFilter(novaUf, '', '');
              }}
              className="appearance-none block w-full h-full pl-4 pr-10 bg-transparent border-none text-slate-700 font-medium focus:outline-none focus:ring-0 sm:text-sm cursor-pointer"
            >
              <option value="">Brasil (Todos)</option>
              {UFS.map((u) => (
                <option key={u.sigla} value={u.sigla}>{u.nome}</option>
              ))}
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
                  onSelect={(id, nome) => {
                    setMunicipioId(id);
                    setMunicipioNome(nome);
                    // 🔄 Nova requisição dedicada ao PNCP para a cidade escolhida
                    autoSearchOnFilter(uf, id, nome);
                  }}
                  onClear={() => {
                    const tinhaCidade = !!municipioId;
                    setMunicipioId('');
                    setMunicipioNome('');
                    // Removeu a cidade → volta a buscar o estado inteiro
                    if (tinhaCidade) autoSearchOnFilter(uf, '', '');
                  }}
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

        {/* ── Filtro avançado: órgão comprador ──────────────────────────────
            Escondido por padrão porque a busca comum é por segmento, e um
            quarto campo permanente pesava na linha principal sem ser usado na
            maioria das vezes.

            ⚠️ ESCONDER FILTRO ATIVO É COMO SE PERDE A CONFIANÇA NO RESULTADO.
            Duas travas para isso não acontecer: o painel abre sozinho quando
            há órgão aplicado (`abrirSeAtivo`, abaixo), e o selo verde logo
            após o formulário continua visível mesmo com o painel fechado. Se
            um dia um dos dois sair, o usuário passa a ver uma lista recortada
            sem nada em tela dizendo por quê. */}
        {filtrosAbertos && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-center animate-in fade-in slide-in-from-top-1">
            <span className="shrink-0 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Órgão comprador
            </span>
            <div className="h-12 flex-1 rounded-xl border border-slate-200 bg-white transition-all focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-500/10 sm:max-w-sm">
              <OrgaoAutocomplete
                value={orgaoFiltro}
                uf={uf}
                apiUrl={API_URL}
                onCommit={(valor) => {
                  setOrgaoFiltro(valor);
                  autoSearchOnFilter(uf, municipioId, municipioNome, valor);
                }}
                onClear={() => {
                  const tinhaOrgao = !!orgaoFiltro;
                  setOrgaoFiltro('');
                  setOrgaoDescartados(0);
                  if (tinhaOrgao) autoSearchOnFilter(uf, municipioId, municipioNome, '');
                }}
                placeholder="Nome do órgão ou CNPJ..."
                className="h-full"
              />
            </div>
            <span className="text-[11px] font-medium leading-snug text-slate-400">
              Traz só editais deste comprador. O CNPJ não tem homônimo.
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* O gatilho do tooltip é IRMÃO do <label>, não filho: dentro dele,
              clicar na interrogação alternaria o próprio checkbox que ela
              explica. */}
          <div className="flex min-w-0 items-center gap-1.5">
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
                Busca exata <span className="opacity-60">— só o termo digitado, sem variações</span>
              </span>
            </label>

            {/* ⚠️ CADA AFIRMAÇÃO AQUI SAI DO CÓDIGO, não da intenção do rótulo:
                · o corte em 3 palavras e a lista de prefixos estão em
                  `otimizar_termo_pncp` (editais.py:776-801);
                · o retorno antecipado `if len(...split()) <= 2` é o que faz o
                  botão não mudar NADA em termo curto — sem dizer isso, quem
                  liga numa busca de uma palavra vê resultado idêntico e conclui
                  que a função está quebrada;
                · a repescagem com o termo original só roda `if not
                  force_exact` (router_pncp.py), então ligar custa essa rede. */}
            <Tooltip rotulo="Busca exata">
              <strong className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-emerald-400">
                Desligada (padrão)
              </strong>
              A Bawzi limpa o que você digitou antes de consultar o PNCP: descarta
              começos burocráticos como “aquisição de” ou “registro de preços para”
              e mantém <strong className="text-white">no máximo 3 palavras</strong>.
              Se não achar nada assim, tenta de novo com a frase inteira.
              <strong className="mb-1.5 mt-3 block text-[11px] font-black uppercase tracking-wider text-emerald-400">
                Ligada
              </strong>
              Vai ao PNCP exatamente o que você escreveu. Use quando a limpeza
              estiver comendo o essencial — “software de gestão de frotas
              municipais” vira <em className="text-slate-400">“software de gestão”</em>{' '}
              com ela desligada, e aí some justamente “frotas”.
              <span className="mt-3 block border-t border-slate-700 pt-2 text-slate-400">
                Com 1 ou 2 palavras não muda nada: a limpeza nem chega a rodar.
                E, ligada, você perde a segunda tentativa automática — se o termo
                não achar, a lista volta vazia.
              </span>
            </Tooltip>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltrosAbertos((v) => !v)}
            aria-expanded={filtrosAbertos}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition-all ${
              orgaoFiltro
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <SlidersHorizontal size={12} />
            {filtrosAbertos ? 'Menos filtros' : 'Mais filtros'}
            {orgaoFiltro && !filtrosAbertos && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-label="filtro ativo" />
            )}
          </button>

          {/* Botão de análise em lote — lado direito da barra */}
          <button
            type="button"
            onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
            className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border ${
              bulkMode
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200'
                : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-sm hover:shadow-emerald-200'
            }`}
          >
            {bulkMode ? <><X size={12} /> Cancelar lote</> : <><Layers size={12} /> Analisar em lote</>}
          </button>
          </div>
        </div>
      </form>

      {/* Selo do filtro de órgão — FORA do bloco de resultados de propósito.
          O aviso de filtro regional mora dentro de `results.length > 0`, e por
          isso some justamente quando a busca volta vazia — que é o momento em
          que saber qual filtro está ligado importa mais. */}
      {orgaoFiltro && (
        <div className="mx-5 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 md:mx-6 relative z-10">
          <Landmark size={15} className="shrink-0 text-emerald-600" />
          <span className="min-w-0 text-[11px] font-black uppercase tracking-wider text-emerald-900">
            Só deste órgão: <span className="normal-case">{orgaoFiltro}</span>
          </span>
          {orgaoDescartados > 0 && (
            <span className="text-[11px] font-medium text-emerald-800/70">
              · {orgaoDescartados} de outros compradores {orgaoDescartados > 1 ? 'descartados' : 'descartado'}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setOrgaoFiltro('');
              setOrgaoDescartados(0);
              autoSearchOnFilter(uf, municipioId, municipioNome, '');
            }}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <X size={12} /> Remover
          </button>
        </div>
      )}

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
        <div className="mb-8 px-5 md:px-6 animate-in fade-in slide-in-from-bottom-4 relative z-10">
          {/* px-5 md:px-6 = o MESMO padding do cabeçalho e do formulário do
              painel. Este bloco e a lista de editais tinham zero padding
              lateral e encostavam na borda do cartão branco. */}
          {(uf || municipioNome) && (
            <div className="mb-5 bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3 shadow-sm">
              {/* MapPin no lugar do 🎯: o aviso é sobre FILTRO REGIONAL, e um
                  alfinete de mapa diz exatamente isso. O alvo não dizia nada. */}
              <MapPin size={18} className="text-amber-500 shrink-0 mt-0.5" />
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

          {/* `px-2` removido: ele indentava o título e o selo em 8px enquanto o
              grid de cards logo abaixo ficava em 0 — dois alinhamentos
              diferentes no mesmo bloco. O respiro agora vem do container. */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
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
      {/* ── Barra de execução do lote (aparece só quando bulk está ativo) ── */}
      {results.length > 0 && bulkMode && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_BULK }).map((_, i) => (
                <span
                  key={i}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-[9px] font-black transition-all ${
                    i < selected.size
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-emerald-300 text-emerald-300'
                  }`}
                >
                  {i < selected.size ? '✓' : i + 1}
                </span>
              ))}
            </div>
            <span className="text-[11px] text-emerald-700 font-bold">
              {selected.size === 0
                ? 'Clique nos editais para selecionar'
                : `${selected.size} de ${MAX_BULK} selecionado${selected.size !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={handleBulkAnalyze}
            disabled={selected.size === 0 || bulkLoading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-[0.98]"
          >
            <Zap size={12} className={bulkLoading ? 'animate-pulse' : ''} />
            {bulkLoading
              ? `Analisando ${bulkProgress}/${selected.size}…`
              : `Analisar${selected.size > 0 ? ` ${selected.size} edital${selected.size !== 1 ? 'is' : ''}` : ''}`}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4 max-h-[500px] md:max-h-[60dvh] overflow-y-auto pl-5 pr-4 md:pl-6 md:pr-5 pb-8 custom-scrollbar relative z-10">
          {/* `pr-3` sozinho era espaçamento SÓ à direita: os cards encostavam
              na borda do painel de um lado e respiravam do outro. A direita
              fica um pouco menor que a esquerda de propósito — a barra de
              rolagem ocupa parte dela. */}
          {results.map((edital, index) => {
            // ── Janela de propostas REAL (substitui o antigo "Radar Preditivo" simulado) ──
            const parseDataBR = (s?: string): Date | null => {
              if (!s) return null;
              const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}))?/);
              if (!m) return null;
              const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4] || '23:59'}:00`);
              return isNaN(d.getTime()) ? null : d;
            };
            const agoraRender = new Date();
            const fimDate = parseDataBR(edital.data_fim);
            const iniDate = parseDataBR(edital.data_inicio);
            const diasRestantes = fimDate
              ? Math.ceil((fimDate.getTime() - agoraRender.getTime()) / 86400000)
              : null;
            // % da janela início→fim já decorrida (para a barra de progresso)
            let progressoJanela: number | null = null;
            if (fimDate && iniDate && fimDate.getTime() > iniDate.getTime()) {
              progressoJanela = Math.min(100, Math.max(0,
                ((agoraRender.getTime() - iniDate.getTime()) / (fimDate.getTime() - iniDate.getTime())) * 100
              ));
            }
            const prazoCor = diasRestantes !== null && diasRestantes <= 3
              ? { box: 'border-red-200 bg-red-50', txt: 'text-red-700', bar: 'bg-red-500', trk: 'bg-red-100' }
              : diasRestantes !== null && diasRestantes <= 7
                ? { box: 'border-amber-200 bg-amber-50', txt: 'text-amber-700', bar: 'bg-amber-500', trk: 'bg-amber-100' }
                : { box: 'border-emerald-200 bg-emerald-50', txt: 'text-emerald-700', bar: 'bg-emerald-500', trk: 'bg-emerald-100' };

            const valorNum = edital.valor || edital.valor_total_estimado || edital.valorEstimado || edital.valor_global || 0;

            const editalKey = edital.id || edital.link || String(index);
            const isSelected = selected.has(editalKey);
            const isExpandido = objetoExpandido === editalKey;
            const objetoLongo = String(edital.objeto || '').length > 160;

            return (
              <div
                key={editalKey}
                className={`p-5 md:p-6 border rounded-[1.5rem] bg-white transition-all shadow-sm hover:shadow-md group ${isSelected ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={bulkMode ? () => {
                  if (isSelected) {
                    setSelected(prev => { const n = new Set(prev); n.delete(editalKey); return n; });
                  } else if (selected.size < MAX_BULK) {
                    setSelected(prev => new Set([...prev, editalKey]));
                  }
                } : undefined}
                style={bulkMode ? { cursor: 'pointer' } : undefined}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2 items-center">
                    {/* Checkbox em modo bulk */}
                    {bulkMode && (
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    )}
                    <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-md uppercase border border-slate-200">
                      {edital.uf}{edital.municipio ? ` · ${edital.municipio}` : ''} • {edital.ano}
                    </span>
                    {edital.modalidade && (
                      <span className="text-[10px] font-black text-sky-700 bg-sky-50 px-2 py-1 rounded-md uppercase border border-sky-100">
                        {edital.modalidade}
                      </span>
                    )}
                    {/* Plataforma onde a disputa acontece (pregão eletrônico etc.) */}
                    {edital.plataforma && (
                      edital.link_sistema_origem ? (
                        <a
                          href={edital.link_sistema_origem}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Plataforma onde a disputa acontece — clique para abrir"
                          className="text-[10px] font-black text-teal-700 bg-teal-50 px-2 py-1 rounded-md border border-teal-200 hover:bg-teal-100 hover:border-teal-300 transition-colors"
                        >
                          🌐 {edital.plataforma} ↗
                        </a>
                      ) : (
                        <span
                          title="Plataforma onde a disputa acontece"
                          className="text-[10px] font-black text-teal-700 bg-teal-50 px-2 py-1 rounded-md border border-teal-200"
                        >
                          🌐 {edital.plataforma}
                        </span>
                      )
                    )}
                    {edital.tipo && edital.tipo !== 'Edital' && (
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded-md border border-sky-100">
                        {edital.tipo}
                      </span>
                    )}
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
                  {valorNum > 0 ? (
                    <span className="text-sm font-black text-slate-900 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg shadow-sm shrink-0">
                      {formatCurrency(valorNum)}
                    </span>
                  ) : (
                    <span
                      title="O órgão não divulgou o valor estimado — consulte o edital original"
                      className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200 px-2.5 py-1 rounded-lg shrink-0"
                    >
                      Orçamento sigiloso
                    </span>
                  )}
                </div>
                
                {/* ── Já analisado ─────────────────────────────────────────
                    Aparece ANTES do órgão de propósito: a informação que muda
                    a decisão de clicar é "eu já vi este edital", e ela precisa
                    chegar antes de a pessoa começar a ler o objeto de novo. */}
                {(() => {
                  const ja = jaAnalisados[chaveAnalise(edital.cnpj, edital.ano, edital.sequencial)];
                  if (!ja) return null;
                  const quando = ja.criada_em
                    ? new Date(ja.criada_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                    : '';
                  const rotuloVeredito = ja.veredito === 'GO' ? 'Participar'
                    : ja.veredito === 'NO_GO' ? 'Não participar'
                    : ja.veredito === 'GO_CONDICIONADO' ? 'Com validações' : '';
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();   // não dispara a seleção do card
                        onAbrirAnalise?.(ja.id);
                      }}
                      title={`Analisado em ${quando}. Clique para abrir o laudo no histórico.`}
                      className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700 transition-colors hover:border-violet-300 hover:bg-violet-100"
                    >
                      <History size={11} />
                      Já analisado {quando && `· ${quando}`}
                      {rotuloVeredito && ` · ${rotuloVeredito}`}
                      {ja.score !== null && ja.score !== undefined && ` · ${ja.score}`}
                      <ArrowRight size={11} />
                    </button>
                  );
                })()}

                <h3 className="font-bold text-slate-800 text-sm mb-2 line-clamp-1 pr-4">{edital.orgao}</h3>
                <p className={`text-slate-500 text-xs font-medium mb-1 ${isExpandido ? '' : 'line-clamp-2'}`}>
                  {edital.objeto}
                </p>
                {objetoLongo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setObjetoExpandido(isExpandido ? null : editalKey);
                    }}
                    className="mb-2 text-[10px] font-black uppercase tracking-wide text-emerald-600 hover:text-emerald-800 transition-colors"
                  >
                    {isExpandido ? '− Ver menos' : '+ Ver descrição completa'}
                  </button>
                )}
                
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

                {/* JANELA DE PROPOSTAS — contagem real baseada nas datas do PNCP */}
                {diasRestantes !== null && diasRestantes >= 0 && (
                  <div className={`mb-5 rounded-xl border p-3.5 ${prazoCor.box}`}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${prazoCor.txt}`}>
                        <Timer className="w-3.5 h-3.5" strokeWidth={2.5} />
                        Janela de propostas
                      </span>
                      <span className={`text-xs font-black ${prazoCor.txt}`}>
                        {diasRestantes === 0
                          ? 'Encerra hoje'
                          : `Encerra em ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`}
                      </span>
                    </div>
                    {progressoJanela !== null && (
                      <div className={`h-1.5 w-full rounded-full overflow-hidden ${prazoCor.trk}`}>
                        <div
                          className={`h-full rounded-full transition-all ${prazoCor.bar}`}
                          style={{ width: `${progressoJanela}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {/* BOTÕES DE AÇÃO */}
                <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                  <button
                    onClick={() => {
                      if (loadingId === edital.id) {
                        handleCancelAnalyze();
                        return;
                      }
                      const cnpjInvalido = !edital.cnpj || String(edital.cnpj) === "undefined";
                      const anoInvalido = !edital.ano || String(edital.ano) === "undefined";
                      const seqInvalido = !edital.sequencial || String(edital.sequencial) === "undefined";

                      if (cnpjInvalido || anoInvalido || seqInvalido) {
                        setError("Dados incompletos neste edital (CNPJ, ano ou sequencial ausente). Tente outro edital ou acesse o link original.");
                        return;
                      }
                      dispararAnaliseUnica(edital);
                    }}
                    disabled={loadingId !== null && loadingId !== edital.id}
                    className={`flex-1 font-black py-3 px-4 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                      loadingId === edital.id
                        ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                        : 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-500 disabled:cursor-not-allowed'
                    }`}
                  >
                    {loadingId === edital.id ? (
                      <><span className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></span> Cancelar extração</>
                    ) : 'Extrair e Analisar IA ⚡'}
                  </button>
                  {edital.link_sistema_origem && (
                    <a
                      href={edital.link_sistema_origem}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={`Abrir a disputa${edital.plataforma ? ` na ${edital.plataforma}` : ' na plataforma de origem'}`}
                      className="sm:w-auto px-5 py-3 bg-teal-50 text-teal-700 font-black rounded-xl text-xs border border-teal-200 hover:bg-teal-100 transition-all flex items-center justify-center gap-1.5"
                    >
                      Ir para a disputa ↗
                    </a>
                  )}
                  {onMedirFolego && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMedirFolego(valorNum || 0, String(edital.objeto || ''));
                      }}
                      title="Abre o Fôlego Financeiro com o valor e o objeto deste edital já preenchidos"
                      className="sm:w-auto px-5 py-3 bg-amber-50 text-amber-700 font-black rounded-xl text-xs border border-amber-200 hover:bg-amber-100 transition-all flex items-center justify-center gap-1.5"
                    >
                      💰 Medir fôlego
                    </button>
                  )}
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

      <CnaeMismatchModal
        isOpen={cnaeConfirm !== null}
        empresaNome={empresaAtiva?.razao_social || empresaAtiva?.nome_fantasia || empresaAtiva?.nome}
        cnaeDescricao={empresaAtiva?.cnae_descricao || empresaAtiva?.core_business}
        objetoEdital={
          cnaeConfirm?.tipo === 'unico'
            ? cnaeConfirm.edital.objeto
            : cnaeConfirm?.editais.slice(0, 2).map((e) => e.objeto).join(' • ')
        }
        notaAdicional={
          cnaeConfirm?.tipo === 'lote'
            ? `${cnaeConfirm.totalFora} de ${cnaeConfirm.editais.length} editais selecionados parecem fora do seu CNAE.`
            : undefined
        }
        onCancel={() => setCnaeConfirm(null)}
        onConfirm={() => {
          if (!cnaeConfirm) return;
          if (cnaeConfirm.tipo === 'unico') {
            handleDeepAnalyze(cnaeConfirm.edital);
          } else {
            executarBulkAnalyze(cnaeConfirm.editais);
          }
          setCnaeConfirm(null);
        }}
      />
    </div>
  );
}
