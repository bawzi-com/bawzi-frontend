'use client';

import { useState, useEffect, useMemo } from 'react';

export default function HistoryTab({ token }: { token: string }) {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'go' | 'attention' | 'nogo'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/analyses/history', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
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
  }, [token]);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const newFavs = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem('bawzi_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const handleDeleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita abrir os detalhes do cartão

    if (!confirm("Tem a certeza que deseja eliminar esta análise? Esta ação não pode ser desfeita.")) return;

    try {
      // Usando a variável de ambiente para funcionar na nuvem (ou localhost)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const tokenLocal = localStorage.getItem('bawzi_token') || token;
      
      const res = await fetch(`${API_URL}/api/analyses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenLocal}` }
      });

      if (res.ok) {
        // Remove do ecrã instantaneamente
        setAnalyses(prev => prev.filter((item: any) => item.id !== id));
      } else {
        const error = await res.json();
        alert(error.detail || "Erro ao eliminar a análise.");
      }
    } catch (err) {
      console.error("Falha ao eliminar:", err);
      alert("Erro de ligação. Tente novamente.");
    }
  };

  const filteredAnalyses = useMemo(() => {
    return analyses.filter(item => {
      const score = item.score || 0;
      if (activeFilter === 'favorites') return favorites.includes(item.id);
      if (activeFilter === 'go') return score >= 70;
      if (activeFilter === 'attention') return score >= 45 && score < 70;
      if (activeFilter === 'nogo') return score < 45;
      return true;
    });
  }, [analyses, activeFilter, favorites]);

  const totalPages = Math.ceil(filteredAnalyses.length / itemsPerPage);
  const paginatedAnalyses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAnalyses.slice(start, start + itemsPerPage);
  }, [filteredAnalyses, currentPage]);

  if (isLoading) return <div className="p-20 text-center animate-pulse text-slate-400 font-black uppercase tracking-widest text-xs">A carregar o cofre estratégico...</div>;

  // ============================================================================
  // MODO DETALHADO COMPLETÍSSIMO
  // ============================================================================
  if (selectedAnalysis) {
    const res = selectedAnalysis;
    const isGo = res.score >= 70;
    const isAtention = res.score >= 45 && res.score < 70;

    return (
      <div className="space-y-8 animate-in slide-in-from-right-10 duration-700 pb-20">
        
        {/* HEADER DE NAVEGAÇÃO */}
        <div className="flex items-center justify-between bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-slate-200 sticky top-0 z-30 shadow-sm">
          <button 
            onClick={() => setSelectedAnalysis(null)}
            className="flex items-center gap-2 text-slate-500 hover:text-violet-600 font-black uppercase text-xs transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Voltar ao Histórico
          </button>
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {res.id.substring(0,8)}</span>
             <button onClick={(e) => toggleFavorite(e, res.id)} className={`text-xl ${favorites.includes(res.id) ? 'text-amber-400' : 'text-slate-300'}`}>
               {favorites.includes(res.id) ? '★' : '☆'}
             </button>
          </div>
        </div>

        {/* CARD PRINCIPAL - RESUMO E SCORE */}
        <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row gap-10 items-start relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-2 ${isGo ? 'bg-emerald-500' : isAtention ? 'bg-amber-500' : 'bg-red-500'}`}></div>
          
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-4 py-2 rounded-xl uppercase tracking-widest border border-slate-200">
                📅 {new Date(res.created_at || Date.now()).toLocaleDateString()}
              </span>
              <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-4 py-2 rounded-xl uppercase tracking-widest border border-violet-100">
                🤖 {res.model_source || "Motor Bawzi"}
              </span>
              {res.effort && (
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl uppercase tracking-widest border border-blue-100">
                  Esforço: {res.effort}
                </span>
              )}
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
              {res.title || "Análise de Edital"}
            </h1>
            
            <span className={`inline-block px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-8 ${
              res.classification?.includes('Força') ? 'bg-emerald-100 text-emerald-700' :
              res.classification?.includes('Atenção') ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
              {res.classification || "Não Classificado"}
            </span>

            <p className="text-slate-600 text-xl leading-relaxed font-medium mb-8">{res.summary}</p>
            
            {res.estimated_value && (
              <div className="inline-flex items-center gap-4 text-slate-900 font-black text-lg bg-slate-50 px-8 py-5 rounded-[2rem] border border-slate-200 shadow-inner">
                <span className="text-3xl text-emerald-500">💰</span>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Valor Estimado do Contrato</span>
                  <span>{res.estimated_value}</span>
                </div>
              </div>
            )}
          </div>

          <div className={`shrink-0 self-center md:self-start min-w-[180px] h-[180px] rounded-[3rem] border-8 flex flex-col items-center justify-center shadow-xl transition-transform hover:scale-105 duration-500 ${isGo ? 'text-emerald-600 border-emerald-500 bg-emerald-50' : isAtention ? 'text-amber-500 border-amber-400 bg-amber-50' : 'text-red-600 border-red-500 bg-red-50'}`}>
            <span className="text-7xl font-black leading-none tracking-tighter">{res.score || 0}</span>
            <span className="text-xs font-black uppercase mt-2 tracking-widest opacity-60">Score Geral</span>
          </div>
        </div>

        {/* RECOMENDAÇÃO E GRID DE DETALHES */}
        <div className="grid md:grid-cols-2 gap-8">
          
          <div className="bg-white rounded-[3rem] p-10 shadow-lg border border-slate-100 flex flex-col">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-4">
              <span className="text-3xl">💡</span> Recomendação de Ação
            </h3>
            <div className="flex-1 bg-amber-50/50 p-8 rounded-[2rem] border border-amber-100/50">
              <p className="text-slate-800 font-bold text-lg leading-relaxed">{res.recommendation}</p>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-10 shadow-lg border border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-4">
              <span className="text-3xl text-red-500">🛡️</span> Matriz de Riscos Fatais
            </h3>
            <div className="space-y-4">
              {res.risks?.length > 0 ? res.risks.map((risk: any, i: number) => {
                const title = typeof risk === 'string' ? risk : (risk.title || 'Risco Detectado');
                const quote = typeof risk === 'object' ? (risk.quote || risk.description) : null;
                return (
                  <div key={i} className="p-6 bg-red-50/40 rounded-3xl border border-red-100/50 group hover:bg-red-50 transition-colors">
                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 font-black text-xs">!</div>
                      <div>
                        <strong className="text-red-950 text-sm block mb-1 font-black">{title}</strong>
                        {quote && <p className="text-red-800/70 text-xs italic leading-relaxed">"{quote}"</p>}
                      </div>
                    </div>
                  </div>
                );
              }) : <p className="text-emerald-600 font-bold bg-emerald-50 p-6 rounded-2xl border border-emerald-100">✓ Nenhum risco fatal identificado pela IA.</p>}
            </div>
          </div>
        </div>

        <button 
          onClick={() => { setSelectedAnalysis(null); window.scrollTo({top: 0, behavior: 'smooth'}); }}
          className="w-full py-6 bg-slate-900 text-white font-black rounded-[2rem] hover:bg-violet-600 shadow-xl transition-all uppercase tracking-widest text-sm"
        >
          Fechar e Voltar à Lista
        </button>
      </div>
    );
  }

  // ==========================================
  // LISTAGEM COM FILTROS E PAGINAÇÃO
  // ==========================================
  return (
    <div className="animate-in fade-in duration-500">
      
      {/* BARRA DE FILTROS */}
      <div className="flex flex-wrap items-center gap-2 mb-8 bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm">
        <button onClick={() => setActiveFilter('all')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
          Todos
        </button>
        <button onClick={() => setActiveFilter('favorites')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeFilter === 'favorites' ? 'bg-amber-100 text-amber-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          ★ Favoritos
        </button>
        <div className="w-px h-6 bg-slate-200 mx-2"></div>
        <button onClick={() => setActiveFilter('go')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'go' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          🟢 Go
        </button>
        <button onClick={() => setActiveFilter('attention')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'attention' ? 'bg-amber-100 text-amber-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          🟡 Atenção
        </button>
        <button onClick={() => setActiveFilter('nogo')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'nogo' ? 'bg-red-100 text-red-800' : 'text-slate-400 hover:bg-slate-50'}`}>
          🔴 No-Go
        </button>
      </div>

      {/* LISTAGEM */}
      {paginatedAnalyses.length === 0 ? (
        <div className="bg-white p-20 rounded-[3rem] border border-slate-100 text-center shadow-inner">
           <span className="text-5xl block mb-4 grayscale opacity-30">📂</span>
           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum registo encontrado para este filtro.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedAnalyses.map((item) => {
            const score = item.score || 0;
            const isFav = favorites.includes(item.id);
            return (
              <div 
                key={item.id} 
                onClick={() => setSelectedAnalysis(item)}
                className="bg-white p-6 rounded-[2rem] border border-slate-200 hover:border-violet-400 hover:shadow-xl transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer overflow-hidden"
              >
                {/* LADO ESQUERDO: SCORE E TÍTULO */}
                <div className="flex items-center gap-6">
                  <div className={`h-16 w-16 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2 ${
                    score >= 70 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                    score >= 45 ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'
                  }`}>
                    <span className="text-2xl font-black">{score}</span>
                    <span className="text-[8px] font-black uppercase opacity-60">Score</span>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 leading-tight group-hover:text-violet-700 transition-colors text-lg line-clamp-1">
                      {item.title || "Sem Título"}
                    </h3>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      <span>📅 {new Date(item.created_at).toLocaleDateString()}</span>
                      <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                      <span className={score >= 70 ? 'text-emerald-500' : 'text-amber-500'}>{item.classification}</span>
                    </div>
                  </div>
                </div>
                
                {/* LADO DIREITO: BOTÕES ALINHADOS (Eliminar, Favorito, Detalhes) */}
                <div className="flex items-center gap-2 md:gap-3 shrink-0 self-end md:self-auto mt-4 md:mt-0">
                  
                  {/* Botão Eliminar */}
                  <button 
                    onClick={(e) => handleDeleteAnalysis(item.id, e)}
                    className="p-3 md:p-4 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Eliminar Análise"
                  >
                    🗑️
                  </button>

                  {/* Botão Favorito */}
                  <button 
                    onClick={(e) => toggleFavorite(e, item.id)}
                    className={`p-3 md:p-4 rounded-2xl transition-all ${isFav ? 'bg-amber-100 text-amber-500 shadow-inner' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
                    title={isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
                  >
                    {isFav ? '★' : '☆'}
                  </button>

                  {/* Botão Ver Detalhes */}
                  <div className="px-5 py-3 md:px-6 md:py-4 bg-slate-900 text-white font-black rounded-2xl group-hover:bg-violet-600 transition-all text-[10px] md:text-xs uppercase tracking-widest shadow-lg group-hover:shadow-violet-500/30">
                    Ver Detalhes
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* PAGINAÇÃO */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-12 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <button 
            onClick={() => { setCurrentPage(p => Math.max(p - 1, 1)); window.scrollTo({top: 0}); }}
            disabled={currentPage === 1}
            className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Anterior
          </button>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pág <span className="text-slate-900">{currentPage}</span> / {totalPages}</span>
          <button 
            onClick={() => { setCurrentPage(p => Math.min(p + 1, totalPages)); window.scrollTo({top: 0}); }}
            disabled={currentPage === totalPages}
            className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Seguinte
          </button>
        </div>
      )}

    </div>
  );
}