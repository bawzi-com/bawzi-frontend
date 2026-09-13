import { describe, expect, it } from 'vitest';
import { debitadoNaLeitura, precoAprofundar, precoProfundaCheio } from './aprofundar';

describe('precoAprofundar — régua fixa (por análise)', () => {
  it('Avançado: profunda 10, rápida debitou 1 → paga 9 (o caso medido em 13/09/2026)', () => {
    expect(precoAprofundar(1, 10, 'analises')).toEqual({ cheio: 10, pago: 1, diferenca: 9 });
  });

  it('Essencial e Profissional: 4 − 1 = 3, 7 − 1 = 6', () => {
    expect(precoAprofundar(1, 4, 'analises')).toEqual({ cheio: 4, pago: 1, diferenca: 3 });
    expect(precoAprofundar(1, 7, 'analises')).toEqual({ cheio: 7, pago: 1, diferenca: 6 });
  });

  it('rápida em cortesia (nada debitado): preço cheio, sem linha de abatimento', () => {
    expect(precoAprofundar(0, 10, 'analises')).toEqual({ cheio: 10, pago: null, diferenca: 10 });
    expect(precoAprofundar(null, 10, 'analises')).toEqual({ cheio: 10, pago: null, diferenca: 10 });
  });

  it('nunca abaixo de 1, como o portão', () => {
    expect(precoAprofundar(15, 10, 'analises').diferenca).toBe(1);
  });

  it('peso 1 (planos de entrada): uma linha só, 1 crédito', () => {
    expect(precoAprofundar(1, 1, 'analises')).toEqual({ cheio: 1, pago: null, diferenca: 1 });
  });

  it('sem peso ainda: sem preço — nunca "1" por falta de dado', () => {
    expect(precoAprofundar(1, null, 'analises')).toEqual({ cheio: null, pago: null, diferenca: null });
    expect(precoAprofundar(1, undefined, 'analises').diferenca).toBeNull();
    expect(precoAprofundar(1, 0, 'analises').diferenca).toBeNull();
  });
});

describe('precoAprofundar — régua por custo (inalterada)', () => {
  it('profunda = pago × peso; diferença = pago × (peso − 1)', () => {
    expect(precoAprofundar(2, 4, 'creditos')).toEqual({ cheio: 8, pago: 2, diferenca: 6 });
  });

  it('sem rápida paga ou sem peso: sem preço', () => {
    expect(precoAprofundar(null, 4, 'creditos')).toEqual({ cheio: null, pago: null, diferenca: null });
    expect(precoAprofundar(2, 1, 'creditos').diferenca).toBeNull();
  });
});

describe('debitadoNaLeitura — a cascata do backend', () => {
  it('o valor medido vence, e zero é zero', () => {
    expect(debitadoNaLeitura({ creditos_cobrados: 0, em_cortesia: false, creditos: 7 })).toBe(0);
    expect(debitadoNaLeitura({ creditos_cobrados: 1, creditos: 7 })).toBe(1);
  });

  it('em cortesia sem o campo medido: zero, não o preço do pedido', () => {
    expect(debitadoNaLeitura({ em_cortesia: true, creditos: 7 })).toBe(0);
  });

  it('laudo antigo: só `creditos`', () => {
    expect(debitadoNaLeitura({ creditos: 1 })).toBe(1);
  });

  it('nada gravado: desconhecido', () => {
    expect(debitadoNaLeitura({})).toBeNull();
  });
});

describe('precoProfundaCheio', () => {
  it('é o peso, mínimo 1, e null sem peso', () => {
    expect(precoProfundaCheio(10)).toBe(10);
    expect(precoProfundaCheio(0.5)).toBe(1);
    expect(precoProfundaCheio(null)).toBeNull();
    expect(precoProfundaCheio(NaN)).toBeNull();
  });
});
