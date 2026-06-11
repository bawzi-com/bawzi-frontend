import type { SavedAnalysis } from '@/lib/types';

export type DecisionQueueKey = 'not_started' | 'triage' | 'pending' | 'proposal' | 'submitted' | 'won' | 'lost' | 'abandoned' | 'executed';
export type DecisionQueueFilter = 'all' | DecisionQueueKey;

export type DecisionQueueTask = {
  id: string;
  prazo: string;
  acao: string;
  responsavel: string;
  resultado_esperado: string;
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

export function buildDecisionQueueTasks(analysis: SavedAnalysis): DecisionQueueTask[] {
  const decision = asRecord(analysis.decisao);
  const tasks: DecisionQueueTask[] = [];
  const actions = Array.isArray(decision.proximas_acoes) ? decision.proximas_acoes : [];

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
      prioridade: inferDecisionVerdict(analysis) === 'NO_GO' || /agora|hoje/i.test(prazo) ? 'Alta' : 'Média',
    });
  });

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
      origem: 'Checklist',
      prioridade: impacto.includes('alto') || impacto.includes('crítico') || impacto.includes('critico') ? 'Alta' : 'Normal',
    });
  });

  if (!tasks.length) {
    const verdict = inferDecisionVerdict(analysis);
    const fallback = verdict === 'NO_GO'
      ? {
          prazo: 'Após resposta oficial',
          acao: 'Reavaliar somente quando o órgão corrigir as informações críticas.',
          responsavel: 'Licitações',
          resultado_esperado: 'Evitar esforço de proposta sem segurança técnica, financeira ou jurídica.',
          prioridade: 'Alta' as const,
        }
      : verdict === 'GO'
        ? {
            prazo: 'Hoje',
            acao: 'Separar documentos, validar preço limite e iniciar montagem da proposta.',
            responsavel: 'Licitações',
            resultado_esperado: 'Transformar o Go em envio controlado.',
            prioridade: 'Média' as const,
          }
        : {
            prazo: 'Hoje',
            acao: 'Resolver condições pendentes antes de consumir esforço de proposta.',
            responsavel: 'Licitações / Jurídico',
            resultado_esperado: 'Converter Go condicionado em decisão segura.',
            prioridade: 'Alta' as const,
          };

    tasks.push({
      id: `decision-0-${normalizeDecisionQueueText(fallback.acao).slice(0, 40)}`,
      origem: 'Decisão',
      ...fallback,
    });
  }

  const seen = new Set<string>();
  return tasks
    .filter((task) => {
      const key = normalizeDecisionQueueText(`${task.origem}-${task.acao}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
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
