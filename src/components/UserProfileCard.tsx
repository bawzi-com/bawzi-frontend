import React from 'react';

interface UserProfileCardProps {
  user: {
    name?: string;
    email: string;
    tier?: number;
    workspace_users_count?: number;
    vagas_totais?: number;
    // 🟢 Tipagem atualizada para o modelo em Português
    company?: {
      cnpj?: string;
      razao_social?: string;
      nome_fantasia?: string;
      enquadramento?: string;
    } | null;
  };
  currentTier?: number; 
}

export default function UserProfileCard({ user, currentTier }: UserProfileCardProps) {
  
  // 🟢 LÓGICA DO NÍVEL: Usa o currentTier (Nível 4) ou o fallback de segurança
  const activeTier = currentTier !== undefined && currentTier !== -1 ? currentTier : (user.tier || 1);

  // Cores dinâmicas para o Crachá do Nível (Tier)
  const getTierStyle = (tier: number) => {
    switch (tier) {
      case 4: return 'bg-slate-900 text-yellow-400 border-slate-800 shadow-[0_0_10px_rgba(250,204,21,0.2)]'; // Elite/Dominador
      case 3: return 'bg-indigo-50 text-indigo-700 border-indigo-200'; // Pro
      case 2: return 'bg-violet-50 text-violet-700 border-violet-200'; // Essencial
      default: return 'bg-slate-50 text-slate-600 border-slate-200';   // Free
    }
  };

  // Nomes dos Tiers (Opcional, se quiser usar no futuro)
  const getTierName = (tier: number) => {
    switch (tier) {
      case 4: return 'Dominador';
      case 3: return 'Especialista';
      case 2: return 'Essencial';
      default: return 'Potencial';
    }
  };

  // Lógica da Barra de Progresso (Vagas da Equipe)
  const vagasUsadas = user.workspace_users_count || 1;
  
  // 🟢 Fallback inteligente: se o servidor falhar a enviar, deduz as vagas pelo Nível
  const getFallbackVagas = (tier: number) => {
    if (tier === 4) return 10; // Dominador
    if (tier === 3) return 5;  // Especialista
    if (tier === 2) return 3;  // Essencial
    return 1;                  // Grátis
  };
  
  const vagasTotais = user.vagas_totais || getFallbackVagas(activeTier);
  const percentagemUso = Math.min((vagasUsadas / vagasTotais) * 100, 100);
  
  // Extrair a inicial do nome para o Avatar Dinâmico
  const initial = (user.name || user.email || 'B').charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-5 w-full">
      
      {/* ========================================== */}
      {/* 1. CABEÇALHO DO PERFIL (Avatar + Nome)       */}
      {/* ========================================== */}
      <div className="flex items-center gap-4">
        
        {/* Avatar Moderno com Luz de Online */}
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-violet-500/30 border-2 border-white">
            {initial}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
             <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
          </div>
        </div>
        
        {/* Dados do Utilizador e Crachá */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-base font-black text-slate-900 truncate">
              {user.name || 'Utilizador Bawzi'}
            </h4>
            
            {/* 🟢 O CRACHÁ DO NÍVEL (Agora dinâmico e estiloso) */}
            <span className={`shrink-0 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border flex items-center gap-1 ${getTierStyle(activeTier)}`}>
              <span>⭐</span> Nível {activeTier}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 truncate">
            {user.email}
          </p>
        </div>
      </div>

      <div className="h-px w-full bg-slate-100"></div>

      {/* ========================================== */}
      {/* 2. UTILIZAÇÃO DA EQUIPA (Barra de Progresso) */}
      {/* ========================================== */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilização da Equipe</span>
          <span className="text-xs font-bold text-slate-700">
            {vagasUsadas} <span className="text-slate-400 font-medium">de {vagasTotais} Vagas</span>
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${percentagemUso >= 100 ? 'bg-amber-500' : 'bg-violet-500'}`}
            style={{ width: `${percentagemUso}%` }}
          ></div>
        </div>
        {percentagemUso >= 100 && (
          <p className="text-[10px] text-amber-600 font-bold mt-0.5 flex items-center gap-1">
            <span>⚠️</span> Limite de vagas atingido no Workspace.
          </p>
        )}
      </div>

      {/* ========================================== */}
      {/* 3. EMPRESA VINCULADA (Card Corporativo)      */}
      {/* ========================================== */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-start gap-3 transition-colors hover:bg-slate-100/50">
        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 shadow-sm">
          🏢
        </div>
        <div className="flex flex-col min-w-0 justify-center min-h-[32px]">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
            Empresa Vinculada
          </span>
          <span className="text-sm font-bold text-slate-700 truncate">
            {user.company?.nome_fantasia || user.company?.razao_social || 'Empresa não identificada'}
          </span>
        </div>
      </div>

    </div>
  );
}