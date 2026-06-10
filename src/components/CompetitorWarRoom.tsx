'use client';

import React, { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import { Target, FileSearch, Award, SearchX, ArrowLeft, Crosshair, AlertTriangle, ListFilter, Clipboard, Eye, Building2, ExternalLink, ShieldAlert, ShieldCheck, Activity, Scale, Lightbulb, Map, Bot, CalendarDays, DollarSign, Shield, ClipboardList, Zap } from 'lucide-react';
import ReverseEngineeringBlock from './ReverseEngineeringBlock';
import CompliancePanel from './CompliancePanel';

// ─── Tipos do domínio ────────────────────────────────────────────────────────

export interface PrecoUnitarioMeta {
  valor?: number | string;
  fonte?: string;
  confianca?: number;
  descricao?: string;
  quantidade?: number | string;
  unidade?: string;
  metodo?: string;
  alerta?: string | null;
  valorTotalItem?: number | string;
}

export interface ContratoData {
  numeroControlePNCP?: string;
  objetoContrato?: string;
  valorGlobalContrato?: number;
  dataAssinatura?: string;
  orgao?: string;
  uf?: string;
  valorUnitario?: number | string | PrecoUnitarioMeta;
  precoUnitario?: PrecoUnitarioMeta | null;
  fontePreco?: string;
  confiancaPreco?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ConcorrenteData {
  nome: string;
  cnpj?: string;
  cleanCnpj?: string;
  uf?: string;
  uf_disputa?: string;
  uf_contrato?: string;
  uf_empresa?: string;
  vitorias?: number | string;
  /** Campo de probabilidade (alias usado em alguns contextos: prob) */
  probabilidade?: string;
  prob?: string;
  forca?: string;
  capital_social?: string;
  porte?: string;
  municipio?: string;
  cnae?: string;
  contratos?: ContratoData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawDataOriginal?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface PricingIntelligenceData {
  valor_estimado_raw?: number | string;
  valor_estimado_sigiloso?: boolean;
  estimated_discount?: string;
  market_analysis?: string;
  financial_verdict?: string;
  desagioPreditivoOrgao?: number;
  nivelAmeaca?: string;
  perfilVencedor?: string;
  valorMedioUnitarioMercado?: number;
  valorMinimoUnitarioMercado?: number;
  valorMedioUnitarioRegional?: number;
  valorMinimoUnitarioRegional?: number;
  amostraPrecosUnitarios?: number;
  amostraPrecosUnitariosRegional?: number;
  evidenciasPrecosUnitarios?: Array<Record<string, any>>;
  evidenciasPrecosUnitariosRegionais?: Array<Record<string, any>>;
  /** Fonte mais confiável usada nos preços unitários */
  fonteConfiabilidade?: 'PNCP_HOMOLOGADO' | 'DB_ESTRUTURADO' | 'DB_CALCULADO' | 'ESTIMADO';
  /** True quando não havia dados e o sistema usou o deságio padrão de 18.5% */
  usandoDefaultFallback?: boolean;
  /** Intervalo das amostras de preço (formato "YYYY-MM") */
  intervaloAmostral?: { inicio: string; fim: string };
  objeto?: string;
  link_pncp?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engenharia_reversa?: Record<string, any>;
  itens_lotes?: Array<{
    numero: string;
    produto: string;
    valor_estimado_raw: number;
    quantidade: number;
    desagioPreditivoOrgao?: number;
  }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface FullResultData {
  estimated_value?: string;
  summary?: string;
  description?: string;
  title?: string;
  objeto?: string;
  termo_busca_pncp?: string;
  uf?: string;
  link_pncp?: string;
  link_edital?: string;
  url?: string;
  link_original?: string;
  link?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pricing_intelligence?: PricingIntelligenceData | Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  concorrentes_provaveis?: ConcorrenteData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  concorrentes_regionais?: ConcorrenteData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  war_room_cache?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface FalhaDetectada {
  tipo: string;
  gravidade: 'ALTA' | 'MEDIA' | 'BAIXA';
  descricao_tecnica: string;
  fundamentacao_legal: string;
}

export interface AnaliseOfensivaData {
  concorrente_razao_social: string;
  concorrente_cnpj: string;
  vulnerabilidades: FalhaDetectada[];
  recomendacao_tatica: string;
  rascunho_recurso?: {
    assunto: string;
    tese_juridica: string;
    pedidos: string[];
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CompetitorWarRoomProps {
  competitorsNacionais?: ConcorrenteData[];
  competitorsRegionais?: ConcorrenteData[];
  uf?: string;
  pricing?: PricingIntelligenceData;
  analysisId?: string;
  userTier?: number;
  fullResult?: FullResultData;
}

export default function CompetitorWarRoom({ 
  competitorsNacionais = [], 
  competitorsRegionais = [], 
  uf = "BR",
  pricing = {}, 
  analysisId, 
  userTier = 1,
  fullResult = {}
}: CompetitorWarRoomProps) {
  
  const warRoomRef = useRef<HTMLDivElement>(null);
  const operationRef = useRef<HTMLDivElement>(null);
  const pendingOperationScrollRef = useRef(false);
  const [view, setView] = useState<'radar' | 'operation'>('radar');
  const [abaConcorrentes, setAbaConcorrentes] = useState<'nacional' | 'regional'>('nacional');
  const [target, setTarget] = useState<ConcorrenteData | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [offensiveData, setOffensiveData] = useState<AnaliseOfensivaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedItemIdx, setSelectedItemIdx] = useState<number>(0);
  const [dossieTarget, setDossieTarget] = useState<ConcorrenteData | null>(null);
  const [dossieContracts, setDossieContracts] = useState<ContratoData[] | null>(null);

  const [sancoesStatus, setSancoesStatus] = useState<'idle' | 'loading' | 'clean' | 'dirty' | 'error'>('idle');
  const [sancoesLista, setSancoesLista] = useState<any[]>([]);

  // Feedback de cópia — guarda o key do botão que acabou de copiar por 2s
  const [copiadoKey, setCopiadoKey] = useState<string | null>(null);
  const copiar = (texto: string, key: string) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiadoKey(key);
      setTimeout(() => setCopiadoKey(null), 2000);
    });
  };

  const linkEditalPrincipal = fullResult?.link_pncp || fullResult?.link_edital || fullResult?.url || fullResult?.link_original || fullResult?.link || pricing?.link_pncp;

  const getSancoesLink = (cnpjBase?: string) => {
    if (!cnpjBase) return null;
    const clean = String(cnpjBase).replace(/\D/g, '');
    if (clean.length < 11) return null;
    return `https://portaldatransparencia.gov.br/sancoes/consulta?cadastro=1&cadastro=2&cpfCnpj=${clean}&ordenarPor=nomeSancionado&direcao=asc`;
  };

  const extrairValorExato = (textoBase: any): number => {
    if (!textoBase) return 0;
    if (typeof textoBase === 'number') return textoBase > 0 ? textoBase : 0;
    const texto = String(textoBase);
    const matches = [...texto.matchAll(/R\$\s*([\d\.,]+)/g)];
    let valStr = matches.length > 0 ? matches[0][1] : texto.replace(/[^\d,.-]/g, '');
    
    if (valStr.includes('.') && !valStr.includes(',')) {
        const partes = valStr.split('.');
        if (partes[partes.length - 1].length !== 3) return parseFloat(valStr) || 0;
    }
    const limpo = valStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  };

  const minerarDadosDoResumo = (texto: string) => {
    if (!texto) return { quantidade: 1, valorGlobal: 0, valorUnitario: 0 };
    let quantidade = 1, valorGlobal = 0, valorUnitario = 0;

    const matchQtd = texto.match(/(?:quantidade|qtd|quant|fornecimento|aquisi[çc][ãa]o\s+de)[\s\S]{0,40}?(?:\b|:)\s*([\d\.]+)\s*(?:unidade|un|cx|caixa|frasco|fr|ampola|pe[çc]a|comprimido|comp|kit)/i) 
                  || texto.match(/quantidade[\s\S]*?de\s*([\d\.]+)/i);
    if (matchQtd) {
        const limpo = matchQtd[1].replace(/\./g, '');
        quantidade = parseInt(limpo, 10) || 1;
    }

    const matchUnit = texto.match(/(?:valor\s+unit[aá]rio|unit[aá]rio|a\s+r\$|cada)[\s\S]{0,15}?r\$\s*([\d\.,]+)/i);
    if (matchUnit) valorUnitario = extrairValorExato(matchUnit[1]);

    const matchTotal = texto.match(/(?:totalizando|total\s+de|valor\s+global|valor\s+total|estimado\s+em|valor\s+de)[\s\S]{0,15}?r\$\s*([\d\.,]+)/i);
    if (matchTotal) valorGlobal = extrairValorExato(matchTotal[1]);

    if (valorGlobal === 0 && valorUnitario > 0) valorGlobal = valorUnitario * quantidade;
    if (valorUnitario === 0 && valorGlobal > 0 && quantidade > 1) valorUnitario = valorGlobal / quantidade;

    return { quantidade, valorGlobal, valorUnitario };
  };

  const valorEstimatedSeguro = useMemo(() => {
    if (pricing?.valor_estimado_sigiloso) return 0;

    // PRIORIDADE 1: valor global do contrato vindo do backend (nível superior)
    const vEdital = extrairValorExato(pricing?.valor_estimado_raw) || extrairValorExato(fullResult?.estimated_value);
    if (vEdital > 0) return vEdital;

    // PRIORIDADE 2: minerar do resumo da IA (texto livre)
    const dadosMinerados = minerarDadosDoResumo((fullResult?.summary || fullResult?.description) ?? '');
    if (dadosMinerados.valorGlobal > 0) return dadosMinerados.valorGlobal;

    // PRIORIDADE 3 (último recurso): soma dos itens/lotes — pode ser unitário, usar só se nada acima existir
    let soma = 0;
    if (pricing?.itens_lotes && Array.isArray(pricing.itens_lotes)) {
        soma = pricing.itens_lotes.reduce((acc: number, item: { valor_estimado_raw: number }) => acc + extrairValorExato(item.valor_estimado_raw), 0);
    }
    if (soma > 0) return soma;

    return extrairValorExato(fullResult?.summary ?? '') || 0;
  }, [pricing, fullResult]);

  const nomeObjetoReal = fullResult?.termo_busca_pncp || fullResult?.objeto || pricing?.objeto || fullResult?.title || "Licitação";

  const itensLotes = useMemo(() => {
    if (pricing?.itens_lotes && Array.isArray(pricing.itens_lotes) && pricing.itens_lotes.length > 0) return pricing.itens_lotes;
    
    const dadosMinerados = minerarDadosDoResumo((fullResult?.summary || fullResult?.description) ?? '');
    if (dadosMinerados.valorGlobal > 0) {
      return [{ numero: "Lote", produto: nomeObjetoReal, valor_estimado_raw: dadosMinerados.valorGlobal, quantidade: dadosMinerados.quantidade, desagioPreditivoOrgao: pricing?.desagioPreditivoOrgao || 19.7 }];
    }

    return [{ numero: "Global", produto: nomeObjetoReal, valor_estimado_raw: valorEstimatedSeguro, quantidade: 1, desagioPreditivoOrgao: pricing?.desagioPreditivoOrgao || 0 }];
  }, [pricing, valorEstimatedSeguro, nomeObjetoReal, fullResult]);

  const currentItem = itensLotes[selectedItemIdx] || itensLotes[0];

  const tetoUnitarioAtual = useMemo(() => {
      const v = extrairValorExato(currentItem?.valor_estimado_raw);
      let q = currentItem?.quantidade > 1 ? currentItem.quantidade : 1;
      if (q === 1) {
          const extra = minerarDadosDoResumo(fullResult?.summary || "");
          if (extra.quantidade > 1) q = extra.quantidade;
      }
      if (q === 1 && v > 2000) return -1; // -1 = Lote Global
      return v > 0 ? v / q : 0;
  }, [currentItem, fullResult]);

  const parseCompetitors = (rawList: any[], tipo: 'nacional' | 'regional') => {
    if (!Array.isArray(rawList)) return [];
    return rawList.map(item => {
      let nome = "Empresa não identificada", cnpj = "", porte = "DEMAIS", municipio = "Não Informado";
      let vitorias = "0";

      if (typeof item === 'string') {
        const match = item.match(/(.*?)\s*\(([\d]+)\s*vitórias?\)(?:\s*-\s*CNPJ:\s*([\d]+))?/i);
        if (match) { nome = match[1].trim(); vitorias = match[2] || "0"; cnpj = match[3] || ""; } else { nome = item; }
      } else {
        nome = item.empresa || item.nome || item.razao_social || "Empresa não identificada";
        vitorias = item.vitorias || item.quantidade_vitorias || "0";
        cnpj = item.cnpj || item.cnpj_empresa || "";
        porte = item.porte || item.porte_empresa || "DEMAIS";
        municipio = item.municipio || item.cidade || item.municipio_empresa || "Não Informado";
      }

      // Extrair CNPJ (14 dígitos) embutido no nome quando o campo cnpj vem vazio do PNCP
      let cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, '') : "";
      if (!cleanCnpj) {
        const cnpjMatch = nome.match(/\b(\d{14})\b/);
        if (cnpjMatch) {
          cleanCnpj = cnpjMatch[1];
          cnpj = cnpjMatch[1];
          nome = nome.replace(cnpjMatch[0], '').replace(/\s{2,}/g, ' ').trim();
        }
      }
      const numVitorias = parseInt(String(vitorias).replace(/\D/g, ''), 10) || 0;
      const prob = `~${Math.min(95, 18 + (numVitorias * 7))}%`;
      const ufEmpresa = item.uf || item.uf_empresa || "";
      const ufDisputa = item.uf_disputa || item.uf_contrato || item.ufOrgao || item.orgao_uf || (tipo === 'regional' ? uf : "");

      return {
        ...item,
        nome,
        cnpj,
        cleanCnpj,
        vitorias: numVitorias,
        prob,
        tipo,
        porte,
        municipio,
        uf: ufEmpresa || ufDisputa || uf,
        uf_empresa: ufEmpresa,
        uf_disputa: ufDisputa,
        contratos: item.contratos || [],
        rawDataOriginal: item
      };
    });
  };

  const listaNacional = useMemo(() => parseCompetitors(competitorsNacionais, 'nacional'), [competitorsNacionais]);
  const listaRegional = useMemo(() => parseCompetitors(competitorsRegionais, 'regional'), [competitorsRegionais]);
  const listaAtiva = abaConcorrentes === 'nacional' ? listaNacional : listaRegional;

  useEffect(() => {
    if (abaConcorrentes === 'nacional' && listaNacional.length === 0 && listaRegional.length > 0) {
      setAbaConcorrentes('regional');
    }
  }, [abaConcorrentes, listaNacional.length, listaRegional.length]);

  const scrollToOperationTop = (behavior: ScrollBehavior = 'auto') => {
    if (typeof window === 'undefined') return;
    const element = operationRef.current || warRoomRef.current;
    if (!element) return;

    const offset = 96;
    const absoluteTop = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, absoluteTop), behavior });

    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      const canScroll = /(auto|scroll|overlay)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight;
      if (canScroll) {
        const parentTop = parent.getBoundingClientRect().top;
        const targetTop = element.getBoundingClientRect().top - parentTop + parent.scrollTop - 16;
        parent.scrollTo({ top: Math.max(0, targetTop), behavior });
      }
      parent = parent.parentElement;
    }
  };

  useLayoutEffect(() => {
    if (view !== 'operation' || !target || !pendingOperationScrollRef.current) return;
    scrollToOperationTop('auto');
  }, [view, target]);

  useEffect(() => {
    if (view !== 'operation' || !target || !pendingOperationScrollRef.current) return;
    const frame = requestAnimationFrame(() => scrollToOperationTop('auto'));
    const timerShort = window.setTimeout(() => scrollToOperationTop('auto'), 80);
    const timerLong = window.setTimeout(() => {
      scrollToOperationTop('smooth');
      pendingOperationScrollRef.current = false;
    }, 240);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timerShort);
      window.clearTimeout(timerLong);
    };
  }, [view, target]);

  // 🟢 A BALA DE PRATA: Baseline de preço a partir de referências explícitas no texto.
  // Usa APENAS preços encontrados via regex (mais confiáveis) e guarda
  // o MÁXIMO entre eles — servindo de âncora superior para filtros de absurdo.
  // Não usa o heurístico "< 10% do lote" pois este aceita lixo (ex: R$ 0,38 de
  // um contrato de R$ 50.000 com 130.000 unidades passa o teste e vira baseline).
  const trustedBaselinePrice = useMemo(() => {
    let maxRegex = 0;
    const allComps = [...listaNacional, ...listaRegional];

    allComps.forEach(comp => {
        const conts = comp.contratos?.length > 0 ? comp.contratos : (comp.rawDataOriginal?.contratos || []);
        conts.forEach((c: any) => {
            if (typeof c === 'string') return;
            const objText = String(c.objeto || c.descricao || "").toLowerCase();
            // Só aceita preços declarados explicitamente como unitários no texto
            const match = objText.match(/(?:unit[aá]rio|unidade|cada|r\$\s*[\d\.,]+\s*\/\s*(?:un|cx|fr))[\s:=]*r?\$\s*([\d\.,]+)/i);
            if (match) {
                const vRegex = extrairValorExato(match[1]);
                if (vRegex > maxRegex) maxRegex = vRegex;
            }
        });
    });

    return maxRegex; // 0 se nenhuma referência explícita foi encontrada
  }, [listaNacional, listaRegional]);

  // ── Guard central de sanidade ──────────────────────────────────────────────
  // Centralizado aqui para ser reutilizado tanto por extrairUnitarioInteligente
  // quanto por lerUnitarioConfiavel (evitando o bug onde raw bypassava os checks).
  const getPrecoMeta = (contrato: any): PrecoUnitarioMeta | null => {
    const meta =
      contrato?.precoUnitario ??
      contrato?.preco_unitario_meta ??
      (typeof contrato?.valorUnitario === 'object' ? contrato.valorUnitario : null);
    if (meta && typeof meta === 'object') return meta as PrecoUnitarioMeta;
    return null;
  };

  const getFontePreco = (contrato: any): string => {
    const meta = getPrecoMeta(contrato);
    return String(meta?.fonte ?? contrato?.fontePreco ?? '').toUpperCase();
  };

  const formatarFontePreco = (fonteRaw?: string): string => {
    const fonte = String(fonteRaw || '').toUpperCase();
    const labels: Record<string, string> = {
      PNCP_HOMOLOGADO: 'PNCP homologado',
      PNCP_ESTRUTURADO: 'PNCP estruturado',
      PNCP_ESTIMADO: 'PNCP estimado',
      PNCP_CALCULADO: 'PNCP calculado',
      PNCP_CAPA_RATEIO: 'Rateio capa',
      DB_ESTRUTURADO: 'Base estruturada',
      DB_CALCULADO: 'Base calculada',
      TEXTO_REGEX: 'Texto do contrato',
      FRONT_CALCULADO: 'Estimado',
    };
    return labels[fonte] || fonte || '';
  };

  const isFontePrecoAltaConfianca = (meta?: PrecoUnitarioMeta | null, contrato?: any): boolean => {
    const fonte = String(meta?.fonte ?? contrato?.fontePreco ?? '').toUpperCase();
    const confianca = Number(meta?.confianca ?? contrato?.confiancaPreco ?? 0);
    return ['PNCP_HOMOLOGADO', 'DB_ESTRUTURADO', 'PNCP_ESTRUTURADO'].includes(fonte) || confianca >= 0.85;
  };

  const isFontePrecoEstruturada = (meta?: PrecoUnitarioMeta | null, contrato?: any): boolean => {
    const fonte = String(meta?.fonte ?? contrato?.fontePreco ?? '').toUpperCase();
    return isFontePrecoAltaConfianca(meta, contrato) || ['DB_CALCULADO', 'PNCP_ESTIMADO', 'PNCP_CALCULADO'].includes(fonte);
  };

  const isValorUnitarioAbsurdo = (val: number, globalDoContrato: number, meta?: PrecoUnitarioMeta | null): boolean => {
      if (val <= 0) return true;
      const fonteAltaConfianca = isFontePrecoAltaConfianca(meta);
      const fonteEstruturada = isFontePrecoEstruturada(meta);

      // 1. Mentira do Lote: unitário ≥ 50% do total → provavelmente é o total, não a unidade
      // Exceção: campo unitário oficial/estruturado já vem separado do total.
      if (globalDoContrato > 2000 && val >= (globalDoContrato * 0.5) && !fonteAltaConfianca) return true;

      // 2. Mentira do Anão: valor abaixo de 2% da baseline conhecida → lixo de divisão
      //    (ex: R$ 50.000 / 130.000 un = R$ 0,38 é rejeitado quando baseline ≥ R$ 19)
      if (!fonteAltaConfianca && trustedBaselinePrice > 0 && val < (trustedBaselinePrice * 0.02)) return true;

      // 3. Mentira do Gigante: acima de 100× a baseline (absurdamente alto)
      if (!fonteAltaConfianca && trustedBaselinePrice > 0 && val > (trustedBaselinePrice * 100)) return true;

      // 4. Mentira do Teto: superior a 5× o teto unitário do edital atual
      if (!fonteEstruturada && tetoUnitarioAtual > 0 && tetoUnitarioAtual !== -1 && val > (tetoUnitarioAtual * 5)) return true;

      // 5. Mentira Extrema: unitário ≥ orçamento global de toda a licitação
      if (!fonteEstruturada && valorEstimatedSeguro > 0 && val >= valorEstimatedSeguro) return true;

      // 6. Mentira do Pó: só usa piso do edital quando há teto unitário conhecido.
      // Em edital de lote global (sem breakdown por item), preços unitários reais
      // podem ser muito menores que 0,01% do lote e não devem virar "Oculto".
      if (!fonteEstruturada && tetoUnitarioAtual > 0 && valorEstimatedSeguro > 5000 && val < (valorEstimatedSeguro * 0.0001)) return true;

      return false;
  };

  // 🟢 EXTRATOR MATEMÁTICO BLINDADO
  const extrairUnitarioInteligente = (contrato: any, minConfidence = 0.45) => {
    const globalDoContratoAntigo = extrairValorExato(contrato.valor || contrato.valorTotal || 0);
    const meta = getPrecoMeta(contrato);
    const metaCompat = meta ?? { fonte: contrato?.fontePreco, confianca: contrato?.confiancaPreco };
    const confianca = Number(metaCompat?.confianca ?? 1);
    const rawBackend = meta && confianca < minConfidence
      ? (contrato.preco_unitario ?? contrato.valor_unitario ?? 0)
      : (meta?.valor ?? contrato.valorUnitario ?? contrato.preco_unitario ?? contrato.valor_unitario ?? 0);
    const v = extrairValorExato(rawBackend);

    if (!isValorUnitarioAbsurdo(v, globalDoContratoAntigo, metaCompat)) return v;

    // Tenta caçar no texto se o valor da API for mentira
    const objText = String(contrato.objeto || contrato.descricao || "").toLowerCase();
    const regexUnitarios = [
        /(?:unit[aá]rio|unit|unidade|por\s+item|cada|a\s+r\$|r\$\s*[\d\.,]+\s*(?:\/|\s*por\s*)\s*(?:un|cx|caixa|frasco|fr|ampola|mg|g|ml|kit))[\s:=]*r?\$\s*([\d\.,]+)/i,
        /r\$\s*([\d\.,]+)\s*(?:\(unit|\/un|\/cx|\/fr)/i
    ];

    for (const regex of regexUnitarios) {
        const match = objText.match(regex);
        if (match) {
            const vEncontrado = extrairValorExato(match[1]);
            if (!isValorUnitarioAbsurdo(vEncontrado, globalDoContratoAntigo, { fonte: 'TEXTO_REGEX', confianca: 0.55 })) return vEncontrado;
        }
    }

    // Fallback Matemático
    const dadosMinerados = minerarDadosDoResumo(objText);
    if (globalDoContratoAntigo > 0 && dadosMinerados.quantidade > 1) {
        const fallback = globalDoContratoAntigo / dadosMinerados.quantidade;
        if (!isValorUnitarioAbsurdo(fallback, globalDoContratoAntigo, { fonte: 'FRONT_CALCULADO', confianca: 0.32, quantidade: dadosMinerados.quantidade })) return fallback;
    }

    return 0; // Oculto com segurança extrema.
  };

  // Lê o valorUnitario direto do backend e valida com os mesmos guards do extrator.
  // Antes este caminho bypassava todos os checks; agora raw também é validado.
  const lerUnitarioConfiavel = (c: any, minConfidence = 0.45): number => {
      const meta = getPrecoMeta(c);
      const metaCompat = meta ?? { fonte: c?.fontePreco, confianca: c?.confiancaPreco };
      const confianca = Number(metaCompat?.confianca ?? 1);
      const rawBackend = meta && confianca < minConfidence
        ? (c.preco_unitario ?? c.valor_unitario ?? 0)
        : (meta?.valor ?? c.valorUnitario ?? c.preco_unitario ?? c.valor_unitario ?? 0);
      const raw = extrairValorExato(rawBackend);
      const globalDoContrato = extrairValorExato(c.valor || c.valorTotal || 0);
      if (raw > 0 && confianca >= minConfidence && !isValorUnitarioAbsurdo(raw, globalDoContrato, metaCompat)) return raw;
      return extrairUnitarioInteligente(c, minConfidence);
  };

  const getMenorUnitario = (lista: any[]) => {
      let menor = Infinity;
      lista.forEach(comp => {
          const conts = comp.contratos?.length > 0 ? comp.contratos : (comp.rawDataOriginal?.contratos || []);
          if (Array.isArray(conts)) {
              conts.forEach((c: any) => {
                  if (typeof c !== 'string') {
                      const v = lerUnitarioConfiavel(c);
                      if (v > 0 && v < menor) menor = v;
                  }
              });
          }
      });
      return menor === Infinity ? 0 : menor;
  };

  const menorNacional = useMemo(() => getMenorUnitario(listaNacional), [listaNacional, tetoUnitarioAtual, trustedBaselinePrice, valorEstimatedSeguro]);
  const menorRegional = useMemo(() => getMenorUnitario(listaRegional), [listaRegional, tetoUnitarioAtual, trustedBaselinePrice, valorEstimatedSeguro]);
  const menorNacionalMercado = Number(pricing?.valorMinimoUnitarioMercado) || 0;
  const menorRegionalMercado = Number(pricing?.valorMinimoUnitarioRegional) || 0;

  const ultimoVencidoAlvo = useMemo(() => {
      if (!dossieContracts || dossieContracts.length === 0) return 0;
      for (const c of dossieContracts) {
         if (typeof c !== 'string') {
             const v = lerUnitarioConfiavel(c);
             if (v > 0) return v;
         }
      }
      return 0;
  }, [dossieContracts, tetoUnitarioAtual, trustedBaselinePrice]);

  // ── Filtro de coerência pelo alvo (camada de display) ─────────────────────
  // Quando temos o "Último Vencido" como âncora de mercado, rejeitamos menores
  // que estão < 3% desse valor — são claramente de produtos/segmentos diferentes.
  // Sem âncora (ultimoVencidoAlvo = 0) o guard de piso do lote já cobre o grosso.
  const menorNacionalExibido = useMemo(() => {
      const menor = menorNacional > 0 ? menorNacional : menorNacionalMercado;
      if (menor <= 0) return 0;
      if (ultimoVencidoAlvo > 0 && menor < ultimoVencidoAlvo * 0.03) return 0;
      return menor;
  }, [menorNacional, menorNacionalMercado, ultimoVencidoAlvo]);

  const menorRegionalExibido = useMemo(() => {
      const menor = menorRegional > 0 ? menorRegional : menorRegionalMercado;
      if (menor <= 0) return 0;
      if (ultimoVencidoAlvo > 0 && menor < ultimoVencidoAlvo * 0.03) return 0;
      return menor;
  }, [menorRegional, menorRegionalMercado, ultimoVencidoAlvo]);

  const formatarMoeda = (valor: number): string =>
    valor > 0
      ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'Indisponível';

  const getNumeroVitorias = (valor: any): number =>
    parseInt(String(valor ?? 0).replace(/\D/g, ''), 10) || 0;

  const getUfDisputa = (concorrente: ConcorrenteData): string =>
    String(concorrente.uf_disputa || concorrente.uf_contrato || concorrente.contratos?.[0]?.uf_disputa || concorrente.contratos?.[0]?.uf || '').toUpperCase();

  const isConcorrenteRegional = (concorrente: ConcorrenteData): boolean =>
    getUfDisputa(concorrente) === String(uf || '').toUpperCase() || concorrente.tipo === 'regional';

  const getScoreConcorrente = (concorrente: ConcorrenteData): number => {
    const probOrder: Record<string, number> = { Alta: 3, Média: 2, Media: 2, Baixa: 1 };
    const forcaOrder: Record<string, number> = { Tubarão: 4, Agressivo: 3, Conservador: 2, Iniciante: 1 };
    const vitorias = getNumeroVitorias(concorrente.vitorias);
    const probabilidade = String(concorrente.probabilidade || concorrente.prob || 'Média');
    const probPercent = Number(probabilidade.match(/(\d+)/)?.[1] || 0);
    const scoreProbabilidade = probPercent > 0
      ? probPercent >= 70 ? 3 : probPercent >= 40 ? 2 : 1
      : probOrder[probabilidade.replace('é', 'e')] ?? 2;
    const scoreForca = forcaOrder[String(concorrente.forca || '')] ?? 2;
    const scoreRegional = isConcorrenteRegional(concorrente) ? 5 : 0;
    return (scoreProbabilidade * 10) + scoreForca + Math.min(vitorias, 20) + scoreRegional;
  };

  const concorrentesRanqueadosAtivos = useMemo(() => (
    [...listaAtiva]
      .map(c => ({ ...c, threatScore: getScoreConcorrente(c) }))
      .sort((a, b) => b.threatScore - a.threatScore)
  ), [listaAtiva, uf]);

  const concorrentesRanqueadosTodos = useMemo(() => (
    [...listaNacional, ...listaRegional]
      .map(c => ({ ...c, threatScore: getScoreConcorrente(c) }))
      .sort((a, b) => b.threatScore - a.threatScore)
  ), [listaNacional, listaRegional, uf]);

  const desagioPrevisto = useMemo(() => {
    const direto = Number(pricing?.desagioPreditivoOrgao);
    if (direto > 0) return direto;
    const texto = String(pricing?.estimated_discount || '').replace(',', '.');
    const match = texto.match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }, [pricing]);

  const vereditoCompetitivo = useMemo(() => {
    const principal = concorrentesRanqueadosTodos[0] || null;
    const threatPct = principal ? Math.min(100, Math.round((principal.threatScore / 60) * 100)) : 0;
    const totalConcorrentes = concorrentesRanqueadosTodos.length;
    const nivelRaw = String(pricing?.nivelAmeaca || '').toUpperCase();
    const nivel =
      nivelRaw.includes('ALTO') || threatPct >= 80 ? 'ALTA' :
      nivelRaw.includes('MODERADO') || nivelRaw.includes('MEDIO') || threatPct >= 55 ? 'MODERADA' :
      totalConcorrentes > 0 ? 'BAIXA' : 'INDEFINIDA';
    const faixaMinDesagio = desagioPrevisto > 0 ? Math.max(0, desagioPrevisto - 4) : 0;
    const faixaMaxDesagio = desagioPrevisto > 0 ? desagioPrevisto + 4 : 0;
    const precoMin = valorEstimatedSeguro > 0 && faixaMaxDesagio > 0 ? valorEstimatedSeguro * (1 - faixaMaxDesagio / 100) : 0;
    const precoMax = valorEstimatedSeguro > 0 && faixaMinDesagio > 0 ? valorEstimatedSeguro * (1 - faixaMinDesagio / 100) : 0;
    const amostra = Number(pricing?.amostraPrecosUnitarios || pricing?.amostraPrecosUnitariosRegional || 0);
    const fonte = String(pricing?.fonteConfiabilidade || '');
    const confianca =
      pricing?.usandoDefaultFallback ? 'Estimativa frágil' :
      fonte === 'PNCP_HOMOLOGADO' && amostra >= 3 ? 'Alta' :
      fonte && amostra > 0 ? 'Média' :
      totalConcorrentes > 0 ? 'Parcial' : 'Baixa';

    const estrategia =
      nivel === 'ALTA'
        ? 'Participar somente se o preço mínimo preservar margem e a habilitação estiver blindada.'
        : nivel === 'MODERADA'
          ? 'Entrar com preço disciplinado, revisar atestados e monitorar o concorrente principal.'
          : nivel === 'BAIXA'
            ? 'Disputa favorável, mas confirme preço de corte e exigências antes de consumir equipe.'
            : 'Aguardar mais dados de mercado antes de tratar a disputa como previsível.';

    const dadoFragil =
      pricing?.usandoDefaultFallback
        ? 'Sem histórico suficiente: o deságio usa premissa padrão e precisa ser validado.'
        : amostra === 0
          ? 'Sem amostra de preço unitário confiável para este objeto.'
          : fonte !== 'PNCP_HOMOLOGADO'
            ? 'A fonte de preço não é homologada no PNCP; use como orientação, não como certeza.'
            : 'Amostra baseada em contratos oficiais, ainda sujeita à similaridade do objeto.';

    return {
      principal,
      nivel,
      threatPct,
      totalConcorrentes,
      faixaDesagio: desagioPrevisto > 0 ? `${faixaMinDesagio.toFixed(1)}% a ${faixaMaxDesagio.toFixed(1)}%` : 'Sem faixa segura',
      faixaPreco: precoMin > 0 && precoMax > 0 ? `${formatarMoeda(precoMin)} a ${formatarMoeda(precoMax)}` : 'Depende do orçamento detalhado',
      confianca,
      estrategia,
      dadoFragil,
    };
  }, [concorrentesRanqueadosTodos, desagioPrevisto, pricing, valorEstimatedSeguro]);

  const explicarConcorrente = (concorrente: ConcorrenteData): string => {
    const motivos: string[] = [];
    const vitorias = getNumeroVitorias(concorrente.vitorias);
    const ufDisputa = getUfDisputa(concorrente);
    if (isConcorrenteRegional(concorrente)) motivos.push(`tem histórico na UF do edital${ufDisputa ? ` (${ufDisputa})` : ''}`);
    if (vitorias > 0) motivos.push(`${vitorias} vitória${vitorias > 1 ? 's' : ''} recente${vitorias > 1 ? 's' : ''}`);
    if (concorrente.forca) motivos.push(`perfil ${String(concorrente.forca).toLowerCase()}`);
    if (concorrente.cnae) motivos.push('CNAE informado');
    if (motivos.length === 0) return 'Há sinais competitivos, mas a base ainda não explica completamente a ameaça.';
    return motivos.slice(0, 3).join(', ') + '.';
  };

  const recomendarAcaoConcorrente = (concorrente: ConcorrenteData, posicao: number): string => {
    const regional = isConcorrenteRegional(concorrente);
    if (posicao === 0 && regional) return 'Validar preço mínimo, atestados e vantagem regional antes da proposta.';
    if (posicao === 0) return 'Simular margem contra o deságio provável e revisar habilitação.';
    if (regional) return 'Monitorar participação local e preparar resposta de preço.';
    return 'Usar como referência de preço e histórico, sem consumir esforço jurídico pesado.';
  };

  const fetchSancoes = async (cnpjToFind: string) => {
    setSancoesStatus('loading');
    try {
        const token = localStorage.getItem('bawzi_token') || '';
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/fornecedor/sancoes/${cnpjToFind}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Falha");
        const json = await res.json();
        if (json?.possui_sancoes || (json?.sancoes && json.sancoes.length > 0)) {
            setSancoesStatus('dirty');
            setSancoesLista(json.sancoes || []);
        } else { setSancoesStatus('clean'); }
    } catch (e) { setSancoesStatus('error'); }
  };

  const normalizarTexto = (texto: any): string =>
    String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const getTokensItemAtual = (): string[] => {
    const stop = new Set(['aquisicao', 'contratacao', 'fornecimento', 'registro', 'precos', 'preco', 'para', 'com', 'das', 'dos', 'uma', 'uns', 'lote', 'global']);
    const base = normalizarTexto(`${currentItem?.produto || ''} ${nomeObjetoReal || ''}`);
    return Array.from(new Set((base.match(/[a-z0-9]+/g) || []).filter(t => t.length >= 3 && !stop.has(t))));
  };

  const contratoCompativelComItemAtual = (contrato: any): boolean => {
    const tokens = getTokensItemAtual();
    if (tokens.length === 0) return true;

    const texto = normalizarTexto(
      typeof contrato === 'string'
        ? contrato
        : `${contrato?.objeto || ''} ${contrato?.descricao || ''} ${contrato?.objetoContrato || ''}`
    );
    if (!tokens.some(t => texto.includes(t))) return false;

    const produtosSensiveis = ['cadeira', 'mesa', 'armario', 'estante', 'poltrona', 'sofa', 'mobiliario', 'computador', 'notebook', 'tablet', 'impressora'];
    const servicoMarkers = ['servico', 'servicos', 'limpeza', 'conservacao', 'higienizacao', 'apoio a edificios', 'apoio a predios', 'condominios prediais', 'manutencao predial', 'areas internas', 'areas externas', 'ambientes destinados', 'mobiliarios e outros'];
    const fornecimentoMarkers = ['aquisicao', 'compra', 'fornecimento', 'registro de preco', 'registro de precos', 'mobiliario', 'moveis'];

    const tokensProduto = tokens.filter(t => produtosSensiveis.some(p => t.startsWith(p) || p.startsWith(t)));
    if (tokensProduto.length === 0 || !servicoMarkers.some(m => texto.includes(m))) return true;

    const posicoes = tokensProduto.map(t => texto.indexOf(t)).filter(pos => pos >= 0);
    if (posicoes.length === 0) return false;

    const primeiraMencao = Math.min(...posicoes);
    const contextoAnterior = texto.slice(Math.max(0, primeiraMencao - 90), primeiraMencao);
    if (fornecimentoMarkers.some(m => contextoAnterior.includes(m))) return true;

    return primeiraMencao <= 80;
  };

  const handleOpenDossie = (competitor: any) => {
    setDossieTarget(competitor);
    setDossieContracts(null); 

    setTimeout(() => {
        let localContracts = competitor.contratos || [];
        if (localContracts.length === 0) {
            const obj = competitor.rawDataOriginal || {};
            for (const key of Object.keys(obj)) {
                if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] !== 'number') { 
                    localContracts = obj[key]; break; 
                }
            }
        }
        setDossieContracts(localContracts.filter(contratoCompativelComItemAtual));
    }, 1600); 
  };

  const handleLockTarget = (competitor: any) => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    pendingOperationScrollRef.current = true;
    setTarget(competitor);
    setView('operation');
    const cache = (fullResult?.war_room_cache || {}) as Record<string, AnaliseOfensivaData>;
    const cnpjKey = competitor.cleanCnpj ?? '';
    if (cnpjKey && cache[cnpjKey]) setOffensiveData(cache[cnpjKey]);
    else setOffensiveData(null);
    if (competitor.cleanCnpj) fetchSancoes(competitor.cleanCnpj);
  };

  const handleClearHistory = async () => {
    const safeAnalysisId = analysisId || target?.cleanCnpj || "fallback-id";
    if (!confirm("Deseja apagar o histórico e forçar varredura OSINT deste CNPJ?")) return;
    setIsAnalyzing(true);
    try {
        const token = localStorage.getItem('bawzi_token');
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        await fetch(`${baseUrl.replace(/\/$/, '')}/api/competitor/history/${safeAnalysisId}/${target!.cleanCnpj}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        setOffensiveData(null);
        handleOffensiveAttack();
    } catch (err) { setError("Erro ao limpar histórico. Tente novamente."); }
    finally { setIsAnalyzing(false); }
  };

  const handleOffensiveAttack = async () => {
    if (!target?.cleanCnpj) { setError("O CNPJ do concorrente é inválido para iniciar a análise."); return; }
    setIsAnalyzing(true); setOffensiveData(null); setError(null);
    const safeAnalysisId = analysisId || crypto.randomUUID();

    const contratosAtuais = (target.contratos || target.rawDataOriginal?.contratos || []).filter(contratoCompativelComItemAtual);
    const contratosParaIA = contratosAtuais.length > 0 
        ? contratosAtuais.map((c:any) => typeof c === 'string' ? c : JSON.stringify(c)).join('\n') 
        : "Nenhum contrato detalhado.";

    const payload = { 
        cnpj: target.cleanCnpj, 
        analysis_id: safeAnalysisId, 
        vitorias: target.vitorias, 
        nome_empresa: target.nome, 
        valor_edital: valorEstimatedSeguro, 
        historico_contratos: contratosParaIA 
    };

    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/competitor/offensive-intel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Falha na análise competitiva');
      setOffensiveData(data); 
    } catch (err: any) { 
      setError(`O Backend rejeitou os dados: ${err.message}`); 
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const copiarCnpjNumeros = (cnpjStr: string) => {
    copiar(cnpjStr.replace(/\D/g, ''), 'cnpj-dossie');
  };

  return (
    <div ref={warRoomRef} className="space-y-6 w-full" id="area-resultados">
      
      {view === 'radar' && (
        <div ref={operationRef} className="flex flex-col gap-6 animate-in fade-in duration-300">
          
          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target size={20} className="text-rose-500 md:hidden" />
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Radar de Estratégia Competitiva</h2>
              </div>
              <p className="text-slate-500 text-sm font-medium max-w-2xl">Entenda quem pode disputar com você, qual faixa de preço pressiona a margem e qual resposta reduz risco antes da proposta.</p>
            </div>
            <div className="hidden md:flex items-center justify-center w-14 h-14 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 shrink-0 shadow-inner">
              <Target size={28} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-emerald-500 to-amber-400" />
            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    vereditoCompetitivo.nivel === 'ALTA'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : vereditoCompetitivo.nivel === 'MODERADA'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : vereditoCompetitivo.nivel === 'BAIXA'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    Ameaça {vereditoCompetitivo.nivel.toLowerCase()}
                  </span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                    {vereditoCompetitivo.totalConcorrentes} concorrente{vereditoCompetitivo.totalConcorrentes === 1 ? '' : 's'} mapeado{vereditoCompetitivo.totalConcorrentes === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Veredito competitivo</p>
                <h3 className="text-2xl md:text-3xl font-black text-slate-950 tracking-tight leading-tight">
                  {vereditoCompetitivo.principal
                    ? `${vereditoCompetitivo.principal.nome} é o rival que mais exige atenção.`
                    : 'Ainda não há concorrente forte o suficiente para orientar a estratégia.'}
                </h3>
                <p className="mt-4 text-sm md:text-base font-medium text-slate-600 leading-relaxed">
                  {vereditoCompetitivo.estrategia}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full xl:w-[420px] shrink-0">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Risco do líder</p>
                  <p className="text-2xl font-black text-slate-900">
                    {vereditoCompetitivo.threatPct > 0 ? `${vereditoCompetitivo.threatPct}%` : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Confiança</p>
                  <p className="text-lg font-black text-slate-900">{vereditoCompetitivo.confianca}</p>
                </div>
                <div className="col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-1">Faixa provável para disputar</p>
                  <p className="text-sm font-black text-indigo-950">{vereditoCompetitivo.faixaPreco}</p>
                  <p className="text-[10px] font-bold text-indigo-500 mt-1">Deságio estimado: {vereditoCompetitivo.faixaDesagio}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-900 text-white p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300 mb-2">Estratégia recomendada</p>
                <p className="text-sm font-semibold leading-relaxed text-slate-100">{vereditoCompetitivo.estrategia}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">Dado que merece cautela</p>
                <p className="text-sm font-semibold leading-relaxed text-amber-950">{vereditoCompetitivo.dadoFragil}</p>
              </div>
            </div>
          </div>

          {/* ━━━ BARRA DE INTELIGÊNCIA DE PREÇO ━━━ */}
          {pricing && (pricing.nivelAmeaca || pricing.desagioPreditivoOrgao || pricing.perfilVencedor) && (() => {
            const nivel = String(pricing.nivelAmeaca || "").toUpperCase();
            const nivelCfg: Record<string, { bg: string; badge: string; label: string; dotColor: string }> = {
              ALTO: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', label: 'ALTO', dotColor: 'bg-red-500' },
              MODERADO: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', label: 'MODERADO', dotColor: 'bg-amber-500' },
              BAIXO: { bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', label: 'BAIXO', dotColor: 'bg-emerald-500' },
            };
            const nc = nivelCfg[nivel] ?? { bg: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-600', label: nivel || '—', dotColor: 'bg-slate-400' };
            const desagio = Number(pricing.desagioPreditivoOrgao) || 0;
            const precoUnitarioMercado = Number(pricing.valorMedioUnitarioMercado) || 0;
            const amostraUnitarios = Number(pricing.amostraPrecosUnitarios) || 0;
            const perfilIcon: Record<string, React.ReactNode> = { Tubarão: <Zap size={20} className="text-red-500" />, Agressivo: <Target size={20} className="text-orange-500" />, Conservador: <Shield size={20} className="text-blue-500" />, Iniciante: <Activity size={20} className="text-green-500" /> };
            const perfilNode = perfilIcon[String(pricing.perfilVencedor ?? '')] || <Bot size={20} className="text-slate-500" />;
            return (
              <div className={`border rounded-[2rem] p-6 md:p-8 shadow-sm ${nc.bg}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb size={18} className="text-slate-700" />
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Inteligência de Preço do Órgão</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Nível de Ameaça */}
                  <div className="bg-white/80 rounded-xl p-4 border border-white/60">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nível de Ameaça</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${nc.dotColor} shadow-sm shrink-0`}></div>
                      <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${nc.badge}`}>{nc.label}</span>
                    </div>
                  </div>
                  {/* Deságio Preditivo */}
                  <div className="bg-white/80 rounded-xl p-4 border border-white/60">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deságio Preditivo do Órgão</p>
                    <div>
                      <span className="text-2xl font-black text-slate-900">{desagio > 0 ? `${desagio.toFixed(1)}%` : '—'}</span>
                      {desagio > 0 && (
                        <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${desagio > 25 ? 'bg-red-500' : desagio > 15 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, desagio * 2.5)}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Mediana Unitária */}
                  <div className="bg-white/80 rounded-xl p-4 border border-white/60">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Preço Unitário Mediano</p>
                    {/* Badge de confiança da fonte */}
                    {pricing.fonteConfiabilidade && (
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase mb-2 ${
                        pricing.fonteConfiabilidade === 'PNCP_HOMOLOGADO' ? 'bg-emerald-100 text-emerald-700' :
                        pricing.fonteConfiabilidade === 'DB_ESTRUTURADO' ? 'bg-blue-100 text-blue-700' :
                        pricing.fonteConfiabilidade === 'DB_CALCULADO' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          pricing.fonteConfiabilidade === 'PNCP_HOMOLOGADO' ? 'bg-emerald-500' :
                          pricing.fonteConfiabilidade === 'DB_ESTRUTURADO' ? 'bg-blue-500' :
                          pricing.fonteConfiabilidade === 'DB_CALCULADO' ? 'bg-yellow-500' :
                          'bg-amber-500'
                        }`} />
                        {pricing.fonteConfiabilidade === 'PNCP_HOMOLOGADO' ? '✓ Verificado PNCP' :
                         pricing.fonteConfiabilidade === 'DB_ESTRUTURADO' ? 'Base Local' :
                         pricing.fonteConfiabilidade === 'DB_CALCULADO' ? 'Base Local (Calculado)' :
                         'Estimado'}
                      </div>
                    )}
                    {/* Alerta quando usando deságio padrão hardcoded */}
                    {pricing.usandoDefaultFallback && (
                      <p className="text-[9px] text-amber-600 font-bold mb-1 flex items-center gap-1">
                        <span>⚠</span> Sem histórico — deságio padrão
                      </p>
                    )}
                    <div>
                      <span className="text-xl font-black text-slate-900">
                        {precoUnitarioMercado > 0 ? precoUnitarioMercado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </span>
                      {/* Preço mínimo do mercado */}
                      {Number(pricing.valorMinimoUnitarioMercado) > 0 && precoUnitarioMercado > 0 && (
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                          Mín: {Number(pricing.valorMinimoUnitarioMercado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      )}
                      {/* Amostra com intervalo de datas */}
                      {amostraUnitarios > 0 && (
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                          {amostraUnitarios} contrato{amostraUnitarios > 1 ? 's' : ''}
                          {pricing.intervaloAmostral?.inicio && (
                            <> · {pricing.intervaloAmostral.inicio} → {pricing.intervaloAmostral.fim}</>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Perfil do Vencedor */}
                  <div className="bg-white/80 rounded-xl p-4 border border-white/60">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Perfil do Vencedor Típico</p>
                    <div className="flex items-center gap-2">
                      {perfilNode}
                      <span className="text-sm font-black text-slate-900">{pricing.perfilVencedor || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ━━━ EVIDÊNCIAS DE PREÇO POR CONTRATO ━━━ */}
          {(() => {
            const evs: Array<Record<string, any>> = pricing?.evidenciasPrecosUnitarios || [];
            if (evs.length === 0) return null;

            const fonteCfg: Record<string, { bg: string; dot: string; label: string }> = {
              PNCP_HOMOLOGADO: { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: '✓ PNCP' },
              PNCP_ESTRUTURADO:{ bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'PNCP direto' },
              PNCP_ESTIMADO:   { bg: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500',   label: 'PNCP estimado' },
              PNCP_CALCULADO:  { bg: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-500',  label: 'PNCP calc.' },
              DB_ESTRUTURADO:  { bg: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500',    label: 'Campo direto' },
              DB_CALCULADO:    { bg: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-500',  label: 'Calculado' },
              ESTIMADO:        { bg: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500',   label: 'Estimado' },
            };

            return (
              <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <DollarSign size={18} className="text-slate-700" />
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Evidências de Preço Unitário</h3>
                  <span className="ml-auto text-[9px] font-black text-slate-400 uppercase tracking-widest">{evs.length} contrato{evs.length > 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {evs.map((ev, idx) => {
                    const cfg = fonteCfg[ev.fonte as string] ?? fonteCfg.ESTIMADO;
                    const valorFmt = Number(ev.valor) > 0
                      ? Number(ev.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : '—';
                    const dataFmt = String(ev.data || '').slice(0, 7) || null;
                    return (
                      <div key={idx} className="flex items-start gap-3 py-3">
                        {/* Badge de fonte */}
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase shrink-0 mt-0.5 ${cfg.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          {cfg.label}
                        </div>
                        {/* Descrição e meta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-700 leading-snug truncate">{ev.descricao || 'Item sem descrição'}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                            {[ev.orgao, ev.uf, dataFmt].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {/* Valor */}
                        <span className="text-sm font-black text-slate-900 shrink-0">{valorFmt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ━━━ MAPA DE TERRITÓRIO (UF) ━━━ */}
          {(() => {
            const todas = [...listaNacional, ...listaRegional];
            const ufMap: Record<string, number> = {};
            todas.forEach(c => {
              const u = getUfDisputa(c) || c.uf || 'BR';
              ufMap[u] = (ufMap[u] || 0) + 1;
            });
            const ufEntries = Object.entries(ufMap).sort((a, b) => b[1] - a[1]);
            if (ufEntries.length < 2) return null;
            const maxVal = ufEntries[0][1];
            return (
              <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <Map size={18} className="text-slate-700" />
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Mapa de Território por UF</h3>
                </div>
                <div className="space-y-3">
                  {ufEntries.map(([estado, count]) => (
                    <div key={estado} className="flex items-center gap-4">
                      <span className="w-8 text-xs font-black text-slate-500 uppercase shrink-0">{estado}</span>
                      <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden">
                        <div
                          className={`h-full rounded-lg flex items-center px-3 transition-all ${estado === uf ? 'bg-rose-500' : 'bg-indigo-500'}`}
                          style={{ width: `${Math.round((count / maxVal) * 100)}%` }}
                        >
                          <span className="text-[10px] font-black text-white">{count} rival{count > 1 ? 'is' : ''}</span>
                        </div>
                      </div>
                      {estado === uf && <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest shrink-0">← SEU ESTADO</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col gap-6">

            <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 flex w-full md:max-w-sm">
              <button onClick={() => setAbaConcorrentes('nacional')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${abaConcorrentes === 'nacional' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Nacionais</button>
              <button onClick={() => setAbaConcorrentes('regional')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${abaConcorrentes === 'regional' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Regionais</button>
            </div>

            {/* ━━━ MATRIZ DE AMEAÇAS ━━━ */}
            {listaAtiva.length > 0 && (() => {
              const forcaIcon: Record<string, React.ReactNode> = { Tubarão: <Zap size={14} className="text-red-500" />, Agressivo: <Target size={14} className="text-orange-500" />, Conservador: <Shield size={14} className="text-blue-500" />, Iniciante: <Activity size={14} className="text-green-500" /> };
              const ranked = concorrentesRanqueadosAtivos;
              const maxScore = ranked[0]?.threatScore || 1;
              return (
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <Target size={14} className="text-slate-600" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Matriz de Ameaças — com resposta sugerida</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {ranked.slice(0, 6).map((item, idx) => {
                      const threatPct = Math.round((item.threatScore / maxScore) * 100);
                      const isTop = idx === 0;
                      return (
                        <div key={idx} className={`flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-4 ${isTop ? 'bg-red-50' : 'bg-white'}`}>
                          <span className={`text-xs font-black w-5 text-center shrink-0 ${isTop ? 'text-red-500' : 'text-slate-400'}`}>#{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{item.nome}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-bold text-slate-400">
                                {getUfDisputa(item) || item.uf}
                              </span>
                              {item.uf && getUfDisputa(item) && item.uf !== getUfDisputa(item) && (
                                <>
                                  <span className="text-[9px] font-bold text-slate-400">·</span>
                                  <span className="text-[9px] font-bold text-slate-400">sede {item.uf}</span>
                                </>
                              )}
                              <span className="text-[9px] font-bold text-slate-400">·</span>
                              <span className="text-[9px] font-bold text-slate-400">{item.vitorias} vitórias</span>
                              {forcaIcon[item.forca] || <Bot size={14} className="text-slate-400" />}
                              {item.cnpj && <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">CNPJ: {item.cnpj}</span>}
                            </div>
                            <p className="text-[11px] font-semibold text-slate-600 leading-snug mt-2">
                              <span className="font-black text-slate-800">Por que importa:</span> {explicarConcorrente(item)}
                            </p>
                            <p className="text-[11px] font-semibold text-indigo-700 leading-snug mt-1">
                              <span className="font-black">Resposta sugerida:</span> {recomendarAcaoConcorrente(item, idx)}
                            </p>
                          </div>
                          <div className="w-20 shrink-0">
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isTop ? 'bg-red-500' : threatPct > 65 ? 'bg-orange-400' : 'bg-slate-300'}`} style={{ width: `${threatPct}%` }} />
                            </div>
                            <p className={`text-[9px] font-black text-right mt-0.5 ${isTop ? 'text-red-500' : 'text-slate-400'}`}>{threatPct}%</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => handleOpenDossie(item)} className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 transition-colors group" title="Ver Dossiê">
                              <Eye size={13} />
                              <span className="text-[8px] font-black uppercase tracking-widest leading-none">Dossiê</span>
                            </button>
                            <button onClick={() => handleLockTarget(item)} className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-indigo-700 text-white transition-colors" title="Gerar estratégia competitiva">
                              <Crosshair size={13} />
                              <span className="text-[8px] font-black uppercase tracking-widest leading-none">Estratégia</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {listaAtiva.length === 0 && (
              <div className="py-20 text-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[1.5rem]">
                <p className="font-bold text-sm">Nenhum rival ativo mapeado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'operation' && target && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
                <button onClick={() => setView('radar')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm"><ArrowLeft size={16} /> Voltar</button>
                {linkEditalPrincipal && (
                  <a href={linkEditalPrincipal} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl shadow-sm">
                    <ExternalLink size={16} /> Edital Original
                  </a>
                )}
            </div>
            <button onClick={() => handleOpenDossie(target)} className="flex items-center gap-1.5 text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Eye size={14} /> Abrir Dossiê PNCP</button>
          </div>

          <div className="bg-slate-900 rounded-[2rem] p-8 text-white border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-rose-500"><Target size={32} /></div>
              <div>
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Concorrente em análise</p>
                <h2 className="text-xl md:text-2xl font-black tracking-tight">{target.nome}</h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="bg-slate-800 px-2 py-0.5 rounded">CNPJ: {target.cnpj || 'N/A'}</span>
                  <span>{target.prob} de ameaça competitiva</span>
                </div>
              </div>
            </div>
          </div>

          {target.cleanCnpj && target.cleanCnpj.length >= 11 && (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-stretch justify-between gap-6">
              <div className="flex-1 w-full">
                <CompliancePanel cnpj={target.cleanCnpj} companyName={target.nome} userTier={userTier} onUpgradeClick={() => {}} />
              </div>
              <div className="w-full md:w-1/3 bg-slate-50 rounded-xl border border-slate-200 p-5 shrink-0 flex flex-col justify-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Scale size={14} /> Sanções federais CGU</h4>
                {sancoesStatus === 'loading' && ( <div className="flex items-center gap-3 text-slate-500"><span className="animate-spin text-lg">⏳</span><span className="text-[10px] font-bold uppercase tracking-widest">Consultando...</span></div> )}
                {sancoesStatus === 'clean' && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0"><ShieldCheck size={20} /></div>
                    <div><p className="text-xs font-black text-emerald-700 uppercase">Sem sanções encontradas</p><p className="text-[10px] text-slate-500 font-medium">Nada consta nas bases federais consultadas.</p></div>
                  </div>
                )}
                {sancoesStatus === 'dirty' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0"><AlertTriangle size={20} /></div><div><p className="text-xs font-black text-rose-700 uppercase">Sanções Encontradas!</p></div></div>
                    {getSancoesLink(target.cleanCnpj) && ( <a href={getSancoesLink(target.cleanCnpj)!} target="_blank" rel="noopener noreferrer" className="w-full py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase text-center">Ver Detalhes</a> )}
                  </div>
                )}
                {sancoesStatus === 'error' && (
                  <div className="flex flex-col gap-3">
                    {getSancoesLink(target.cleanCnpj) && ( <a href={getSancoesLink(target.cleanCnpj)!} target="_blank" rel="noopener noreferrer" style={{ color: '#ffffff' }} className="w-full py-2.5 bg-slate-900 !text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><ExternalLink size={14} color="#ffffff" /> Consultar Portal CGU</a> )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              {itensLotes.length > 1 && (
                <div className="bg-white rounded-[1.5rem] border border-indigo-100 p-5">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2"><ListFilter size={14} /> Selecione o Lote/Item em Disputa</label>
                  <select value={selectedItemIdx} onChange={(e) => setSelectedItemIdx(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 rounded-xl px-4 py-3 outline-none">
                    {itensLotes.map((item: any, idx: number) => (
                      <option key={idx} value={idx}>{item.numero}: {item.produto} ({item.quantidade} un)</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-white rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm flex-1">
                <ReverseEngineeringBlock
                  valorReferencia={extrairValorExato(currentItem.valor_estimado_raw)} 
                  desagio={currentItem.desagioPreditivoOrgao || pricing?.desagioPreditivoOrgao || 0}
                  engenhariaData={{ ...(pricing?.engenharia_reversa ?? {}), setor_identificado: currentItem.produto }}
                  userTier={userTier}
                  quantidade={currentItem.quantidade}
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col h-max">
              <div className="mb-6 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2"><Scale size={16} /> Riscos de Habilitação</h3>
                  {offensiveData && <button onClick={handleClearHistory} className="text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm">Limpar Histórico</button>}
                </div>
                <p className="text-sm font-medium text-slate-500">Identifique pontos de habilitação, sanções e argumentos técnicos para uma disputa defensável.</p>
              </div>

              {error && <div className="p-4 bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold mb-6 flex items-start gap-3"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><p>{error}</p></div>}

              {!offensiveData && (
                <div className="flex-1 flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-300 rounded-[1.5rem] bg-white text-center px-6">
                  <FileSearch size={40} className="text-slate-300 mb-4" />
                  <button onClick={handleOffensiveAttack} disabled={isAnalyzing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                    {isAnalyzing ? <span className="animate-spin">⌛</span> : <Target size={16} className="text-rose-400" />} {isAnalyzing ? 'Processando análise...' : 'Gerar Estratégia Jurídica'}
                  </button>
                </div>
              )}

              {offensiveData && (
                <div className="space-y-6 mt-2 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-4">
                    {offensiveData.vulnerabilidades?.map((vuln: any, idx: number) => (
                      <div key={idx} className={`p-5 rounded-2xl border bg-white shadow-sm ${vuln.gravidade === 'ALTA' ? 'border-rose-300 ring-1 ring-rose-500/10' : 'border-amber-300 ring-1 ring-amber-500/10'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className={`font-black text-xs uppercase tracking-widest ${vuln.gravidade === 'ALTA' ? 'text-rose-700' : 'text-amber-700'}`}>{vuln.tipo?.replace(/_/g, ' ')}</h4>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${vuln.gravidade === 'ALTA' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{vuln.gravidade}</span>
                        </div>
                        <p className="text-slate-600 text-xs font-medium leading-relaxed mb-3">{vuln.descricao_tecnica}</p>
                        <p className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-800 whitespace-pre-wrap">{vuln.fundamentacao_legal}</p>
                      </div>
                    ))}
                  </div>

                  {offensiveData.recomendacao_tatica && (
                    <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Target size={11} /> Recomendação Tática</h4>
                      <p className="text-sm font-medium text-slate-200 leading-relaxed">{offensiveData.recomendacao_tatica}</p>
                    </div>
                  )}

                  {offensiveData.rascunho_recurso && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3">Minuta Jurídica Gerada</h4>
                      <div className="font-serif text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                        <p className="font-bold border-b border-slate-200 pb-2 mb-3">ASSUNTO: {offensiveData.rascunho_recurso.assunto}</p>
                        <p className="mb-4">{offensiveData.rascunho_recurso.tese_juridica}</p>
                        <p className="font-bold mb-1">PEDIDOS:</p>
                        <ul className="list-decimal pl-4 space-y-1">
                          {offensiveData.rascunho_recurso.pedidos?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                      <button onClick={() => { const r = offensiveData.rascunho_recurso; if (r) copiar(`Assunto: ${r.assunto}\n\n${r.tese_juridica}\n\nPedidos:\n${r.pedidos.join('\n')}`, 'peca-juridica'); }} className="mt-5 w-full py-3 bg-indigo-50 text-indigo-700 font-black rounded-xl text-[10px] uppercase border border-indigo-200 flex items-center justify-center gap-1.5"><ClipboardList size={13} /> {copiadoKey === 'peca-juridica' ? '✓ Copiado!' : 'Copiar Peça Jurídica'}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO RAIO-X COMPETITIVO (DOSSIÊ) */}
      {dossieTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center"><Target size={18} /></div>
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-widest text-rose-500">Raio-X Competitivo</span>
                  <h3 className="text-sm font-black uppercase tracking-tight">{dossieTarget.nome}</h3>
                </div>
              </div>
              <button onClick={() => setDossieTarget(null)} className="text-slate-400 hover:text-white font-bold text-lg">✖</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Vitórias Recentes</span><span className="text-sm font-black text-slate-900">{dossieTarget.vitorias}</span></div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">CNPJ</span><span className="text-xs font-black text-slate-900">{dossieTarget.cnpj}</span></div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">UF da disputa</span><span className="text-sm font-black text-slate-900">{getUfDisputa(dossieTarget) || 'Não informada'}</span></div>
                {dossieTarget.uf && dossieTarget.uf !== getUfDisputa(dossieTarget) && (
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">UF da empresa</span><span className="text-sm font-black text-slate-900">{dossieTarget.uf}</span></div>
                )}
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Porte</span><span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-1 block w-max">{dossieTarget.porte}</span></div>
                <div className="col-span-2 bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Município</span><span className="text-xs font-black text-slate-900 block truncate">{dossieTarget.municipio}</span></div>
                <div className="col-span-3 bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">CNAE Principal</span><span className="text-xs font-black text-slate-900 block truncate">{dossieTarget.cnae || 'Não Informado'}</span></div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><ListFilter size={14} className="text-rose-500" /> Histórico Operacional</h4>
                
                {dossieContracts === null ? (
                   <div className="p-12 flex flex-col items-center justify-center text-indigo-500 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner gap-4">
                      <Activity size={36} className="animate-pulse text-indigo-400" />
                      <div className="text-center">
                         <p className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-1">Acessando Transparência...</p>
                         <p className="text-[10px] font-bold text-slate-500">Minerando contratos e decodificando preços da empresa.</p>
                      </div>
                   </div>
                ) : dossieContracts.length === 0 ? (
                   <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center gap-3">
                      <SearchX size={32} className="text-slate-300" />
                      <p className="text-sm font-bold text-slate-500">Sem Histórico Detalhado</p>
                      <p className="text-xs text-slate-400 max-w-sm">A base de dados do governo não devolveu detalhamento de contratos recentes para este CNPJ.</p>
                   </div>
                ) : (
                  <div className="space-y-4">
                    
                    <div className="bg-slate-900 rounded-2xl p-5 shadow-inner mt-2 mb-6 border border-slate-800 relative overflow-hidden">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                      <div className="flex items-start justify-between mb-4 relative z-10">
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                          <Activity size={16} /> Termômetro de Preço Unitário
                        </h4>
                        {tetoUnitarioAtual === -1 && (
                          <span className="text-[9px] text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg font-medium max-w-[160px] text-right leading-tight">
                            Preços unitários extraídos de contratos similares anteriores
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-[8px] text-slate-400 uppercase font-bold block mb-1">
                            {tetoUnitarioAtual === -1 ? 'Valor Edital (Lote)' : 'Teto Unitário Edital'}
                          </span>
                          <span className="text-sm font-black text-white">
                            {tetoUnitarioAtual === -1
                              ? valorEstimatedSeguro > 0
                                ? valorEstimatedSeguro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : 'Sigiloso'
                              : tetoUnitarioAtual > 0
                                ? tetoUnitarioAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : 'Sigiloso'}
                          </span>
                          {tetoUnitarioAtual === -1 && (
                            <span className="text-[8px] text-slate-500 mt-0.5 block">sem breakdown por item</span>
                          )}
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-[8px] text-slate-400 uppercase font-bold block mb-1">Último Preço Vencido</span>
                          <span className="text-sm font-black text-amber-400">{ultimoVencidoAlvo > 0 ? ultimoVencidoAlvo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Oculto'}</span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-[8px] text-slate-400 uppercase font-bold block mb-1">Menor Nacional</span>
                          {menorNacionalExibido > 0 ? (
                            <span className="text-sm font-black text-emerald-400">{menorNacionalExibido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          ) : menorNacional > 0 ? (
                            <span className="text-xs font-bold text-slate-500 italic">Seg. diferente</span>
                          ) : (
                            <span className="text-sm font-black text-slate-500">Oculto</span>
                          )}
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-[8px] text-slate-400 uppercase font-bold block mb-1">Menor Regional</span>
                          {menorRegionalExibido > 0 ? (
                            <span className="text-sm font-black text-emerald-400">{menorRegionalExibido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          ) : menorRegional > 0 ? (
                            <span className="text-xs font-bold text-slate-500 italic">Seg. diferente</span>
                          ) : (
                            <span className="text-sm font-black text-slate-500">Oculto</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {dossieContracts.map((contrato: any, idx: number) => {
                        if (typeof contrato === 'string') return null;

                        const cOrgao = contrato.orgao || contrato.orgao_nome || "Órgão Não Informado";
                        const cObjeto = contrato.objeto || contrato.descricao || "Descrição indisponível";
                        const cData = contrato.data || contrato.data_homologacao || "";
                        const cValor = contrato.valor || contrato.valorTotal || "";
                        const cLink = contrato.link || contrato.url || contrato.link_pncp || contrato.linkSistemaOrigem;
                        const precoMeta = getPrecoMeta(contrato);
                        const confiancaPreco = Number(precoMeta?.confianca ?? contrato.confiancaPreco ?? 0);
                        const fontePreco = getFontePreco(contrato);
                        const fontePrecoLabel = formatarFontePreco(fontePreco);

                        const cValorNum = typeof cValor === 'number' ? cValor : extrairValorExato(cValor);
                        // Usa o valorUnitario do backend diretamente (já validado por extrair_unitario_real)
                        // e só aplica extrairUnitarioInteligente se o campo vier zerado.
                        const valorUnitario = lerUnitarioConfiavel(contrato, 0.28);

                        // Fallback matemático: global / qty minerada do texto quando backend retornou 0
                        const dadosMineradosCard = valorUnitario === 0 && cValorNum > 0
                            ? minerarDadosDoResumo(cObjeto)
                            : null;
                        const valorUnitarioEstimado = dadosMineradosCard && dadosMineradosCard.quantidade > 1
                            ? cValorNum / dadosMineradosCard.quantidade
                            : 0;
                        const isEstimado = valorUnitario === 0 && valorUnitarioEstimado > 0;
                        const isBaixaConfianca = valorUnitario > 0 && confiancaPreco > 0 && confiancaPreco < 0.75;
                        const valorExibido = valorUnitario > 0 ? valorUnitario : valorUnitarioEstimado;

                        return (
                            <div key={idx} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-indigo-300 transition-all relative">
                                <div className="flex items-center gap-2 text-[11px] font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-2 mb-3">
                                    <Building2 size={14} className="text-indigo-500" /> {cOrgao}
                                </div>
                                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">{cObjeto}</p>

                                <div className="flex flex-wrap items-center gap-3 text-xs font-bold bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 w-full">
                                    {cData && <span className="text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm flex items-center gap-1"><CalendarDays size={11} /> {cData}</span>}

                                    {cValorNum > 0 && (
                                        <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 shadow-sm flex items-center gap-1">
                                            <DollarSign size={11} /> Global: {cValorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    )}

                                    {valorExibido > 0 ? (
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`px-2 py-1 rounded-md border shadow-sm flex items-center gap-1 ${isEstimado || isBaixaConfianca ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-indigo-700 bg-indigo-50 border-indigo-200'}`}
                                            title={fontePreco ? `Fonte: ${fontePreco}${confiancaPreco > 0 ? ` | Confiança: ${Math.round(confiancaPreco * 100)}%` : ''}` : undefined}
                                          >
                                              <Target size={12} />
                                              {isEstimado || isBaixaConfianca ? '~' : ''}Unitário: {valorExibido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                              {isEstimado && <span className="text-[8px] opacity-70 ml-0.5">(est.)</span>}
                                              {!isEstimado && isBaixaConfianca && <span className="text-[8px] opacity-70 ml-0.5">(conf. baixa)</span>}
                                          </span>
                                          {fontePrecoLabel && !isEstimado && (
                                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border shadow-sm ${
                                              isFontePrecoAltaConfianca(precoMeta, contrato)
                                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                                : 'text-amber-700 bg-amber-50 border-amber-200'
                                            }`}>
                                              {fontePrecoLabel}
                                            </span>
                                          )}
                                          {tetoUnitarioAtual > 0 && tetoUnitarioAtual !== -1 && valorExibido < tetoUnitarioAtual && (
                                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 shadow-sm" title="Desconto praticado neste contrato em relação ao Teto do Edital Atual">
                                                  -{Math.round((1 - valorExibido / tetoUnitarioAtual) * 100)}% vs Teto
                                              </span>
                                          )}
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm flex items-center gap-1 text-[9px] uppercase tracking-widest">
                                            <SearchX size={10} /> Unitário Oculto
                                        </span>
                                    )}

                                    {cLink && (
                                      <a href={cLink} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest text-[9px] bg-white border border-indigo-100 px-3 py-1.5 rounded-md shadow-sm">
                                        <ExternalLink size={12} /> Link Oficial
                                      </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
              {getSancoesLink(dossieTarget.cnpj) ? (
                <a 
                  href={getSancoesLink(dossieTarget.cnpj)!} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <ShieldAlert size={14} className="text-rose-600" /> Sanções no Governo
                </a>
              ) : <div />}
              
              <button onClick={() => copiarCnpjNumeros(dossieTarget.cnpj ?? '')} className="px-5 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white font-black text-[10px] uppercase rounded-xl transition-all shadow-md flex items-center gap-1.5">
                <Clipboard size={14} /> {copiadoKey === 'cnpj-dossie' ? '✓ Copiado!' : 'Copiar CNPJ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
