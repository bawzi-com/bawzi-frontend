'use client';

import React, { useState, useEffect } from 'react';

interface PncpItem {
  id: string;
  cnpj: string;
  ano: number;
  sequencial: number;
  orgao: string;
  uf: string;
  objeto: string;
  valor: number;
  link: string;
}

interface PncpSearchProps {
  onAnalyzeOportunity: (textoCompleto: string) => void;
}

export default function PncpSearch({ onAnalyzeOportunity }: PncpSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [results, setResults] = useState<PncpItem[]>([]);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Garante que o componente só renderize dados localizados após montar no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  const formatCurrency = (value: number) => {
    // Se o valor for 0, null ou undefined, utilizamos a terminologia estratégica
    if (!value || value === 0) return "A Apurar (SRP / Sigiloso)"; 
    
    if (!mounted) return `R$ ${value.toFixed(2)}`;
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm || searchTerm.length < 3) return;

    setIsSearching(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/api/pncp/buscar?q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Falha na busca.');
      setResults(data.data || []);
      if (data.data?.length === 0) setError('Nenhuma licitação encontrada para este termo.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeepAnalyze = async (edital: PncpItem) => {
    setLoadingId(edital.id);
    try {
      // 🚀 Promessas Paralelas: Máxima velocidade para buscar o edital e a inteligência de preços
      const [resTexto, resMedia] = await Promise.all([
        fetch(`${API_URL}/api/pncp/texto-completo?cnpj=${edital.cnpj}&ano=${edital.ano}&seq=${edital.sequencial}`),
        fetch(`${API_URL}/api/pncp/media-precos?q=${encodeURIComponent(searchTerm)}`)
      ]);

      const dataTexto = await resTexto.json();
      const dataMedia = await resMedia.json();

      if (!resTexto.ok) throw new Error("Falha ao carregar itens detalhados.");

      // CONSTRUÇÃO DO SUPER PROMPT COM EFEITO UAU
      const prompt = `
DOCUMENTO OFICIAL PARA ANÁLISE DE RISCO E ESTRATÉGIA DE LICITAÇÃO
===================================================================

[1. DADOS CADASTRAIS DA OPORTUNIDADE]
• Órgão Comprador: ${edital.orgao}
• Localidade: ${edital.uf}
• Código de Controle (PNCP): ${edital.id}
• Valor Global Estimado: ${formatCurrency(edital.valor)}
• Link da Publicação Oficial: ${edital.link}

[2. OBJETO DO EDITAL (RESUMO)]
${edital.objeto}

[3. DETALHAMENTO TÉCNICO E REGRAS]
${dataTexto.texto}

[4. INTELIGÊNCIA DE MERCADO E HISTÓRICO (PNCP)]
${dataMedia.texto || "Sem histórico recente para estabelecer média."}

===================================================================
INSTRUÇÃO AO AVALIADOR (JUIZ FINAL DA BAWZI):
Você é um consultor de licitações de elite avaliando este edital. Gere uma triagem rápida, incisiva e altamente estratégica com foco nas PMEs. Responda incluindo:
1. Veredicto Claro (Go / No-Go).
2. Riscos Ocultos ou "Pegadinhas" no escopo.
3. PREVISÃO DE PREÇO VENCEDOR (Pricing Intelligence): Utilize os dados da "Inteligência de Mercado" acima para atuar como uma bússola financeira, indicando qual seria uma faixa de deságio competitivo para vencer este pregão sem prejuízo.
      `;

      // Envia para o Groq (via AnalysisApp) fazer a magia num instante
      onAnalyzeOportunity(prompt);
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  if (!mounted) return <div className="min-h-[200px] animate-pulse bg-slate-50 rounded-[2.5rem]" />;

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden">
      {/* Background simplificado para evitar erro 404 de assets em falta */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/20 to-transparent pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Radar PNCP</h2>
            <p className="text-sm text-slate-500 font-medium">Busca em tempo real no Governo Federal.</p>
          </div>
          <div className="bg-emerald-100 text-emerald-700 font-black px-3 py-1 rounded-lg text-[10px] uppercase border border-emerald-200">
            Online
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 mb-8">
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ex: Notebook, Limpeza, Obras..." 
            className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-violet-500 outline-none transition-all font-semibold text-slate-700"
          />
          <button 
            type="submit" 
            disabled={isSearching}
            className="bg-slate-950 text-white px-8 rounded-2xl font-black hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95"
          >
            {isSearching ? '...' : 'Buscar'}
          </button>
        </form>

        {error && <div className="mb-6 p-4 bg-amber-50 text-amber-700 rounded-2xl text-xs font-bold border border-amber-100">{error}</div>}

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {results.map((edital) => (
            <div key={edital.id} className="p-6 border border-slate-100 rounded-[1.5rem] bg-slate-50/30 hover:bg-white transition-all hover:shadow-lg group">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-1 rounded-md uppercase border border-violet-100">
                  {edital.uf} • {edital.ano}
                </span>
                <span className="text-sm font-black text-slate-900">
                  {formatCurrency(edital.valor)}
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-sm mb-2 line-clamp-1">{edital.orgao}</h3>
              <p className="text-slate-500 text-xs font-medium line-clamp-2 mb-5">{edital.objeto}</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => handleDeepAnalyze(edital)}
                  disabled={loadingId !== null}
                  className="flex-1 bg-violet-600 text-white font-black py-3 rounded-xl text-xs hover:bg-violet-700 transition-all disabled:bg-slate-300"
                >
                  {loadingId === edital.id ? 'A processar itens...' : 'Análise Profunda'}
                </button>
                {edital.link && (
                  <a 
                    href={edital.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-4 py-3 bg-white text-slate-700 font-bold rounded-xl text-xs border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center"
                  >
                    Abrir Edital
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}