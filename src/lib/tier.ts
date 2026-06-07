/** Tier efetivo: maior valor entre a prop recebida e o cache local. */
export function getCachedTier(userTier = 1): number {
  if (typeof window === 'undefined') return userTier;
  return Math.max(userTier, Number(localStorage.getItem('bawzi_tier') || 1));
}

/**
 * Fonte única de verdade para calcular o tier efetivo de um usuário.
 * O tier mais alto entre user e workspace vence — mesma regra usada em todos
 * os componentes e no backend.
 */
export function resolveEffectiveTier(userTier: number | undefined, workspaceTier: number | undefined): number {
  return Math.max(userTier || 1, workspaceTier || 1);
}
