import { describe, expect, it } from 'vitest';
import type { SavedAnalysis } from '@/lib/types';
import type { DecisionQueueKey, DecisionQueueTask } from '@/lib/decisionQueue';
import {
  acaoDaSugestao, acoesPorResponsavel, agendaDePrazos, alternarTipoDaAgenda, csvDaTabela, datasDoEdital, desempenhoDaGestao, diasAte,
  FILTRO_DA_AGENDA_VAZIO, filtrarItensDaAgenda, filtroDaAgendaAtivo, fraseDosDias, gradeDoMes, itensDaAgenda,
  itensDaSelecao, lerValorBrl, linhasDaTabela, linkDoPncp, mesSeguinte, ordenarLinhas, prazoCritico, prazosDaAnalise,
  rotuloDoMesLongo, situacaoDoEdital, tipoDoPrazo, tituloAmigavel, type CartaoDaGestao,
} from './gestao';

/* Gestão de execução (25/09/2026): as abas novas, calculadas sem navegador.
 * O relógio é fixo (25/09/2026) para os grupos da agenda não dependerem do
 * dia em que o teste roda. */

const HOJE = new Date(2026, 8, 25, 10, 0);

function tarefa(id: string, acao: string, extra: Partial<DecisionQueueTask> = {}): DecisionQueueTask {
  return { id, acao, prazo: 'Hoje', responsavel: 'Licitações', resultado_esperado: '', origem: 'Decisão', prioridade: 'Normal', ...extra };
}

function cartao(o: {
  id: string; titulo?: string; stage: DecisionQueueKey; orgao?: string; valor?: unknown; score?: number;
  datas?: Array<{ label: string; data_iso: string | null }>; tasks?: DecisionQueueTask[];
  status?: CartaoDaGestao['statusMap']; learning?: Record<string, unknown>; uf?: string; workflow_updated_at?: string;
  veredito?: 'GO' | 'GO_CONDICIONADO' | 'NO_GO';
}): CartaoDaGestao {
  const tasks = o.tasks || [];
  const statusMap = o.status || {};
  const done = tasks.filter((t) => statusMap[t.id]?.done).length;
  const analysis = {
    id: o.id, title: o.titulo || `Edital ${o.id}`, orgao_nome: o.orgao, estimated_value: o.valor, score: o.score,
    uf: o.uf, datas_criticas: o.datas, decision_learning: o.learning, workflow_updated_at: o.workflow_updated_at,
    decisao: { veredito: o.veredito || (o.stage === 'pending' ? 'NO_GO' : 'GO') },
  } as unknown as SavedAnalysis;
  return { analysis, tasks, statusMap, done, total: tasks.length, nextTask: tasks.find((t) => !statusMap[t.id]?.done) || null, stage: o.stage };
}

describe('leitura de valor e prazo', () => {
  it('lê valor em real, número puro e texto americano; não chuta', () => {
    expect(lerValorBrl('R$ 1.234.567,89')).toBe(1234567.89);
    expect(lerValorBrl('1234567.89')).toBe(1234567.89);
    expect(lerValorBrl('1.234.567')).toBe(1234567);
    expect(lerValorBrl('R$ 187.000,00')).toBe(187000);
    expect(lerValorBrl(250000)).toBe(250000);
    expect(lerValorBrl('Não informado')).toBeNull();
    expect(lerValorBrl('sigiloso')).toBeNull();
    expect(lerValorBrl('')).toBeNull();
    expect(lerValorBrl(0)).toBeNull();
    expect(lerValorBrl('R$ 0,00')).toBeNull();
  });

  it('o prazo crítico é o próximo decisivo; sem futuro, o decisivo mais recente', () => {
    const a = cartao({ id: 'a', stage: 'triage', datas: [
      { label: 'Publicação do edital', data_iso: '2026-09-01' },
      { label: 'Limite para impugnação', data_iso: '2026-09-20' },
      { label: 'Abertura das propostas', data_iso: '2026-10-02T09:00:00' },
      { label: 'Visita técnica', data_iso: '2026-09-28' },
    ] }).analysis;
    const p = prazoCritico(a, null, HOJE);
    expect(p.rotulo).toMatch(/^Abertura das propostas: 02 de out/);
    expect(prazosDaAnalise(a).filter((x) => x.decisivo).map((x) => x.rotulo)).toEqual(['Limite para impugnação', 'Abertura das propostas']);
    const vencido = cartao({ id: 'b', stage: 'triage', datas: [{ label: 'Abertura das propostas', data_iso: '2026-09-10' }] }).analysis;
    expect(prazoCritico(vencido, null, HOJE).data?.getDate()).toBe(10);
    expect(prazoCritico(cartao({ id: 'c', stage: 'triage' }).analysis, tarefa('t', 'x', { prazo: 'Antes da proposta' }), HOJE))
      .toEqual({ rotulo: 'Antes da proposta', data: null });
    expect(diasAte(new Date(2026, 8, 26, 23, 59), HOJE)).toBe(1);
  });
});

