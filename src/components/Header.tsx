'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { apiFetch, SessionExpiredError, clearSession, API_URL, getAuthToken, initSession } from '@/lib/apiClient';
import type { BawziUpdateEvent } from '@/lib/types';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const isLanding = pathname === '/';
  
  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('1');
  const [userData, setUserData] = useState<{name?: string, email?: string} | null>(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [promo, setPromo] = useState<{is_promo: boolean; promo_expires_at: string} | null>(null);

  useEffect(() => {

    // Sincronismo imediato: usa o cache para a UI não piscar.
    const syncFromCache = () => {
      const savedToken = getAuthToken();
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

    // Validação silenciosa no servidor.
    const validateTierSilently = async (_token: string) => {
      try {
        // Fazemos as mesmas chamadas que o Perfil faz para garantir consistência
        const [userRes, wsRes] = await Promise.all([
          apiFetch(`${API_URL}/api/users/me`),
          apiFetch(`${API_URL}/api/workspace/details`)
        ]);

        if (userRes.ok) {
          const uData = await userRes.json();
          const wData = wsRes.ok ? await wsRes.json() : {};

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
          setIsGlobalAdmin(Boolean(uData.is_admin));

          // Promo
          if (uData.promo_expires_at) {
            setPromo({ is_promo: uData.is_promo ?? false, promo_expires_at: uData.promo_expires_at });
          } else {
            setPromo(null);
          }

          localStorage.setItem('bawzi_tier', nivelString);
          localStorage.setItem('bawzi_tier_ts', String(Date.now()));
          localStorage.setItem('user_name', uData.name || uData.nome || '');
          localStorage.setItem('user_email', uData.email || '');
        }
      } catch (err) {
        if (err instanceof SessionExpiredError) return;
        console.error("Erro na sincronização silenciosa do Header:", err);
      }
    };

    const hydrateSession = async () => {
      const tokenAtivo = syncFromCache() || await initSession();

      if (tokenAtivo) {
        setToken(tokenAtivo);
        await validateTierSilently(tokenAtivo);
      } else {
        setIsGlobalAdmin(false);
      }
    };

    hydrateSession();

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
    clearSession({ notifyExpired: false });
    setToken(null);
    setIsGlobalAdmin(false);
    router.push('/');
    window.location.reload();
  };

  const promoStrip = promo?.promo_expires_at ? (() => {
    const exp     = new Date(promo.promo_expires_at);
    const dias    = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
    const urgente = dias <= 1;

    if (promo.is_promo) {
      return (
        <div className={`flex items-center justify-center gap-2 px-4 py-1.5 text-[11px] font-medium border-b ${
          urgente
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
        }`}>
          <span>🎁</span>
          <span>
            Acesso promocional —{' '}
            {urgente
              ? <strong>expira hoje!</strong>
              : `expira em ${dias} ${dias === 1 ? 'dia' : 'dias'} · ${exp.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
          </span>
          <Link
            href="/plans"
            className={`ml-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black transition-colors ${
              urgente ? 'border-amber-300 hover:bg-amber-100' : 'border-emerald-300 hover:bg-emerald-100'
            }`}
          >
            Ver planos
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-medium">
        <span>⏰</span>
        <span>Acesso promocional encerrou em {exp.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <Link href="/plans" className="ml-1 rounded-full border border-slate-300 px-2.5 py-0.5 text-[10px] font-black text-slate-600 hover:bg-slate-100 transition-colors">
          Resgatar plano
        </Link>
      </div>
    );
  })() : null;

  const landingLinks = [
    { href: '/#problema', label: 'Problema' },
    { href: '/#como-funciona', label: 'Como funciona' },
    { href: '/#vantagens', label: 'Por que a Bawzi' },
    { href: '/#economia', label: 'Economia' },
    { href: '/#planos', label: 'Planos' },
  ];

  return (
    <div className="sticky top-0 z-50 print:hidden">
      {promoStrip}
    <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-sm transition-all">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
        
        {/* LOGÓTIPO */}
        <Link href="/" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
          <Image src="/logo-bawzi.png" alt="Bawzi" width={120} height={40} className="h-10 w-auto" priority unoptimized />
        </Link>

        {/* NAVEGAÇÃO CENTRAL */}
        <nav className="hidden md:flex items-center gap-5 lg:gap-7 mr-4 lg:mr-8">
          {isLanding && !token ? (
            landingLinks.map(({ href, label }) => (
              <Link key={href} href={href} className="text-sm font-bold pb-1 border-b-2 border-transparent text-slate-500 transition-all hover:text-slate-900">
                {label}
              </Link>
            ))
          ) : (
            <>
              <Link href="/workspace" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/workspace' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
                Área de trabalho
              </Link>
              {token && (
                <Link href="/gestao" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/gestao' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
                  Gestão
                </Link>
              )}
              <Link href="/plans" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/plans' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
                Planos
              </Link>
              <Link href="/docs" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/docs' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
                Documentação
              </Link>
            </>
          )}
        </nav>

        {/* ÁREA DO UTILIZADOR */}
        <div>
          {token ? (
            <div className="flex items-center gap-3 sm:gap-4">
              {isGlobalAdmin && (
                <Link
                  href="/admin"
                  className={`inline-flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-black uppercase tracking-wider transition-colors ${
                    pathname === '/admin'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  Admin
                </Link>
              )}
              
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
            <div className="flex items-center gap-2">
              {isLanding && (
                <Link href="/#planos" className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50 sm:inline-flex md:hidden">
                  Planos
                </Link>
              )}
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
            </div>
          )}
        </div>
      </div>
    </header>
    </div>
  );
}
