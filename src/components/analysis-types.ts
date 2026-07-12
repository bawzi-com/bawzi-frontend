/**
 * analysis-types.ts
 * Tipos TypeScript e funções utilitárias partilhados pelo painel de análise Bawzi.
 */

// ─── Interfaces de dados ──────────────────────────────────────────────────────

export interface EngenhariaReversa {
  setor_identificado: string;
  margem_media_setor_pct: number;
}

/** Margem líquida ajustada pelo regime tributário (Simples Nacional ou não) + ponto de equilíbrio simplificado. */
export interface ViabilidadeFinanceira {
  margem_setor_pct: number;
  margem_liquida_estimada_pct: number;
  base_tributaria: string;
  ponto_equilibrio_desconto_max_pct: number;
  mensagem: string;
}

export interface PricingIntelligence {
  desagioPreditivoOrgao: number;
  nivelAmeaca: string;
  perfilVencedor: string;
  valor_estimado_raw?: number;
  financial_verdict?: string;
  estimated_discount?: number;
  valorMedioMercado?: number;
  engenharia_reversa?: EngenhariaReversa;
  viabilidade_financeira?: ViabilidadeFinanceira;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Nota CAPAG (Capacidade de Pagamento) do órgão comprador — Tesouro Transparente/STN. */
export interface OrgaoRiskData {
  escopo: 'municipio' | 'estado' | string;
  classificacao: string;
  descricao: string;
  fonte: string;
}

/** Alerta quando a garantia exigida no edital excede o teto legal da Lei 14.133/2021. */
export interface GarantiaAlertaItem {
  campo: string;
  valor_exigido: string;
  teto_legal_pct: number;
  excede: boolean;
  mensagem: string;
}

export interface MatrizRiscoFormalItem {
  risco: string;
  impacto: string;
  alocado_a: 'contratante' | 'contratado' | 'a_negociar' | string;
}

/** Matriz de risco formal (art. 6º, XXVII da Lei 14.133/2021) — só para contratos de grande vulto/contratação integrada. */
export interface MatrizRiscoFormal {
  motivo_obrigatoriedade: string;
  itens: MatrizRiscoFormalItem[];
  nota: string;
}

export interface ProgramaIntegridade {
  exigido: boolean;
  prazo: string;
  mensagem: string;
}

/** Cruzamento entre a exigência de participação ME/EPP do edital e o porte da empresa (LC 123/2006, art. 48). */
export interface ElegibilidadeMeEpp {
  elegivel: boolean;
  /** true quando é cota reservada (não exclusividade total) — nunca impede a participação, só orienta a estratégia de disputa. */
  cota_reservada?: boolean;
  mensagem: string;
}

/** Alerta heurístico (não legal) de prazo de entrega/execução apertado. */
export interface AlertaPrazoEntrega {
  prazo: string;
  dias_equivalentes: number;
  local?: string | null;
  mensagem: string;
}

/** Alerta de cláusula de reajuste/repactuação sem índice especificado. */
export interface AlertaIndiceReajuste {
  mensagem: string;
}

/** Estimativa do valor total do contrato considerando prorrogações sucessivas (Lei 14.133/2021, arts. 106-107). */
export interface ValorTotalComProrrogacao {
  valor_inicial: number;
  vigencia_inicial_meses: number;
  anos_maximos_estimados: number;
  multiplicador: number;
  valor_total_estimado: number;
  mensagem: string;
}

/** Prazo-limite de impugnação calculado deterministicamente (3 dias úteis antes da abertura — art. 164, I). */
export interface PrazoImpugnacaoCalculado {
  data_iso: string;
  base_legal: string;
  origem: 'calculado' | 'divergente' | 'confirmado' | string;
  data_extraida_edital_iso?: string;
  mensagem: string;
}

/** Data-limite em que a empresa fica vinculada à proposta enviada (Lei 14.133/2021, art. 90, §3º). */
export interface ValidadePropostaCalculada {
  dias: number | null;
  base_legal: string;
  origem: 'calculado' | 'sem_data_abertura' | 'nao_informado' | string;
  data_iso?: string;
  mensagem: string;
}

/** Nota informativa fixa sobre o prazo recursal pós-julgamento (Lei 14.133/2021, art. 165, §1º, I). */
export interface PrazoRecursoPosJulgamento {
  dias_uteis: number;
  base_legal: string;
  mensagem: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface HighlightItem {
  title: string;
  quote: string;
}

export interface SemaforoSinal {
  status: 'ok' | 'alerta' | 'risco';
  motivo: string;
}

export interface DataCritica {
  label: string;
  data_iso: string | null;
  urgente: boolean;
}

export interface RiskItem {
  titulo: string;
  descricao: string;
  impacto?: 'alto' | 'medio' | 'baixo';
}

export type DecisionVerdict = 'GO' | 'GO_CONDICIONADO' | 'NO_GO';

export interface DecisionAction {
  prazo?: string;
  acao: string;
  responsavel?: string;
  resultado_esperado?: string;
}

export interface DecisionEvidence {
  categoria?: string;
  titulo: string;
  detalhe?: string;
  fonte?: string;
  referencia?: string;
  trecho?: string;
  impacto?: string;
}

export interface DecisionConfidenceFactor {
  criterio: string;
  status?: 'confirmado' | 'parcial' | 'ausente' | 'risco' | string;
  detalhe?: string;
}

export interface DecisionData {
  veredito?: DecisionVerdict | string;
  rotulo?: string;
  confianca?: number;
  resumo_decisao?: string;
  motivos?: string[];
  condicoes_para_participar?: string[];
  impeditivos?: string[];
  proximas_acoes?: DecisionAction[];
  perguntas_criticas?: string[];
  decisao_executiva?: string;
  evidencias?: DecisionEvidence[];
  lacunas?: string[];
  fatores_confianca?: DecisionConfidenceFactor[];
  o_que_mudaria_decisao?: string[];
}

export interface CockpitTaskPersistedState {
  done?: boolean;
  updated_at?: string;
  responsavel?: string;
  prazo?: string;
  nota?: string;
}

export type CockpitStatusMap = Record<string, CockpitTaskPersistedState>;

export interface BusinessFitData {
  status?: 'match_forte' | 'match_parcial' | 'sem_match' | 'indeterminado' | 'sem_cnae' | string;
  score?: number;
  cnae_principal?: string | null;
  cnae_descricao?: string | null;
  objeto_detectado?: string | null;
  justificativa?: string;
  sinais_de_match?: string[];
  sinais_de_desalinhamento?: string[];
  termos_negocio?: string[];
  empresa?: string;
  cnaes_secundarios?: { codigo?: string; descricao?: string }[];
  cnae_correspondente?: string | null;
  cnae_correspondente_descricao?: string | null;
}

export interface PegadinhaData {
  detectada: boolean;
  tipo?: string;
  descricao?: string;
  base_legal?: string;
}

// ─── Camada de qualidade (QA Engine) ─────────────────────────────────────────

export interface FichaTecnicaItem {
  campo: string;
  valor: string;
  trecho?: string;
  /** 'verificado_texto' = confirmado por regex no texto | 'ia+texto' | 'ia' | 'ausente' */
  fonte?: 'verificado_texto' | 'ia+texto' | 'ia' | 'ausente' | string;
}

export interface HabilitacaoItem {
  categoria: 'juridica' | 'fiscal' | 'tecnica' | 'economico_financeira' | string;
  categoria_label?: string;
  exigencia: string;
  criticidade: 'eliminatoria' | 'pontuavel' | 'comum' | string;
  trecho?: string;
  dica?: string;
}

export interface RedFlagItem {
  tipo: string;
  tipo_label?: string;
  descricao: string;
  gravidade: 'alta' | 'media' | 'baixa' | string;
  trecho?: string;
  base_legal?: string;
  acao_sugerida?: 'impugnar' | 'esclarecer' | 'monitorar' | string;
  /** Súmula do TCU (262/263/272) quando o padrão detectado bate com a jurisprudência consolidada. */
  sumula_tcu?: { referencia: string; texto: string };
}

export interface ScoreFactorItem {
  fator: string;
  pontos: number;
  justificativa?: string;
  trecho?: string;
}

export interface QualidadeExtracao {
  cobertura_pct?: number;
  nivel?: 'alta' | 'media' | 'baixa' | string;
  campos_localizados?: string[];
  campos_faltantes?: string[];
  divergencias_ia_texto?: string[];
  ajustes_congruencia?: string[];
}

export interface AnalysisResult {
  id?: string;
  title: string;
  summary: string;
  score: number;
  classification: string;
  effort: string;
  estimated_value: string;
  recommendation: string;
  rationale: string;
  decisao?: DecisionData;
  decision_reviews?: Array<Record<string, unknown>>;
  reviewed_at?: string;
  pncp_ref?: {
    cnpj?: string;
    ano?: string;
    sequencial?: string;
  } | null;
  pncp_cnpj?: string | null;
  pncp_ano?: string | null;
  pncp_sequencial?: string | null;
  pncp_monitor?: Record<string, unknown> | null;
  pncp_monitor_events?: Array<Record<string, unknown>>;
  aderencia_negocio?: BusinessFitData;
  // New structured dates (replaces datas_criticas_extraidas)
  datas_criticas?: DataCritica[];
  // Legacy — kept for backwards compat with older saved analyses
  datas_criticas_extraidas?: {
    data_limite_propostas?: string;
    data_impugnacao?: string;
  };
  // Semáforo de Viabilidade
  semaforo?: {
    tecnica: SemaforoSinal;
    financeira: SemaforoSinal;
    juridica: SemaforoSinal;
    documentacao: SemaforoSinal;
  };
  probabilidade_de_sucesso?: string;
  vantagens?: string[];
  desvantagens?: string[];
  exigencias_criticas?: string[];
  prazos?: string[];
  documentos_necessarios?: string[];
  criterios_de_julgamento?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  concorrentes_provaveis?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  concorrentes_regionais?: any[];
  uf?: string;
  estado?: string;
  risks?: RiskItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checklist?: any[];
  ficha_tecnica?: FichaTecnicaItem[];
  habilitacao_checklist?: HabilitacaoItem[];
  red_flags?: RedFlagItem[];
  score_breakdown?: ScoreFactorItem[];
  oportunidades?: string[];
  qualidade_extracao?: QualidadeExtracao;
  pricing_intelligence?: PricingIntelligence;
  orgao_risk?: OrgaoRiskData | null;
  garantias_alerta?: GarantiaAlertaItem[];
  matriz_risco_formal?: MatrizRiscoFormal | null;
  programa_integridade_obrigatorio?: ProgramaIntegridade | null;
  elegibilidade_me_epp?: ElegibilidadeMeEpp | null;
  valor_total_com_prorrogacao?: ValorTotalComProrrogacao | null;
  prazo_impugnacao_calculado?: PrazoImpugnacaoCalculado | null;
  validade_proposta_calculada?: ValidadePropostaCalculada | null;
  prazo_recurso_pos_julgamento?: PrazoRecursoPosJulgamento | null;
  alerta_prazo_entrega?: AlertaPrazoEntrega | null;
  alerta_indice_reajuste?: AlertaIndiceReajuste | null;
  created_at?: string;
  parecer_especialista?: string;
  pegadinha?: PegadinhaData;
  cockpit_status?: CockpitStatusMap;
  cockpit_updated_at?: string;
  tracked_in_gestao?: boolean;
  avaliacao_parametros?: Array<{
    nome: string;
    peso: 'alto' | 'medio' | 'baixo';
    status: 'ok' | 'alerta' | 'bloqueio';
    score: number;
    trecho_citado: string;
    avaliacao: string;
  }>;
}

// ─── Funções utilitárias ──────────────────────────────────────────────────────

export const getScoreColor = (score: number) =>
  score >= 70
    ? 'text-emerald-600 border-emerald-500'
    : score >= 45
    ? 'text-amber-500 border-amber-400'
    : 'text-red-600 border-red-500';

export const getScoreBg = (score: number) =>
  score >= 70 ? 'bg-emerald-50' : score >= 45 ? 'bg-amber-50' : 'bg-red-50';

export const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

export const extrairValorNumerico = (val: string | number | undefined): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;

  let str = val.toString().trim();

  if (str.includes(',')) {
    str = str.replace(/[^\d,-]/g, '');
    str = str.replace(',', '.');
  } else {
    str = str.replace(/[^\d.-]/g, '');
  }

  const num = Number(str);
  return isNaN(num) ? 0 : num;
};
