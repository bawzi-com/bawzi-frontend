import { describe, it, expect } from 'vitest';
import { inferDecisionVerdict, scoreOuNulo, getDecisionQueueStage } from '@/lib/decisionQueue';

/* Os primeiros testes automatizados do frontend.
 *
 * Nasceram de um defeito real que passou por `tsc --noEmit` sem uma queixa:
 * `raw.includes('go')` casa DENTRO de palavra. "Não recomendamos partici(par)",
 * "Não a(vançar)" e "Aquisição de arti(go)s" viravam GO — o edital que o laudo
 * reprovou ia para a fila de Proposta. Tipo não pega isso; teste pega.
 */

const analise = (extra: Record<string, unknown> = {}) => extra as never;

describe('inferDecisionVerdict', () => {
  it('o veredito explícito do backend passa na frente do score', () => {
    // Recalcular por cima de `decisao.veredito` é a tela discordando do laudo,
    // e a tela sempre perde essa discussão diante do cliente.
    expect(inferDecisionVerdict(analise({ decisao: { veredito: 'GO' }, score: 30 }))).toBe('GO');
    expect(inferDecisionVerdict(analise({ decisao: { veredito: 'NO_GO' }, score: 90 }))).toBe('NO_GO');
    expect(inferDecisionVerdict(analise({ decisao: { veredito: 'GO_CONDICIONADO' }, score: 40 })))
      .toBe('GO_CONDICIONADO');
  });

  it('aceita o veredito em qualquer caixa e com espaços', () => {
    expect(inferDecisionVerdict(analise({ decisao: { veredito: 'no_go' }, score: 90 }))).toBe('NO_GO');
    expect(inferDecisionVerdict(analise({ decisao: { veredito: '  GO  ' }, score: 10 }))).toBe('GO');
  });

  it('veredito irreconhecível cai no resto da regra, não trava', () => {
    expect(inferDecisionVerdict(analise({ decisao: { veredito: 'LIXO' }, score: 80 }))).toBe('GO');
  });

  it.each([
    ['Não recomendamos participar deste certame.', 'NO_GO'],
    ['Não avançar com este edital.', 'NO_GO'],
    ['Declinar a participação.', 'NO_GO'],
  ])('reconhece a negação em %j', (recommendation, esperado) => {
    // Estes três viravam GO: o `includes` engolia a negação.
    expect(inferDecisionVerdict(analise({ recommendation }))).toBe(esperado);
  });

  it('"artigos" não contém um veredito', () => {
    expect(inferDecisionVerdict(analise({ classification: 'Aquisição de artigos de higiene' })))
      .toBe('GO_CONDICIONADO');
  });

  it('o rótulo canônico do backend para condicional não vira GO', () => {
    // "Participar somente após validações" é o que o motor escreve para
    // GO_CONDICIONADO. Ia para a fila de Proposta.
    expect(inferDecisionVerdict(analise({ decisao: { rotulo: 'Participar somente após validações' } })))
      .toBe('GO_CONDICIONADO');
  });

  it('o rótulo que o próprio sistema escreve continua sendo lido certo', () => {
    expect(inferDecisionVerdict(analise({ classification: 'NO-GO (Risco Extremo)' }))).toBe('NO_GO');
    expect(inferDecisionVerdict(analise({ classification: 'GO Condicionado' }))).toBe('GO_CONDICIONADO');
  });

  it('sem texto legível, o score desempata', () => {
    expect(inferDecisionVerdict(analise({ score: 80 }))).toBe('GO');
    expect(inferDecisionVerdict(analise({ score: 50 }))).toBe('GO_CONDICIONADO');
    expect(inferDecisionVerdict(analise({ score: 20 }))).toBe('NO_GO');
  });

  it('sem score E sem texto, não se afirma nem GO nem NO_GO', () => {
    // GO_CONDICIONADO é o único dos três rótulos que não afirma: manda o
    // edital para triagem, que é onde um laudo ilegível deve estar.
    expect(inferDecisionVerdict(analise({}))).toBe('GO_CONDICIONADO');
  });
});

describe('scoreOuNulo', () => {
  it('zero é uma medida, ausência não', () => {
    // `item.score || 0` transformava ausência em zero, e zero pintava o
    // cartão de vermelho com a etiqueta NO-GO.
    expect(scoreOuNulo(0)).toBe(0);
    expect(scoreOuNulo(undefined)).toBeNull();
    expect(scoreOuNulo(null)).toBeNull();
    expect(scoreOuNulo('')).toBeNull();
  });

  it('aceita número em texto e recusa lixo', () => {
    expect(scoreOuNulo('55')).toBe(55);
    expect(scoreOuNulo('abc')).toBeNull();
    expect(scoreOuNulo(NaN)).toBeNull();
  });
});

describe('getDecisionQueueStage', () => {
  it('o estágio gravado pelo servidor vence qualquer dedução', () => {
    const r = getDecisionQueueStage(analise({ workflow_status: 'won', score: 10 }));
    expect(r.key).toBe('won');
  });

  it('sem nada registrado, o cartão não começou', () => {
    expect(getDecisionQueueStage(analise({ score: 80 })).key).toBe('not_started');
  });
});
