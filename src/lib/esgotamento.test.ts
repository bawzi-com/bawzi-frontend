import { describe, expect, it } from 'vitest';
import { analisesPausadas, avisoDeEsgotamento, pausaDoGratuito, tetoDoMotorSimples } from './esgotamento';

/* 28/09/2026: o Gratuito PARA quando saldo e cortesia acabam; o pago segue no
 * motor simples até um teto diário. A tela dizia "continua, sem limite" para
 * os dois — e o botão convidava a um clique que o servidor recusa. */

const gratuitoEsgotado = { para_ao_esgotar: true, limite_diario_motor_simples: null,
                           profunda_pausada: true, dias_para_reset: 12 };
const pagoEsgotado = { para_ao_esgotar: false, limite_diario_motor_simples: 30,
                       profunda_pausada: true, dias_para_reset: 1 };

describe('avisoDeEsgotamento', () => {
  it('no Gratuito diz que as análises PARAM, e o caminho para seguir', () => {
    const a = avisoDeEsgotamento(gratuitoEsgotado)!;
    expect(a.tom).toBe('pausado');
    expect(a.rotulo).toBe('⛔ Análises pausadas');
    expect(a.texto).toContain('No plano Gratuito as análises param aqui');
    expect(a.texto).toContain('adicione créditos ou escolha um plano');
    expect(a.texto).toContain('aguarde 12 dias até a renovação');
    expect(a.texto).not.toContain('continuam');
  });

  it('no pago diz que segue no motor simples, com o teto do dia', () => {
    const a = avisoDeEsgotamento(pagoEsgotado)!;
    expect(a.tom).toBe('motor');
    expect(a.texto).toContain('continuam funcionando, agora no motor gratuito e sem auditoria profunda, até 30 por dia.');
    expect(a.texto).toContain('aguarde 1 dia até a renovação');
  });

  it('antes de esgotar a cortesia não há aviso', () => {
    expect(avisoDeEsgotamento({ ...pagoEsgotado, profunda_pausada: false })).toBeNull();
    expect(avisoDeEsgotamento(null)).toBeNull();
  });

  it('servidor antigo, sem o teto: não inventa número', () => {
    const a = avisoDeEsgotamento({ profunda_pausada: true, dias_para_reset: 3 })!;
    expect(a.tom).toBe('motor');
    expect(a.texto).not.toContain('por dia');
  });
});

describe('analisesPausadas', () => {
  it('Gratuito: pausa quando o período OU o pedido passam da cortesia', () => {
    expect(analisesPausadas(gratuitoEsgotado, false)).toBe(true);
    expect(analisesPausadas({ ...gratuitoEsgotado, profunda_pausada: false }, true)).toBe(true);
    expect(analisesPausadas({ ...gratuitoEsgotado, profunda_pausada: false }, false)).toBe(false);
  });

  it('pago nunca pausa por saldo: vai para o motor simples', () => {
    expect(analisesPausadas(pagoEsgotado, true)).toBe(false);
    expect(analisesPausadas(undefined, true)).toBe(false);
  });
});

describe('tetoDoMotorSimples e pausaDoGratuito', () => {
  it('o teto só aparece quando o servidor manda', () => {
    expect(tetoDoMotorSimples(pagoEsgotado)).toBe(', até 30 por dia');
    expect(tetoDoMotorSimples(gratuitoEsgotado)).toBe('');
  });

  it('a frase da carteira só existe para o Gratuito pausado', () => {
    expect(pausaDoGratuito(gratuitoEsgotado)).toContain('as análises estão pausadas');
    expect(pausaDoGratuito(pagoEsgotado)).toBeNull();
    expect(pausaDoGratuito({ ...gratuitoEsgotado, profunda_pausada: false })).toBeNull();
  });
});
