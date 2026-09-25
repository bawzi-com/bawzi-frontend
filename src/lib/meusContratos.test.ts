import { describe, expect, it } from 'vitest';
import {
  estiloDaProrrogacaoPropria, faixaDeVencimentos, filtroParaPipeline, mesDaData, rotuloDoMes, valorCurto,
} from './meusContratos';

describe('estiloDaProrrogacaoPropria — o sinal lido por quem tem o contrato', () => {
  it('teto atingido é alerta, não oportunidade', () => {
    const e = estiloDaProrrogacaoPropria({ situacao: 'volta_a_licitacao', texto: 'lei', resumo: 'Em vigor desde 03/2016 (10 anos)' });
    expect(e?.tom).toBe('vermelho');
    expect(e?.rotulo).toBe('Teto legal atingido');
    expect(e?.texto).toMatch(/nova licitação/);
  });

  it('caso comum é verde e mostra desde quando', () => {
    const e = estiloDaProrrogacaoPropria({ situacao: 'pode_prorrogar', texto: 'lei', resumo: 'Em vigor desde 03/2024 (2 anos)' });
    expect(e).toEqual({ rotulo: 'Cabe prorrogação', tom: 'verde', texto: 'Em vigor desde 03/2024 (2 anos)' });
    expect(estiloDaProrrogacaoPropria({ situacao: 'pode_prorrogar', texto: 'lei' })?.texto).toBe('Ainda dentro do prazo da lei.');
  });

  it('limite da 8.666 e incerto são âmbar; desconhecido e vazio não ganham selo', () => {
    expect(estiloDaProrrogacaoPropria({ situacao: 'no_limite', texto: 'x' })?.tom).toBe('ambar');
    expect(estiloDaProrrogacaoPropria({ situacao: 'incerto', texto: 'x' })?.tom).toBe('ambar');
    expect(estiloDaProrrogacaoPropria({ situacao: 'outra', texto: 'x' })).toBeNull();
    expect(estiloDaProrrogacaoPropria({ situacao: 'pode_prorrogar', texto: '' })).toBeNull();
    expect(estiloDaProrrogacaoPropria(null)).toBeNull();
  });
});

describe('faixaDeVencimentos — quanto vence em cada mês', () => {
  const hoje = new Date(2026, 8, 25); // 25/09/2026

  it('12 meses a partir do mês corrente, com valor e quantidade', () => {
    const faixa = faixaDeVencimentos([
      { data_vigencia_fim: '2026-09-30', valor: 100, situacao: 'vencendo' },
      { data_vigencia_fim: '2026-11-15', valor: 250, situacao: 'vencendo' },
      { data_vigencia_fim: '2026-11-20', valor: 0, situacao: 'renovar' },
      // Sem valor legível, conta na quantidade e não envenena a soma.
      { data_vigencia_fim: '2026-11-21', valor: undefined as unknown as number, situacao: 'renovar' },
      { data_vigencia_fim: '2027-08-01', valor: 1000, situacao: 'vigente' },
      { data_vigencia_fim: '2027-09-01', valor: 5000, situacao: 'vigente' },   // 13º mês: fora
      { data_vigencia_fim: '2026-10-01', valor: 999, situacao: 'encerrado' },  // já acabou
      { data_vigencia_fim: null, valor: 999, situacao: 'sem_prazo' },
    ], hoje);
    expect(faixa).toHaveLength(12);
    expect(faixa[0]).toEqual({ chave: '2026-09', rotulo: 'set/26', valor: 100, quantidade: 1 });
    expect(faixa[2]).toEqual({ chave: '2026-11', rotulo: 'nov/26', valor: 250, quantidade: 3 });
    expect(faixa[11]).toEqual({ chave: '2027-08', rotulo: 'ago/27', valor: 1000, quantidade: 1 });
    expect(faixa.reduce((s, m) => s + m.quantidade, 0)).toBe(5);
  });

  it('vira o ano sem tropeçar', () => {
    const faixa = faixaDeVencimentos([], new Date(2026, 11, 3), 3);
    expect(faixa.map((m) => m.chave)).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(faixa.map((m) => m.rotulo)).toEqual(['dez/26', 'jan/27', 'fev/27']);
  });

  it('mês da data e rótulo', () => {
    expect(mesDaData('2026-10-05')).toBe('2026-10');
    expect(mesDaData('20261005')).toBeNull();
    expect(mesDaData(null)).toBeNull();
    expect(rotuloDoMes('2026-01')).toBe('jan/26');
  });

  it('valor curto para caber na barra', () => {
    expect(valorCurto(1_250_000)).toBe('R$ 1,3 mi');
    expect(valorCurto(850_000)).toBe('R$ 850 mil');
    expect(valorCurto(900)).toBe('R$ 900');
    expect(valorCurto(0)).toBe('—');
  });
});

describe('filtroParaPipeline — o atalho manda CNPJ quando tem', () => {
  it('CNPJ com máscara e o nome para o chip; sem CNPJ, o nome; sem nada, nada', () => {
    expect(filtroParaPipeline('orgao', 'MINISTÉRIO X', '01612092000123'))
      .toEqual({ campo: 'orgao', valor: '01.612.092/0001-23', nome: 'MINISTÉRIO X' });
    expect(filtroParaPipeline('fornecedor', 'STEFANINI', null))
      .toEqual({ campo: 'fornecedor', valor: 'STEFANINI', nome: 'STEFANINI' });
    expect(filtroParaPipeline('fornecedor', 'XPTO', '00000000000000')).toEqual({ campo: 'fornecedor', valor: 'XPTO', nome: 'XPTO' });
    expect(filtroParaPipeline('fornecedor', 'X', null)).toBeNull();
    expect(filtroParaPipeline('orgao', '', '')).toBeNull();
  });
});
