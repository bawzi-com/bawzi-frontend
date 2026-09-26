'use client';

/**
 * O quadro da Gestão redesenhado (25/09/2026): cabeçalho compacto, uma faixa
 * de controles, colunas leves e cards calmos. Marcelo: "parece fora de
 * organização, não convence, sobre design mesmo". O que pesava: caixa
 * dentro de caixa (cada card tinha cinco caixas com borda), tudo em negrito
 * e caixa alta de 8–9px, o mesmo número repetido em quatro lugares, um
 * cabeçalho de página de marketing e três fileiras de controles antes do
 * conteúdo. Nenhuma peça aqui usa hook: recebem o que a tela calculou e
 * chamam de volta quem grava, e por isso renderizam no servidor dos testes.
 */
import React from 'react';
import {
  ArrowRight, Check, ChevronRight, FileText, Loader2, Maximize2, Minimize2, RotateCcw, Search, SlidersHorizontal, X,
} from 'lucide-react';
import {
  decisionQueueStages, getNextDecisionQueueStage, inferDecisionVerdict, scoreOuNulo, type DecisionQueueKey,
} from '@/lib/decisionQueue';
import {
  dataCurta, diasAte, ETAPAS_FINAIS, fraseDosDias, orgaoDaAnalise, prazoCritico, tituloAmigavel, ufDaAnalise, valorDaAnalise,
  type CartaoDaGestao,
} from '@/lib/gestao';
import { valorCurto } from '@/lib/meusContratos';

// ─────────────────────────────────────────────────────────────────────────
// Cabeçalho
// ─────────────────────────────────────────────────────────────────────────

/** Uma linha: o nome da tela, quantos editais, e os alertas de prazo à
 *  direita. Sem selo, sem gradiente, sem a frase de ensino (ela mora no
 *  estado vazio, que é onde alguém ainda não sabe como trazer um edital). */
