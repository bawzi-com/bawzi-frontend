'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, ChevronDown, ChevronUp, 
  Landmark, Briefcase, Building, CheckCircle2, XCircle, RotateCw, Bot, ExternalLink,
  Lock, Crown,
} from 'lucide-react';

interface CompliancePanelProps {
  cnpj: string;
  companyName?: string;
  userTier: number;
  onUpgradeClick: () => void;
}

interface CertidaoStatus {
  id: string;
  nome: string;
  orgao: string;
  vencimento: string | null; 
  statusForcado?: 'vencida' | 'alerta' | 'valida' | 'indisponivel' | 'processando';
  icone: any;
  engine?: string; 
}

const memoryCache: {
  cgu: Record<string, any>;
  federal: Record<string, CertidaoStatus | null>;
  tst: Record<string, CertidaoStatus | null>;
  fgts: Record<string, CertidaoStatus | null>;
} = {
  cgu: {},
  federal: {},
  tst: {},
  fgts: {}
};

export default function CguCompliancePanel({ cnpj, companyName, userTier, onUpgradeClick }: CompliancePanelProps) {
  
  // 🟢 1. SEGURANÇA: Trava central baseada no Tier
  const nivelAtual = typeof userTier !== 'undefined' ? userTier : 0;
  const isLocked = nivelAtual < 4;

  const [expanded, setExpanded] = useState(false);

  // Estados da CGU
  const [loadingCgu, setLoadingCgu] = useState(true);
  const [isRefreshingCgu, setIsRefreshingCgu] = useState(false);
  const [cguData, setCguData] = useState<any>(null);
  const [cguError, setCguError] = useState(false);

  // Estados dos agentes reais. Eles ficam parados até o usuário solicitar.
  const [cndFederal, setCndFederal] = useState<CertidaoStatus | null>(memoryCache.federal[cnpj.replace(/\D/g, '')] || null);
  const [cndTst, setCndTst] = useState<CertidaoStatus | null>(memoryCache.tst[cnpj.replace(/\D/g, '')] || null);
  const [certFgts, setCertFgts] = useState<CertidaoStatus | null>(memoryCache.fgts[cnpj.replace(/\D/g, '')] || null);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  // ====================================================================
  // 1. BUSCA: CGU COM CACHE (Bloqueado se isLocked)
  // ====================================================================
  const fetchCompliance = useCallback(async (isManualRefresh = false) => {
    if (!cnpj || isLocked) return; // 🛑 TRAVA DE REDE
    
    const cnpjLimpo = cnpj.replace(/\D/g, ''); 

    if (!isManualRefresh && memoryCache.cgu[cnpjLimpo]) {
      setCguData(memoryCache.cgu[cnpjLimpo]);
      setLoadingCgu(false);
      return;
    }

    if (isManualRefresh) setIsRefreshingCgu(true);
    else setLoadingCgu(true);
    
    setCguError(false);
    try {
      const res = await fetch(`${API_URL}/api/cgu/compliance/${cnpjLimpo}`);
      if (!res.ok) throw new Error('Falha ao consultar CGU');
      
      const data = await res.json();
      setCguData(data);
      memoryCache.cgu[cnpjLimpo] = data; 
    } catch (err) {
      setCguError(true);
    } finally {
      if (isManualRefresh) setIsRefreshingCgu(false);
      else setLoadingCgu(false);
    }
  }, [cnpj, API_URL, isLocked]);

  // ====================================================================
  // 2. BUSCA: FILA COMUM (Bloqueado se isLocked)
  // ====================================================================
  const colocarNaFila = useCallback(async (tipo: 'federal' | 'trabalhista' | 'fgts', setter: Function) => {
    if (!cnpj || isLocked) return; // 🛑 TRAVA DE REDE
    
    const cnpjLimpo = cnpj.replace(/\D/g, ''); 

    let icone = Landmark;
    let nome = 'CND Federal';
    let orgao = 'Receita Federal';
    if (tipo === 'trabalhista') { icone = Briefcase; nome = 'CND Trabalhista'; orgao = 'TST'; }
    if (tipo === 'fgts') { icone = Building; nome = 'Regularidade FGTS'; orgao = 'Caixa Econômica'; }

    setter({
      id: tipo, nome, orgao, vencimento: null,
      statusForcado: 'processando', icone, engine: 'Fila Bawzi'
    });

    try {
      await fetch(`${API_URL}/api/certidoes/enfileirar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: [cnpjLimpo], tipo })
      });
    } catch (err) {
      console.error(`Falha ao enfileirar ${tipo}`, err);
    }
  }, [cnpj, API_URL, isLocked]);

  // ====================================================================
  // 3. O RADAR (POLLING) - Não inicia se estiver bloqueado
  // ====================================================================
  useEffect(() => {
    if (!cnpj || isLocked) return; // 🛑 TRAVA DO RADAR
    
    const cnpjLimpo = cnpj.replace(/\D/g, '');

    const verificarStatus = async (tipo: 'federal' | 'trabalhista' | 'fgts', setCert: Function, cacheLocal: any) => {
      try {
        const res = await fetch(`${API_URL}/api/certidoes/status/${tipo}/${cnpjLimpo}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.finalizado) {
          let statusForce: 'vencida' | 'indisponivel' | undefined = undefined;

          if (data.status === 'vencida' || data.status === 'irregular') statusForce = 'vencida';
          if (data.status === 'indisponivel' || data.status === 'erro') statusForce = 'indisponivel';

          const certPronta: CertidaoStatus = {
            id: tipo,
            nome: tipo === 'federal' ? 'CND Federal' : tipo === 'trabalhista' ? 'CND Trabalhista' : 'Regularidade FGTS',
            orgao: tipo === 'federal' ? 'Receita Federal' : tipo === 'trabalhista' ? 'TST' : 'Caixa Econômica',
            vencimento: data.data_validade,
            statusForcado: statusForce,
            icone: tipo === 'federal' ? Landmark : tipo === 'trabalhista' ? Briefcase : Building,
            engine: data.dados?.engine || data.engine || 'Robô + IA'
          };

          setCert(certPronta);
          cacheLocal[cnpjLimpo] = certPronta;
        }
        else if (data.status === 'nao_solicitado') {
          // Job sumiu da memória (ex: restart do servidor) — para o polling e sinaliza para retentar
          setCert((prev: any) => prev ? { ...prev, statusForcado: 'indisponivel', engine: 'Servidor reiniciado' } : null);
          if (cacheLocal[cnpjLimpo]) cacheLocal[cnpjLimpo] = null;
        }
        else if (data.status === 'indisponivel' || data.status === 'erro') {
          setCert((prev: any) => prev ? { ...prev, statusForcado: 'indisponivel', engine: 'Erro no Agente' } : null);
        }
      } catch (e) {
        console.error(`Erro no radar ${tipo}:`, e);
      }
    };

    const radar = setInterval(() => {
      if (cndFederal?.statusForcado === 'processando') verificarStatus('federal', setCndFederal, memoryCache.federal);
      if (cndTst?.statusForcado === 'processando') verificarStatus('trabalhista', setCndTst, memoryCache.tst);
      if (certFgts?.statusForcado === 'processando') verificarStatus('fgts', setCertFgts, memoryCache.fgts);
    }, 4000);

    return () => clearInterval(radar);
  }, [cndFederal?.statusForcado, cndTst?.statusForcado, certFgts?.statusForcado, cnpj, API_URL, isLocked]);

  // ====================================================================
  // TRIGGER INICIAL DA TELA
  // ====================================================================
  const fetchedCnpj = useRef<string | null>(null);

  useEffect(() => {
    if (!cnpj || isLocked) return; // 🛑 TRAVA DO GATILHO

    if (fetchedCnpj.current === cnpj) return;
    fetchedCnpj.current = cnpj;
    fetchCompliance();

  }, [cnpj, fetchCompliance, isLocked]);

  const handleRefreshCgu = () => {
    if (isLocked) return; // 🛑 PROTEÇÃO DE CLIQUE FORÇADO
    fetchCompliance(true);
  };

  const verificarCertidoesPesadas = () => {
    if (isLocked) return; // 🛑 PROTEÇÃO DE CLIQUE FORÇADO

    const cnpjLimpo = cnpj.replace(/\D/g, '');

    memoryCache.federal[cnpjLimpo] = null;
    memoryCache.tst[cnpjLimpo] = null;
    memoryCache.fgts[cnpjLimpo] = null;

    colocarNaFila('federal', setCndFederal);
    colocarNaFila('trabalhista', setCndTst);
    colocarNaFila('fgts', setCertFgts);
  };

  // ====================================================================
  // MOTOR VISUAL DE VENCIMENTO
  // ====================================================================
  const calcularStatusVencimento = (cert: CertidaoStatus) => {
    if (cert.statusForcado === 'processando') {
      return { texto: 'Na Fila / Extraindo...', cor: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: <Bot size={14} className="animate-pulse" /> };
    }
    if (cert.statusForcado === 'indisponivel') {
      return { texto: 'Governo Indisponível', cor: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', icon: <AlertTriangle size={14} /> };
    }
    if (cert.statusForcado === 'vencida' || !cert.vencimento) {
      return { texto: 'Irregular / Vencida', cor: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: <XCircle size={14} /> };
    }

    const hoje = new Date();
    const vencimento = new Date(cert.vencimento);
    const diffTempo = vencimento.getTime() - hoje.getTime();
    const diffDias = Math.ceil(diffTempo / (1000 * 3600 * 24));

    if (diffDias < 0) return { texto: 'Vencida', cor: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: <XCircle size={14} /> };
    if (diffDias <= 15) return { texto: `Vence em ${diffDias} dias`, cor: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: <AlertTriangle size={14} /> };
    
    return { texto: `Válida até ${vencimento.toLocaleDateString('pt-BR')}`, cor: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 size={14} /> };
  };

  const isCguApproved = cguData?.vereditto === 'APROVADO';
  const hasCguSanctions = cguData?.vereditto === 'REPROVADO_COM_SANCÃO';
  const isAnyCertidaoProcessing =
    cndFederal?.statusForcado === 'processando' ||
    cndTst?.statusForcado === 'processando' ||
    certFgts?.statusForcado === 'processando';
  const hasAnyCertidao = Boolean(cndFederal || cndTst || certFgts);

  // Agrega sanções de CEIS, CNEP e CEPIM numa lista plana (memoizado)
  const todasSancoes = useMemo<Array<{ fonte: string; item: any }>>(() => {
    if (!hasCguSanctions || !cguData?.certidoes) return [];
    const acc: Array<{ fonte: string; item: any }> = [];
    for (const fonte of ['ceis', 'cnep', 'cepim'] as const) {
      const detalhes = cguData.certidoes[fonte]?.detalhes;
      if (Array.isArray(detalhes)) {
        detalhes.forEach((item: any) => acc.push({ fonte: fonte.toUpperCase(), item }));
      }
    }
    return acc;
  }, [hasCguSanctions, cguData]);

  const RenderCertidaoCard = ({ cert, onRefresh }: { cert: CertidaoStatus, onRefresh?: () => void }) => {
    const visual = calcularStatusVencimento(cert);
    const Icon = cert.icone;
    const isProcessing = cert.statusForcado === 'processando';

    return (
      <div className={`flex flex-col p-3 rounded-xl border transition-all duration-300 hover:shadow-sm relative overflow-hidden ${visual.bg} ${visual.border}`}>
        {isProcessing && (
          <div className="absolute top-0 left-0 h-0.5 bg-indigo-500/20 w-full">
             <div className="h-full bg-indigo-500 w-1/3 animate-[slide_1.5s_ease-in-out_infinite]"></div>
          </div>
        )}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Icon size={14} className={visual.cor} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{cert.nome}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-white border ${visual.border} ${visual.cor}`}>
              {cert.orgao}
            </span>
            {onRefresh && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                disabled={isProcessing || isLocked}
                className="text-slate-400 hover:text-indigo-600 transition-colors"
                title="Atualizar"
              >
                <RotateCw size={12} className={isProcessing ? "animate-spin text-indigo-500" : ""} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 text-[11px] font-bold ${visual.cor} ${isProcessing ? 'opacity-70' : ''}`}>
            {visual.icon} {visual.texto}
          </div>
          {cert.engine && !isProcessing && (
             <span className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1" title="Lido por Inteligência Artificial">
                <Bot size={10} /> IA
             </span>
          )}
        </div>
      </div>
    );
  };

  const RenderCertidaoIdleCard = ({ nome, orgao, Icon }: { nome: string; orgao: string; Icon: any }) => (
    <div className="flex flex-col p-3 rounded-xl border border-slate-200 bg-slate-50 h-[76px]">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon size={14} className="text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{nome}</span>
        </div>
        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-400">
          {orgao}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
        <Bot size={14} />
        Pendente
      </div>
    </div>
  );

  return (
    <div className="w-full mt-2 relative overflow-hidden rounded-xl bg-white p-1 pb-2">
      
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between mb-3 px-2 pt-2 relative z-20">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-slate-400" />
          <div>
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Radar preliminar de habilitação
              {companyName && <span className="font-bold text-slate-400 truncate max-w-[150px] lowercase capitalize">| {companyName}</span>}
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              CEIS/CNEP consultado. Certidões oficiais ficam pendentes até extração.
            </p>
          </div>
        </div>
        {!isLocked && (
          <button 
            onClick={handleRefreshCgu}
            disabled={isRefreshingCgu}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
            title="Atualizar CEIS / CNEP"
          >
            <RotateCw size={14} className={isRefreshingCgu ? "animate-spin text-indigo-500" : ""} />
          </button>
        )}
      </div>

      {/* 🟢 O CONTAINER DOS DADOS (Com Blur) */}
      <div className={`transition-all duration-300 ${isLocked ? 'blur-[5px] opacity-40 select-none pointer-events-none' : ''}`}>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
          {/* CGU */}
          {loadingCgu && !isLocked ? (
            <div className="h-[76px] rounded-xl bg-slate-50 border border-slate-100 animate-pulse"></div>
          ) : cguError || !cguData ? (
            <div className="flex flex-col justify-center p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 h-[76px] relative">
               <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5 mb-1.5"><AlertTriangle size={14} /><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">CEIS / CNEP</span></div>
                  <button onClick={() => fetchCompliance(true)} disabled={isLocked} className="text-slate-400 hover:text-indigo-600"><RotateCw size={12} className={isRefreshingCgu ? "animate-spin" : ""}/></button>
               </div>
               <span className="text-[11px] font-bold">Falha ao consultar CGU.</span>
            </div>
          ) : (
            <div 
              onClick={() => hasCguSanctions && setExpanded(!expanded)}
              className={`flex flex-col p-3 rounded-xl border transition-all duration-300 relative ${hasCguSanctions ? 'cursor-pointer hover:shadow-md' : ''} ${isCguApproved ? 'bg-emerald-50 border-emerald-200' : hasCguSanctions ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}
            >
              {isRefreshingCgu && (
                <div className="absolute top-0 left-0 h-0.5 bg-indigo-500/20 w-full">
                   <div className="h-full bg-indigo-500 w-1/3 animate-[slide_1.5s_ease-in-out_infinite]"></div>
                </div>
              )}
              <div className="flex items-start justify-between mb-2 mt-1">
                <div className="flex items-center gap-1.5">
                  {isCguApproved ? <ShieldCheck size={14} className="text-emerald-600" /> : <ShieldAlert size={14} className="text-rose-600" />}
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">CEIS / CNEP</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-white border ${isCguApproved ? 'border-emerald-200 text-emerald-600' : 'border-rose-200 text-rose-600'}`}>CGU</span>
                  
                  {!isLocked && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); fetchCompliance(true); }} 
                      disabled={isRefreshingCgu}
                      className="text-slate-400 hover:text-indigo-600 transition-colors z-10"
                    >
                      <RotateCw size={12} className={isRefreshingCgu ? "animate-spin text-indigo-500" : ""} />
                    </button>
                  )}

                  {hasCguSanctions && (
                    <span className="text-rose-400 bg-white rounded shadow-sm p-0.5">
                      {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  )}
                </div>
              </div>
              <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isCguApproved ? 'text-emerald-700' : hasCguSanctions ? 'text-rose-700' : 'text-amber-700'} ${isRefreshingCgu ? 'opacity-50' : ''}`}>
                {isCguApproved ? <CheckCircle2 size={14} /> : <XCircle size={14} />} 
                {isRefreshingCgu ? 'Consultando...' : isCguApproved ? 'Sem sanções CGU encontradas' : hasCguSanctions ? 'Sanções encontradas' : 'Análise incompleta'}
              </div>
            </div>
          )}

          {/* Renderização Condicional dos Cards Restantes (Usa dados ou o Mock se locked) */}
          {cndFederal ? <RenderCertidaoCard cert={cndFederal} onRefresh={() => colocarNaFila('federal', setCndFederal)} /> : <RenderCertidaoIdleCard nome="CND Federal" orgao="Receita Federal" Icon={Landmark} />}
          {cndTst ? <RenderCertidaoCard cert={cndTst} onRefresh={() => colocarNaFila('trabalhista', setCndTst)} /> : <RenderCertidaoIdleCard nome="CND Trabalhista" orgao="TST" Icon={Briefcase} />}
          {certFgts ? <RenderCertidaoCard cert={certFgts} onRefresh={() => colocarNaFila('fgts', setCertFgts)} /> : <RenderCertidaoIdleCard nome="Regularidade FGTS" orgao="Caixa Econômica" Icon={Building} />}
        </div>

        {!isLocked && (
          <div className="px-1 mt-3">
            <button
              onClick={verificarCertidoesPesadas}
              disabled={isAnyCertidaoProcessing}
              className="w-full py-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:bg-indigo-50 disabled:hover:text-indigo-700"
            >
              {isAnyCertidaoProcessing ? (
                <>
                  <Bot size={14} className="animate-pulse" />
                  Extraindo certidões oficiais
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  {hasAnyCertidao ? 'Reverificar certidões oficiais' : 'Verificar certidões oficiais'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Dossiê CGU Expandido */}
        {expanded && hasCguSanctions && (
          <div className="mt-3 px-3 pb-3 pt-3 border border-rose-200 bg-white rounded-xl shadow-sm mx-1 animate-in slide-in-from-top-2 duration-300">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-800/60 mb-3 flex items-center gap-1.5 px-1">
              <AlertTriangle size={12} className="text-rose-500" />
              Dossiê de Irregularidades ({todasSancoes.length})
            </p>
            {todasSancoes.length === 0 ? (
              <p className="text-[11px] text-rose-700 font-medium px-1">Sanções detectadas mas sem detalhes disponíveis. Consulte diretamente o Portal da Transparência.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {todasSancoes.map(({ fonte, item }, idx) => {
                  const toStr = (v: any): string => {
                    if (!v) return '';
                    if (typeof v === 'string') return v;
                    if (typeof v === 'object') return v.descricaoResumida || v.descricaoPortal || '';
                    return String(v);
                  };
                  const tipo = toStr(item.tipoSancao) || toStr(item.categoria_sancao) || toStr(item.tipo_sancao) || 'Sanção registrada';
                  const orgao = toStr(item.orgaoSancionador) || toStr(item.orgao_sancionador);
                  const cnpjLimpo = cnpj.replace(/\D/g, '');
                  const portalUrl = item.id
                    ? `https://portaldatransparencia.gov.br/sancoes/consulta/${item.id}`
                    : `https://portaldatransparencia.gov.br/sancoes/consulta?cadastro=1&cadastro=2&cpfCnpj=${cnpjLimpo}&ordenarPor=nomeSancionado&direcao=asc`;
                  return (
                    <div key={idx} className="flex flex-col gap-1 p-2.5 bg-rose-50/50 border border-rose-100 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black text-rose-900 leading-tight">{tipo}</p>
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 shrink-0">{fonte}</span>
                      </div>
                      {orgao && (
                        <p className="text-[9px] font-bold text-rose-700/70 uppercase tracking-wide">{orgao}</p>
                      )}
                      {(item.dataInicioPenalidade || item.dataFimPenalidade) && (
                        <p className="text-[9px] text-rose-600/70 font-medium">
                          {item.dataInicioPenalidade && `Início: ${item.dataInicioPenalidade}`}
                          {item.dataInicioPenalidade && item.dataFimPenalidade && ' · '}
                          {item.dataFimPenalidade && `Fim: ${item.dataFimPenalidade}`}
                        </p>
                      )}
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 self-start text-[9px] font-black uppercase tracking-wide text-rose-600 underline underline-offset-2 hover:text-rose-800"
                      >
                        Ver no Portal da Transparência →
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🔴 O PAINEL DE BLOQUEIO (PAYWALL) */}
      {isLocked && (
        <div className="absolute inset-0 top-10 z-10 flex flex-col items-center justify-center p-2 bg-white/20">
          <div className="flex flex-col items-center text-center p-6 bg-white/95 rounded-2xl shadow-xl border border-indigo-50 backdrop-blur-md animate-in zoom-in duration-300 max-w-[280px]">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3 ring-4 ring-white shadow-sm">
              <Lock size={20} />
            </div>
            <h4 className="text-xs font-black text-slate-800 mb-1.5 flex items-center gap-1.5 justify-center uppercase tracking-tight">
              <Crown size={14} className="text-amber-500" />
              Radar de Habilitação
            </h4>
            <p className="text-[10px] text-slate-500 mb-5 font-medium leading-relaxed px-2">
              Descubra se o concorrente tem certidões vencidas ou sanções ativas. Acesso exclusivo Nível 4.
            </p>
            
            <button 
              onClick={onUpgradeClick}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              Desbloquear Radar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
