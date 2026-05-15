'use client';

import { useState, useEffect} from 'react';
import { Save, CheckCircle2, AlertTriangle } from 'lucide-react';

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
  const inputStyle = "w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white outline-none transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed";
  const labelStyle = "block text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 ml-1";

  // FUNÇÃO: ATUALIZAR PERFIL
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: profileData.name })
      });
      
      if (!res.ok) throw new Error('Não foi possível atualizar os dados.');
      
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      
      // 🟢 Dispara a atualização global para o Header e Page perceberem a mudança do Nome
      if (onUpdate) await onUpdate(); 

    } catch (err: any) {
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
    <form onSubmit={handleProfileSubmit} className="flex flex-col gap-8">
      {message && (
        <div className={`p-5 rounded-2xl flex items-center gap-3 text-sm font-bold border-2 animate-in fade-in slide-in-from-top-2 ${
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
      
      <div className="flex justify-end pt-4 border-t border-slate-50">
        <button 
          type="submit" 
          disabled={isLoading} 
          className="w-full md:w-auto px-12 py-5 bg-slate-900 text-white hover:bg-violet-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
        >
          {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={18} />}
          Guardar Perfil
        </button>
      </div>
    </form>
  );
}