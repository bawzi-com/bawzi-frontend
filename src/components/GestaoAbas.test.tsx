import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SavedAnalysis } from '@/lib/types';
import type { DecisionQueueKey, DecisionQueueTask } from '@/lib/decisionQueue';
import {
  acoesPorResponsavel, desempenhoDaGestao, itensDaAgenda, linhasDaTabela, ordenarLinhas, type CartaoDaGestao, type TipoDoPrazo,
} from '@/lib/gestao';
import { AbaAgenda, AbaDesempenho, AbaResponsaveis, AbaTabela, BarraDeAbas } from './GestaoAbas';

/* As abas da Gestão (25/09/2026), renderizadas no servidor e clicadas sem
 * navegador: nenhuma usa hook, então dá para chamá-las como função. */

const HOJE = new Date(2026, 8, 25, 10, 0);

/* Um componente sem hook dentro da árvore (como `ItemDoPainel`) é chamado
 * como função, para o botão dele também entrar na busca. */
function todos(no: ReactNode, quer: (e: ReactElement) => boolean): ReactElement[] {
  if (Array.isArray(no)) return no.flatMap((n) => todos(n, quer));
  if (!isValidElement(no)) return [];
  if (typeof no.type === 'function') {
    return todos((no.type as (p: unknown) => ReactNode)(no.props), quer);
  }
  const filhos = todos((no.props as { children?: ReactNode }).children, quer);
  return quer(no) ? [no, ...filhos] : filhos;
}

function tarefa(id: string, acao: string, extra: Partial<DecisionQueueTask> = {}): DecisionQueueTask {
  return { id, acao, prazo: 'Hoje', responsavel: 'Licitações', resultado_esperado: '', origem: 'Decisão', prioridade: 'Normal', ...extra };
}

function cartao(o: {
  id: string; titulo?: string; stage: DecisionQueueKey; orgao?: string; valor?: unknown; score?: number;
  datas?: Array<{ label: string; data_iso: string | null }>; tasks?: DecisionQueueTask[];
  status?: CartaoDaGestao['statusMap']; learning?: Record<string, unknown>;
}): CartaoDaGestao {
  const tasks = o.tasks || [];
  const statusMap = o.status || {};
  const done = tasks.filter((t) => statusMap[t.id]?.done).length;
  const analysis = {
    id: o.id, title: o.titulo || `Edital ${o.id}`, orgao_nome: o.orgao, estimated_value: o.valor, score: o.score,
    datas_criticas: o.datas, decision_learning: o.learning, decisao: { veredito: 'GO' },
  } as unknown as SavedAnalysis;
  return { analysis, tasks, statusMap, done, total: tasks.length, nextTask: tasks.find((t) => !statusMap[t.id]?.done) || null, stage: o.stage };
}

const cartoes = [
  cartao({ id: 'a', titulo: 'Hortifruti', stage: 'not_started', orgao: 'Prefeitura X', valor: 'R$ 120.000,00', score: 55,
    datas: [{ label: 'Abertura das propostas', data_iso: '2026-09-25T08:00:00' }, { label: 'Limite para esclarecimento', data_iso: '2026-09-22' }],
    tasks: [tarefa('t1', 'Conferir habilitação', { prazo: '20/09/2026' }), tarefa('t2', 'Montar proposta', { prioridade: 'Alta' })],
    status: { t1: { responsavel: 'Ana' } } }),
  cartao({ id: 'b', titulo: 'Medicamentos', stage: 'triage', orgao: 'Secretaria Y', valor: 2_000_000, score: 88,
    datas: [{ label: 'Sessão pública', data_iso: '2026-10-20' }] }),
  cartao({ id: 'c', titulo: 'Software', stage: 'won', orgao: 'Ministério Z', valor: 900_000, score: 80,
    learning: { resultado: 'won', preco_final: 'R$ 810.000,00', updated_at: '2026-09-01T00:00:00Z' } }),
  cartao({ id: 'd', titulo: 'Limpeza', stage: 'lost', orgao: 'Ministério Z', valor: 300_000, score: 70,
    learning: { resultado: 'lost', preco_final: 'R$ 240.000,00', vencedor: 'ACME', updated_at: '2026-08-10T00:00:00Z' } }),
];

