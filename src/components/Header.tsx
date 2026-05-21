'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('1');
  const [userData, setUserData] = useState<{name?: string, email?: string} | null>(null);

  useEffect(() => {
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

    // 1. ⚡ SINCRONISMO IMEDIATO (Lê o cache para a UI não piscar)
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

    // 2. 🌐 VALIDAÇÃO REAL (Vai ao servidor confirmar o nível atual sem o utilizador notar)
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

          // Lógica central da Bawzi: o maior nível entre utilizador e empresa vence
          const nivelReal = Math.max(uData.tier || 1, wData.tier || 1);
          const nivelString = String(nivelReal);

          // Atualiza a interface se o que está no servidor for diferente do que está no ecrã
          setUserTier(nivelString);
          setUserData({ name: uData.name || uData.nome || '', email: uData.email });
          
          // Atualiza o cache para a próxima vez
          localStorage.setItem('bawzi_tier', nivelString);
          localStorage.setItem('user_name', uData.name || uData.nome || '');
          localStorage.setItem('user_email', uData.email || '');
        }
      } catch (err) {
        console.error("Erro na sincronização silenciosa do Header:", err);
      }
    };

    if (tokenAtivo) validateTierSilently(tokenAtivo);

    // 3. 🟢 ESCUTAR ATUALIZAÇÕES (Caso o utilizador mude de nível noutra aba/página)
    const handleGlobalUpdate = (e: any) => {
      if (e.detail?.tier) setUserTier(String(e.detail.tier));
      if (e.detail?.name) setUserData(prev => ({ ...prev, name: e.detail.name }));
    };

    window.addEventListener('bawzi_update', handleGlobalUpdate);
    return () => window.removeEventListener('bawzi_update', handleGlobalUpdate);
  }, [pathname]); // Roda na montagem e sempre que mudares de página

  const handleLogout = () => {
    localStorage.removeItem('bawzi_token');
    localStorage.removeItem('bawzi_tier');
    localStorage.removeItem('bawzi_user'); 
    setToken(null);
    router.push('/');
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm transition-all print:hidden">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
        
        {/* LOGÓTIPO */}
        <Link href="/" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
          <img src="/logo-bawzi.png" alt="Bawzi" className="h-8 w-auto" />
        </Link>

        {/* NAVEGAÇÃO CENTRAL */}
        <nav className="hidden md:flex items-center gap-8 mr-8">
          <Link href="/workspace" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/workspace' || pathname === '/' ? 'text-slate-900 border-slate-900' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
            Workspace
          </Link>
          {token && (
            <Link href="/history" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/history' ? 'text-slate-900 border-slate-900' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
              Histórico
            </Link>
          )}
          <Link href="/plans" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/plans' ? 'text-slate-900 border-slate-900' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
            Planos
          </Link>
        </nav>

        {/* ÁREA DO UTILIZADOR */}
        <div>
          {token ? (
            <div className="flex items-center gap-3 sm:gap-4">
              
              {/* 🟢 AVATAR COM TOAST DINÂMICO */}
              <div className="relative group cursor-pointer">
                <Link href="/profile" className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white font-bold shadow-md transition-all duration-300 group-hover:ring-4 group-hover:ring-violet-500/20">
                  {userData?.name ? userData.name.charAt(0).toUpperCase() : 'B'}
                </Link>

                {/* O TOAST */}
                <div className="absolute right-0 mt-3 w-max min-w-[220px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top-right scale-95 group-hover:scale-100 z-50">
                  <div className="bg-slate-900 rounded-2xl p-4 shadow-2xl border border-slate-700 relative">
                    <div className="absolute -top-2 right-4 w-4 h-4 bg-slate-900 border-t border-l border-slate-700 transform rotate-45"></div>
                    <div className="relative z-10 flex flex-col text-left">
                      <span className="text-sm font-black text-white truncate max-w-[180px]">
                        {userData?.name || 'Utilizador Bawzi'}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 truncate max-w-[180px] mt-0.5">
                        {userData?.email || 'Definições de Perfil'}
                      </span>
                      
                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                         <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[9px] font-black uppercase tracking-widest rounded-lg">
                           ⭐ Nível {userTier}
                         </span>
                         <button onClick={handleLogout} className="text-[9px] font-bold text-slate-500 hover:text-rose-400 transition-colors uppercase tracking-widest">
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
              onClick={() => window.dispatchEvent(new CustomEvent('bawzi_open_auth', { detail: 'login' }))}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-sm"
            >
              Entrar
            </button>
          )}
        </div>
      </div>
    </header>
  );
}