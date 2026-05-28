'use client';

/**
 * CnaeOportunidades.tsx
 * Feed personalizado de editais abertos alinhados ao CNAE principal
 * da empresa cadastrada pelo usuário.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Target, Calendar, Timer, PlayCircle, RefreshCw, Building2, Briefcase, MapPin } from 'lucide-react';

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
    termos: string[];
  } | null>(null);
  const [empresaFiltro, setEmpresaFiltro] = useState<string | null>(null);
  const [mensagemServidor, setMensagemServidor] = useState('');
  const [mounted, setMounted] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => { setMounted(true); }, []);

  const carregar = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/pncp/feed-cnae`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      const data = await res.json();
      setStatus(data.status);
      setEditais(data.data || []);
      setMensagemServidor(data.message || '');
      setEmpresaFiltro(null); // reset filtro ao recarregar
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
        termos: data.termos_usados || [],
      } : null);
    } catch {
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
      alert('⚠️ Edital sem identificação completa (CNPJ/Ano/Sequencial). Impossível extrair.');
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
🎯 CNAE DA EMPRESA: ${cnaeInfo?.cnae || '—'} | Termo: "${edital.cnae_match || termo}"
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
      alert(err instanceof Error ? err.message : 'Erro ao carregar edital.');
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

  // ─── Estado: não autenticado ───────────────────────────────────────────────
  if (!token) {
    return (
      <div className="w-full max-w-5xl mx-auto p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100 text-center">
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
      <div className="w-full max-w-5xl mx-auto p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100 text-center">
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
      <div className="w-full max-w-5xl mx-auto p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100">
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
      <div className="w-full max-w-5xl mx-auto p-8 bg-white rounded-[2rem] shadow-sm border border-slate-100 text-center">
        <p className="text-red-600 font-medium text-sm mb-4">Erro ao carregar oportunidades. Tente novamente.</p>
        <button onClick={carregar} className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm">
          Tentar Novamente
        </button>
      </div>
    );
  }

  // ─── Feed de editais ───────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-5xl mx-auto font-sans">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-[1.75rem] border border-slate-100 shadow-sm p-5 mb-4">

        {/* Linha 1 — título + botão atualizar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
              <Target className="w-4.5 h-4.5 text-teal-600" strokeWidth={2.5} style={{width:18,height:18}} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 leading-none">Para Você</h2>
              {cnaeInfo && (
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-none">
                  {cnaeInfo.empresas.length > 1
                    ? `${cnaeInfo.empresas.length} empresas · ${editais.length} editais`
                    : `${editais.length} editais encontrados`}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={carregar}
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
          <p className="text-slate-400 text-sm">
            {empresaFiltro
              ? 'Tente selecionar outra empresa ou ver todas as oportunidades.'
              : 'Não encontramos licitações abertas para o seu CNAE agora. Volte amanhã ou ajuste o CNAE no perfil.'}
          </p>
        </div>
      )}

      {/* Cards */}
      {editaisFiltrados.length > 0 && (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 pb-4 custom-scrollbar">
          {editaisFiltrados.map((edital, idx) => {
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
              <div key={uid} className="p-5 md:p-6 border border-slate-200 rounded-[1.5rem] bg-white hover:border-slate-300 transition-all shadow-sm hover:shadow-md">

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
                    {/* Badge empresa — só quando há mais de uma empresa */}
                    {cnaeInfo && cnaeInfo.empresas.length > 1 && edital.empresa_match && (
                      <span className="flex items-center gap-1 text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-md max-w-[160px] truncate">
                        <Briefcase className="w-3 h-3 shrink-0" />
                        <span className="truncate">{edital.empresa_match.split(' ').slice(0, 2).join(' ')}</span>
                      </span>
                    )}
                    {/* Badge CNAE match */}
                    <span className="flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md">
                      <Target className="w-3 h-3" />
                      {edital.cnae_match}
                    </span>
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
                  {edital.situacao && (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Situação</p>
                        <p className="text-xs text-emerald-700 font-semibold">{String(edital.situacao)}</p>
                      </div>
                    </div>
                  )}
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

                {/* Radar Preditivo */}
                {(() => {
                  const fimRaw = edital.dataEncerramentoProposta || edital.dataFimRecebimentoProposta;
                  let radarMsg = '📡 Padrão sazonal identificado · Monitorando';
                  let radarColor = 'bg-slate-50 text-slate-500 border-slate-200';
                  if (fimRaw) {
                    try {
                      const dias = Math.ceil((new Date(String(fimRaw)).getTime() - Date.now()) / 86400000);
                      if (dias <= 3) {
                        radarMsg = '⚡ Encerramento iminente · Atue agora';
                        radarColor = 'bg-red-50 text-red-700 border-red-200';
                      } else if (dias <= 7) {
                        radarMsg = `🔔 Encerra em ${dias} dias · Janela se fechando`;
                        radarColor = 'bg-amber-50 text-amber-700 border-amber-200';
                      }
                    } catch { /* ignora */ }
                  }
                  return (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold mb-4 ${radarColor}`}>
                      <Target className="w-3 h-3 shrink-0" />
                      <span>Radar Preditivo</span>
                      <span className="mx-1 text-current opacity-30">·</span>
                      <span className="font-medium opacity-90">{radarMsg.replace(/^[^\s]+\s/, '')}</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
