'use client';

import { useState, useEffect, useMemo } from 'react';

// 🟢 Adicionamos userTier e a função onRedoAnalysis nas Props
export default function HistoryTab({ 
  token, 
  userTier = 1, 
  onRedoAnalysis 
}: { 
  token: string, 
  userTier?: number, 
  onRedoAnalysis?: (analysis: any) => void 
}) {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'go' | 'attention' | 'nogo'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const loadData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/analyses/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
          localStorage.clear();
          window.location.reload();
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

  const handleDeleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta análise? Esta ação não pode ser desfeita.")) return;

    try {
      const tokenLocal = localStorage.getItem('bawzi_token') || token;
      const res = await fetch(`${API_URL}/api/analyses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenLocal}` }
      });

      if (res.status === 401) {
        alert("Sua sessão expirou por segurança. Faça login novamente.");
        localStorage.clear();
        window.location.reload();
        return;
      }

      if (res.ok) {
        setAnalyses(prev => prev.filter((item: any) => item.id !== id));
        if (selectedAnalysis?.id === id) setSelectedAnalysis(null);
      } else {
        const error = await res.json();
        alert(error.detail || "Erro ao excluir a análise."); 
      }
    } catch (err) {
      alert("Erro de conexão. Tente novamente."); 
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

  if (!isMounted) return null;

  if (isLoading) return <div className="p-20 text-center animate-pulse text-slate-400 font-black uppercase tracking-widest text-xs">Carregando o cofre estratégico...</div>;

  // ============================================================================
  // MODO DETALHADO (TELA DE VISUALIZAÇÃO)
  // ============================================================================
  if (selectedAnalysis) {
    const res = selectedAnalysis;
    const isGo = res.score >= 70;
    const isAtention = res.score >= 45 && res.score < 70;

    // 🟢 LÓGICA DE UPGRADE DE ANÁLISE: Verifica se o Tier atual do utilizador é maior que o da análise salva
    // Assumimos que o backend guarda o 'tier' da análise. Se não guardar, assumimos 1 (básico).
    const analysisTier = res.tier || 1;
    const canRedo = userTier > analysisTier;

    return (
      <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-10 duration-700 pb-20">
        
        <div className="flex items-center justify-between bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-slate-200 sticky top-0 z-30 shadow-sm flex-wrap gap-3">
          <button 
            onClick={() => setSelectedAnalysis(null)}
            className="flex items-center gap-2 text-slate-500 hover:text-violet-600 font-black uppercase text-xs transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Voltar
          </button>
          <div className="flex items-center gap-3 md:gap-4 ml-auto">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">ID: {res.id.substring(0,8)}</span>
             <button onClick={(e) => toggleFavorite(e, res.id)} className={`text-xl md:text-2xl ${favorites.includes(res.id) ? 'text-amber-400' : 'text-slate-300'}`}>
               {favorites.includes(res.id) ? '★' : '☆'}
             </button>
          </div>
        </div>

        {/* 🟢 BANNER DE UPGRADE DE ANÁLISE (Só aparece se canRedo for TRUE) */}
        {canRedo && (
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-violet-500/20 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4">
            <div>
              <h4 className="font-black text-xl flex items-center gap-2 mb-2">
                <span className="text-2xl">🚀</span> Nova Inteligência Disponível!
              </h4>
              <p className="text-violet-100 text-sm font-medium leading-relaxed">
                Esta análise foi gerada com um motor de nível inferior (Tier {analysisTier}). Como você atualizou o seu plano para o <strong>Nível {userTier}</strong>, o nosso motor Multi-LLM pode processar este edital com muito mais profundidade e extrair riscos ocultos que o motor básico não viu.
              </p>
            </div>
            <button
              onClick={() => onRedoAnalysis && onRedoAnalysis(res)}
              className="w-full md:w-auto px-8 py-4 bg-white text-violet-900 font-black rounded-2xl hover:bg-slate-50 transition-all shrink-0 shadow-lg active:scale-95 whitespace-nowrap"
            >
              Refazer Análise Agora
            </button>
          </div>
        )}

        <div className="bg-white rounded-3xl md:rounded-[3rem] p-6 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start relative overflow-hidden break-words">
          <div className={`absolute top-0 left-0 w-full h-2 ${isGo ? 'bg-emerald-500' : isAtention ? 'bg-amber-500' : 'bg-red-500'}`}></div>
          
          <div className="flex-1 w-full">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-6">
              <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 md:px-4 md:py-2 rounded-xl uppercase tracking-widest border border-slate-200">
                <span>📅 {isMounted && res.created_at ? new Date(res.created_at).toLocaleDateString('pt-BR') : 'Processando...'}</span>
              </span>
              <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-3 py-1.5 md:px-4 md:py-2 rounded-xl uppercase tracking-widest border border-violet-100">
                🤖 {res.model_source || "Motor Bawzi"}
              </span>
              <span className="text-[10px] font-black text-slate-600 bg-slate-50 px-3 py-1.5 md:px-4 md:py-2 rounded-xl uppercase tracking-widest border border-slate-200">
                Tier {analysisTier}
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
              {res.title || "Análise de Edital"}
            </h1>
            
            <div className="flex flex-wrap items-center gap-3 mb-6 md:mb-8">
              <span className={`inline-block px-4 py-1.5 md:px-5 md:py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest ${
                res.classification?.includes('Força') || isGo ? 'bg-emerald-100 text-emerald-700' :
                res.classification?.includes('Atenção') || isAtention ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              }`}>
                {res.classification || "Não Classificado"}
              </span>
              
              {res.probabilidade_de_sucesso && (
                <span className={`inline-block px-4 py-1.5 md:px-5 md:py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border ${
                  String(res.probabilidade_de_sucesso).toLowerCase().includes('alta') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  String(res.probabilidade_de_sucesso).toLowerCase().includes('media') || String(res.probabilidade_de_sucesso).toLowerCase().includes('média') ? 'bg-amber-50 text-amber-600 border-amber-200' :
                  'bg-red-50 text-red-600 border-red-200'
                }`}>
                  Probabilidade: {res.probabilidade_de_sucesso}
                </span>
              )}
            </div>

            <p className="text-slate-600 text-base md:text-xl leading-relaxed font-medium mb-6 md:mb-8 break-words whitespace-pre-wrap">{res.summary}</p>
            
            {res.estimated_value && (
              <div className="inline-flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 text-slate-900 font-black text-base md:text-lg bg-slate-50 px-6 py-4 md:px-8 md:py-5 rounded-3xl md:rounded-[2rem] border border-slate-200 shadow-inner w-full sm:w-auto">
                <span className="text-2xl md:text-3xl text-emerald-500 hidden sm:block">💰</span>
                <div className="flex flex-col w-full break-words">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Valor Estimado</span>
                  <span className="break-all">{res.estimated_value}</span>
                </div>
              </div>
            )}
          </div>

          <div className={`shrink-0 w-32 h-32 md:min-w-[180px] md:h-[180px] rounded-full md:rounded-[3rem] border-4 md:border-8 flex flex-col items-center justify-center shadow-xl transition-transform hover:scale-105 duration-500 ${isGo ? 'text-emerald-600 border-emerald-500 bg-emerald-50' : isAtention ? 'text-amber-500 border-amber-400 bg-amber-50' : 'text-red-600 border-red-500 bg-red-50'}`}>
            <span className="text-5xl md:text-7xl font-black leading-none tracking-tighter">{res.score || 0}</span>
            <span className="text-[10px] md:text-xs font-black uppercase mt-1 md:mt-2 tracking-widest opacity-60">Score Geral</span>
          </div>
        </div>

        {/* 1. INTELIGÊNCIA COMPETITIVA & VEREDITO FINANCEIRO */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 h-full">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="text-lg">🎯</span> Recomendação / Rationale
            </h3>
            <p className="text-slate-700 leading-relaxed font-medium text-sm lg:text-base">
              {res.rationale || res.recommendation}
            </p>
          </div>

          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-8 rounded-[2rem] text-white shadow-xl h-full relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[50px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-colors"></div>
            <h3 className="text-[10px] font-black text-violet-200 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
              <span className="text-lg">👑</span> Inteligência Competitiva
            </h3>
            <p className="text-white/90 leading-relaxed font-medium text-sm lg:text-base mb-6 relative z-10">
              {res.recommendation}
            </p>
            {res.pricing_intelligence && (
              <div className="mt-auto bg-black/20 p-5 rounded-2xl border border-white/10 relative z-10">
                <h4 className="text-[10px] uppercase tracking-widest font-black text-violet-300 mb-2">Veredito Financeiro</h4>
                <p className="text-sm font-bold text-emerald-300">{res.pricing_intelligence.financial_verdict}</p>
                {res.pricing_intelligence.estimated_discount && (
                  <p className="text-xs text-white/70 mt-1">Deságio Médio: {res.pricing_intelligence.estimated_discount}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. PRAZOS E CRITÉRIOS DE JULGAMENTO */}
        {((res.prazos && res.prazos.length > 0) || (res.criterios_de_julgamento && res.criterios_de_julgamento.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {res.prazos && res.prazos.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-violet-200 transition-colors">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                  ⏱️ Linha do Tempo
                </h3>
                <ul className="space-y-3">
                  {res.prazos.map((prazo: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-600 font-medium flex items-start gap-3">
                      <span className="text-violet-500 mt-0.5 text-lg leading-none">•</span> {prazo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {res.criterios_de_julgamento && res.criterios_de_julgamento.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                  ⚖️ Critério de Julgamento
                </h3>
                <ul className="space-y-3">
                  {res.criterios_de_julgamento.map((criterio: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-600 font-medium flex items-start gap-3">
                      <span className="text-emerald-500 mt-0.5 text-lg leading-none">✓</span> {criterio}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 3. MATRIZ DE DECISÃO (SWOT RÁPIDO) */}
        {((res.vantagens && res.vantagens.length > 0) || (res.desvantagens && res.desvantagens.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {res.vantagens && res.vantagens.length > 0 && (
              <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
                <h3 className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                  👍 Vantagens Competitivas
                </h3>
                <ul className="space-y-3">
                  {res.vantagens.map((vantagem: string, idx: number) => (
                    <li key={idx} className="text-sm text-emerald-900 font-medium flex items-start gap-3">
                      <span className="text-emerald-500 font-bold">＋</span> {vantagem}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {res.desvantagens && res.desvantagens.length > 0 && (
              <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100">
                <h3 className="text-xs font-black text-orange-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                  👎 Desvantagens & Barreiras
                </h3>
                <ul className="space-y-3">
                  {res.desvantagens.map((desvantagem: string, idx: number) => (
                    <li key={idx} className="text-sm text-orange-900 font-medium flex items-start gap-3">
                      <span className="text-orange-500 font-bold">−</span> {desvantagem}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 4. REQUISITOS OPERACIONAIS */}
        {((res.exigencias_criticas && res.exigencias_criticas.length > 0) || (res.documentos_necessarios && res.documentos_necessarios.length > 0)) && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Carga Operacional</h3>
              <p className="text-slate-900 font-black text-lg">Exigências & Documentação Obrigatória</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              <div className="p-6 md:p-8">
                <h4 className="text-xs font-bold text-slate-800 mb-5 flex items-center gap-2">📌 Exigências Críticas</h4>
                <ul className="space-y-4">
                  {res.exigencias_criticas?.map((exigencia: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-600 font-medium flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0"></div>
                      {exigencia}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 md:p-8">
                <h4 className="text-xs font-bold text-slate-800 mb-5 flex items-center gap-2">📁 Documentos Chave</h4>
                <ul className="space-y-4">
                  {res.documentos_necessarios?.map((doc: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-600 font-medium flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0"></div>
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 5. MATRIZ DE RISCO */}
        <div className="mb-12">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2 flex items-center gap-2">
            <span className="text-lg">🛡️</span> Matriz de Riscos Críticos
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {res.risks?.length > 0 ? res.risks.map((risk: any, i: number) => {
              // 🟢 EXTRATOR BLINDADO (Tenta chaves conhecidas, se falhar, agarra no 1º valor do objeto)
              const tituloRisk = typeof risk === 'string' ? risk : (risk.titulo || risk.title || risk.risk || risk.perigo || risk.nome || risk.Risco || risk.Titulo || (Object.keys(risk || {}).length > 0 ? Object.values(risk)[0] as string : null));
              
              const trechoRisk = typeof risk === 'object' ? (risk.quote || risk.snippet || risk.texto || risk.trecho) : null;
              
              const impactoRisk = typeof risk === 'object' ? (risk.descricao || risk.impact || risk.consequence || risk.impacto || risk.consequencia || risk.Descricao || risk.Impacto || (Object.keys(risk || {}).length > 1 ? Object.values(risk)[1] as string : null)) : null;

              return (
                <div key={i} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-red-200 hover:shadow-md transition-all group relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                  <div className="flex items-start justify-between mb-4">
                    <span className="px-2.5 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-100">
                      Alto Risco
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 mb-3 leading-snug text-sm">
                    {tituloRisk || "Risco Identificado"}
                  </h4>
                  {trechoRisk && String(trechoRisk) !== String(tituloRisk) && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                      <p className="text-[11px] text-slate-600 font-medium italic leading-relaxed">"{trechoRisk}"</p>
                    </div>
                  )}
                  {impactoRisk && String(impactoRisk) !== String(tituloRisk) && (
                    <p className="text-xs text-slate-500 font-medium mt-auto pt-2 border-t border-slate-50">
                      <strong className="text-red-700">Impacto:</strong> {impactoRisk}
                    </p>
                  )}
                </div>
              );
            }) : (
              <p className="col-span-full text-emerald-600 font-bold bg-emerald-50 p-6 rounded-2xl border border-emerald-100">✓ Nenhum risco fatal identificado pela IA.</p>
            )}
          </div>
        </div>

        {/* 6. CHECKLIST DE AÇÃO */}
        {(res.checklist?.length ?? 0) > 0 && (
          <div className="mb-12">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2 flex items-center gap-2">
              <span className="text-lg">📋</span> Plano de Ação (Checklist)
            </h3>
            <div className="space-y-3">
              {res.checklist?.map((item: any, i: number) => {
                // 🟢 EXTRATOR BLINDADO PARA CHECKLIST
                const titulo = typeof item === 'string' ? item : (item.tarefa || item.title || item.task || item.item || item.acao || item.nome || item.Tarefa || (Object.keys(item || {}).length > 0 ? Object.values(item)[0] as string : null));
                
                const descricao = typeof item === 'object' ? (item.descricao || item.description || item.detalhe || item.contexto || item.obs || item.status || (Object.keys(item || {}).length > 1 ? Object.values(item)[1] as string : null)) : null;

                return (
                  <div key={i} className="flex gap-4 p-5 bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-300 rounded-2xl transition-all shadow-sm group">
                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 group-hover:border-violet-500 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                      <span className="text-[10px] font-black text-slate-400 group-hover:text-violet-500">{i + 1}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{titulo || "Ação Recomendada"}</h4>
                      {descricao && String(descricao) !== String(titulo) && (
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">{descricao}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button 
          onClick={() => { setSelectedAnalysis(null); window.scrollTo({top: 0, behavior: 'smooth'}); }}
          className="w-full py-5 md:py-6 bg-slate-900 text-white font-black rounded-3xl md:rounded-[2rem] hover:bg-violet-600 shadow-xl transition-all uppercase tracking-widest text-xs md:text-sm"
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
      <div className="flex flex-wrap items-center gap-2 mb-8 bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm">
        <button onClick={() => setActiveFilter('all')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Todos</button>
        <button onClick={() => setActiveFilter('favorites')} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeFilter === 'favorites' ? 'bg-amber-100 text-amber-800' : 'text-slate-400 hover:bg-slate-50'}`}>★ Favoritos</button>
        <div className="w-px h-6 bg-slate-200 mx-2"></div>
        <button onClick={() => setActiveFilter('go')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'go' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-50'}`}>🟢 Go</button>
        <button onClick={() => setActiveFilter('attention')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'attention' ? 'bg-amber-100 text-amber-800' : 'text-slate-400 hover:bg-slate-50'}`}>🟡 Atenção</button>
        <button onClick={() => setActiveFilter('nogo')} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFilter === 'nogo' ? 'bg-red-100 text-red-800' : 'text-slate-400 hover:bg-slate-50'}`}>🔴 No-Go</button>
      </div>

      {paginatedAnalyses.length === 0 ? (
        <div className="bg-white p-20 rounded-[3rem] border border-slate-100 text-center shadow-inner">
           <span className="text-5xl block mb-4 grayscale opacity-30">📂</span>
           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum registro encontrado para este filtro.</p>
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
                      <span>📅 {isMounted && item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '...'}</span>
                      <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                      <span className={score >= 70 ? 'text-emerald-500' : 'text-amber-500'}>{item.classification}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 md:gap-3 shrink-0 self-end md:self-auto mt-4 md:mt-0">
                  <button 
                    onClick={(e) => handleDeleteAnalysis(item.id, e)}
                    className="p-3 md:p-4 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Excluir Análise" 
                  >
                    🗑️
                  </button>
                  <button 
                    onClick={(e) => toggleFavorite(e, item.id)}
                    className={`p-3 md:p-4 rounded-2xl transition-all ${isFav ? 'bg-amber-100 text-amber-500 shadow-inner' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
                    title={isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
                  >
                    {isFav ? '★' : '☆'}
                  </button>
                  <div className="px-5 py-3 md:px-6 md:py-4 bg-slate-900 text-white font-black rounded-2xl group-hover:bg-violet-600 transition-all text-[10px] md:text-xs uppercase tracking-widest shadow-lg group-hover:shadow-violet-500/30">
                    Ver Detalhes
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}