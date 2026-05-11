'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Search, ChevronDown, ChevronUp, Landmark } from 'lucide-react';

interface CguCompliancePanelProps {
  cnpj: string;
  companyName?: string;
}

export default function CguCompliancePanel({ cnpj, companyName }: CguCompliancePanelProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchCompliance = async () => {
      if (!cnpj) return;
      setLoading(true);
      setError(false);
      
      try {
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        const cnpjLimpo = cnpj.replace(/\D/g, ''); // Remove tudo que não é número
        const res = await fetch(`${API_URL}/api/cgu/compliance/${cnpjLimpo}`);
        
        if (!res.ok) throw new Error('Falha ao consultar CGU');
        
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCompliance();
  }, [cnpj]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl animate-pulse">
        <div className="p-2 bg-slate-200 rounded-lg">
          <Search className="w-4 h-4 text-slate-400" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Portal da Transparência</p>
          <p className="text-xs font-bold text-slate-500">A varrer bases da CGU...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-medium">Não foi possível consultar a CGU no momento.</span>
      </div>
    );
  }

  const isApproved = data.vereditto === 'APROVADO';
  const hasSanctions = data.vereditto === 'REPROVADO_COM_SANCÃO';

  return (
    <div className={`rounded-xl border transition-all duration-300 ${isApproved ? 'bg-emerald-50/50 border-emerald-100' : hasSanctions ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-amber-50 border-amber-200'}`}>
      {/* CABEÇALHO DO PAINEL */}
      <div 
        className="p-3.5 flex items-center justify-between cursor-pointer group"
        onClick={() => hasSanctions && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-100 text-emerald-600' : hasSanctions ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
            {isApproved ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                <Landmark className="w-3 h-3" /> CGU • Compliance
              </h4>
              {companyName && <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">| {companyName}</span>}
            </div>
            
            <p className={`text-sm font-black mt-0.5 ${isApproved ? 'text-emerald-700' : hasSanctions ? 'text-red-700' : 'text-amber-700'}`}>
              {isApproved ? 'Ficha Limpa (Nada Consta)' : hasSanctions ? 'Risco Grave (Sanções Encontradas)' : 'Análise Incompleta'}
            </p>
          </div>
        </div>

        {hasSanctions && (
          <button className="text-red-400 hover:text-red-600 transition-colors p-1 bg-red-100/50 rounded-md">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* ÁREA EXPANSÍVEL (SÓ MOSTRA SE TIVER SANCÃO E O UTILIZADOR CLICAR) */}
      {expanded && hasSanctions && (
        <div className="px-4 pb-4 pt-1 border-t border-red-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-800/60 mb-4 mt-3">
            Dossiê de Irregularidades Detectadas
          </p>
          
          <div className="space-y-4">
            
            {/* ============================== */}
            {/* BLOCO CEIS                     */}
            {/* ============================== */}
            {data.certidoes.ceis?.quantidade > 0 && (
              <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black bg-red-600 text-white px-2.5 py-1 rounded-md uppercase tracking-wider">
                    CEIS • {data.certidoes.ceis.quantidade} Ocorrência(s)
                  </span>
                </div>
                
                <div className="space-y-2">
                  {data.certidoes.ceis.detalhes.slice(0, 5).map((item: any) => {
                    // Extração inteligente dos dados da API da CGU
                    const sancaoNome = item.tipoSancao?.descricaoPortal || item.tipoSancao?.descricao || "Sanção Restritiva de Direito";
                    const orgao = item.orgaoSancionador?.nome || item.orgaoSancionador?.sigla || "Órgão Sancionador";
                    
                    return (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-snug">{sancaoNome}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight">
                            <span className="font-bold text-slate-700">Proc: {item.numeroProcesso || item.id}</span> • {orgao}
                          </p>
                        </div>
                        <a 
                          href={`https://portaldatransparencia.gov.br/sancoes/consulta/detalhe?id=${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all text-center"
                        >
                          Ver Detalhes ↗
                        </a>
                      </div>
                    );
                  })}
                  {data.certidoes.ceis.quantidade > 5 && (
                    <p className="text-[10px] font-bold text-slate-400 text-center pt-2">Exibindo as 5 infrações mais recentes.</p>
                  )}
                </div>
              </div>
            )}

            {/* ============================== */}
            {/* BLOCO CNEP                     */}
            {/* ============================== */}
            {data.certidoes.cnep?.quantidade > 0 && (
              <div className="bg-white border border-orange-100 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black bg-orange-500 text-white px-2.5 py-1 rounded-md uppercase tracking-wider">
                    CNEP • {data.certidoes.cnep.quantidade} Registro(s)
                  </span>
                </div>
                
                <div className="space-y-2">
                  {data.certidoes.cnep.detalhes.slice(0, 5).map((item: any) => {
                    // 🟢 Proteção: Se o CNPJ do item retornado não for o que pesquisámos, ignore.
                    // (Isso evita que a lista global de 15 registos apareça por acidente)
                    const cnpjItem = item.sancionado?.cpfCnpjFormatado?.replace(/\D/g, '') || '';
                    if (cnpjItem && cnpjItem !== cnpj.replace(/\D/g, '')) return null;

                    const sancaoNome = item.tipoSancao?.descricaoPortal || "Sanção Detectada";
                    const orgao = item.orgaoSancionador?.nome || item.orgaoSancionador?.sigla || "Órgão Sancionador";
                    
                    return (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-snug">{sancaoNome}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight">
                            <span className="font-bold text-slate-700">Proc: {item.numeroProcesso || item.id}</span> • {orgao}
                          </p>
                        </div>
                        <a 
                          href={`https://portaldatransparencia.gov.br/sancoes/consulta/detalhe?id=${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-all text-center"
                        >
                          Ver Detalhes ↗
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ============================== */}
            {/* BLOCO CEPIM                    */}
            {/* ============================== */}
            {data.certidoes.cepim?.quantidade > 0 && (
              <div className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black bg-amber-500 text-white px-2.5 py-1 rounded-md uppercase tracking-wider">
                    CEPIM • {data.certidoes.cepim.quantidade} Impedimento(s)
                  </span>
                </div>
                
                <div className="space-y-2">
                  {data.certidoes.cepim.detalhes.slice(0, 5).map((item: any) => {
                    const motivo = item.motivo || item.tipoSancao?.descricaoPortal || "Impedimento de Receber Repasses";
                    const orgao = item.orgaoConcedente?.nome || item.orgaoSuperior?.nome || "Órgão Concedente";
                    
                    return (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-snug">{motivo}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight">
                            <span className="font-bold text-slate-700">Convênio: {item.numeroConvenio || item.id}</span> • {orgao}
                          </p>
                        </div>
                        <a 
                          href={`https://portaldatransparencia.gov.br/sancoes/consulta/detalhe?id=${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] font-black uppercase tracking-wider bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 transition-all text-center"
                        >
                          Ver Detalhes ↗
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Botão para Dossiê Oficial Completo */}
          <div className="mt-5 pt-5 border-t border-red-100 flex justify-center">
            <a 
              href={`https://portaldatransparencia.gov.br/sancoes/consulta?parametro=${cnpj.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
            >
              Abrir Dossiê Completo na CGU ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}