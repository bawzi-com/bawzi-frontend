import React from 'react';
import ActiveContextSwitcher from './ActiveContextSwitcher';
import type { Empresa } from '@/lib/types';

interface UserProfileCardProps {
  user: {
    name?: string;
    email: string;
    tier?: number;
    workspace_users_count?: number;
    vagas_totais?: number;
    active_cnpj?: string; // 🟢 2. Avisamos que o active_cnpj existe
    companies?: Empresa[] | null;
    company?: Empresa;
  };
  currentTier?: number; 
  onActiveCnpjChange?: (cnpj: string, company: Empresa | null) => void;
}

export default function UserProfileCard({ user, currentTier, onActiveCnpjChange }: UserProfileCardProps) {
  
  // LÓGICA DO NÍVEL
  const activeTier = Math.max(Number(currentTier) || 1, Number(user?.tier) || 1);

  // Cores dinâmicas para o Crachá
  const getTierStyle = (tier: number) => {
    switch (tier) {
      case 4: return 'bg-slate-900 text-emerald-300 border-slate-800 shadow-[0_0_10px_rgba(5,150,105,0.18)]';
      case 3: return 'bg-sky-50 text-sky-700 border-sky-200';
      case 2: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  // Lógica da Barra de Progresso
  const vagasUsadas = user.workspace_users_count || 1;
  const getFallbackVagas = (tier: number) => {
    if (tier === 4) return 10;
    if (tier === 3) return 5;
    if (tier === 2) return 3;
    return 1;
  };
  
  const vagasTotais = user.vagas_totais || getFallbackVagas(activeTier);
  const percentagemUso = Math.min((vagasUsadas / vagasTotais) * 100, 100);
  
  // Avatar Dinâmico
  const initial = (user.name || user.email || 'B').charAt(0).toUpperCase();

  const contextCompanies = user.companies?.length ? user.companies : user.company ? [user.company] : [];

  return (
    <div className="flex flex-col gap-5 w-full">
      
      {/* ========================================== */}
      {/* 1. CABEÇALHO DO PERFIL */}
      {/* ========================================== */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-emerald-600/20 border-2 border-white">
            {initial}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
             <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-base font-black text-slate-900 truncate">
              {user.name || 'Usuário Bawzi'}
            </h4>
            <span className={`shrink-0 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border flex items-center gap-1 ${getTierStyle(activeTier)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" /> Nível {activeTier}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 truncate">
            {user.email}
          </p>
        </div>
      </div>

      <div className="h-px w-full bg-slate-100"></div>

      {/* ========================================== */}
      {/* 2. UTILIZAÇÃO DA EQUIPA — só tier 2+       */}
      {/* ========================================== */}
      {activeTier >= 2 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilização da Equipe</span>
            <span className="text-xs font-bold text-slate-700">
              {vagasUsadas} <span className="text-slate-400 font-medium">de {vagasTotais} Vagas</span>
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${percentagemUso >= 100 ? 'bg-amber-500' : 'bg-emerald-600'}`}
              style={{ width: `${percentagemUso}%` }}
            ></div>
          </div>
          {percentagemUso >= 100 && (
            <p className="text-[10px] text-amber-600 font-bold mt-0.5 flex items-center gap-1">
              <span>⚠️</span> Limite de vagas atingido no Workspace.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano</span>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
            Individual · Gratuito
          </span>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. CONTEXTO ATIVO — só tier 2+             */}
      {/* ========================================== */}
      {activeTier >= 2 && (
        <ActiveContextSwitcher
          companies={contextCompanies}
          activeCnpj={user.active_cnpj}
          label="Contexto ativo"
          onChange={onActiveCnpjChange}
          className="border-emerald-100 bg-gradient-to-r from-emerald-50/70 to-white"
        />
      )}

    </div>
  );
}
