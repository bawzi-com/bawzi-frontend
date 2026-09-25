import { describe, expect, it } from 'vitest';
import {
  agruparAlertas, alertaVencido, chaveDoGrupo, contagemDoSino, contagensPorTipo, dataDoAlerta, diasDoAlerta, filtrarPorTipo, fraseDoVencimento,
  lerDia, mensagemViva, ordenarGrupos, resumoDoGrupo, rodapeDoRadar, secoesDoRadar, subtituloDoRadar, tempoAtras, tipoDePrazo,
  tituloCitado, tituloVivo, type Notificacao,
} from './radar';

/* O sino (25/09/2026): o que a tela recalcula a partir do que o alerta guarda. */

const HOJE = new Date(2026, 8, 25, 10, 0);
const iso = (d: number, h = 9) => new Date(2026, 8, d, h).toISOString();

let seq = 0;
function alerta(o: Partial<Notificacao> & { tipo: Notificacao['tipo'] }): Notificacao {
  seq += 1;
  return { _id: `n${seq}`, prioridade: 1, icone: '⏱', titulo: 'Título', mensagem: 'Mensagem', url: '?tab=gestao', lida: false, criada_em: iso(25), ...o };
}

const TITULO_CORTADO = 'Contratação de serviços especializados de Tecnologia da Informação, envolvendo análise de negócio, requisitos, desenvolv';

/** Como os alertas de prazo eram gravados antes de 25/09/2026. */
const prazoAntigo = (o: Partial<Notificacao> = {}) => alerta({
  tipo: 'prazo', titulo: 'Prazo crítico vence hoje', criada_em: iso(19),
  mensagem: `Abertura das Propostas do edital "${TITULO_CORTADO}" vence hoje. Decida, esclareça ou abandone antes de mobilizar proposta.`,
  dados: { analysis_id: 'a1', prazo: 'Abertura das Propostas' }, ...o,
});

/** Como são gravados agora: com a data, o tipo e o título. */
const prazoNovo = (o: Partial<Notificacao> = {}, dados: Partial<NonNullable<Notificacao['dados']>> = {}) => alerta({
  tipo: 'prazo', titulo: 'Prazo vence amanhã', criada_em: iso(25),
  mensagem: 'Encerramento das Propostas do edital "MANUTENÇÃO DO LAGO" vence amanhã.',
  dados: { analysis_id: 'a2', prazo: 'Encerramento das Propostas', data_iso: '2026-09-26', tipo_prazo: 'fim', titulo_edital: 'MANUTENÇÃO DO LAGO', ...dados },
  ...o,
});

describe('a data que o alerta vigia', () => {
  it('lê o dia gravado; sem ele, infere do nascimento e do "hoje"/"amanhã" da mensagem', () => {
    expect(lerDia('2026-09-26')).toEqual(new Date(2026, 8, 26));
    expect(lerDia('2026-09-26T08:00:00Z')).toEqual(new Date(2026, 8, 26));
    expect(lerDia('26/09/2026')).toBeNull();
    expect(lerDia(undefined)).toBeNull();
    expect(dataDoAlerta(prazoNovo())).toEqual(new Date(2026, 8, 26));
    expect(dataDoAlerta(prazoAntigo())).toEqual(new Date(2026, 8, 19));                       // "hoje" no dia 19
    expect(dataDoAlerta(prazoAntigo({ mensagem: 'X do edital "Y" vence amanhã.' }))).toEqual(new Date(2026, 8, 20));
    expect(dataDoAlerta(prazoAntigo({ mensagem: 'sem quando' }))).toBeNull();
    expect(dataDoAlerta(prazoAntigo({ criada_em: undefined }))).toBeNull();
    expect(dataDoAlerta(alerta({ tipo: 'compliance' }))).toBeNull();
  });

  it('disputa: o fim do contrato gravado; sem ele, o nascimento mais os dias de então', () => {
    const nova = alerta({ tipo: 'disputa_abrindo', criada_em: iso(5), dados: { ncp: 'c1', dias: 26, vence_em: '2026-10-01' } });
    expect(dataDoAlerta(nova)).toEqual(new Date(2026, 9, 1));
    const antiga = alerta({ tipo: 'disputa_abrindo', criada_em: iso(5), dados: { ncp: 'c1', dias: 26 } });
    expect(dataDoAlerta(antiga)).toEqual(new Date(2026, 9, 1));
    expect(diasDoAlerta(antiga, HOJE)).toBe(6);
    expect(dataDoAlerta(alerta({ tipo: 'disputa_abrindo', dados: { ncp: 'c1' } }))).toBeNull();
  });

  it('dias e vencido', () => {
    expect(diasDoAlerta(prazoNovo(), HOJE)).toBe(1);
    expect(diasDoAlerta(prazoAntigo(), HOJE)).toBe(-6);
    expect(alertaVencido(prazoAntigo(), HOJE)).toBe(true);
    expect(alertaVencido(prazoNovo(), HOJE)).toBe(false);
    expect(alertaVencido(prazoNovo({}, { data_iso: '2026-09-25' }), HOJE)).toBe(false);          // hoje não é vencido
    expect(alertaVencido(alerta({ tipo: 'compliance' }), HOJE)).toBe(false);
    expect(diasDoAlerta(alerta({ tipo: 'compliance' }), HOJE)).toBeNull();
  });
});

