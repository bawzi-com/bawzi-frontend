import type { Empresa } from '@/lib/types';

export const ACTIVE_CONTEXT_STORAGE_KEY = 'bawzi_active_cnpj';
export const ACTIVE_CONTEXT_EVENT = 'bawzi_context_update';

export interface ActiveContextEventDetail {
  active_cnpj: string;
}

export function normalizeCnpj(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

export function getCompanyCnpj(company?: Empresa | null): string {
  return normalizeCnpj(company?.cnpj as string | undefined);
}

export function getCompanyDisplayName(company?: Empresa | null): string {
  return (
    String(company?.nome_fantasia || company?.razao_social || company?.nome || '').trim()
    || 'Nenhuma empresa ativa'
  );
}

export function getStoredActiveCnpj(): string {
  if (typeof window === 'undefined') return '';
  return normalizeCnpj(window.localStorage.getItem(ACTIVE_CONTEXT_STORAGE_KEY));
}

export function getPreferredActiveCnpj(companies: Empresa[] = [], preferredCnpj?: string | null): string {
  const validCnpjs = companies.map(getCompanyCnpj).filter(Boolean);
  const preferred = normalizeCnpj(preferredCnpj);
  const stored = getStoredActiveCnpj();

  if (preferred && validCnpjs.includes(preferred)) return preferred;
  if (stored && validCnpjs.includes(stored)) return stored;
  return validCnpjs[0] || '';
}

export function resolveActiveCompany(companies: Empresa[] = [], activeCnpj?: string | null): Empresa | null {
  const selected = getPreferredActiveCnpj(companies, activeCnpj);
  return companies.find(company => getCompanyCnpj(company) === selected) || companies[0] || null;
}

export function orderCompaniesByActive(companies: Empresa[] = [], activeCnpj?: string | null): Empresa[] {
  const selected = getPreferredActiveCnpj(companies, activeCnpj);
  if (!selected) return companies;

  return [...companies].sort((a, b) => {
    const aActive = getCompanyCnpj(a) === selected ? 0 : 1;
    const bActive = getCompanyCnpj(b) === selected ? 0 : 1;
    return aActive - bActive;
  });
}

export function setActiveCompanyContext(cnpj: string, emit = true): string {
  const normalized = normalizeCnpj(cnpj);
  if (!normalized || typeof window === 'undefined') return normalized;

  window.localStorage.setItem(ACTIVE_CONTEXT_STORAGE_KEY, normalized);

  if (emit) {
    window.dispatchEvent(
      new CustomEvent<ActiveContextEventDetail>(ACTIVE_CONTEXT_EVENT, {
        detail: { active_cnpj: normalized },
      }),
    );
  }

  return normalized;
}
