import type { SavedAnalysis } from '@/lib/types';

export type DecisionQueueKey = 'not_started' | 'triage' | 'pending' | 'proposal' | 'submitted' | 'won' | 'lost' | 'abandoned' | 'executed';
export type DecisionQueueFilter = 'all' | DecisionQueueKey;

export type DecisionQueueTask = {
  id: string;
  prazo: string;
  acao: string;
  responsavel: string;
  resultado_esperado: string;
  /** Consequência de não fazer. Vem dos itens de checklist; ações da decisão
   *  normalmente não têm. Estava só no tipo do laudo — que era metade do
   *  problema de existirem dois tipos para a mesma coisa. */
  impacto?: string;
  origem: string;
  prioridade: 'Alta' | 'Média' | 'Normal';
};

export type DecisionCockpitStatusMap = Record<string, {
  done?: boolean;
  updated_at?: string;
  responsavel?: string;
  prazo?: string;
  nota?: string;
}>;

export const decisionQueueStages: Record<DecisionQueueKey, {
  label: string;
  helper: string;
  className: string;
  dotClass: string;
}> = {
  not_started: {
    label: 'Não iniciado',
    helper: 'Ainda sem ação',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    dotClass: 'bg-slate-400',
  },
  triage: {
    label: 'Em triagem',
    helper: 'Validar decisão',
    className: 'border-amber-100 bg-amber-50 text-amber-700',
    dotClass: 'bg-amber-500',
  },
  pending: {
    label: 'Pendência',
    helper: 'Órgão ou edital',
    className: 'border-sky-100 bg-sky-50 text-sky-700',
    dotClass: 'bg-sky-500',
  },
  proposal: {
    label: 'Proposta',
    helper: 'Montar envio',
    className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    dotClass: 'bg-emerald-500',
  },
  submitted: {
    label: 'Enviado',
    helper: 'Aguardar resultado',
    className: 'border-violet-100 bg-violet-50 text-violet-700',
    dotClass: 'bg-violet-500',
  },
  won: {
    label: 'Ganho',
    helper: 'Aprender e executar',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dotClass: 'bg-emerald-600',
  },
  lost: {
    label: 'Perdido',
    helper: 'Aprender preço',
    className: 'border-rose-100 bg-rose-50 text-rose-700',
    dotClass: 'bg-rose-500',
  },
  abandoned: {
    label: 'Abandonado',
    helper: 'Decisão preservada',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    dotClass: 'bg-slate-500',
  },
  executed: {
    label: 'Executado',
    helper: 'Fluxo encerrado',
    className: 'border-zinc-200 bg-zinc-100 text-zinc-700',
    dotClass: 'bg-zinc-500',
  },
};

export const decisionQueueOrder: DecisionQueueKey[] = [
  'not_started',
  'triage',
  'pending',
  'proposal',
  'submitted',
  'won',
  'lost',
  'abandoned',
  'executed',
];

export function getDecisionQueueStage(
  analysis: SavedAnalysis,
  tasks = buildDecisionQueueTasks(analysis),
  statusMap = normalizeDecisionCockpitStatus(analysis.cockpit_status),
): { key: DecisionQueueKey } {
  const explicitStage = normalizeDecisionWorkflowStatus(analysis.workflow_status);
  if (explicitStage) return { key: explicitStage };

  const learning = asRecord(analysis.decision_learning);
  const learningResult = normalizeDecisionQueueText(learning.resultado);
  if (learningResult === 'won') return { key: 'won' };
  if (learningResult === 'lost') return { key: 'lost' };
  if (learningResult === 'abandoned' || learningResult === 'not_participated') return { key: 'abandoned' };

  const completed = tasks.filter((task) => statusMap[task.id]?.done).length;
  const hasStarted = Object.values(statusMap).some((state) => state?.done || state?.updated_at || state?.responsavel || state?.prazo || state?.nota);
  if (!hasStarted) return { key: 'not_started' };
  if (tasks.length > 0 && completed >= tasks.length) return { key: 'submitted' };

  const verdict = inferDecisionVerdict(analysis);
  if (verdict === 'NO_GO') return { key: 'pending' };
  if (verdict === 'GO') return { key: 'proposal' };
  return { key: 'triage' };
}

