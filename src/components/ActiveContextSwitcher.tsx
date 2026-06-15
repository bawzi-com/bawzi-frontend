'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import type { Empresa } from '@/lib/types';
import {
  getCompanyCnpj,
  getCompanyDisplayName,
  getPreferredActiveCnpj,
  resolveActiveCompany,
  setActiveCompanyContext,
} from '@/lib/activeContext';

interface ActiveContextSwitcherProps {
  companies?: Empresa[] | null;
  activeCnpj?: string | null;
  label?: string;
  compact?: boolean;
  className?: string;
  onChange?: (cnpj: string, company: Empresa | null) => void;
}

export default function ActiveContextSwitcher({
  companies,
  activeCnpj,
  label = 'Contexto ativo',
  compact = false,
  className = '',
  onChange,
}: ActiveContextSwitcherProps) {
  const companyList = useMemo(
    () => (companies || []).filter(company => !!getCompanyCnpj(company)),
    [companies],
  );
  const [selectedCnpj, setSelectedCnpj] = useState(() => getPreferredActiveCnpj(companyList, activeCnpj));

  useEffect(() => {
    setSelectedCnpj(getPreferredActiveCnpj(companyList, activeCnpj));
  }, [activeCnpj, companyList]);

  const activeCompany = resolveActiveCompany(companyList, selectedCnpj);
  const canSwitch = companyList.length > 1;

  const handleChange = (cnpj: string) => {
    const normalized = setActiveCompanyContext(cnpj);
    const company = resolveActiveCompany(companyList, normalized);
    setSelectedCnpj(normalized);
    onChange?.(normalized, company);
  };

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${className}`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        <Activity size={13} />
        {label}
      </div>

      {canSwitch ? (
        <div className="relative mt-2">
          <select
            value={selectedCnpj}
            onChange={(event) => handleChange(event.target.value)}
            aria-label="Alterar contexto ativo"
            className={[
              'w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 font-black text-slate-800 shadow-sm outline-none transition-all',
              'focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10',
              compact ? 'text-xs' : 'text-sm',
            ].join(' ')}
          >
            {companyList.map((company) => (
              <option key={getCompanyCnpj(company)} value={getCompanyCnpj(company)}>
                {getCompanyDisplayName(company)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      ) : (
        <p className={`mt-2 truncate font-black text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>
          {getCompanyDisplayName(activeCompany)}
        </p>
      )}
    </div>
  );
}