export function CabecalhoDaGestao({ total, vencidos, hojeAmanha, urgencia, telaCheia, onVencidos, onHojeAmanha, onVerTodos, onTelaCheia }: {
  total: number;
  vencidos: number;
  hojeAmanha: number;
  /** O filtro de prazo ativo: `'late'` e `'urgent'` marcam o botão. */
  urgencia: 'all' | 'late' | 'urgent' | 'week';
  telaCheia: boolean;
  onVencidos: () => void;
  onHojeAmanha: () => void;
  onVerTodos: () => void;
  onTelaCheia: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Gestão de execução</h2>
        {total > 0 && (
          <span
            className="text-[13px] text-slate-500"
            title="Só entram aqui os editais marcados com “+ Gestão” na análise. Os demais continuam em Decisões."
          >
            {total} {total === 1 ? 'edital em acompanhamento' : 'editais em acompanhamento'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* ⚠️ FUNDO SÓLIDO, e nas cores que passam no contraste: branco sobre
            `red-600` (4,83:1) e sobre `amber-700` (5,02:1). `amber-500/600` e
            `red-500` reprovam para texto de 12px. Medido antes de escolher. */}
        {vencidos > 0 && (
          <button
            type="button"
            onClick={onVencidos}
            aria-pressed={urgencia === 'late'}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-red-700 ${urgencia === 'late' ? 'ring-2 ring-red-300 ring-offset-1' : ''}`}
          >
            <span className="rounded-md bg-white/20 px-1.5 text-[12px] font-bold tabular-nums">{vencidos}</span>
            {vencidos === 1 ? 'prazo vencido' : 'prazos vencidos'}
          </button>
        )}
        {hojeAmanha > 0 && (
          <button
            type="button"
            onClick={onHojeAmanha}
            aria-pressed={urgencia === 'urgent'}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-amber-800 ${urgencia === 'urgent' ? 'ring-2 ring-amber-300 ring-offset-1' : ''}`}
          >
            <span className="rounded-md bg-white/20 px-1.5 text-[12px] font-bold tabular-nums">{hojeAmanha}</span>
            {hojeAmanha === 1 ? 'vence hoje ou amanhã' : 'vencem hoje ou amanhã'}
          </button>
        )}
        {urgencia !== 'all' && (
          <button type="button" onClick={onVerTodos} className="text-[12px] font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900">
            Ver todos
          </button>
        )}
        <button
          type="button"
          onClick={onTelaCheia}
          title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
          aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
        >
          {telaCheia ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Faixa de controles
// ─────────────────────────────────────────────────────────────────────────

/** Abas, busca e o botão de filtros numa linha só — é ESTA linha que fica
 *  presa ao topo ao rolar. O painel de filtros (chips de etapa e seletores)
 *  fica fora dela, no fluxo da página (`PainelDeFiltros`): preso junto, ele
 *  cobria os cards (Marcelo: "o filtro e as abas estão sobrepondo os cards").
 *
 *  ⚠️ NADA AQUI APARECE OU SOME COM O FILTRO. O "Limpar" morava nesta linha
 *  e só existia com filtro ativo: marcar uma etapa fazia ele surgir, a linha
 *  passava da largura e ele caía sozinho para uma segunda linha ("o botão
 *  limpar do filtro quebra pra segunda linha"). Ele foi para o painel, numa
 *  linha de altura fixa; a busca ganhou o próprio ×, com o espaço reservado. */
export function FaixaDeControles({ abas, busca, onBusca, filtrosAbertos, filtrosAtivos, visiveis, total, onAlternarFiltros }: {
  abas: React.ReactNode;
  busca: string;
  onBusca: (texto: string) => void;
  filtrosAbertos: boolean;
  filtrosAtivos: boolean;
  visiveis: number;
  total: number;
  onAlternarFiltros: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
        {abas}
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(event) => onBusca(event.target.value)}
            placeholder="Buscar por título, órgão, UF, termo ou decisão…"
            aria-label="Buscar editais"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-[12.5px] text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
          />
          {busca && (
            <button
              type="button"
              onClick={() => onBusca('')}
              aria-label="Limpar a busca"
              title="Limpar a busca"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onAlternarFiltros}
          aria-expanded={filtrosAbertos}
          className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[12px] font-medium transition-all ${
            filtrosAtivos
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
          }`}
        >
          <SlidersHorizontal size={13} className={filtrosAtivos ? 'text-emerald-600' : 'text-slate-400'} />
          Filtros
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${filtrosAtivos ? 'bg-white text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
            {visiveis} de {total}
          </span>
          <ChevronRight size={12} className={`transition-transform ${filtrosAbertos ? 'rotate-90' : ''}`} />
        </button>
    </div>
  );
}

/** A caixa do painel de filtros, no fluxo da página, logo abaixo da faixa.
 *  A primeira linha tem altura fixa (`h-6`): "Limpar filtros" entra e sai à
 *  direita dela sem empurrar os chips nem os seletores. */
export function PainelDeFiltros({ aberto, filtrosAtivos, onLimpar, children }: {
  aberto: boolean;
  filtrosAtivos: boolean;
  onLimpar: () => void;
  children: React.ReactNode;
}) {
  if (!aberto) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-1.5 flex h-6 items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500">Etapa</span>
        {filtrosAtivos && (
          <button
            type="button"
            onClick={onLimpar}
            className="inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <RotateCcw size={12} />
            Limpar filtros
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** Um chip de etapa no painel de filtros: nome em frase, contagem num selo,
 *  escuro quando marcado (o mesmo código das abas: escuro = escolhido),
 *  apagado quando fora do recorte ou sem nada.
 *
 *  ⚠️ MARCAR NÃO PODE MUDAR O TAMANHO. A versão anterior punha um ✓ (mais
 *  ~18px) e um anel `ring-2 ring-offset-1` (3px para fora) no marcado: o chip
 *  crescia, empurrava os vizinhos, e o anel era cortado pela linha, que rolava
 *  na horizontal ("está quebrando / estourando em razão da seleção"). Agora
 *  marcado e desmarcado têm a mesma borda, o mesmo padding e o mesmo
 *  conteúdo; só as cores trocam. */
export function ChipDeEtapa({ stage, n, selecionada, noRecorte = true, onClick }: {
  stage: DecisionQueueKey;
  n: number;
  selecionada: boolean;
  noRecorte?: boolean;
  onClick: () => void;
}) {
  const s = decisionQueueStages[stage];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={n === 0}
      aria-pressed={selecionada}
      title={n === 0 ? `${s.label} — nenhum edital nesta etapa` : selecionada ? `${s.label} marcada — clique para tirar do filtro` : `${s.helper} — clique para somar ao filtro`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1.5 text-[11.5px] font-medium transition-colors ${
        selecionada
          ? 'border-slate-900 bg-slate-900 text-white'
          : `${s.className} ${n === 0 ? 'cursor-not-allowed opacity-40' : noRecorte ? 'hover:shadow-sm' : 'opacity-40 hover:opacity-100'}`
      }`}
    >
      {s.label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums ${selecionada ? 'bg-white/20 text-white' : 'bg-white/70'}`}>{n}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Coluna
// ─────────────────────────────────────────────────────────────────────────

/** Sem moldura: um cabeçalho fino (ponto da etapa, nome, contagem) e um
 *  fundo cinza claro onde os cards flutuam. O número de ordem e a frase de
 *  ajuda saíram — a ordem é a das colunas, e a ajuda mora no `title`. */
export function ColunaDoQuadro({ stage, n, children }: { stage: DecisionQueueKey; n: number; children: React.ReactNode }) {
  const s = decisionQueueStages[stage];
  const final = ETAPAS_FINAIS.includes(stage);
  return (
    <section className="flex min-w-0 flex-col" aria-label={`${s.label}: ${n}`}>
      {/* `div`, não `header`: `useStickyHeaderOffset` mede o primeiro
          `<header>` do documento para posicionar modais e a faixa presa. */}
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 shrink-0 rounded-full ${s.dotClass}`} aria-hidden />
        <h4 className="text-[12px] font-semibold text-slate-700" title={s.helper}>{s.label}</h4>
        <span className="text-[11px] tabular-nums text-slate-400">{n}</span>
      </div>
      <div className={`flex-1 space-y-2 rounded-xl p-2 ${final ? 'bg-zinc-100/70' : 'bg-slate-100/70'}`}>
        {n === 0 ? <p className="py-6 text-center text-[11px] text-slate-400">Nenhum edital</p> : children}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cartão
// ─────────────────────────────────────────────────────────────────────────

export interface SeloDoCartao { texto: string; classe: string; titulo?: string }

/** Os três selos do card, calculados fora do JSX para o teste ler direto:
 *  o score (uma cor pelo veredito), o prazo (uma cor pela urgência) e, no
 *  lugar do prazo quando o fluxo encerrou, nada — o resultado vem de fora. */
export function selosDoCartao(card: CartaoDaGestao, hoje: Date = new Date()): { score: SeloDoCartao; prazo: SeloDoCartao | null; noGo: boolean } {
  const score = scoreOuNulo(card.analysis.score);
  const veredito = inferDecisionVerdict(card.analysis);
  const classeDoScore = score === null
    ? 'bg-slate-100 text-slate-500'
    : veredito === 'NO_GO'
      ? 'bg-red-50 text-red-700'
      : veredito === 'GO_CONDICIONADO'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-emerald-50 text-emerald-700';
  const rotuloDoVeredito = veredito === 'NO_GO' ? 'No-Go' : veredito === 'GO_CONDICIONADO' ? 'Go com ressalvas' : 'Go';
  const selo: SeloDoCartao = {
    texto: score === null ? '—' : String(score),
    classe: classeDoScore,
    titulo: score === null ? `Sem score · ${rotuloDoVeredito}` : `Score ${score} · ${rotuloDoVeredito}`,
  };
  if (ETAPAS_FINAIS.includes(card.stage)) return { score: selo, prazo: null, noGo: false };

  const prazo = prazoCritico(card.analysis, card.nextTask, hoje);
  const dias = prazo.data ? diasAte(prazo.data, hoje) : null;
  const seloDoPrazo: SeloDoCartao = dias === null
    ? { texto: 'Sem prazo', classe: 'bg-slate-100 text-slate-500', titulo: prazo.rotulo }
    : dias < 0
      ? { texto: `Venceu ${fraseDosDias(dias).replace(/^venceu /, '')}`, classe: 'bg-red-50 text-red-700 ring-1 ring-red-100', titulo: prazo.rotulo }
      : dias <= 1
        ? { texto: `Vence ${fraseDosDias(dias)}`, classe: 'bg-red-50 text-red-700', titulo: prazo.rotulo }
        : dias <= 7
          ? { texto: `Vence ${fraseDosDias(dias)}`, classe: 'bg-amber-50 text-amber-700', titulo: prazo.rotulo }
          : { texto: `Vence ${fraseDosDias(dias)}`, classe: 'bg-slate-100 text-slate-600', titulo: prazo.rotulo };
  return { score: selo, prazo: seloDoPrazo, noGo: veredito === 'NO_GO' };
}

/** A linha sob o título: órgão · UF · valor, só com o que existe. */
export function linhaDoCartao(card: CartaoDaGestao): string {
  const partes = [orgaoDaAnalise(card.analysis) || 'Órgão não identificado', ufDaAnalise(card.analysis)];
  const valor = valorDaAnalise(card.analysis);
  // `valorDaAnalise` já devolve null para zero e texto sem número.
  if (valor !== null) partes.push(valorCurto(valor));
  return partes.filter(Boolean).join(' · ');
}

export interface SinaisDoCartao {
  /** "Ganho", "Perdido"… quando há resultado registrado. */
  resultado?: string | null;
  resultadoAutomatico?: boolean;
  vigencia?: { label: string; className: string } | null;
  mudouNoPncp?: boolean;
}

/** Um card: título, órgão · UF · valor, os selos, a próxima ação com o
 *  círculo de concluir, e um rodapé discreto. O card inteiro abre o resumo;
 *  a caixa "Resumo do edital" que só fazia isso foi embora, e com ela o chip
 *  da etapa (a coluna já diz) e o segundo "0/3". */
export function CartaoDoEdital({ card, hoje = new Date(), sinais = {}, salvandoTarefa = false, salvandoEtapa = false, abrindoLaudo = false, onAbrir, onAbrirPlano, onConcluir, onAvancar, onLaudo }: {
  card: CartaoDaGestao;
  hoje?: Date;
  sinais?: SinaisDoCartao;
  salvandoTarefa?: boolean;
  salvandoEtapa?: boolean;
  abrindoLaudo?: boolean;
  onAbrir: () => void;
  onAbrirPlano: () => void;
  onConcluir: () => void;
  onAvancar: (etapa: DecisionQueueKey) => void;
  onLaudo: () => void;
}) {
  const { score, prazo, noGo } = selosDoCartao(card, hoje);
  const proxima = getNextDecisionQueueStage(card.stage);
  const final = ETAPAS_FINAIS.includes(card.stage);
  const criado = card.analysis.created_at ? dataCurta(new Date(card.analysis.created_at)) : '';
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <article className="rounded-xl bg-white shadow-sm ring-1 ring-slate-900/[0.06] transition-shadow hover:shadow-md" data-analysis={card.analysis.id}>
      {/* O corpo é o alvo do clique. Não vira <button> porque há botões
          dentro (concluir, plano) — aninhar botão é HTML inválido. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onAbrir}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
        className="cursor-pointer p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">
            {tituloAmigavel(card.analysis.title || '') || 'Análise de edital'}
          </h3>
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${score.classe}`} title={score.titulo}>
            {score.texto}
          </span>
        </div>
        <p className="mt-1 truncate text-[11px] text-slate-500">{linhaDoCartao(card)}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {prazo && (
            <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${prazo.classe}`} title={prazo.titulo}>{prazo.texto}</span>
          )}
          {noGo && (
            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10.5px] font-medium text-red-700">No-Go</span>
          )}
          {sinais.resultado && (
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-800" title={sinais.resultadoAutomatico ? 'Resultado preenchido automaticamente pela homologação do PNCP' : undefined}>
              {sinais.resultado}{sinais.resultadoAutomatico ? ' · PNCP' : ''}
            </span>
          )}
          {sinais.vigencia && (
            <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${sinais.vigencia.className}`}>{sinais.vigencia.label}</span>
          )}
          {sinais.mudouNoPncp && (
            <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10.5px] font-medium text-sky-700">Mudou no PNCP</span>
          )}
        </div>

        {card.nextTask ? (
          <div className="mt-3 flex items-start gap-2 border-t border-slate-100 pt-2.5">
            <button
              type="button"
              onClick={(e) => { parar(e); onConcluir(); }}
              disabled={salvandoTarefa}
              title={`Concluir: ${card.nextTask.acao}`}
              aria-label={`Concluir ação: ${card.nextTask.acao}`}
              className="-m-1.5 shrink-0 rounded-full p-1.5 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-300 text-emerald-600">
                {salvandoTarefa ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} strokeWidth={3} />}
              </span>
            </button>
            <button type="button" onClick={(e) => { parar(e); onAbrirPlano(); }} className="group min-w-0 flex-1 text-left">
              <span className="block text-[10px] text-slate-400">Próxima ação · {card.done + 1} de {card.total}</span>
              <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-700 group-hover:text-slate-900">{card.nextTask.acao}</span>
            </button>
          </div>
        ) : (
          <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
            {card.total === 0 ? 'Sem plano de ações no laudo' : 'Plano concluído'}
          </p>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5">
        {/* Só a contagem: com a data junto ("0/3 ações · 20 de set.") o texto
            não cabia na coluna de 240px e saía cortado. A data fica no title. */}
        <span className="truncate text-[10.5px] text-slate-400" title={criado ? `Analisado em ${criado}` : undefined}>
          {card.total > 0 ? `${card.done}/${card.total} ações` : 'Sem ações'}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onLaudo}
            disabled={abrindoLaudo}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            {abrindoLaudo ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
            Laudo
          </button>
          {proxima && !final && (
            <button
              type="button"
              onClick={() => onAvancar(proxima)}
              disabled={salvandoEtapa}
              title={`Avançar para ${decisionQueueStages[proxima].label}`}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              Avançar
              {salvandoEtapa ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
            </button>
          )}
        </span>
      </footer>
    </article>
  );
}
