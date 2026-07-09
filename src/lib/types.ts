/**
 * types.ts — Interfaces de domínio partilhadas
 * ─────────────────────────────────────────────────────────────────
 * Tipos concretos para substituir `any` em todo o frontend.
 * Importar aqui em vez de redefinir em cada componente.
 */

// ─── Empresa / CNPJ ──────────────────────────────────────────────────────────

export interface Empresa {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  nome?: string;
  uf?: string;
  municipio?: string;
  capital_social?: string;
  enquadramento?: string;
  cnae_principal?: string;
  cnae_descricao?: string;
  core_business?: string;
  produtos_servicos?: string[];
  regioes_atendidas?: string[];
  capacidade_operacional?: string;
  margem_minima_pct?: string;
  limite_contrato?: string;
  observacoes_operacionais?: string;
  historico_vitorias?: string;
  situacao_cadastral?: string;
  [key: string]: unknown;
}

// ─── Usuário / perfil ─────────────────────────────────────────────────────────

export interface UserProfile {
  _id?: string;
  email: string;
  name?: string;
  nome?: string;
  tier?: number;
  is_admin?: boolean;
  company?: Empresa;
  companies?: Empresa[];
  active_workspace_id?: string;
  [key: string]: unknown;
}

/** Dados "blended" que o frontend monta a partir de /users/me + /workspace/details */
export interface UserData extends UserProfile {
  workspace_users_count?: number;
  vagas_totais?: number;
  workspace_name?: string;
  active_cnpj?: string;
  active_workspace?: { tier?: number };
  is_promo?: boolean;
  promo_expires_at?: string;
}

// ─── Análise salva (histórico) ────────────────────────────────────────────────

export interface SavedAnalysis {
  id: string;
  title?: string;
  summary?: string;
  score?: number;
  classification?: string;
  estimated_value?: string;
  recommendation?: string;
  uf?: string;
  estado?: string;
  termo_busca_pncp?: string;
  model_source?: string;
  modelSource?: string;
  created_at?: string;
  cockpit_status?: Record<string, { done?: boolean; updated_at?: string; responsavel?: string; prazo?: string; nota?: string }>;
  cockpit_updated_at?: string;
  workflow_status?: string;
  workflow_updated_at?: string;
  empresa_contexto?: {
    cnpj?: string;
    razao_social?: string;
    nome?: string;
    nome_fantasia?: string;
    cnae_principal?: string;
    cnae_descricao?: string;
    uf?: string;
    municipio?: string;
  } | null;
  company_cnpj?: string | null;
  company_name?: string | null;
  /** true somente quando o usuário adiciona explicitamente a análise à Gestão ("+ Gestão"). */
  tracked_in_gestao?: boolean;
  reviewed_at?: string;
  decision_reviews?: Record<string, unknown>[];
  decision_learning?: {
    participou?: boolean;
    resultado?: string;
    preco_final?: string;
    vencedor?: string;
    observacao?: string;
    contrato_inicio?: string;
    contrato_fim?: string;
    updated_at?: string;
  };
  /** Campos extras da IA (riscos, semáforo, etc.) */
  [key: string]: unknown;
}

// ─── Concorrente ─────────────────────────────────────────────────────────────

export interface Concorrente {
  nome: string;
  cnpj?: string;
  capital_social?: number;
  uf?: string;
  vitorias?: number;
  [key: string]: unknown;
}

// ─── Evento customizado ───────────────────────────────────────────────────────

export interface BawziUpdateEvent extends Event {
  detail?: { tier?: number; name?: string };
}
