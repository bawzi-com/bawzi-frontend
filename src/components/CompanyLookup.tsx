'use client';

import { useState } from 'react';
import { Building2, CheckCircle2, Globe2, Loader2, Search } from 'lucide-react';
import { API_URL } from '@/lib/apiClient';

export type CompanyLookupResult = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  website?: string;
  domain?: string;
  enquadramento?: string;
  porte?: string;
  capital_social?: string;
  cnae_principal?: string;
  cnae_descricao?: string;
  cnaes_secundarios?: { codigo: string; descricao: string }[];
  uf?: string;
  municipio?: string;
  source?: 'receita' | 'workspace' | 'domain' | string;
};

type CompanyLookupProps = {
  label?: string;
  helperText?: string;
  placeholder?: string;
  compact?: boolean;
  initialQuery?: string;
  selected?: CompanyLookupResult | null;
  onSelect: (company: CompanyLookupResult) => void | Promise<void>;
};

const resultName = (company: CompanyLookupResult) =>
  company.nome_fantasia || company.razao_social || company.domain || company.website || 'Empresa sugerida';

const sourceLabel = (source?: string) => {
  if (source === 'receita') return 'Receita Federal';
  if (source === 'workspace') return 'Base Bawzi';
  if (source === 'domain') return 'Domínio informado';
  return 'Sugestão';
};

export default function CompanyLookup({
  label = 'Buscar empresa',
  helperText = 'Busque por CNPJ, nome da empresa, site ou domínio corporativo.',
  placeholder = 'Ex.: 00.000.000/0001-00, Bawzi ou bawzi.com.br',
  compact = false,
  initialQuery = '',
  selected,
  onSelect,
}: CompanyLookupProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CompanyLookupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    const text = query.trim();
    if (text.length < 3) {
      setError('Digite ao menos 3 caracteres.');
      setResults([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/company/discover?query=${encodeURIComponent(text)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || 'Não foi possível buscar empresas agora.');
      setResults(Array.isArray(data?.results) ? data.results : []);
      if (!data?.results?.length) setError('Nenhuma empresa encontrada. Você ainda pode preencher manualmente.');
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar empresa.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const select = async (company: CompanyLookupResult) => {
    await onSelect(company);
    setQuery(resultName(company));
    setResults([]);
    setError('');
  };

  return (
    <div className={compact ? 'rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm' : 'rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4'}>
      <div className={compact ? 'mb-1' : 'mb-3'}>
        <div className="flex items-center gap-2">
          {compact && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Building2 size={14} />
            </span>
          )}
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</p>
        </div>
        {helperText && <p className={`${compact ? 'ml-8 mt-0.5' : 'mt-1'} text-xs font-medium leading-relaxed text-slate-500`}>{helperText}</p>}
      </div>

      <div className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
        <div className="relative min-w-0 flex-1">
          <Search size={compact ? 14 : 16} className={`${compact ? 'left-2.5' : 'left-3'} absolute top-1/2 -translate-y-1/2 text-slate-400`} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void search();
              }
            }}
            placeholder={placeholder}
            className={`${compact ? 'h-10 pl-8 pr-2 text-xs' : 'h-11 pl-9 pr-3 text-sm'} w-full rounded-lg border border-slate-200 bg-white font-bold text-slate-800 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10`}
          />
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          title={compact ? 'Buscar empresa' : undefined}
          aria-label={compact ? 'Buscar empresa' : undefined}
          className={`${compact ? 'h-10 w-10 text-slate-600 bg-white border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700' : 'h-11 px-4 text-[10px] text-white bg-slate-950 hover:bg-emerald-700'} inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-black uppercase tracking-widest transition-all disabled:opacity-60`}
        >
          {loading ? <Loader2 size={compact ? 14 : 15} className="animate-spin" /> : <Search size={compact ? 14 : 15} />}
          {!compact && <span className="hidden sm:inline">Buscar</span>}
        </button>
      </div>

      {selected && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span className="leading-relaxed">
            Empresa selecionada: {resultName(selected)}
            {selected.cnpj ? ` · CNPJ ${selected.cnpj}` : selected.domain ? ` · ${selected.domain}` : ''}
          </span>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-bold text-amber-700">{error}</p>}

      {results.length > 0 && (
        <div className="mt-3 grid gap-2">
          {results.map((company) => (
            <button
              type="button"
              key={`${company.cnpj || company.domain || resultName(company)}-${company.source || 'result'}`}
              onClick={() => void select(company)}
              className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                {company.domain && !company.cnpj ? <Globe2 size={17} /> : <Building2 size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-black text-slate-900">{resultName(company)}</p>
                <p className="mt-0.5 line-clamp-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {company.cnpj ? `CNPJ ${company.cnpj}` : company.domain || company.website || 'Sem CNPJ identificado'}
                </p>
                {(company.cnae_descricao || company.municipio || company.uf) && (
                  <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">
                    {[company.cnae_descricao, company.municipio, company.uf].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                {sourceLabel(company.source)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
