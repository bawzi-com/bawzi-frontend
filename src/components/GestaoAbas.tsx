'use client';

/**
 * As abas da Gestão de execução além do quadro (25/09/2026): Agenda, Tabela,
 * Desempenho e Responsáveis. Nenhuma usa hook: recebem o que a lib `gestao`
 * calculou e chamam de volta quem as monta. Assim renderizam no servidor
 * dos testes e podem ser chamadas como função para conferir cliques.
 */
import React from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BarChart3, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Columns3, Download,
  Table2, Trophy, UserRound, Users,
} from 'lucide-react';
import { decisionQueueStages, type DecisionQueueKey } from '@/lib/decisionQueue';
import {
  agruparAgenda, alternarTipoDaAgenda, brl, COLUNAS_DA_TABELA, dataCurta, FILTRO_DA_AGENDA_VAZIO, filtrarItensDaAgenda,
  filtroDaAgendaAtivo, gradeDoMes, inicioDoMes, itensDaSelecao, mesSeguinte, rotuloDoMesLongo, tipoDoPrazo, tituloAmigavel,
  type AbaDaGestao, ABAS_DA_GESTAO, type CargaDoResponsavel, type ColunaDaTabela, type Desempenho, type DirecaoDaOrdem,
  type FiltroDaAgenda, type ItemDaAgenda, type LinhaDaTabela, type SelecaoDaAgenda, type TipoDoPrazo,
} from '@/lib/gestao';

// ─────────────────────────────────────────────────────────────────────────
// A barra de abas
// ─────────────────────────────────────────────────────────────────────────

const ICONE_DA_ABA: Record<AbaDaGestao, React.ComponentType<{ size?: number; className?: string }>> = {
  quadro: Columns3,
  agenda: CalendarDays,
  tabela: Table2,
  desempenho: BarChart3,
  responsaveis: Users,
};

/** ⚠️ ERAM CINCO PALAVRAS EM CAIXA ALTA COM UM NÚMERO AO LADO — E A FAIXA DE
 *  ETAPAS, LOGO ACIMA, É EXATAMENTE ISSO. "QUADRO 7 · AGENDA 16 · TABELA 7"
 *  lia-se como mais uma fileira de contagens, não como um lugar para clicar
 *  (Marcelo: "não fica muito claro que são abas"). Virou um controle
 *  segmentado: um trilho cinza com a aba ativa em relevo escuro, ícone e
 *  rótulo em frase, o número discreto; a descrição da visão fica no `title`.
 *  Contagem zero não aparece: "Desempenho 0" dizia "não tem nada aqui" para
 *  uma aba que tem funil mesmo sem resultado registrado. Só o trilho: quem
 *  o põe na faixa de controles decide o que vai ao lado. */
