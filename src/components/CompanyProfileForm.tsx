'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// 🟢 1. Adicionamos a prop "onUpgrade" para comunicar com o Modal da tela principal
interface CompanyProfileFormProps {
  token: string;
  userTier?: number;
  onUpgrade?: () => void; 
}

export default function CompanyProfileForm({ token, userTier = 1, onUpgrade }: CompanyProfileFormProps) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // ==========================================
  // ESTADOS DO FORMULÁRIO
  // ==========================================
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [enquadramento, setEnquadramento] = useState('');
  const [capitalSocial, setCapitalSocial] = useState('');

  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ==========================================
  // 1. CARREGAR DADOS SALVOS NO BANCO
  // ==========================================
  useEffect(() => {
    const fetchExistingData = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/workspace/company`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setCnpj(data.cnpj || '');
            setRazaoSocial(data.razao_social || '');
            setEnquadramento(data.enquadramento || '');
            setCapitalSocial(data.capital_social || '');
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados da empresa:", error);
      }
    };
    
    fetchExistingData();
  }, [token, API_URL]);

  // ==========================================
  // 2. BUSCAR DADOS DO CNPJ (API EXTERNA/INTERNA)
  // ==========================================
  const handleFetchCnpj = async (e: React.MouseEvent) => {
    e.preventDefault();
    const cleanCnpj = cnpj.replace(/\D/g, ''); 

    if (cleanCnpj.length !== 14) {
      alert("Por favor, digite um CNPJ válido com 14 números.");
      return;
    }

    setIsLoadingCnpj(true);
    try {
      const res = await fetch(`${API_URL}/api/company/search/${cleanCnpj}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setRazaoSocial(data.razao_social || data.nome || '');
        setEnquadramento(data.porte || data.enquadramento || '');
        setCapitalSocial(data.capital_social ? `R$ ${data.capital_social}` : '');
      } else {
        alert("CNPJ não encontrado ou erro no servidor.");
      }
    } catch (error) {
      console.error("Erro na busca de CNPJ:", error);
      alert("Falha de conexão ao buscar CNPJ.");
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  // ==========================================
  // 3. SALVAR DADOS NO BANCO
  // ==========================================
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/workspace/company`, {
        method: 'PUT', 
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cnpj: cnpj.replace(/\D/g, ''),
          razao_social: razaoSocial,
          enquadramento,
          capital_social: capitalSocial.replace(/\D/g, '') 
        })
      });

      if (res.ok) {
        alert("DNA Empresarial atualizado com sucesso!");
      } else {
        alert("Erro ao salvar os dados da empresa.");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Falha de conexão ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================
  return (
    <form onSubmit={handleSave} className="relative">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* CNPJ */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-violet-500/10 outline-none transition-all placeholder:text-slate-300"
            />
            <button 
              onClick={handleFetchCnpj}
              disabled={isLoadingCnpj || !cnpj}
              className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed min-w-[90px]"
            >
              {isLoadingCnpj ? '...' : 'Carregar'}
            </button>
          </div>
        </div>

        {/* RAZÃO SOCIAL */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razão Social</label>
          <input 
            type="text" 
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            placeholder="Razão Social da Empresa"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-violet-500/10 outline-none transition-all placeholder:text-slate-300"
          />
        </div>

        {/* ========================================== */}
        {/* LÓGICA DINÂMICA: CARD (NÍVEL 1) vs CAMPOS (NÍVEL 2+) */}
        {/* ========================================== */}
        
        {userTier < 2 ? (
          /* --- EXIBE APENAS PARA TIER 1 --- */
          <div className="relative group overflow-hidden rounded-xl bg-slate-900 p-[1px] shadow-md transition-all hover:shadow-violet-900/30 mt-2">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600 opacity-40 group-hover:opacity-100 transition-opacity duration-700 bg-[length:200%_auto] animate-[shimmer_2s_linear_infinite]"></div>
            <div className="relative bg-slate-950 rounded-[11px] p-5 flex flex-col items-center text-center gap-4 h-full z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-lg border border-slate-700/50 shadow-inner">
                  <span className="drop-shadow-md">💎</span>
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inteligência Competitiva</h4>
                  <p className="text-sm font-bold text-white mt-1">Liberado no Nível Essencial</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => onUpgrade ? onUpgrade() : (window.location.href = '#planos')}
                className="w-full py-2.5 bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-violet-50 transition-all flex items-center justify-center gap-2"
              >
                Desbloquear Agora 🚀
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ENQUADRAMENTO (PADRONIZADO) */}
            <div className="space-y-1.5 animate-in fade-in slide-in-from-left-4 duration-500">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Enquadramento
              </label>
              <div className="relative">
                <select 
                  value={enquadramento}
                  onChange={(e) => setEnquadramento(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-violet-500/10 outline-none transition-all appearance-none cursor-pointer pr-10"
                >
                  <option value="" disabled className="text-slate-300">Selecione o porte</option>
                  <option value="ME">Microempresa (ME)</option>
                  <option value="EPP">Empresa de Pequeno Porte (EPP)</option>
                  <option value="DEMAIS">Demais (Grande Porte)</option>
                </select>
                
                {/* Ícone de Seta Customizado para manter o padrão UI */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 animate-in fade-in slide-in-from-right-4 duration-500">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Capital Social</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                <input 
                  type="text" 
                  value={capitalSocial}
                  onChange={(e) => setCapitalSocial(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-violet-500/10 outline-none transition-all"
                />
              </div>
            </div>
          </>
        )}

      </div>

      {/* BOTÃO SALVAR GLOBAL */}
      <div className="mt-8 flex justify-end">
        <button 
          type="submit"
          disabled={isSaving}
          className="bg-violet-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-violet-500 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : '💾'} 
          Salvar
        </button>
      </div>
    </form>
  );
}