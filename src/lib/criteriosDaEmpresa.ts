/**
 * criteriosDaEmpresa.ts — contagem dos critérios que a própria empresa configurou.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A SUBTRAÇÃO QUE TRANSFORMAVA OMISSÃO EM "ATENDE"
 * ═══════════════════════════════════════════════════════════════════════════
 * A tela contava assim, em dois lugares:
 *
 *     `${params.length - bloqueios - alertasParam} atende(m)`
 *
 * e decidia a cor assim:
 *
 *     bloqueios > 0 ? 'alerta' : alertasParam > 0 ? 'atencao' : 'ok'
 *     headline: 'Todos os critérios configurados são atendidos.'
 *
 * As duas linhas partem da mesma premissa: todo critério é uma das três coisas
 * conhecidas, então o que sobra do "menos" atende. Nada normalizava o campo —
 * um `status` faltando, `""`, `"n/a"` ou qualquer string que o modelo
 * inventasse não é bloqueio nem alerta, logo entrava na conta como ATENDIDO, e
 * o painel afirmava em verde que estava tudo certo. A penalidade de score
 * tinha o mesmo cego: só `bloqueio` e `alerta` custavam ponto.
 *
 * Estes são os critérios que o CLIENTE cadastrou — a parte da análise que ele
 * mais confere e a que ele tem menos como auditar sozinho.
 *
 * ── O segundo furo, mais sutil ──────────────────────────────────────────────
 * O prompt manda: "Se não encontrou menção, use string vazia" para
 * `trecho_citado` — e não proíbe combinar isso com `status: "ok"`. Ou seja, é
 * possível (e acontece) "Atende ✅" para um critério que o edital não menciona.
 * Na tela, o caso ficava pixel a pixel idêntico a um confirmado com citação
 * literal, porque a aspa vazia simplesmente não era renderizada.
 *
 * Aqui NÃO rebaixamos o veredito da IA — a avaliação pode ter vindo de uma
 * tabela parafraseada. Só separamos "atende, comprovado" de "atende, sem base
 * visível", para que a tela pare de dizer que são a mesma coisa.
 */

export interface CriterioBruto {
  nome?: string;
  peso?: string;
  status?: string;
  score?: number | null;
  trecho_citado?: string;
  comprovado?: boolean;
  peso_informado?: boolean;
  avaliacao?: string;
}

export const STATUS_CRITERIO_VALIDOS = ['ok', 'alerta', 'bloqueio'] as const;

export interface ContagemDeCriterios<T> {
  bloqueios: T[];
  alertas: T[];
  atende: T[];
  /** Status ausente ou irreconhecível — o que a subtração dava de brinde. */
  semStatus: T[];
  /** `status: "ok"` sem uma linha do edital que sustente. */
  semTrecho: T[];
}

export function contarCriterios<T extends CriterioBruto>(params: T[]): ContagemDeCriterios<T> {
  const lista = Array.isArray(params) ? params : [];
  const bloqueios = lista.filter((p) => p.status === 'bloqueio');
  const alertas = lista.filter((p) => p.status === 'alerta');
  const atende = lista.filter((p) => p.status === 'ok');
  const semStatus = lista.filter(
    (p) => !(STATUS_CRITERIO_VALIDOS as readonly string[]).includes(String(p.status || '')),
  );
  // `comprovado` só existe em análises novas; em laudo antigo derivamos do
  // trecho, que é exatamente o mesmo dado. Sem esse fallback a tela acusaria
  // "sem trecho" em todo critério de todo laudo já gravado.
  const semTrecho = atende.filter(
    (p) => !(p.comprovado ?? Boolean(String(p.trecho_citado || '').trim())),
  );
  return { bloqueios, alertas, atende, semStatus, semTrecho };
}

/** true quando não sobrou nenhuma ressalva — a única situação em que a tela
 *  pode escrever "Todos os critérios configurados são atendidos". */
export function todosOsCriteriosAtendidos(c: ContagemDeCriterios<CriterioBruto>): boolean {
  return (
    c.bloqueios.length === 0
    && c.alertas.length === 0
    && c.semStatus.length === 0
    && c.semTrecho.length === 0
    && c.atende.length > 0
  );
}