describe('BarraDeAbas', () => {
  it('cinco abas, a ativa marcada, contagens ao lado; clicar troca', () => {
    const onTrocar = vi.fn();
    const html = renderToStaticMarkup(createElement(BarraDeAbas, { ativa: 'quadro', contagens: { quadro: 4, agenda: 3, desempenho: 0 }, onTrocar }));
    for (const r of ['Quadro', 'Agenda', 'Tabela', 'Desempenho', 'Responsáveis']) expect(html).toContain(r);
    // Controle segmentado: a ativa em relevo escuro, com ícone antes do rótulo.
    expect(html).toMatch(/aria-selected="true"[^>]*bg-slate-900[^>]*><svg[^]*?<\/svg>Quadro<span[^>]*>4</);
    expect(html).toMatch(/Agenda<span[^>]*>3</);
    expect(html).not.toMatch(/Desempenho<span/);                       // zero não vira "0"
    expect(html).toContain('>Os editais por etapa</span>');           // a descrição da visão ativa (não só o title)
    expect((html.match(/aria-selected="true"/g) || []).length).toBe(1);
    expect(html).toContain('>Visão<');
    expect(html).not.toContain('uppercase tracking-wide transition');   // o rótulo em frase, não em caixa alta
    const botoes = todos(BarraDeAbas({ ativa: 'quadro', contagens: {}, onTrocar }), (e) => e.type === 'button');
    (botoes[2].props as { onClick: () => void }).onClick();
    expect(onTrocar).toHaveBeenCalledWith('tabela');
  });
});

