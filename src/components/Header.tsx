'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname(); // Para saber qual a aba ativa
  
  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('1');

  // Verifica o status de login ao carregar qualquer página
  useEffect(() => {
    const savedToken = localStorage.getItem('bawzi_token');
    const savedTier = localStorage.getItem('bawzi_tier');
    if (savedToken) setToken(savedToken);
    if (savedTier) setUserTier(savedTier);
  }, [pathname]); // Recalcula se a rota mudar

  const handleLogout = () => {
    localStorage.removeItem('bawzi_token');
    localStorage.removeItem('bawzi_tier');
    setToken(null);
    router.push('/'); // Volta para a Landing Page
    window.location.reload(); // Força a limpeza visual
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm transition-all">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
        
        {/* LOGÓTIPO */}
        <Link href="/" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
          <img src="/logo-bawzi.png" alt="Bawzi" className="h-8 w-auto" />
        </Link>

        {/* NAVEGAÇÃO CENTRAL */}
        <nav className="hidden md:flex items-center gap-8 mr-8">
          <Link 
            href="/workspace" 
            className={`text-sm font-bold pb-1 border-b-2 transition-all ${
              pathname === '/workspace' || pathname === '/' 
                ? 'text-slate-900 border-slate-900' 
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            Workspace
          </Link>
          
          {token && (
            <Link 
              href="/history" 
              className={`text-sm font-bold pb-1 border-b-2 transition-all ${
                pathname === '/history' 
                  ? 'text-slate-900 border-slate-900' 
                  : 'text-slate-500 border-transparent hover:text-slate-900'
              }`}
            >
              Histórico
            </Link>
          )}
          
        <Link 
        href="/plans" 
        className={`text-sm font-bold pb-1 border-b-2 transition-all ${
            pathname === '/plans' 
            ? 'text-slate-900 border-slate-900' 
            : 'text-slate-500 border-transparent hover:text-slate-900'
        }`}
        >
        Planos
        </Link>
        </nav>

        {/* ÁREA DO UTILIZADOR */}
        <div>
          {token ? (
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-block text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                ⭐ Nível {userTier}
              </span>
              
              <Link href="/profile" className="h-9 w-9 rounded-full bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white font-bold shadow-md hover:scale-110 transition-transform" title="Definições de Perfil">
                B {/* Idealmente, puxar a primeira letra do nome do LocalStorage */}
              </Link>

              <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:text-red-700 transition">
                Sair
              </button>
            </div>
          ) : (
             <Link 
            href="/login" 
            className="bg-slate-950 !text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg hover:-translate-y-0.5"
            >
            Acessar a Conta
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}