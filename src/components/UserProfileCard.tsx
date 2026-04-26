'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const WORKSPACE_LIMITS: Record<number, number> = {
  1: 1, 2: 2, 3: 5, 4: 10
};

export default function UserProfileCard({ user, variant = 'full' }: { user: any, variant?: 'full' | 'compact' }) {
  const router = useRouter();
  const isCompact = variant === 'compact';
  
  const userName = user?.name || "Marcelo Mendes";
  const userEmail = user?.email || "...";
  const tier = user?.tier || 1;
  const companyName = user?.company?.razao_social || "Empresa não identificada";
  
  const usersCount = user?.workspace_users_count || 1;
  const maxUsers = WORKSPACE_LIMITS[tier] || 1;

  // 🟢 ESTADOS DO AVATAR
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url || null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // 🟢 FUNÇÃO DE UPLOAD
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
        const freshUrl = `${data.avatar_url}?t=${new Date().getTime()}`;
        setAvatarUrl(freshUrl);
      } else {
        alert("Falha ao atualizar a fotografia. Verifique o tamanho do ficheiro.");
      }
    } catch (err) {
      console.error("Erro no upload do avatar:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      
      {/* 1. PERFIL: Avatar Interativo + Identidade */}
      <div className="flex items-start gap-3 min-w-0">
        
        {/* 🟢 AVATAR INTERATIVO */}
        <div className="relative group shrink-0">
          <label className={`cursor-pointer block ${isUploading ? 'pointer-events-none' : ''}`}>
            {/* Input escondido que abre a janela de ficheiros */}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAvatarUpload} 
              disabled={isUploading} 
            />

            <div 
              aria-hidden="true"
              className={`select-none ${isCompact ? 'w-10 h-10 text-lg' : 'w-12 h-12 md:w-14 md:h-14 text-xl'} rounded-xl flex items-center justify-center font-black shadow-md relative overflow-hidden transition-all group-hover:ring-2 group-hover:ring-violet-400 group-hover:ring-offset-2
                ${!avatarUrl ? 'bg-gradient-to-br from-violet-500 to-pink-500 text-white' : 'bg-slate-100'}
              `}
            >
              {/* Se tiver URL, mostra a imagem. Se não, mostra a Letra */}
              {avatarUrl ? (
                <img src={avatarUrl.startsWith('http') ? avatarUrl : `${API_URL}${avatarUrl}`} alt={userName} className="w-full h-full object-cover" key={avatarUrl}/>
              ) : (
                userName.charAt(0).toUpperCase()
              )}

              {/* Camada escura que aparece ao passar o rato */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                {isUploading ? (
                   <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                   <span className="text-white text-sm">📸</span>
                )}
              </div>
            </div>
          </label>
        </div>
        
        <div className="flex flex-col min-w-0 flex-1">
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

      {/* 2. GESTÃO: Mudar Plano e Vagas */}
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