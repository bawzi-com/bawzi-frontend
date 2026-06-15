'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { setAccessToken } from '@/lib/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultView?: 'login' | 'register';
  onSuccess?: () => void;
}

const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: '8 caracteres ou mais', test: (value: string) => value.length >= 8 },
  { id: 'uppercase', label: 'uma letra maiúscula', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'number', label: 'um número', test: (value: string) => /[0-9]/.test(value) },
  { id: 'special', label: 'um caractere especial, como @, #, ! ou %', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

const PASSWORD_GUIDANCE = 'Use uma senha com 8 caracteres ou mais, uma letra maiúscula, um número e um caractere especial.';

const getMissingPasswordRequirements = (value: string) =>
  PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(value));

const formatRequirementList = (items: string[]) => {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
};

const buildPasswordError = (value: string) => {
  const missing = getMissingPasswordRequirements(value);
  if (!missing.length) return '';
  return `Sua senha ainda precisa de ${formatRequirementList(missing.map((item) => item.label))}.`;
};

// ============================================================================
// 1. O COMPONENTE DE CONTEÚDO (Lógica e Visual do Modal)
// ============================================================================
function AuthModalContent({ isOpen, onClose, defaultView = 'login', onSuccess }: AuthModalProps) {
  const [view, setView] = useState<'login' | 'register' | 'forgot-password' | '2fa'>(defaultView);
  // 2FA: pré-token emitido após a senha correta (vale 5 min, só para a etapa do código)
  const [preToken2FA, setPreToken2FA] = useState('');
  const [code2FA, setCode2FA] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const missingPasswordRequirements = getMissingPasswordRequirements(password);
  const isRegisterPasswordValid = missingPasswordRequirements.length === 0;

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
          credentials: 'include',  // grava o cookie de refresh (ver nota no handleSubmit)
          body: JSON.stringify({ token: tokenResponse.access_token }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(parseApiError(errData, 'Erro ao validar com o Google'));
        }

        const data = await res.json();

        // 🔐 Conta com 2FA ativo → mesma etapa de código do login por senha
        if (data.requires_2fa && data.pre_token) {
          setPreToken2FA(data.pre_token);
          setCode2FA('');
          setView('2fa');
          setLoading(false);
          return;
        }

        setAccessToken(data.access_token);
        localStorage.setItem('bawzi_token', data.access_token); // sync legacy
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

  /**
   * Erros de validação do FastAPI (422) chegam como ARRAY de objetos em
   * `detail` — antes o código assumia string, quebrava no .toLowerCase() e o
   * usuário via um erro genérico em vez de "Senha: deve conter maiúscula".
   */
  const parseApiError = (errorData: unknown, fallback: string): string => {
    const d = (errorData as { detail?: unknown })?.detail;
    if (typeof d === 'string' && d.trim()) {
      const message = d.trim();
      return view === 'register' && message.toLowerCase().includes('senha') ? PASSWORD_GUIDANCE : message;
    }
    if (Array.isArray(d)) {
      const nomes: Record<string, string> = { password: 'Senha', email: 'E-mail', name: 'Nome' };
      const msgs = d.map((e) => {
        const item = e as { loc?: unknown[]; msg?: string };
        const campo = Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1]) : '';
        let m = String(item.msg || '')
          .replace(/^Value error,\s*/i, '')
          .replace(/^String should have at least (\d+) characters$/i, 'deve ter ao menos $1 caracteres')
          .replace(/^value is not a valid email address.*$/i, 'endereço inválido');
        if (!m) return '';
        if (campo === 'password') return `Senha: ${buildPasswordError(password) || PASSWORD_GUIDANCE}`;
        return campo && nomes[campo] ? `${nomes[campo]}: ${m}` : m;
      }).filter(Boolean);
      if (msgs.length) return msgs.join(' · ');
    }
    return fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (view === 'register' && !isRegisterPasswordValid) {
      setError(buildPasswordError(password) || PASSWORD_GUIDANCE);
      return;
    }

    setLoading(true);

    try {
      const endpoint = view === 'login' ? '/api/auth/login' : '/api/auth/register';
      
      const payload = view === 'login' 
        ? { email: email, password: password } 
        : { email: email, password: password, name: nome };
        
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // credentials: SEM isto o browser descarta o Set-Cookie do refresh
        // (cross-origin) → bawzi_refresh nunca era gravado → todo
        // /api/auth/refresh devolvia 401 e a sessão morria em 60 min.
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = parseApiError(errorData, 'Ocorreu um erro na autenticação.');
        // Se estiver no register e email já existe → switch automático para login
        if (view === 'register' && (
          msg.toLowerCase().includes('já cadastrado') ||
          msg.toLowerCase().includes('already') ||
          msg.toLowerCase().includes('duplicate') ||
          msg.toLowerCase().includes('já existe') ||
          msg.toLowerCase().includes('em uso') ||
          msg.toLowerCase().includes('e-mail já') ||
          msg.toLowerCase().includes('email já')
        )) {
          setView('login');
          setError('Este e-mail já tem uma conta. Entre com sua senha abaixo.');
          setLoading(false);
          return;
        }
        throw new Error(msg);
      }

      const data = await response.json();

      // 🔐 Conta com 2FA ativo → etapa do código do app autenticador
      if (data.requires_2fa && data.pre_token) {
        setPreToken2FA(data.pre_token);
        setCode2FA('');
        setView('2fa');
        setLoading(false);
        return;
      }

      const tokenToSave = data.access_token || data.token;
      if (tokenToSave) {
        setAccessToken(tokenToSave);
        localStorage.setItem('bawzi_token', tokenToSave); // sync legacy
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

  // Etapa 2 do login com 2FA: valida o código TOTP (ou código de backup)
  const handleSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/auth/login/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pre_token: preToken2FA, code: code2FA }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Código inválido.');

      const tokenToSave = data.access_token;
      if (!tokenToSave) throw new Error('Token não recebido do servidor.');
      setAccessToken(tokenToSave);
      localStorage.setItem('bawzi_token', tokenToSave);
      if (data.tier !== undefined) localStorage.setItem('bawzi_tier', data.tier.toString());
      if (data.workspace_id) localStorage.setItem('bawzi_workspace_id', data.workspace_id);
      if (typeof data.backup_codes_restantes === 'number' && data.backup_codes_restantes <= 2) {
        alert(`⚠️ Você usou um código de backup. Restam apenas ${data.backup_codes_restantes}. Gere novos no Perfil → Segurança.`);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao validar o código.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // ---- VIEW: CÓDIGO 2FA (após senha correta) ----
  if (view === '2fa') {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-4 bg-slate-950/45 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] rounded-[2rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500"></div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 z-10 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xl font-bold"
          >
            &times;
          </button>
          <div className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-6 sm:p-8 md:p-10">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100 text-2xl">
                🔐
              </div>
              <h2 className="text-2xl font-black text-slate-900">Verificação em 2 fatores</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Digite o código de 6 dígitos do seu app autenticador — ou um código de backup (XXXX-XXXX).
              </p>
            </div>

            <form onSubmit={handleSubmit2FA} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code2FA}
                onChange={(e) => setCode2FA(e.target.value)}
                placeholder="000000"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-2xl font-black tracking-[0.4em] text-slate-900 placeholder-slate-300 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
              />
              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || code2FA.trim().length < 6}
                className="w-full rounded-xl bg-slate-900 py-3.5 font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? 'Verificando…' : 'Confirmar e entrar'}
              </button>
              <button
                type="button"
                onClick={() => { setView('login'); setError(''); setCode2FA(''); }}
                className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← Voltar ao login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---- VIEW: ESQUECEU A SENHA ----
  if (view === 'forgot-password') {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-4 bg-slate-950/45 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] rounded-[2rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500"></div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 z-10 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xl font-bold"
          >
            &times;
          </button>
          <div className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-6 sm:p-8 md:p-10">
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
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-4 bg-slate-950/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] rounded-[2rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">

        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500"></div>

        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xl font-bold"
        >
          &times;
        </button>

        <div className="max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-5 sm:p-8 md:p-10">
          <div className="flex flex-col items-center text-center mb-5 sm:mb-8">
            <div className="mb-4 sm:mb-6 transform hover:scale-105 transition-transform">
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

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {view === 'register' && (
              <div>
                <input
                  type="text"
                  placeholder="Nome Completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50 transition-all font-medium"
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
                className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50 transition-all font-medium"
                required
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={view === 'register' && password.length > 0 && !isRegisterPasswordValid}
                aria-describedby={view === 'register' ? 'password-requirements' : undefined}
                className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-slate-50 transition-all font-medium"
                required
              />
            </div>

            {view === 'register' && (
              <div id="password-requirements" className="-mt-1 space-y-1.5 sm:space-y-2 px-1 text-xs">
                <p className="font-bold text-slate-500">Sua senha precisa ter:</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {PASSWORD_REQUIREMENTS.map((requirement) => {
                    const met = requirement.test(password);
                    return (
                      <span
                        key={requirement.id}
                        className={`flex min-h-5 items-start gap-2 leading-snug ${met ? 'text-emerald-700' : 'text-slate-500'}`}
                      >
                        <span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${met ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {requirement.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

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
