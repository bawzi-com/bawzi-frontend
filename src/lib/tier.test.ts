/**
 * O tier efetivo: o número que decide o que a interface mostra.
 *
 * ⚠️ ELE VEM EM PARTE DO `localStorage`, QUE O USUÁRIO ESCREVE E QUE SOBREVIVE
 * A VERSÕES DO APP. Um valor antigo, truncado ou embaralhado basta — não
 * precisa de má-fé. E o pior caso não é um tier alto demais (o backend
 * recusa): é `NaN`, que faz TODA comparação de gate ser falsa. `tier >= 3` é
 * false e `tier < 3` também: a interface não entra no ramo pago nem no
 * gratuito, e sim num estado que ninguém escreveu.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { getCachedTier, resolveEffectiveTier, TIER_MAXIMO } from './tier';

function guardar(valor: string | null) {
  const loja: Record<string, string> = {};
  if (valor !== null) loja['bawzi_tier'] = valor;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in loja ? loja[k] : null),
    setItem: () => {},
    removeItem: () => {},
  };
  (globalThis as { window?: unknown }).window = globalThis;
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
  delete (globalThis as { window?: unknown }).window;
});

describe('cache local que não parece um plano é ignorado', () => {
  it.each([
    ['abc',       'vira NaN, e NaN reprova em todo gate nos DOIS sentidos'],
    ['Infinity',  'libera a interface inteira'],
    ['1e3',       '1000 não é um plano'],
    ['4.5',       'tier não é fracionário'],
    ['-2',        'negativo'],
    ['0',         'abaixo do gratuito'],
    ['99',        'acima do maior plano que existe'],
    ['',          'vazio'],
    [null,        'ausente'],
  ])('%s (%s) não contamina o tier', (guardado: string | null, _porque: string) => {
    guardar(guardado);
    const t = getCachedTier(2);
    expect(Number.isInteger(t)).toBe(true);
    expect(t).toBe(2);
  });

  it('cache legítimo mais alto que a prop vence — é para isso que ele existe', () => {
    guardar('4');
    expect(getCachedTier(1)).toBe(4);
  });

  it('cache legítimo mais baixo não rebaixa a prop', () => {
    guardar('2');
    expect(getCachedTier(3)).toBe(3);
  });

  it('nunca ultrapassa o maior plano que existe', () => {
    guardar(String(TIER_MAXIMO));
    expect(getCachedTier(1)).toBe(TIER_MAXIMO);
  });

  it('prop absurda também é ignorada', () => {
    guardar(null);
    expect(getCachedTier(NaN)).toBe(1);
    expect(getCachedTier(999)).toBe(1);
  });

  it('armazenamento bloqueado não derruba a renderização', () => {
    // Janela privativa e políticas de site fazem o ACESSOR estourar, não
    // devolver null. Um throw aqui quebraria a tela inteira.
    (globalThis as { window?: unknown }).window = globalThis;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('SecurityError'); },
    });
    expect(getCachedTier(3)).toBe(3);
  });
});

describe('tier efetivo entre usuário e workspace', () => {
  it.each([
    [1, 4, 4],
    [4, 1, 4],
    [undefined, 3, 3],
    [2, undefined, 2],
    [undefined, undefined, 1],
  ])('user=%s workspace=%s → %i', (u, w, esperado) => {
    expect(resolveEffectiveTier(u, w)).toBe(esperado);
  });

  it('valor impossível de qualquer lado não vaza', () => {
    expect(resolveEffectiveTier(NaN, 2)).toBe(2);
    expect(resolveEffectiveTier(2, Infinity)).toBe(2);
    expect(resolveEffectiveTier(99, 1)).toBe(1);
  });
});