describe('agendaDePrazos', () => {
  const cartoes = [
    cartao({ id: 'a', titulo: 'Hortifruti', stage: 'not_started', datas: [
      { label: 'Abertura das propostas', data_iso: '2026-09-25T08:00:00' },
      { label: 'Publicação', data_iso: '2026-09-01' },              // informativa no passado: fora
      { label: 'Limite para esclarecimento', data_iso: '2026-09-22' }, // decisivo vencido: entra
    ], tasks: [tarefa('t1', 'Conferir habilitação')] }),
    cartao({ id: 'b', titulo: 'Medicamentos', stage: 'triage', datas: [
      { label: 'Sessão pública', data_iso: '2026-09-26T09:00:00' },
      { label: 'Visita técnica', data_iso: '2026-09-30' },          // informativa no futuro: entra
      { label: 'Fim do recebimento', data_iso: '2026-10-20' },
    ] }),
    cartao({ id: 'c', stage: 'won', datas: [{ label: 'Abertura das propostas', data_iso: '2026-09-25' }] }), // encerrado: fora
    cartao({ id: 'd', stage: 'pending', datas: [{ label: 'Abertura das propostas', data_iso: '2026-06-01' }] }), // vencido há mais de 60 dias: fora
    cartao({ id: 'e', stage: 'pending', datas: [{ label: 'Abertura das propostas', data_iso: null }] }),
  ];

  it('agrupa por vencidos/hoje/amanhã/semana/depois, e dentro do grupo por dia', () => {
    const blocos = agendaDePrazos(cartoes, HOJE);
    expect(blocos.map((b) => [b.grupo, b.total])).toEqual([['vencidos', 1], ['hoje', 1], ['amanha', 1], ['semana', 1], ['depois', 1]]);
    const hoje = blocos.find((b) => b.grupo === 'hoje')!;
    expect(hoje.dias[0].chave).toBe('2026-09-25');
    expect(hoje.dias[0].itens[0]).toMatchObject({ titulo: 'Hortifruti', rotulo: 'Abertura das propostas', dias: 0, proximaAcao: 'Conferir habilitação', decisivo: true });
    expect(blocos.find((b) => b.grupo === 'vencidos')!.dias[0].itens[0]).toMatchObject({ rotulo: 'Limite para esclarecimento', dias: -3 });
    expect(blocos.find((b) => b.grupo === 'semana')!.dias[0].itens[0]).toMatchObject({ rotulo: 'Visita técnica', decisivo: false });
  });

  it('sem prazo nenhum, agenda vazia', () => {
    expect(agendaDePrazos([cartao({ id: 'x', stage: 'triage' })], HOJE)).toEqual([]);
  });

  it('"só decisivos" tira as datas informativas; a seleção recorta vencidos, próximos ou um dia', () => {
    const todos = itensDaAgenda(cartoes, HOJE);
    expect(todos.map((i) => i.rotulo)).toEqual(['Limite para esclarecimento', 'Abertura das propostas', 'Sessão pública', 'Visita técnica', 'Fim do recebimento']);
    expect(itensDaAgenda(cartoes, HOJE, true).map((i) => i.rotulo)).not.toContain('Visita técnica');
    expect(itensDaSelecao(todos, 'vencidos').map((i) => i.rotulo)).toEqual(['Limite para esclarecimento']);
    expect(itensDaSelecao(todos, 'proximos').map((i) => i.rotulo)).toEqual(['Abertura das propostas', 'Sessão pública', 'Visita técnica']);
    expect(itensDaSelecao(todos, '2026-10-20').map((i) => i.rotulo)).toEqual(['Fim do recebimento']);
  });

  it('a grade do mês vai de domingo a sábado, com os dias vizinhos marcados, e põe cada item no seu dia', () => {
    const itens = itensDaAgenda(cartoes, HOJE);
    const semanas = gradeDoMes(new Date(2026, 8, 1), itens, HOJE);
    expect(semanas).toHaveLength(5);
    expect(semanas[0].map((d) => d.dia)).toEqual([30, 31, 1, 2, 3, 4, 5]);
    expect(semanas[0][0]).toMatchObject({ chave: '2026-08-30', foraDoMes: true });
    expect(semanas[4].map((d) => d.dia)).toEqual([27, 28, 29, 30, 1, 2, 3]);
    const dias = semanas.flat();
    expect(dias.find((d) => d.chave === '2026-09-25')).toMatchObject({ hoje: true, passado: false });
    expect(dias.find((d) => d.chave === '2026-09-25')!.itens.map((i) => i.rotulo)).toEqual(['Abertura das propostas']);
    expect(dias.find((d) => d.chave === '2026-09-22')).toMatchObject({ passado: true });
    expect(dias.find((d) => d.chave === '2026-09-22')!.itens).toHaveLength(1);
    expect(dias.filter((d) => d.itens.length).map((d) => d.chave)).toEqual(['2026-09-22', '2026-09-25', '2026-09-26', '2026-09-30']);
    // Fevereiro de 2026 começa no domingo e tem 28 dias: quatro semanas exatas.
    expect(gradeDoMes(new Date(2026, 1, 1), [], HOJE)).toHaveLength(4);
    expect(mesSeguinte(new Date(2026, 11, 1))).toEqual(new Date(2027, 0, 1));
    expect(rotuloDoMesLongo(new Date(2026, 2, 1))).toBe('Março de 2026');
  });

  it('o título em caixa alta vira frase, com as siglas preservadas', () => {
    expect(tituloAmigavel('REGISTRO DE PREÇOS PARA EVENTUAL AQUISIÇÃO DE HORTIFRUTIGRANJEIROS'))
      .toBe('Registro de preços para eventual aquisição de hortifrutigranjeiros');
    expect(tituloAmigavel('CONTRATAÇÃO DE EMPRESA DE TI PARA O SUS E O CRBIO-01')).toBe('Contratação de empresa de TI para o SUS e o CRBIO-01');
    expect(tituloAmigavel('Contratação de empresa especializada para o site do CRBio-01')).toBe('Contratação de empresa especializada para o site do CRBio-01');
    expect(tituloAmigavel('  AQUISIÇÃO   DE  MEDICAMENTOS ')).toBe('Aquisição de medicamentos');
    expect(tituloAmigavel('')).toBe('');
  });

  it('o filtro da legenda: tipos somam, "vencido" recorta, e nada marcado é tudo', () => {
    const todos = itensDaAgenda(cartoes, HOJE);
    expect(filtrarItensDaAgenda(todos, FILTRO_DA_AGENDA_VAZIO)).toHaveLength(5);
    const soPropostas = alternarTipoDaAgenda(FILTRO_DA_AGENDA_VAZIO, 'propostas');
    expect(filtrarItensDaAgenda(todos, soPropostas).map((i) => i.rotulo)).toEqual(['Abertura das propostas', 'Fim do recebimento']);
    const propostasESessao = alternarTipoDaAgenda(soPropostas, 'sessao');
    expect(filtrarItensDaAgenda(todos, propostasESessao).map((i) => i.rotulo)).toEqual(['Abertura das propostas', 'Sessão pública', 'Fim do recebimento']);
    expect(alternarTipoDaAgenda(propostasESessao, 'sessao').tipos).toEqual(new Set(['propostas']));
    expect(filtrarItensDaAgenda(todos, { tipos: new Set(), soVencidos: true }).map((i) => i.rotulo)).toEqual(['Limite para esclarecimento']);
    expect(filtrarItensDaAgenda(todos, { tipos: new Set(['propostas']), soVencidos: true })).toEqual([]);
    expect(filtroDaAgendaAtivo(FILTRO_DA_AGENDA_VAZIO)).toBe(false);
    expect(filtroDaAgendaAtivo(soPropostas)).toBe(true);
    expect(FILTRO_DA_AGENDA_VAZIO.tipos.size).toBe(0);
  });

  it('o tipo do prazo dá o nome curto da célula', () => {
    expect(tipoDoPrazo('Limite para impugnação')).toEqual({ curto: 'Impugnação', tipo: 'impugnacao' });
    expect(tipoDoPrazo('Pedidos de esclarecimento até')).toEqual({ curto: 'Esclarecimento', tipo: 'esclarecimento' });
    expect(tipoDoPrazo('Sessão pública de lances')).toEqual({ curto: 'Sessão', tipo: 'sessao' });
    expect(tipoDoPrazo('Fim do recebimento de propostas')).toEqual({ curto: 'Propostas', tipo: 'propostas' });
    expect(tipoDoPrazo('Visita técnica')).toEqual({ curto: 'Visita técnica', tipo: 'outro' });
    expect(tipoDoPrazo('Publicação do aviso no Diário Oficial').curto).toBe('Publicação do avi…');
  });
});

