/**
 * O cronograma do edital: a data que a tela mostra e o prazo que ela declara
 * vencido.
 *
 * ⚠️ ESTE MÓDULO DECIDE SE O CLIENTE VÊ O BANNER "EDITAL ENCERRADO". Errar
 * para o lado pessimista aqui faz a pessoa descartar sozinha um edital vivo, e
 * nada na tela sugere que ela deveria conferir. Errar para o outro lado a faz
 * perder a sessão. Todo caso abaixo crava o "agora", porque um teste de prazo
 * com data relativa passa por acidente na maior parte do calendário.
 */
import { describe, expect, it } from 'vitest';

import {
  dataCriticaExpirada,
  dataCriticaUrgente,
  diasUteisAteDataCritica,
  formatarDataCritica,
  instanteLimite,
  partesDaDataCritica,
  prazoDePropostasEncerrado,
  venceHoje,
} from './datasCriticas';

// Terça-feira, 15h00 em Brasília (18h UTC).
const AGORA = new Date('2026-09-15T18:00:00Z');

describe('data que não existe no calendário', () => {
  // ⚠️ Estas datas vêm da extração do edital por modelo. `Date.UTC` não recusa
  // mês 13 nem 31 de setembro: ele transborda, e o transbordo tem cara de data
  // legítima. Medido antes da correção:
  //     '2026-13-15' → "15 de jan. de 2027"   (um ano à frente)
  //     '2026-09-31' → "01 de out. de 2026"   (um dia depois do prazo)
  it.each([
    ['2026-13-15', 'mês 13'],
    ['2026-00-10', 'mês 0'],
    ['2026-09-31', '31 de setembro'],
    ['2026-02-30', '30 de fevereiro'],
    ['2027-02-29', '29 de fevereiro fora de bissexto'],
  ])('%s (%s) não vira outra data', (iso) => {
    expect(partesDaDataCritica(iso)).toBeNull();
    expect(formatarDataCritica(iso)).toBeNull();
    expect(instanteLimite(iso)).toBeNull();
  });

  it('hora impossível também é recusada', () => {
    expect(partesDaDataCritica('2026-09-15T25:00')).toBeNull();
    expect(partesDaDataCritica('2026-09-15T10:99')).toBeNull();
  });

  it('29 de fevereiro em ano bissexto continua valendo', () => {
    expect(partesDaDataCritica('2028-02-29')?.dia).toBe('2028-02-29');
  });
});

describe('o dia impresso é o dia gravado', () => {
  // O prompt de extração manda usar T00:00:00Z quando não há hora, então o
  // caso sem hora é o COMUM. `new Date(iso).toLocaleDateString()` sem timeZone
  // recuava um dia em qualquer fuso a oeste de Greenwich.
  it('meia-noite UTC não recua para o dia anterior', () => {
    expect(formatarDataCritica('2026-09-15T00:00:00Z', 'numerico')).toBe('15/09/2026');
  });

  it('00:00 é "não sei a hora", e não aparece na tela', () => {
    expect(partesDaDataCritica('2026-09-15T00:00:00Z')?.hora).toBeNull();
    expect(formatarDataCritica('2026-09-15T00:00:00Z', 'numerico')).not.toContain('00:00');
  });

  it('hora de verdade viaja junto', () => {
    expect(formatarDataCritica('2026-09-15T14:30:00', 'numerico')).toBe('15/09/2026 · 14:30');
  });

  it('sem data, sem invenção', () => {
    for (const v of [null, undefined, '', 'amanhã', '15/09/2026']) {
      expect(formatarDataCritica(v as string)).toBeNull();
    }
  });
});

describe('prazo sem hora vence no FIM do dia', () => {
  it('às 15h do próprio dia ainda não expirou', () => {
    expect(dataCriticaExpirada('2026-09-15T00:00:00Z', AGORA)).toBe(false);
  });

  it('no dia seguinte, expirou', () => {
    expect(dataCriticaExpirada('2026-09-14T00:00:00Z', AGORA)).toBe(true);
  });

  it('com hora escrita, é ela que manda — e é hora de Brasília', () => {
    // 14:00 BRT = 17:00 UTC; agora é 18:00 UTC.
    expect(dataCriticaExpirada('2026-09-15T14:00', AGORA)).toBe(true);
    // 16:00 BRT = 19:00 UTC; ainda falta uma hora.
    expect(dataCriticaExpirada('2026-09-15T16:00', AGORA)).toBe(false);
  });

  it('data ilegível nunca declara edital encerrado', () => {
    expect(dataCriticaExpirada('2026-13-15', AGORA)).toBe(false);
    expect(dataCriticaExpirada(null, AGORA)).toBe(false);
  });
});

