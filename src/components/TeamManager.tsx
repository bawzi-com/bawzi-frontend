'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TeamManager({ userToken, tier, members, is_admin, onUpdate }: any) {

  const router = useRouter();
const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const WORKSPACE_LIMITS: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 10 };
  const maxUsers = WORKSPACE_LIMITS[tier] || 1;
  const vagasDisponiveis = maxUsers - (members?.length || 0);

  // 'toggle-admin' aos tipos permitidos
  const handleAction = async (targetEmail: string, action: 'add' | 'remove' | 'toggle-admin') => {
    if (!targetEmail) return;
    
    setIsLoading(true);
    setStatus(null);
    
    try {
      // Ajuste dinâmico do endpoint baseado na ação
      const endpoint = action === 'add' ? 'add-user' : action === 'remove' ? 'remove-user' : 'toggle-admin';
      
      const response = await fetch(`http://localhost:8000/api/users/workspace/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ email: targetEmail })
      });

      if (response.ok) {
        // Mensagem de sucesso dinâmica
        let successMsg = 'Operação realizada com sucesso!';
        if (action === 'add') successMsg = 'Membro adicionado com sucesso!';
        if (action === 'remove') successMsg = 'Acesso revogado com sucesso!';
        if (action === 'toggle-admin') successMsg = 'Permissões atualizadas com sucesso!';

        setStatus({ type: 'success', msg: successMsg });
        setEmail('');
        if (onUpdate) onUpdate(); // Atualiza a tela automaticamente
      } else {
        const err = await response.json();
        setStatus({ type: 'error', msg: err.detail || 'Erro ao processar a ação.' });
      }
    } catch (e) {
      setStatus({ type: 'error', msg: 'Erro de ligação ao servidor.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">🤝 A Minha Equipa</h2>
        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-wider">
          {members?.length || 1} / {maxUsers} Membros
        </span>
      </div>

      {/* FEEDBACK VISUAL */}
      {status && (
        <div className={`mb-6 p-4 rounded-xl font-bold text-sm flex items-center gap-2 ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
        }`}>
          {status.msg}
        </div>
      )}

      {/* LISTA DE MEMBROS */}
      <div className="space-y-3 mb-8">
        {members?.map((member: any) => (
          <div key={member.email} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-colors hover:bg-slate-100">
            
            {/* LADO ESQUERDO: Dados do Membro */}
            <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0">
                {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">
                        {member.name} {member.is_me && <span className="text-slate-400 font-normal">(Você)</span>}
                    </p>
                    
                    {/* 🟢 HIERARQUIA DE SELOS: Dono, Admin ou Colaborador */}
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border ${
                    member.is_owner 
                        ? 'bg-amber-100 text-amber-700 border-amber-200' // Ouro para o Dono
                        : member.is_admin 
                        ? 'bg-violet-100 text-violet-700 border-violet-200' // Violeta para Admins
                        : 'bg-slate-100 text-slate-600 border-slate-200'    // Cinza para Colaboradores
                    }`}>
                    {member.is_owner ? 'Dono' : member.is_admin ? 'Admin' : 'Colaborador'}
                    </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">{member.email}</p>
            </div>
            </div>

            {/* LADO DIREITO: Botões de Ação Limpos e Agrupados */}
            <div className="flex items-center gap-1 shrink-0">
              
              {/* BOTÃO PROMOVER (Só admins veem, e não podem clicar em si mesmos nem no Dono) */}
              {is_admin && !member.is_me && !member.is_owner && (
                  <button 
                    onClick={() => handleAction(member.email, 'toggle-admin')}
                    disabled={isLoading}
                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-50"
                    title={member.is_admin ? "Remover privilégios de Admin" : "Tornar Admin"}
                  >
                    👑
                  </button>
              )}
              
              {/* BOTÃO REMOVER (Só admins veem, não removem a si mesmos nem o Dono) */}
              {is_admin && !member.is_me && !member.is_owner && (
                <button 
                  onClick={() => handleAction(member.email, 'remove')}
                  disabled={isLoading}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                  title="Remover da equipa"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
            
          </div>
        ))}
      </div>

        {/* ÁREA DE CONVITE */}
        {is_admin ? (
        vagasDisponiveis > 0 ? (
            <form 
            onSubmit={(e) => { 
                e.preventDefault(); 
                handleAction(email, 'add'); 
            }} 
            className="space-y-4"
            >
            {/* ... seu formulário de convite ... */}
            </form>
        ) : (
            /* 🟢 AVISO COM BOTÃO DE UPGRADE */
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-[1.5rem] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                <p className="text-sm font-black text-amber-900">Limite de vagas atingido</p>
                <p className="text-[11px] text-amber-700 font-medium">
                    O seu plano atual não permite adicionar mais gestores.
                </p>
                </div>
            </div>
            
            {/* BOTÃO DE UPGRADE */}
            <button 
                onClick={() => router.push('/plans')}
                className="w-full sm:w-auto px-6 py-3 bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-amber-700 transition-all shadow-sm shadow-amber-200"
            >
                Fazer Upgrade
            </button>
            </div>
        )
        ) : (
        /* Mensagem para não-admins... */
        <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs font-bold text-slate-500">
            APENAS O ADMINISTRADOR PODE GERIR MEMBROS.
        </div>
        )}
    </div>
  );
}