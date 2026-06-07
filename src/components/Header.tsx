'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { clearSession, API_URL } from '@/lib/apiClient';
import type { BawziUpdateEvent } from '@/lib/types';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('1');
  const [userData, setUserData] = useState<{name?: string, email?: string} | null>(null);

  useEffect(() => {

    // Sincronismo imediato: usa o cache para a UI não piscar.
    const syncFromCache = () => {
      const savedToken = localStorage.getItem('bawzi_token');
      const savedTier = localStorage.getItem('bawzi_tier');
      const savedName = localStorage.getItem('user_name') || localStorage.getItem('nome');
      const savedEmail = localStorage.getItem('user_email');

      if (savedToken) setToken(savedToken);
      if (savedTier) setUserTier(savedTier);
      if (savedName || savedEmail) {
        setUserData({ name: savedName || '', email: savedEmail || '' });
      }
      return savedToken;
    };

    const tokenAtivo = syncFromCache();

    // Validação silenciosa no servidor.
    const validateTierSilently = async (token: string) => {
      try {
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        
        // Fazemos as mesmas chamadas que o Perfil faz para garantir consistência
        const [userRes, wsRes] = await Promise.all([
          fetch(`${API_URL}/api/users/me`, { headers }),
          fetch(`${API_URL}/api/workspace/details`, { headers })
        ]);

        if (userRes.ok && wsRes.ok) {
          const uData = await userRes.json();
          const wData = await wsRes.json();

          // O maior nível entre usuário e empresa vence.
          const nivelReal = Math.max(uData.tier || 1, wData.tier || 1);
          const nivelString = String(nivelReal);

          // Se o servidor sinalizou que o tier mudou (ex: promo expirou),
          // invalida o cache local independentemente do valor armazenado.
          const tierResetAt = uData.tier_reset_at ? new Date(uData.tier_reset_at).getTime() : 0;
          const tierSetAt   = Number(localStorage.getItem('bawzi_tier_ts') || 0);
          if (tierResetAt > tierSetAt) {
            localStorage.setItem('bawzi_tier', nivelString);
            localStorage.setItem('bawzi_tier_ts', String(Date.now()));
            window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: nivelReal } }));
          }

          setUserTier(nivelString);
          setUserData({ name: uData.name || uData.nome || '', email: uData.email });

          localStorage.setItem('bawzi_tier', nivelString);
          localStorage.setItem('bawzi_tier_ts', String(Date.now()));
          localStorage.setItem('user_name', uData.name || uData.nome || '');
          localStorage.setItem('user_email', uData.email || '');
        }
      } catch (err) {
        console.error("Erro na sincronização silenciosa do Header:", err);
      }
    };

    if (tokenAtivo) validateTierSilently(tokenAtivo);

    // Escuta atualizações vindas de outras telas.
    const handleGlobalUpdate = (e: Event) => {
      const { detail } = e as BawziUpdateEvent;
      if (detail?.tier) setUserTier(String(detail.tier));
      if (detail?.name) setUserData(prev => ({ ...prev, name: detail.name }));
    };

    window.addEventListener('bawzi_update', handleGlobalUpdate);
    return () => window.removeEventListener('bawzi_update', handleGlobalUpdate);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch { /* silencioso — sessão local sempre é limpa */ }
    clearSession();
    setToken(null);
    router.push('/');
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-sm transition-all print:hidden">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
        
        {/* LOGÓTIPO */}
        <Link href="/" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
          <Image src="/logo-bawzi.png" alt="Bawzi" width={120} height={40} className="h-10 w-auto" priority unoptimized />
        </Link>

        {/* NAVEGAÇÃO CENTRAL */}
        <nav className="hidden md:flex items-center gap-8 mr-8">
          <Link href="/workspace" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/workspace' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
            Workspace
          </Link>
          {token && (
            <Link href="/history" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/history' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
              Histórico
            </Link>
          )}
          <Link href="/plans" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/plans' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
            Planos
          </Link>
        </nav>

        {/* ÁREA DO UTILIZADOR */}
        <div>
          {token ? (
            <div className="flex items-center gap-3 sm:gap-4">
              
              <div className="relative group cursor-pointer">
                <Link href="/profile" className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-600 to-sky-600 flex items-center justify-center text-white font-bold shadow-md transition-all duration-300 group-hover:ring-4 group-hover:ring-emerald-500/15">
                  {userData?.name ? userData.name.charAt(0).toUpperCase() : 'B'}
                </Link>

                <div className="absolute right-0 mt-3 w-max min-w-[220px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top-right scale-95 group-hover:scale-100 z-50">
                  <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-200 relative">
                    <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-t border-l border-slate-200 transform rotate-45"></div>
                    <div className="relative z-10 flex flex-col text-left">
                      <span className="text-sm font-black text-slate-900 truncate max-w-[180px]">
                        {userData?.name || 'Usuário Bawzi'}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 truncate max-w-[180px] mt-0.5">
                        {userData?.email || 'Configurações de perfil'}
                      </span>
                      
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                         <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded-lg">
                           Nível {userTier}
                         </span>
                         <button onClick={handleLogout} className="text-[9px] font-bold text-slate-500 hover:text-red-600 transition-colors uppercase tracking-widest">
                           Sair
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
             <button
              onClick={() => {
                // Só /workspace abre o modal inline (AnalysisApp está montado lá).
                // Em / (landing) e em qualquer outra página → navega para /login.
                if (pathname === '/workspace') {
                  window.dispatchEvent(new CustomEvent('bawzi_open_auth', { detail: 'login' }));
                } else {
                  router.push('/login');
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm transition-colors shadow-sm"
            >
              Entrar
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