describe('texto vivo', () => {
  it('a frase do vencimento, para o que vence e para o que começa', () => {
    expect(fraseDoVencimento(0)).toBe('vence hoje');
    expect(fraseDoVencimento(1)).toBe('vence amanhã');
    expect(fraseDoVencimento(12)).toBe('vence em 12 dias');
    expect(fraseDoVencimento(-1)).toBe('venceu ontem');
    expect(fraseDoVencimento(-6)).toBe('venceu há 6 dias');
    expect(fraseDoVencimento(0, 'inicio')).toBe('é hoje');
    expect(fraseDoVencimento(2, 'sessao')).toBe('é em 2 dias');
    expect(fraseDoVencimento(-3, 'sessao')).toBe('foi há 3 dias');
    expect(fraseDoVencimento(-1, 'inicio')).toBe('foi ontem');
  });

  it('o tipo da data pelo rótulo, como no servidor', () => {
    expect(tipoDePrazo('Encerramento das Propostas')).toBe('fim');
    expect(tipoDePrazo('Abertura das Propostas')).toBe('inicio');
    expect(tipoDePrazo('Início das propostas')).toBe('inicio');
    expect(tipoDePrazo('Prazo de Impugnação')).toBe('impugnacao');
    expect(tipoDePrazo('Limite para esclarecimento')).toBe('esclarecimento');
    expect(tipoDePrazo('Sessão de lances')).toBe('sessao');
    expect(tipoDePrazo('Data de abertura da sessão pública')).toBe('sessao');
    expect(tipoDePrazo('')).toBe('fim');
  });

  it('o título do edital em frase, com reticências quando o corte antigo o deixou sem', () => {
    expect(tituloCitado(TITULO_CORTADO)).toBe(`${TITULO_CORTADO}…`);
    expect(tituloCitado('CONTRATAÇÃO DE EMPRESA ESPECIALIZADA PARA O CRBIO-01')).toBe('Contratação de empresa especializada para o CRBIO-01');
    expect(tituloCitado('Título curto')).toBe('Título curto');
    expect(tituloCitado(`${'A'.repeat(118)}…`)).toBe(`A${'a'.repeat(117)}…`);   // já tem reticências: não dobra
    expect(tituloCitado('')).toBe('');
  });

  it('o título recalculado: prazo por tipo e por dia; disputa com a conta de hoje', () => {
    expect(tituloVivo(prazoAntigo(), HOJE)).toBe('Propostas abriram há 6 dias');
    expect(tituloVivo(prazoNovo(), HOJE)).toBe('Prazo vence amanhã');
    expect(tituloVivo(prazoNovo({}, { data_iso: '2026-09-25' }), HOJE)).toBe('Prazo vence hoje');
    expect(tituloVivo(prazoNovo({}, { data_iso: '2026-09-24' }), HOJE)).toBe('Prazo venceu ontem');
    expect(tituloVivo(prazoNovo({}, { data_iso: '2026-10-05' }), HOJE)).toBe('Prazo vence em 10 dias');
    expect(tituloVivo(prazoNovo({}, { data_iso: '2026-09-26', tipo_prazo: 'inicio' }), HOJE)).toBe('Propostas abrem amanhã');
    expect(tituloVivo(prazoNovo({}, { data_iso: '2026-09-25', tipo_prazo: 'sessao' }), HOJE)).toBe('Sessão hoje');
    expect(tituloVivo(prazoNovo({}, { data_iso: '2026-09-22', tipo_prazo: 'sessao' }), HOJE)).toBe('Sessão foi há 3 dias');
    expect(tituloVivo(prazoNovo({}, { data_iso: '2026-09-26', tipo_prazo: 'impugnacao' }), HOJE)).toBe('Impugnação vence amanhã');
    expect(tituloVivo(prazoNovo({}, { data_iso: '2026-09-23', tipo_prazo: 'esclarecimento' }), HOJE)).toBe('Esclarecimento venceu há 2 dias');
    // Sem tipo gravado, o rótulo decide (alerta antigo).
    expect(tituloVivo(prazoAntigo({ dados: { analysis_id: 'a1', prazo: 'Sessão de lances' } }), HOJE)).toBe('Sessão foi há 6 dias');
    expect(tituloVivo(prazoAntigo({ dados: undefined, mensagem: 'Prazo de Impugnação do edital "X" vence hoje.' }), HOJE)).toBe('Impugnação venceu há 6 dias');
    // Sem data nenhuma, fica o que o servidor mandou.
    expect(tituloVivo(prazoAntigo({ mensagem: 'sem quando' }), HOJE)).toBe('Prazo crítico vence hoje');
    const disputa = alerta({ tipo: 'disputa_abrindo', titulo: 'Disputa em 30 dias: MINISTERIO DA JUSTICA E SEGURANCA PUBLIC', criada_em: iso(5), dados: { ncp: 'c1', dias: 26 } });
    expect(tituloVivo(disputa, HOJE)).toBe('Disputa em 6 dias: Ministerio da justica e seguranca public');
    expect(tituloVivo({ ...disputa, dados: { ncp: 'c1', dias: 20 } }, HOJE)).toBe('Disputa: contrato vence hoje: Ministerio da justica e seguranca public');
    expect(tituloVivo({ ...disputa, dados: { ncp: 'c1', dias: 21 } }, HOJE)).toBe('Disputa em 1 dia: Ministerio da justica e seguranca public');
    expect(tituloVivo({ ...disputa, dados: { ncp: 'c1', dias: 18 } }, HOJE)).toBe('Contrato venceu há 2 dias: Ministerio da justica e seguranca public');
    expect(tituloVivo({ ...disputa, titulo: 'Disputa em 30 dias', dados: { ncp: 'c1', dias: 26 } }, HOJE)).toBe('Disputa em 6 dias');
    expect(tituloVivo(alerta({ tipo: 'compliance', titulo: 'Risco de Desclassificação' }), HOJE)).toBe('Risco de Desclassificação');
  });

  it('a mensagem recalculada: sem a frase repetida, com o título em frase e o tempo de hoje', () => {
    expect(mensagemViva(prazoAntigo(), HOJE)).toBe(`Abertura das Propostas do edital "${TITULO_CORTADO}…" foi há 6 dias.`);
    expect(mensagemViva(prazoNovo(), HOJE)).toBe('Encerramento das Propostas do edital "Manutenção do lago" vence amanhã.');
    expect(mensagemViva(prazoNovo({}, { data_iso: '2026-09-20' }), HOJE)).toBe('Encerramento das Propostas do edital "Manutenção do lago" venceu há 5 dias.');
    // Antigo sem data inferível: só perde a frase repetida e ganha o título em frase.
    expect(mensagemViva(prazoAntigo({ mensagem: 'Sessão do edital "EDITAL X" é logo. Decida, esclareça ou abandone antes de mobilizar proposta.' }), HOJE))
      .toBe('Sessão do edital "Edital x" é logo.');
    const disputa = alerta({ tipo: 'disputa_abrindo', criada_em: iso(5), mensagem: 'O contrato de TELNET (R$ 14.040) em MJSP vence em 26 dias.', dados: { ncp: 'c1', dias: 26 } });
    expect(mensagemViva(disputa, HOJE)).toBe('O contrato de TELNET (R$ 14.040) em MJSP vence em 6 dias.');
    expect(mensagemViva({ ...disputa, dados: { ncp: 'c1', dias: 18 } }, HOJE)).toBe('O contrato de TELNET (R$ 14.040) em MJSP venceu há 2 dias.');
    const mudancaNova = alerta({ tipo: 'pncp_mudanca', mensagem: 'FORNECIMENTO DE MEDICAMENTOS — 2 arquivos novos publicados. Novos: "Errata". Revise antes de avançar.', dados: { analysis_id: 'a9', titulo_edital: 'FORNECIMENTO DE MEDICAMENTOS' } });
    expect(mensagemViva(mudancaNova, HOJE)).toBe('Fornecimento de medicamentos — 2 arquivos novos publicados. Novos: "Errata". Revise antes de avançar.');
    const mudancaAntiga = alerta({ tipo: 'pncp_mudanca', mensagem: 'FORNECIMENTO DE MEDICAMENTOS recebeu novo documento ou alteração oficial. Revise antes de avançar.', dados: { analysis_id: 'a9' } });
    expect(mensagemViva(mudancaAntiga, HOJE)).toBe('Fornecimento de medicamentos recebeu novo documento ou alteração oficial. Revise antes de avançar.');
    expect(mensagemViva(alerta({ tipo: 'pncp_mudanca', mensagem: 'Sem o padrão' }), HOJE)).toBe('Sem o padrão');
    expect(mensagemViva(alerta({ tipo: 'compliance', mensagem: 'Certidões vencidas...' }), HOJE)).toBe('Certidões vencidas...');
  });
});

