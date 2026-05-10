'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultView?: 'login' | 'register';
  onSuccess?: () => void;
}

// ============================================================================
// 1. O COMPONENTE DE CONTEÚDO (Lógica e Visual do Modal)
// ============================================================================
function AuthModalContent({ isOpen, onClose, defaultView = 'login', onSuccess }: AuthModalProps) {
  const [view, setView] = useState<'login' | 'register'>(defaultView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setView(defaultView);
      setEmail('');
      setPassword('');
      setNome('');
      setError('');
    }
  }, [isOpen, defaultView]);

  // Função mágica que lida com o Popup do Google e avisa o nosso backend
  const loginGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenResponse.access_token }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Erro ao validar com o Google");
        }

        const data = await res.json();

        localStorage.setItem('bawzi_token', data.access_token);
        if (data.tier !== undefined) localStorage.setItem('bawzi_tier', data.tier.toString());
        if (data.workspace_id) localStorage.setItem('bawzi_workspace_id', data.workspace_id);

        if (onSuccess) onSuccess();
        onClose();
      } catch (err: any) {
        setError(err.message || 'Falha ao autenticar com o servidor.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('A Autenticação com o Google falhou.'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = view === 'login' ? '/api/auth/login' : '/api/auth/register';
      
      const payload = view === 'login' 
        ? { email: email, password: password } 
        : { email: email, password: password, name: nome };
        
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ocorreu um erro na autenticação.');
      }

      const data = await response.json();

      const tokenToSave = data.access_token || data.token;
      if (tokenToSave) {
        localStorage.setItem('bawzi_token', tokenToSave);
        if (data.tier !== undefined) localStorage.setItem('bawzi_tier', data.tier.toString());
        if (data.workspace_id) localStorage.setItem('bawzi_workspace_id', data.workspace_id);
        
        if (onSuccess) onSuccess();
        onClose();
      } else {
        throw new Error('Token não recebido do servidor.');
      }

    } catch (err: any) {
      setError(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
        
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 to-pink-600"></div>
        
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 z-10 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xl font-bold"
        >
          &times;
        </button>

        <div className="p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-6 transform hover:scale-105 transition-transform">
              <Image src="/logo-bawzi.png" alt="Bawzi Logo" width={140} height={40} className="object-contain" priority />
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
              {view === 'login' ? 'Bem-vindo de volta' : 'Crie sua Conta'}
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {view === 'login' ? 'Acesse o seu painel de inteligência' : 'Desbloqueie o poder da Bawzi'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'register' && (
              <div>
                <input 
                  type="text" 
                  placeholder="Nome Completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium"
                  required 
                />
              </div>
            )}
            
            <div>
              <input 
                type="email" 
                placeholder="E-mail Profissional"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium"
                required 
              />
            </div>

            <div>
              <input 
                type="password" 
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium"
                required 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 mt-2 bg-slate-950 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'A processar...' : view === 'login' ? 'Entrar na Conta' : 'Começar Gratuitamente'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <span className="border-b border-slate-200 w-1/5 lg:w-1/4"></span>
            <span className="text-[10px] text-center text-slate-400 font-black uppercase tracking-widest">Ou continue com</span>
            <span className="border-b border-slate-200 w-1/5 lg:w-1/4"></span>
          </div>

          <button
            onClick={() => loginGoogle()}
            type="button"
            className="mt-4 w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Acessar com o Google
          </button>

          <div className="mt-8 text-center text-sm font-medium text-slate-500">
            {view === 'login' ? (
              <>És novo por aqui? <button onClick={() => setView('register')} className="ml-1 text-violet-600 hover:text-violet-700 font-bold underline underline-offset-4">Criar Conta Grátis</button></>
            ) : (
              <>Já tens conta na Bawzi? <button onClick={() => setView('login')} className="ml-1 text-violet-600 hover:text-violet-700 font-bold underline underline-offset-4">Fazer Login</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. O WRAPPER EXPORTADO (Injeta o Provider do Google no Componente)
// ============================================================================
export default function AuthModal(props: AuthModalProps) {
  // Puxa a chave do .env.local
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  // Se a chave não existir no .env, renderiza apenas o modal para não dar crash na página
  if (!googleClientId) {
    console.warn("⚠️ Chave NEXT_PUBLIC_GOOGLE_CLIENT_ID não encontrada no .env.local");
    return <AuthModalContent {...props} />;
  }

  // Se a chave existir, "abraça" o modal com o Provider do Google
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthModalContent {...props} />
    </GoogleOAuthProvider>
  );
}