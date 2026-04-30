'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PersonalDataForm({ userData, token, onUpdate }: any) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success'|'error', text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    name: userData?.name || '',
    email: userData?.email || '',
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(formData) 
      });

      if (!res.ok) throw new Error('Falha ao atualizar');
      
      setMessage({ type: 'success', text: '✨ Dados pessoais guardados com sucesso!' });
      if (onUpdate) onUpdate();

      setTimeout(() => setMessage(null), 3000);

    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao guardar dados. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const msgAviso = "Tem a certeza absoluta? Esta ação não pode ser desfeita.\n\n" + 
                     "Atenção: Se for o único membro, o seu Workspace e todo o histórico de análises " +
                     "serão eliminados permanentemente. Deseja continuar?";

    const confirmDelete = window.confirm(msgAviso);
    if (!confirmDelete) return;

    setIsDeleting(true);

    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        localStorage.clear(); 
        window.location.href = '/?account_deleted=true'; 
      } else {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Erro ao eliminar conta');
      }
    } catch (error) {
      console.error("Erro na exclusão:", error);
      alert(error instanceof Error ? error.message : "Ocorreu um erro ao eliminar a conta.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
      <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
        <span className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center text-lg">👤</span>
        Dados de Utilizador
      </h2>
      
      {message && (
        <div className={`p-4 mb-6 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
            <input 
              type="text" required
              className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none font-bold text-slate-700 transition-all"
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Profissional</label>
            <input 
              type="email" required
              className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none font-bold text-slate-700 transition-all"
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
            />
          </div>
        </div>

        {/* ÁREA DE BOTÕES INTEGRADA (SALVAR + ZONA DE RISCO) */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pt-8 border-t border-slate-100">
          
          {/* BOTÃO SALVAR */}
          <button 
            type="submit" disabled={isLoading}
            className="w-full lg:w-auto px-10 py-4 bg-slate-950 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'A guardar...' : 'Guardar Alterações'}
          </button>

          {/* ZONA DE RISCO INTEGRADA AO LADO */}
          <div className="flex flex-col sm:flex-row items-center gap-4 lg:text-right">
            <div className="max-w-[280px]">
              <div className="flex items-center gap-2 mb-1 lg:justify-end">
                <span className="text-xs">⚠️</span>
                <h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest">Zona de Risco</h3>
              </div>
              <p className="text-[9px] font-bold text-slate-400 leading-tight">
                Eliminar permanentemente a conta. Não será possível recuperar créditos ou histórico.
              </p>
            </div>
            
            <button 
              type="button"
              onClick={handleDeleteAccount} disabled={isDeleting}
              className="px-6 py-3 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest border border-red-100 rounded-xl hover:bg-red-600 hover:text-white transition-all disabled:opacity-50 shrink-0"
            >
              {isDeleting ? 'A apagar...' : 'Excluir Minha Conta'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}