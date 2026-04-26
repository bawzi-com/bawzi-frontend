'use client';

import React, { useState, useEffect } from 'react';

export default function CompanyProfileForm({ userToken, initialData, is_admin, onSuccess }: any) {
  // 1. Estados dos Campos
  const [cnpj, setCnpj] = useState(initialData?.cnpj || '');
  const [razaoSocial, setRazaoSocial] = useState(initialData?.razao_social || '');
  const [enquadramento, setEnquadramento] = useState(initialData?.natureza_juridica || '');
  const [capitalSocial, setCapitalSocial] = useState(initialData?.capital_social || '');
  const [cnae, setCnae] = useState(initialData?.cnae_principal || '');
  const [website, setWebsite] = useState(initialData?.website || '');

  useEffect(() => {
    if (cnpj.trim() === '') {
      setRazaoSocial('');
      setEnquadramento('');
      setCapitalSocial('');
      setCnae('');
      setWebsite('');
      Opcional: setStatus(null);
    }
  }, [cnpj]);
  
  // 2. Estados de Carregamento e Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  
  // 🟢 O Cérebro do Feedback (Aceita info, success e error)
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error', msg: string } | null>(null);

  // ==========================================
  // FUNÇÃO 1: PUXAR DADOS (RECEITA FEDERAL)
  // ==========================================
  const handleFetchCNPJ = async () => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) {
      setStatus({ type: 'error', msg: '⚠️ Digite um CNPJ válido com 14 números.' });
      return;
    }

    setIsFetching(true);
    setStatus({ type: 'info', msg: '🔍 A consultar a Receita Federal...' });

    try {
      // Usamos a BrasilAPI (gratuita e sem bloqueio de CORS)
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (!res.ok) throw new Error('CNPJ não encontrado');
      
      const data = await res.json();

      // Preenche os campos automaticamente
      setRazaoSocial(data.razao_social);
      setEnquadramento(data.porte);
      setCnae(data.cnae_fiscal_descricao || data.cnae_fiscal);
      setCapitalSocial(data.capital_social);

      // Feedback de Sucesso
      setStatus({ type: 'success', msg: '✅ Empresa encontrada! Dados preenchidos.' });
      setTimeout(() => setStatus(null), 4000);

    } catch (err) {
      setStatus({ type: 'error', msg: '❌ CNPJ não encontrado ou Receita indisponível.' });
    } finally {
      setIsFetching(false);
    }
  };

// ==========================================
  // FUNÇÃO 2: GUARDAR NO SEU BANCO DE DADOS
  // ==========================================
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus({ type: 'info', msg: '💾 A guardar o perfil estratégico...' });

    try {
      const token = userToken || localStorage.getItem('bawzi_token');
      
      const capitalFormatado = capitalSocial 
        ? parseInt(String(capitalSocial).replace(/\D/g, ''), 10) 
        : null;

      const payload = {
        company: {
          cnpj: cnpj.replace(/\D/g, ''),
          razao_social: razaoSocial,
          natureza_juridica: enquadramento,
          capital_social: capitalFormatado,
          cnae_principal: cnae,
          website: website
        }
      };

      const response = await fetch('http://localhost:8000/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      // 🟢 O SEGREDO: Ler o JSON mesmo quando a resposta falha
      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', msg: '🚀 Perfil estratégico salvo com sucesso!' });
        if (onSuccess) onSuccess(); 
        setTimeout(() => setStatus(null), 4000);
      } else {
        // Se o backend enviar um "detail" (como a mensagem do 403), usamos ela!
        setStatus({ type: 'error', msg: data.detail || '❌ Ocorreu um erro ao salvar. Tente novamente.' });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: '❌ Erro de ligação ao servidor.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
      <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
        ⚡ DNA Empresarial
      </h2>

      {/* 🟢 BANNER DE FEEDBACK DINÂMICO */}
      {status && (
        <div className={`mb-6 p-4 rounded-xl font-bold text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
          status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' :
          'bg-blue-50 text-blue-700 border border-blue-100' // Info (Loading)
        }`}>
          {status.type === 'info' && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
          {status.msg}
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        
        {/* LINHA 1: CNPJ e Botão Puxar */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">CNPJ</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="00.000.000/0000-00"
              className="flex-1 p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none font-bold text-slate-700"
              value={cnpj} 
              onChange={e => setCnpj(e.target.value)} 
              disabled={!is_admin}
            />
            <button 
              type="button" 
              onClick={handleFetchCNPJ}
              disabled={isFetching || !cnpj}
              className="px-6 py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isFetching ? 'A procurar...' : 'Carregar'}
            </button>
          </div>
        </div>

        {/* LINHA 2: Razão Social */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Razão Social</label>
          <input 
            type="text" 
            className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none font-bold text-slate-700"
            value={razaoSocial} 
            onChange={e => setRazaoSocial(e.target.value)} 
          />
        </div>

        {/* LINHA 3: Enquadramento e Capital Social */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Enquadramento</label>
            <input 
              type="text" 
              placeholder="Ex: ME, EPP"
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 outline-none font-bold text-slate-700"
              value={enquadramento} 
              onChange={e => setEnquadramento(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Capital Social (R$)</label>
            <input 
              type="text" 
              placeholder="Ex: 150000"
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 outline-none font-bold text-slate-700"
              value={capitalSocial} 
              onChange={e => setCapitalSocial(e.target.value)} 
            />
          </div>
        </div>

        {/* BOTÃO SALVAR */}
        <button 
          type="submit" 
          disabled={isSaving || !cnpj || !is_admin} // 👈 Adicionado o bloqueio de admin
          className={`w-full py-4 mt-4 text-white font-black text-lg rounded-xl transition-all shadow-lg active:scale-[0.98] flex justify-center items-center gap-2 ${
            !is_admin ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-pink-600 hover:opacity-90'
          }`}
        >
          {isSaving ? 'A guardar dados...' : !is_admin ? 'Acesso Restrito' : 'Guardar Perfil Estratégico'}
        </button>
      </form>
    </div>
  );
}