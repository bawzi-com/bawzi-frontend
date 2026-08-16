'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Landmark, X } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
 * FILTRO DE ÓRGÃO COMPRADOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * POR QUE ISTO É UM CAMPO PRÓPRIO, E NÃO TEXTO NO CAMPO DE BUSCA
 * ──────────────────────────────────────────────────────────────
 * O cabeçalho do Radar dizia "pesquise por segmento, ÓRGÃO, cidade ou
 * palavra-chave", e o campo único não fazia isso — fazia o contrário. Digitar
 * "Prefeitura Municipal de Goiânia" ali passava por duas moagens no backend:
 * o otimizador cortava o termo em três palavras (virava "Prefeitura Municipal
 * de", que casa com todas as prefeituras do país e com nenhuma em particular)
 * e o filtro semântico julgava cada resultado contra o OBJETO do edital, onde
 * nome de órgão nunca aparece — derrubando, calado, justamente os certos.
 *
 * A raiz não era o ajuste: era a pergunta. "Quem compra" e "o que se compra"
 * são duas perguntas, e num input só a plataforma tinha que adivinhar qual
 * delas o usuário quis. Separar os campos elimina a adivinhação e, de brinde,
 * permite pedir as duas ao mesmo tempo — "medicamentos NA Prefeitura de
 * Goiânia" —, que era impossível antes.
 *
 * ACEITA NOME **OU** CNPJ, de propósito. CNPJ é identidade: bateu, acabou, sem
 * ambiguidade entre homônimos. Nome é como as pessoas realmente pensam. Exigir
 * CNPJ empurraria o usuário a já ter achado o edital antes de poder buscá-lo.
 *
 * ⚠️ AS SUGESTÕES SÃO OPCIONAIS E PODEM VIR VAZIAS. Não existe tabela oficial
 * de órgãos no projeto (municípios têm `municipios_pncp`; órgãos, não) — a
 * lista sai dos contratos já indexados. Por isso o campo NUNCA bloqueia o que
 * foi digitado: sem sugestão, o texto livre vale do mesmo jeito. Autocomplete
 * que vira obrigação transforma base incompleta em funcionalidade quebrada.
 */

interface OrgaoOption {
  orgao_nome: string;
  orgao_cnpj: string;
  uf: string;
  contratos: number;
}

interface OrgaoAutocompleteProps {
  /** Texto atual do filtro (nome ou CNPJ) */
  value: string;
  /** Confirma um valor — por seleção na lista, Enter ou blur */
  onCommit: (valor: string) => void;
  onClear: () => void;
  /** UF ativa — restringe as sugestões, mas não o que pode ser digitado */
  uf?: string;
  apiUrl: string;
  className?: string;
  placeholder?: string;
}

const soDigitos = (s: string) => s.replace(/\D/g, '');
const ehCnpj = (s: string) => soDigitos(s).length === 14;

const formatarCnpj = (s: string) => {
  const d = soDigitos(s);
  if (d.length !== 14) return s;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

export default function OrgaoAutocomplete({
  value,
  onCommit,
  onClear,
  uf,
  apiUrl,
  className = '',
  placeholder = 'Órgão ou CNPJ (opcional)',
}: OrgaoAutocompleteProps) {
  const [query, setQuery]   = useState(value);
  const [opcoes, setOpcoes] = useState<OrgaoOption[]>([]);
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Guarda o último valor JÁ confirmado, para o blur não redisparar a mesma
  // busca. Sem isto, clicar fora do campo depois de buscar dispara uma segunda
  // requisição idêntica ao PNCP — que é justamente quem tem WAF agressivo.
  const confirmadoRef = useRef(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Só espelha limpeza vinda do pai. Espelhar QUALQUER mudança sobrescreveria o
  // que o usuário está digitando quando o pai re-renderiza.
  useEffect(() => {
    if (!value) {
      setQuery('');
      setOpcoes([]);
      confirmadoRef.current = '';
    }
  }, [value]);

  const buscarSugestoes = useCallback(async (q: string) => {
    // CNPJ não tem o que sugerir — é identidade, e o usuário já a tem na mão.
    if (q.length < 2 || ehCnpj(q)) { setOpcoes([]); setAberto(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: '8' });
      if (uf) params.set('uf', uf);
      const res = await fetch(`${apiUrl}/api/pncp/orgaos?${params}`);
      if (!res.ok) { setOpcoes([]); return; }
      const data: OrgaoOption[] = await res.json();
      setOpcoes(data);
      setAberto(data.length > 0);
    } catch {
      // Sugestão é conveniência. Falhar aqui não pode impedir a busca pelo
      // texto digitado — que é o caminho que sempre funciona.
      setOpcoes([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, uf]);

  const confirmar = (valor: string) => {
    const v = valor.trim();
    if (v === confirmadoRef.current) return;
    confirmadoRef.current = v;
    if (v) onCommit(v); else onClear();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarSugestoes(val), 280);
  };

  const handleSelect = (op: OrgaoOption) => {
    // Manda o CNPJ quando existe: nome é aproximação, CNPJ é identidade — e
    // aqui nós temos os dois, então não há motivo para usar o pior.
    const enviado = op.orgao_cnpj || op.orgao_nome;
    setQuery(op.orgao_nome);
    setAberto(false);
    setOpcoes([]);
    confirmadoRef.current = enviado;
    onCommit(enviado);
  };

  const handleClear = () => {
    setQuery('');
    setOpcoes([]);
    setAberto(false);
    confirmadoRef.current = '';
    onClear();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center h-full">
        <Landmark
          className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none shrink-0"
          strokeWidth={2}
        />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (opcoes.length > 0) setAberto(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Impede o submit do form: o Enter aqui confirma o ÓRGÃO, e o
              // `confirmar` já dispara a busca pelo callback do pai. Sem isto,
              // saem duas buscas — uma sem o filtro e outra com.
              e.preventDefault();
              setAberto(false);
              confirmar(query);
            }
            if (e.key === 'Escape') { setAberto(false); }
          }}
          onBlur={() => confirmar(query)}
          placeholder={loading ? 'Buscando órgãos...' : placeholder}
          className="block w-full h-full pl-9 pr-8 bg-transparent border-none text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:ring-0 sm:text-sm"
          autoComplete="off"
          aria-label="Filtrar por órgão comprador — nome ou CNPJ"
        />
        {loading && (
          <span className="absolute right-3 pointer-events-none">
            <svg className="w-3.5 h-3.5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
          </span>
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
            aria-label="Limpar filtro de órgão"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {aberto && opcoes.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {opcoes.map((op) => (
            <button
              key={op.orgao_cnpj || op.orgao_nome}
              type="button"
              onClick={() => handleSelect(op)}
              className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 transition-colors border-b border-slate-50 last:border-0"
            >
              <span className="block text-xs font-bold text-slate-700 leading-snug">
                {op.orgao_nome}
              </span>
              <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                {op.uf ? `${op.uf} · ` : ''}
                {op.orgao_cnpj ? `${formatarCnpj(op.orgao_cnpj)} · ` : ''}
                {op.contratos} contrato{op.contratos === 1 ? '' : 's'} na base
              </span>
            </button>
          ))}
          {/* O usuário precisa saber que a lista descreve o que JÁ foi indexado,
              não o universo do PNCP — senão a ausência de um órgão vira
              "a Bawzi não cobre esse órgão", que é falso. */}
          <p className="bg-slate-50 px-3 py-2 text-[10px] font-medium leading-snug text-slate-400">
            Sugestões vindas dos contratos já indexados. Não achou? Digite o
            nome ou o CNPJ mesmo assim — a busca vai ao PNCP.
          </p>
        </div>
      )}
    </div>
  );
}
