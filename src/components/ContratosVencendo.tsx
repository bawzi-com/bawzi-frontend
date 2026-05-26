'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw, Tag, Search, Loader2, Building2, MapPin, Globe } from 'lucide-react';
import MunicipioAutocomplete from './MunicipioAutocomplete';

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
    municipio?: string;
    fornecedor_nome?: string;
    fornecedor_cnpj?: string;
    modalidade?: string;
    situacao?: string;
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
 * Converte o numeroControlePNCP para a URL pública do portal PNCP.
 *
 * Formato do NCP: {cnpj14}-{tipo}-{sequencial6}/{ano4}
 * Ex: "01409580000138-2-000737/2025"
 * URL portal:    https://pncp.gov.br/app/contratos/{cnpj}/{ano}/{seq_sem_zeros}
 * Ex: https://pncp.gov.br/app/contratos/01409580000138/2025/737
 */
function ncpParaUrl(ncp: string): string | null {
  if (!ncp) return null;
  // Aceita "CNPJ-TIPO-SEQ/ANO" ou "CNPJ-TIPO-SEQ-ANO"
  const m = ncp.match(/^(\d{14})-\d+-(\d+)[/-](\d{4})$/);
  if (!m) return null;
  const [, cnpj, seq, ano] = m;
  return `https://pncp.gov.br/app/contratos/${cnpj}/${ano}/${parseInt(seq, 10)}`;
}

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
  const [uf, setUf]                     = useState(''); // default: Brasil todo
  const [municipioId, setMunicipioId]   = useState('');
  const [municipioNome, setMunicipioNome] = useState('');
  const [dias, setDias]   = useState<30 | 60 | 90 | 180 | 365 | 730>(30);
  const [loading, setLoading]           = useState(false);
  const [contratos, setContratos]       = useState<ContratoVencendo[]>([]);
  const [buscado, setBuscado]           = useState(false);
  const [erro, setErro]                 = useState('');
  const [fallbackNacional, setFallback] = useState(false);
  const [ufSolicitada, setUfSolicitada] = useState('');
  const [municipioSolicitado, setMunicipioSolicitado] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Paginação client-side
  const PER_PAGE = 20;
  const [pagina, setPagina]             = useState(1);

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

  const cancelar = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const buscar = useCallback(async () => {
    if (!termo.trim() || termo.trim().length < 2) return;

    // Cancela qualquer busca anterior em curso
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErro('');
    setBuscado(true);

    try {
      const params = new URLSearchParams({ q: termo.trim(), dias: String(dias) });
      if (uf && uf !== 'BR') params.set('uf', uf);
      if (homeUf) params.set('home_uf', homeUf);
      if (municipioId) params.set('municipio_id', municipioId);

      const res = await fetch(`${API_URL}/api/pncp/contratos-vencendo?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Erro ao consultar o servidor.');
      const data = await res.json();
      setContratos(data.data || []);
      setFallback(!!data.fallback_nacional);
      setUfSolicitada(data.uf_solicitada || '');
      setMunicipioSolicitado(data.municipio_solicitado || '');
      setPagina(1);
    } catch (e: any) {
      if (e.name === 'AbortError') return; // cancelamento intencional — não mostra erro
      setErro(e.message || 'Erro de ligação.');
      setContratos([]);
    } finally {
      setLoading(false);
    }
  }, [termo, uf, municipioId, dias, token]);

  // Auto-busca quando a janela de dias muda — só se já houve uma busca prévia
  useEffect(() => {
    if (buscado && termo.trim().length >= 2) buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buscar();
  };

  // ─────────────────────────────────────────────────────────────────
  const DIAS_OPTS: Array<30 | 60 | 90 | 180 | 365 | 730> = [30, 60, 90, 180, 365, 730];

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 pt-7 pb-6">
        {/* Textura sutil */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }} />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/40">
              <RefreshCw size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight leading-tight">Radar de Renovações</h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Contratos do seu segmento prestes a vencer — futuras oportunidades de edital
              </p>
            </div>
          </div>

          {/* Seletor de janela */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
            {DIAS_OPTS.map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  dias === d
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {d === 730 ? '2A' : d === 365 ? '1A' : d === 180 ? '6M' : `${d}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Barra de busca ── */}
      <div className="px-6 py-4 flex flex-col sm:flex-row gap-2.5 border-b border-slate-100 bg-slate-50/60">
        {/* Termo */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="relative">
            <Tag size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={termo}
              onChange={(e) => { setTermo(e.target.value); setTermoEditado(true); }}
              onKeyDown={handleKeyDown}
              placeholder={cnaeLoading ? 'Identificando segmento...' : 'Ex: limpeza, TI, manutenção predial...'}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 placeholder:font-normal placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
            />
          </div>
          {/* Hint CNAE */}
          {(cnaeLoading || cnaeDescricao) && (
            <p className="text-[10px] font-medium text-slate-400 ml-1 flex items-center gap-1.5">
              {cnaeLoading ? (
                <><Loader2 size={10} className="animate-spin shrink-0" /> A identificar CNAE da empresa...</>
              ) : (
                <><Building2 size={10} className="shrink-0 text-slate-400" />
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
          onChange={(e) => {
            setUf(e.target.value);
            setMunicipioId('');
            setMunicipioNome('');
          }}
          className="w-28 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all cursor-pointer"
        >
          <option value="">Todos UFs</option>
          {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Cidade — só aparece após selecionar UF */}
        {uf && (
          <MunicipioAutocomplete
            value={municipioNome}
            uf={uf}
            apiUrl={API_URL}
            onSelect={(id, nome) => { setMunicipioId(id); setMunicipioNome(nome); }}
            onClear={() => { setMunicipioId(''); setMunicipioNome(''); }}
            placeholder="Filtrar por cidade..."
            className="w-44"
            inputClassName="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all placeholder:font-normal placeholder:text-slate-400"
            variant="slate"
          />
        )}

        {/* Botão buscar / cancelar */}
        {loading ? (
          <button
            onClick={cancelar}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98] whitespace-nowrap"
          >
            <Loader2 size={13} className="animate-spin" />
            Cancelar
          </button>
        ) : (
          <button
            onClick={buscar}
            disabled={termo.trim().length < 2}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-md shadow-orange-200/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] whitespace-nowrap"
          >
            <Search size={13} /> Buscar
          </button>
        )}
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

        {/* Sem resultados — com cidade selecionada */}
        {buscado && !loading && !erro && contratos.length === 0 && municipioSolicitado && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <span className="text-4xl">🏙️</span>
            <p className="text-sm font-bold text-slate-700">
              Nenhum contrato de &ldquo;{termo}&rdquo; vencendo em {municipioSolicitado}
            </p>
            <p className="text-[11px] text-slate-400 font-medium max-w-sm leading-relaxed">
              Não há contratos desse segmento com vencimento na janela selecionada para {municipioSolicitado}.
              Tente ampliar a janela de dias, remover o filtro de cidade ou buscar pelo estado.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => { setMunicipioId(''); setMunicipioNome(''); }}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-sky-700 bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition-all"
              >
                Ver {ufSolicitada || 'o estado'}
              </button>
              <button
                onClick={() => { setUf(''); setMunicipioId(''); setMunicipioNome(''); }}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all"
              >
                Ver todo o Brasil
              </button>
            </div>
          </div>
        )}

        {/* Sem resultados — com UF selecionada (sem cidade) */}
        {buscado && !loading && !erro && contratos.length === 0 && ufSolicitada && !municipioSolicitado && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <span className="text-4xl">📍</span>
            <p className="text-sm font-bold text-slate-700">
              Nenhum contrato de &ldquo;{termo}&rdquo; vencendo em {ufSolicitada}
            </p>
            <p className="text-[11px] text-slate-400 font-medium max-w-sm leading-relaxed">
              Não há contratos desse segmento com vencimento na janela selecionada para {ufSolicitada}.
              Tente ampliar a janela de dias ou remover o filtro de estado.
            </p>
            <button
              onClick={() => { setUf(''); setMunicipioId(''); setMunicipioNome(''); }}
              className="mt-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all"
            >
              Ver todo o Brasil
            </button>
          </div>
        )}

        {/* Sem resultados — sem UF */}
        {buscado && !loading && !erro && contratos.length === 0 && !ufSolicitada && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <span className="text-4xl">🔎</span>
            <p className="text-sm font-bold text-slate-600">Nenhum contrato vencendo encontrado</p>
            <p className="text-[11px] text-slate-400 font-medium max-w-sm">
              Tente outro termo de busca ou ampliar a janela de dias.
            </p>
          </div>
        )}

        {/* Grid de contratos */}
        {contratos.length > 0 && (() => {
          const totalPaginas = Math.ceil(contratos.length / PER_PAGE);
          const inicio = (pagina - 1) * PER_PAGE;
          const contratosPagina = contratos.slice(inicio, inicio + PER_PAGE);
          const paginaAntes = contratos.slice(0, inicio); // para calcular separadores

          return (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                {contratos.length} contrato{contratos.length !== 1 ? 's' : ''} · vencendo em até {dias === 730 ? '2 anos' : dias === 365 ? '1 ano' : dias === 180 ? '6 meses' : `${dias} dias`}
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
              {contratosPagina.map((c, i) => {
                const iGlobal = inicio + i; // índice no array completo
                const u = urgencia(c.dias_restantes);
                const valor = getValorContrato(c);
                const orgao = c.metadados?.orgao_nome || 'Órgão não identificado';
                const fornecedor = c.metadados?.fornecedor_nome;
                const ufContrato = c.metadados?.uf;
                const municipio  = c.metadados?.municipio;
                const fornecedorCnpj = c.metadados?.fornecedor_cnpj;
                const isOp = !!c.is_oportunidade;
                const pncpUrl = ncpParaUrl(c.numeroControlePNCP || '');

                // Separador entre regionais e nacionais
                // Separadores de grupo (estado → mesma região → outros)
                const anteriorGlobal   = iGlobal > 0 ? contratos[iGlobal - 1] : null;
                const isRegiao         = !!(c as any).is_regiao;
                const anteriorIsOp     = !!anteriorGlobal?.is_oportunidade;
                const anteriorIsRegiao = !!(anteriorGlobal as any)?.is_regiao;

                // Separador 1: saiu do estado, entrou na região
                const mostraSepRegiao  = isRegiao && anteriorIsOp && ufSolicitada;
                // Separador 2: saiu da região, entrou em outros (ou saiu do estado e sem região)
                const mostraSepOutros  = !isRegiao && !isOp && (anteriorIsOp || anteriorIsRegiao) && ufSolicitada;
                // Separador legado (home_uf sem filter_uf)
                const mostraSeparador  = !ufSolicitada && homeUf && !isOp && anteriorIsOp;

                return (
                  <React.Fragment key={i}>
                    {/* Separador: estado → mesma região */}
                    {mostraSepRegiao && (
                      <div className="flex items-center gap-3 py-1 mt-1">
                        <div className="flex-1 h-px bg-sky-100" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-sky-400 flex items-center gap-1">
                          🗺️ Mesma região
                        </span>
                        <div className="flex-1 h-px bg-sky-100" />
                      </div>
                    )}
                    {/* Separador: região → outros estados */}
                    {mostraSepOutros && (
                      <div className="flex items-center gap-3 py-1 mt-1">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Brasil · Outros estados</span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                    )}
                    {/* Separador legado (home_uf sem filter_uf) */}
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
                          ⭐ Oportunidade · {ufSolicitada || homeUf}
                        </div>
                      )}

                      {/* Linha superior: órgão + badge dias */}
                      <div className={`flex items-start justify-between gap-3 mb-2 ${isOp ? 'mt-1' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${u.dot}`} />
                          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest truncate">
                            {orgao}
                            {ufContrato && <span className="ml-1.5 text-slate-400">· {ufContrato}</span>}
                            {municipio && <span className="ml-1.5 text-slate-400 font-medium normal-case">/ {municipio}</span>}
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
                      <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 mb-2.5">
                        {c.objeto || 'Objeto não especificado'}
                      </p>

                      {/* Fornecedor atual */}
                      <div className={`flex items-center gap-2 mb-3 py-1.5 px-2.5 rounded-lg border ${
                        fornecedor
                          ? 'bg-amber-50/60 border-amber-100'
                          : 'bg-slate-50 border-slate-100'
                      }`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0 select-none">
                          🏆 Fornecedor atual
                        </span>
                        {fornecedor ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-bold text-slate-700 truncate">
                              {fornecedor}
                            </span>
                            {fornecedorCnpj && (
                              <span className="text-[9px] font-mono text-slate-400 shrink-0 hidden sm:inline">
                                {fornecedorCnpj}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Não identificado
                          </span>
                        )}
                      </div>

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

            {/* ── Paginação ── */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
                <button
                  onClick={() => { setPagina(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={pagina === 1}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ← Anterior
                </button>

                {/* Páginas numeradas */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPaginas }, (_, idx) => idx + 1)
                    .filter(p => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
                    .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === 'ellipsis' ? (
                        <span key={`e${idx}`} className="px-1 text-xs text-slate-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => { setPagina(p as number); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className={`w-8 h-8 text-xs font-black rounded-lg transition-all ${
                            pagina === p
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-medium text-slate-400 hidden sm:block">
                    {inicio + 1}–{Math.min(inicio + PER_PAGE, contratos.length)} de {contratos.length}
                  </span>
                  <button
                    onClick={() => { setPagina(p => Math.min(totalPaginas, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={pagina === totalPaginas}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </>
          );
        })()}
      </div>
    </div>
  );
}