describe('urgência recomputada, não lida do registro', () => {
  // `urgente` era gravado pelo backend no instante da análise: um laudo feito
  // com 20 dias de antecedência guardava `false` para sempre, e a véspera da
  // sessão aparecia com pino cinza.
  it('a véspera é urgente', () => {
    expect(dataCriticaUrgente('2026-09-16T00:00:00Z', AGORA)).toBe(true);
  });

  it('quatro semanas à frente não é', () => {
    expect(dataCriticaUrgente('2026-10-30T00:00:00Z', AGORA)).toBe(false);
  });

  it('o que já venceu não é urgente — é passado', () => {
    expect(dataCriticaUrgente('2026-09-01T00:00:00Z', AGORA)).toBe(false);
    expect(diasUteisAteDataCritica('2026-09-01T00:00:00Z', AGORA)).toBe(-1);
  });
});

describe('dias úteis: a mesma contagem do backend', () => {
  // Espelha `_dias_uteis_ate` em analysis_quality.py — exclui hoje, inclui o
  // dia-alvo se for útil, teto de 30. Os dois lados precisam concordar porque
  // é o backend que escreve os ajustes de score com essa janela.
  it.each([
    ['2026-09-16', 1],   // quarta
    ['2026-09-18', 3],   // sexta
    ['2026-09-19', 3],   // sábado: não conta
    ['2026-09-20', 3],   // domingo: idem
    ['2026-09-21', 4],   // segunda
  ])('de terça 15/09 até %s → %i dias úteis', (iso, esperado) => {
    expect(diasUteisAteDataCritica(`${iso}T00:00:00Z`, AGORA)).toBe(esperado);
  });
});

describe('vence hoje', () => {
  it('é o dia de calendário de Brasília, não do navegador', () => {
    expect(venceHoje('2026-09-15T00:00:00Z', AGORA)).toBe(true);
    expect(venceHoje('2026-09-16T00:00:00Z', AGORA)).toBe(false);
  });

  it('⚠️ não é derivável de "0 dias úteis": um sábado amanhã também dá 0', () => {
    const sexta = new Date('2026-09-18T18:00:00Z');
    expect(diasUteisAteDataCritica('2026-09-19T00:00:00Z', sexta)).toBe(0);
    expect(venceHoje('2026-09-19T00:00:00Z', sexta)).toBe(false);
  });

  it('o que já expirou não vence hoje', () => {
    expect(venceHoje('2026-09-15T09:00', AGORA)).toBe(false);
  });
});

