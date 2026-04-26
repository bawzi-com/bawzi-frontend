'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const WORKSPACE_LIMITS: Record<number, number> = {
  1: 1, 2: 2, 3: 5, 4: 10
};

export default function UserProfileCard({ user, variant = 'full' }: { user: any, variant?: 'full' | 'compact' }) {
  const router = useRouter();
  
  // 🟢 Aqui está a variável que faltava e que o TypeScript estava a pedir:
  const isCompact = variant === 'compact';
  
  const userName = user?.name || "Marcelo Mendes";
  const userEmail = user?.email || "...";
  const tier = user?.tier || 1;
  const companyName = user?.company?.razao_social || "Empresa não identificada";
  
  const usersCount = user?.workspace_users_count || 1;
  const maxUsers = WORKSPACE_LIMITS[tier] || 1;

  return (
    <div className="w-full flex flex-col gap-4">
      
      {/* 1. PERFIL: Avatar + Identidade */}
      <div className="flex items-start gap-3 min-w-0">
        
        {/* AVATAR: Degradê amigável atualizado */}
        <div 
          aria-hidden="true"
          className={`select-none ${isCompact ? 'w-10 h-10 text-lg' : 'w-12 h-12 md:w-14 md:h-14 text-xl'} rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white font-black shadow-md shrink-0`}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex flex-col min-w-0 flex-1">
          {/* Nome truncado caso seja gigante */}
          <h2 className="text-sm md:text-base font-black text-slate-900 leading-tight truncate">
            {userName}
          </h2>
          <p className="text-[9px] md:text-[10px] text-slate-400 font-medium truncate mt-0.5">
            {userEmail}
          </p>
          <div className="mt-1.5 inline-flex items-center gap-1 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded text-[8px] font-black text-amber-900 uppercase w-fit">
            <span>⭐</span> Nível {tier}
          </div>
        </div>
      </div>

      {/* 2. GESTÃO: Mudar Plano e Vagas (Empilhados na barra lateral) */}
      <div className="flex items-center justify-between bg-slate-50/50 border border-slate-100 rounded-lg p-2 gap-2">
        {tier < 4 && (
          <button 
            onClick={() => router.push('/plans')}
            className="text-[8px] font-black text-violet-700 bg-violet-100 hover:bg-violet-200 px-2 py-1.5 rounded uppercase tracking-wider transition-all active:scale-95 shadow-sm truncate"
          >
            ⚡ Mudar Plano
          </button>
        )}

        <div className={`text-[8px] font-black px-1.5 py-1 rounded border shrink-0 ml-auto ${
            usersCount >= maxUsers 
            ? 'text-red-700 bg-red-50 border-red-100' 
            : 'text-slate-600 bg-white border-slate-200'
        }`}>
           {usersCount}/{maxUsers} Vagas
        </div>
      </div>

      {/* 3. EMPRESA VINCULADA */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-2.5">
        <div className="w-8 h-8 text-sm rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">🏢</div>
        <div className="flex flex-col min-w-0">
          <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">Empresa Vinculada</span>
          <span className="text-[9px] md:text-[11px] font-bold text-slate-700 truncate" title={companyName}>
            {companyName}
          </span>
        </div>
      </div>

    </div>
  );
}