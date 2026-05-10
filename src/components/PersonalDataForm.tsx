'use client';

import { useState } from 'react';
import { User, Save, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';

export default function PersonalDataForm({ userData, token }: any) {
  // 🟢 Proteção da URL: Garante que nunca seja undefined ou malformada
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const [profileData, setProfileData] = useState({
    name: userData?.name || '',
    email: userData?.email || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // ESTILOS PADRONIZADOS
  const inputStyle = "w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white outline-none transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed";
  const labelStyle = "block text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 ml-1";

  // FUNÇÃO: ATUALIZAR PERFIL
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileLoading(true);
    setProfileMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: profileData.name })
      });
      if (!res.ok) throw new Error('Não foi possível atualizar os dados.');
      setProfileMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message });
    } finally {
      setIsProfileLoading(false);
    }
  };

  // FUNÇÃO: ALTERAR SENHA
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'As novas senhas não coincidem.' });
      return;
    }

    setIsPasswordLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao alterar a senha.');

      setPasswordMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      
      {/* CARD 1: DADOS BÁSICOS */}
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 mb-10 pb-8 border-b border-slate-50">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
            <User size={24} />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Dados do Utilizador</h3>
        </div>

        {profileMessage && (
          <div className={`mb-8 p-5 rounded-2xl flex items-center gap-3 text-sm font-bold border-2 ${
            profileMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-100' : 'bg-red-50 text-red-900 border-red-100'
          }`}>
            {profileMessage.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertTriangle size={20} className="text-red-500" />}
            {profileMessage.text}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-8">
          <div className="w-full">
            <label className={labelStyle}>Nome Completo</label>
            <input type="text" className={inputStyle} value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} />
          </div>
          <div className="w-full">
            <label className={labelStyle}>Email Profissional</label>
            <input type="email" className={inputStyle} value={profileData.email} disabled />
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-50">
            <button type="submit" disabled={isProfileLoading} className="w-full md:w-auto px-12 py-5 bg-slate-900 text-white hover:bg-violet-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3">
              {isProfileLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={18} />}
              Guardar Perfil
            </button>
          </div>
        </form>
      </div>

      {/* CARD 2: SEGURANÇA */}
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border-2 border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 pb-8 border-b border-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-100">
              <Lock size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Segurança da Conta</h3>
              <p className="text-sm text-slate-400 font-bold">Atualize a sua senha de acesso.</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="px-4 py-2 bg-slate-50 text-[10px] font-black text-slate-500 hover:text-violet-600 rounded-xl uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
            {showPasswords ? <><EyeOff size={14} /> Ocultar</> : <><Eye size={14} /> Mostrar</>}
          </button>
        </div>

        {passwordMessage && (
          <div className={`mb-8 p-5 rounded-2xl flex items-center gap-3 text-sm font-bold border-2 ${
            passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-100' : 'bg-red-50 text-red-900 border-red-100'
          }`}>
            {passwordMessage.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertTriangle size={20} className="text-red-500" />}
            {passwordMessage.text}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-8">
          <div className="w-full">
            <label className={labelStyle}>Senha Atual</label>
            <input type={showPasswords ? "text" : "password"} required className={inputStyle} placeholder="••••••••" value={passwordData.currentPassword} onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})} />
          </div>
          <div className="w-full">
            <label className={labelStyle}>Nova Senha</label>
            <input type={showPasswords ? "text" : "password"} required className={inputStyle} placeholder="Mínimo 8 caracteres" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} />
          </div>
          <div className="w-full">
            <label className={labelStyle}>Confirmar Nova Senha</label>
            <input type={showPasswords ? "text" : "password"} required className={inputStyle} placeholder="Repita a nova senha" value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} />
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-50">
            <button type="submit" disabled={isPasswordLoading} className="w-full md:w-auto px-12 py-5 bg-white border-2 border-slate-200 text-slate-700 hover:border-violet-500 hover:text-violet-700 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-3">
              {isPasswordLoading ? <div className="w-5 h-5 border-2 border-slate-300 border-t-violet-600 rounded-full animate-spin"></div> : <KeyRound size={18} />}
              Atualizar Senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}