// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

// A variável mágica que aponta para o Render na Vercel (ou localhost no seu PC)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==========================================
// COMPONENTE: BOTÃO GOOGLE CUSTOMIZADO
// ==========================================
const CustomGoogleButton = ({ onSuccess, onError, disabled }: { onSuccess: any, onError: any, disabled: boolean }) => {
  const login = useGoogleLogin({
    onSuccess: onSuccess,
    onError: onError,
  });

  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={disabled}
      className="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
    >
      <svg className="w-6 h-6" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      Continuar com o Google
    </button>
  );
};

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // ==========================================
  // HANDLER: LOGIN COM GOOGLE
  // ==========================================
  const handleGoogleSuccess = async (tokenResponse: any) => {
    try {
      setAuthLoading(true);
      setAuthError(null);

      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenResponse.access_token }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Falha no login com Google');

      localStorage.setItem('bawzi_token', data.access_token);
      localStorage.setItem('bawzi_tier', (data.tier !== undefined ? data.tier : 1).toString());
      
      router.push('/workspace'); 
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ==========================================
  // HANDLER: LOGIN/REGISTO COM E-MAIL
  // ==========================================
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true); 
    setAuthError(null);
    
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload: any = { ...authForm };
      
      if (authMode === 'login') delete payload.name; 
      else { payload.plan = "free"; payload.tier = 1; }

      // Usando o API_URL e as aspas invertidas (template literals)
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 422 && Array.isArray(data.detail)) {
          const errorMessages = data.detail.map((err: any) => `O campo '${err.loc[err.loc.length - 1]}' ${err.msg}`).join(' | ');
          throw new Error(`Validação falhou: ${errorMessages}`);
        }
        throw new Error(data.detail || 'Falha na autenticação');
      }

      localStorage.setItem('bawzi_token', data.access_token);
      localStorage.setItem('bawzi_tier', (data.tier !== undefined ? data.tier : 1).toString());
      
      router.push('/workspace');
    } catch (err: any) { 
      setAuthError(err.message); 
    } finally { 
      setAuthLoading(false); 
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-b from-violet-200/50 to-transparent rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 md:p-12 shadow-2xl relative overflow-hidden border border-slate-100">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 to-pink-600"></div>
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-8 transform hover:scale-105 transition-transform cursor-pointer" onClick={() => router.push('/')}>
            <img src="/logo-bawzi.png" alt="Bawzi Logo" className="h-8 w-auto object-contain" />
          </div>
          
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
            {authMode === 'register' ? 'Criar Conta' : 'Boas-vindas'}
          </h2>
          <p className="text-slate-500 text-sm mt-3 px-2 font-medium leading-relaxed">
            {authMode === 'register' 
              ? 'Começa a analisar editais em segundos com o poder da Inteligência Artificial.' 
              : 'Acesse ao teu painel estratégico e histórico de análises.'}
          </p>
        </div>
        
        {authError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
            <span className="text-xl leading-none">⚠️</span>
            <p className="text-sm font-medium leading-relaxed">{authError}</p>
          </div>
        )}

        {/* 🟢 O NOSSO NOVO BOTÃO CUSTOMIZADO 🟢 */}
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
          <div className="mb-6">
            <CustomGoogleButton 
              onSuccess={handleGoogleSuccess} 
              onError={() => setAuthError('Ocorreu um erro ao conectar com o Google.')} 
              disabled={authLoading} 
            />
          </div>
        </GoogleOAuthProvider>

        <div className="flex items-center gap-4 mb-6 opacity-50">
          <div className="h-px bg-slate-300 flex-1"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ou com e-mail</span>
          <div className="h-px bg-slate-300 flex-1"></div>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authMode === 'register' && (
            <input 
              type="text" required placeholder="Nome completo" 
              value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} 
              className="w-full p-4 rounded-2xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium" 
            />
          )}
          <input 
            type="email" required placeholder="E-mail profissional" 
            value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} 
            className="w-full p-4 rounded-2xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium" 
          />
          <input 
            type="password" required placeholder="Palavra-passe" 
            value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} 
            className="w-full p-4 rounded-2xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none bg-slate-50 transition-all font-medium" 
          />
          
          <button 
            type="submit" disabled={authLoading} 
            className="w-full py-4 mt-4 bg-slate-950 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
          >
            {authLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                A processar...
              </div>
            ) : authMode === 'register' ? 'Começar Gratuitamente' : 'Entrar na Conta'}
          </button>
        </form>

        <div className="text-center mt-8 text-sm text-slate-500 font-medium">
          <span>{authMode === 'register' ? 'Já tens conta na Bawzi?' : 'És novo por aqui?'}</span> 
          <button 
            onClick={() => {
              setAuthMode(authMode === 'register' ? 'login' : 'register');
              setAuthError(null);
            }} 
            className="ml-2 text-violet-600 font-bold hover:underline underline-offset-4 transition-all"
          >
            {authMode === 'register' ? 'Fazer Login' : 'Criar Conta Grátis'}
          </button>
        </div>
      </div>
    </div>
  );
}