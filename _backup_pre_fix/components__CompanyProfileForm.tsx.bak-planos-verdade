'use client';

import { useState, useEffect } from 'react';
import CguCompliancePanel from './CompliancePanel';
import { useRouter } from 'next/navigation';
import { Building2, Search, Landmark, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Plus, Trash2, Edit3, Activity } from 'lucide-react';
import { setActiveCompanyContext } from '@/lib/activeContext';
import { apiFetch, SessionExpiredError, clearSession } from '@/lib/apiClient';
import CompanyLookup, { isSituacaoAtiva, type CompanyLookupResult } from './CompanyLookup';

export default function CompanyProfileForm({ companyData, userTier, token, onUpdate, onCnpjDetected }: any) {
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [view, setView] = useState<'list' | 'form'>('list');
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [produtosServicosText, setProdutosServicosText] = useState('');
  const [regioesAtendidasText, setRegioesAtendidasText] = useState('');

  const [formData, setFormData] = useState<{
    _id: string; cnpj: string; razao_social: string; enquadramento: string;
    nome_fantasia: string; website: string;
    capital_social: string; cnae_principal: string; cnae_descricao: string;
    cnaes_secundarios: { codigo: string; descricao: string }[];
    situacao_cadastral: string;
    uf: string; municipio: string;
    core_business: string;
    produtos_servicos: string[];
    regioes_atendidas: string[];
    capacidade_operacional: string;
    margem_minima_pct: string;
    limite_contrato: string;
    historico_vitorias: string;
    observacoes_operacionais: string;
  }>({
    _id: '', cnpj: '', razao_social: '', enquadramento: '', capital_social: '',
    nome_fantasia: '', website: '',
    cnae_principal: '', cnae_descricao: '', cnaes_secundarios: [],
    situacao_cadastral: '',
    uf: '', municipio: '',
    core_business: '', produtos_servicos: [], regioes_atendidas: [],
    capacidade_operacional: '', margem_minima_pct: '', limite_contrato: '',
    historico_vitorias: '', observacoes_operacionais: '',
  });

  const vagasTotais = userTier === 4 ? 3 : userTier === 3 ? 2 : userTier === 2 ? 1 : 0;
  // Conta apenas empresas ativas (não suspensas nem desabilitadas)
  const slotsOcupados = companiesList.filter((c: any) => !c.suspended && !c.disabled).length;

  useEffect(() => {
    if (companyData) {
      const lista = Array.isArray(companyData) ? companyData : (companyData.cnpj ? [companyData] : []);
      setCompaniesList(lista);

      // Auto-enriquecer empresas sem CNAE ou sem CNAEs secundários — silencioso
      lista.forEach(async (emp: any) => {
        const precisaEnriquecer = emp.cnpj && (!emp.cnae_principal || !emp.cnaes_secundarios?.length);
        if (precisaEnriquecer) {
          try {
            const cnpjLimpo = emp.cnpj.replace(/\D/g, '');
            const res = await apiFetch(`${API_URL}/api/company/search/${cnpjLimpo}`);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.cnae_principal) return;

            const enriched = {
              ...emp,
              cnae_principal: data.cnae_principal,
              cnae_descricao: data.cnae_descricao || '',
              cnaes_secundarios: data.cnaes_secundarios || [],
              uf: data.uf || emp.uf || '',
              municipio: data.municipio || emp.municipio || '',
            };

            // Salva o enriquecimento no backend
            await apiFetch(`${API_URL}/api/workspace/company`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(enriched),
            });

            // Atualiza a lista local imediatamente
            setCompaniesList(prev =>
              prev.map(e => e.cnpj === emp.cnpj ? enriched : e)
            );
          } catch {
            // silencioso — não interrompe a UI
          }
        }
      });
    }
  }, [companyData, token, API_URL]);

  const handleAddNew = () => {
    setFormData({
      _id: '', cnpj: '', razao_social: '', enquadramento: '', capital_social: '',
      nome_fantasia: '', website: '',
      cnae_principal: '', cnae_descricao: '', cnaes_secundarios: [],
      situacao_cadastral: '',
      uf: '', municipio: '',
      core_business: '', produtos_servicos: [], regioes_atendidas: [],
      capacidade_operacional: '', margem_minima_pct: '', limite_contrato: '',
      historico_vitorias: '', observacoes_operacionais: '',
    });
    setProdutosServicosText('');
    setRegioesAtendidasText('');
    setView('form');
  };

  const handleEdit = (emp: any) => {
    setFormData({
      _id: emp._id || '',
      cnpj: emp.cnpj || '',
      razao_social: emp.razao_social || '',
      nome_fantasia: emp.nome_fantasia || '',
      website: emp.website || '',
      enquadramento: emp.enquadramento || '',
      capital_social: emp.capital_social || '',
      cnae_principal: emp.cnae_principal || '',
      cnae_descricao: emp.cnae_descricao || '',
      cnaes_secundarios: emp.cnaes_secundarios || [],
      situacao_cadastral: emp.situacao_cadastral || '',
      uf: emp.uf || '',
      municipio: emp.municipio || '',
      core_business: emp.core_business || emp.descricao || '',
      produtos_servicos: Array.isArray(emp.produtos_servicos) ? emp.produtos_servicos : [],
      regioes_atendidas: Array.isArray(emp.regioes_atendidas) ? emp.regioes_atendidas : [],
      capacidade_operacional: emp.capacidade_operacional || '',
      margem_minima_pct: emp.margem_minima_pct || '',
      limite_contrato: emp.limite_contrato || '',
      historico_vitorias: emp.historico_vitorias || '',
      observacoes_operacionais: emp.observacoes_operacionais || '',
    });
    setProdutosServicosText(Array.isArray(emp.produtos_servicos) ? emp.produtos_servicos.join(', ') : '');
    setRegioesAtendidasText(Array.isArray(emp.regioes_atendidas) ? emp.regioes_atendidas.join(', ') : '');
    setView('form');
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.slice(0, 14);
    setFormData({ ...formData, cnpj: value });
  };

  const handleFetchCnpj = async () => {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setMessage({ type: 'error', text: 'CNPJ incompleto.' });
      return;
    }
    setIsSearchingCnpj(true);
    try {
      const res = await apiFetch(`${API_URL}/api/company/search/${cnpjLimpo}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao buscar CNPJ');
      
      setFormData({
        ...formData,
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || '',
        enquadramento: data.porte || '',
        capital_social: data.capital_social || '',
        cnae_principal: data.cnae_principal || '',
        cnae_descricao: data.cnae_descricao || '',
        cnaes_secundarios: data.cnaes_secundarios || [],
        situacao_cadastral: data.situacao_cadastral || '',
        uf: data.uf || '',
        municipio: data.municipio || '',
      });

      if (data.situacao_cadastral && !isSituacaoAtiva(data.situacao_cadastral)) {
        setMessage({
          type: 'error',
          text: `Este CNPJ consta como "${data.situacao_cadastral}" na Receita Federal — não será possível confirmar a monitorização até regularizar ou corrigir o número.`,
        });
      }

    } catch (error: any) {
      if (error instanceof SessionExpiredError) { clearSession(); return; }
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleCompanyLookupSelect = async (company: CompanyLookupResult) => {
    const cnpjLimpo = String(company.cnpj || '').replace(/\D/g, '');
    let enriched = company;

    if (cnpjLimpo.length === 14 && (!company.cnae_principal || !company.cnae_descricao || !company.situacao_cadastral)) {
      setIsSearchingCnpj(true);
      try {
        const res = await apiFetch(`${API_URL}/api/company/search/${cnpjLimpo}`);
        const data = await res.json().catch(() => null);
        if (res.ok && data) enriched = { ...company, ...data };
      } catch (error) {
        if (error instanceof SessionExpiredError) { clearSession(); return; }
      } finally {
        setIsSearchingCnpj(false);
      }
    }

    setFormData(prev => ({
      ...prev,
      cnpj: cnpjLimpo || prev.cnpj,
      razao_social: enriched.razao_social || enriched.nome_fantasia || prev.razao_social,
      nome_fantasia: enriched.nome_fantasia || prev.nome_fantasia,
      website: enriched.website || (enriched.domain ? `https://${enriched.domain}` : prev.website),
      enquadramento: enriched.porte || enriched.enquadramento || prev.enquadramento,
      capital_social: enriched.capital_social || prev.capital_social,
      cnae_principal: enriched.cnae_principal || prev.cnae_principal,
      cnae_descricao: enriched.cnae_descricao || prev.cnae_descricao,
      cnaes_secundarios: enriched.cnaes_secundarios || prev.cnaes_secundarios,
      situacao_cadastral: enriched.situacao_cadastral || prev.situacao_cadastral,
      uf: enriched.uf || prev.uf,
      municipio: enriched.municipio || prev.municipio,
    }));

    if (enriched.situacao_cadastral && !isSituacaoAtiva(enriched.situacao_cadastral)) {
      setMessage({
        type: 'error',
        text: `Este CNPJ consta como "${enriched.situacao_cadastral}" na Receita Federal — não será possível confirmar a monitorização até regularizar ou corrigir o número.`,
      });
      return;
    }

    setMessage({
      type: 'success',
      text: cnpjLimpo
        ? 'Empresa encontrada. Revise os dados e confirme a monitorização.'
        : 'Domínio aplicado. Complete o CNPJ quando quiser ativar CNAE e dados públicos.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setMessage({ type: 'error', text: 'Informe o CNPJ para confirmar a monitorização da empresa.' });
      return;
    }
    if (formData.situacao_cadastral && !isSituacaoAtiva(formData.situacao_cadastral)) {
      setMessage({
        type: 'error',
        text: `Este CNPJ consta como "${formData.situacao_cadastral}" na Receita Federal e não pode ser cadastrado para monitorização.`,
      });
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/workspace/company`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          produtos_servicos: splitList(produtosServicosText),
          regioes_atendidas: splitList(regioesAtendidasText),
        })
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.detail || 'Erro ao processar dados');

      setMessage({ type: 'success', text: 'Monitorização atualizada!' });
      
      if (onUpdate) await onUpdate();
      setView('list');
    } catch (error: any) {
      if (error instanceof SessionExpiredError) { clearSession(); return; }
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (cnpj: string) => {
    try {
      const res = await apiFetch(`${API_URL}/api/workspace/company/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj }),
      });
      if (!res.ok) throw new Error('Erro ao ativar empresa.');
      setMessage({ type: 'success', text: 'Empresa ativada! O seletor de análise foi atualizado.' });
      if (onUpdate) await onUpdate();
    } catch (error: any) {
      if (error instanceof SessionExpiredError) { clearSession(); return; }
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDelete = async (cnpj: string) => {
    if (!window.confirm("Remover esta empresa da sua monitorização?")) return;
    
    // UI Otimista: remove da tela instantaneamente
    setCompaniesList(prev => prev.filter(emp => emp.cnpj !== cnpj));
    
    try {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const res = await apiFetch(`${API_URL}/api/workspace/company/${cnpjLimpo}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Erro ao remover empresa do servidor.');
      
      setMessage({ type: 'success', text: 'Empresa removida com sucesso!' });
      if (onUpdate) await onUpdate(); // Sincroniza o estado global
    } catch (error: any) {
      if (error instanceof SessionExpiredError) { clearSession(); return; }
      setMessage({ type: 'error', text: error.message });
      if (onUpdate) await onUpdate(); // Reverte a UI se falhar
    }
  };

  const splitList = (value: string) =>
    value
      .split(/[,;\n]/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 20);

  const inputStyle = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10";
  const labelStyle = "mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400";

  return (
    <div className="space-y-6">
      
      {/* 📊 PAINEL DE SLOTS */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-emerald-600 shadow-sm">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Slots de Monitorização</p>
            <p className="text-[11px] font-bold text-slate-700">Plano Ativo: Nível {userTier}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xl font-black ${slotsOcupados > vagasTotais ? 'text-rose-600' : 'text-slate-900'}`}>{slotsOcupados}</span>
          <span className="text-slate-300 font-bold">/</span>
          <span className="text-xl font-black text-slate-400">{vagasTotais}</span>
        </div>
      </div>

      {message && (
        <div className={`flex items-start gap-3 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-rose-50 border border-rose-100 text-rose-700'
        }`}>
          <div className="mt-0.5">
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <span className="text-xs font-bold leading-relaxed">{message.text}</span>
        </div>
      )}

      {/* VIEW: LISTA DE EMPRESAS */}
      {view === 'list' && (
        <div className="space-y-5">
          {companiesList.map((emp) => (
            <div
              key={emp.cnpj || emp.website || emp.razao_social}
              className={[
                'group flex flex-col gap-4 rounded-lg border p-5 transition-all duration-300',
                emp.suspended
                  ? 'border-amber-200 bg-amber-50/50 opacity-70'
                  : 'border-slate-200 bg-white hover:border-emerald-200 hover:shadow-sm',
              ].join(' ')}
            >
              {emp.suspended && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="text-sm">⚠️</span>
                  <p className="text-[11px] font-black text-amber-800">
                    Radar suspenso — excede o limite do plano. Clique em <strong>Tornar ativa</strong> para privilegiá-la (outra empresa será suspensa), remova-a ou faça upgrade.
                  </p>
                </div>
              )}
              {emp.disabled && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                  <span className="text-sm">🚫</span>
                  <p className="text-[11px] font-black text-red-800">
                    Empresa desabilitada — prazo de ajuste encerrado. Indisponível para análise. Remova-a ou faça upgrade para reativar.
                  </p>
                </div>
              )}
              
              {/* === LINHA 1: DADOS E BOTÕES === */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Dados da Empresa */}
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 min-w-[48px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-600">
                    <Building2 size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight line-clamp-1">
                      {emp.nome_fantasia || emp.razao_social || 'Empresa em Monitorização'}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">
                      CNPJ: {emp.cnpj}
                    </p>
                    {emp.cnae_principal && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                          ★ {emp.cnae_principal}{emp.cnae_descricao ? ` · ${emp.cnae_descricao}` : ''}
                        </span>
                        {(emp.cnaes_secundarios || []).slice(0, 3).map((c: any) => (
                          <span key={c.codigo} className="inline-flex items-center gap-1 text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md">
                            {c.codigo}{c.descricao ? ` · ${c.descricao.substring(0, 25)}${c.descricao.length > 25 ? '…' : ''}` : ''}
                          </span>
                        ))}
                        {(emp.cnaes_secundarios || []).length > 3 && (
                          <span className="text-[9px] font-bold text-slate-400 px-1 py-0.5">
                            +{emp.cnaes_secundarios.length - 3} outros
                          </span>
                        )}
                      </div>
                    )}
                    {(emp.produtos_servicos?.length || emp.regioes_atendidas?.length || emp.margem_minima_pct || emp.limite_contrato) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(emp.produtos_servicos || []).slice(0, 3).map((item: string) => (
                          <span key={item} className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                            {item}
                          </span>
                        ))}
                        {(emp.regioes_atendidas || []).slice(0, 2).map((item: string) => (
                          <span key={item} className="rounded-md border border-sky-100 bg-sky-50 px-2 py-0.5 text-[9px] font-bold text-sky-700">
                            {item}
                          </span>
                        ))}
                        {emp.margem_minima_pct && (
                          <span className="rounded-md border border-amber-100 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                            Margem mín. {emp.margem_minima_pct}
                          </span>
                        )}
                        {emp.limite_contrato && (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                            Limite {emp.limite_contrato}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Botões de Ação */}
                <div className="flex w-full items-center justify-end gap-2 border-t border-slate-100 pt-4 md:w-auto md:border-t-0 md:pt-0">
                  {emp.suspended ? (
                    /* Empresa suspensa: botão para torná-la privilegiada */
                    <button
                      onClick={() => handleActivate(emp.cnpj)}
                      className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 transition-all hover:bg-amber-600 hover:text-white hover:border-amber-600 md:flex-none"
                      title="Tornar esta a empresa privilegiada para análise"
                    >
                      <Activity size={16} /> Tornar ativa
                    </button>
                  ) : emp.disabled ? (
                    /* Empresa desabilitada: só remoção disponível */
                    <span className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 md:flex-none cursor-default">
                      Desabilitada
                    </span>
                  ) : (
                    /* Empresa ativa: fluxo normal */
                    <button
                      onClick={() => {
                        const activeCnpj = setActiveCompanyContext(emp.cnpj);
                        if (onCnpjDetected) onCnpjDetected(activeCnpj);
                        router.push('/workspace');
                      }}
                      className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 transition-all hover:bg-emerald-600 hover:text-white md:flex-none"
                    >
                      <Activity size={16} /> Ver Radar
                    </button>
                  )}
                  {!emp.disabled && (
                    <button
                      onClick={() => handleEdit(emp)}
                      className="flex shrink-0 items-center justify-center rounded-lg bg-slate-50 p-2.5 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-800"
                      title="Editar"
                    >
                      <Edit3 size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(emp.cnpj)}
                    disabled={!emp.cnpj}
                    className="flex shrink-0 items-center justify-center rounded-lg bg-slate-50 p-2.5 text-slate-400 transition-all hover:bg-rose-100 hover:text-rose-600"
                    title="Remover Empresa"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* === LINHA 2: CGU COMPLIANCE EMBUTIDO === */}
              <div className="pt-2">
                <CguCompliancePanel
                  cnpj={emp.cnpj}
                  companyName={emp.nome_fantasia || emp.razao_social || 'Consulta Ativa'}
                  userTier={userTier ?? 1}
                  onUpgradeClick={() => router.push('/plans')}
                />
              </div>

            </div>
          ))}

          {/* BOTÃO + CNPJ */}
          {slotsOcupados < vagasTotais && (
            <button onClick={handleAddNew} className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-5 text-slate-400 transition-all hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700">
              <div className="rounded-lg bg-slate-100 p-2"><Plus size={20} /></div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Adicionar Nova Empresa</span>
            </button>
          )}
        </div>
      )}

      {/* VIEW: FORMULÁRIO DE ADIÇÃO/EDIÇÃO */}
      {view === 'form' && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Configurar Monitorização</h3>
            <button type="button" onClick={() => setView('list')} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
          </div>

          <div className="mb-6">
            <CompanyLookup
              label="Encontrar empresa"
              helperText="Busque pelo CNPJ, nome fantasia, razão social ou domínio da empresa. Se encontrar CNPJ, a Bawzi preenche CNAE, UF e capital social."
              onSelect={handleCompanyLookupSelect}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="w-full">
              <label className={labelStyle}>CNPJ da Organização</label>
              <div className="relative group">
                <input type="text" className={`${inputStyle} pr-14`} placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={handleCnpjChange} />
                <button type="button" onClick={handleFetchCnpj} disabled={isSearchingCnpj} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-emerald-600 p-2.5 text-white transition-all hover:bg-emerald-700 disabled:opacity-50">
                  <Search size={18} className={isSearchingCnpj ? 'animate-spin' : ''} />
                </button>
              </div>
              {formData.situacao_cadastral && (
                isSituacaoAtiva(formData.situacao_cadastral) ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 size={12} /> Situação cadastral: ativa na Receita Federal
                  </p>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-red-600">
                    <AlertTriangle size={12} /> Situação cadastral: {formData.situacao_cadastral} — não é possível monitorizar este CNPJ
                  </p>
                )
              )}
            </div>

            <div className="w-full">
              <label className={labelStyle}>Razão Social</label>
              <div className="relative">
                <input type="text" className={`${inputStyle} pl-12`} value={formData.razao_social} onChange={e => setFormData({...formData, razao_social: e.target.value})} />
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"><Building2 size={20} /></div>
              </div>
            </div>

            <div className="w-full md:col-span-2">
              <label className={labelStyle}>Site ou domínio</label>
              <input
                type="text"
                className={inputStyle}
                placeholder="Ex.: https://minhaempresa.com.br"
                value={formData.website}
                onChange={e => setFormData({ ...formData, website: e.target.value })}
              />
            </div>

            <div className="w-full">
              <label className={labelStyle}>Enquadramento</label>
              <div className="relative">
                <select className={`${inputStyle} appearance-none`} value={formData.enquadramento} onChange={e => setFormData({...formData, enquadramento: e.target.value})}>
                  <option value="">Selecionar Porte</option>
                  <option value="ME">ME (Microempresa)</option>
                  <option value="EPP">EPP (Empresa de Pequeno Porte)</option>
                  <option value="DEMAIS">Demais (Médio/Grande)</option>
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ShieldCheck size={20} />
                </div>
              </div>
            </div>

            <div className="w-full">
              <label className={labelStyle}>Capital Social</label>
              <div className="relative">
                <input type="text" className={`${inputStyle} pl-12`} value={formData.capital_social} onChange={e => setFormData({...formData, capital_social: e.target.value})} />
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"><Landmark size={20} /></div>
              </div>
            </div>

            <div className="w-full md:col-span-2">
              <label className={labelStyle}>CNAE Principal <span className="normal-case text-slate-300">(preenchido automaticamente ou edite)</span></label>
              <div className="flex gap-3">
                <input
                  type="text"
                  className={`${inputStyle} w-40 shrink-0`}
                  placeholder="Ex: 6201-5/01"
                  value={formData.cnae_principal}
                  onChange={e => setFormData({...formData, cnae_principal: e.target.value})}
                />
                <input
                  type="text"
                  className={inputStyle}
                  placeholder="Descrição do CNAE (opcional)"
                  value={formData.cnae_descricao}
                  onChange={e => setFormData({...formData, cnae_descricao: e.target.value})}
                />
              </div>
              {formData.cnae_principal && (
                <p className="text-[10px] text-emerald-600 font-bold mt-2 ml-1">
                  ✓ CNAE salvo — Oportunidades usará este código para encontrar editais com fit.
                </p>
              )}
              {formData.cnaes_secundarios.length > 0 && (
                <div className="mt-3 ml-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">CNAEs Secundários ({formData.cnaes_secundarios.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.cnaes_secundarios.map((c) => (
                      <span key={c.codigo} className="text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-200 px-2 py-1 rounded-md">
                        {c.codigo}{c.descricao ? ` · ${c.descricao.substring(0, 30)}${c.descricao.length > 30 ? '…' : ''}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full md:col-span-2">
              <label className={labelStyle}>Core business</label>
              <textarea
                className={`${inputStyle} min-h-[92px] resize-none leading-relaxed`}
                placeholder="Descreva em uma frase o que a empresa realmente entrega."
                value={formData.core_business}
                onChange={e => setFormData({ ...formData, core_business: e.target.value })}
              />
            </div>

            <div className="w-full md:col-span-2">
              <label className={labelStyle}>Produtos e serviços</label>
              <textarea
                className={`${inputStyle} min-h-[96px] resize-none leading-relaxed`}
                placeholder="Ex.: desenvolvimento de software, suporte técnico, licenças Microsoft"
                value={produtosServicosText}
                onChange={e => setProdutosServicosText(e.target.value)}
              />
            </div>

            <div className="w-full">
              <label className={labelStyle}>Regiões atendidas</label>
              <input
                type="text"
                className={inputStyle}
                placeholder="Ex.: SP, RJ, Nacional"
                value={regioesAtendidasText}
                onChange={e => setRegioesAtendidasText(e.target.value)}
              />
            </div>

            <div className="w-full">
              <label className={labelStyle}>Capacidade operacional</label>
              <input
                type="text"
                className={inputStyle}
                placeholder="Ex.: até 3 projetos simultâneos"
                value={formData.capacidade_operacional}
                onChange={e => setFormData({ ...formData, capacidade_operacional: e.target.value })}
              />
            </div>

            <div className="w-full">
              <label className={labelStyle}>Margem mínima</label>
              <input
                type="text"
                className={inputStyle}
                placeholder="Ex.: 18%"
                value={formData.margem_minima_pct}
                onChange={e => setFormData({ ...formData, margem_minima_pct: e.target.value })}
              />
            </div>

            <div className="w-full">
              <label className={labelStyle}>Limite operacional</label>
              <input
                type="text"
                className={inputStyle}
                placeholder="Ex.: contratos até R$ 500 mil"
                value={formData.limite_contrato}
                onChange={e => setFormData({ ...formData, limite_contrato: e.target.value })}
              />
            </div>

            <div className="w-full">
              <label className={labelStyle}>Histórico de vitórias</label>
              <textarea
                className={`${inputStyle} min-h-[96px] resize-none leading-relaxed`}
                placeholder="Ex.: venceu contratos de software em prefeituras, ticket médio R$ 120 mil"
                value={formData.historico_vitorias}
                onChange={e => setFormData({ ...formData, historico_vitorias: e.target.value })}
              />
            </div>

            <div className="w-full">
              <label className={labelStyle}>Observações operacionais</label>
              <textarea
                className={`${inputStyle} min-h-[96px] resize-none leading-relaxed`}
                placeholder="Ex.: não atende presencial fora do Sudeste, depende de estoque sob demanda"
                value={formData.observacoes_operacionais}
                onChange={e => setFormData({ ...formData, observacoes_operacionais: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button type="submit" disabled={isLoading || (!!formData.situacao_cadastral && !isSituacaoAtiva(formData.situacao_cadastral))} className="flex-1 rounded-lg bg-slate-950 px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60">
              {isLoading ? 'A Processar...' : 'Confirmar Monitorização ↗'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