describe('tabela', () => {
  const cartoes = [
    cartao({ id: 'a', titulo: 'Beta', stage: 'triage', orgao: 'Prefeitura B', uf: 'go', valor: 'R$ 500.000,00', score: 55,
      datas: [{ label: 'Abertura das propostas', data_iso: '2026-10-02' }],
      tasks: [tarefa('t1', 'Conferir', { responsavel: 'Ana' }), tarefa('t2', 'Montar')], status: { t1: { done: true, responsavel: 'Ana' } } }),
    cartao({ id: 'b', titulo: 'Alfa', stage: 'won', orgao: 'Ministério A', valor: 2_000_000, score: 88,
      learning: { resultado: 'won', preco_final: 'R$ 1.800.000,00', vencedor: 'Nós' } }),
    cartao({ id: 'c', titulo: 'Gama', stage: 'pending', score: undefined, valor: 'Não informado' }),
  ];

  it('uma linha por edital, com o que a tabela mostra', () => {
    const linhas = linhasDaTabela(cartoes, HOJE);
    expect(linhas[0]).toMatchObject({ titulo: 'Beta', orgao: 'Prefeitura B', uf: 'GO', valor: 500000, score: 55, etapaRotulo: 'Em triagem',
      proximaAcao: 'Montar', responsavel: 'Licitações', feitas: 1, total: 2, resultado: '' });
    expect(linhas[0].prazoRotulo).toMatch(/^Abertura das propostas/);
    expect(linhas[1]).toMatchObject({ titulo: 'Alfa', valor: 2000000, resultado: 'Ganho', veredito: 'GO' });
    expect(linhas[2]).toMatchObject({ titulo: 'Gama', valor: null, score: null, veredito: 'NO_GO', orgao: '' });
  });

  it('ordena por qualquer coluna, com os sem valor no fim nas duas direções', () => {
    const linhas = linhasDaTabela(cartoes, HOJE);
    expect(ordenarLinhas(linhas, 'titulo', 'asc').map((l) => l.titulo)).toEqual(['Alfa', 'Beta', 'Gama']);
    expect(ordenarLinhas(linhas, 'valor', 'desc').map((l) => l.titulo)).toEqual(['Alfa', 'Beta', 'Gama']);
    expect(ordenarLinhas(linhas, 'valor', 'asc').map((l) => l.titulo)).toEqual(['Beta', 'Alfa', 'Gama']);
    expect(ordenarLinhas(linhas, 'score', 'asc').map((l) => l.score)).toEqual([55, 88, null]);
    expect(ordenarLinhas(linhas, 'etapa', 'asc').map((l) => l.etapa)).toEqual(['triage', 'pending', 'won']);
    expect(ordenarLinhas(linhas, 'prazo', 'asc').map((l) => l.titulo)).toEqual(['Beta', 'Alfa', 'Gama']);
    // Não mexe na entrada.
    expect(linhas.map((l) => l.titulo)).toEqual(['Beta', 'Alfa', 'Gama']);
  });

  it('CSV com ponto e vírgula, vírgula decimal e BOM', () => {
    const csv = csvDaTabela(linhasDaTabela(cartoes, HOJE));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [cab, l1] = csv.slice(1).split('\r\n');
    expect(cab.startsWith('Edital;Órgão;UF;Valor estimado (R$);Score;Veredito;Etapa;Prazo')).toBe(true);
    expect(l1).toContain('Beta;Prefeitura B;GO;500000,00;55;GO;Em triagem;02/10/2026;Montar;Licitações;1;2');
  });
});

