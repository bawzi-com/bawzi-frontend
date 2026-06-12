'use client';

import React, { useState } from 'react';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  is_me: boolean;
  is_owner: boolean;
  is_admin: boolean;
}

interface TeamManagerProps {
  userToken: string;
  tier: number;
  members: TeamMember[];
  is_admin: boolean;
  onUpdate: () => void;
}

const WORKSPACE_LIMITS: Record<number, number> = {
  1: 1, 2: 2, 3: 5, 4: 10
};

export default function TeamManager({ userToken, tier, members = [], is_admin, onUpdate }: TeamManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const maxUsers = WORKSPACE_LIMITS[tier] || 1;
  const currentUsers = members.length;

  const showNotice = (type: 'success' | 'error', msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 4000);
  };

  // ==========================================
  // ADICIONAR NOVO MEMBRO
  // ==========================================
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/workspace/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setNewEmail('');
        onUpdate();
      } else {
        showNotice('error', data.detail || 'Erro ao adicionar colaborador.');
      }
    } catch {
      showNotice('error', 'Erro de ligação ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // REMOVER MEMBRO
  // ==========================================
  const handleRemoveUser = async (email: string) => {
    if (!confirm(`Tem certeza que deseja remover ${email} do workspace?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/workspace/remove-user`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) onUpdate();
      else showNotice('error', 'Erro ao remover usuário.');
    } catch {
      showNotice('error', 'Erro de ligação ao servidor.');
    }
  };

  // ==========================================
  // PROMOVER/DESPROMOVER ADMIN
  // ==========================================
  const handleToggleAdmin = async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/api/workspace/toggle-admin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        onUpdate();
      } else {
        const data = await res.json();
        showNotice('error', data.detail || 'Erro ao alterar privilégios.');
      }
    } catch {
      showNotice('error', 'Erro de ligação ao servidor.');
    }
  };

  return (
    <div className="relative">
      {notice && (
        <div className={`fixed bottom-5 right-5 z-[200] max-w-sm rounded-lg border px-4 py-3 text-sm font-semibold shadow-xl ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {notice.msg}
        </div>
      )}
      
      {/* HEADER DA SECÇÃO */}
      <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="mb-1 text-sm font-black text-slate-900">Membros do workspace</h3>
          <p className="text-xs font-medium text-slate-500">
            Gerenciar acessos e membros do workspace. <strong className={currentUsers >= maxUsers ? 'text-red-500' : 'text-emerald-500'}>{currentUsers}/{maxUsers} vagas</strong> utilizadas.
          </p>
        </div>

        {is_admin && (
          <button 
            onClick={() => setShowAddModal(true)}
            disabled={currentUsers >= maxUsers}
            className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus size={14} />
            {currentUsers >= maxUsers ? 'Limite Atingido' : 'Convidar Membro'}
          </button>
        )}
      </div>

      {/* LISTA DE MEMBROS */}
      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-emerald-200 hover:bg-white">
            
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-tr from-emerald-600 to-sky-600 text-lg font-black text-white shadow-sm">
                {member.avatar_url ? (
                  <img src={`${API_URL}${member.avatar_url}`} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  member.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {member.name} {member.is_me && '(Você)'}
                  </span>
                  
                  {/* 🟢 TAG: PROPRIETÁRIO */}
                  {member.is_owner && (
                    <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Proprietário
                    </span>
                  )}

                  {/* 🟢 TAG: ADMIN */}
                  {member.is_admin && !member.is_owner && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700">
                      Admin
                    </span>
                  )}

                  {/* 🟢 TAG: MEMBRO (Se não for nenhum dos acima) */}
                  {!member.is_admin && !member.is_owner && (
                    <span className="text-[8px] font-black bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Membro
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium truncate">{member.email}</span>
              </div>
            </div>

            {/* AÇÕES (Só visíveis para admins) */}
            {is_admin && !member.is_owner && !member.is_me && (
              <div className="flex items-center gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <button 
                  onClick={() => handleToggleAdmin(member.email)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm transition-colors hover:text-emerald-700"
                  title="Alterar permissões"
                >
                  <ShieldCheck size={12} />
                  {member.is_admin ? 'Despromover' : 'Promover'}
                </button>
                <button 
                  onClick={() => handleRemoveUser(member.email)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-red-500 shadow-sm transition-colors hover:bg-red-500 hover:text-white"
                >
                  <Trash2 size={12} />
                  Remover
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL DE ADICIONAR UTILIZADOR */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-lg border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-2">Convidar Colaborador</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Insira o e-mail do seu colega para lhe dar acesso à plataforma.</p>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1.5 block ml-1">E-mail do Colaborador</label>
                <input 
                  type="email" 
                  placeholder="exemplo@empresa.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-700 outline-none transition-all placeholder:font-medium focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="flex-1 rounded-lg py-3 text-[10px] font-black uppercase text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !newEmail}
                  className="flex-1 rounded-lg bg-slate-950 py-3 text-[10px] font-black uppercase text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'A Convidar...' : 'Enviar Convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
