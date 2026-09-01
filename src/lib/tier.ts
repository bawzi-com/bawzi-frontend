/** O maior tier que este produto tem. Acima disto o valor não é um plano —
 *  é lixo, e tratá-lo como número liberaria a interface inteira. */
export const TIER_MAXIMO = 4;

/** Um número que pode ser um plano: inteiro finito dentro da faixa.
 *
 *  ⚠️ `Number(localStorage.getItem('bawzi_tier') || 1)` NÃO ERA ISSO.
 *  `localStorage` é escrito pelo usuário e sobrevive a versões do app — um
 *  valor antigo, truncado ou embaralhado basta. Medido em node:
 *
 *      'abc'       → NaN
 *      'Infinity'  → Infinity
 *      '1e3'       → 1000
 *
 *  `NaN` é o pior dos três, e é o único que acontece sem má-fé: `Math.max(1,
 *  NaN)` é `NaN`, e a partir daí TODA comparação de gate é falsa —
 *  `tier >= 3` é false, `tier < 3` também. A interface não cai no ramo pago
 *  nem no gratuito; entra num estado que ninguém escreveu. */
function tierPlausivel(bruto: unknown): number | null {
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < 1 || n > TIER_MAXIMO) return null;
  return n;
}

/** Tier efetivo: maior valor entre a prop recebida e o cache local.
 *
 *  O cache é conveniência; a prop é a autoridade. Cache que não parece um
 *  plano é ignorado, nunca propagado. */
export function getCachedTier(userTier = 1): number {
  const base = tierPlausivel(userTier) ?? 1;
  if (typeof window === 'undefined') return base;
  let guardado: string | null = null;
  try {
    guardado = localStorage.getItem('bawzi_tier');
  } catch {
    // Navegador com armazenamento bloqueado (janela privativa, política do
    // site): o acessor ESTOURA, e um throw aqui derrubaria a renderização.
    return base;
  }
  return Math.max(base, tierPlausivel(guardado) ?? 1);
}

/**
 * Fonte única de verdade para calcular o tier efetivo de um usuário.
 * O tier mais alto entre user e workspace vence — mesma regra usada em todos
 * os componentes e no backend.
 */
export function resolveEffectiveTier(userTier: number | undefined, workspaceTier: number | undefined): number {
  return Math.max(tierPlausivel(userTier) ?? 1, tierPlausivel(workspaceTier) ?? 1);
}
