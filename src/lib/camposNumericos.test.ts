import { describe, it, expect } from 'vitest';
import { inteiroOuPadrao, precoOuAtual } from '@/lib/camposNumericos';

/* Estas duas funções são a única coisa entre um campo de formulário e a
 * configuração de plano de todos os clientes. O defeito que elas corrigem
 * dispara com o gesto mais banal da tela: selecionar o conteúdo do campo e
 * apertar Backspace para redigitar.
 */

describe('inteiroOuPadrao', () => {
  it('campo esvaziado volta ao valor atual, não a zero', () => {
    // `parseInt("") || 0` gravava 0 — e `monthly_limit: 0` significa
    // ILIMITADO em toda a plataforma.
    expect(inteiroOuPadrao('', 90, 0)).toBe(90);
    expect(inteiroOuPadrao('   ', 400_000, 1000)).toBe(400_000);
    expect(inteiroOuPadrao('abc', 15, 1)).toBe(15);
  });

  it('zero explícito respeita o piso do campo', () => {
    // Em `monthly_limit` o piso é 0, porque lá zero é configuração legítima
    // e documentada na tela ("0 = ilimitado").
    expect(inteiroOuPadrao('0', 90, 0)).toBe(0);
    // Em `max_chars` e `max_mb`, zero deixaria o plano inutilizável.
    expect(inteiroOuPadrao('0', 400_000, 1000)).toBe(1000);
    expect(inteiroOuPadrao('0', 15, 1)).toBe(1);
  });

  it('valores normais passam intactos', () => {
    expect(inteiroOuPadrao('150', 90, 0)).toBe(150);
    expect(inteiroOuPadrao('400000', 120_000, 1000)).toBe(400_000);
  });

  it('negativo não desce abaixo do piso', () => {
    expect(inteiroOuPadrao('-50', 90, 0)).toBe(0);
  });
});

describe('precoOuAtual', () => {
  it('célula esvaziada mantém o preço, não grava US$ 0,00', () => {
    // `Number("")` é 0, e o `??` não cobre string vazia. Com preço zero, a
    // calculadora da tela passava a mostrar margem 100% para aquele modelo —
    // e é sobre esse número que ela sugere a cota do plano.
    expect(precoOuAtual('', 5)).toBe(5);
    expect(precoOuAtual(undefined, 5)).toBe(5);
    expect(precoOuAtual('abc', 5)).toBe(5);
  });

  it('aceita a vírgula decimal brasileira', () => {
    // `parseFloat("1,15")` é 1 — o mesmo truncamento silencioso que fazia o
    // `cortesia_fator` perder a margem de cortesia inteira.
    expect(precoOuAtual('1,15', 5)).toBe(1.15);
    expect(precoOuAtual('1.15', 5)).toBe(1.15);
  });

  it('zero digitado de propósito é aceito, negativo não', () => {
    expect(precoOuAtual('0', 5)).toBe(0);
    expect(precoOuAtual('-3', 5)).toBe(5);
  });
});
