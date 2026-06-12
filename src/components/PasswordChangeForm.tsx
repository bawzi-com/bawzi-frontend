'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface PasswordChangeFormProps {
  token: string;
}

export default function PasswordChangeForm({ token }: PasswordChangeFormProps) {
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const [isLoading, setIsLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validações Básicas
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'A nova senha e a confirmação não coincidem.' });
      return;
    }

    if (passwords.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/users/update-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: passwords.currentPassword,
          new_password: passwords.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Erro ao atualizar a senha.');
      }

      setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10";
  const labelStyle = "mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400";

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
      {/* MENSAGEM DE FEEDBACK */}
      {message && (
        <div className={`mb-6 flex items-start gap-3 rounded-lg border p-4 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-rose-50 border border-rose-100 text-rose-700'
        }`}>
          <div className="mt-0.5">
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <span className="text-xs font-bold leading-relaxed">{message.text}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* SENHA ATUAL */}
        <div className="w-full md:w-1/2 pr-0 md:pr-3">
          <div className="flex justify-between items-center mb-2">
            <label className={labelStyle}>Senha Atual</label>
          <button
            type="button" 
            onClick={() => setShowPasswords(!showPasswords)}
            className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-700 transition-colors hover:text-emerald-800"
          >
              {showPasswords ? <><EyeOff size={12} /> Ocultar</> : <><Eye size={12} /> Mostrar</>}
            </button>
          </div>
          <div className="relative">
            <input 
              type={showPasswords ? "text" : "password"} 
              className={inputStyle}
              placeholder="••••••••"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              required
            />
          </div>
        </div>

        {/* LINHA DE NOVA SENHA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="w-full">
            <label className={labelStyle}>Nova Senha</label>
            <div className="relative">
              <input 
                type={showPasswords ? "text" : "password"} 
                className={inputStyle}
                placeholder="Mínimo 6 caracteres"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="w-full">
            <label className={labelStyle}>Confirmar Nova Senha</label>
            <div className="relative">
              <input 
                type={showPasswords ? "text" : "password"} 
                className={inputStyle}
                placeholder="Repita a nova senha"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button 
            type="submit" 
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-8 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 md:w-auto"
          >
            {isLoading ? 'Atualizando...' : <><Lock size={14} /> Atualizar senha</>}
          </button>
        </div>
      </div>
    </form>
  );
}