describe('prazo de propostas encerrado (o banner "Edital encerrado")', () => {
  // O caso real (Itabira, Pregão Eletrônico 63/2026): janela de 21/09 a 02/10,
  // olhada no dia 24/09. A régua antiga acendia "EDITAL ENCERRADO · A Início do
  // Recebimento das Propostas ocorreu em 21 de setembro".
  const DIA_24 = new Date('2026-09-24T15:00:00Z'); // 12h em Brasília
  const ITABIRA = [
    { label: 'Início do Recebimento das Propostas', data_iso: '2026-09-21T08:00:00Z' },
    { label: 'Fim do Recebimento das Propostas', data_iso: '2026-10-02T08:00:00Z' },
    { label: 'Abertura da Sessão Pública', data_iso: '2026-10-02T08:30:00Z' },
  ];

  it('início da janela no passado NÃO encerra (o defeito medido)', () => {
    expect(prazoDePropostasEncerrado({ datas_criticas: ITABIRA }, DIA_24)).toBeNull();
    expect(prazoDePropostasEncerrado({ datas_criticas: [ITABIRA[0]] }, DIA_24)).toBeNull();
  });

  it('acento e caixa não mudam o marco', () => {
    const r = prazoDePropostasEncerrado(
      { datas_criticas: [{ label: 'INICIO DO RECEBIMENTO', data_iso: '2026-09-21T08:00:00Z' }] }, DIA_24);
    expect(r).toBeNull();
  });

  it('encerra só depois do ÚLTIMO marco de fim, e cita esse marco', () => {
    const depois = new Date('2026-10-02T11:01:00Z'); // 08:01 em Brasília
    const r = prazoDePropostasEncerrado({ datas_criticas: ITABIRA }, depois);
    expect(r).toBeNull(); // a sessão (08:30) ainda não aconteceu: marco futuro mantém vivo
    const r2 = prazoDePropostasEncerrado({ datas_criticas: ITABIRA }, new Date('2026-10-02T12:00:00Z'));
    expect(r2?.label).toBe('Abertura da Sessão Pública');
    expect(r2?.fonte).toBe('edital');
  });

  it('fica com a data MAIS TARDIA entre os marcos de fim', () => {
    const r = prazoDePropostasEncerrado({
      datas_criticas: [
        { label: 'Data limite para envio das propostas', data_iso: '2026-09-10T09:00:00Z' },
        { label: 'Sessão pública', data_iso: '2026-09-12T09:00:00Z' },
      ],
    }, DIA_24);
    expect(r?.label).toBe('Sessão pública');
  });

  it('um marco de fim no futuro basta para o edital seguir vivo', () => {
    expect(prazoDePropostasEncerrado({
      datas_criticas: [
        { label: 'Data limite para envio das propostas', data_iso: '2026-09-10T09:00:00Z' },
        { label: 'Sessão pública (remarcada)', data_iso: '2026-09-30T09:00:00Z' },
      ],
    }, DIA_24)).toBeNull();
  });

  it('prazo de outra coisa não encerra (impugnação, entrega, validade…)', () => {
    for (const label of [
      'Prazo para impugnação', 'Data limite para esclarecimentos', 'Prazo de entrega dos produtos',
      'Prazo de validade da proposta', 'Prazo para recurso', 'Visita técnica até',
    ]) {
      expect(prazoDePropostasEncerrado({ datas_criticas: [{ label, data_iso: '2026-09-10T00:00:00Z' }] }, DIA_24))
        .toBeNull();
    }
  });

  it('"entrega das propostas" é prazo de proposta', () => {
    const r = prazoDePropostasEncerrado(
      { datas_criticas: [{ label: 'Prazo de entrega das propostas', data_iso: '2026-09-10T09:00:00Z' }] }, DIA_24);
    expect(r?.label).toBe('Prazo de entrega das propostas');
  });

  it('"início da sessão pública" acontece DEPOIS do prazo — é marco de fim', () => {
    const r = prazoDePropostasEncerrado(
      { datas_criticas: [{ label: 'Início da sessão pública', data_iso: '2026-09-10T09:00:00Z' }] }, DIA_24);
    expect(r?.label).toBe('Início da sessão pública');
  });

  it('data OFICIAL do PNCP decide sozinha — aberta, o cronograma da IA não encerra', () => {
    const r = prazoDePropostasEncerrado({
      pncp_prazo_propostas: { fim: '2026-10-02T08:00:00' },
      datas_criticas: [{ label: 'Fim do Recebimento das Propostas', data_iso: '2026-09-10T08:00:00Z' }],
    }, DIA_24);
    expect(r).toBeNull();
  });

  it('data OFICIAL vencida encerra, com a fonte dita', () => {
    const r = prazoDePropostasEncerrado({ pncp_prazo_propostas: { fim: '2026-09-10T08:00:00' } }, DIA_24);
    expect(r).toEqual({ label: 'Fim do recebimento de propostas', data_iso: '2026-09-10T08:00:00', fonte: 'pncp' });
  });

  it('data oficial ilegível cai no cronograma', () => {
    const r = prazoDePropostasEncerrado({
      pncp_prazo_propostas: { fim: 'a apurar' },
      datas_criticas: [{ label: 'Sessão pública', data_iso: '2026-09-10T09:00:00Z' }],
    }, DIA_24);
    expect(r?.fonte).toBe('edital');
  });

  it('sem data nenhuma não afirma encerramento', () => {
    expect(prazoDePropostasEncerrado({}, DIA_24)).toBeNull();
    expect(prazoDePropostasEncerrado(null, DIA_24)).toBeNull();
    expect(prazoDePropostasEncerrado({ datas_criticas: [{ label: 'Sessão pública', data_iso: null }] }, DIA_24))
      .toBeNull();
  });
});