describe('AbaAgenda — o calendário do mês e o painel', () => {
  const itens = itensDaAgenda(cartoes, HOJE);
  const base = { itens, mes: new Date(2026, 8, 1), hoje: HOJE, selecao: 'proximos' as const, soDecisivos: true,
    onMes: () => {}, onSelecionar: () => {}, onSoDecisivos: () => {}, onAbrir: () => {} };

  it('o mês, os dias com os prazos nas células, os atalhos e o painel dos próximos 7 dias', () => {
    const html = renderToStaticMarkup(createElement(AbaAgenda, base));
    expect(html).toContain('Setembro de 2026');
    expect(html).toContain('2 prazos neste mês');
    expect(html).toMatch(/title="Abertura das propostas · Hortifruti"/);
    expect(html).toMatch(/title="Limite para esclarecimento · Hortifruti"[^>]*class="[^"]*bg-red-50/);
    expect(html).toMatch(/Vencidos<span[^>]*>1</);
    expect(html).toMatch(/Próximos 7 dias<span[^>]*>1</);
    expect(html).toContain('1 vence hoje.');
    expect(html).toContain('às 08:00');
    expect(html).toContain('Próxima ação:</span> Conferir habilitação');
    expect(html).toContain('Mostrar datas informativas');
    expect(html).toMatch(/role="switch" aria-checked="false"/);
    expect(html).not.toContain('Sessão pública');   // é em outubro: fora do painel dos 7 dias
    expect(html).not.toContain('Software');          // encerrado
  });

  it('o painel muda com a seleção: vencidos, ou um dia clicado', () => {
    const vencidos = renderToStaticMarkup(createElement(AbaAgenda, { ...base, selecao: 'vencidos' }));
    expect(vencidos).toContain('Prazos vencidos');
    expect(vencidos).toContain('venceu há 3 dias');
    const dia = renderToStaticMarkup(createElement(AbaAgenda, { ...base, mes: new Date(2026, 9, 1), selecao: '2026-10-20' }));
    expect(dia).toContain('Outubro de 2026');
    expect(dia).toContain('Sessão pública');
    expect(dia).toMatch(/aria-pressed="true"[^>]*title="1 prazo"/);
    const vazio = renderToStaticMarkup(createElement(AbaAgenda, { ...base, selecao: '2026-09-30' }));
    expect(vazio).toContain('Nenhum prazo neste dia');
  });

  it('clicar num dia seleciona e clicar de novo volta aos próximos; as setas mudam o mês; o item abre o edital', () => {
    const onSelecionar = vi.fn();
    const onMes = vi.fn();
    const onAbrir = vi.fn();
    const arvore = AbaAgenda({ ...base, onSelecionar, onMes, onAbrir });
    const dias = todos(arvore, (e) => e.type === 'button' && typeof (e.props as { 'aria-pressed'?: unknown })['aria-pressed'] === 'boolean' && /^\d/.test(String((e.props as { title?: string }).title || '')));
    const comPrazo = dias.filter((d) => (d.props as { title?: string }).title === '1 prazo');
    expect(comPrazo).toHaveLength(2);   // 22 (vencido) e 25 (hoje)
    // Dia sem prazo não clica: o clique só levaria a um painel vazio.
    const todosOsDias = todos(arvore, (e) => e.type === 'button' && /min-h-\[82px\]/.test(String((e.props as { className?: string }).className)));
    expect(todosOsDias.filter((d) => (d.props as { disabled?: boolean }).disabled)).toHaveLength(35 - 2);
    (comPrazo[0].props as { onClick: () => void }).onClick();
    expect(onSelecionar).toHaveBeenCalledWith('2026-09-22');
    (comPrazo[1].props as { onClick: () => void }).onClick();
    expect(onSelecionar).toHaveBeenLastCalledWith('2026-09-25');
    const selecionado = AbaAgenda({ ...base, selecao: '2026-09-25', onSelecionar });
    const ativo = todos(selecionado, (e) => e.type === 'button' && (e.props as { 'aria-pressed'?: boolean })['aria-pressed'] === true && (e.props as { title?: string }).title === '1 prazo')[0];
    (ativo.props as { onClick: () => void }).onClick();
    expect(onSelecionar).toHaveBeenLastCalledWith('proximos');
    const setas = todos(arvore, (e) => e.type === 'button' && String((e.props as { 'aria-label'?: string })['aria-label'] || '').startsWith('Mês'));
    (setas[1].props as { onClick: () => void }).onClick();
    expect(onMes).toHaveBeenCalledWith(new Date(2026, 9, 1));
    const item = todos(arvore, (e) => e.type === 'button' && (e.props as { title?: string }).title === 'Abrir o resumo e o plano deste edital')[0];
    (item.props as { onClick: () => void }).onClick();
    expect(onAbrir).toHaveBeenCalledWith('a');
  });

  it('o título em caixa alta vira frase no painel, e o interruptor das datas informativas chama quem muda', () => {
    const gritando = [cartao({ id: 'g', titulo: 'REGISTRO DE PREÇOS PARA EVENTUAL AQUISIÇÃO DE HORTIFRUTIGRANJEIROS', stage: 'triage',
      datas: [{ label: 'Abertura das propostas', data_iso: '2026-09-26' }] })];
    const html = renderToStaticMarkup(createElement(AbaAgenda, { ...base, itens: itensDaAgenda(gritando, HOJE) }));
    expect(html).toContain('Registro de preços para eventual aquisição de hortifrutigranjeiros');
    expect(html).not.toContain('REGISTRO DE PREÇOS PARA EVENTUAL AQUISIÇÃO DE HORTIFRUTIGRANJEIROS<');
    const onSoDecisivos = vi.fn();
    const interruptor = todos(AbaAgenda({ ...base, onSoDecisivos }), (e) => e.type === 'button' && (e.props as { role?: string }).role === 'switch')[0];
    (interruptor.props as { onClick: () => void }).onClick();
    expect(onSoDecisivos).toHaveBeenCalledWith(false);
  });

  it('a legenda filtra: um tipo mostra só ele, dois somam, "vencido" recorta, e o chip sem item não clica', () => {
    const onFiltro = vi.fn();
    const chips = todos(AbaAgenda({ ...base, onFiltro }), (e) => e.type === 'button' && /rounded-full border/.test(String((e.props as { className?: string }).className)));
    // Propostas, Sessão, Impugnação (nenhuma), Esclarecimento, Vencido.
    expect(chips.map((c) => (c.props as { disabled?: boolean }).disabled)).toEqual([false, false, true, false, false]);
    (chips[0].props as { onClick: () => void }).onClick();
    expect(onFiltro).toHaveBeenCalledWith({ tipos: new Set(['propostas']), soVencidos: false });
    (chips[4].props as { onClick: () => void }).onClick();
    expect(onFiltro).toHaveBeenLastCalledWith({ tipos: new Set(), soVencidos: true });

    const soSessao = renderToStaticMarkup(createElement(AbaAgenda, { ...base, filtro: { tipos: new Set<TipoDoPrazo>(['sessao']), soVencidos: false } }));
    expect(soSessao).not.toMatch(/title="Abertura das propostas · Hortifruti"/);
    expect(soSessao).toContain('Semana livre de prazos');          // a sessão é em outubro
    expect(soSessao).toContain('limpar filtro');
    expect(soSessao).toMatch(/aria-pressed="true"[^>]*>[^<]*<span[^>]*><\/span>Sessão/);
    expect(soSessao).toMatch(/Propostas<span[^>]*>1</);               // a contagem não zera com o filtro

    const soVencidos = renderToStaticMarkup(createElement(AbaAgenda, { ...base, filtro: { tipos: new Set<TipoDoPrazo>(), soVencidos: true } }));
    expect(soVencidos).toMatch(/title="Limite para esclarecimento · Hortifruti"/);
    expect(soVencidos).not.toMatch(/title="Abertura das propostas · Hortifruti"/);
    expect(soVencidos).toContain('1 prazo neste mês');
    expect(soVencidos).toContain('limpar filtro');
  });

  it('sem prazo nenhum, o calendário fica vazio e o painel explica', () => {
    const html = renderToStaticMarkup(createElement(AbaAgenda, { ...base, itens: [] }));
    expect(html).toContain('Nenhum prazo neste mês');
    expect(html).toContain('Semana livre de prazos');
  });
});