export function normalizeDecisionWorkflowStatus(value: unknown): DecisionQueueKey | null {
  const normalized = String(value || '').trim();
  return decisionQueueOrder.includes(normalized as DecisionQueueKey)
    ? normalized as DecisionQueueKey
    : null;
}

export function getNextDecisionQueueStage(stage: DecisionQueueKey): DecisionQueueKey | null {
  const index = decisionQueueOrder.indexOf(stage);
  if (index < 0 || index >= decisionQueueOrder.length - 1) return null;
  return decisionQueueOrder[index + 1];
}

export function inferDecisionVerdict(analysis: SavedAnalysis): 'GO' | 'GO_CONDICIONADO' | 'NO_GO' {
  const decision = asRecord(analysis.decisao);
  const raw = normalizeDecisionQueueText(
    decision.veredito || decision.rotulo || analysis.classification || analysis.recommendation || '',
  );
  const score = Number(analysis.score || 0);

  if (raw.includes('no-go') || raw.includes('no go') || raw.includes('nao participar') || score < 45) {
    return 'NO_GO';
  }
  if (raw.includes('condicion') || raw.includes('atencao') || (score >= 45 && score < 70)) {
    return 'GO_CONDICIONADO';
  }
  return 'GO';
}

/* ─── Plano de execução: UM construtor, duas telas ───────────────────────────
 *
 * ⚠️ ISTO AQUI ERA DUPLICADO. Existia `buildDecisionCockpitTasks` dentro do
 * AnalysisResults e esta função, quase iguais — e as duas produzem os `id`s
 * que indexam o `cockpit_status` salvo no documento da análise. Ou seja: não
 * era só código repetido, era o MESMO DADO sendo endereçado por duas chaves
 * que podiam divergir. E divergiam, em três pontos, todos em produção:
 *
 *   1. Análise SEM `proximas_acoes`: o laudo sintetizava 3 ações genéricas
 *      (via `normalizeDecisionActions`), esta aqui sintetizava 1. Listas
 *      diferentes, `id`s diferentes, "N/M concluídas" diferente nas duas telas
 *      para o mesmo edital.
 *   2. NO_GO: o laudo pulava o checklist ("habilitação só faz sentido para
 *      GO/condicional" — raciocínio correto), a Gestão incluía até 6 itens.
 *   3. O laudo cortava as ações em 5, esta não cortava.
 *
 * Agora existe uma função só, e as três divergências foram resolvidas para o
 * lado do LAUDO — que é a tela que o usuário conhece e onde o plano nasce.
 *
 * ⚠️ Consequência de migração, assumida: onde as duas telas já discordavam, a
 * lista muda de um lado. Marcações salvas em `id`s que deixam de existir ficam
 * órfãs no documento (não somem, apenas param de ser lidas). Não há caminho
 * sem isso — o estado já estava inconsistente entre as telas. */

/** Plano mínimo quando o laudo não trouxe `proximas_acoes`. Três passos, não
 *  um: com um só, o cockpit vira um aviso; com três, é um plano que a pessoa
 *  consegue distribuir. Copiado do que o laudo já mostrava. */
const ACOES_PADRAO: ReadonlyArray<Omit<DecisionQueueTask, 'id' | 'origem' | 'prioridade'> & { prioridade: DecisionQueueTask['prioridade'] }> = [
  {
    prazo: 'Hoje',
    acao: 'Conferir requisitos eliminatórios de habilitação e qualificação técnica.',
    responsavel: 'Licitações',
    resultado_esperado: 'Confirmar se há risco de desclassificação.',
    prioridade: 'Alta',
  },
  {
    prazo: 'Hoje',
    acao: 'Calcular preço mínimo viável com impostos, logística, garantias e deságio provável.',
    responsavel: 'Financeiro',
    resultado_esperado: 'Definir limite de lance com margem preservada.',
    prioridade: 'Alta',
  },
  {
    prazo: 'Próximo dia útil',
    acao: 'Validar cláusulas jurídicas, multas e pontos de impugnação.',
    responsavel: 'Jurídico',
    resultado_esperado: 'Fechar o risco contratual antes de assumir compromisso.',
    prioridade: 'Média',
  },
];

