'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('1');
  // 🟢 NOVO: Estado para guardar nome e email
  const [userData, setUserData] = useState<{name?: string, email?: string} | null>(null);

  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState([
    { 
      id: 1, 
      type: 'critical', 
      title: 'Risco de Desclassificação', 
      message: 'Sua Certidão Federal (CND) expira em 48 horas.', 
      isRead: false,
    },
    { 
      id: 2, 
      type: 'success', 
      title: 'Neural Matchmaker', 
      message: 'Encontramos 2 novos editais compatíveis com o seu CNAE.', 
      isRead: false,
    }
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('bawzi_token');
    const savedTier = localStorage.getItem('bawzi_tier');
    
    // 🟢 BUSCA OS DADOS DO UTILIZADOR (Assumindo que guarda no login como 'bawzi_user')
    const savedUser = localStorage.getItem('bawzi_user');

    if (savedToken) setToken(savedToken);
    if (savedTier) setUserTier(savedTier);
    if (savedUser) {
      try {
        setUserData(JSON.parse(savedUser));
      } catch (e) {
        console.error("Erro ao ler dados do utilizador", e);
      }
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('bawzi_token');
    localStorage.removeItem('bawzi_tier');
    localStorage.removeItem('bawzi_user'); // Limpa também o utilizador
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
              
              {/* SINO DE NOTIFICAÇÕES */}
              <div className="relative">
                <button onClick={() => setShowNotifMenu(!showNotifMenu)} className="relative flex items-center justify-center h-9 w-9 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors border border-slate-200">
                  <span className="text-base">🔔</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-in zoom-in">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifMenu(false)}></div>
                    <div className="absolute right-0 mt-3 w-80 sm:w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Radar Estratégico</h3>
                        {unreadCount > 0 && (
                          <button onClick={markAllAsRead} className="text-[10px] font-bold text-violet-600 hover:text-violet-800 uppercase">
                            Marcar lidas
                          </button>
                        )}
                      </div>
                      <div className="max-h-[350px] overflow-y-auto">
                        {notifications.map(notif => (
                          <div key={notif.id} className={`p-4 flex gap-4 ${notif.isRead ? 'opacity-60' : 'bg-violet-50/30'}`}>
                            <div className="mt-1">{notif.type === 'critical' ? '🚨' : '🎯'}</div>
                            <div className="flex-1">
                              <h4 className="text-sm font-bold mb-1">{notif.title}</h4>
                              <p className="text-xs text-slate-500 leading-relaxed">{notif.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 🟢 AVATAR COM TOAST DINÂMICO */}
              <div className="relative group cursor-pointer">
                <Link href="/profile" className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white font-bold shadow-md transition-all duration-300 group-hover:ring-4 group-hover:ring-violet-500/20">
                  {/* Pega a inicial do nome Marcelo ou usa B como fallback */}
                  {userData?.name ? userData.name.charAt(0).toUpperCase() : 'B'}
                </Link>

                {/* O TOAST */}
                <div className="absolute right-0 mt-3 w-max min-w-[220px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top-right scale-95 group-hover:scale-100 z-50">
                  <div className="bg-slate-900 rounded-2xl p-4 shadow-2xl border border-slate-700 relative">
                    <div className="absolute -top-2 right-4 w-4 h-4 bg-slate-900 border-t border-l border-slate-700 transform rotate-45"></div>
                    <div className="relative z-10 flex flex-col text-left">
                      {/* 🟢 NOME REAL DO MARCELO AQUI */}
                      <span className="text-sm font-black text-white truncate max-w-[180px]">
                        {userData?.name || 'Utilizador Bawzi'}
                      </span>
                      {/* 🟢 EMAIL REAL AQUI */}
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
             <Link href="/login" className="bg-slate-950 !text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg">
              Acessar a Conta
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}