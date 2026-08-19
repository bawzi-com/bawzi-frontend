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
  /** ⚠️ VARIANTE PRÓPRIA, E NÃO UM `compact` MAIS APERTADO.
   *
   *  `compact` já significa "cartão com fonte menor", e três telas dependem
   *  disso — a coluna do menu, o perfil e o cartão de usuário, onde o cartão é
   *  a forma certa porque o controle vive sozinho num bloco.
   *
   *  O que faltava era outra coisa: o controle DENTRO DE UMA FRASE. Em
   *  "Buscando para ___", o cartão entrava com borda, `p-3`, um rótulo em caixa
   *  alta repetindo o que a frase já dizia e 220px de largura mínima — três
   *  linhas de moldura para trocar um nome. `inline` devolve só o nome com um
   *  chevron, do tamanho do texto ao redor. */
  inline?: boolean;
  className?: string;
  onChange?: (cnpj: string, company: Empresa | null) => void;
}

export default function ActiveContextSwitcher({
  companies,
  activeCnpj,
  label = 'Contexto ativo',
  compact = false,
  inline = false,
  className = '',
  onChange,
}: ActiveContextSwitcherProps) {
  const companyList = useMemo(
    () => (companies || []).filter(
      (company: any) => !!getCompanyCnpj(company) && !company.suspended && !company.disabled,
    ),
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

  // ── Variante em linha: o controle é o próprio nome ───────────────────────
  // Sem moldura e sem rótulo visível — o rótulo vira `aria-label` e `title`,
  // porque quem lê com leitor de tela ainda precisa saber o que este seletor
  // troca, mesmo que a frase ao redor já diga para quem enxerga.
  if (inline) {
    if (!canSwitch) {
      return (
        <strong className={`font-black text-slate-800 ${className}`}>
          {getCompanyDisplayName(activeCompany)}
        </strong>
      );
    }
    return (
      <span className={`relative inline-flex max-w-full items-center ${className}`}>
        <select
          value={selectedCnpj}
          onChange={(event) => handleChange(event.target.value)}
          aria-label={label}
          title={label}
          /* `truncate` num <select>: razão social de empresa passa fácil de 50
             caracteres ("STEFANINI CONSULTORIA E ASSESSORIA EM INFORMATICA
             S.A."). Cortada com reticências ela cabe na frase, e o nome
             inteiro aparece assim que a lista abre. */
          className="max-w-[15rem] cursor-pointer truncate sm:max-w-[18rem] appearance-none rounded-full border border-slate-200 bg-white py-1 pl-2.5 pr-7 text-[13px] font-black text-slate-800 outline-none transition-colors hover:border-emerald-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
        >
          {companyList.map((company) => (
            <option key={getCompanyCnpj(company)} value={getCompanyCnpj(company)}>
              {getCompanyDisplayName(company)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </span>
    );
  }

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