describe('desempenhoDaGestao', () => {
  const cartoes = [
    cartao({ id: 'a', stage: 'proposal', valor: 100_000 }),
    cartao({ id: 'b', stage: 'submitted', valor: 'R$ 50.000,00' }),
    cartao({ id: 'c', stage: 'submitted' }),                                   // sem valor
    cartao({ id: 'd', stage: 'won', orgao: 'MJ', valor: 1_000_000, learning: { resultado: 'won', preco_final: 'R$ 900.000,00', updated_at: '2026-09-10T00:00:00Z' } }),
    cartao({ id: 'e', stage: 'won', orgao: 'MJ', valor: 500_000, learning: { resultado: 'won', updated_at: '2026-08-05T00:00:00Z' } }),
    cartao({ id: 'f', stage: 'lost', orgao: 'MJ', valor: 400_000, learning: { resultado: 'lost', preco_final: 'R$ 300.000,00', vencedor: 'ACME', updated_at: '2026-09-12T00:00:00Z' } }),
    cartao({ id: 'g', stage: 'lost', orgao: 'TJ', valor: 200_000, learning: { resultado: 'lost', updated_at: '2020-01-01T00:00:00Z' } }), // fora dos 12 meses
    cartao({ id: 'h', stage: 'abandoned', valor: 10_000 }),
  ];
  const d = desempenhoDaGestao(cartoes, HOJE);

  it('funil, valores em disputa e ganhos, taxa de vitória', () => {
    expect(d.funil.find((f) => f.chave === 'submitted')).toMatchObject({ quantidade: 2, valor: 50000, semValor: 1 });
    expect(d.emDisputa).toEqual({ quantidade: 3, valor: 150000 });
    expect(d.ganhos).toEqual({ quantidade: 2, valor: 1500000 });
    expect(d.perdidos).toEqual({ quantidade: 2, valor: 600000 });
    expect(d.abandonados).toBe(1);
    expect(d.taxaVitoria).toBe(50);
  });

  it('por órgão e por mês', () => {
    expect(d.porOrgao).toEqual([
      { orgao: 'MJ', disputas: 3, ganhos: 2, taxa: 67, valorGanho: 1500000 },
      { orgao: 'TJ', disputas: 1, ganhos: 0, taxa: 0, valorGanho: 0 },
    ]);
    expect(d.porMes).toHaveLength(12);
    expect(d.porMes[11]).toEqual({ chave: '2026-09', rotulo: 'set/26', ganhos: 1, perdidos: 1, valorGanho: 1000000 });
    expect(d.porMes[10]).toMatchObject({ chave: '2026-08', ganhos: 1, valorGanho: 500000 });
    expect(d.porMes[0].chave).toBe('2025-10');
  });

  it('preço final × estimado: o deságio do vencedor', () => {
    expect(d.precos.map((p) => [p.titulo, p.desagioPct])).toEqual([
      ['Edital d', -10], ['Edital e', null], ['Edital f', -25], ['Edital g', null],
    ]);
    expect(d.precos[2].vencedor).toBe('ACME');
    expect(d.desagioMedioPct).toBe(-17.5);
    expect(desempenhoDaGestao([], HOJE).taxaVitoria).toBeNull();
    expect(desempenhoDaGestao([], HOJE).desagioMedioPct).toBeNull();
  });
});

