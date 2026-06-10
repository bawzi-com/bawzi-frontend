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
