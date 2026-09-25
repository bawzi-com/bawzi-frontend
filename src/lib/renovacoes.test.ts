import { describe, expect, it } from 'vitest';
import {
  avisoFiltrosIgnorados, avisoNaoConferidos, contarFiltros, dicaSemResultado, estiloDaProrrogacao,
  FILTROS_VAZIOS, filtrosIgnorados, formatarDocumento, MAX_TERMOS, parametrosDaBusca, podeBuscar, promptDeRenovacao, rotuloDoFiltro,
  separarTermos, valorParaFiltrar,
} from './renovacoes';

describe('separarTermos', () => {
  it('um termo por vírgula ou ponto e vírgula, sem espaço sobrando', () => {
    expect(separarTermos(' desenvolvimento de software,  sistema de informação ; fábrica de software '))
      .toEqual(['desenvolvimento de software', 'sistema de informação', 'fábrica de software']);
  });

  it('não repete o mesmo termo com outra grafia', () => {
    expect(separarTermos('Informática, informatica, INFORMÁTICA')).toEqual(['Informática']);
  });

  it('descarta vazio e letra solta, e para no teto do servidor', () => {
    expect(separarTermos(', , a, ti')).toEqual(['ti']);
    const muitos = Array.from({ length: 10 }, (_, i) => `termo ${i}`).join(', ');
    expect(separarTermos(muitos)).toHaveLength(MAX_TERMOS);
    expect(separarTermos(null)).toEqual([]);
  });
});

describe('estiloDaProrrogacao', () => {
  it('voltar a licitação é a oportunidade: verde', () => {
    expect(estiloDaProrrogacao({ situacao: 'volta_a_licitacao', texto: 'x', resumo: 'r' })).toEqual(
      { rotulo: 'Tende a voltar a licitação', tom: 'verde', texto: 'x' });
  });

  it('o caso comum é neutro, mostra só o resumo, e sem texto não há selo', () => {
    expect(estiloDaProrrogacao({ situacao: 'pode_prorrogar', texto: 'x' })?.tom).toBe('neutro');
    expect(estiloDaProrrogacao({ situacao: 'pode_prorrogar', texto: 'lei inteira', resumo: 'Em vigor desde 03/2024 (2 anos)' })?.texto)
      .toBe('Em vigor desde 03/2024 (2 anos)');
    expect(estiloDaProrrogacao({ situacao: 'pode_prorrogar', texto: '' })).toBeNull();
    expect(estiloDaProrrogacao(null)).toBeNull();
  });

  it('situação que a tela não conhece não ganha rótulo inventado', () => {
    expect(estiloDaProrrogacao({ situacao: 'nova', texto: 'x' })).toBeNull();
  });
});

