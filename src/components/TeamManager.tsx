'use client';

import React, { useState } from 'react';

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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const maxUsers = WORKSPACE_LIMITS[tier] || 1;
  const currentUsers = members.length;

  // ==========================================
  // ADICIONAR NOVO MEMBRO
  // ==========================================
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/workspace/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ email: newEmail })
      });

      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setNewEmail('');
        onUpdate(); // Atualiza a página e o Nível de vagas
      } else {
        alert(data.detail || "Erro ao adicionar colaborador.");
      }
    } catch (err) {
      alert("Erro de ligação ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // REMOVER MEMBRO
  // ==========================================
  const handleRemoveUser = async (email: string) => {
    if (!confirm(`Tem a certeza que deseja remover ${email} do workspace?`)) return;
    
    try {
      const res = await fetch(`${API_URL}/api/workspace/remove-user`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ email })
      });

      if (res.ok) onUpdate();
      else alert("Erro ao remover utilizador.");
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // PROMOVER/DESPROMOVER ADMIN
  // ==========================================
const handleToggleAdmin = async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/api/workspace/toggle-admin`, { // <-- Certifique-se que está assim
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ email })
      });

      if (res.ok) {
        onUpdate();
      } else {
        // 🟢 Lê a mensagem de erro que o Python mandou e mostra no alerta
        const data = await res.json();
        alert(data.detail || "Erro ao alterar privilégios."); 
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
      
      {/* HEADER DA SECÇÃO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-900 mb-1">Equipa Estratégica</h3>
          <p className="text-xs font-medium text-slate-500">
            Gerir acessos e membros do workspace. <strong className={currentUsers >= maxUsers ? 'text-red-500' : 'text-emerald-500'}>{currentUsers}/{maxUsers} vagas</strong> utilizadas.
          </p>
        </div>

        {is_admin && (
          <button 
            onClick={() => setShowAddModal(true)}
            disabled={currentUsers >= maxUsers}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <span className="text-sm">➕</span> 
            {currentUsers >= maxUsers ? 'Limite Atingido' : 'Convidar Membro'}
          </button>
        )}
      </div>

      {/* LISTA DE MEMBROS */}
      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-violet-200 transition-colors">
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center font-black text-lg overflow-hidden shrink-0 shadow-sm">
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
                    <span className="text-[8px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
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
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleToggleAdmin(member.email)}
                  className="text-[10px] font-bold text-slate-500 hover:text-violet-600 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-sm"
                  title="Alterar permissões"
                >
                  {member.is_admin ? 'Despromover' : 'Promover'}
                </button>
                <button 
                  onClick={() => handleRemoveUser(member.email)}
                  className="text-[10px] font-bold text-red-500 hover:text-white hover:bg-red-500 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-sm transition-colors"
                >
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
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-2">Convidar Colaborador</h3>
            <p className="text-xs text-slate-400 font-medium mb-6">Insira o e-mail do seu colega para lhe dar acesso à plataforma.</p>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1.5 block ml-1">E-mail do Colaborador</label>
                <input 
                  type="email" 
                  placeholder="exemplo@empresa.com"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500/20 text-sm font-bold text-slate-700 placeholder:font-medium"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="flex-1 py-3 text-[10px] font-black text-slate-500 uppercase hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !newEmail}
                  className="flex-1 py-3 bg-violet-600 text-white text-[10px] font-black rounded-xl uppercase shadow-lg shadow-violet-200 disabled:opacity-50 transition-transform active:scale-95"
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