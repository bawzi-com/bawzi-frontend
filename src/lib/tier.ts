/** Tier efetivo: maior valor entre a prop recebida e o cache local. */
export function getCachedTier(userTier = 1): number {
  if (typeof window === 'undefined') return userTier;
  return Math.max(userTier, Number(localStorage.getItem('bawzi_tier') || 1));
}
