'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, X } from 'lucide-react';

interface MunicipioOption {
  municipio_id: string;
  municipio_nome: string;   // "Goiânia" — com acento, para exibição
  uf: string;
}

interface MunicipioAutocompleteProps {
  /** Valor selecionado (nome exibido) */
  value: string;
  /** Chamado quando o utilizador seleciona uma cidade */
  onSelect: (id: string, nome: string) => void;
  /** Chamado quando o utilizador limpa a seleção */
  onClear: () => void;
  /** UF ativa — filtra sugestões automaticamente */
  uf?: string;
  apiUrl: string;
  /** Estilos adicionais no container */
  className?: string;
  placeholder?: string;
  /** Classe do input (para adaptar ao estilo do componente pai) */
  inputClassName?: string;
  /** Estilo do dropdown — 'light' (padrão branco) ou 'slate' */
  variant?: 'light' | 'slate';
}

export default function MunicipioAutocomplete({
  value,
  onSelect,
  onClear,
  uf,
  apiUrl,
  className = '',
  placeholder = 'Cidade (opcional)',
  inputClassName,
  variant = 'light',
}: MunicipioAutocompleteProps) {
  const [query, setQuery]           = useState(value);
  const [opcoes, setOpcoes]         = useState<MunicipioOption[]>([]);
  const [aberto, setAberto]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [selecionado, setSelecionado] = useState(!!value);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sincroniza quando o pai limpa o valor
  useEffect(() => {
    if (!value) {
      setQuery('');
      setSelecionado(false);
      setOpcoes([]);
    }
  }, [value]);

  // Quando UF muda ou é removida, limpa seleção de cidade
  useEffect(() => {
    setQuery('');
    setSelecionado(false);
    setOpcoes([]);
    setAberto(false);
    onClear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uf]);

  const buscarSugestoes = useCallback(async (q: string) => {
    if (q.length < 2) { setOpcoes([]); setAberto(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: '8' });
      if (uf) params.set('uf', uf);
      const res = await fetch(`${apiUrl}/api/pncp/municipios?${params}`);
      if (!res.ok) { setOpcoes([]); return; }
      const data: MunicipioOption[] = await res.json();
      setOpcoes(data);
      setAberto(data.length > 0);
    } catch {
      setOpcoes([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, uf]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelecionado(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarSugestoes(val), 280);
  };

  const handleSelect = (op: MunicipioOption) => {
    setQuery(op.municipio_nome);
    setSelecionado(true);
    setAberto(false);
    setOpcoes([]);
    onSelect(op.municipio_id, op.municipio_nome);
  };

  const handleClear = () => {
    setQuery('');
    setSelecionado(false);
    setOpcoes([]);
    setAberto(false);
    onClear();
  };

  // ── Estilos adaptáveis ao variant ──
  const inputBase =
    variant === 'slate'
      ? 'w-full pl-9 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all placeholder:font-normal placeholder:text-slate-400'
      : 'block w-full h-full pl-9 pr-8 bg-transparent border-none text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:ring-0 sm:text-sm';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative flex items-center">
        <MapPin
          className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none shrink-0"
          strokeWidth={2}
        />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (opcoes.length > 0) setAberto(true); }}
          placeholder={loading ? 'Buscando...' : placeholder}
          className={inputClassName ?? inputBase}
          autoComplete="off"
        />
        {/* Ícone de loading ou limpar */}
        {loading && (
          <span className="absolute right-3 pointer-events-none">
            <svg className="w-3.5 h-3.5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          </span>
        )}
        {!loading && (selecionado || query) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
            aria-label="Limpar cidade"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Dropdown de sugestões */}
      {aberto && opcoes.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {opcoes.map((op) => (
            <button
              key={op.municipio_id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(op); }}
              className="w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 transition-colors flex items-center justify-between gap-2"
            >
              <span className="font-semibold text-slate-800">{op.municipio_nome}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">{op.uf}</span>
            </button>
          ))}
          {/* Dica: base cresce com o worker */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
            <p className="text-[9px] text-slate-400 font-medium">
              Base de cidades atualizada via PNCP · Não encontrou? Use só o filtro de UF.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
