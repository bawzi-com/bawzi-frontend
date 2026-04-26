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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('http://localhost:8000/api/users/me', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(formData) 
      });

      if (!res.ok) throw new Error('Falha ao atualizar');
      
      // Feedback Premium em vez do alert()
      setMessage({ type: 'success', text: '✨ Dados pessoais guardados com sucesso!' });
      if (onUpdate) onUpdate();

      // Esconde a mensagem após 3 segundos
      setTimeout(() => setMessage(null), 3000);

    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao guardar dados. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirm = window.confirm("Tem a certeza absoluta? Esta ação não pode ser desfeita e todo o seu histórico será perdido.");
    if (!confirm) return;

    setIsDeleting(true);
    try {
      const res = await fetch('http://localhost:8000/api/users/me', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        localStorage.removeItem('bawzi_token');
        localStorage.removeItem('bawzi_tier');
        router.push('/');
      } else {
        throw new Error('Erro ao eliminar conta');
      }
    } catch (error) {
      alert("Ocorreu um erro ao eliminar a conta.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Dados Pessoais */}
      <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6">👤 Dados de Utilizador</h2>
        
        {/* Banner de Feedback Animado */}
        {message && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
            <input 
              type="text" required
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none font-bold text-slate-700 transition-all"
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Profissional</label>
            <input 
              type="email" required
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none font-bold text-slate-700 transition-all"
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
            />
          </div>
          <button 
            type="submit" disabled={isLoading}
            className="w-full md:w-auto px-10 py-4 bg-slate-950 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? 'A guardar...' : 'Guardar Alterações'}
          </button>
        </form>
      </div>

      {/* Zona de Risco */}
      <div className="bg-red-50/50 rounded-[2rem] p-8 border border-red-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">⚠️</span>
          <h3 className="text-lg font-black text-red-600 uppercase tracking-widest">Zona de Risco</h3>
        </div>
        <p className="text-sm font-bold text-red-900/60 mb-6">
          Eliminar permanentemente a tua conta. Uma vez apagada, não poderás recuperar os teus créditos ou histórico.
        </p>
        <button 
          onClick={handleDeleteAccount} disabled={isDeleting}
          className="px-6 py-3 bg-red-100 text-red-600 font-black rounded-xl hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'A apagar...' : 'Excluir Minha Conta'}
        </button>
      </div>
    </div>
  );
}