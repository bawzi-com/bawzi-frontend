'use client';

import { useState, useEffect} from 'react';
import { Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiFetch, SessionExpiredError, clearSession } from '@/lib/apiClient';

export default function PersonalDataForm({ userData, token, onUpdate }: any) {
  // 🟢 Proteção da URL
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [profileData, setProfileData] = useState({
    name: userData?.name || '',
    email: userData?.email || '',
  });

  // ESTILOS PADRONIZADOS
  const inputStyle = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-50";
  const labelStyle = "mb-2 block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400";

  // FUNÇÃO: ATUALIZAR PERFIL
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch(`${API_URL}/api/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileData.name })
      });
      
      if (!res.ok) throw new Error('Não foi possível atualizar os dados.');
      
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      
      // 🟢 Dispara a atualização global para o Header e Page perceberem a mudança do Nome
      if (onUpdate) await onUpdate(); 

    } catch (err: any) {
      if (err instanceof SessionExpiredError) { clearSession(); return; }
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userData) {
      setProfileData({
        name: userData.name || userData.nome || '', // Aceita 'name' ou 'nome'
        email: userData.email || '',
      });
    }
  }, [userData]);

  return (
    <form onSubmit={handleProfileSubmit} className="flex flex-col gap-6">
      {message && (
        <div className={`flex items-center gap-3 rounded-lg border p-4 text-sm font-bold animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-100' : 'bg-red-50 text-red-900 border-red-100'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertTriangle size={20} className="text-red-500" />}
          {message.text}
        </div>
      )}

      <div className="w-full">
        <label className={labelStyle}>Nome Completo</label>
        <input 
          type="text" 
          className={inputStyle} 
          value={profileData.name} 
          onChange={e => setProfileData({...profileData, name: e.target.value})} 
        />
      </div>
      
      <div className="w-full">
        <label className={labelStyle}>Email Profissional</label>
        <input 
          type="email" 
          className={inputStyle} 
          value={profileData.email} 
          disabled 
        />
      </div>
      
      <div className="flex justify-end border-t border-slate-200 pt-5">
        <button 
          type="submit" 
          disabled={isLoading} 
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-slate-950 px-8 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 md:w-auto"
        >
          {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={18} />}
          Guardar Perfil
        </button>
      </div>
    </form>
  );
}