const ACAO_PADRAO_NO_GO: Omit<DecisionQueueTask, 'id' | 'origem'> = {
  prazo: 'Após resposta oficial',
  acao: 'Reavaliar somente quando o órgão corrigir as informações críticas.',
  responsavel: 'Licitações',
  resultado_esperado: 'Evitar esforço de proposta sem segurança técnica, financeira ou jurídica.',
  prioridade: 'Alta',
};

const _PARADAS_PLANO = new Set([
  'para', 'com', 'dos', 'das', 'nos', 'nas', 'pelo', 'pela', 'que', 'por',
  'sobre', 'cada', 'todos', 'todas', 'este', 'esta', 'esse', 'essa', 'ante',
  'antes', 'apos', 'sem', 'seu', 'sua', 'entre', 'item', 'itens',
]);

/** Palavras que carregam sentido, sem plural, para comparar duas tarefas. */
function _tokensDaTarefa(texto: string): Set<string> {
  const norm = normalizeDecisionQueueText(texto);
  const brutos = norm.match(/[a-z0-9]+/g) || [];
  const out = new Set<string>();
  for (const t of brutos) {
    if (t.length < 4 || _PARADAS_PLANO.has(t)) continue;
    out.add(t.endsWith('s') && t.length > 4 ? t.slice(0, -1) : t);
  }
  return out;
}

/** Duas tarefas dizem a mesma coisa?
 *
 *  Dedupe por texto exato não resolvia o caso real: a mesma exigência chega
 *  pela decisão ("Validar no dossiê regulatório o registro ANVISA... das duas
 *  apresentações de NIMESULIDA") e pelo checklist ("Conferir registro
 *  ANVISA... de cada apresentação de NIMESULIDA"). Palavras diferentes, tarefa
 *  idêntica — e o cockpit mostrava as duas, lado a lado, numeradas 01 e 05.
 *
 *  Usa CONTENÇÃO (interseção ÷ menor conjunto) e não Jaccard: a versão da
 *  decisão costuma ser mais longa e detalhada que a do checklist, e Jaccard
 *  pune esse desequilíbrio justamente onde ele é esperado. Piso de 4 tokens
 *  em comum evita que duas frases curtas colidam por acaso. */
function _mesmaTarefa(a: Set<string>, b: Set<string>): boolean {
  const menor = a.size <= b.size ? a : b;
  const maior = menor === a ? b : a;
  if (menor.size < 4) return false;
  let comuns = 0;
  for (const t of menor) if (maior.has(t)) comuns += 1;
  return comuns >= 4 && comuns / menor.size >= 0.6;
}