describe('acoesPorResponsavel', () => {
  it('agrupa as ações pendentes por quem foi definido; sem ninguém, o padrão do laudo', () => {
    const cartoes = [
      cartao({ id: 'a', titulo: 'Hortifruti', stage: 'triage',
        tasks: [tarefa('t1', 'Conferir', { prazo: '20/09/2026' }), tarefa('t2', 'Montar', { prazo: '30/09/2026', prioridade: 'Alta' }),
          tarefa('t3', 'Enviar', { prioridade: 'Alta' })],
        status: { t1: { responsavel: 'Ana' }, t2: { done: true, responsavel: 'Ana' } } }),
      cartao({ id: 'b', titulo: 'Software', stage: 'proposal',
        tasks: [tarefa('t1', 'Cotar', { responsavel: 'Bruno', prazo: 'Hoje' }), tarefa('t2', 'Revisar', { prazo: '30/09/2026' })] }),
      cartao({ id: 'c', stage: 'won', tasks: [tarefa('t1', 'x')] }),   // encerrado: fora
    ];
    const cargas = acoesPorResponsavel(cartoes, HOJE);
    expect(cargas.map((c) => [c.responsavel, c.pendentes.length, c.vencidas, c.concluidas, c.editais, c.padrao])).toEqual([
      ['Licitações', 2, 0, 0, 2, true],
      ['Ana', 1, 1, 1, 1, false],
      ['Bruno', 1, 0, 0, 1, false],
    ]);
    expect(cargas[1].pendentes[0]).toMatchObject({ titulo: 'Hortifruti', acao: 'Conferir', vencida: true, prazoTexto: '20/09/2026' });
    // Dentro do padrão: quem tem data vem antes de quem não tem, mesmo com prioridade menor.
    expect(cargas[0].pendentes.map((p) => p.acao)).toEqual(['Revisar', 'Enviar']);
  });
});

