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
  const [view, setView] = useState<'login' | 'register' | 'forgot-password'>(defaultView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView(defaultView);
      setEmail('');
      setPassword('');
      setNome('');
      setError('');
      setForgotSuccess(false);
      setConsentAccepted(false);
    }
  }, [isOpen, defaultView]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Erro ao enviar e-mail de recuperação.');
      }
      setForgotSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

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

  // ---- VIEW: ESQUECEU A SENHA ----
  if (view === 'forgot-password') {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500"></div>
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
              <h2 className="text-2xl font-black text-slate-900">Recuperar senha</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Enviaremos um link de redefinição para o seu e-mail</p>
            </div>

            {forgotSuccess ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-slate-700 font-semibold text-sm">E-mail enviado!</p>
                <p className="text-slate-500 text-xs">Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes. Verifique também a pasta de spam.</p>
                <button
                  onClick={() => { setView('login'); setForgotSuccess(false); setEmail(''); }}
                  className="mt-4 w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 text-center">
                    {error}
                  </div>
                )}
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <input
                    type="email"
                    placeholder="Seu e-mail de acesso"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50 transition-all font-medium"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200/60 active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                  </button>
                </form>
                <div className="mt-6 text-center text-sm font-medium text-slate-500">
                  <button onClick={() => setView('login')} className="text-emerald-700 hover:text-emerald-800 font-bold underline underline-offset-4">
                    ← Voltar ao login
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- VIEW: LOGIN / REGISTER ----
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">

        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500"></div>

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

            <h2 className="text-2xl font-black text-slate-900">
              {view === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {view === 'login' ? 'Acesse seu painel de inteligência' : 'Comece a decidir com mais clareza'}
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
                  className="w-full p-4 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50 transition-all font-medium"
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
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50 transition-all font-medium"
                required
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50 transition-all font-medium"
                required
              />
            </div>

            {view === 'login' && (
              <div className="text-right -mt-1">
                <button
                  type="button"
                  onClick={() => { setError(''); setView('forgot-password'); }}
                  className="text-xs text-slate-400 hover:text-emerald-700 font-semibold transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            {view === 'register' && (
              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-600 flex-shrink-0 cursor-pointer"
                />
                <span className="text-xs text-slate-500 leading-relaxed">
                  Li e aceito os{' '}
                  <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline underline-offset-2 hover:text-emerald-800">Termos de Uso</a>
                  {' '}e a{' '}
                  <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline underline-offset-2 hover:text-emerald-800">Política de Privacidade</a>
                  , e autorizo o tratamento dos meus dados pessoais conforme a{' '}
                  <a href="/lgpd" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-semibold underline underline-offset-2 hover:text-emerald-800">LGPD (Lei nº 13.709/2018)</a>.
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading || (view === 'register' && !consentAccepted)}
              className="w-full py-4 mt-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200/60 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processando...' : view === 'login' ? 'Entrar na conta' : 'Começar grátis'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <span className="border-b border-slate-200 w-1/5 lg:w-1/4"></span>
            <span className="text-[10px] text-center text-slate-400 font-black uppercase tracking-widest">Ou continue com</span>
            <span className="border-b border-slate-200 w-1/5 lg:w-1/4"></span>
          </div>

          <button
            onClick={() => {
              if (view === 'register' && !consentAccepted) {
                setError('Aceite os Termos de Uso e a Política de Privacidade para criar sua conta.');
                return;
              }
              loginGoogle();
            }}
            type="button"
            disabled={view === 'register' && !consentAccepted}
            className="mt-4 w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-bold py-3.5 px-4 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {view === 'register' ? 'Cadastrar com o Google' : 'Acessar com o Google'}
          </button>

          <div className="mt-8 text-center text-sm font-medium text-slate-500">
            {view === 'login' ? (
              <>Novo por aqui? <button onClick={() => setView('register')} className="ml-1 text-emerald-700 hover:text-emerald-800 font-bold underline underline-offset-4">Criar conta grátis</button></>
            ) : (
              <>Já tem conta na Bawzi? <button onClick={() => setView('login')} className="ml-1 text-emerald-700 hover:text-emerald-800 font-bold underline underline-offset-4">Fazer login</button></>
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