// Filtros de órgão e fornecedor (25/09/2026).
describe('filtros de órgão e fornecedor', () => {
  it('com órgão ou fornecedor, o termo é opcional; espaço em branco não conta', () => {
    expect(podeBuscar('', FILTROS_VAZIOS)).toBe(false);
    expect(podeBuscar('', { orgao: 'Prefeitura de Goiânia', fornecedor: '' })).toBe(true);
    expect(podeBuscar('  ', { orgao: '', fornecedor: ' x ' })).toBe(false);
    expect(podeBuscar('limpeza', FILTROS_VAZIOS)).toBe(true);
    expect(contarFiltros({ orgao: 'UFG', fornecedor: 'Stefanini' })).toBe(2);
  });

  it('documento com máscara: CNPJ e CPF; o resto como veio', () => {
    expect(formatarDocumento('01612092000123')).toBe('01.612.092/0001-23');
    expect(formatarDocumento('12345678909')).toBe('123.456.789-09');
    expect(formatarDocumento('Prefeitura')).toBe('Prefeitura');
  });

  it('o clique no cartão filtra pelo documento quando há um, senão pelo nome', () => {
    expect(valorParaFiltrar('orgao', 'PREFEITURA X', '01612092000123')).toBe('01.612.092/0001-23');
    expect(valorParaFiltrar('orgao', 'PREFEITURA X', null)).toBe('PREFEITURA X');
    // Órgão não tem CPF; fornecedor pode ser pessoa física.
    expect(valorParaFiltrar('orgao', 'PREFEITURA X', '12345678909')).toBe('PREFEITURA X');
    expect(valorParaFiltrar('fornecedor', 'FULANO', '12345678909')).toBe('123.456.789-09');
    // Carimbo de zeros não é documento de ninguém.
    expect(valorParaFiltrar('fornecedor', 'FULANO', '00000000000000')).toBe('FULANO');
  });

  it('o chip mostra o documento com máscara e o nome de quem foi clicado', () => {
    expect(rotuloDoFiltro({ tipo: 'documento', valor: '01612092000123' }, 'PREFEITURA X'))
      .toBe('PREFEITURA X · 01.612.092/0001-23');
    expect(rotuloDoFiltro({ tipo: 'documento', valor: '01612092000123' })).toBe('01.612.092/0001-23');
    expect(rotuloDoFiltro({ tipo: 'nome', valor: 'Prefeitura de Goiânia' })).toBe('Prefeitura de Goiânia');
    expect(rotuloDoFiltro(null)).toBeNull();
  });

  it('filtro mandado e não aplicado pelo servidor vira aviso, no singular e no plural', () => {
    const enviados = { orgao: 'de', fornecedor: 'Ltda' };
    expect(filtrosIgnorados(enviados, { orgao: null, fornecedor: null })).toEqual(['orgao', 'fornecedor']);
    expect(filtrosIgnorados(enviados, null)).toEqual([]);
    expect(filtrosIgnorados({ orgao: 'UFG', fornecedor: '' }, { orgao: { tipo: 'nome', valor: 'UFG' } })).toEqual([]);
    expect(avisoFiltrosIgnorados(['orgao'])).toMatch(/^O filtro de órgão não foi aplicado/);
    expect(avisoFiltrosIgnorados(['orgao', 'fornecedor'])).toMatch(/^Os filtros de órgão e de fornecedor não foram aplicados/);
    expect(avisoFiltrosIgnorados([])).toBeNull();
  });

  it('diz quantos contratos saíram sem o fornecedor conferido', () => {
    expect(avisoNaoConferidos(0)).toBeNull();
    expect(avisoNaoConferidos(1)).toMatch(/^1 contrato achado no PNCP ficou de fora/);
    expect(avisoNaoConferidos(12)).toMatch(/^12 contratos achados no PNCP ficaram de fora/);
  });

  it('a busca manda órgão e fornecedor preenchidos, e nenhum termo vazio', () => {
    const p = parametrosDaBusca({ termos: [], dias: 90, uf: 'GO', homeUf: 'GO',
      filtros: { orgao: ' Prefeitura de Goiânia ', fornecedor: ' ' } });
    expect(p.get('orgao')).toBe('Prefeitura de Goiânia');
    expect(p.has('fornecedor')).toBe(false);
    expect(p.getAll('termos')).toEqual([]);
    expect(p.get('uf')).toBe('GO');
    const q = parametrosDaBusca({ termos: ['a b', 'c d'], dias: 30, uf: 'BR',
      filtros: { orgao: '', fornecedor: '58.069.360/0001-20' } });
    expect(q.getAll('termos')).toEqual(['a b', 'c d']);
    expect(q.has('uf')).toBe(false);
    expect(q.has('orgao')).toBe(false);
    expect(q.get('fornecedor')).toBe('58.069.360/0001-20');
  });

  it('a dica da busca vazia fala do filtro quando há filtro', () => {
    expect(dicaSemResultado(true, true)).toMatch(/Apague o termo/);
    expect(dicaSemResultado(false, true)).toMatch(/confira o nome ou o CNPJ/);
    expect(dicaSemResultado(true, false)).toMatch(/outro termo/);
  });
});

describe('promptDeRenovacao — o mesmo prompt para o Pipeline e para Meus contratos', () => {
  it('leva o contrato vigente, o edital e o histórico, com os vazios ditos', () => {
    const p = promptDeRenovacao({
      diasRestantes: 45, fimVigencia: '30/11/2026', orgao: 'MINISTÉRIO X', uf: 'DF',
      fornecedor: 'STEFANINI', fornecedorCnpj: '58069360000120', objeto: 'Sustentação de sistemas',
      valor: 'R$ 1.2M', valorMensal: 'R$ 100K', inicioVigencia: '01/12/2025', duracaoMeses: 12,
      assinatura: '20/11/2025', teveAditivo: true, textoDoEdital: 'TEXTO DO EDITAL', historicoPrecos: 'HISTÓRICO',
    });
    expect(p).toContain('vence em 45 dia(s)');
    expect(p).toContain('• Órgão: MINISTÉRIO X (DF)');
    expect(p).toContain('• Fornecedor atual (incumbente): STEFANINI — CNPJ 58069360000120');
    expect(p).toContain('• Valor do contrato: R$ 1.2M (~R$ 100K/mês)');
    expect(p).toContain('• Vigência: 01/12/2025 → 30/11/2026 (12 meses)');
    expect(p).toContain('ADITIVADO');
    expect(p).toContain('TEXTO DO EDITAL');
    expect(p).toContain('HISTÓRICO');
    const vazio = promptDeRenovacao({ fimVigencia: '—', valor: '—', historicoPrecos: 'x' });
    expect(vazio).toContain('vence em ? dia(s)');
    expect(vazio).toContain('Fornecedor atual (incumbente): Não identificado');
    expect(vazio).toContain('Detalhes não fornecidos pela API.');
    expect(vazio).not.toContain('ADITIVADO');
  });
});
