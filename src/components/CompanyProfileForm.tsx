'use client';

import { useState, useEffect } from 'react';
import { Building2, Search, Lock, ShieldCheck, Landmark, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function CompanyProfileForm({ companyData, userTier, token, onUpdate }: any) {
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    _id: companyData?._id || '',
    cnpj: companyData?.cnpj || '',
    razao_social: companyData?.razao_social || '',
    enquadramento: companyData?.enquadramento || '',
    capital_social: companyData?.capital_social || '',
  });

  // Cálculo de Slots (Nível 3 = 2 Slots)
  const vagasCnpjPermitidas = userTier === 4 ? 3 : userTier === 3 ? 2 : userTier === 2 ? 1 : 0;
  const slotsOcupados = companyData?._id ? 1 : 0;

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.slice(0, 14);
    value = value.replace(/^(\d{2})(\d)/, '$1.$2');
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
    value = value.replace(/(\d{4})(\d)/, '$1-$2');
    setFormData({ ...formData, cnpj: value });
  };

  // 🟢 BUSCA CORRIGIDA (TRATAMENTO DE TIPAGEM)
  const handleFetchCnpj = async () => {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setMessage({ type: 'error', text: 'CNPJ incompleto.' });
      return;
    }

    setIsSearchingCnpj(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/company/search/${cnpjLimpo}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || 'Empresa não encontrada.');

      let enquadramentoFinal = '';
      const porteRecebido = String(data.porte || data.enquadramento || '').toUpperCase();
      
      if (porteRecebido === '1' || porteRecebido === '01' || porteRecebido.includes('MICRO') || porteRecebido === 'ME') {
        enquadramentoFinal = 'ME';
      } else if (porteRecebido === '3' || porteRecebido === '03' || porteRecebido.includes('PEQUENO') || porteRecebido === 'EPP') {
        enquadramentoFinal = 'EPP';
      } else if (porteRecebido === '5' || porteRecebido === '05' || porteRecebido.includes('DEMAIS')) {
        enquadramentoFinal = 'DEMAIS';
      }

      let valorBruto = 0;
      if (typeof data.capital_social === 'string') {
        const valorLimpo = data.capital_social.replace(/\./g, '').replace(',', '.');
        valorBruto = parseFloat(valorLimpo) || 0;
      } else {
        valorBruto = data.capital_social || 0;
      }

      const capitalFormatado = new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
      }).format(valorBruto);

      setFormData(prev => ({
        ...prev,
        razao_social: data.razao_social || data.nome_fantasia || '',
        enquadramento: enquadramentoFinal,
        capital_social: capitalFormatado
      }));

      setMessage({ type: 'success', text: 'Dados carregados da Receita Federal.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/company/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.detail || 'Erro ao salvar no banco.');

      setMessage({ type: 'success', text: 'Empresa vinculada com sucesso!' });
      if (onUpdate) onUpdate();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = "w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white outline-none transition-all disabled:opacity-50";
  const labelStyle = "block text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 ml-1";

  return (
    <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border-2 border-slate-100 shadow-sm mt-10">
      <div className="flex flex-col gap-4 mb-10 pb-8 border-b border-slate-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center text-white shadow-lg">
            <Building2 size={24} />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Empresa Vinculada</h3>
        </div>
        <div className="inline-flex items-center gap-2 self-start px-4 py-2 bg-violet-50 border border-violet-100 rounded-xl">
          <Zap size={14} className="text-violet-600 fill-violet-600" />
          <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">
            Nível {userTier} • {slotsOcupados} DE {vagasCnpjPermitidas} SLOTS UTILIZADOS
          </span>
        </div>
      </div>

      {message && (
        <div className={`mb-10 p-5 rounded-2xl flex items-center gap-3 text-sm font-bold border-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-100' : 'bg-red-50 text-red-900 border-red-100'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="text-emerald-500" size={20} /> : <AlertTriangle className="text-red-500" size={20} />}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="w-full">
          <label className={labelStyle}>CNPJ</label>
          <div className="flex gap-3">
            <input 
              type="text" className={inputStyle} placeholder="00.000.000/0000-00" 
              value={formData.cnpj} onChange={handleCnpjChange}
            />
            <button 
              type="button" onClick={handleFetchCnpj} disabled={isSearchingCnpj}
              className="px-6 bg-white border-2 border-slate-200 rounded-2xl hover:border-violet-500 hover:text-violet-600 transition-all text-slate-400 flex items-center justify-center shrink-0 shadow-sm"
            >
              {isSearchingCnpj ? <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : <Search size={22} />}
            </button>
          </div>
        </div>

        <div className="w-full">
          <label className={labelStyle}>Razão Social</label>
          <input 
            type="text" className={inputStyle} value={formData.razao_social}
            onChange={e => setFormData({...formData, razao_social: e.target.value})}
          />
        </div>

        <div className="w-full">
          <label className={labelStyle}>Enquadramento Fiscal</label>
          <div className="relative">
            <select 
              className={`${inputStyle} appearance-none cursor-pointer pr-12`}
              value={formData.enquadramento}
              onChange={e => setFormData({...formData, enquadramento: e.target.value})}
            >
              <option value="" disabled>Selecione uma opção...</option>
              <option value="ME">ME (Microempresa)</option>
              <option value="EPP">EPP (Empresa de Pequeno Porte)</option>
              {/* 🟢 CORREÇÃO: "DEMAIS" tudo em maiúsculas para dar match perfeito com a API */}
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
            <input 
              type="text" className={`${inputStyle} pl-12`} 
              value={formData.capital_social}
              onChange={e => setFormData({...formData, capital_social: e.target.value})}
            />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
              <Landmark size={20} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-8 border-t border-slate-50 mt-4">
          <button 
            type="submit" disabled={isLoading}
            className="w-full md:w-auto px-12 py-5 bg-slate-900 text-white hover:bg-violet-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
          >
            {isLoading ? 'A Guardar...' : 'Vincular Empresa'}
          </button>
        </div>
      </form>
    </div>
  );
}