describe('situacaoDoEdital — a frase do topo do resumo', () => {
  const abertura = (iso: string) => [{ label: 'Abertura das propostas', data_iso: iso }];

  it('prazo vencido sem ação feita: registre o desfecho ou tire da Gestão, com o alerta do laudo', () => {
    const s = situacaoDoEdital(cartao({ id: 'a', stage: 'not_started', score: 40, veredito: 'NO_GO', datas: abertura('2026-08-13'),
      tasks: [tarefa('t1', 'x'), tarefa('t2', 'y'), tarefa('t3', 'z')] }), HOJE);
    expect(s.tom).toBe('vermelho');
    expect(s.titulo).toBe('Prazo venceu há 43 dias');
    expect(s.texto).toContain('Nenhuma das 3 ações do plano foi feita.');
    expect(s.texto).toContain('recomendou não participar (score 40)');
    expect(s.texto).toContain('tire o edital da Gestão');
    expect(s.sugestao).toBe('registrar_resultado');
  });

  it('vence hoje, em 3 dias, esta semana, no prazo — cada um com o seu tom e a sugestão', () => {
    const c = (iso: string, done = 0) => cartao({ id: 'b', stage: 'proposal', datas: abertura(iso),
      tasks: [tarefa('t1', 'x'), tarefa('t2', 'y')], status: done ? { t1: { done: true } } : {} });
    expect(situacaoDoEdital(c('2026-09-25'), HOJE)).toMatchObject({ tom: 'vermelho', titulo: 'Vence hoje', sugestao: 'concluir_acao' });
    expect(situacaoDoEdital(c('2026-09-27', 1), HOJE)).toMatchObject({ tom: 'ambar', titulo: 'Vence em 2 dias', sugestao: 'concluir_acao' });
    expect(situacaoDoEdital(c('2026-09-27', 1), HOJE).texto).toContain('1 de 2 ações do plano feitas.');
    expect(situacaoDoEdital(c('2026-10-01'), HOJE)).toMatchObject({ tom: 'azul', titulo: 'Vence esta semana, em 6 dias' });
    expect(situacaoDoEdital(c('2026-10-20'), HOJE)).toMatchObject({ tom: 'verde', titulo: 'No prazo: vence em 25 dias' });
    const tudoFeito = cartao({ id: 'c', stage: 'proposal', datas: abertura('2026-10-20'), tasks: [tarefa('t1', 'x')], status: { t1: { done: true } } });
    expect(situacaoDoEdital(tudoFeito, HOJE)).toMatchObject({ sugestao: 'avancar' });
    expect(situacaoDoEdital(tudoFeito, HOJE).texto).toContain('As 1 ações do plano estão concluídas.');
  });

  it('sem data: confira no PNCP; enviado: registre o resultado', () => {
    expect(situacaoDoEdital(cartao({ id: 'd', stage: 'triage' }), HOJE)).toMatchObject({ tom: 'neutro', titulo: 'Sem prazo identificado', sugestao: 'conferir_prazo' });
    const enviado = situacaoDoEdital(cartao({ id: 'e', stage: 'submitted', datas: abertura('2026-09-20') }), HOJE);
    expect(enviado).toMatchObject({ tom: 'azul', titulo: 'Proposta enviada', sugestao: 'registrar_resultado' });
    expect(enviado.texto).toContain('A sessão foi em 20 de set.');
  });

  it('desfechos: ganho com preço, perdido com vencedor, abandonado', () => {
    expect(situacaoDoEdital(cartao({ id: 'f', stage: 'won', learning: { resultado: 'won', preco_final: 'R$ 810.000,00' } }), HOJE))
      .toMatchObject({ tom: 'verde', titulo: 'Ganho', texto: 'Preço final R$ 810.000,00. Acompanhe a vigência em Meus contratos.' });
    expect(situacaoDoEdital(cartao({ id: 'g', stage: 'lost', learning: { resultado: 'lost', vencedor: 'ACME', preco_final: 'R$ 240.000,00' } }), HOJE).texto)
      .toBe('Venceu ACME por R$ 240.000,00. O preço final alimenta a régua de Desempenho.');
    expect(situacaoDoEdital(cartao({ id: 'h', stage: 'lost' }), HOJE).texto).toMatch(/^Vencedor não registrado\./);
    expect(situacaoDoEdital(cartao({ id: 'i', stage: 'abandoned', learning: { resultado: 'not_participated' } }), HOJE).titulo).toBe('Não participou');
  });
});

