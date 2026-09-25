'use client';

/**
 * As peças do resumo do edital na Gestão (25/09/2026): a situação em uma
 * frase, a linha de etapas, a próxima ação em destaque e as datas do edital.
 * Nenhuma usa hook: recebem o que `lib/gestao` calculou e chamam de volta o
 * modal, que é quem grava. Assim renderizam no servidor dos testes.
 */
import React from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, UserRound } from 'lucide-react';
import { decisionQueueStages, type DecisionQueueKey, type DecisionQueueTask } from '@/lib/decisionQueue';
import {
  dataCurta, ETAPAS_DO_FLUXO, ETAPAS_FINAIS, fraseDosDias, type DataDoEdital, type SituacaoDoEdital,
} from '@/lib/gestao';

const TOM: Record<SituacaoDoEdital['tom'], { caixa: string; titulo: string; icone: string }> = {
  vermelho: { caixa: 'border-red-200 bg-red-50', titulo: 'text-red-800', icone: 'text-red-600' },
  ambar: { caixa: 'border-amber-200 bg-amber-50', titulo: 'text-amber-800', icone: 'text-amber-600' },
  azul: { caixa: 'border-sky-200 bg-sky-50', titulo: 'text-sky-800', icone: 'text-sky-600' },
  verde: { caixa: 'border-emerald-200 bg-emerald-50', titulo: 'text-emerald-800', icone: 'text-emerald-600' },
  neutro: { caixa: 'border-slate-200 bg-slate-50', titulo: 'text-slate-800', icone: 'text-slate-500' },
};

const ROTULO_DA_SUGESTAO: Record<NonNullable<SituacaoDoEdital['sugestao']>, string> = {
  registrar_resultado: 'Registrar resultado',
  concluir_acao: 'Concluir a próxima ação',
  avancar: 'Avançar a etapa',
  conferir_prazo: 'Ver no PNCP',
};

/** A situação, em uma frase, e o botão do que ela sugere. */
export function SituacaoDoEditalBanner({ situacao, onSugestao, sugestaoDisponivel = true }: {
  situacao: SituacaoDoEdital;
  onSugestao?: (sugestao: NonNullable<SituacaoDoEdital['sugestao']>) => void;
  /** "Ver no PNCP" só existe quando o laudo tem a origem; sem ela, o botão some. */
  sugestaoDisponivel?: boolean;
}) {
  const tom = TOM[situacao.tom];
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${tom.caixa}`}>
      <AlertTriangle size={18} className={`hidden shrink-0 sm:block ${tom.icone}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] font-black leading-tight ${tom.titulo}`}>{situacao.titulo}</p>
        <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-slate-700">{situacao.texto}</p>
      </div>
      {situacao.sugestao && onSugestao && sugestaoDisponivel && (
        <button
          type="button"
          onClick={() => onSugestao(situacao.sugestao!)}
          className="shrink-0 rounded-xl bg-slate-900 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-slate-800"
        >
          {ROTULO_DA_SUGESTAO[situacao.sugestao]}
        </button>
      )}
    </div>
  );
}

/** As cinco etapas do fluxo como passos clicáveis. Num desfecho, a linha
 *  fica apagada e o desfecho aparece ao fim; clicar num passo reabre. */
export function LinhaDeEtapas({ stage, salvando = false, onEscolher }: {
  stage: DecisionQueueKey;
  salvando?: boolean;
  onEscolher: (stage: DecisionQueueKey) => void;
}) {
  const encerrado = ETAPAS_FINAIS.includes(stage);
  const indiceAtual = ETAPAS_DO_FLUXO.indexOf(stage);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {ETAPAS_DO_FLUXO.map((chave, i) => {
        const etapa = decisionQueueStages[chave];
        const atual = chave === stage;
        // Num desfecho `indiceAtual` é -1 (o desfecho não está na linha), e
        // nenhum passo conta como passado — sem precisar de guarda extra.
        const passada = i < indiceAtual;
        return (
          <React.Fragment key={chave}>
            {i > 0 && <span className={`h-px w-3 ${passada || atual ? 'bg-slate-700' : 'bg-slate-200'}`} aria-hidden />}
            <button
              type="button"
              disabled={salvando || atual}
              aria-current={atual ? 'step' : undefined}
              onClick={() => onEscolher(chave)}
              title={atual ? `Etapa atual: ${etapa.label}` : `Mover para ${etapa.label}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all disabled:cursor-default ${
                atual
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : passada
                    ? 'border-slate-300 bg-slate-100 text-slate-600 hover:border-slate-500'
                    : encerrado
                      ? 'border-slate-100 bg-white text-slate-300 hover:border-slate-300 hover:text-slate-600'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${atual ? 'bg-white/20 text-white' : passada ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {passada ? '✓' : i + 1}
              </span>
              {etapa.label}
            </button>
          </React.Fragment>
        );
      })}
      {encerrado && (
        <span className={`ml-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${decisionQueueStages[stage].className}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${decisionQueueStages[stage].dotClass}`} />
          {decisionQueueStages[stage].label}
        </span>
      )}
      {salvando && <Loader2 size={14} className="ml-1 animate-spin text-slate-400" />}
    </div>
  );
}

