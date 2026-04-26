'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const WORKSPACE_LIMITS: Record<number, number> = {
  1: 1, 2: 2, 3: 5, 4: 10
};

// 🟢 CORREÇÃO: Agora aceitamos o objeto "workspace" nas props
export default function UserProfileCard({ user, workspace, variant = 'full' }: { user: any, workspace?: any, variant?: 'full' | 'compact' }) {
  const router = useRouter();
  
  const userName = user?.name || "Marcelo Mendes";
  const userEmail = user?.email || "...";
  
  // 🟢 CORREÇÃO: Lemos os dados corretos a partir do workspace
  const tier = workspace?.tier || 1;
  const companyName = workspace?.company?.name || workspace?.company?.fantasy_name || workspace?.company?.razao_social || "Empresa não identificada";
  
  const usersCount = workspace?.workspace_users_count || 1;
  const maxUsers = workspace?.vagas_totais || WORKSPACE_LIMITS[tier] || 1;
  const vagasPercent = Math.min((usersCount / maxUsers) * 100, 100);

  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url || null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('bawzi_token');
      const res = await fetch(`${API_URL}/api/users/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(`${data.avatar_url}?t=${new Date().getTime()}`);
      } else {
        alert("Falha ao atualizar a fotografia.");
      }
    } catch (err) {
      console.error("Erro no upload do avatar:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
      
      {/* 1. CABEÇALHO: Avatar e Identidade */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-6">
        <label className={`relative cursor-pointer shrink-0 block w-fit ${isUploading ? 'pointer-events-none' : ''}`}>
          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploading} />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-inner overflow-hidden group">
            {avatarUrl ? (
              <img src={avatarUrl.startsWith('http') ? avatarUrl : `${API_URL}${avatarUrl}`} alt={userName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"/>
            ) : (
              userName.charAt(0).toUpperCase()
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isUploading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <span className="text-lg">📸</span>}
            </div>
          </div>
        </label>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-black text-slate-900 truncate">{userName}</h2>
            {/* CRACHÁ DE NÍVEL ISOLADO E ELEGANTE */}
            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-lg uppercase tracking-wider shrink-0 flex items-center gap-1">
              ⭐ Nível {tier}
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium truncate">{userEmail}</p>
        </div>
      </div>

      {/* 2. BARRA DE VAGAS (Fácil de ler) */}
      <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilização da Equipa</span>
          <span className="text-xs font-bold text-slate-700">
            <strong className={usersCount >= maxUsers ? 'text-red-600' : 'text-slate-900'}>{usersCount}</strong> de {maxUsers} Vagas
          </span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${usersCount >= maxUsers ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${vagasPercent}%` }}
          ></div>
        </div>
      </div>

      {/* 3. EMPRESA VINCULADA */}
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-white">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg shrink-0 shadow-sm border border-slate-100">🏢</div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Empresa Vinculada</p>
          <p className="text-sm font-bold text-slate-700 truncate" title={companyName}>
            {companyName}
          </p>
        </div>
      </div>

    </div>
  );
}