'use client';

import { useState, useEffect } from 'react';
import CguCompliancePanel from './CompliancePanel';
import { useRouter } from 'next/navigation';
import { Building2, Search, Landmark, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Plus, Trash2, Edit3, Activity } from 'lucide-react';

export default function CompanyProfileForm({ companyData, userTier, token, onUpdate, onCnpjDetected }: any) {
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [view, setView] = useState<'list' | 'form'>('list');
  const [companiesList, setCompaniesList] = useState<any[]>([]);

  const [formData, setFormData] = useState<{
    _id: string; cnpj: string; razao_social: string; enquadramento: string;
    capital_social: string; cnae_principal: string; cnae_descricao: string;
    cnaes_secundarios: { codigo: string; descricao: string }[];
    uf: string; municipio: string;
  }>({
    _id: '', cnpj: '', razao_social: '', enquadramento: '', capital_social: '',
    cnae_principal: '', cnae_descricao: '', cnaes_secundarios: [],
    uf: '', municipio: '',
  });

  const vagasTotais = userTier === 4 ? 3 : userTier === 3 ? 2 : userTier === 2 ? 1 : 0;
  const slotsOcupados = companiesList.length;

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
            const res = await fetch(`${API_URL}/api/company/search/${cnpjLimpo}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
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
            await fetch(`${API_URL}/api/workspace/company`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    setFormData({ _id: '', cnpj: '', razao_social: '', enquadramento: '', capital_social: '', cnae_principal: '', cnae_descricao: '', cnaes_secundarios: [], uf: '', municipio: '' });
    setView('form');
  };

  const handleEdit = (emp: any) => {
    setFormData({
      _id: emp._id || '',
      cnpj: emp.cnpj || '',
      razao_social: emp.razao_social || '',
      enquadramento: emp.enquadramento || '',
      capital_social: emp.capital_social || '',
      cnae_principal: emp.cnae_principal || '',
      cnae_descricao: emp.cnae_descricao || '',
      cnaes_secundarios: emp.cnaes_secundarios || [],
      uf: emp.uf || '',
      municipio: emp.municipio || '',
    });
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
      const res = await fetch(`${API_URL}/api/company/search/${cnpjLimpo}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao buscar CNPJ');
      
      setFormData({
        ...formData,
        razao_social: data.razao_social || '',
        enquadramento: data.porte || '',
        capital_social: data.capital_social || '',
        cnae_principal: data.cnae_principal || '',
        cnae_descricao: data.cnae_descricao || '',
        cnaes_secundarios: data.cnaes_secundarios || [],
        uf: data.uf || '',
        municipio: data.municipio || '',
      });
            
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/workspace/company`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.detail || 'Erro ao processar dados');

      setMessage({ type: 'success', text: 'Monitorização atualizada!' });
      
      if (onUpdate) await onUpdate();
      setView('list');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (cnpj: string) => {
    if (!window.confirm("Remover esta empresa da sua monitorização?")) return;
    
    // UI Otimista: remove da tela instantaneamente
    setCompaniesList(prev => prev.filter(emp => emp.cnpj !== cnpj));
    
    try {
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const res = await fetch(`${API_URL}/api/workspace/company/${cnpjLimpo}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Erro ao remover empresa do servidor.');
      
      setMessage({ type: 'success', text: 'Empresa removida com sucesso!' });
      if (onUpdate) await onUpdate(); // Sincroniza o estado global
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      if (onUpdate) await onUpdate(); // Reverte a UI se falhar
    }
  };

  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all";
  const labelStyle = "block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1";

  return (
    <div className="space-y-6">
      
      {/* 📊 PAINEL DE SLOTS */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white rounded-xl shadow-sm text-indigo-600 border border-slate-100">
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
        <div className={`p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
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
              key={emp.cnpj} 
              className="group bg-white border border-slate-200 rounded-[1.5rem] p-5 flex flex-col gap-4 hover:border-indigo-300 hover:shadow-md transition-all duration-300"
            >
              
              {/* === LINHA 1: DADOS E BOTÕES === */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Dados da Empresa */}
                <div className="flex items-center gap-4">
                  <div className="min-w-[48px] w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
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
                  </div>
                </div>
                
                {/* Botões de Ação */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t border-slate-100 md:border-t-0 pt-4 md:pt-0">
                  {/* === LINHA 1: DADOS E BOTÕES === */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Dados da Empresa... */}

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t border-slate-100 md:border-t-0 pt-4 md:pt-0">
                        <button 
                          onClick={() => {
                            // 🟢 3. AÇÃO DUPLA: Atualiza o estado e Redireciona
                            if (onCnpjDetected) onCnpjDetected(emp.cnpj); 
                            router.push('/workspace'); 
                          }} 
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex-1 md:flex-none whitespace-nowrap"
                        >
                          <Activity size={16} /> Ver Radar
                        </button>
                        
                        {/* Botões Editar e Remover... */}
                      </div>
                    </div>
                  <button 
                    onClick={() => handleEdit(emp)} 
                    className="flex items-center justify-center p-2.5 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-200 hover:text-slate-800 transition-all shrink-0"
                    title="Editar"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(emp.cnpj)} 
                    className="flex items-center justify-center p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-100 hover:text-rose-600 transition-all shrink-0"
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
            <button onClick={handleAddNew} className="w-full border-2 border-dashed border-slate-200 rounded-[1.5rem] p-5 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all mt-2">
              <div className="p-2 bg-slate-100 rounded-full"><Plus size={20} /></div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Adicionar Nova Empresa</span>
            </button>
          )}
        </div>
      )}

      {/* VIEW: FORMULÁRIO DE ADIÇÃO/EDIÇÃO */}
      {view === 'form' && (
        <form onSubmit={handleSubmit} className="animate-in fade-in slide-in-from-bottom-4 duration-300 border border-slate-200 p-6 rounded-[2rem] bg-white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Configurar Monitorização</h3>
            <button type="button" onClick={() => setView('list')} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="w-full">
              <label className={labelStyle}>CNPJ da Organização</label>
              <div className="relative group">
                <input type="text" className={`${inputStyle} pr-14`} placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={handleCnpjChange} />
                <button type="button" onClick={handleFetchCnpj} disabled={isSearchingCnpj} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
                  <Search size={18} className={isSearchingCnpj ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            
            <div className="w-full">
              <label className={labelStyle}>Razão Social</label>
              <div className="relative">
                <input type="text" className={`${inputStyle} pl-12`} value={formData.razao_social} onChange={e => setFormData({...formData, razao_social: e.target.value})} />
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"><Building2 size={20} /></div>
              </div>
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
          </div>

          <div className="flex gap-3 mt-8">
            <button type="submit" disabled={isLoading} className="flex-1 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all">
              {isLoading ? 'A Processar...' : 'Confirmar Monitorização ↗'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
