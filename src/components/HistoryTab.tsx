'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  Star,
  Trash2,
  XCircle,
  Download,
  Filter,
} from 'lucide-react';
import AnalysisResults from './AnalysisResults';
import { AnalysisResult } from './analysis-types';
import type { SavedAnalysis } from '@/lib/types';

export default function HistoryTab({
  token,
  userTier = 1,
  onRedoAnalysis
}: {
  token: string;
  userTier?: number;
  onRedoAnalysis?: (analysis: SavedAnalysis) => void;
}) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isDeletingOne, setIsDeletingOne] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteAllText, setDeleteAllText] = useState('');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareTargetEmail, setShareTargetEmail] = useState('');
  const [isSharingSelected, setIsSharingSelected] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'go' | 'attention' | 'nogo'>('all');
  const [detailTab, setDetailTab] = useState<'analise' | 'concorrentes'>('analise');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // ── Filtros avançados ────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [periodoFiltro, setPeriodo] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const loadData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analyses/history`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.status === 401) {
          window.dispatchEvent(new CustomEvent('bawzi_session_expired'));
          return;
        }

        const data = await res.json();
        const historicoReal = data.history || (Array.isArray(data) ? data : []);
        if (Array.isArray(historicoReal)) setAnalyses(historicoReal);

        const savedFavs = localStorage.getItem('bawzi_favorites');
        if (savedFavs) setFavorites(JSON.parse(savedFavs));
      } catch (err) {
        console.error("Erro ao carregar histórico:", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (token) loadData();
    else setIsLoading(false);
  }, [token, API_URL]);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const newFavs = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem('bawzi_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const handleDeleteAnalysis = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  const confirmDeleteAnalysis = async () => {
    if (!deleteTargetId || isDeletingOne) return;

    setIsDeletingOne(true);
    try {
      const tokenLocal = localStorage.getItem('bawzi_token') || token;
      const res = await fetch(`${API_URL}/api/analyses/${deleteTargetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenLocal}` }
      });

      if (res.status === 401) {
        setNotice({ type: 'error', message: 'Sua sessão expirou por segurança. Faça login novamente.' });
        localStorage.clear();
        window.location.reload();
        return;
      }

      if (res.ok) {
        setAnalyses(prev => prev.filter(item => item.id !== deleteTargetId));
        if (selectedAnalysis?.id === deleteTargetId) setSelectedAnalysis(null);
        setDeleteTargetId(null);
        setNotice({ type: 'success', message: 'Análise excluída do histórico.' });
      } else {
        const error = await res.json();
        setNotice({ type: 'error', message: error.detail || 'Erro ao excluir a análise.' });
      }
    } catch (err) {
      setNotice({ type: 'error', message: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsDeletingOne(false);
    }
  };

  const handleDeleteAllAnalyses = () => {
    if (analyses.length === 0 || isDeletingAll) return;
    setDeleteAllText('');
    setIsDeleteAllOpen(true);
  };

  const confirmDeleteAllAnalyses = async () => {
    if (analyses.length === 0 || isDeletingAll || deleteAllText !== 'EXCLUIR') return;

    setIsDeletingAll(true);
    try {
      const tokenLocal = localStorage.getItem('bawzi_token') || token;
      const res = await fetch(`${API_URL}/api/analyses/history/all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenLocal}` }
      });

      if (res.status === 401) {
        setNotice({ type: 'error', message: 'Sua sessão expirou por segurança. Faça login novamente.' });
        localStorage.clear();
        window.location.reload();
        return;
      }

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setNotice({ type: 'error', message: error?.detail || 'Erro ao excluir o histórico.' });
        return;
      }

      setAnalyses([]);
      setSelectedAnalysis(null);
      setFavorites([]);
      setCurrentPage(1);
      localStorage.removeItem('bawzi_favorites');
      setIsDeleteAllOpen(false);
      setDeleteAllText('');
      setNotice({ type: 'success', message: 'Histórico excluído com sucesso.' });
    } catch (err) {
      setNotice({ type: 'error', message: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleShareSelectedAnalysis = async () => {
    if (!selectedAnalysis?.id) return;
    setShareTargetEmail('');
    setIsShareOpen(true);
  };

  const confirmShareSelectedAnalysis = async () => {
    if (!selectedAnalysis?.id || !shareTargetEmail.includes('@') || isSharingSelected) return;

    setIsSharingSelected(true);
    try {
      const tokenLocal = localStorage.getItem('bawzi_token') || token;
      const res = await fetch(`${API_URL}/api/analyses/${selectedAnalysis.id}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenLocal}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_email: shareTargetEmail }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setNotice({ type: 'error', message: error?.detail || 'Erro ao compartilhar a análise.' });
        return;
      }

      setIsShareOpen(false);
      setShareTargetEmail('');
      setNotice({ type: 'success', message: 'Análise compartilhada com sucesso.' });
    } catch {
      setNotice({ type: 'error', message: 'Erro de conexão. Tente novamente.' });
    } finally {
      setIsSharingSelected(false);
    }
  };

  const filteredAnalyses = useMemo(() => {
    const now = Date.now();
    const periodoMs: Record<string, number> = {
      '7d':  7  * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    };
    const search = searchText.toLowerCase().trim();

    return analyses.filter(item => {
      const score = item.score || 0;

      // Filtro de veredito
      if (activeFilter === 'favorites' && !favorites.includes(item.id)) return false;
      if (activeFilter === 'go' && score < 70) return false;
      if (activeFilter === 'attention' && !(score >= 45 && score < 70)) return false;
      if (activeFilter === 'nogo' && score >= 45) return false;

      // Filtro de período
      if (periodoFiltro !== 'all' && item.created_at) {
        const age = now - new Date(item.created_at).getTime();
        if (age > periodoMs[periodoFiltro]) return false;
      }

      // Busca por texto (título, termo, classificação, UF)
      if (search) {
        const haystack = [
          item.title, item.termo_busca_pncp, item.classification,
          item.uf, item.estado, item.estimated_value,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [analyses, activeFilter, favorites, periodoFiltro, searchText]);

  const totalPages = Math.ceil(filteredAnalyses.length / itemsPerPage);
  const paginatedAnalyses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAnalyses.slice(start, start + itemsPerPage);
  }, [filteredAnalyses, currentPage]);

  const renderHistoryModals = () => (
    <>
      {notice && (
        <div className={`fixed bottom-5 right-5 z-[130] max-w-sm rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${
          notice.type === 'success'
            ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
            : notice.type === 'error'
              ? 'border-red-100 bg-red-50 text-red-800'
              : 'border-sky-100 bg-sky-50 text-sky-800'
        }`}>
          <div className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current opacity-70" />
            <p className="leading-relaxed">{notice.message}</p>
            <button
              onClick={() => setNotice(null)}
              className="ml-2 text-current opacity-50 transition-opacity hover:opacity-100"
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {deleteTargetId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-950">Excluir esta análise?</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              Ela será removida do histórico e esta ação não poderá ser desfeita.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteAnalysis}
                disabled={isDeletingOne}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingOne ? 'Excluindo...' : 'Excluir análise'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteAllOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-950">Excluir todo o histórico?</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              Todas as {analyses.length} análises salvas serão apagadas. Digite <strong className="text-slate-900">EXCLUIR</strong> para confirmar.
            </p>
            <input
              value={deleteAllText}
              onChange={(e) => setDeleteAllText(e.target.value)}
              placeholder="EXCLUIR"
              className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-500/10"
            />
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setIsDeleteAllOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteAllAnalyses}
                disabled={isDeletingAll || deleteAllText !== 'EXCLUIR'}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeletingAll ? 'Excluindo...' : 'Excluir tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isShareOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <ArrowRight size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-950">Compartilhar análise</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              Envie este detalhe para um e-mail do time ou da diretoria.
            </p>
            <input
              type="email"
              value={shareTargetEmail}
              onChange={(e) => setShareTargetEmail(e.target.value)}
              placeholder="email@empresa.com"
              className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
            />
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setIsShareOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmShareSelectedAnalysis}
                disabled={isSharingSelected || !shareTargetEmail.includes('@')}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSharingSelected ? 'Enviando...' : 'Compartilhar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (!isMounted) return null;

  if (isLoading) return <div className="p-20 text-center animate-pulse text-slate-400 font-black uppercase tracking-widest text-xs">Carregando o cofre estratégico...</div>;

  // ============================================================================
  // MODO DETALHADO (TELA DE VISUALIZAÇÃO)
  // ============================================================================
  if (selectedAnalysis) {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500 pb-16">
        {renderHistoryModals()}
        <div className="sticky top-0 z-30 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => {
              setSelectedAnalysis(null);
              setDetailTab('analise');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase text-slate-600 transition-all hover:border-slate-300 hover:text-slate-950"
          >
            ← Voltar ao histórico
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400">
              Histórico salvo
            </span>
            <button
              onClick={(e) => toggleFavorite(e, selectedAnalysis.id)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-[11px] font-black uppercase transition-all ${
                favorites.includes(selectedAnalysis.id)
                  ? 'border-amber-100 bg-amber-50 text-amber-600'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-amber-100 hover:bg-amber-50 hover:text-amber-600'
              }`}
            >
              <Star size={14} fill={favorites.includes(selectedAnalysis.id) ? 'currentColor' : 'none'} />
              Favorito
            </button>
          </div>
        </div>

        <AnalysisResults
          result={selectedAnalysis as AnalysisResult}
          activeTab={detailTab}
          onSetActiveTab={(tab) => setDetailTab(tab === 'concorrentes' ? 'concorrentes' : 'analise')}
          userTier={Math.max(userTier, Number(typeof window !== 'undefined' ? localStorage.getItem('bawzi_tier') || 1 : 1))}
          currentTier={Math.max(userTier, Number(typeof window !== 'undefined' ? localStorage.getItem('bawzi_tier') || 1 : 1))}
          termoAlvo={selectedAnalysis.termo_busca_pncp || selectedAnalysis.title || 'Histórico'}
          analysisId={selectedAnalysis.id}
          token={token}
          isSharing={false}
          onShare={handleShareSelectedAnalysis}
          onReset={() => {
            setSelectedAnalysis(null);
            setDetailTab('analise');
          }}
          resetLabel="Voltar ao histórico"
          onExportPDF={() => window.print()}
          modelSource={selectedAnalysis.model_source || selectedAnalysis.modelSource || 'Motor Bawzi IA'}
          isCachedResult={false}
          onUpgradeClick={() => setNotice({ type: 'info', message: 'Faça upgrade pelo painel de planos para desbloquear este recurso.' })}
        />
      </div>
    );

  }

  // ==========================================
  // LISTAGEM COM FILTROS E PAGINAÇÃO
  // ==========================================

  // ── Exportar para CSV ────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!analyses.length) return;

    const escape = (v: unknown) => {
      const s = String(v ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const header = ['Título', 'Score', 'Classificação', 'Data', 'Valor Estimado', 'UF', 'Termo PNCP', 'ID'];
    const rows = filteredAnalyses.map(item => [
      item.title || '',
      item.score ?? '',
      item.classification || '',
      item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '',
      item.estimated_value || '',
      item.uf || item.estado || '',
      item.termo_busca_pncp || '',
      item.id || '',
    ].map(escape));

    const csv = [header.map(escape).join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `bawzi-historico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreColors = (score: number) =>
    score >= 70
      ? { bar: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-100', label: 'Go' }
      : score >= 45
      ? { bar: 'bg-amber-400', text: 'text-amber-700', light: 'bg-amber-50', border: 'border-amber-100', label: 'Atenção' }
      : { bar: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50', border: 'border-red-100', label: 'No-Go' };

  const totalAnalyses = analyses.length;
  const goCount = analyses.filter(item => (item.score || 0) >= 70).length;
  const attentionCount = analyses.filter(item => (item.score || 0) >= 45 && (item.score || 0) < 70).length;
  const noGoCount = analyses.filter(item => (item.score || 0) < 45).length;
  const favoriteCount = analyses.filter(item => favorites.includes(item.id)).length;

  const filterOptions = [
    { key: 'all', label: 'Todos', count: totalAnalyses, Icon: FileText, activeClass: 'bg-emerald-600 text-white border-emerald-600' },
    { key: 'favorites', label: 'Favoritos', count: favoriteCount, Icon: Star, activeClass: 'bg-amber-500 text-white border-amber-500' },
    { key: 'go', label: 'Go', count: goCount, Icon: CheckCircle2, activeClass: 'bg-emerald-600 text-white border-emerald-600' },
    { key: 'attention', label: 'Atenção', count: attentionCount, Icon: Clock3, activeClass: 'bg-amber-500 text-white border-amber-500' },
    { key: 'nogo', label: 'No-Go', count: noGoCount, Icon: XCircle, activeClass: 'bg-red-600 text-white border-red-600' },
  ] as const;

  return (
    <div className="animate-in fade-in duration-500 space-y-5">
      {renderHistoryModals()}

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 bg-gradient-to-br from-white via-slate-50 to-emerald-50/50 p-5 md:grid-cols-[1fr_auto] md:p-7">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-[11px] font-black uppercase text-emerald-700 shadow-sm">
              <Clock3 size={13} />
              Histórico estratégico
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Análises salvas</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              Reveja decisões anteriores, filtre por veredito e retome oportunidades que ainda fazem sentido.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:min-w-[430px]">
            {[
              { label: 'Total', value: totalAnalyses, tone: 'text-slate-900 bg-white border-slate-200' },
              { label: 'Go', value: goCount, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
              { label: 'Atenção', value: attentionCount, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
              { label: 'No-Go', value: noGoCount, tone: 'text-red-700 bg-red-50 border-red-100' },
            ].map(({ label, value, tone }) => (
              <div key={label} className={`rounded-2xl border p-3 shadow-sm ${tone}`}>
                <p className="text-2xl font-black leading-none">{value}</p>
                <p className="mt-1 text-[10px] font-black uppercase text-current opacity-60">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Barra de filtros ────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 bg-white p-3 space-y-3">
          {/* Linha 1: busca + filtros avançados toggle + exportar + excluir */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Busca por texto */}
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar por título, órgão, UF ou termo..."
                className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Toggle filtros avançados */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-black uppercase transition-all ${showFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white'}`}
              >
                <Filter size={12} />
                Filtros
              </button>

              {/* Exportar CSV */}
              <button
                onClick={exportCSV}
                disabled={filteredAnalyses.length === 0}
                title="Exportar como CSV"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-black uppercase transition-all hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={12} />
                CSV
              </button>

              {/* Excluir tudo */}
              <button
                onClick={handleDeleteAllAnalyses}
                disabled={totalAnalyses === 0 || isDeletingAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-100 bg-red-50 text-red-700 text-xs font-black uppercase transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={12} />
                {isDeletingAll ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>

          {/* Linha 2: filtros avançados (colapsável) */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
              {/* Período */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período:</span>
                {(['all','7d','30d','90d'] as const).map(p => (
                  <button key={p} onClick={() => { setPeriodo(p); setCurrentPage(1); }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all border ${periodoFiltro === p ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white'}`}>
                    {p === 'all' ? 'Tudo' : p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Linha 3: filtros veredito */}
          <div className="flex flex-wrap gap-2">
            {filterOptions.map(({ key, label, count, Icon, activeClass }) => (
              <button
                key={key}
                onClick={() => { setActiveFilter(key); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-[11px] font-black uppercase transition-all ${
                  activeFilter === key ? activeClass : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Icon size={12} />
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeFilter === key ? 'bg-white/20 text-current' : 'bg-white text-slate-400'}`}>
                  {count}
                </span>
              </button>
            ))}
            {(searchText || periodoFiltro !== 'all') && (
              <span className="inline-flex items-center px-2.5 py-1.5 rounded-2xl bg-violet-50 border border-violet-100 text-violet-700 text-[10px] font-black">
                {filteredAnalyses.length} resultado{filteredAnalyses.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {paginatedAnalyses.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white py-20 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <Search size={24} />
          </div>
          <h3 className="text-lg font-black text-slate-800">Nada por aqui ainda</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Nenhuma análise encontrada para o filtro selecionado.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {paginatedAnalyses.map((item) => {
            const score = item.score || 0;
            const isFav = favorites.includes(item.id);
            const c = scoreColors(score);
            const createdDate = isMounted && item.created_at
              ? new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
              : '...';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedAnalysis(item)}
                className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className={`h-1.5 ${c.bar}`} />
                <div className="grid gap-4 p-4 md:grid-cols-[112px_minmax(0,1fr)_auto] md:items-center md:p-5">
                  <div className={`flex items-center justify-between rounded-2xl border p-3 md:block md:text-center ${c.light} ${c.border}`}>
                    <div>
                      <span className={`block text-3xl font-black leading-none ${c.text}`}>{score}</span>
                      <span className="mt-1 block text-[9px] font-black uppercase text-slate-400">score</span>
                    </div>
                    <span className={`rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase md:mt-3 md:inline-block ${c.text}`}>
                      {c.label}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                        <CalendarDays size={12} />
                        {createdDate}
                      </span>
                      {item.model_source && (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-600">
                          {item.model_source}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black leading-snug text-slate-950 transition-colors group-hover:text-emerald-700">
                      {item.title || 'Análise de edital'}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-relaxed text-slate-500">
                      {item.summary || item.recommendation || 'Abra esta análise para rever o veredito, riscos e próximos passos.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 md:justify-end">
                    <button
                      onClick={(e) => handleDeleteAnalysis(item.id, e)}
                      title="Excluir análise"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      onClick={(e) => toggleFavorite(e, item.id)}
                      title={isFav ? 'Remover favorito' : 'Favoritar'}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-all ${
                        isFav
                          ? 'border-amber-100 bg-amber-50 text-amber-500'
                          : 'border-slate-200 text-slate-400 hover:border-amber-100 hover:bg-amber-50 hover:text-amber-500'
                      }`}
                    >
                      <Star size={16} fill={isFav ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-[11px] font-black uppercase text-white transition-all hover:bg-emerald-700"
                    >
                      Abrir
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-[2rem] border border-slate-100 shadow-sm px-6 py-4">
          <button
            onClick={() => { setCurrentPage(p => Math.max(p - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← Anterior
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
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
                    onClick={() => { setCurrentPage(p as number); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`w-8 h-8 text-xs font-black rounded-lg transition-all ${
                      currentPage === p
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
          </div>

          <button
            onClick={() => { setCurrentPage(p => Math.min(p + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={currentPage === totalPages}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