describe('AbaTabela', () => {
  const linhas = ordenarLinhas(linhasDaTabela(cartoes, HOJE), 'prazo', 'asc');
  const base = { linhas, coluna: 'prazo' as const, direcao: 'asc' as const, onOrdenar: () => {}, onAbrir: () => {}, onExportar: () => {} };

  it('uma linha por edital com valor, score, etapa, prazo, ações e próxima ação', () => {
    const html = renderToStaticMarkup(createElement(AbaTabela, base));
    expect(html).toContain('4 editais');
    expect(html).toMatch(/R\$\s120\.000/);
    expect(html).toContain('Em triagem');
    expect(html).toContain('0/2');
    expect(html).toContain('Conferir habilitação');
    expect(html).toContain('Ana');
    expect(html).toContain('Ganho');
    expect(html).toMatch(/aria-sort="ascending"[^>]*>Prazo/);
    expect(html).toContain('Exportar 4');
  });

  it('clicar no cabeçalho ordena, na linha abre, no botão exporta', () => {
    const onOrdenar = vi.fn();
    const onAbrir = vi.fn();
    const onExportar = vi.fn();
    const arvore = AbaTabela({ ...base, onOrdenar, onAbrir, onExportar });
    const cabecalhos = todos(arvore, (e) => e.type === 'button' && !!(e.props as { 'aria-sort'?: string })['aria-sort']);
    expect(cabecalhos).toHaveLength(9);
    (cabecalhos[3].props as { onClick: () => void }).onClick();
    expect(onOrdenar).toHaveBeenCalledWith('valor');
    const linhasTr = todos(arvore, (e) => e.type === 'tr' && !!(e.props as { onClick?: unknown }).onClick);
    expect(linhasTr).toHaveLength(4);
    (linhasTr[1].props as { onClick: () => void }).onClick();
    expect(onAbrir).toHaveBeenCalledWith('b');
    const exportar = todos(arvore, (e) => e.type === 'button' && (e.props as { title?: string }).title?.startsWith('Baixar') === true);
    (exportar[0].props as { onClick: () => void }).onClick();
    expect(onExportar).toHaveBeenCalledTimes(1);
  });
});

describe('AbaDesempenho', () => {
  it('os números, o funil, os meses, os órgãos e os preços', () => {
    const d = desempenhoDaGestao(cartoes, HOJE);
    const html = renderToStaticMarkup(createElement(AbaDesempenho, { desempenho: d, calibracao: createElement('p', null, 'CALIBRAÇÃO') }));
    expect(html).toContain('Sobre os 4 editais em acompanhamento');
    expect(html).toContain('Taxa de vitória');
    expect(html).toContain('50%');
    expect(html).toMatch(/R\$\s900\.000/);
    expect(html).toContain('-15%');                   // deságio médio: (-10 + -20) / 2
    expect(html).toContain('Ministério Z');
    expect(html).toContain('1 de 2');
    expect(html).toContain('set/26');
    expect(html).toContain('ACME');
    expect(html).toContain('CALIBRAÇÃO');
    expect(html).toContain('A Bawzi acerta o veredito?');
  });

  it('sem resultado registrado, explica o que falta', () => {
    const html = renderToStaticMarkup(createElement(AbaDesempenho, { desempenho: desempenhoDaGestao(cartoes.slice(0, 2), HOJE) }));
    expect(html).toContain('registre ganhos e perdas');
    expect(html).toMatch(/Taxa de vitória<\/p><p[^>]*>—</);
    expect(html).toContain('Registre o resultado das disputas');
    expect(html).toContain('Sem disputa com resultado registrado');
    expect(html).not.toContain('A Bawzi acerta o veredito?');
  });
});

describe('AbaResponsaveis', () => {
  it('um bloco por responsável, com vencidas, pendentes e o clique no passo', () => {
    const cargas = acoesPorResponsavel(cartoes, HOJE);
    const onAbrir = vi.fn();
    const html = renderToStaticMarkup(createElement(AbaResponsaveis, { cargas, onAbrir }));
    expect(html).toContain('Ana');
    expect(html).toContain('1 vencida');
    expect(html).toContain('sem dono definido');
    expect(html).toContain('Conferir habilitação');
    expect(html).toContain('alta');
    // Um pendente cada: a ordem é alfabética, Ana antes do padrão do laudo.
    expect(cargas.map((c) => c.responsavel)).toEqual(['Ana', 'Licitações']);
    const botoes = todos(AbaResponsaveis({ cargas, onAbrir }), (e) => e.type === 'button');
    (botoes[0].props as { onClick: () => void }).onClick();
    expect(onAbrir).toHaveBeenCalledWith('a', 't1');
    (botoes[1].props as { onClick: () => void }).onClick();
    expect(onAbrir).toHaveBeenLastCalledWith('a', 't2');
  });

  it('sem ação em aberto, diz isso', () => {
    expect(renderToStaticMarkup(createElement(AbaResponsaveis, { cargas: [], onAbrir: () => {} }))).toContain('Nenhuma ação em aberto');
  });
});