export function buildDecisionQueueTasks(analysis: SavedAnalysis): DecisionQueueTask[] {
  const decision = asRecord(analysis.decisao);
  const veredito = inferDecisionVerdict(analysis);
  const tasks: DecisionQueueTask[] = [];
  // Teto de 5, como o laudo sempre fez. Acima disso o cockpit deixa de ser um
  // plano e vira uma lista de tudo que a IA lembrou de dizer.
  const actions = (Array.isArray(decision.proximas_acoes) ? decision.proximas_acoes : []).slice(0, 5);

  actions.forEach((item, index) => {
    const action = asRecord(item);
    const prazo = shortenDecisionQueueText(action.prazo || 'Hoje', 40);
    const acao = shortenDecisionQueueText(action.acao || action.tarefa || action.descricao || item, 220);
    if (!acao) return;

    tasks.push({
      id: `decision-${index}-${normalizeDecisionQueueText(acao).slice(0, 40)}`,
      prazo,
      acao,
      responsavel: shortenDecisionQueueText(action.responsavel || 'Licitações', 80),
      resultado_esperado: shortenDecisionQueueText(action.resultado_esperado || 'Critério objetivo para seguir ou abandonar.', 140),
      origem: 'Decisão',
      prioridade: veredito === 'NO_GO' || /agora|hoje/i.test(prazo) ? 'Alta' : 'Média',
    });
  });

  // Nenhuma ação veio do laudo → plano mínimo. No NO_GO é uma linha só (não há
  // proposta a montar); nos demais, os três passos padrão.
  if (!tasks.length) {
    const base = veredito === 'NO_GO' ? [ACAO_PADRAO_NO_GO] : ACOES_PADRAO;
    base.forEach((padrao, index) => {
      tasks.push({
        id: `decision-${index}-${normalizeDecisionQueueText(padrao.acao).slice(0, 40)}`,
        origem: 'Decisão',
        ...padrao,
      });
    });
  }

  // Checklist de habilitação só entra em GO / GO_CONDICIONADO: num NO_GO não
  // existe proposta a protocolar, e listar "conferir ANVISA antes de enviar"
  // embaixo de um veredito de não participar é ruído que contradiz a decisão.
  if (veredito !== 'NO_GO') {
    const checklist = Array.isArray(analysis.checklist) ? analysis.checklist : [];
    checklist.slice(0, 6).forEach((item, index) => {
      const record = asRecord(item);
      const acao = shortenDecisionQueueText(record.tarefa || record.descricao || record.label || record.item || item, 180);
      if (!acao) return;
      const impacto = String(record.impacto || '').toLowerCase();

      tasks.push({
        id: `checklist-${index}-${normalizeDecisionQueueText(acao).slice(0, 40)}`,
        prazo: shortenDecisionQueueText(record.prazo || record.fase || 'Antes da proposta', 40),
        acao,
        responsavel: shortenDecisionQueueText(record.responsavel || 'Licitações', 80),
        resultado_esperado: shortenDecisionQueueText(record.resultado_esperado || 'Item validado antes de protocolar a proposta.', 140),
        impacto: shortenDecisionQueueText(record.impacto || '', 120) || undefined,
        origem: 'Checklist',
        prioridade: impacto.includes('alto') || impacto.includes('crítico') || impacto.includes('critico') ? 'Alta' : 'Normal',
      });
    });
  }

  // Dedupe ENTRE FONTES. A chave antiga era `origem-ação`, então uma exigência
  // que chegasse pela decisão E pelo checklist nunca colidia — a origem já as
  // separava. Era garantia de duplicata, não proteção contra ela.
  // A ordem preserva a versão da DECISÃO (empilhada primeiro), que é a mais
  // descritiva e traz responsável real em vez do "Licitações" genérico.
  const mantidas: { task: DecisionQueueTask; tokens: Set<string> }[] = [];
  for (const task of tasks) {
    const tokens = _tokensDaTarefa(task.acao);
    if (mantidas.some((m) => m.tokens.size && _mesmaTarefa(m.tokens, tokens))) continue;
    if (mantidas.some((m) => normalizeDecisionQueueText(m.task.acao) === normalizeDecisionQueueText(task.acao))) continue;
    mantidas.push({ task, tokens });
    if (mantidas.length >= 8) break;
  }
  return mantidas.map((m) => m.task);
}

export function normalizeDecisionCockpitStatus(value: SavedAnalysis['cockpit_status']): DecisionCockpitStatusMap {
  if (!value || typeof value !== 'object') return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([taskId]) => Boolean(taskId))
      .map(([taskId, state]) => [
        taskId,
        {
          done: Boolean(state?.done),
          updated_at: state?.updated_at,
          responsavel: state?.responsavel,
          prazo: state?.prazo,
          nota: state?.nota,
        },
      ]),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeDecisionQueueText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function shortenDecisionQueueText(value: unknown, max = 260) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}
