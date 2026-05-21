'use client';

import React, { useState, useCallback, useEffect } from 'react';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
interface ContratoVencendo {
  numeroControlePNCP?: string;
  objeto: string;
  data_vigencia_fim?: string;
  data_vigencia_ini?: string;
  dias_restantes?: number | null;
  is_oportunidade?: boolean;
  metadados?: {
    orgao_nome?: string;
    uf?: string;
    fornecedor_nome?: string;
    fornecedor_cnpj?: string;
    modalidade?: string;
  };
  valores?: {
    global?: number;
    inicial?: number;
    acumulado?: number;
  };
}

interface ContratosVencendoProps {
  token: string;
  companies?: Array<{ razao_social?: string; cnpj?: string; cnae_descricao?: string; cnae_principal?: string }>;
  defaultUf?: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

/**
 * Extrai palavras-chave de busca a partir da descrição do CNAE.
 * Remove o "burocratês" dos prefixos de ação e qualificadores após vírgula,
 * ficando apenas com os substantivos core do segmento.
 * Ex: "Atividades de consultoria em gestão empresarial, exceto..." → "consultoria gestão"
 */
const CNAE_PREFIXOS = /^(atividades?\s+de|com[eé]rcio\s+(varejista|atacadista)\s+de|fabrica[çc][aã]o\s+de|servi[çc]os?\s+de|presta[çc][aã]o\s+de\s+servi[çc]os?\s+de|manuten[çc][aã]o\s+(e\s+)?repar[aã][çc][aã]o\s+de|instala[çc][aã]o\s+de|transporte\s+(rodovi[aá]rio\s+)?de|aluguel\s+de|loca[çc][aã]o\s+de|desenvolvimento\s+de|gest[aã]o\s+de|fornecimento\s+de|produ[çc][aã]o\s+de|apoio\s+[aà]|suporte\s+[aà]|execu[çc][aã]o\s+de|elabora[çc][aã]o\s+de|constru[çc][aã]o\s+de|capta[çc][aã]o\s+de)\s+/i;

const CNAE_STOPWORDS = new Set([
  'de','da','do','das','dos','em','na','no','nas','nos','a','o','as','os',
  'e','ou','que','para','com','por','sem','sob','sobre','ser','ter','ao',
  'aos','pelo','pela','pelos','pelas','um','uma','uns','umas','esse','essa',
  'este','esta','seu','sua','seus','suas','outro','outros','outra','outras',
]);

function derivarKeywordsCnae(descricao: string): string {
  // Remove prefixo de ação boilerplate
  let limpo = descricao.trim().replace(CNAE_PREFIXOS, '');
  // Remove qualificadores após vírgula ou parênteses
  limpo = limpo.split(',')[0].split('(')[0].trim();
  // Filtra stopwords e palavras muito curtas
  const palavras = limpo
    .split(/\s+/)
    .map(w => w.replace(/[^a-záéíóúâêôãõüçàèìòùA-ZÁÉÍÓÚÂÊÔÃÕÜÇÀÈÌÒÙ]/g, '').toLowerCase())
    .filter(w => w.length >= 4 && !CNAE_STOPWORDS.has(w));
  // Retorna as 2–3 palavras mais representativas
  return palavras.slice(0, 3).join(' ');
}

function formatarValor(v?: number): string {
  if (!v || v <= 0) return '—';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toFixed(2)}`;
}

function formatarData(iso?: string): string {
  if (!iso) return '—';
  try {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

function getValorContrato(c: ContratoVencendo): number {
  const v = c.valores || {};
  return v.global || v.acumulado || v.inicial || 0;
}

/** Paleta de urgência baseada em dias_restantes */
function urgencia(dias?: number | null): {
  border: string; badge: string; badgeText: string; dot: string; label: string;
} {
  if (dias === undefined || dias === null)
    return { border: 'border-slate-200', badge: 'bg-slate-100 text-slate-500', badgeText: 'text-slate-500', dot: 'bg-slate-300', label: 'Indefinido' };
  if (dias < 0)
    return { border: 'border-slate-300', badge: 'bg-slate-400 text-white', badgeText: 'text-slate-400', dot: 'bg-slate-300', label: 'VENCIDO' };
  if (dias === 0)
    return { border: 'border-red-500', badge: 'bg-red-600 text-white', badgeText: 'text-red-600', dot: 'bg-red-500', label: 'HOJE' };
  if (dias <= 15)
    return { border: 'border-red-400', badge: 'bg-red-500 text-white', badgeText: 'text-red-600', dot: 'bg-red-500', label: 'CRÍTICO' };
  if (dias <= 30)
    return { border: 'border-orange-400', badge: 'bg-orange-500 text-white', badgeText: 'text-orange-600', dot: 'bg-orange-500', label: 'URGENTE' };
  if (dias <= 60)
    return { border: 'border-amber-400', badge: 'bg-amber-400 text-white', badgeText: 'text-amber-600', dot: 'bg-amber-400', label: 'ATENÇÃO' };
  if (dias <= 90)
    return { border: 'border-emerald-300', badge: 'bg-emerald-500 text-white', badgeText: 'text-emerald-600', dot: 'bg-emerald-400', label: 'RADAR' };
  return { border: 'border-sky-300', badge: 'bg-sky-500 text-white', badgeText: 'text-sky-600', dot: 'bg-sky-400', label: 'PIPELINE' };
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────
export default function ContratosVencendo({ token, companies = [], defaultUf }: ContratosVencendoProps) {
  const primeiraEmpresa = companies[0];

  // Keyword inicial — SOMENTE do CNAE se já disponível; vazio caso contrário
  const initialTermo = (() => {
    if (!primeiraEmpresa?.cnae_descricao) return '';
    const kw = derivarKeywordsCnae(primeiraEmpresa.cnae_descricao);
    return kw.length >= 2 ? kw : '';
  })();

  const [termo, setTermo]             = useState(initialTermo);
  const [termoEditado, setTermoEditado] = useState(false); // evita sobrescrever edição manual

  // Metadados CNAE para exibir hint ao utilizador
  const [cnaeDescricao, setCnaeDescricao] = useState(primeiraEmpresa?.cnae_descricao || '');
  const [cnaeCodigo, setCnaeCodigo]       = useState(primeiraEmpresa?.cnae_principal || '');
  const [cnaeLoading, setCnaeLoading]     = useState(false);

  // UF selector = filtro manual; homeUf = UF da empresa (para flag, não filtra)
  const homeUf = (defaultUf || '').toUpperCase();
  const [uf, setUf]       = useState(''); // default: Brasil todo
  const [dias, setDias]   = useState<30 | 60 | 90 | 180>(90);
  const [loading, setLoading]           = useState(false);
  const [contratos, setContratos]       = useState<ContratoVencendo[]>([]);
  const [buscado, setBuscado]           = useState(false);
  const [erro, setErro]                 = useState('');
  const [fallbackNacional, setFallback] = useState(false);
  const [ufSolicitada, setUfSolicitada] = useState('');

  // ── Auto-fetch CNAE para empresas sem cnae_descricao já salvo ──────────────
  useEffect(() => {
    if (!primeiraEmpresa?.cnpj || primeiraEmpresa.cnae_descricao || !token) return;

    const cnpjLimpo = primeiraEmpresa.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;

    setCnaeLoading(true);
    fetch(`${API_URL}/api/company/search/${cnpjLimpo}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return;
        const desc = data.cnae_descricao || '';
        const cod  = data.cnae_principal  || '';
        if (desc) {
          setCnaeDescricao(desc);
          setCnaeCodigo(cod);
          // Preenche o campo só se o utilizador ainda não digitou nada
          if (!termoEditado) {
            const kw = derivarKeywordsCnae(desc);
            if (kw.length >= 2) setTermo(kw);
          }
        }
      })
      .catch(() => {})
      .finally(() => setCnaeLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscar = useCallback(async () => {
    if (!termo.trim() || termo.trim().length < 2) return;
    setLoading(true);
    setErro('');
    setBuscado(true);

    try {
      const params = new URLSearchParams({ q: termo.trim(), dias: String(dias) });
      if (uf && uf !== 'BR') params.set('uf', uf);
      if (homeUf) params.set('home_uf', homeUf);

      const res = await fetch(`${API_URL}/api/pncp/contratos-vencendo?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Erro ao consultar o servidor.');
      const data = await res.json();
      setContratos(data.data || []);
      setFallback(!!data.fallback_nacional);
      setUfSolicitada(data.uf_solicitada || '');
    } catch (e: any) {
      setErro(e.message || 'Erro de ligação.');
      setContratos([]);
    } finally {
      setLoading(false);
    }
  }, [termo, uf, dias, token]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buscar();
  };

  // ─────────────────────────────────────────────────────────────────
  const DIAS_OPTS: Array<30 | 60 | 90 | 180> = [30, 60, 90, 180];

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-8 pt-8 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-lg shadow-sm shadow-orange-200/60 shrink-0">
            🔔
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 leading-tight">Radar de Renovações</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Contratos do seu segmento prestes a vencer — futuras oportunidades de edital
            </p>
          </div>
        </div>

        {/* Seletor de janela */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0">
          {DIAS_OPTS.map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                dias === d
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {d === 180 ? '6M' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Barra de busca ── */}
      <div className="px-8 py-5 flex flex-col sm:flex-row gap-3 border-b border-slate-100 bg-slate-50/50">
        {/* Termo */}
        <div className="flex-1 relative flex flex-col gap-1">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🏷️</span>
            <input
              type="text"
              value={termo}
              onChange={(e) => { setTermo(e.target.value); setTermoEditado(true); }}
              onKeyDown={handleKeyDown}
              placeholder={cnaeLoading ? 'Identificando segmento...' : 'Ex: limpeza, TI, manutenção predial...'}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder:font-normal placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
            />
          </div>
          {/* Hint CNAE */}
          {(cnaeLoading || cnaeDescricao) && (
            <p className="text-[10px] font-medium text-slate-400 ml-1 flex items-center gap-1">
              {cnaeLoading ? (
                <><span className="animate-pulse">⏳</span> A identificar CNAE da empresa...</>
              ) : (
                <><span>🏭</span>
                  {cnaeCodigo && <span className="font-black text-slate-500">CNAE {cnaeCodigo}:</span>}
                  <span className="truncate max-w-[320px]">{cnaeDescricao}</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* UF */}
        <select
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          className="w-28 px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all cursor-pointer"
        >
          <option value="">Todos UFs</option>
          {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Botão buscar */}
        <button
          onClick={buscar}
          disabled={loading || termo.trim().length < 2}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-md shadow-orange-200/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
              A buscar...
            </span>
          ) : '🔍 Buscar'}
        </button>
      </div>

      {/* ── Resultados ── */}
      <div className="p-8">

        {/* Estado inicial */}
        {!buscado && !loading && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <span className="text-4xl">⏳</span>
            <p className="text-sm font-bold text-slate-600">
              {cnaeLoading
                ? 'A identificar o segmento da sua empresa...'
                : termo.trim().length >= 2
                  ? `Clique em Buscar para encontrar contratos de "${termo.trim()}" que vencem em até ${dias} dias`
                  : 'Insira o segmento da sua empresa para identificar oportunidades de renovação'}
            </p>
            <p className="text-[11px] text-slate-400 font-medium max-w-sm">
              Contratos públicos prestes a vencer sinalizam futuros editais de substituição — chegue na frente da concorrência.
            </p>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
            <span>⚠️</span> {erro}
          </div>
        )}

        {/* Sem resultados */}
        {buscado && !loading && !erro && contratos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <span className="text-4xl">🔎</span>
            <p className="text-sm font-bold text-slate-600">Nenhum contrato vencendo encontrado</p>
            <p className="text-[11px] text-slate-400 font-medium max-w-sm">
              Tente outro termo de busca, ampliar a janela de dias ou remover o filtro de UF.
            </p>
          </div>
        )}

        {/* Banner de fallback nacional */}
        {buscado && !loading && fallbackNacional && ufSolicitada && (
          <div className="flex items-start gap-3 mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-base shrink-0 mt-0.5">🌎</span>
            <div>
              <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-0.5">
                Sem contratos encontrados em {ufSolicitada}
              </p>
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                Não localizámos contratos do teu segmento com vencimento próximo em {ufSolicitada}.
                A exibir resultados de todo o Brasil — ampliar a janela de dias pode ajudar.
              </p>
            </div>
          </div>
        )}

        {/* Grid de contratos */}
        {contratos.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                {contratos.length} contrato{contratos.length !== 1 ? 's' : ''} · vencendo em até {dias} dias
              </p>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />≤15d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />≤30d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />≤60d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />≤90d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />≤6m</span>
              </div>
            </div>

            <div className="space-y-3">
              {contratos.map((c, i) => {
                const u = urgencia(c.dias_restantes);
                const valor = getValorContrato(c);
                const orgao = c.metadados?.orgao_nome || 'Órgão não identificado';
                const fornecedor = c.metadados?.fornecedor_nome;
                const ufContrato = c.metadados?.uf;
                const isOp = !!c.is_oportunidade;
                const pncpUrl = c.numeroControlePNCP
                  ? `https://pncp.gov.br/app/contratos/${c.numeroControlePNCP}`
                  : null;

                // Separador entre regionais e nacionais
                const anteriorFoiRegional = i > 0 && !!contratos[i - 1].is_oportunidade;
                const mostraSeparador = homeUf && !isOp && anteriorFoiRegional;

                return (
                  <React.Fragment key={i}>
                    {mostraSeparador && (
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Brasil · Outros estados</span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                    )}

                    <div className={`group relative rounded-2xl p-5 hover:shadow-md transition-all cursor-default border-l-4 ${u.border} ${
                      isOp
                        ? 'bg-gradient-to-r from-amber-50/60 to-white border border-amber-200/80 shadow-sm'
                        : 'bg-white border border-slate-100'
                    }`}>

                      {/* Flag de oportunidade */}
                      {isOp && (
                        <div className="absolute -top-2.5 left-4 flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm shadow-orange-200">
                          ⭐ Oportunidade · {homeUf}
                        </div>
                      )}

                      {/* Linha superior: órgão + badge dias */}
                      <div className={`flex items-start justify-between gap-3 mb-2 ${isOp ? 'mt-1' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${u.dot}`} />
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest truncate">
                            {orgao}
                            {ufContrato && <span className="ml-1.5 text-slate-400">· {ufContrato}</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg whitespace-nowrap ${u.badge}`}>
                            {c.dias_restantes == null
                              ? '?'
                              : c.dias_restantes < 0
                                ? 'VENCIDO'
                                : c.dias_restantes === 0
                                  ? 'HOJE'
                                  : `${c.dias_restantes}d`}
                          </span>
                        </div>
                      </div>

                      {/* Objeto */}
                      <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 mb-3">
                        {c.objeto || 'Objeto não especificado'}
                      </p>

                      {/* Linha inferior: metadados + ações */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="text-slate-300">💰</span>
                            <span className="font-bold text-slate-700">{formatarValor(valor)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-slate-300">📅</span>
                            <span className={u.badgeText + ' font-bold'}>{formatarData(c.data_vigencia_fim)}</span>
                          </span>
                          {fornecedor && (
                            <span className="flex items-center gap-1 max-w-[200px]">
                              <span className="text-slate-300">🏢</span>
                              <span className="truncate">{fornecedor}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {pncpUrl && (
                            <a
                              href={pncpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${
                                isOp
                                  ? 'bg-amber-50 border border-amber-200 hover:border-amber-400 hover:bg-amber-100 text-amber-700'
                                  : 'bg-slate-50 border border-slate-200 hover:border-slate-400 hover:bg-slate-100 text-slate-600'
                              }`}
                            >
                              Ver no PNCP ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
