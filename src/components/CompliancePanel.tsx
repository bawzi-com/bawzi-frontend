'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, ChevronDown, ChevronUp, 
  Landmark, Briefcase, Building, CheckCircle2, XCircle, RotateCw, Bot, ExternalLink 
} from 'lucide-react';

interface CompliancePanelProps {
  cnpj: string;
  companyName?: string;
}

interface CertidaoStatus {
  id: string;
  nome: string;
  orgao: string;
  vencimento: string | null; 
  statusForcado?: 'vencida' | 'alerta' | 'valida' | 'indisponivel';
  icone: any;
  engine?: string; 
}

// Agora incluímos o TST no cache nativo!
const memoryCache: {
  cgu: Record<string, any>;
  federal: Record<string, CertidaoStatus | null>;
  tst: Record<string, CertidaoStatus | null>; 
  mocks: Record<string, CertidaoStatus[]>;
} = {
  cgu: {},
  federal: {},
  tst: {},
  mocks: {}
};

export default function CguCompliancePanel({ cnpj, companyName }: CompliancePanelProps) {
  const [expanded, setExpanded] = useState(false);

  // 1. Estados da CGU
  const [loadingCgu, setLoadingCgu] = useState(true);
  const [isRefreshingCgu, setIsRefreshingCgu] = useState(false);
  const [cguData, setCguData] = useState<any>(null);
  const [cguError, setCguError] = useState(false);

  // 2. Estados do Agente CND Federal (Porta 8001)
  const [loadingFederal, setLoadingFederal] = useState(true);
  const [isRefreshingFederal, setIsRefreshingFederal] = useState(false);
  const [cndFederal, setCndFederal] = useState<CertidaoStatus | null>(null);

  // 3. Estados do Agente CND Trabalhista / TST (Porta 8002)
  const [loadingTst, setLoadingTst] = useState(true);
  const [isRefreshingTst, setIsRefreshingTst] = useState(false);
  const [cndTst, setCndTst] = useState<CertidaoStatus | null>(null);

  // 4. Estados das Certidões Mock (Restou apenas o FGTS)
  const [loadingMocks, setLoadingMocks] = useState(true);
  const [outrasCertidoes, setOutrasCertidoes] = useState<CertidaoStatus[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  // ====================================================================
  // 1. BUSCA: API DA CGU COM CACHE
  // ====================================================================
  const fetchCompliance = useCallback(async (isManualRefresh = false) => {
    if (!cnpj) return;
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
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
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
  }, [cnpj]);

  // ====================================================================
  // 2. BUSCA REAL: AGENTE FEDERAL COM CACHE (Porta 8001)
  // ====================================================================
  const fetchAgenteFederal = useCallback(async (isManualRefresh = false) => {
    if (!cnpj) return;
    const cnpjLimpo = cnpj.replace(/\D/g, ''); 

    if (!isManualRefresh && memoryCache.federal[cnpjLimpo]) {
      setCndFederal(memoryCache.federal[cnpjLimpo]);
      setLoadingFederal(false);
      return;
    }

    if (isManualRefresh) setIsRefreshingFederal(true);
    else setLoadingFederal(true);
    
    try {
      const res = await fetch(`${API_URL}/agente-federal/api/certidoes/federal/agent/${cnpjLimpo}`);
      if (!res.ok) throw new Error('Falha no Agente');
      
      const data = await res.json();
      let statusForce: 'vencida' | 'indisponivel' | undefined = undefined;
      if (data.status === 'vencida') statusForce = 'vencida';
      if (data.status === 'indisponivel') statusForce = 'indisponivel';

      const novaCertidao: CertidaoStatus = {
        id: 'federal',
        nome: 'CND Federal',
        orgao: 'Receita',
        vencimento: data.data_validade,
        statusForcado: statusForce,
        icone: Landmark,
        engine: data.engine
      };

      setCndFederal(novaCertidao);
      memoryCache.federal[cnpjLimpo] = novaCertidao; 

    } catch (err) {
      const erroCertidao: CertidaoStatus = {
        id: 'federal', nome: 'CND Federal', orgao: 'Receita',
        vencimento: null, statusForcado: 'indisponivel',
        icone: Landmark, engine: 'Agente Falhou'
      };
      setCndFederal(erroCertidao);
    } finally {
      if (isManualRefresh) setIsRefreshingFederal(false);
      else setLoadingFederal(false);
    }
  }, [cnpj]);

  // ====================================================================
  // 3. BUSCA REAL: AGENTE TST COM CACHE (Porta 8002)
  // ====================================================================
  const fetchAgenteTst = useCallback(async (isManualRefresh = false) => {
    if (!cnpj) return;
    const cnpjLimpo = cnpj.replace(/\D/g, ''); 

    if (!isManualRefresh && memoryCache.tst[cnpjLimpo]) {
      setCndTst(memoryCache.tst[cnpjLimpo]);
      setLoadingTst(false);
      return;
    }

    if (isManualRefresh) setIsRefreshingTst(true);
    else setLoadingTst(true);
    
    try {
      const res = await fetch(`${API_URL}/agente-trabalhista/api/certidoes/trabalhista/agent/${cnpjLimpo}`);
      if (!res.ok) throw new Error('Falha no Agente TST');
      
      const data = await res.json();
      let statusForce: 'vencida' | 'indisponivel' | undefined = undefined;
      if (data.status === 'vencida') statusForce = 'vencida';
      if (data.status === 'indisponivel') statusForce = 'indisponivel';

      const novaCertidao: CertidaoStatus = {
        id: 'tst',
        nome: 'CND Trabalhista',
        orgao: 'TST',
        vencimento: data.data_validade,
        statusForcado: statusForce,
        icone: Briefcase,
        engine: data.engine || 'Gemini 2.5 CNDT'
      };

      setCndTst(novaCertidao);
      memoryCache.tst[cnpjLimpo] = novaCertidao; 

    } catch (err) {
      const erroCertidao: CertidaoStatus = {
        id: 'tst', nome: 'CND Trabalhista', orgao: 'TST',
        vencimento: null, statusForcado: 'indisponivel',
        icone: Briefcase, engine: 'Agente Falhou'
      };
      setCndTst(erroCertidao);
    } finally {
      if (isManualRefresh) setIsRefreshingTst(false);
      else setLoadingTst(false);
    }
  }, [cnpj]);

  // ====================================================================
  // 4. BUSCA MOCK COM CACHE (Apenas FGTS agora)
  // ====================================================================
  const fetchMocks = useCallback((isManualRefresh = false) => {
    if (!cnpj) return;
    const cnpjLimpo = cnpj.replace(/\D/g, ''); 

    if (!isManualRefresh && memoryCache.mocks[cnpjLimpo]) {
      setOutrasCertidoes(memoryCache.mocks[cnpjLimpo]);
      setLoadingMocks(false);
      return;
    }

    if (!isManualRefresh) setLoadingMocks(true);
    setTimeout(() => {
      const hoje = new Date();
      const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);

      // Removemos o TST daqui pois agora ele é real!
      const mocksData = [
        { id: 'fgts', nome: 'Regularidade', orgao: 'FGTS (Caixa)', vencimento: ontem.toISOString(), statusForcado: 'vencida' as const, icone: Building },
      ];

      setOutrasCertidoes(mocksData);
      memoryCache.mocks[cnpjLimpo] = mocksData; 
      setLoadingMocks(false);
    }, 1500);
  }, [cnpj]);

  // Cadeado de execução para evitar duplicação do React Strict Mode
  const fetchedCnpj = useRef<string | null>(null);

  // Chama tudo no carregamento inicial (agora protegido)
  useEffect(() => {
    // Se a consulta para este CNPJ já foi disparada, aborta a segunda chamada fantasma
    if (fetchedCnpj.current === cnpj) return;
    fetchedCnpj.current = cnpj;

    fetchCompliance();
    fetchAgenteFederal();
    fetchAgenteTst(); 
    fetchMocks();
  }, [cnpj, fetchCompliance, fetchAgenteFederal, fetchAgenteTst, fetchMocks]);

  const handleRefreshAll = () => {
    fetchCompliance(true);
    fetchAgenteFederal(true);
    fetchAgenteTst(true);
    fetchMocks(true);
  };

  // ====================================================================
  // MOTOR DE VENCIMENTO
  // ====================================================================
  const calcularStatusVencimento = (cert: CertidaoStatus) => {
    if (cert.statusForcado === 'indisponivel') {
      return { texto: 'Site em Baixo', cor: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', icon: <AlertTriangle size={14} /> };
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

  // ====================================================================
  // RENDERIZAÇÃO
  // ====================================================================
  const isCguApproved = cguData?.vereditto === 'APROVADO';
  const hasCguSanctions = cguData?.vereditto === 'REPROVADO_COM_SANCÃO';

  const RenderCertidaoCard = ({ cert, onRefresh, isRefreshing }: { cert: CertidaoStatus, onRefresh?: () => void, isRefreshing?: boolean }) => {
    const visual = calcularStatusVencimento(cert);
    const Icon = cert.icone;

    return (
      <div className={`flex flex-col p-3 rounded-xl border transition-all duration-300 hover:shadow-sm relative overflow-hidden ${visual.bg} ${visual.border}`}>
        {isRefreshing && (
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
                disabled={isRefreshing}
                className="text-slate-400 hover:text-indigo-600 transition-colors"
                title="Atualizar"
              >
                <RotateCw size={12} className={isRefreshing ? "animate-spin text-indigo-500" : ""} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 text-[11px] font-bold ${visual.cor} ${isRefreshing ? 'opacity-50' : ''}`}>
            {visual.icon} {isRefreshing ? 'Consultando...' : visual.texto}
          </div>
          {cert.engine && !isRefreshing && (
             <span className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1" title="Lido por Inteligência Artificial">
                <Bot size={10} /> IA
             </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full mt-2">
      
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-slate-400" />
          <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            Radar de Habilitação 
            {companyName && <span className="font-bold text-slate-400 truncate max-w-[150px] lowercase capitalize">| {companyName}</span>}
          </h4>
        </div>
        <button 
          onClick={handleRefreshAll}
          disabled={isRefreshingCgu || isRefreshingFederal || isRefreshingTst}
          className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
          title="Atualizar Tudo"
        >
          <RotateCw size={14} className={(isRefreshingCgu || isRefreshingFederal || isRefreshingTst) ? "animate-spin text-indigo-500" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        
        {/* 1. CGU */}
        {loadingCgu ? (
          <div className="h-[76px] rounded-xl bg-slate-50 border border-slate-100 animate-pulse"></div>
        ) : cguError || !cguData ? (
          <div className="flex flex-col justify-center p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 h-[76px] relative">
             <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5 mb-1.5"><AlertTriangle size={14} /><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">CEIS / CNEP</span></div>
                <button onClick={() => fetchCompliance(true)} className="text-slate-400 hover:text-indigo-600"><RotateCw size={12} className={isRefreshingCgu ? "animate-spin" : ""}/></button>
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
                
                <button 
                  onClick={(e) => { e.stopPropagation(); fetchCompliance(true); }} 
                  disabled={isRefreshingCgu}
                  className="text-slate-400 hover:text-indigo-600 transition-colors z-10"
                >
                  <RotateCw size={12} className={isRefreshingCgu ? "animate-spin text-indigo-500" : ""} />
                </button>

                {hasCguSanctions && (
                  <span className="text-rose-400 bg-white rounded shadow-sm p-0.5">
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </span>
                )}
              </div>
            </div>
            <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isCguApproved ? 'text-emerald-700' : hasCguSanctions ? 'text-rose-700' : 'text-amber-700'} ${isRefreshingCgu ? 'opacity-50' : ''}`}>
              {isCguApproved ? <CheckCircle2 size={14} /> : <XCircle size={14} />} 
              {isRefreshingCgu ? 'Consultando...' : isCguApproved ? 'Ficha Limpa (Nada Consta)' : hasCguSanctions ? 'Sanções Encontradas' : 'Análise Incompleta'}
            </div>
          </div>
        )}

        {/* 2. CND FEDERAL */}
        {loadingFederal ? (
          <div className="h-[76px] flex flex-col justify-center p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 animate-pulse relative overflow-hidden">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Bot size={14} className="text-indigo-400 animate-bounce" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">CND Federal</span>
                </div>
             </div>
             <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-tight">Agente Bawzi a consultar...</span>
             <div className="absolute bottom-0 left-0 h-1 bg-indigo-500/20 w-full">
                <div className="h-full bg-indigo-500 w-1/3 animate-[slide_1.5s_ease-in-out_infinite]"></div>
             </div>
          </div>
        ) : cndFederal && (
          <RenderCertidaoCard 
            cert={cndFederal} 
            onRefresh={() => fetchAgenteFederal(true)} 
            isRefreshing={isRefreshingFederal}
          />
        )}

        {/* 3. CND TRABALHISTA (TST) */}
        {loadingTst ? (
          <div className="h-[76px] flex flex-col justify-center p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 animate-pulse relative overflow-hidden">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Bot size={14} className="text-indigo-400 animate-bounce" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">CND Trabalhista</span>
                </div>
             </div>
             <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-tight">Agente Bawzi a consultar...</span>
             <div className="absolute bottom-0 left-0 h-1 bg-indigo-500/20 w-full">
                <div className="h-full bg-indigo-500 w-1/3 animate-[slide_1.5s_ease-in-out_infinite]"></div>
             </div>
          </div>
        ) : cndTst && (
          <RenderCertidaoCard 
            cert={cndTst} 
            onRefresh={() => fetchAgenteTst(true)} 
            isRefreshing={isRefreshingTst}
          />
        )}

        {/* 4. MOCKS (Apenas FGTS) */}
        {loadingMocks ? (
          <div className="h-[76px] rounded-xl bg-slate-50 border border-slate-100 animate-pulse"></div>
        ) : (
          outrasCertidoes.map((cert) => (
            <RenderCertidaoCard 
              key={cert.id} 
              cert={cert} 
              onRefresh={() => fetchMocks(true)} 
            />
          ))
        )}
      </div>

      {expanded && hasCguSanctions && cguData && cguData.sancoes && cguData.sancoes.length > 0 && (
        <div className="mt-3 px-3 pb-3 pt-3 border border-rose-200 bg-white rounded-xl shadow-sm animate-in slide-in-from-top-2 duration-300">
           <p className="text-[10px] font-bold uppercase tracking-widest text-rose-800/60 mb-3 flex items-center gap-1.5 px-1">
             <AlertTriangle size={12} className="text-rose-500" />
             Dossiê de Irregularidades ({cguData.sancoes.length})
           </p>
           
           <div className="flex flex-col gap-2">
             {cguData.sancoes.map((sancao: any, idx: number) => (
               <div key={idx} className="flex flex-col gap-2 p-2.5 bg-rose-50/50 border border-rose-100 rounded-lg">
                 <div>
                   <p className="text-[11px] font-black text-rose-900 leading-tight">
                     {sancao.categoria_sancao || sancao.tipo_sancao || 'Sanção Registada'}
                   </p>
                   <p className="text-[9px] font-bold text-rose-700/70 mt-0.5 uppercase tracking-wide">
                     {sancao.orgao_sancionador || 'Órgão não informado'}
                   </p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 text-[9px] font-medium text-rose-800 bg-white p-2 rounded border border-rose-50 shadow-sm">
                   <div>
                     <span className="block text-rose-400 font-bold uppercase tracking-wider text-[8px] mb-0.5">Início</span>
                     {sancao.data_inicio || 'N/A'}
                   </div>
                   <div>
                     <span className="block text-rose-400 font-bold uppercase tracking-wider text-[8px] mb-0.5">Fim / Validade</span>
                     {sancao.data_fim || 'N/A'}
                   </div>
                 </div>

                 {/* BOTÃO PARA O PORTAL DA TRANSPARÊNCIA */}
                 {(sancao.link_portal || sancao.link_transparencia) && (
                   <a 
                     href={sancao.link_portal || sancao.link_transparencia}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="mt-1 flex items-center justify-center gap-1.5 py-1.5 bg-white border border-rose-200 hover:border-rose-400 hover:bg-rose-50 text-rose-600 rounded-md text-[9px] font-black uppercase tracking-widest transition-all shadow-sm"
                   >
                     Ver Processo na CGU <ExternalLink size={10} />
                   </a>
                 )}
               </div>
             ))}
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}} />
    </div>
  );
}