export function BarraDeAbas({ ativa, contagens, onTrocar }: {
  ativa: AbaDaGestao;
  contagens: Partial<Record<AbaDaGestao, number>>;
  onTrocar: (aba: AbaDaGestao) => void;
}) {
  return (
    <div role="tablist" aria-label="Visões da gestão" className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-slate-200/70 p-1">
      {ABAS_DA_GESTAO.map((aba) => {
        const selecionada = aba.chave === ativa;
        const n = contagens[aba.chave];
        const Icone = ICONE_DA_ABA[aba.chave];
        return (
          <button
            key={aba.chave}
            type="button"
            role="tab"
            aria-selected={selecionada}
            onClick={() => onTrocar(aba.chave)}
            title={aba.descricao}
            className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition-all ${
              selecionada
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
            }`}
          >
            <Icone size={13} className={selecionada ? 'text-emerald-300' : 'text-slate-400'} />
            {aba.rotulo}
            {n != null && n > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${selecionada ? 'bg-white/15 text-emerald-200' : 'bg-white text-slate-600'}`}>
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function chipDaEtapa(stage: DecisionQueueKey) {
  const s = decisionQueueStages[stage];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dotClass}`} />
      {s.label}
    </span>
  );
}

const DIA_LONGO = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

// ─────────────────────────────────────────────────────────────────────────
// Agenda: o calendário do mês e o painel do que foi escolhido
// ─────────────────────────────────────────────────────────────────────────
// A primeira versão era uma lista corrida de todos os prazos, e não dava
// para analisar: cada edital tem várias datas. Agora o mês mostra onde os
// prazos se concentram; o painel lista só o dia clicado, os vencidos ou os
// próximos sete dias. Datas informativas ficam escondidas por padrão.
//
// ⚠️ TÍTULO EM CAIXA ALTA NÃO CABE NUMA CÉLULA. O edital chega gritando
// ("REGISTRO DE PREÇOS PARA EVENTUAL AQUISIÇÃO…"); dentro do calendário
// vira frase (`tituloAmigavel`). O nome do tipo é o que se lê primeiro.

const ESTILO_DO_TIPO: Record<TipoDoPrazo, { pilula: string; ponto: string; nome: string }> = {
  propostas: { pilula: 'bg-emerald-50 text-emerald-800 ring-emerald-200', ponto: 'bg-emerald-500', nome: 'Propostas' },
  sessao: { pilula: 'bg-violet-50 text-violet-800 ring-violet-200', ponto: 'bg-violet-500', nome: 'Sessão' },
  impugnacao: { pilula: 'bg-amber-50 text-amber-800 ring-amber-200', ponto: 'bg-amber-500', nome: 'Impugnação' },
  esclarecimento: { pilula: 'bg-sky-50 text-sky-800 ring-sky-200', ponto: 'bg-sky-500', nome: 'Esclarecimento' },
  outro: { pilula: 'bg-slate-50 text-slate-600 ring-slate-200', ponto: 'bg-slate-400', nome: 'Outros' },
};
const ESTILO_VENCIDO = { pilula: 'bg-red-50 text-red-800 ring-red-200', ponto: 'bg-red-500', nome: 'Vencido' };

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function estiloDoItem(item: ItemDaAgenda) {
  return item.dias < 0 && item.decisivo ? ESTILO_VENCIDO : ESTILO_DO_TIPO[tipoDoPrazo(item.rotulo).tipo];
}

function horaDe(d: Date): string | null {
  if (d.getHours() + d.getMinutes() === 0) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ItemDoPainel({ item, onAbrir }: { item: ItemDaAgenda; onAbrir: (analysisId: string) => void }) {
  const estilo = estiloDoItem(item);
  const tipo = tipoDoPrazo(item.rotulo);
  const hora = horaDe(item.data);
  return (
    <button
      type="button"
      onClick={() => onAbrir(item.analysisId)}
      title="Abrir o resumo e o plano deste edital"
      className={`group flex w-full gap-3 rounded-2xl border p-3 text-left transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-sm ${
        item.dias < 0 ? 'border-red-100 bg-red-50/40' : 'border-slate-200 bg-white'
      }`}
    >
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${estilo.ponto}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-500">
          <span className={`font-black ${item.dias < 0 ? 'text-red-700' : 'text-slate-700'}`} title={item.rotulo}>
            {tipo.curto}
          </span>
          {hora && <span>às {hora}</span>}
          {item.dias < 0 && <span className="text-red-700">venceu há {-item.dias} dia{item.dias === -1 ? '' : 's'}</span>}
          {item.dias === 0 && <span className="text-emerald-700">hoje</span>}
          {item.dias === 1 && <span className="text-amber-700">amanhã</span>}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[13px] font-bold leading-snug text-slate-800 group-hover:text-slate-950">
          {tituloAmigavel(item.titulo)}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-500">
          {chipDaEtapa(item.stage)}
          <span className="truncate">{item.orgao || 'Órgão não identificado'}</span>
        </span>
        {item.proximaAcao && (
          <span className="mt-1.5 block rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium leading-snug text-slate-600">
            <span className="font-black text-slate-500">Próxima ação:</span> {item.proximaAcao}
          </span>
        )}
      </span>
    </button>
  );
}

export function AbaAgenda({
  itens: todosOsItens, mes, hoje = new Date(), selecao, soDecisivos, filtro = FILTRO_DA_AGENDA_VAZIO,
  onMes, onSelecionar, onSoDecisivos, onFiltro, onAbrir,
}: {
  itens: ItemDaAgenda[];
  mes: Date;
  hoje?: Date;
  selecao: SelecaoDaAgenda;
  soDecisivos: boolean;
  /** A legenda é o filtro (25/09/2026): tipos somam, "vencido" recorta. */
  filtro?: FiltroDaAgenda;
  onMes: (mes: Date) => void;
  onSelecionar: (selecao: SelecaoDaAgenda) => void;
  onSoDecisivos: (v: boolean) => void;
  onFiltro?: (filtro: FiltroDaAgenda) => void;
  onAbrir: (analysisId: string) => void;
}) {
  const itens = filtrarItensDaAgenda(todosOsItens, filtro);
  const semanas = gradeDoMes(mes, itens, hoje);
  // As contagens da legenda saem do conjunto inteiro: um chip que zerasse ao
  // ser clicado perderia a referência de quanto existe fora do recorte.
  const porTipo = (t: TipoDoPrazo) => todosOsItens.filter((i) => tipoDoPrazo(i.rotulo).tipo === t).length;
  const vencidosNoTotal = todosOsItens.filter((i) => i.dias < 0 && i.decisivo).length;
  const tiposDaLegenda = (['propostas', 'sessao', 'impugnacao', 'esclarecimento', 'outro'] as TipoDoPrazo[])
    .filter((t) => t !== 'outro' || porTipo('outro') > 0);
  const filtroAtivo = filtroDaAgendaAtivo(filtro);
  const vencidos = itens.filter((i) => i.dias < 0).length;
  const proximos = itens.filter((i) => i.dias >= 0 && i.dias <= 7).length;
  const deHoje = itens.filter((i) => i.dias === 0).length;
  const noMes = itens.filter((i) => i.data.getFullYear() === mes.getFullYear() && i.data.getMonth() === mes.getMonth()).length;
  const selecionados = itensDaSelecao(itens, selecao);
  const blocos = agruparAgenda(selecionados);
  const diaSelecionado = selecao !== 'proximos' && selecao !== 'vencidos' ? selecao : null;
  const tituloDoPainel = selecao === 'vencidos'
    ? 'Prazos vencidos'
    : selecao === 'proximos'
      ? 'Próximos 7 dias'
      : DIA_LONGO.format(new Date(`${selecao}T12:00:00`)).replace('.', '');
  const subtituloDoPainel = selecao === 'vencidos'
    ? 'Prazos decisivos que passaram nos últimos 60 dias.'
    : selecao === 'proximos'
      ? (deHoje ? `${deHoje} vence${deHoje === 1 ? '' : 'm'} hoje.` : 'Nada vence hoje.')
      : 'Clique no dia de novo para voltar aos próximos 7 dias.';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            <button type="button" onClick={() => onMes(mesSeguinte(mes, -1))} aria-label="Mês anterior"
                    className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-sm">
              <ChevronLeft size={15} />
            </button>
            <h3 className="min-w-[160px] text-center text-[14px] font-black text-slate-900">{rotuloDoMesLongo(mes)}</h3>
            <button type="button" onClick={() => onMes(mesSeguinte(mes, 1))} aria-label="Mês seguinte"
                    className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-sm">
              <ChevronRight size={15} />
            </button>
          </div>
          <button type="button" onClick={() => { onMes(inicioDoMes(hoje)); onSelecionar('proximos'); }}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-800 transition-colors hover:bg-emerald-100">
            Hoje
          </button>
          <span className="text-[12px] font-semibold text-slate-500">
            {noMes === 0 ? 'Nenhum prazo neste mês' : `${noMes} prazo${noMes === 1 ? '' : 's'} neste mês`}
          </span>
          {/* Dito pelo lado positivo: "mostrar datas informativas" desligado
              é mais fácil de entender do que "só prazos decisivos" ligado. */}
          <button
            type="button"
            role="switch"
            aria-checked={!soDecisivos}
            onClick={() => onSoDecisivos(!soDecisivos)}
            title="Publicação, visita técnica e outras datas que não são prazo"
            className="ml-auto inline-flex items-center gap-2 text-[11px] font-bold text-slate-600"
          >
            <span className={`relative inline-block h-5 w-9 rounded-full transition-colors ${!soDecisivos ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${!soDecisivos ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
            Mostrar datas informativas
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {DIAS_DA_SEMANA.map((d, i) => (
            <span key={d} className={`pb-1 text-center text-[10px] font-black lowercase tracking-wide ${i === 0 || i === 6 ? 'text-slate-300' : 'text-slate-400'}`}>{d}</span>
          ))}
          {semanas.flat().map((dia) => {
            const ativo = diaSelecionado === dia.chave;
            const fimDeSemana = dia.data.getDay() === 0 || dia.data.getDay() === 6;
            const visiveis = dia.itens.slice(0, 3);
            const resto = dia.itens.length - visiveis.length;
            return (
              <button
                key={dia.chave}
                type="button"
                disabled={dia.itens.length === 0}
                aria-pressed={ativo}
                onClick={() => onSelecionar(ativo ? 'proximos' : dia.chave)}
                title={dia.itens.length ? `${dia.itens.length} prazo${dia.itens.length === 1 ? '' : 's'}` : undefined}
                className={`flex min-h-[82px] flex-col gap-1 rounded-xl border p-1.5 text-left transition-all ${
                  ativo
                    ? 'border-slate-900 bg-slate-900 shadow-md'
                    : dia.itens.length
                      ? 'border-slate-200 bg-white shadow-sm hover:-translate-y-px hover:border-emerald-300 hover:shadow'
                      : fimDeSemana ? 'border-transparent bg-slate-50/70' : 'border-transparent bg-slate-50'
                } ${dia.foraDoMes ? 'opacity-40' : ''} ${dia.itens.length ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className={`flex h-6 w-6 items-center justify-center self-end rounded-full text-[11px] font-black tabular-nums ${
                  dia.hoje
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-200'
                    : ativo ? 'text-white' : dia.passado ? 'text-slate-400' : 'text-slate-700'
                }`}>
                  {dia.dia}
                </span>
                {visiveis.map((item, i) => {
                  const estilo = estiloDoItem(item);
                  const tipo = tipoDoPrazo(item.rotulo);
                  return (
                    <span
                      key={i}
                      title={`${item.rotulo} · ${item.titulo}`}
                      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-4 ring-1 ring-inset ${
                        ativo ? 'bg-white/10 text-white ring-white/20' : estilo.pilula
                      } ${!item.decisivo ? 'opacity-70' : ''}`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ativo ? 'bg-white' : estilo.ponto}`} />
                      <span className="truncate">
                        {tipo.curto}
                        <span className="hidden font-medium opacity-80 2xl:inline"> · {tituloAmigavel(item.titulo)}</span>
                      </span>
                    </span>
                  );
                })}
                {resto > 0 && <span className={`pl-1 text-[10px] font-black ${ativo ? 'text-white/80' : 'text-slate-500'}`}>+{resto} mais</span>}
              </button>
            );
          })}
        </div>
        {/* A legenda filtra: clicar num tipo mostra só ele (dois tipos somam);
            "Vencido" recorta por cima. Chip apagado = nenhum item desse tipo. */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          {tiposDaLegenda.map((t) => {
            const n = porTipo(t);
            const marcado = filtro.tipos.has(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={marcado}
                disabled={n === 0}
                onClick={() => onFiltro?.(alternarTipoDaAgenda(filtro, t))}
                title={n === 0 ? `Nenhum prazo de ${ESTILO_DO_TIPO[t].nome.toLowerCase()}` : marcado ? 'Clique para tirar do filtro' : `Ver só ${ESTILO_DO_TIPO[t].nome.toLowerCase()}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all ${
                  marcado ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : n === 0 ? 'cursor-not-allowed border-slate-100 text-slate-300' : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${ESTILO_DO_TIPO[t].ponto}`} />
                {ESTILO_DO_TIPO[t].nome}
                <span className={`tabular-nums ${marcado ? 'text-white/70' : 'text-slate-400'}`}>{n}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={filtro.soVencidos}
            disabled={vencidosNoTotal === 0}
            onClick={() => onFiltro?.({ ...filtro, soVencidos: !filtro.soVencidos })}
            title={vencidosNoTotal === 0 ? 'Nenhum prazo vencido' : filtro.soVencidos ? 'Clique para voltar a ver todos' : 'Ver só o que já venceu'}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all ${
              filtro.soVencidos ? 'border-red-700 bg-red-700 text-white shadow-sm' : vencidosNoTotal === 0 ? 'cursor-not-allowed border-slate-100 text-slate-300' : 'border-slate-200 bg-white hover:border-red-300'
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${ESTILO_VENCIDO.ponto}`} />
            Vencido
            <span className={`tabular-nums ${filtro.soVencidos ? 'text-white/70' : 'text-slate-400'}`}>{vencidosNoTotal}</span>
          </button>
          {filtroAtivo ? (
            <button type="button" onClick={() => onFiltro?.(FILTRO_DA_AGENDA_VAZIO)}
                    className="ml-1 font-black text-emerald-700 underline-offset-2 hover:underline">
              limpar filtro
            </button>
          ) : (
            <span className="ml-1 text-slate-400">· clique num tipo para ver só ele</span>
          )}
        </div>
      </section>

      <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
          {([
            ['proximos', 'Próximos 7 dias', proximos, ''],
            ['vencidos', 'Vencidos', vencidos, vencidos ? 'text-red-700' : ''],
          ] as Array<[SelecaoDaAgenda, string, number, string]>).map(([chave, rotulo, n, cor]) => (
            <button
              key={chave}
              type="button"
              aria-pressed={selecao === chave}
              onClick={() => onSelecionar(chave)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black transition-all ${
                selecao === chave ? 'bg-white text-slate-900 shadow-sm' : `text-slate-500 hover:text-slate-800 ${cor}`
              }`}
            >
              {rotulo}
              <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${selecao === chave ? 'bg-slate-100 text-slate-700' : 'bg-white/70 text-slate-500'}`}>{n}</span>
            </button>
          ))}
        </div>
        <h3 className="text-[15px] font-black capitalize text-slate-900">{tituloDoPainel}</h3>
        <p className="mb-3 text-[11px] font-medium text-slate-500">{subtituloDoPainel}</p>
        {selecionados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
            <CalendarCheck size={22} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-[13px] font-black text-slate-700">
              {selecao === 'vencidos' ? 'Nenhum prazo vencido' : selecao === 'proximos' ? 'Semana livre de prazos' : 'Nenhum prazo neste dia'}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              {selecao === 'vencidos'
                ? 'Nada decisivo ficou para trás nos últimos 60 dias.'
                : 'Os próximos prazos estão no calendário ao lado: clique num dia para vê-los.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {blocos.map((bloco) => (
              <div key={bloco.grupo}>
                {diaSelecionado === null && (
                  <p className={`mb-1.5 text-[11px] font-semibold tracking-[0.14em] ${
                    bloco.grupo === 'vencidos' ? 'text-red-700' : bloco.grupo === 'hoje' ? 'text-emerald-700' : bloco.grupo === 'amanha' ? 'text-amber-700' : 'text-slate-400'
                  }`}>
                    {bloco.rotulo}
                  </p>
                )}
                <div className="space-y-2">
                  {bloco.dias.map((dia) => (
                    <React.Fragment key={dia.chave}>
                      {diaSelecionado === null && bloco.dias.length > 1 && (
                        <p className="text-[10px] font-bold capitalize text-slate-500">{DIA_LONGO.format(dia.data).replace('.', '')}</p>
                      )}
                      {dia.itens.map((item, i) => <ItemDoPainel key={`${item.analysisId}-${i}`} item={item} onAbrir={onAbrir} />)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tabela
// ─────────────────────────────────────────────────────────────────────────

export function AbaTabela({ linhas, coluna, direcao, onOrdenar, onAbrir, onExportar }: {
  linhas: LinhaDaTabela[];
  coluna: ColunaDaTabela;
  direcao: DirecaoDaOrdem;
  onOrdenar: (coluna: ColunaDaTabela) => void;
  onAbrir: (analysisId: string) => void;
  onExportar: () => void;
}) {
  const scoreClasse = (s: number | null) => s === null ? 'text-slate-400' : s >= 70 ? 'text-emerald-700' : s >= 45 ? 'text-amber-700' : 'text-red-700';
  const prazoClasse = (l: LinhaDaTabela) => {
    if (!l.prazo) return 'text-slate-400';
    const dias = Math.round((new Date(l.prazo.getFullYear(), l.prazo.getMonth(), l.prazo.getDate()).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86_400_000);
    return dias < 0 ? 'text-red-700' : dias <= 3 ? 'text-amber-700' : 'text-slate-700';
  };
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-[11.5px] font-semibold text-slate-500">
          {linhas.length} edita{linhas.length === 1 ? 'l' : 'is'} · clique no cabeçalho para ordenar
        </p>
        <button
          type="button"
          onClick={onExportar}
          disabled={linhas.length === 0}
          title="Baixar em CSV (abre no Excel)"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40"
        >
          <Download size={12} /> Exportar {linhas.length}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {COLUNAS_DA_TABELA.map((c) => {
                const ativa = c.chave === coluna;
                return (
                  <th key={c.chave} scope="col" className={`px-3 py-2 ${c.numerica && c.chave !== 'prazo' && c.chave !== 'etapa' ? 'text-right' : ''}`}>
                    <button
                      type="button"
                      onClick={() => onOrdenar(c.chave)}
                      aria-sort={ativa ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${ativa ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
                    >
                      {c.rotulo}
                      {ativa ? (direcao === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-50" />}
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="px-3 py-2 text-[11px] font-semibold text-slate-400">Próxima ação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.id}
                onClick={() => onAbrir(l.id)}
                title="Abrir o resumo e o plano deste edital"
                className="cursor-pointer border-b border-slate-50 align-top transition-colors hover:bg-slate-50"
              >
                <td className="max-w-[320px] px-3 py-2.5">
                  <span className="line-clamp-2 font-bold leading-snug text-slate-800">{l.titulo}</span>
                  {l.resultado && <span className="text-[11px] font-semibold text-slate-400">{l.resultado}</span>}
                </td>
                <td className="max-w-[200px] px-3 py-2.5 font-medium text-slate-600"><span className="line-clamp-2">{l.orgao || '—'}</span></td>
                <td className="px-3 py-2.5 font-bold text-slate-500">{l.uf || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-black text-slate-800">{l.valor != null ? brl(l.valor) : '—'}</td>
                <td className={`px-3 py-2.5 text-right font-black tabular-nums ${scoreClasse(l.score)}`}>{l.score ?? '—'}</td>
                <td className="px-3 py-2.5">{chipDaEtapa(l.etapa)}</td>
                <td className={`whitespace-nowrap px-3 py-2.5 font-bold ${prazoClasse(l)}`} title={l.prazoRotulo}>
                  {l.prazo ? dataCurta(l.prazo) : (l.prazoRotulo === 'Sem prazo identificado' ? '—' : l.prazoRotulo)}
                </td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-600">{l.total ? `${l.feitas}/${l.total}` : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-slate-500">{l.atualizadoEm ? dataCurta(l.atualizadoEm) : '—'}</td>
                <td className="max-w-[260px] px-3 py-2.5 font-medium text-slate-600">
                  <span className="line-clamp-2">{l.proximaAcao || '—'}</span>
                  {l.responsavel && <span className="text-[10px] font-bold text-slate-400">{l.responsavel}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Desempenho
// ─────────────────────────────────────────────────────────────────────────

export function AbaDesempenho({ desempenho, calibracao }: {
  desempenho: Desempenho;
  /** A taxa de acerto da Bawzi (veredito × resultado), que já existia. */
  calibracao?: React.ReactNode;
}) {
  const d = desempenho;
  const maiorDoFunil = Math.max(1, ...d.funil.map((f) => f.quantidade));
  const maiorDoMes = Math.max(1, ...d.porMes.map((m) => m.ganhos + m.perdidos));
  const tiles = [
    { rotulo: 'Em disputa', valor: brl(d.emDisputa.valor), sub: `${d.emDisputa.quantidade} em proposta ou enviado`, cor: 'text-slate-900' },
    { rotulo: 'Ganho', valor: brl(d.ganhos.valor), sub: `${d.ganhos.quantidade} edita${d.ganhos.quantidade === 1 ? 'l' : 'is'}`, cor: 'text-emerald-700' },
    { rotulo: 'Perdido', valor: brl(d.perdidos.valor), sub: `${d.perdidos.quantidade} edita${d.perdidos.quantidade === 1 ? 'l' : 'is'}`, cor: 'text-rose-700' },
    { rotulo: 'Taxa de vitória', valor: d.taxaVitoria === null ? '—' : `${d.taxaVitoria}%`, sub: d.taxaVitoria === null ? 'registre ganhos e perdas' : `${d.ganhos.quantidade} de ${d.ganhos.quantidade + d.perdidos.quantidade} disputas`, cor: 'text-slate-900' },
    { rotulo: 'Deságio do vencedor', valor: d.desagioMedioPct === null ? '—' : `${d.desagioMedioPct > 0 ? '+' : ''}${d.desagioMedioPct.toLocaleString('pt-BR')}%`, sub: d.desagioMedioPct === null ? 'preço final × estimado' : 'média, preço final sobre o estimado', cor: 'text-slate-900' },
  ];
  const total = d.funil.reduce((s, f) => s + f.quantidade, 0);
  return (
    <div className="space-y-4">
      {/* Os filtros da tela não valem aqui, de propósito: o recorte padrão
          esconde as etapas finais, e são elas que têm resultado. */}
      <p className="text-[11px] font-bold text-slate-400">
        Sobre os {total} edita{total === 1 ? 'l' : 'is'} em acompanhamento, sem os filtros da tela.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.rotulo} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10.5px] font-semibold tracking-[0.14em] text-slate-400">{t.rotulo}</p>
            <p className={`mt-1 truncate text-lg font-black leading-none ${t.cor}`}>{t.valor}</p>
            <p className="mt-1 text-[10px] font-bold text-slate-400">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <h3 className="mb-3 text-[12px] font-semibold tracking-[0.14em] text-slate-500">Funil por etapa</h3>
          <ul className="space-y-2">
            {d.funil.map((f) => (
              <li key={f.chave} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-2 text-[11px]">
                <span className="truncate font-semibold text-slate-600">{f.rotulo}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <span className={`block h-full rounded-full ${decisionQueueStages[f.chave].dotClass}`} style={{ width: `${Math.round((f.quantidade / maiorDoFunil) * 100)}%` }} />
                </span>
                <span className="whitespace-nowrap text-right font-bold tabular-nums text-slate-700">
                  {f.quantidade}
                  <span className="ml-1 font-medium text-slate-400">{f.valor > 0 ? brl(f.valor) : ''}{f.semValor ? ` · ${f.semValor} sem valor` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <h3 className="mb-3 text-[12px] font-semibold tracking-[0.14em] text-slate-500">Resultados por mês</h3>
          {d.ganhos.quantidade + d.perdidos.quantidade === 0 ? (
            <p className="text-[12px] font-medium text-slate-400">Registre o resultado das disputas (Ganhou / Perdeu) em cada edital para ver a linha do tempo.</p>
          ) : (
            <div className="grid grid-cols-12 items-end gap-1">
              {d.porMes.map((m) => {
                const total = m.ganhos + m.perdidos;
                return (
                  <div key={m.chave} className="flex flex-col items-center gap-1" title={`${m.rotulo}: ${m.ganhos} ganho(s), ${m.perdidos} perdido(s)${m.valorGanho ? ` · ${brl(m.valorGanho)} ganhos` : ''}`}>
                    <span className={`text-[9px] font-black leading-none text-slate-600 ${total ? '' : 'invisible'}`}>{total}</span>
                    <span className="flex w-full flex-col-reverse overflow-hidden rounded-sm bg-slate-100" style={{ height: '48px' }}>
                      <span className="block w-full bg-emerald-500" style={{ height: `${Math.round((m.ganhos / maiorDoMes) * 48)}px` }} />
                      <span className="block w-full bg-rose-400" style={{ height: `${Math.round((m.perdidos / maiorDoMes) * 48)}px` }} />
                    </span>
                    <span className="text-[9px] font-bold leading-none text-slate-400">{m.rotulo}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <h3 className="mb-3 text-[12px] font-semibold tracking-[0.14em] text-slate-500">Vitórias por órgão</h3>
          {d.porOrgao.length === 0 ? (
            <p className="text-[12px] font-medium text-slate-400">Sem disputa com resultado registrado.</p>
          ) : (
            <ul className="space-y-2">
              {d.porOrgao.slice(0, 8).map((o) => (
                <li key={o.orgao} className="flex items-center gap-3 text-[12px]">
                  <span className="min-w-0 flex-1 truncate font-bold text-slate-700" title={o.orgao}>{o.orgao}</span>
                  <span className="shrink-0 font-medium text-slate-500">{o.ganhos} de {o.disputas}</span>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black ${o.taxa >= 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{o.taxa}%</span>
                  <span className="shrink-0 font-black text-slate-800">{o.valorGanho ? brl(o.valorGanho) : '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <h3 className="mb-1 text-[12px] font-semibold tracking-[0.14em] text-slate-500">Preço final × estimado</h3>
          <p className="mb-3 text-[11px] font-medium text-slate-400">Quanto abaixo do valor estimado o vencedor fechou. É a régua de preço das próximas disputas.</p>
          {d.precos.length === 0 ? (
            <p className="text-[12px] font-medium text-slate-400">Registre o preço final ao marcar Ganhou ou Perdeu.</p>
          ) : (
            <ul className="space-y-2">
              {d.precos.slice(0, 8).map((p) => (
                <li key={p.analysisId} className="text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${p.resultado === 'won' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {p.resultado === 'won' ? 'ganho' : 'perdido'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold text-slate-700" title={p.titulo}>{p.titulo}</span>
                    <span className={`shrink-0 font-black tabular-nums ${p.desagioPct === null ? 'text-slate-400' : p.desagioPct < 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {p.desagioPct === null ? '—' : `${p.desagioPct > 0 ? '+' : ''}${p.desagioPct.toLocaleString('pt-BR')}%`}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-400">
                    estimado {p.estimado != null ? brl(p.estimado) : '—'} · final {p.precoFinal != null ? brl(p.precoFinal) : '—'}
                    {p.vencedor && <> · {p.vencedor}</>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {calibracao && (
        <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          <h3 className="flex items-center gap-2 px-5 pt-4 text-[12px] font-semibold tracking-[0.14em] text-slate-500">
            <Trophy size={13} className="text-emerald-600" /> A Bawzi acerta o veredito?
          </h3>
          {calibracao}
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Responsáveis
// ─────────────────────────────────────────────────────────────────────────

export function AbaResponsaveis({ cargas, onAbrir }: {
  cargas: CargaDoResponsavel[];
  onAbrir: (analysisId: string, taskId: string) => void;
}) {
  if (!cargas.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
        <UserRound size={24} className="mx-auto mb-3 text-slate-300" />
        <h3 className="text-lg font-black text-slate-800">Nenhuma ação em aberto</h3>
        <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-500">
          Os editais ativos não têm plano de execução com ações, ou todas já foram concluídas.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {cargas.map((c) => (
        <section key={c.responsavel} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[12px] font-semibold text-white">
              {c.responsavel.slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-slate-800">
                {c.responsavel}
                {c.padrao && <span className="ml-1.5 text-[10px] font-bold text-slate-400" title="Ninguém definiu um responsável; é o padrão do laudo">· sem dono definido</span>}
              </p>
              <p className="text-[10px] font-bold text-slate-400">
                {c.pendentes.length} pendente{c.pendentes.length === 1 ? '' : 's'} em {c.editais} edita{c.editais === 1 ? 'l' : 'is'} · {c.concluidas} concluída{c.concluidas === 1 ? '' : 's'}
              </p>
            </div>
            {c.vencidas > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                <AlertTriangle size={11} /> {c.vencidas} vencida{c.vencidas === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {c.pendentes.length === 0 && <li className="text-[12px] font-medium text-slate-400">Nada pendente.</li>}
            {c.pendentes.slice(0, 12).map((p) => (
              <li key={`${p.analysisId}-${p.taskId}`}>
                <button
                  type="button"
                  onClick={() => onAbrir(p.analysisId, p.taskId)}
                  title="Abrir este passo no plano do edital"
                  className={`flex w-full flex-col gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 ${p.vencida ? 'border-red-100 bg-red-50/40' : 'border-slate-100'}`}
                >
                  <span className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                    <span className={p.vencida ? 'text-red-700' : p.prazo ? 'text-slate-600' : 'text-slate-400'}>
                      {p.prazo ? dataCurta(p.prazo) : (p.prazoTexto || 'sem prazo')}
                    </span>
                    {p.prioridade === 'Alta' && <span className="rounded bg-amber-50 px-1 text-amber-700">alta</span>}
                    {chipDaEtapa(p.stage)}
                  </span>
                  <span className="text-[12px] font-bold leading-snug text-slate-800">{p.acao}</span>
                  <span className="truncate text-[11px] font-medium text-slate-500">{p.titulo}</span>
                </button>
              </li>
            ))}
            {c.pendentes.length > 12 && (
              <li className="text-[11px] font-bold text-slate-400">+ {c.pendentes.length - 12} pendente{c.pendentes.length - 12 === 1 ? '' : 's'}</li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
