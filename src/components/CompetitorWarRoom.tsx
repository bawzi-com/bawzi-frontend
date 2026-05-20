'use client';

import React, { useState, useMemo } from 'react';
import { Target, FileSearch, Award, SearchX, ArrowLeft, Crosshair, AlertTriangle, ListFilter, Clipboard, Eye, Building2, ExternalLink, ShieldAlert, ShieldCheck, Activity, Scale } from 'lucide-react';
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
  uf = "BR",
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
  const [dossieContracts, setDossieContracts] = useState<any[] | null>(null);

  const [sancoesStatus, setSancoesStatus] = useState<'idle' | 'loading' | 'clean' | 'dirty' | 'error'>('idle');
  const [sancoesLista, setSancoesLista] = useState<any[]>([]);

  const linkEditalPrincipal = fullResult?.link_pncp || fullResult?.link_edital || fullResult?.url || fullResult?.link_original || fullResult?.link || pricing?.link_pncp;

  const getSancoesLink = (cnpjBase?: string) => {
    if (!cnpjBase) return null;
    const clean = String(cnpjBase).replace(/\D/g, '');
    if (clean.length < 11) return null;
    return `https://portaldatransparencia.gov.br/sancoes/consulta?cadastro=1&cadastro=2&cpfCnpj=${clean}&ordenarPor=nomeSancionado&direcao=asc`;
  };

  const extrairValorExato = (textoBase: any): number => {
    if (!textoBase) return 0;
    if (typeof textoBase === 'number') return textoBase > 0 ? textoBase : 0;
    const texto = String(textoBase);
    const matches = [...texto.matchAll(/R\$\s*([\d\.,]+)/g)];
    let valStr = matches.length > 0 ? matches[0][1] : texto.replace(/[^\d,.-]/g, '');
    
    if (valStr.includes('.') && !valStr.includes(',')) {
        const partes = valStr.split('.');
        if (partes[partes.length - 1].length !== 3) return parseFloat(valStr) || 0;
    }
    const limpo = valStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  };

  const minerarDadosDoResumo = (texto: string) => {
    if (!texto) return { quantidade: 1, valorGlobal: 0, valorUnitario: 0 };
    let quantidade = 1, valorGlobal = 0, valorUnitario = 0;

    const matchQtd = texto.match(/(?:quantidade|qtd|quant|fornecimento|aquisi[çc][ãa]o\s+de)[\s\S]{0,40}?(?:\b|:)\s*([\d\.]+)\s*(?:unidade|un|cx|caixa|frasco|fr|ampola|pe[çc]a|comprimido|comp|kit)/i) 
                  || texto.match(/quantidade[\s\S]*?de\s*([\d\.]+)/i);
    if (matchQtd) {
        const limpo = matchQtd[1].replace(/\./g, '');
        quantidade = parseInt(limpo, 10) || 1;
    }

    const matchUnit = texto.match(/(?:valor\s+unit[aá]rio|unit[aá]rio|a\s+r\$|cada)[\s\S]{0,15}?r\$\s*([\d\.,]+)/i);
    if (matchUnit) valorUnitario = extrairValorExato(matchUnit[1]);

    const matchTotal = texto.match(/(?:totalizando|total\s+de|valor\s+global|valor\s+total|estimado\s+em|valor\s+de)[\s\S]{0,15}?r\$\s*([\d\.,]+)/i);
    if (matchTotal) valorGlobal = extrairValorExato(matchTotal[1]);

    if (valorGlobal === 0 && valorUnitario > 0) valorGlobal = valorUnitario * quantidade;
    if (valorUnitario === 0 && valorGlobal > 0 && quantidade > 1) valorUnitario = valorGlobal / quantidade;

    return { quantidade, valorGlobal, valorUnitario };
  };

  const valorEstimatedSeguro = useMemo(() => {
    let soma = 0;
    if (pricing?.itens_lotes && Array.isArray(pricing.itens_lotes)) {
        soma = pricing.itens_lotes.reduce((acc: number, item: any) => acc + extrairValorExato(item.valor_estimado_raw), 0);
    }
    if (soma > 0) return soma;

    const vEdital = extrairValorExato(pricing?.valor_estimado_raw) || extrairValorExato(fullResult?.estimated_value);
    if (vEdital > 0) return vEdital;

    const dadosMinerados = minerarDadosDoResumo(fullResult?.summary || fullResult?.description);
    if (dadosMinerados.valorGlobal > 0) return dadosMinerados.valorGlobal;

    return extrairValorExato(fullResult?.summary) || 0;
  }, [pricing, fullResult]);

  const nomeObjetoReal = fullResult?.termo_busca_pncp || fullResult?.objeto || pricing?.objeto || fullResult?.title || "Licitação";

  const itensLotes = useMemo(() => {
    if (pricing?.itens_lotes && Array.isArray(pricing.itens_lotes) && pricing.itens_lotes.length > 0) return pricing.itens_lotes;
    
    const dadosMinerados = minerarDadosDoResumo(fullResult?.summary || fullResult?.description);
    if (dadosMinerados.valorGlobal > 0) {
      return [{ numero: "Lote", produto: nomeObjetoReal, valor_estimado_raw: dadosMinerados.valorGlobal, quantidade: dadosMinerados.quantidade, desagioPreditivoOrgao: pricing?.desagioPreditivoOrgao || 19.7 }];
    }

    return [{ numero: "Global", produto: nomeObjetoReal, valor_estimado_raw: valorEstimatedSeguro, quantidade: 1, desagioPreditivoOrgao: pricing?.desagioPreditivoOrgao || 0 }];
  }, [pricing, valorEstimatedSeguro, nomeObjetoReal, fullResult]);

  const currentItem = itensLotes[selectedItemIdx] || itensLotes[0];

  const tetoUnitarioAtual = useMemo(() => {
      const v = extrairValorExato(currentItem?.valor_estimado_raw);
      let q = currentItem?.quantidade > 1 ? currentItem.quantidade : 1;
      if (q === 1) {
          const extra = minerarDadosDoResumo(fullResult?.summary || "");
          if (extra.quantidade > 1) q = extra.quantidade;
      }
      if (q === 1 && v > 2000) return -1; // -1 = Lote Global
      return v > 0 ? v / q : 0;
  }, [currentItem, fullResult]);

  const parseCompetitors = (rawList: any[], tipo: 'nacional' | 'regional') => {
    if (!Array.isArray(rawList)) return [];
    return rawList.map(item => {
      let nome = "Empresa não identificada", cnpj = "", porte = "DEMAIS", municipio = "Não Informado";
      let vitorias = "0";

      if (typeof item === 'string') {
        const match = item.match(/(.*?)\s*\(([\d]+)\s*vitórias?\)(?:\s*-\s*CNPJ:\s*([\d]+))?/i);
        if (match) { nome = match[1].trim(); vitorias = match[2] || "0"; cnpj = match[3] || ""; } else { nome = item; }
      } else {
        nome = item.empresa || item.nome || item.razao_social || "Empresa não identificada";
        vitorias = item.vitorias || item.quantidade_vitorias || "0";
        cnpj = item.cnpj || item.cnpj_empresa || ""; 
        porte = item.porte || item.porte_empresa || "DEMAIS";
        municipio = item.municipio || item.cidade || item.municipio_empresa || "Não Informado";
      }

      const cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, '') : "";
      const numVitorias = parseInt(String(vitorias).replace(/\D/g, ''), 10) || 0;
      const prob = `~${Math.min(95, 18 + (numVitorias * 7))}%`;

      return { ...item, nome, cnpj, cleanCnpj, vitorias: numVitorias, prob, tipo, porte, municipio, uf: item.uf || uf, contratos: item.contratos || [], rawDataOriginal: item };
    });
  };

  const listaNacional = useMemo(() => parseCompetitors(competitorsNacionais, 'nacional'), [competitorsNacionais]);
  const listaRegional = useMemo(() => parseCompetitors(competitorsRegionais, 'regional'), [competitorsRegionais]);
  const listaAtiva = abaConcorrentes === 'nacional' ? listaNacional : listaRegional;

  // 🟢 A BALA DE PRATA: O Padrão Ouro de Preço
  // Varre os contratos à procura de um valor perfeitamente inquestionável para servir de âncora.
  const trustedBaselinePrice = useMemo(() => {
    let minPrice = Infinity;
    const allComps = [...listaNacional, ...listaRegional];

    allComps.forEach(comp => {
        const conts = comp.contratos?.length > 0 ? comp.contratos : (comp.rawDataOriginal?.contratos || []);
        conts.forEach((c: any) => {
            if (typeof c === 'string') return;
            const global = extrairValorExato(c.valor || c.valorTotal || 0);
            let v = extrairValorExato(c.valorUnitario || c.preco_unitario || c.valor_unitario || 0);
            const objText = String(c.objeto || c.descricao || "").toLowerCase();

            // Padrão Ouro 1: Regex explícito no texto (ex: "R$ 44,35 /cx")
            const match = objText.match(/(?:unit[aá]rio|unidade|cada|r\$\s*[\d\.,]+\s*\/\s*(?:un|cx|fr))[\s:=]*r?\$\s*([\d\.,]+)/i);
            if (match) {
                const vRegex = extrairValorExato(match[1]);
                if (vRegex > 0 && vRegex < minPrice) minPrice = vRegex;
            }

            // Padrão Ouro 2: A API deu um valor que é matematicamente uma fração minúscula do Lote (ex: < 10%)
            if (v > 0 && global > 0 && v < (global * 0.1)) {
                if (v < minPrice) minPrice = v;
            }
        });
    });

    return minPrice === Infinity ? 0 : minPrice;
  }, [listaNacional, listaRegional]);

  // 🟢 EXTRATOR MATEMÁTICO BLINDADO
  const extrairUnitarioInteligente = (contrato: any) => {
    const globalDoContratoAntigo = extrairValorExato(contrato.valor || contrato.valorTotal || 0);
    let v = extrairValorExato(contrato.valorUnitario || contrato.preco_unitario || contrato.valor_unitario || 0);
    
    const isValorAbsurdo = (val: number) => {
        if (val <= 0) return true;
        
        // 1. Mentira do Lote: O unitário reportado é > 50% do lote total (e o lote é maior que 2.000)
        if (globalDoContratoAntigo > 2000 && val >= (globalDoContratoAntigo * 0.5)) return true;
        
        // 2. Mentira do Falso Gigante: bloqueia preços absurdamente fora da faixa conhecida.
        // Usamos 100× porque produtos como medicamentos têm variação legítima de até 50× entre
        // compras unitárias e em escala. O threshold de 10× bloqueava preços válidos.
        if (trustedBaselinePrice > 0 && val > (trustedBaselinePrice * 100)) return true;

        // 3. Mentira do Teto: Se temos um teto de edital limpo, não pode ser 5x maior
        if (tetoUnitarioAtual > 0 && tetoUnitarioAtual !== -1 && val > (tetoUnitarioAtual * 5)) return true;
        
        // 4. Mentira Extrema: Valor da "unidade" maior que o orçamento global de TODA a licitação atual
        if (valorEstimatedSeguro > 0 && val >= valorEstimatedSeguro) return true;

        return false;
    };

    if (!isValorAbsurdo(v)) return v; 

    // Tenta caçar no texto se o valor da API for mentira
    const objText = String(contrato.objeto || contrato.descricao || "").toLowerCase();
    const regexUnitarios = [
        /(?:unit[aá]rio|unit|unidade|por\s+item|cada|a\s+r\$|r\$\s*[\d\.,]+\s*(?:\/|\s*por\s*)\s*(?:un|cx|caixa|frasco|fr|ampola|mg|g|ml|kit))[\s:=]*r?\$\s*([\d\.,]+)/i,
        /r\$\s*([\d\.,]+)\s*(?:\(unit|\/un|\/cx|\/fr)/i
    ];

    for (const regex of regexUnitarios) {
        const match = objText.match(regex);
        if (match) {
            const vEncontrado = extrairValorExato(match[1]);
            if (!isValorAbsurdo(vEncontrado)) return vEncontrado;
        }
    }

    // Fallback Matemático
    const dadosMinerados = minerarDadosDoResumo(objText);
    if (globalDoContratoAntigo > 0 && dadosMinerados.quantidade > 1) {
        const fallback = globalDoContratoAntigo / dadosMinerados.quantidade;
        if (!isValorAbsurdo(fallback)) return fallback;
    }

    return 0; // Oculto com segurança extrema.
  };

  // Lê o valorUnitario direto do backend (já validado por extrair_unitario_real)
  // e só cai no extrairUnitarioInteligente (com filtros anti-absurdo) se o campo vier zerado.
  const lerUnitarioConfiavel = (c: any): number => {
      const raw = extrairValorExato(c.valorUnitario ?? c.preco_unitario ?? c.valor_unitario ?? 0);
      if (raw > 0) return raw;
      return extrairUnitarioInteligente(c);
  };

  const getMenorUnitario = (lista: any[]) => {
      let menor = Infinity;
      lista.forEach(comp => {
          const conts = comp.contratos?.length > 0 ? comp.contratos : (comp.rawDataOriginal?.contratos || []);
          if (Array.isArray(conts)) {
              conts.forEach((c: any) => {
                  if (typeof c !== 'string') {
                      const v = lerUnitarioConfiavel(c);
                      if (v > 0 && v < menor) menor = v;
                  }
              });
          }
      });
      return menor === Infinity ? 0 : menor;
  };

  const menorNacional = useMemo(() => getMenorUnitario(listaNacional), [listaNacional, tetoUnitarioAtual, trustedBaselinePrice]);
  const menorRegional = useMemo(() => getMenorUnitario(listaRegional), [listaRegional, tetoUnitarioAtual, trustedBaselinePrice]);

  const ultimoVencidoAlvo = useMemo(() => {
      if (!dossieContracts || dossieContracts.length === 0) return 0;
      for (const c of dossieContracts) {
         if (typeof c !== 'string') {
             const v = lerUnitarioConfiavel(c);
             if (v > 0) return v;
         }
      }
      return 0;
  }, [dossieContracts, tetoUnitarioAtual, trustedBaselinePrice]);

  const fetchSancoes = async (cnpjToFind: string) => {
    setSancoesStatus('loading');
    try {
        const token = localStorage.getItem('bawzi_token') || '';
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/fornecedor/sancoes/${cnpjToFind}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Falha");
        const json = await res.json();
        if (json?.possui_sancoes || (json?.sancoes && json.sancoes.length > 0)) {
            setSancoesStatus('dirty');
            setSancoesLista(json.sancoes || []);
        } else { setSancoesStatus('clean'); }
    } catch (e) { setSancoesStatus('error'); }
  };

  const handleOpenDossie = (competitor: any) => {
    setDossieTarget(competitor);
    setDossieContracts(null); 

    setTimeout(() => {
        let localContracts = competitor.contratos || [];
        if (localContracts.length === 0) {
            const obj = competitor.rawDataOriginal || {};
            for (const key of Object.keys(obj)) {
                if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] !== 'number') { 
                    localContracts = obj[key]; break; 
                }
            }
        }
        setDossieContracts(localContracts);
    }, 1600); 
  };

  const handleLockTarget = (competitor: any) => {
    setTarget(competitor);
    setView('operation');
    const cache = fullResult?.war_room_cache || {};
    if (cache[competitor.cleanCnpj]) setOffensiveData(cache[competitor.cleanCnpj]);
    else setOffensiveData(null);
    if (competitor.cleanCnpj) fetchSancoes(competitor.cleanCnpj);
  };

  const handleClearHistory = async () => {
    const safeAnalysisId = analysisId || target?.cleanCnpj || "fallback-id";
    if (!confirm("Deseja apagar o histórico e forçar varredura OSINT deste CNPJ?")) return;
    setIsAnalyzing(true);
    try {
        const token = localStorage.getItem('bawzi_token');
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        await fetch(`${baseUrl.replace(/\/$/, '')}/api/competitor/history/${safeAnalysisId}/${target.cleanCnpj}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        setOffensiveData(null);
        handleOffensiveAttack();
    } catch (err) { alert("Erro ao limpar histórico."); } 
    finally { setIsAnalyzing(false); }
  };

  const handleOffensiveAttack = async () => {
    if (!target?.cleanCnpj) { setError("O CNPJ do alvo é inválido para iniciar o ataque."); return; }
    setIsAnalyzing(true); setOffensiveData(null); setError(null);
    const safeAnalysisId = analysisId || crypto.randomUUID();

    const contratosAtuais = target.contratos || target.rawDataOriginal?.contratos || [];
    const contratosParaIA = contratosAtuais.length > 0 
        ? contratosAtuais.map((c:any) => typeof c === 'string' ? c : JSON.stringify(c)).join('\n') 
        : "Nenhum contrato detalhado.";

    const payload = { 
        cnpj: target.cleanCnpj, 
        analysis_id: safeAnalysisId, 
        vitorias: target.vitorias, 
        nome_empresa: target.nome, 
        valor_edital: valorEstimatedSeguro, 
        historico_contratos: contratosParaIA 
    };

    try {
      const token = localStorage.getItem('bawzi_token');
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/competitor/offensive-intel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Falha na espionagem OSINT');
      setOffensiveData(data); 
    } catch (err: any) { 
      setError(`O Backend rejeitou os dados: ${err.message}`); 
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const copiarCnpjNumeros = (cnpjStr: string) => {
    navigator.clipboard.writeText(cnpjStr.replace(/\D/g, ''));
    alert('CNPJ copiado com sucesso!');
  };

  return (
    <div className="space-y-6 w-full" id="area-resultados">
      
      {view === 'radar' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          
          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target size={20} className="text-rose-500 md:hidden" />
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Selecione o seu Alvo</h2>
              </div>
              <p className="text-slate-500 text-sm font-medium max-w-xl">Escolha uma ameaça no radar para iniciar as investigações e a engenharia reversa.</p>
            </div>
            <div className="hidden md:flex items-center justify-center w-14 h-14 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 shrink-0 shadow-inner">
              <Target size={28} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col gap-6">
            
            <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 flex w-full md:max-w-sm">
              <button onClick={() => setAbaConcorrentes('nacional')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${abaConcorrentes === 'nacional' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Nacionais</button>
              <button onClick={() => setAbaConcorrentes('regional')} className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${abaConcorrentes === 'regional' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Regionais</button>
            </div>

            {listaAtiva.length === 0 ? (
              <div className="py-20 text-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[1.5rem]">
                <p className="font-bold text-sm">Nenhum rival ativo mapeado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {listaAtiva.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-[1.5rem] p-6 flex flex-col hover:border-indigo-300 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm"><Award size={24} /></div>
                      <div className="text-right">
                        <span className="block text-2xl font-black text-slate-800 leading-none">{item.vitorias}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vitórias</span>
                      </div>
                    </div>
                    <div className="mb-6 flex-1">
                      <h4 className="text-sm font-black text-slate-900 uppercase mb-2">{item.nome}</h4>
                      <span className="inline-block text-[10px] font-bold text-slate-500 border border-slate-200 bg-white px-2 py-1 rounded shadow-sm">CNPJ: {item.cnpj || 'Desconhecido'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-auto">
                      <button onClick={() => handleLockTarget(item)} className="w-full py-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-colors"><Crosshair size={14} /> Travar Alvo</button>
                      <button onClick={() => handleOpenDossie(item)} className="w-full py-3 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-colors shadow-sm"><Eye size={14} /> Ver Dossiê</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'operation' && target && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
                <button onClick={() => setView('radar')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm"><ArrowLeft size={16} /> Voltar</button>
                {linkEditalPrincipal && (
                  <a href={linkEditalPrincipal} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl shadow-sm">
                    <ExternalLink size={16} /> Edital Original
                  </a>
                )}
            </div>
            <button onClick={() => handleOpenDossie(target)} className="flex items-center gap-1.5 text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Eye size={14} /> Abrir Raio-X PNCP</button>
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
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-stretch justify-between gap-6">
              <div className="flex-1 w-full">
                <CompliancePanel cnpj={target.cleanCnpj} companyName={target.nome} userTier={userTier} onUpgradeClick={() => {}} />
              </div>
              <div className="w-full md:w-1/3 bg-slate-50 rounded-xl border border-slate-200 p-5 shrink-0 flex flex-col justify-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Scale size={14} /> Histórico de Sanções Federais</h4>
                {sancoesStatus === 'loading' && ( <div className="flex items-center gap-3 text-slate-500"><span className="animate-spin text-lg">⏳</span><span className="text-[10px] font-bold uppercase tracking-widest">Consultando...</span></div> )}
                {sancoesStatus === 'clean' && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0"><ShieldCheck size={20} /></div>
                    <div><p className="text-xs font-black text-emerald-700 uppercase">Ficha Limpa</p><p className="text-[10px] text-slate-500 font-medium">Nenhuma sanção ativa detectada.</p></div>
                  </div>
                )}
                {sancoesStatus === 'dirty' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3"><div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0"><AlertTriangle size={20} /></div><div><p className="text-xs font-black text-rose-700 uppercase">Sanções Encontradas!</p></div></div>
                    {getSancoesLink(target.cleanCnpj) && ( <a href={getSancoesLink(target.cleanCnpj)!} target="_blank" rel="noopener noreferrer" className="w-full py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase text-center">Ver Detalhes</a> )}
                  </div>
                )}
                {sancoesStatus === 'error' && (
                  <div className="flex flex-col gap-3">
                    {getSancoesLink(target.cleanCnpj) && ( <a href={getSancoesLink(target.cleanCnpj)!} target="_blank" rel="noopener noreferrer" style={{ color: '#ffffff' }} className="w-full py-2.5 bg-slate-900 !text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><ExternalLink size={14} color="#ffffff" /> Consultar Portal</a> )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              {itensLotes.length > 1 && (
                <div className="bg-white rounded-[1.5rem] border border-indigo-100 p-5">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2"><ListFilter size={14} /> Selecione o Lote/Item em Disputa</label>
                  <select value={selectedItemIdx} onChange={(e) => setSelectedItemIdx(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 rounded-xl px-4 py-3 outline-none">
                    {itensLotes.map((item: any, idx: number) => (
                      <option key={idx} value={idx}>{item.numero}: {item.produto} ({item.quantidade} un)</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-white rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm flex-1">
                <ReverseEngineeringBlock
                  valorReferencia={extrairValorExato(currentItem.valor_estimado_raw)} 
                  desagio={currentItem.desagioPreditivoOrgao || pricing?.desagioPreditivoOrgao || 0}
                  engenhariaData={{ ...pricing?.engenharia_reversa, setor_identificado: currentItem.produto }}
                  userTier={userTier}
                  quantidade={currentItem.quantidade}
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col h-max">
              <div className="mb-6 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2"><Scale size={16} /> Varredura Jurídica OSINT</h3>
                  {offensiveData && <button onClick={handleClearHistory} className="text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm">Limpar Histórico</button>}
                </div>
                <p className="text-sm font-medium text-slate-500">Gere a peça de inabilitação com base no histórico de vitórias.</p>
              </div>

              {error && <div className="p-4 bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold mb-6 flex items-start gap-3"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><p>{error}</p></div>}

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

      {/* MODAL DO RAIO-X COMPETITIVO (DOSSIÊ) */}
      {dossieTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center"><Target size={18} /></div>
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-widest text-rose-500">Raio-X Competitivo</span>
                  <h3 className="text-sm font-black uppercase tracking-tight">{dossieTarget.nome}</h3>
                </div>
              </div>
              <button onClick={() => setDossieTarget(null)} className="text-slate-400 hover:text-white font-bold text-lg">✖</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Vitórias Recentes</span><span className="text-sm font-black text-slate-900">{dossieTarget.vitorias}</span></div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">CNPJ</span><span className="text-xs font-black text-slate-900">{dossieTarget.cnpj}</span></div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">UF</span><span className="text-sm font-black text-slate-900">{dossieTarget.uf}</span></div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Porte</span><span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-1 block w-max">{dossieTarget.porte}</span></div>
                <div className="col-span-2 bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Município</span><span className="text-xs font-black text-slate-900 block truncate">{dossieTarget.municipio}</span></div>
                <div className="col-span-3 bg-slate-50 border border-slate-100 p-3 rounded-xl"><span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">CNAE Principal</span><span className="text-xs font-black text-slate-900 block truncate">{dossieTarget.cnae || 'Não Informado'}</span></div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><ListFilter size={14} className="text-rose-500" /> Histórico Operacional</h4>
                
                {dossieContracts === null ? (
                   <div className="p-12 flex flex-col items-center justify-center text-indigo-500 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner gap-4">
                      <Activity size={36} className="animate-pulse text-indigo-400" />
                      <div className="text-center">
                         <p className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-1">Acessando Transparência...</p>
                         <p className="text-[10px] font-bold text-slate-500">Minerando contratos e decodificando preços da empresa.</p>
                      </div>
                   </div>
                ) : dossieContracts.length === 0 ? (
                   <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center gap-3">
                      <SearchX size={32} className="text-slate-300" />
                      <p className="text-sm font-bold text-slate-500">Sem Histórico Detalhado</p>
                      <p className="text-xs text-slate-400 max-w-sm">A base de dados do governo não devolveu detalhamento de contratos recentes para este CNPJ.</p>
                   </div>
                ) : (
                  <div className="space-y-4">
                    
                    <div className="bg-slate-900 rounded-2xl p-5 shadow-inner mt-2 mb-6 border border-slate-800 relative overflow-hidden">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                        <Activity size={16} /> Termômetro de Preço Unitário
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-[8px] text-slate-400 uppercase font-bold block mb-1">Teto Edital Atual</span>
                          <span className="text-sm font-black text-white">{tetoUnitarioAtual === -1 ? 'Lote Global' : (tetoUnitarioAtual > 0 ? tetoUnitarioAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sigiloso')}</span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-[8px] text-slate-400 uppercase font-bold block mb-1">Último Vencido (Alvo)</span>
                          <span className="text-sm font-black text-amber-400">{ultimoVencidoAlvo > 0 ? ultimoVencidoAlvo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Oculto'}</span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-[8px] text-slate-400 uppercase font-bold block mb-1">Menor Nacional</span>
                          <span className="text-sm font-black text-emerald-400">{menorNacional > 0 ? menorNacional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Oculto'}</span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50">
                          <span className="text-[8px] text-slate-400 uppercase font-bold block mb-1">Menor Regional</span>
                          <span className="text-sm font-black text-emerald-400">{menorRegional > 0 ? menorRegional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Oculto'}</span>
                        </div>
                      </div>
                    </div>

                    {dossieContracts.map((contrato: any, idx: number) => {
                        if (typeof contrato === 'string') return null;

                        const cOrgao = contrato.orgao || contrato.orgao_nome || "Órgão Não Informado";
                        const cObjeto = contrato.objeto || contrato.descricao || "Descrição indisponível";
                        const cData = contrato.data || contrato.data_homologacao || "";
                        const cValor = contrato.valor || contrato.valorTotal || "";
                        const cLink = contrato.link || contrato.url || contrato.link_pncp || contrato.linkSistemaOrigem;

                        const cValorNum = typeof cValor === 'number' ? cValor : extrairValorExato(cValor);
                        // Usa o valorUnitario do backend diretamente (já validado por extrair_unitario_real)
                        // e só aplica extrairUnitarioInteligente se o campo vier zerado.
                        const valorUnitario = lerUnitarioConfiavel(contrato);

                        // Fallback matemático: global / qty minerada do texto quando backend retornou 0
                        const dadosMineradosCard = valorUnitario === 0 && cValorNum > 0
                            ? minerarDadosDoResumo(cObjeto)
                            : null;
                        const valorUnitarioEstimado = dadosMineradosCard && dadosMineradosCard.quantidade > 1
                            ? cValorNum / dadosMineradosCard.quantidade
                            : 0;
                        const isEstimado = valorUnitario === 0 && valorUnitarioEstimado > 0;
                        const valorExibido = valorUnitario > 0 ? valorUnitario : valorUnitarioEstimado;

                        return (
                            <div key={idx} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-indigo-300 transition-all relative">
                                <div className="flex items-center gap-2 text-[11px] font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-2 mb-3">
                                    <Building2 size={14} className="text-indigo-500" /> {cOrgao}
                                </div>
                                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">{cObjeto}</p>

                                <div className="flex flex-wrap items-center gap-3 text-xs font-bold bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 w-full">
                                    {cData && <span className="text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">📅 {cData}</span>}

                                    {cValorNum > 0 && (
                                        <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 shadow-sm">
                                            💰 Global: {cValorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    )}

                                    {valorExibido > 0 ? (
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-1 rounded-md border shadow-sm flex items-center gap-1 ${isEstimado ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-indigo-700 bg-indigo-50 border-indigo-200'}`}>
                                              <Target size={12} />
                                              {isEstimado ? '~' : ''}Unitário: {valorExibido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                              {isEstimado && <span className="text-[8px] opacity-70 ml-0.5">(est.)</span>}
                                          </span>
                                          {tetoUnitarioAtual > 0 && tetoUnitarioAtual !== -1 && valorExibido < tetoUnitarioAtual && (
                                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 shadow-sm" title="Desconto praticado neste contrato em relação ao Teto do Edital Atual">
                                                  -{Math.round((1 - valorExibido / tetoUnitarioAtual) * 100)}% vs Teto
                                              </span>
                                          )}
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm flex items-center gap-1 text-[9px] uppercase tracking-widest">
                                            <SearchX size={10} /> Unitário Oculto
                                        </span>
                                    )}

                                    {cLink && (
                                      <a href={cLink} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest text-[9px] bg-white border border-indigo-100 px-3 py-1.5 rounded-md shadow-sm">
                                        <ExternalLink size={12} /> Link Oficial
                                      </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
              {getSancoesLink(dossieTarget.cnpj) ? (
                <a 
                  href={getSancoesLink(dossieTarget.cnpj)!} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <ShieldAlert size={14} className="text-rose-600" /> Sanções no Governo
                </a>
              ) : <div />}
              
              <button onClick={() => copiarCnpjNumeros(dossieTarget.cnpj)} className="px-5 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white font-black text-[10px] uppercase rounded-xl transition-all shadow-md flex items-center gap-1.5">
                <Clipboard size={14} /> Copiar CNPJ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}