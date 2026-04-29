'use client';

import React, { useEffect, useState } from 'react';
import UserProfileCard from '../../components/UserProfileCard';

export default function ProfilePage() {
  const [userData, setUserData] = useState<any>(null);
  const [userTier, setUserTier] = useState<number>(1);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('bawzi_token');
      if (!token) return;

      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const [userRes, wsRes] = await Promise.all([
          fetch(`${API_URL}/api/users/me`, { headers }),
          fetch(`${API_URL}/api/workspace/details`, { headers })
        ]);

        if (userRes.ok && wsRes.ok) {
          const uData = await userRes.json();
          const wData = await wsRes.json();
          
          setUserData({
            ...uData,
            workspace_users_count: wData.workspace_users_count,
            vagas_totais: wData.vagas_totais,
            company: wData.company
          });
          setUserTier(wData.tier);
        }
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
      }
    };

    fetchUser();
  }, [API_URL]);

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex justify-center items-start pt-20">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-black text-slate-900 mb-6">Meu Perfil</h1>
        
        {/* A Página (que não recebe props) chama o Componente (que recebe props) */}
        {userData ? (
          <UserProfileCard user={userData} currentTier={userTier} />
        ) : (
          <div className="animate-pulse flex space-x-4 bg-white p-6 rounded-2xl border border-slate-100">
            <div className="rounded-full bg-slate-200 h-12 w-12"></div>
            <div className="flex-1 space-y-4 py-1">
              <div className="h-2 bg-slate-200 rounded w-3/4"></div>
              <div className="space-y-3">
                <div className="h-2 bg-slate-200 rounded"></div>
                <div className="h-2 bg-slate-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}