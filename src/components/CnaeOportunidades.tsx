'use client';

/**
 * CnaeOportunidades.tsx
 * Feed personalizado de editais abertos alinhados ao CNAE principal
 * da empresa cadastrada pelo usuário.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Target, Calendar, Timer, PlayCircle, RefreshCw, Building2, Briefcase, MapPin, Globe, Info } from 'lucide-react';
import CnaePriceTrendChart from './CnaePriceTrendChart';
import { apiFetch, SessionExpiredError } from '@/lib/apiClient';

interface CnaeOportunidadesProps {
  token: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: any | null;
  onAnalyzeOportunity: (
    textoCompleto: string,
    termoPesquisado: string,
    editalDados?: { cnpj: string; ano: number; sequencial: number; uf?: string }
  ) => void;
  onShowAuthModal?: (mode: 'login' | 'register') => void;
}

interface EditalCnae {
  cnae_match?: string;
  numero_controle_pncp?: string;
  id?: string;
  link?: string;
  // Campos PNCP /api/search — planos
  orgao_nome?: string;
  nomeOrgao?: string;
  uf?: string;
  orgao_cnpj?: string;
  cnpjOrgao?: string;
  // Campos PNCP /api/search — aninhados (presentes em alguns itens)
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { ufSigla?: string; municipioNome?: string; nomeUnidade?: string };
  // Empresa que gerou este resultado (para filtro + badge)
  empresa_match?: string;
  // Todas as empresas que geraram este resultado (filtro multi-empresa)
  empresas_match?: string[];
  // Objeto da compra — vários sinônimos possíveis
  objetoCompra?: string;
  description?: string;
  title?: string;
  objeto?: string;
  // Ano e sequencial
  anoCompra?: number;
  ano?: number;
  ano_compra?: number;
  sequencialCompra?: number;
  numero_sequencial?: number;
  numero_sequencial_compra_ata?: number;
  // Valores
  valor_total_estimado?: number;
  valor_global?: number;
  valorTotalEstimado?: number;
  // Datas
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  dataFimRecebimentoProposta?: string;
  dataPublicacaoPncp?: string;
  modalidade_nome?: string;
  situacao?: string;
  [key: string]: unknown;
}

export default function CnaeOportunidades({
  token,
  userData,
  onAnalyzeOportunity,
  onShowAuthModal,
}: CnaeOportunidadesProps) {
  const [editais, setEditais] = useState<EditalCnae[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [cnaeInfo, setCnaeInfo] = useState<{
    cnae: string;
    cnaesUsados: { codigo: string; tipo: string }[];
    ufEmpresa: string;
    municipioEmpresa: string;
    empresaLocalizacao: Record<string, { uf: string; municipio: string }>;
    empresa: string;
    empresas: string[];
    empresasDetalhe: {
      nome: string; cnae?: string | null; termo?: string | null; uf?: string | null; municipio?: string | null;
      /** Todos os termos que esta empresa consulta (o feed usava só o 1º). */
      termos?: string[];
      /** Gerou termo de busca? Falso = está no cadastro mas não alimenta o feed. */
      contribui?: boolean;
      /** Por que não contribui — some quando contribui. */
      motivo?: string;
      /** Outra empresa consulta exatamente os mesmos termos: este chip não
       *  tem como devolver nada diferente daquele. */
      mesmos_termos_que?: string | null;
    }[];
    /** Quantas das cadastradas realmente geraram o feed. */
    empresasContribuindo: number;
    termos: string[];
  } | null>(null);
  const [empresaFiltro, setEmpresaFiltro] = useState<string | null>(null);
  const [mensagemServidor, setMensagemServidor] = useState('');
  const [mounted, setMounted] = useState(false);
  const [erroEdital, setErroEdital] = useState<string | null>(null);

  // Transparência da busca ao vivo: fonte, hora, resposta parcial e delta
  const [feedMeta, setFeedMeta] = useState<{
    geradoEm: number | null;
    fonte: string;
    parcial: boolean;
    /** Quantos o filtro de relevância cortou por não atender aos termos. */
    descartados: number;
    buscasOk: number;
    buscasTotal: number;
  } | null>(null);
  const [delta, setDelta] = useState<{ novos: number; sairam: number } | null>(null);
  const prevUidsRef = useRef<Set<string> | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => { setMounted(true); }, []);

  const carregar = useCallback(async (forceRefresh = false) => {
    if (!token) return;
    setLoading(true);
    setStatus('loading');
    try {
      const url = forceRefresh
        ? `${API_URL}/api/pncp/feed-cnae?force_refresh=true`
        : `${API_URL}/api/pncp/feed-cnae`;
      const res = await apiFetch(url);
      if (!res.ok) {
        setStatus('error');
        return;
      }
      const data = await res.json();
      setStatus(data.status);
      const brutos: EditalCnae[] = data.data || [];
      // ⚠️ REGRA ESTRITA (12/08/2026): edital vencido NUNCA aparece no feed —
      // decisão de produto. O backend já corta na fonte; esta segunda camada
      // cobre cache antigo e formatos fora do padrão. Sem data de
      // encerramento REAL e futura → fora.
      const agoraFeed = new Date();
      const parseDataFeed = (v?: unknown): Date | null => {
        if (!v) return null;
        const s = String(v).trim();
        const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
        if (br) {
          const d = new Date(`${br[3]}-${br[2]}-${br[1]}T${br[4] || '23:59:59'}`);
          return isNaN(d.getTime()) ? null : d;
        }
        const iso = new Date(s);
        return isNaN(iso.getTime()) ? null : iso;
      };
      const lista = brutos.filter((e) => {
        const fim = parseDataFeed(e.dataEncerramentoProposta)
          || parseDataFeed((e as Record<string, unknown>).dataFimRecebimentoProposta)
          || parseDataFeed((e as Record<string, unknown>).data_fim_vigencia);
        return fim !== null && fim >= agoraFeed;
      });
      setEditais(lista);
      setMensagemServidor(data.message || '');
      setEmpresaFiltro(null); // reset filtro ao recarregar

      // ── Delta entre atualizações: torna a variação da contagem legível ──
      const uidOf = (e: EditalCnae) => String(e.numero_controle_pncp || e.id || '');
      const uidsAtuais = new Set(lista.map(uidOf).filter(Boolean));
      if (forceRefresh && prevUidsRef.current && prevUidsRef.current.size > 0) {
        const prev = prevUidsRef.current;
        const novos  = [...uidsAtuais].filter(u => !prev.has(u)).length;
        const sairam = [...prev].filter(u => !uidsAtuais.has(u)).length;
        setDelta(novos > 0 || sairam > 0 ? { novos, sairam } : null);
      } else {
        setDelta(null);
      }
      prevUidsRef.current = uidsAtuais;

      setFeedMeta({
        geradoEm: typeof data.gerado_em === 'number' ? data.gerado_em : null,
        fonte: data.fonte || 'ao_vivo',
        parcial: !!data.parcial,
        descartados: Number(data.descartados_relevancia || 0),
        buscasOk: data.buscas_ok ?? 0,
        buscasTotal: data.buscas_total ?? 0,
      });
      // Sempre atualiza cnaeInfo (nunca deixa estado stale se data.cnae vier vazio)
      setCnaeInfo(data.cnae ? {
        cnae: data.cnae,
        cnaesUsados: data.cnaes_usados || [],
        ufEmpresa: (data.uf_empresa || '').toUpperCase(),
        // Guarda raw para display (BrasilAPI devolve CAPS — convertemos no render)
        municipioEmpresa: (data.municipio_empresa || ''),
        empresaLocalizacao: data.empresa_localizacao || {},
        empresa: data.empresa || '',
        empresas: data.empresas || [],
        empresasDetalhe: data.empresas_detalhe || [],
        empresasContribuindo: Number(data.empresas_contribuindo ?? (data.empresas || []).length),
        termos: data.termos_usados || [],
      } : null);
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [token, API_URL]);

  useEffect(() => {
    if (token) carregar();
  }, [token, carregar]);

  // ─── Extrair e analisar edital ─────────────────────────────────────────────
  const handleAnalisar = async (edital: EditalCnae) => {
    const cnpj = edital.orgao_cnpj || edital.orgaoEntidade?.cnpj || edital.cnpjOrgao || '';
    const ano = edital.anoCompra || edital.ano || edital.ano_compra || 0;
    const seq = edital.sequencialCompra || edital.numero_sequencial || edital.numero_sequencial_compra_ata || 0;
    const uid = edital.numero_controle_pncp || edital.id || String(Math.random());

    if (!cnpj || !ano || !seq) {
      setErroEdital('Dados incompletos neste edital (CNPJ, ano ou sequencial ausente). Tente outro edital.');
      setTimeout(() => setErroEdital(null), 5000);
      return;
    }

    setLoadingId(uid);
    try {
      const termo = cnaeInfo?.termos[0] || edital.cnae_match || 'licitação';
      const [resTexto, resMedia] = await Promise.all([
        fetch(`${API_URL}/api/pncp/texto-completo?cnpj=${cnpj}&ano=${ano}&seq=${seq}`),
        fetch(`${API_URL}/api/pncp/media-precos?q=${encodeURIComponent(termo)}`),
      ]);

      const dataTexto = await resTexto.json();
      const dataMedia = await resMedia.json();
      if (!resTexto.ok) throw new Error('Falha ao carregar o edital.');

      const detalhamento = dataTexto.texto || 'Detalhes técnicos não disponíveis.';
      const historico = dataMedia.texto || 'Sem histórico recente de preços.';
      const uf = edital.uf || edital.unidadeOrgao?.ufSigla || '';
      const orgao = edital.orgao_nome || edital.orgaoEntidade?.razaoSocial || edital.unidadeOrgao?.nomeUnidade || edital.nomeOrgao || 'Órgão';
      const valor = edital.valor_total_estimado || edital.valorTotalEstimado || edital.valor_global || 0;
      const valorFmt = valor
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
        : 'Não informado';

      const prompt = `
DOCUMENTO OFICIAL PARA ANÁLISE — FEED CNAE PERSONALIZADO
=========================================================
▸ CNAE DA EMPRESA: ${cnaeInfo?.cnae || '—'} | Termo: "${edital.cnae_match || termo}"
=========================================================

[1. DADOS CADASTRAIS]
• Órgão: ${orgao}
• UF: ${uf}
• Código PNCP: ${edital.numero_controle_pncp || uid}
• Valor Estimado: ${valorFmt}
• Abertura: ${edital.dataAberturaProposta || 'N/A'}
• Encerramento: ${edital.dataEncerramentoProposta || edital.dataFimRecebimentoProposta || 'N/A'}

[2. OBJETO]
${edital.objetoCompra || edital.description || edital.title || edital.objeto || 'Não especificado'}

[3. INTELIGÊNCIA DE PREÇOS]
${historico}

[4. DETALHAMENTO TÉCNICO]
${detalhamento.substring(0, 28000)}

=========================================================
INSTRUÇÃO: Analise este edital priorizando a compatibilidade com o CNAE ${cnaeInfo?.cnae}.
`;

      onAnalyzeOportunity(prompt, edital.cnae_match || termo, { cnpj, ano, sequencial: seq, uf });
    } catch (err: unknown) {
      setErroEdital(err instanceof Error ? err.message : 'Erro ao carregar edital. Tente novamente.');
      setTimeout(() => setErroEdital(null), 5000);
    } finally {
      setLoadingId(null);
    }
  };

  // ─── Utilitários de display ───────────────────────────────────────────────
  const toTitleCase = (s: string) =>
    s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  // Primeiro palavra(s) significativa(s) do nome da empresa (para chips)
  const nomeAbrevEmpresa = (nome: string) => {
    const palavras = nome.split(' ').filter(p => p.length > 2 && !/^(DE|DA|DO|E|S\.A\.|LTDA|ME|EPP)$/i.test(p));
    return palavras.slice(0, 2).join(' ') || nome.slice(0, 14);
  };

  // Normaliza string para comparação segura (remove whitespace, ignora case)
  const norm = (v: unknown): string =>
    typeof v === 'string' ? v.trim().toLowerCase() : '';

  // Verifica se um edital pertence a uma empresa (suporta empresas_match[] e empresa_match)
  const editalDaEmpresa = (e: EditalCnae, empresa: string): boolean => {
    const alvo = norm(empresa);
    if (!alvo) return false;
    if (e.empresas_match?.length) return e.empresas_match.some(em => norm(em) === alvo);
    return norm(e.empresa_match) === alvo;
  };

  // ─── Filtro por empresa ────────────────────────────────────────────────────
  const editaisFiltrados = useMemo(() => {
    if (!empresaFiltro) return editais;
    return editais.filter(e => editalDaEmpresa(e, empresaFiltro));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editais, empresaFiltro]);

  // ─── Formatar data ISO para DD/MM/YYYY HH:mm ──────────────────────────────
  const fmtData = (iso: string | undefined): string => {
    if (!iso) return '';
    try {
      const d = new Date(iso.replace('Z', ''));
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  if (!mounted) return <div className="min-h-[200px] animate-pulse bg-slate-50 rounded-[2.5rem]" />;

  // ─── Toast de erro de edital ────────────────────────────────────────────────
  const ErroEditalToast = erroEdital ? (
    <div className="fixed bottom-5 right-5 z-[200] max-w-sm rounded-2xl border bg-red-50 border-red-200 text-red-800 px-4 py-3 text-sm font-semibold shadow-xl">
      {erroEdital}
    </div>
  ) : null;

  // ─── Estado: não autenticado ───────────────────────────────────────────────
  if (!token) {
    return (
      <div className="w-full p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
          <Target className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">Feed Personalizado por CNAE</h3>
        <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
          Entre na sua conta para ver oportunidades selecionadas automaticamente com base no CNAE da sua empresa.
        </p>
        {onShowAuthModal && (
          <button
            onClick={() => onShowAuthModal('login')}
            className="px-6 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-all shadow-md"
          >
            Entrar na Conta
          </button>
        )}
      </div>
    );
  }

  // ─── Estado: sem CNAE cadastrado ───────────────────────────────────────────
  if (status === 'sem_cnae' || status === 'cnae_nao_mapeado') {
    return (
      <div className="w-full p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
          <Building2 className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2">Configure o CNAE da Empresa</h3>
        <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
          {mensagemServidor || 'Cadastre o CNAE principal da sua empresa no perfil para ativar o feed de oportunidades.'}
        </p>
        <a
          href="/profile"
          className="inline-block px-6 py-3 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 transition-all shadow-md"
        >
          Ir para o Perfil
        </a>
      </div>
    );
  }

  // ─── Estado: carregando ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-slate-100 rounded-lg animate-pulse">
            <Target className="w-6 h-6 text-slate-400" />
          </div>
          <div className="h-5 w-48 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Estado: erro ──────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="w-full p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100 text-center">
        <p className="text-red-600 font-medium text-sm mb-4">Erro ao carregar oportunidades. Tente novamente.</p>
        <button onClick={() => carregar(true)} className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm">
          Tentar Novamente
        </button>
      </div>
    );
  }

  // ─── Feed de editais ───────────────────────────────────────────────────────
  return (
    /* ⚠️ TINHA `max-w-5xl mx-auto` — TETO DE 1024px, CENTRALIZADO, e estava
       nos CINCO estados desta tela (carregando, vazio, erro, sem CNAE e o
       feed). Era o mesmo travamento do Radar PNCP: com o menu oculto a coluna
       passa de 1400px e o bloco parava em 1024, com margem sobrando dos dois
       lados — centralizado, mas sem expandir.
       A largura de bloco desta coluna quem decide é a coluna; contenção, quando
       necessária, se resolve por dentro do bloco. */
    <div className="w-full font-sans">
      {ErroEditalToast}

      {/* ── Cabeçalho ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-[1.75rem] border border-slate-100 shadow-sm p-5 mb-4">

        {/* Linha 1 — título + botão atualizar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
              <Target className="w-4.5 h-4.5 text-teal-600" strokeWidth={2.5} style={{width:18,height:18}} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 leading-none">Oportunidades com fit</h2>
              {cnaeInfo && (
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-none">
                  {/* ⚠️ CONTA QUEM GEROU O FEED, NÃO QUEM ESTÁ CADASTRADO.
                      Dizia "3 empresas" mesmo quando duas eram puladas por não
                      ter CNAE — o laço de termos faz `continue` em silêncio.
                      Anunciar cadastro como cobertura é prometer um recorte que
                      não existe. */}
                  {cnaeInfo.empresas.length > 1
                    ? (cnaeInfo.empresasContribuindo < cnaeInfo.empresas.length
                        ? `${cnaeInfo.empresasContribuindo} de ${cnaeInfo.empresas.length} empresas · ${editais.length} editais`
                        : `${cnaeInfo.empresas.length} empresas · ${editais.length} editais`)
                    : `${editais.length} editais encontrados`}
                  {feedMeta && (
                    <span className="text-slate-300">
                      {feedMeta.fonte === 'cache' ? ' · em cache' : ' · ao vivo do PNCP'}
                      {feedMeta.geradoEm
                        /* ⚠️ "15:21" SOZINHO NÃO DIZ DE QUANDO É. Se a aba
                           ficou aberta desde ontem, o horário sem data faz o
                           feed parecer fresco por 24 horas. Só o de hoje pode
                           dispensar a data. */
                        ? ` · ${(() => {
                            const d = new Date(feedMeta.geradoEm * 1000);
                            const hoje = d.toDateString() === new Date().toDateString();
                            const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            return hoje ? hora : `${d.toLocaleDateString('pt-BR')} ${hora}`;
                          })()}`
                        : ''}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => carregar(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 font-bold rounded-xl text-xs hover:bg-slate-100 transition-all disabled:opacity-50 border border-slate-200 shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {cnaeInfo && (
          <>
            {/* Linha 2 — todas as empresas monitoradas */}
            <div className="flex flex-col gap-1.5 mb-3">
              {(cnaeInfo.empresas.length > 0 ? cnaeInfo.empresas : [cnaeInfo.empresa]).map((emp) => {
                const loc = cnaeInfo.empresaLocalizacao?.[emp] as { uf?: string; municipio?: string } | undefined;
                const ufEmp  = (loc?.uf        || (cnaeInfo.empresas.length <= 1 ? cnaeInfo.ufEmpresa        : '')).toUpperCase().trim();
                const munEmp = (loc?.municipio  || (cnaeInfo.empresas.length <= 1 ? cnaeInfo.municipioEmpresa : '')).trim();
                return (
                  <div key={emp} className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[12px] font-black text-slate-700 truncate max-w-[280px]">
                        {emp}
                      </span>
                    </div>
                    {ufEmp && (
                      <span className="flex items-center gap-1 text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-lg shrink-0">
                        <MapPin className="w-3 h-3" />
                        {munEmp ? `${toTitleCase(munEmp)} · ${ufEmp}` : ufEmp}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Linha 3 — CNAEs */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-0.5">CNAE</span>
              {(cnaeInfo.cnaesUsados.length > 0 ? cnaeInfo.cnaesUsados : [{ codigo: cnaeInfo.cnae, tipo: 'principal' }])
                .map((c) => (
                  <span
                    key={c.codigo}
                    title={c.tipo === 'principal' ? 'CNAE principal' : 'CNAE secundário'}
                    className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg border ${
                      c.tipo === 'principal'
                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    {c.tipo === 'principal' && <span className="text-teal-400 text-[9px]">●</span>}
                    {c.codigo}
                  </span>
                ))}
            </div>

            {/* Linha 4 — termos de busca */}
            {cnaeInfo.termos.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-0.5">Termos</span>
                {cnaeInfo.termos.map((t) => (
                  <span key={t} className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Transparência da busca ao vivo ───────────────────────────────────── */}
      {status === 'success' && (feedMeta || delta) && (
        <div className="mb-4 space-y-2">
          {/* ⚠️ O QUE O FILTRO DE RELEVÂNCIA CORTOU.
              O feed não tinha filtro nenhum além de prazo: o que o
              `/api/search` do PNCP devolvia entrava na tela, e ele casa por
              aproximação — daí "AQUISIÇÃO DE MATERIAIS DE ENFERMAGEM" sob o
              termo "desenvolvimento de software".
              Agora corta, e DIZ que cortou. Sem esta linha, um feed que caiu de
              24 para 6 pareceria o PNCP tendo publicado menos; a pessoa clicaria
              Atualizar procurando editais que nunca foram dela. */}
          {/* ⚠️ EMPRESA CADASTRADA QUE NÃO ALIMENTA O FEED PRECISA DIZER POR
              QUÊ. O laço de termos pula quem não tem `cnae_principal` com um
              `continue` mudo, e o cadastro fica parecendo ativo. Sem CNAE, essa
              empresa nunca vai aparecer em oportunidade nenhuma — e isso é
              acionável: são dois campos no perfil. */}
          {cnaeInfo?.empresasDetalhe?.some(d => d.contribui === false) && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] font-semibold text-amber-800">
              <span className="text-sm leading-none">⚠️</span>
              <span>
                {cnaeInfo.empresasDetalhe.filter(d => d.contribui === false)
                  .map(d => nomeAbrevEmpresa(d.nome)).join(', ')}
                {' '}não gera oportunidade nenhuma:{' '}
                {cnaeInfo.empresasDetalhe.find(d => d.contribui === false)?.motivo}.
                Enquanto isso, o feed cobre só as demais.
              </span>
            </div>
          )}

          {!!feedMeta?.descartados && (
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-medium text-slate-500">
              <span className="text-sm leading-none">🎯</span>
              <span>
                <strong className="font-black text-slate-700">{feedMeta.descartados}</strong>{' '}
                edital(is) que o PNCP devolveu não mencionam nenhum dos seus termos e
                ficaram de fora. O casamento é por palavra do objeto — se algo relevante
                estiver sumindo, o termo do seu CNAE é que precisa crescer.
              </span>
            </div>
          )}

          {/* Resposta parcial do PNCP — a lista pode estar incompleta */}
          {feedMeta?.parcial && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] font-semibold text-amber-800">
              <span className="text-sm leading-none">⚠️</span>
              <span>
                O PNCP respondeu parcialmente ({feedMeta.buscasOk} de {feedMeta.buscasTotal} buscas concluídas) —
                alguns editais podem não estar listados. Clique em <strong>Atualizar</strong> para tentar completar.
              </span>
            </div>
          )}

          {/* Por que a contagem varia + delta da última atualização */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-1 text-[11px] font-medium text-slate-400">
            <Info size={12} className="shrink-0" />
            <span>
              Feed consultado em tempo real no PNCP: editais novos entram e encerrados saem — a contagem pode mudar a cada atualização.
            </span>
            {delta && (delta.novos > 0 || delta.sairam > 0) && (
              <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 font-black text-teal-700">
                {delta.novos > 0 && `+${delta.novos} novo${delta.novos > 1 ? 's' : ''}`}
                {delta.novos > 0 && delta.sairam > 0 && ' · '}
                {delta.sairam > 0 && `${delta.sairam} ${delta.sairam > 1 ? 'saíram' : 'saiu'}`}
                {' '}desde a última atualização
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Inteligência de Preços por CNAE ──────────────────────────────────── */}
      {/* O gráfico segue o filtro de empresa: ao selecionar uma empresa, mostra a
          tendência do CNAE/UF/termo DELA (antes ficava preso à empresa primária) */}
      {cnaeInfo && cnaeInfo.cnae && (() => {
        const det = empresaFiltro
          ? cnaeInfo.empresasDetalhe.find(d => d.nome === empresaFiltro)
          : null;
        const chartCnae  = det?.cnae || cnaeInfo.cnae;
        const chartUf    = ((det ? det.uf : cnaeInfo.ufEmpresa) || '').toUpperCase() || undefined;
        const chartLabel = det?.termo || cnaeInfo.termos[0];
        return (
          <div className="mb-4">
            <CnaePriceTrendChart
              key={`${chartCnae}-${chartUf || 'BR'}`}
              token={token}
              cnae={chartCnae}
              uf={chartUf}
              meses={12}
              labelSegmento={chartLabel}
            />
          </div>
        );
      })()}

      {/* ── Filtro por empresa ────────────────────────────────────────────────── */}
      {cnaeInfo && cnaeInfo.empresas.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setEmpresaFiltro(null)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              empresaFiltro === null
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>Todas</span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
              empresaFiltro === null ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>{editais.length}</span>
          </button>

          {cnaeInfo.empresas.map((emp) => {
            const count = editais.filter(e => editalDaEmpresa(e, emp)).length;
            const nomeChip = nomeAbrevEmpresa(emp);
            const ufEmpFiltro = cnaeInfo.empresaLocalizacao?.[emp]?.uf || '';
            const isActive = empresaFiltro === emp;
            const det = cnaeInfo.empresasDetalhe.find(d => d.nome === emp);
            // ⚠️ CHIP QUE NÃO PODE RECORTAR NADA NÃO SE COMPORTA COMO FILTRO.
            // Empresa sem CNAE mapeado não gerou termo — o chip mostraria zero
            // sempre. Empresa com os MESMOS termos de outra devolveria
            // exatamente a mesma lista. Nos dois casos o clique não muda a
            // tela, e um filtro que não filtra ensina que os filtros da tela
            // não funcionam. Fica visível, com o motivo no title, e inerte.
            const inerte = det ? (det.contribui === false || !!det.mesmos_termos_que) : false;
            const porque = det?.motivo
              || (det?.mesmos_termos_que
                    ? `Consulta os mesmos termos de ${nomeAbrevEmpresa(det.mesmos_termos_que)} — o resultado seria idêntico.`
                    : '');
            if (inerte) {
              return (
                <span
                  key={emp}
                  title={porque}
                  className="flex cursor-default items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-400"
                >
                  <span className="max-w-[120px] truncate">{nomeChip}</span>
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    {det?.contribui === false ? 'sem CNAE' : 'mesmos termos'}
                  </span>
                </span>
              );
            }
            return (
              <button
                key={emp}
                onClick={() => setEmpresaFiltro(isActive ? null : emp)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isActive
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-teal-200 hover:bg-teal-50'
                }`}
              >
                <span className="truncate max-w-[120px]">{nomeChip}</span>
                {ufEmpFiltro && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                    isActive ? 'bg-white/25 text-white' : 'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>{ufEmpFiltro}</span>
                )}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lista vazia */}
      {editaisFiltrados.length === 0 && status === 'success' && (
        <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Target className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-base font-black text-slate-700 mb-2">
            {empresaFiltro ? `Nenhum edital para ${empresaFiltro.split(' ')[0]}` : 'Nenhum edital ativo no momento'}
          </h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            {empresaFiltro
              ? (() => {
                  const det = cnaeInfo?.empresasDetalhe.find(d => d.nome === empresaFiltro);
                  return det?.termo
                    ? `Nenhuma licitação vigente encontrada para o termo "${det.termo}"${det.uf ? ` (nem em ${det.uf}, nem no Brasil)` : ''}. O termo é derivado do CNAE — experimente buscar manualmente no Radar PNCP com palavras do seu dia a dia (ex.: serviços específicos que a empresa presta).`
                    : 'Tente selecionar outra empresa ou ver todas as oportunidades.';
                })()
              : 'Não encontramos licitações abertas para o seu CNAE agora. Volte amanhã ou ajuste o CNAE no perfil.'}
          </p>
        </div>
      )}

      {/* Cards */}
      {/* ⚠️ `grade-cards` só faz efeito com o menu oculto (ver
          `styles/layout.css`): aí a lista vira DUAS colunas em vez de uma
          coluna duas vezes mais larga. Card de edital tem objeto longo — ao
          esticar, a linha passa de 180 caracteres e fica pior de ler, e a
          rolagem continua mostrando a mesma quantidade de editais. */}
      {editaisFiltrados.length > 0 && (
        <div className="grade-cards space-y-4 max-h-[70dvh] overflow-y-auto pr-2 pb-4 custom-scrollbar">
          {(() => {
            // UFs de todas as empresas cadastradas
            const todasUfsEmpresas = new Set(
              Object.values(cnaeInfo?.empresaLocalizacao || {})
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((loc: any) => (loc?.uf || '').toUpperCase().trim())
                .filter(Boolean)
            );
            const getUfEdital = (e: EditalCnae) =>
              (e.uf || (e.unidadeOrgao as { ufSigla?: string } | undefined)?.ufSigla || '').toUpperCase().trim();

            let jaExibioSeparadorNacional = false;
            let contRegional = 0;

            return editaisFiltrados.map((edital, idx) => {
              const ufEdital = getUfEdital(edital);
              const isRegional = todasUfsEmpresas.size > 0 && todasUfsEmpresas.has(ufEdital);

              if (isRegional) contRegional++;

              // Separador "Oportunidades nacionais" — primeira vez que sai dos estados cadastrados
              const mostrarSeparadorNacional =
                !isRegional && !jaExibioSeparadorNacional && contRegional > 0;
              if (mostrarSeparadorNacional) jaExibioSeparadorNacional = true;

              const uid = edital.numero_controle_pncp || edital.id || String(idx);
              const orgao = edital.orgao_nome || edital.orgaoEntidade?.razaoSocial || edital.unidadeOrgao?.nomeUnidade || edital.nomeOrgao || 'Órgão Público';
              const uf = edital.uf || edital.unidadeOrgao?.ufSigla || '';
            const municipio = (edital.unidadeOrgao?.municipioNome || (edital as any).municipio || '').toUpperCase();
            const objeto = String(edital.objetoCompra || edital.description || edital.title || edital.objeto || 'Objeto não especificado');
            const valor = edital.valor_total_estimado || edital.valorTotalEstimado || edital.valor_global || 0;
            const valorFmt = valor > 0
              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
              : null;
            const dataInicio = fmtData(edital.dataAberturaProposta as string | undefined);
            const dataFim = fmtData(
              (edital.dataEncerramentoProposta || edital.dataFimRecebimentoProposta) as string | undefined
            );
            const cnpj = edital.orgao_cnpj || edital.orgaoEntidade?.cnpj || edital.cnpjOrgao || '';
            const ano = edital.anoCompra || edital.ano || edital.ano_compra || 0;
            const seq = edital.sequencialCompra || edital.numero_sequencial || edital.numero_sequencial_compra_ata || 0;

              return (
                <React.Fragment key={uid}>
                  {/* Separador visual entre oportunidades regionais e nacionais */}
                  {mostrarSeparadorNacional && (
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                        <Globe size={11} />
                        Oportunidades nacionais
                      </span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  )}
                  <div className="p-5 md:p-6 border border-slate-200 rounded-[1.5rem] bg-white hover:border-slate-300 transition-all shadow-sm hover:shadow-md">

                {/* Linha superior */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2 items-center flex-wrap">
                    {uf && (() => {
                      // Localização da empresa que gerou ESTE edital
                      const empNome = edital.empresa_match || '';
                      const loc = cnaeInfo?.empresaLocalizacao?.[empNome] as { uf?: string; municipio?: string } | undefined;
                      const ufEmp  = (loc?.uf        || cnaeInfo?.ufEmpresa        || '').toUpperCase().trim();
                      const munEmp = (loc?.municipio  || cnaeInfo?.municipioEmpresa || '').toUpperCase().trim();
                      const ufUp   = uf.toUpperCase();
                      const munUp  = municipio.toUpperCase();
                      const isCidade = ufEmp && ufUp === ufEmp && munEmp && munUp === munEmp;
                      const isEstado = !isCidade && ufEmp && ufUp === ufEmp;
                      return (
                        <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md uppercase border ${
                          isCidade   ? 'bg-blue-600 text-white border-blue-600'
                          : isEstado ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {(isCidade || isEstado) && <MapPin className="w-2.5 h-2.5 shrink-0" />}
                          {uf}{municipio ? ` · ${municipio}` : ''}
                        </span>
                      );
                    })()}
                    {/* ⚠️ SÓ REPETE O QUE O FILTRO ACIMA NÃO JÁ DIZ.
                        Cada card carregava três rótulos — UF, empresa e termo —
                        e os três se repetiam idênticos em todos os cards, com o
                        filtro logo acima anunciando exatamente a mesma coisa.
                        Rótulo que nunca varia dentro de uma lista não informa:
                        ocupa a linha onde a diferença entre um card e outro
                        deveria aparecer.
                        Com uma empresa selecionada, o crachá dela vira eco. */}
                    {cnaeInfo && cnaeInfo.empresas.length > 1 && !empresaFiltro && edital.empresa_match && (
                      <span className="flex items-center gap-1 text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-md max-w-[160px] truncate">
                        <Briefcase className="w-3 h-3 shrink-0" />
                        <span className="truncate">{edital.empresa_match.split(' ').slice(0, 2).join(' ')}</span>
                      </span>
                    )}
                    {/* Termo: só quando há mais de um em jogo. Com um termo
                        único, o cabeçalho já o exibe e o crachá é redundância
                        em cada linha da lista. */}
                    {(cnaeInfo?.termos?.length ?? 0) > 1 && edital.cnae_match && (
                      <span className="flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md">
                        <Target className="w-3 h-3" />
                        {edital.cnae_match}
                      </span>
                    )}
                  </div>
                  {valorFmt && (
                    <span className="text-sm font-black text-slate-900 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg shadow-sm shrink-0">
                      {valorFmt}
                    </span>
                  )}
                </div>

                {/* Órgão e objeto */}
                <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-1">{orgao}</h3>
                <p className="text-slate-500 text-xs font-medium line-clamp-2 mb-4">{objeto}</p>

                {/* Timeline */}
                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 mb-3">
                  {edital.dataPublicacaoPncp && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Divulgação</p>
                        <p className="text-xs text-slate-700 font-semibold">{fmtData(edital.dataPublicacaoPncp as string)}</p>
                      </div>
                    </div>
                  )}
                  {/* ⚠️ A COR SEGUE A SITUAÇÃO, NÃO O FATO DE HAVER UMA.
                      Era verde sempre: "Suspensa" e "Revogada" saíam com a
                      mesma bolinha esmeralda de "Divulgada no PNCP". Verde é o
                      código visual de "está tudo certo" no resto da tela —
                      usá-lo para um processo parado desmente o próprio rótulo
                      que está ao lado. */}
                  {edital.situacao && (() => {
                    const s = String(edital.situacao).toLowerCase();
                    const ruim = /suspens|revogad|anulad|fracassad|desert/.test(s);
                    return (
                      <div className="flex items-center gap-2">
                        <div className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${ruim ? 'bg-slate-400' : 'bg-emerald-400'}`} />
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Situação</p>
                          <p className={`text-xs font-semibold ${ruim ? 'text-slate-600' : 'text-emerald-700'}`}>
                            {String(edital.situacao)}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                  {dataInicio && (
                    <div className="flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Início</p>
                        <p className="text-xs text-slate-700 font-semibold">{dataInicio}</p>
                      </div>
                    </div>
                  )}
                  {dataFim && (
                    <div className="flex items-center gap-2 border-l-2 pl-3 rounded-r py-1 border-amber-400 bg-amber-50">
                      <Timer className="w-4 h-4 shrink-0 text-amber-600" />
                      <div>
                        <p className="text-[9px] uppercase font-black tracking-widest text-amber-600/80">Fim</p>
                        <p className="text-xs text-amber-900 font-black">{dataFim}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prazo da proposta — sempre baseado em dados reais do PNCP */}
                {(() => {
                  const fimRaw = edital.dataEncerramentoProposta
                    || edital.dataFimRecebimentoProposta
                    || (edital as Record<string, unknown>).data_fim_vigencia as string | undefined;
                  let radarMsg = 'Prazo não informado · confira no edital original';
                  let radarColor = 'bg-slate-50 text-slate-500 border-slate-200';

                  // ⚠️ A SITUAÇÃO MANDA MAIS QUE O RELÓGIO.
                  // Este bloco calculava a urgência só pela data de
                  // encerramento e ignorava `situacao`. Na tela real, um edital
                  // do CRBio-01 marcado como "Suspensa" exibia
                  // "Encerra em 1 dia · Atue agora", em vermelho. Processo
                  // suspenso tem prazo PARADO: agir agora é montar proposta
                  // para uma data que vai mudar. Revogado e anulado são piores
                  // — não há mais disputa, e o vermelho chama justamente para o
                  // que não existe mais.
                  // A tela existe para dizer onde gastar esforço; nesses casos
                  // ela estava apontando para onde ele se perde.
                  const sit = String(edital.situacao || '').toLowerCase();
                  const paradoPor =
                    sit.includes('suspens') ? 'Prazo suspenso · aguarde nova data'
                    : sit.includes('revogad') ? 'Revogada · não haverá disputa'
                    : sit.includes('anulad') ? 'Anulada · não haverá disputa'
                    : '';
                  if (paradoPor) {
                    return (
                      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600">
                        <Timer className="w-3 h-3 shrink-0" />
                        <span>{paradoPor}</span>
                      </div>
                    );
                  }

                  if (fimRaw) {
                    try {
                      const dias = Math.ceil((new Date(String(fimRaw)).getTime() - Date.now()) / 86400000);
                      if (Number.isFinite(dias)) {
                        if (dias <= 0) {
                          radarMsg = 'Encerra hoje · Última chamada';
                          radarColor = 'bg-red-50 text-red-700 border-red-200';
                        } else if (dias <= 3) {
                          radarMsg = `Encerra em ${dias} dia${dias === 1 ? '' : 's'} · Atue agora`;
                          radarColor = 'bg-red-50 text-red-700 border-red-200';
                        } else if (dias <= 7) {
                          radarMsg = `Encerra em ${dias} dias · Janela se fechando`;
                          radarColor = 'bg-amber-50 text-amber-700 border-amber-200';
                        } else {
                          radarMsg = `Encerra em ${dias} dias · Tempo para preparar proposta`;
                          radarColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        }
                      }
                    } catch { /* ignora */ }
                  }
                  return (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold mb-4 ${radarColor}`}>
                      <Timer className="w-3 h-3 shrink-0" />
                      <span>Prazo</span>
                      <span className="mx-1 text-current opacity-30">·</span>
                      <span className="font-medium opacity-90">{radarMsg}</span>
                    </div>
                  );
                })()}

                {/* Botões */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleAnalisar(edital)}
                    disabled={loadingId !== null}
                    className="flex-1 bg-slate-900 text-white font-black py-3 px-4 rounded-xl text-xs hover:bg-slate-800 transition-all disabled:bg-slate-500 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                  >
                    {loadingId === uid ? (
                      <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> A Extrair (Aguarde)...</>
                    ) : (
                      'Extrair e Analisar IA ⚡'
                    )}
                  </button>
                  {(edital.link as string | undefined) && (
                    <a
                      href={edital.link as string}
                      target="_blank"
                      rel="noreferrer"
                      className="sm:w-auto px-6 py-3 bg-white text-slate-700 font-bold rounded-xl text-xs border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center"
                    >
                      Ver Original
                    </a>
                  )}
                </div>
                  </div>
                </React.Fragment>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
