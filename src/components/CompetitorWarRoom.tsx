'use client';

import React, { useState, useMemo } from 'react';
import { ShieldAlert, Zap, Target, FileSearch, Award, Globe, MapPin, Scale, SearchX, ArrowLeft, Crosshair, AlertTriangle, ListFilter, X, Clipboard, Eye, Building2 } from 'lucide-react';
import ReverseEngineeringBlock from './ReverseEngineeringBlock';
import CompliancePanel from './CompliancePanel';

interface CompetitorWarRoomProps {
  competitorsNacionais?: any[];
  competitorsRegionais?: any[];
  uf?: string;
  pricing?: any;
  analysisId?: string;
  userTier?: number;
  fullResult?: any;
}

export default function CompetitorWarRoom({ 
  competitorsNacionais = [], 
  competitorsRegionais = [], 
  uf = "GO",
  pricing = {}, 
  analysisId, 
  userTier = 1,
  fullResult = {}
}: CompetitorWarRoomProps) {
  
  const [view, setView] = useState<'radar' | 'operation'>('radar');
  const [abaConcorrentes, setAbaConcorrentes] = useState<'nacional' | 'regional'>('nacional');
  const [target, setTarget] = useState<any>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [offensiveData, setOffensiveData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedItemIdx, setSelectedItemIdx] = useState<number>(0);
  const [dossieTarget, setDossieTarget] = useState<any>(null); 

  const extrairValorExato = (textoBase: any): number => {
    if (!textoBase) return 0;
    if (typeof textoBase === 'number' && textoBase > 0) return textoBase;
    const texto = String(textoBase);
    const matches = [...texto.matchAll(/R\$\s*([\d\.,]+)/g)];
    if (matches.length > 0) {
      return parseFloat(matches[0][1].replace(/\./g, '').replace(',', '.'));
    }
    const justNumbers = parseFloat(texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
    return isNaN(justNumbers) ? 0 : justNumbers;
  };

  const valorEstimatedSeguro = extrairValorExato(pricing?.valor_estimado_raw) 
                           || extrairValorExato(fullResult?.estimated_value) 
                           || extrairValorExato(fullResult?.summary) 
                           || 0;

  const nomeObjetoReal = fullResult?.objeto 
                      || pricing?.objeto 
                      || fullResult?.object 
                      || fullResult?.title
                      || "Objeto da Licitação";

  const itensLotes = useMemo(() => {
    if (pricing?.itens_lotes && Array.isArray(pricing.itens_lotes) && pricing.itens_lotes.length > 0) {
      return pricing.itens_lotes;
    }
    return [{
      numero: "Lote Global",
      produto: nomeObjetoReal, 
      valor_estimado_raw: valorEstimatedSeguro,
      desagioPreditivoOrgao: pricing?.desagioPreditivoOrgao || 0
    }];
  }, [pricing, valorEstimatedSeguro, nomeObjetoReal]);

  const currentItem = itensLotes[selectedItemIdx] || itensLotes[0];

  // 🟢 PARSER ULTRA RESILIENTE: Mapeia Strings, Arrays de Strings e Objetos sem quebrar nunca
  const parseCompetitors = (rawList: any[], tipo: 'nacional' | 'regional') => {
    if (!Array.isArray(rawList)) return [];
    
    return rawList.map(item => {
      let nome = "Empresa não identificada";
      let vitorias = "0";
      let cnpj = "";
      let prob = "";
      let forca = "";
      
      let porte = "DEMAIS";
      let municipio = "Não Informado";

      // Mapeamento em cascata para cobrir qualquer variação de chave vinda do seu MongoDB ou API
      let contratosRaw = item.contratos 
                      || item.ultimos_contratos 
                      || item.historico_contratos 
                      || item.historico 
                      || item.vitorias_detalhes
                      || item.texto_contratos;

      if (typeof item === 'string') {
        const match = item.match(/(.*?)\s*\(([\d]+)\s*vitórias?\)(?:\s*-\s*CNPJ:\s*([\d]+))?/i);
        if (match) { nome = match[1].trim(); vitorias = match[2] || "0"; cnpj = match[3] || ""; } 
        else { nome = item; }
      } else {
        nome = item.empresa || item.nome || item.razao_social || "Empresa não identificada";
        vitorias = item.vitorias || item.quantidade_vitorias || "0";
        cnpj = item.cnpj || item.cnpj_empresa || ""; 
        prob = item.probabilidade || ""; 
        forca = item.forca || item.nivel_forca || "";
        porte = item.porte || item.porte_empresa || "DEMAIS";
        municipio = item.municipio || item.cidade || item.municipio_empresa || "Não Informado";
      }

      const cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, '') : "";
      const numVitorias = parseInt(String(vitorias).replace(/\D/g, ''), 10) || 0;
      
      if (!forca || !prob) {
        const taxa = Math.min(95, 18 + (numVitorias * 7)); 
        prob = `~${taxa}%`;
        if (numVitorias === 0) { forca = "Iniciante"; prob = "< 15%"; } 
        else if (numVitorias <= 2) { forca = "Ameaça Leve"; } 
        else if (numVitorias <= 5) { forca = "Habitual"; } 
        else { forca = "Predador Dominante"; prob = "> 90%"; }
      }

      // Normalização inteligente de dados brutos
      let contratosFinal: any[] = [];
      if (Array.isArray(contratosRaw)) {
        contratosFinal = contratosRaw;
      } else if (typeof contratosRaw === 'string' && contratosRaw.trim().length > 0) {
        if (contratosRaw.includes('\n\n')) {
          contratosFinal = contratosRaw.split('\n\n').map(s => s.trim()).filter(Boolean);
        } else {
          contratosFinal = [contratosRaw.trim()];
        }
      }

      return { nome, cnpj, cleanCnpj, vitorias: numVitorias, prob, forca, tipo, porte, municipio, contratos: contratosFinal, uf: item.uf || uf };
    });
  };

  const listaNacional = useMemo(() => parseCompetitors(competitorsNacionais, 'nacional'), [competitorsNacionais]);
  const listaRegional = useMemo(() => parseCompetitors(competitorsRegionais, 'regional'), [competitorsRegionais]);
  const listaAtiva = abaConcorrentes === 'nacional' ? listaNacional : listaRegional;

  const handleLockTarget = (competitor: any) => {
    setTarget(competitor);
    setView('operation');
    const cache = fullResult?.war_room_cache || {};
    if (cache[competitor.cleanCnpj]) {
      setOffensiveData(cache[competitor.cleanCnpj]);
    } else {
      setOffensiveData(null);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Deseja apagar o histórico de investigação e forçar uma nova varredura OSINT deste CNPJ?")) return;
    setIsAnalyzing(true);
    try {
        const token = localStorage.getItem('bawzi_token');
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        await fetch(`${baseUrl.replace(/\/$/, '')}/api/competitor/history/${analysisId}/${target.cleanCnpj}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setOffensiveData(null);
        handleOffensiveAttack();
    } catch (err) {
        alert("Erro ao limpar histórico.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleOffensiveAttack = async () => {
    if (!analysisId || !target?.cleanCnpj) {
      setError("CNPJ do alvo ou ID da análise não encontrados.");
      return;
    }
    setIsAnalyzing(true);
    setOffensiveData(null);
    setError(null);

    // 🟢 FORMATADOR RESILIENTE PARA ENVIAR PRO BACKEND: Lê strings ou objetos dinamicamente
    const textoContratosPassados = target.contratos && Array.isArray(target.contratos) && target.contratos.length > 0
      ? target.contratos.map((c: any) => {
          if (typeof c === 'string') return c;
          return `- Órgão: ${c.orgao || c.orgao_nome || 'Órgão'} | Objeto: ${c.objeto || c.descricao_item || 'Objeto'} | Data: ${c.data || c.data_homologacao || ''} | Valor: R$ ${c.valor || ''}`;
        }).join('\n')
      : "Nenhum contrato anterior detalhado no payload.";

    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/competitor/offensive-intel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          cnpj: target.cleanCnpj, 
          analysis_id: analysisId,
          vitorias: target.vitorias,
          nome_empresa: target.nome,
          valor_edital: valorEstimatedSeguro,
          historico_contratos: textoContratosPassados
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Falha ao processar espionagem OSINT');
      setOffensiveData(data); 
    } catch (err: any) {
      setError(`Ataque interrompido: ${err.message}`); 
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copiarCnpjNumeros = (cnpjStr: string) => {
    const apenasNumeros = cnpjStr.replace(/\D/g, '');
    navigator.clipboard.writeText(apenasNumeros);
    alert('CNPJ (apenas números) copiado!');
  };

  return (
    <div className="space-y-6 w-full" id="area-resultados">
      
      {/* VISTA 1: RADAR */}
      {view === 'radar' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                <Target size={12} className="text-amber-400" /> Radar Ativo
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Selecione o seu Alvo</h2>
              <p className="text-indigo-100/80 text-sm font-medium max-w-xl">Escolha uma ameaça para iniciar as investigações e a engenharia de propostas reversas.</p>
            </div>
          </div>

          <div className="bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 flex max-w-sm">
            <button onClick={() => setAbaConcorrentes('nacional')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${abaConcorrentes === 'nacional' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><Globe size={16} /> Nacionais</button>
            <button onClick={() => setAbaConcorrentes('regional')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${abaConcorrentes === 'regional' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}><MapPin size={16} /> Regionais</button>
          </div>

          {listaAtiva.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400">
              <SearchX size={48} className="mb-4 opacity-50" />
              <p className="text-base font-bold text-slate-600">Nenhum rival ativo mapeado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {listaAtiva.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-[1.5rem] p-6 hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400"><Award size={24} /></div>
                    <div className="text-right">
                      <span className="block text-2xl font-black text-slate-800 leading-none">{item.vitorias}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vitórias</span>
                    </div>
                  </div>
                  <div className="mb-6 flex-1">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2 line-clamp-2">{item.nome}</h4>
                    <span className="inline-block text-[10px] font-bold text-slate-500 border border-slate-200 bg-slate-50 px-2 py-1 rounded">CNPJ: {item.cnpj || 'Desconhecido'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-auto">
                    <button onClick={() => handleLockTarget(item)} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><Crosshair size={14} /> Travar Alvo</button>
                    <button onClick={() => setDossieTarget(item)} className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"><Eye size={14} /> Ver Dossiê</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: WAR ROOM */}
      {view === 'operation' && target && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between gap-4">
            <button onClick={() => setView('radar')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm"><ArrowLeft size={16} /> Voltar</button>
            <button onClick={() => setDossieTarget(target)} className="flex items-center gap-1.5 text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Eye size={14} /> Abrir Raio-X PNCP</button>
          </div>

          <div className="bg-slate-900 rounded-[2rem] p-8 text-white border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center text-rose-500"><Target size={32} /></div>
              <div>
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Alvo Travado</p>
                <h2 className="text-xl md:text-2xl font-black tracking-tight">{target.nome}</h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="bg-slate-800 px-2 py-0.5 rounded">CNPJ: {target.cnpj || 'N/A'}</span>
                  <span>{target.prob} de Ameaça</span>
                </div>
              </div>
            </div>
          </div>

          {target.cleanCnpj && target.cleanCnpj.length >= 11 && (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
              <CompliancePanel cnpj={target.cleanCnpj} companyName={target.nome} userTier={userTier} onUpgradeClick={() => {}} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              {itensLotes.length > 1 && (
                <div className="bg-white rounded-[1.5rem] border border-indigo-100 p-5">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2"><ListFilter size={14} /> Selecione o Lote/Item em Disputa</label>
                  <select value={selectedItemIdx} onChange={(e) => setSelectedItemIdx(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 rounded-xl px-4 py-3 outline-none">
                    {itensLotes.map((item: any, idx: number) => (
                      <option key={idx} value={idx}>{item.numero}: {item.produto} (Teto: R$ {item.valor_estimado_raw})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-white rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm flex-1">
                <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-6 flex items-center gap-2"><Zap size={16} /> Cenário Preditivo de Lances (IA)</h3>
                <ReverseEngineeringBlock
                  valorReferencia={extrairValorExato(currentItem.valor_estimado_raw)} 
                  desagio={currentItem.desagioPreditivoOrgao || pricing?.desagioPreditivoOrgao || 0}
                  engenhariaData={{ ...pricing?.engenharia_reversa, setor_identificado: currentItem.produto }}
                  userTier={userTier}
                  quantidade={currentItem.quantidade || 1000}
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col h-max">
              <div className="mb-6 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2"><Scale size ={16} /> Varredura Jurídica OSINT</h3>
                  {offensiveData && <button onClick={handleClearHistory} className="text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest px-2 py-1 bg-white border border-slate-200 rounded-md">Limpar Histórico</button>}
                </div>
                <p className="text-sm font-medium text-slate-500">Gere a peça de inabilitação com base no histórico de vitórias.</p>
              </div>

              {error && <div className="p-4 bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold mb-6">{error}</div>}

              {!offensiveData && (
                <div className="flex-1 flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-300 rounded-[1.5rem] bg-white text-center px-6">
                  <FileSearch size={40} className="text-slate-300 mb-4" />
                  <button onClick={handleOffensiveAttack} disabled={isAnalyzing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                    {isAnalyzing ? <span className="animate-spin">⌛</span> : <Target size={16} className="text-rose-400" />} {isAnalyzing ? 'Processando OSINT...' : 'Lançar Ataque Jurídico'}
                  </button>
                </div>
              )}

              {offensiveData && (
                <div className="space-y-6 mt-2 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-4">
                    {offensiveData.vulnerabilidades?.map((vuln: any, idx: number) => (
                      <div key={idx} className={`p-5 rounded-2xl border bg-white shadow-sm ${vuln.gravidade === 'ALTA' ? 'border-rose-300 ring-1 ring-rose-500/10' : 'border-amber-300 ring-1 ring-amber-500/10'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className={`font-black text-xs uppercase tracking-widest ${vuln.gravidade === 'ALTA' ? 'text-rose-700' : 'text-amber-700'}`}>{vuln.tipo?.replace(/_/g, ' ')}</h4>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${vuln.gravidade === 'ALTA' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{vuln.gravidade}</span>
                        </div>
                        <p className="text-slate-600 text-xs font-medium leading-relaxed mb-3">{vuln.descricao_tecnica}</p>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px] text-slate-800" dangerouslySetInnerHTML={{ __html: vuln.fundamentacao_legal }} />
                      </div>
                    ))}
                  </div>

                  {offensiveData.recomendacao_tatica && (
                    <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">🎯 Recomendação Tática</h4>
                      <p className="text-sm font-medium text-slate-200 leading-relaxed">{offensiveData.recomendacao_tatica}</p>
                    </div>
                  )}

                  {offensiveData.rascunho_recurso && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3">Minuta Jurídica Gerada</h4>
                      <div className="font-serif text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                        <p className="font-bold border-b border-slate-200 pb-2 mb-3">ASSUNTO: {offensiveData.rascunho_recurso.assunto}</p>
                        <p className="mb-4">{offensiveData.rascunho_recurso.tese_juridica}</p>
                        <p className="font-bold mb-1">PEDIDOS:</p>
                        <ul className="list-decimal pl-4 space-y-1">
                          {offensiveData.rascunho_recurso.pedidos?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(`Assunto: ${offensiveData.rascunho_recurso.assunto}\n\n${offensiveData.rascunho_recurso.tese_juridica}\n\nPedidos:\n${offensiveData.rascunho_recurso.pedidos.join('\n')}`); alert('Copiado!'); }} className="mt-5 w-full py-3 bg-indigo-50 text-indigo-700 font-black rounded-xl text-[10px] uppercase border border-indigo-200">📋 Copiar Peça Jurídica</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 🏆 MODAL DO RAIO-X COMPETITIVO RESTAURADO (RE-ENGENHARIA CONTRA ERROS) */}
      {/* ===================================================================== */}
      {dossieTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* CABEÇALHO */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center"><Target size={18} /></div>
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-widest text-rose-500">Raio-X Competitivo</span>
                  <h3 className="text-sm font-black uppercase tracking-tight max-w-md truncate">{dossieTarget.nome}</h3>
                </div>
              </div>
              <button onClick={() => setDossieTarget(null)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white font-bold text-base transition-colors">✖</button>
            </div>

            {/* CONTEÚDO SCROLLABLE */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-700">
              
              {/* METADADOS */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Building2 size={14} className="text-indigo-500" /> Histórico no PNCP</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Vitórias Recentes</span><span className="text-sm font-black text-slate-900">{dossieTarget.vitorias}</span></div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">CNPJ</span><span className="text-xs font-black text-slate-900">{dossieTarget.cnpj || 'Não Informado'}</span></div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Estado (UF)</span><span className="text-sm font-black text-slate-900">{dossieTarget.uf}</span></div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Porte</span><span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-1 block w-max">{dossieTarget.porte}</span></div>
                  <div className="col-span-2 bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Município</span><span className="text-xs font-black text-slate-900 block truncate">{dossieTarget.municipio}</span></div>
                </div>
              </div>

              {/* LISTA HÍBRIDA DE CONTRATOS (ACEITA ARRAY DE TEXTO OU ARRAY DE OBJETOS) */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ListFilter size={14} className="text-rose-500" /> Últimos Contratos Vencidos</h4>
                
                {(!dossieTarget.contratos || dossieTarget.contratos.length === 0) ? (
                  <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">Nenhum contrato vencido recente listado para esta pesquisa ou base de dados em atualização.</div>
                ) : (
                  <div className="space-y-3">
                    {dossieTarget.contratos.map((contrato: any, cIdx: number) => {
                      
                      // 🟢 CASO A: Se o contrato vier da API já formatado como string de texto com emojis
                      if (typeof contrato === 'string') {
                        return (
                          <div key={cIdx} className="bg-slate-50/50 border border-slate-200 p-4 rounded-xl shadow-sm text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap relative group hover:border-indigo-200 hover:bg-white transition-all">
                            <div className="absolute top-3 right-3 text-indigo-400 opacity-30 group-hover:opacity-100 transition-opacity"><Building2 size={14} /></div>
                            {contrato}
                          </div>
                        );
                      }

                      // 🟢 CASO B: Se o contrato vier estruturado como objeto JSON tradicional
                      const cOrgao = contrato.orgao || contrato.orgao_nome || contrato.orgaoEntidade || "Órgão Licitação";
                      const cObjeto = contrato.objeto || contrato.descricao || contrato.descricao_item || "Descrição omitida";
                      const cData = contrato.data || contrato.data_homologacao || "";
                      const cValor = contrato.valor || contrato.valorTotal;

                      return (
                        <div key={cIdx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-indigo-200 transition-all">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-1.5 mb-2">
                            <Building2 size={12} className="text-indigo-500" /> {cOrgao}
                          </div>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">{cObjeto}</p>
                          <div className="flex flex-wrap items-center gap-4 text-xs font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 w-max">
                            {cData && <span className="text-slate-700">📅&nbsp;{cData}</span>}
                            {cValor && <span className="text-emerald-700">💰&nbsp;{typeof cValor === 'number' ? cValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : cValor}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* RODAPÉ */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button onClick={() => copiarCnpjNumeros(dossieTarget.cnpj)} className="px-5 py-3 bg-slate-900 hover:bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-1.5"><Clipboard size={14} /> Copiar CNPJ (Apenas Números)</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}