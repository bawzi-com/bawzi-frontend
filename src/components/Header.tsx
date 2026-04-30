'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname(); // Para saber qual a aba ativa
  
  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('1');

  // ==========================================
  // ESTADOS DA CENTRAL DE NOTIFICAÇÕES
  // ==========================================
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
      message: 'Encontramos 2 novos editais milionários compatíveis com o seu CNAE.', 
      isRead: false,
    }
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

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
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm transition-all print:hidden">
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
            <div className="flex items-center gap-3 sm:gap-4">
              
              {/* 🟢 CENTRAL DE NOTIFICAÇÕES (SINO) */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifMenu(!showNotifMenu)} 
                  className="relative flex items-center justify-center h-9 w-9 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors border border-slate-200"
                >
                  <span className="text-base">🔔</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-in zoom-in">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown do Radar Estratégico */}
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
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 font-medium text-sm">
                            Nenhum alerta no seu radar.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {notifications.map(notif => (
                              <div key={notif.id} className={`p-4 hover:bg-slate-50 transition-colors flex gap-4 ${notif.isRead ? 'opacity-60' : 'bg-violet-50/30'}`}>
                                <div className="mt-1">
                                  {notif.type === 'critical' ? '🚨' : notif.type === 'success' ? '🎯' : '💡'}
                                </div>
                                <div className="flex-1">
                                  <h4 className={`text-sm font-bold mb-1 ${notif.type === 'critical' ? 'text-red-700' : 'text-slate-900'}`}>
                                    {notif.title}
                                  </h4>
                                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                    {notif.message}
                                  </p>
                                  <span className="text-[10px] text-slate-400 font-bold mt-2 block uppercase tracking-wider">Há 2 horas</span>
                                </div>
                                {!notif.isRead && <div className="w-2 h-2 rounded-full bg-violet-500 mt-2 shrink-0"></div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
                        <button className="text-xs font-black text-slate-600 hover:text-slate-900 uppercase tracking-widest">
                          Ver Histórico Completo
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* BADGE DE NÍVEL */}
              <span className="hidden sm:inline-block text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                ⭐ Nível {userTier}
              </span>
              
              {/* AVATAR DO UTILIZADOR */}
              <Link href="/profile" className="h-9 w-9 rounded-full bg-gradient-to-tr from-violet-600 to-pink-600 flex items-center justify-center text-white font-bold shadow-md hover:scale-110 transition-transform" title="Definições de Perfil">
                B
              </Link>

              {/* BOTÃO SAIR */}
              <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:text-red-700 transition ml-2">
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