/** O caminho direto para um desfecho, sem passar por "Registrar resultado".
 *  Existe porque o `<select>` antigo era o único lugar que chegava a
 *  "Executado" (e a qualquer desfecho sem registro); a linha de etapas não
 *  tem os desfechos, e o registro não tem "Executado". */
export function SeletorDeDesfecho({ stage, salvando = false, onEscolher }: {
  stage: DecisionQueueKey;
  salvando?: boolean;
  onEscolher: (stage: DecisionQueueKey) => void;
}) {
  const atual = ETAPAS_FINAIS.includes(stage) ? stage : '';
  return (
    <label className="inline-flex items-center gap-2 text-[10.5px] font-medium text-slate-400">
      Sem registrar:
      <select
        value={atual}
        disabled={salvando}
        onChange={(event) => { if (event.target.value && event.target.value !== atual) onEscolher(event.target.value as DecisionQueueKey); }}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 outline-none focus:border-emerald-300 disabled:opacity-60"
      >
        <option value="">Desfecho direto…</option>
        {ETAPAS_FINAIS.map((chave) => (
          <option key={chave} value={chave}>{decisionQueueStages[chave].label}</option>
        ))}
      </select>
    </label>
  );
}

/** A próxima ação do plano, com quem faz, até quando, e o botão de concluir. */
export function ProximaAcaoCard({ tarefa, responsavel, prazo, feitas, total, salvando = false, onConcluir, onEditar }: {
  tarefa: DecisionQueueTask | null;
  responsavel: string;
  prazo: string;
  feitas: number;
  total: number;
  salvando?: boolean;
  onConcluir: () => void;
  onEditar: () => void;
}) {
  if (!tarefa) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Próxima ação</p>
        <p className="mt-1 text-[13px] font-bold text-slate-700">
          {total === 0 ? 'O laudo não trouxe plano de ações para este edital.' : `As ${total} ações do plano estão concluídas.`}
        </p>
      </div>
    );
  }
  const indice = feitas + 1;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Próxima ação · {indice} de {total}</p>
        <button type="button" onClick={onEditar} className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800">
          Editar no plano
        </button>
      </div>
      <p className="mt-1.5 text-[14px] font-black leading-snug text-slate-900">{tarefa.acao}</p>
      {tarefa.resultado_esperado && (
        <p className="mt-1 text-[11.5px] font-medium text-slate-600">{tarefa.resultado_esperado}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <UserRound size={12} className="text-slate-400" /> {responsavel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <CalendarDays size={12} className="text-slate-400" /> {prazo}
        </span>
        {tarefa.prioridade === 'Alta' && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800">prioridade alta</span>
        )}
        <button
          type="button"
          onClick={onConcluir}
          disabled={salvando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          Concluir
        </button>
      </div>
    </div>
  );
}

/** Todas as datas do edital, com "venceu há N dias" ou "em N dias". */
export function DatasDoEdital({ datas }: { datas: DataDoEdital[] }) {
  if (!datas.length) return null;
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {datas.map((d, i) => (
        <li
          key={i}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px] ${
            d.dias !== null && d.dias < 0 && d.decisivo ? 'border-red-100 bg-red-50/40' : d.decisivo ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/60'
          }`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${d.dias !== null && d.dias < 0 && d.decisivo ? 'bg-red-500' : d.decisivo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span className={`min-w-0 flex-1 truncate font-bold ${d.decisivo ? 'text-slate-800' : 'text-slate-500'}`} title={d.rotulo}>{d.rotulo}</span>
          <span className="shrink-0 font-medium text-slate-600">{d.data ? dataCurta(d.data) : d.bruto}</span>
          {d.dias !== null && (
            <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider ${d.dias < 0 ? (d.decisivo ? 'text-red-700' : 'text-slate-400') : d.dias <= 3 ? 'text-amber-700' : 'text-slate-400'}`}>
              {fraseDosDias(d.dias)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