describe('linkDoPncp, datasDoEdital e fraseDosDias', () => {
  it('o link só existe com a tripla inteira, da referência ou dos campos soltos', () => {
    expect(linkDoPncp({ id: 'x', pncp_cnpj: '01.612.092/0001-23', pncp_ano: 2026, pncp_sequencial: '000045' } as unknown as SavedAnalysis))
      .toBe('https://pncp.gov.br/app/editais/01612092000123/2026/45');
    expect(linkDoPncp({ id: 'x', pncp_ref: { cnpj: '01612092000123', ano: '2025', sequencial: '7' } } as unknown as SavedAnalysis))
      .toBe('https://pncp.gov.br/app/editais/01612092000123/2025/7');
    expect(linkDoPncp({ id: 'x', pncp_cnpj: '123', pncp_ano: 2026, pncp_sequencial: '1' } as unknown as SavedAnalysis)).toBeNull();
    expect(linkDoPncp({ id: 'x' } as unknown as SavedAnalysis)).toBeNull();
  });

  it('a ação do botão da situação: existe só quando há com o que fazer', () => {
    const t = { id: 't1', acao: 'Montar proposta', prazo: 'Hoje', responsavel: 'Licitações', resultado_esperado: '', origem: 'Decisão', prioridade: 'Normal' } as DecisionQueueTask;
    const comTarefa = cartao({ id: 'a', stage: 'proposal', tasks: [t] });
    expect(acaoDaSugestao('registrar_resultado', comTarefa)).toEqual({ tipo: 'registrar_resultado' });
    expect(acaoDaSugestao('concluir_acao', comTarefa)).toEqual({ tipo: 'concluir_acao', tarefa: t });
    expect(acaoDaSugestao('concluir_acao', cartao({ id: 'b', stage: 'proposal' }))).toBeNull();
    expect(acaoDaSugestao('avancar', comTarefa)).toEqual({ tipo: 'avancar', etapa: 'submitted' });
    expect(acaoDaSugestao('avancar', cartao({ id: 'c', stage: 'executed' }))).toBeNull();
    const semOrigem = cartao({ id: 'd', stage: 'triage' });
    expect(acaoDaSugestao('conferir_prazo', semOrigem)).toBeNull();
    const comOrigem = cartao({ id: 'e', stage: 'triage' });
    (comOrigem.analysis as unknown as Record<string, unknown>).pncp_ref = { cnpj: '01612092000123', ano: '2026', sequencial: '9' };
    expect(acaoDaSugestao('conferir_prazo', comOrigem)).toEqual({ tipo: 'abrir_pncp', url: 'https://pncp.gov.br/app/editais/01612092000123/2026/9' });
    expect(acaoDaSugestao(null, comTarefa)).toBeNull();
  });

  it('todas as datas, as com data em ordem e as só de texto no fim', () => {
    const a = cartao({ id: 'a', stage: 'triage', datas: [
      { label: 'Sessão pública', data_iso: '2026-10-02' },
      { label: 'Publicação', data_iso: '2026-09-01' },
      { label: 'Visita técnica', data_iso: null },
    ] }).analysis;
    const datas = datasDoEdital(a, HOJE);
    expect(datas.map((d) => [d.rotulo, d.dias, d.decisivo])).toEqual([['Publicação', -24, false], ['Sessão pública', 7, true]]);
    expect(fraseDosDias(-3)).toBe('venceu há 3 dias');
    expect(fraseDosDias(-1)).toBe('venceu há 1 dia');
    expect(fraseDosDias(0)).toBe('hoje');
    expect(fraseDosDias(1)).toBe('amanhã');
    expect(fraseDosDias(12)).toBe('em 12 dias');
  });
});
