import { describe, expect, it } from 'vitest';
import {
  MAX_DIGITOS, centavos, creditosDoValor, doCampo, mascararValor, paraOCampo, rotuloDoValor, valorCobrado,
} from './pacoteDeCreditos';

/* O crédito avulso a R$ 4,90 (26/09/2026): a conta em centavos. */

describe('lib/pacoteDeCreditos', () => {
  it('múltiplos exatos do preço dão os créditos exatos (o float perdia um)', () => {
    expect(245 / 4.9).toBeLessThan(50);                     // a armadilha, registrada
    expect(creditosDoValor(245, 4.9)).toBe(50);
    expect(creditosDoValor(490, 4.9)).toBe(100);
    expect(creditosDoValor(122.5, 4.9)).toBe(25);
    expect(creditosDoValor(14.7, 4.9)).toBe(3);
    expect(creditosDoValor(24.5, 4.9)).toBe(5);
  });

  it('o que não fecha arredonda para baixo, e só isso é cobrado', () => {
    expect(creditosDoValor(50, 4.9)).toBe(10);
    expect(valorCobrado(50, 4.9)).toBe(49);
    expect(valorCobrado(100, 4.9)).toBe(98);
    expect(valorCobrado(4.89, 4.9)).toBe(0);
    expect(valorCobrado(245, 4.9)).toBe(245);
    expect(valorCobrado(250, 4.9)).toBeCloseTo(249.9, 10);
  });

  it('sem preço ou sem valor, nada', () => {
    expect(creditosDoValor(100, 0)).toBe(0);
    expect(creditosDoValor(0, 4.9)).toBe(0);
    expect(creditosDoValor(-49, 4.9)).toBe(0);
    expect(centavos(4.9)).toBe(490);
  });

  it('o campo em pt-BR, sempre com as duas casas, ida e volta', () => {
    expect(paraOCampo(98)).toBe('98,00');
    expect(paraOCampo(24.5)).toBe('24,50');
    expect(paraOCampo(1225)).toBe('1.225,00');
    expect(paraOCampo(1234.5)).toBe('1.234,50');
    expect(rotuloDoValor(49)).toBe('49');
    expect(rotuloDoValor(1225)).toBe('1.225');
    expect(rotuloDoValor(122.5)).toBe('122,50');
    for (const v of [98, 24.5, 1225, 1234.5, 4.9]) expect(doCampo(paraOCampo(v))).toBe(v);
    expect(doCampo('R$ 50')).toBe(50);
    expect(doCampo('abc')).toBe(0);
  });

  it('a máscara: só dígitos, e os dois últimos são os centavos', () => {
    // O exemplo do Marcelo: digitado = 2500, valor = 25,00.
    expect(mascararValor('2500')).toBe('25,00');
    // Digitando um a um, como o campo recebe:
    expect(mascararValor('2')).toBe('0,02');
    expect(mascararValor('0,025')).toBe('0,25');
    expect(mascararValor('0,250')).toBe('2,50');
    expect(mascararValor('2,500')).toBe('25,00');
    expect(mascararValor('25,001')).toBe('250,01');
    expect(mascararValor('250,015')).toBe('2.500,15');
    // Apagando: cada backspace tira o último dígito, e no fim o campo esvazia.
    expect(mascararValor('25,0')).toBe('2,50');
    expect(mascararValor('0,0')).toBe('');
    expect(mascararValor('')).toBe('');
    expect(mascararValor('0')).toBe('');
    // Colando: o que não é dígito cai fora.
    expect(mascararValor('R$ 1.234,56')).toBe('1.234,56');
    expect(mascararValor('abc')).toBe('');
    expect(mascararValor('000123')).toBe('1,23');
    // O teto do campo: o décimo dígito não entra.
    expect(mascararValor('1'.repeat(MAX_DIGITOS + 1))).toBe(mascararValor('1'.repeat(MAX_DIGITOS)));
    expect(mascararValor('999999999')).toBe('9.999.999,99');
    // E o que a máscara produz é o que a conta lê.
    expect(doCampo(mascararValor('2500'))).toBe(25);
    expect(doCampo(mascararValor('123456'))).toBe(1234.56);
  });
});