describe('grupos, seções e chips', () => {
  const lista = [
    alerta({ tipo: 'compliance', mensagem: 'Certidões', criada_em: iso(22) }),
    alerta({ tipo: 'compliance', mensagem: 'Certidões', criada_em: iso(14) }),
    alerta({ tipo: 'pncp_mudanca', mensagem: 'A mudou', criada_em: iso(13), dados: { analysis_id: 'x' } }),
    alerta({ tipo: 'pncp_mudanca', mensagem: 'A mudou', criada_em: iso(3), dados: { analysis_id: 'x' } }),
    alerta({ tipo: 'pncp_mudanca', mensagem: 'A mudou', criada_em: iso(3, 12), dados: { analysis_id: 'x' } }),
    alerta({ tipo: 'pncp_mudanca', mensagem: 'B mudou', criada_em: iso(20), dados: { analysis_id: 'y' } }),
    prazoAntigo(),                                                                            // vencido há 6 dias
    prazoNovo(),                                                                              // amanhã
    prazoNovo({}, { data_iso: '2026-10-20', analysis_id: 'a3' }),                              // em 25 dias
    alerta({ tipo: 'disputa_abrindo', titulo: 'Disputa em 30 dias: MJ', criada_em: iso(5), dados: { ncp: 'c1', dias: 26 } }),   // em 6 dias
    alerta({ tipo: 'disputa_abrindo', titulo: 'Disputa em 60 dias: MJ', criada_em: iso(1), dados: { ncp: 'c1', dias: 30 } }),   // mesmo contrato, marco anterior
    alerta({ tipo: 'matchmaker', prioridade: 2, mensagem: 'Novos editais', criada_em: iso(25) }),
  ];

  it('a chave: edital para prazo/mudança/decisão, contrato para disputa, texto para o resto', () => {
    expect(chaveDoGrupo(prazoNovo())).toBe('prazo|a2|encerramento das propostas');
    expect(chaveDoGrupo(alerta({ tipo: 'prazo', mensagem: 'm', dados: {} }))).toBe('prazo|m');
    expect(chaveDoGrupo(lista[2])).toBe('pncp_mudanca|x');
    expect(chaveDoGrupo(alerta({ tipo: 'decisao', dados: { analysis_id: 'z' } }))).toBe('decisao|z');
    expect(chaveDoGrupo(lista[9])).toBe('disputa|c1');
    expect(chaveDoGrupo(lista[0])).toBe('compliance|Certidões');
  });

  it('agrupa os repetidos com o mais recente na frente e todos os ids', () => {
    const grupos = agruparAlertas(lista);
    expect(grupos).toHaveLength(8);
    const mudanca = grupos.find((g) => g.chave === 'pncp_mudanca|x')!;
    expect(mudanca.itens.map((i) => i.criada_em)).toEqual([iso(13), iso(3, 12), iso(3)]);
    expect(mudanca.principal.criada_em).toBe(iso(13));
    expect(mudanca.ids).toEqual(mudanca.itens.map((i) => i._id));
    expect(resumoDoGrupo(mudanca, HOJE)).toBe('3 alterações, a última há 12 dias');
    const certidoes = grupos.find((g) => g.chave === 'compliance|Certidões')!;
    expect(resumoDoGrupo(certidoes, HOJE)).toBe('2 lembretes, o último há 3 dias');
    const disputa = grupos.find((g) => g.chave === 'disputa|c1')!;
    expect(resumoDoGrupo(disputa, HOJE)).toBe('2 avisos, o último há 20 dias');
    expect(resumoDoGrupo(grupos.find((g) => g.chave === 'pncp_mudanca|y')!, HOJE)).toBeNull();
  });

  it('ordena: esta semana primeiro, depois o sem data, depois o longe; e separa os vencidos', () => {
    const { ativos, vencidos } = secoesDoRadar(lista, HOJE);
    expect(ativos.map((g) => g.chave)).toEqual([
      'prazo|a2|encerramento das propostas',   // amanhã
      'disputa|c1',                            // em 6 dias
      'compliance|Certidões',                  // sem data: prioridade 1, o mais recente (dia 22)
      'pncp_mudanca|y',                        // dia 20
      'pncp_mudanca|x',                        // dia 13 (o mais recente do grupo)
      'matchmaker|Novos editais',              // prioridade 2
      'prazo|a3|encerramento das propostas',   // em 25 dias
    ]);
    expect(vencidos.map((g) => g.chave)).toEqual(['prazo|a1|abertura das propostas']);
  });

  it('vencidos do mais recente ao mais antigo', () => {
    const grupos = ordenarGrupos(agruparAlertas([
      prazoNovo({}, { data_iso: '2026-08-26', analysis_id: 'v30' }),
      prazoNovo({}, { data_iso: '2026-09-24', analysis_id: 'v1' }),
      prazoNovo({}, { data_iso: '2026-09-13', analysis_id: 'v12' }),
    ]), HOJE);
    expect(grupos.map((g) => g.principal.dados?.analysis_id)).toEqual(['v1', 'v12', 'v30']);
  });

  it('o número do sino: grupos ativos com algo por ler', () => {
    expect(contagemDoSino(lista, HOJE)).toBe(7);                                              // 8 grupos, 1 vencido
    const lidas = lista.map((n) => (n.tipo === 'pncp_mudanca' ? { ...n, lida: true } : n));
    expect(contagemDoSino(lidas, HOJE)).toBe(5);                                              // os dois grupos de mudança saem
    const umaDasTres = lista.map((n) => (n.criada_em === iso(13) ? { ...n, lida: true } : n));
    expect(contagemDoSino(umaDasTres, HOJE)).toBe(7);                                         // o grupo ainda tem duas por ler
    expect(contagemDoSino([], HOJE)).toBe(0);
  });

  it('chips na ordem do catálogo, com a contagem de grupos; o filtro recorta', () => {
    const { ativos } = secoesDoRadar(lista, HOJE);
    expect(contagensPorTipo(ativos)).toEqual([
      { tipo: 'prazo', rotulo: 'Prazos', n: 2 },
      { tipo: 'pncp_mudanca', rotulo: 'Editais que mudaram', n: 2 },
      { tipo: 'disputa_abrindo', rotulo: 'Disputas', n: 1 },
      { tipo: 'compliance', rotulo: 'Compliance', n: 1 },
      { tipo: 'matchmaker', rotulo: 'Editais novos', n: 1 },
    ]);
    expect(filtrarPorTipo(ativos, 'pncp_mudanca').map((g) => g.chave)).toEqual(['pncp_mudanca|y', 'pncp_mudanca|x']);
    expect(filtrarPorTipo(ativos, null)).toBe(ativos);
  });

  it('tempo atrás, rodapé e subtítulo', () => {
    expect(tempoAtras(new Date(2026, 8, 25, 9, 59, 30).toISOString(), HOJE)).toBe('agora');
    expect(tempoAtras(new Date(2026, 8, 25, 9, 55).toISOString(), HOJE)).toBe('há 5 min');
    expect(tempoAtras(new Date(2026, 8, 25, 7, 0).toISOString(), HOJE)).toBe('há 3 h');
    expect(tempoAtras(iso(24, 10), HOJE)).toBe('há 1 dia');
    expect(tempoAtras(iso(13), HOJE)).toBe('há 12 dias');
    expect(tempoAtras(undefined, HOJE)).toBe('');
    expect(tempoAtras('lixo', HOJE)).toBe('');
    expect(rodapeDoRadar(null, HOJE)).toBe('Ainda não verificado');
    expect(rodapeDoRadar(new Date(2026, 8, 25, 9, 59, 40), HOJE)).toBe('Atualizado agora · confere a cada 2 min');
    expect(rodapeDoRadar(new Date(2026, 8, 25, 9, 57), HOJE)).toBe('Atualizado há 3 min · confere a cada 2 min');
    expect(subtituloDoRadar(0, 0)).toBe('Tudo em dia');
    expect(subtituloDoRadar(1, 0)).toBe('1 alerta');
    expect(subtituloDoRadar(12, 8)).toBe('12 alertas · 8 vencidos');
    expect(subtituloDoRadar(0, 1)).toBe('1 vencido');
    expect(subtituloDoRadar(100, 0, true)).toBe('100+ alertas');
  });
});
