/**
 * analysis-types.ts
 * Tipos TypeScript e funções utilitárias partilhados pelo painel de análise Bawzi.
 */

// ─── Interfaces de dados ──────────────────────────────────────────────────────

export interface EngenhariaReversa {
  setor_identificado: string;
  margem_media_setor_pct: number;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
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
}

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
}

export interface PegadinhaData {
  detectada: boolean;
  tipo?: string;
  descricao?: string;
  base_legal?: string;
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
  pricing_intelligence?: PricingIntelligence;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orgao_risk?: any;
  created_at?: string;
  parecer_especialista?: string;
  pegadinha?: PegadinhaData;
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
