'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

type Status = 'loading' | 'activated' | 'pending_registration' | 'error' | 'already_used';

function PromoActivateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [status, setStatus]   = useState<Status>('loading');
  const [dias, setDias]       = useState(3);
  const [message, setMessage] = useState('');
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Link inválido.'); return; }

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/promo-activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (!res.ok) {
          const msg = data.detail || 'Erro ao ativar convite.';
          if (msg.toLowerCase().includes('já foi utilizado')) {
            // Pode ser auto-ativação durante o cadastro — se há token no localStorage,
            // o promo já foi aplicado; tratar como sucesso e redirecionar.
            const hasSession = !!localStorage.getItem('bawzi_token');
            if (hasSession) {
              localStorage.setItem('bawzi_tier', '4');
              window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: 4 } }));
              setDias(3);
              setStatus('activated');
              setTimeout(() => router.replace('/workspace'), 2500);
            } else {
              setStatus('already_used');
            }
          } else {
            setStatus('error');
            setMessage(msg);
          }
          return;
        }

        if (data.status === 'pending_registration') {
          setStatus('pending_registration');
          return;
        }

        setDias(data.dias || 3);
        setStatus('activated');

        // Atualiza o tier no localStorage para o frontend refletir imediatamente
        localStorage.setItem('bawzi_tier', '4');
        window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: 4 } }));

        // Se já está logado vai direto ao workspace; senão manda para login com redirect
        const hasSession = !!localStorage.getItem('bawzi_token');
        const dest = hasSession ? '/workspace' : '/login?redirect=/workspace';
        setTimeout(() => router.replace(dest), 3000);
      } catch {
        setStatus('error');
        setMessage('Não foi possível conectar ao servidor.');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/20 to-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">

        {/* ── Carregando ── */}
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-5" />
            <h1 className="text-xl font-black text-white mb-2">Ativando seu acesso…</h1>
            <p className="text-slate-400 text-sm">Aguarde um momento.</p>
          </>
        )}

        {/* ── Ativado com sucesso ── */}
        {status === 'activated' && (
          <>
            <div className="w-16 h-16 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-5">
              <CheckCircle2 size={11} /> Acesso ativado
            </div>
            <h1 className="text-2xl font-black text-white mb-3">
              {dias} dias de acesso completo!
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Todos os recursos do plano <strong className="text-violet-400">Avançado</strong> estão
              disponíveis agora. Aproveite ao máximo!
            </p>
            <div className="space-y-2 text-left mb-7">
              {['Análise ilimitada com 4 Agentes IA', 'Radar de concorrentes e war room', 'Oportunidades com fit CNAE', 'Monitor inteligente e renovações', 'Fôlego financeiro da disputa'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {typeof window !== 'undefined' && localStorage.getItem('bawzi_token')
                ? 'Redirecionando para o workspace…'
                : 'Redirecionando para o login…'}
            </p>
            <Link
              href={typeof window !== 'undefined' && localStorage.getItem('bawzi_token') ? '/workspace' : '/login?redirect=/workspace'}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-black px-6 py-3 rounded-xl text-sm transition-colors"
            >
              {typeof window !== 'undefined' && localStorage.getItem('bawzi_token') ? 'Ir para o workspace' : 'Fazer login'} <ArrowRight size={14} />
            </Link>
          </>
        )}

        {/* ── Precisa registar ── */}
        {status === 'pending_registration' && (
          <>
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-xl font-black text-white mb-3">Quase lá!</h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Crie a sua conta com o e-mail do convite e o acesso será ativado automaticamente.
            </p>
            <Link
              href={`/login?view=register&redirect=/promo%3Ftoken%3D${token}`}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-black px-6 py-3 rounded-xl text-sm transition-colors"
            >
              Criar conta <ArrowRight size={14} />
            </Link>
          </>
        )}

        {/* ── Já usado ── */}
        {status === 'already_used' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-5" />
            <h1 className="text-xl font-black text-white mb-2">Convite já utilizado</h1>
            <p className="text-slate-400 text-sm mb-6">
              Este convite já foi activado. Se você é o destinatário, faça login normalmente.
            </p>
            <Link href="/login" className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-black px-6 py-3 rounded-xl text-sm transition-colors">
              Fazer login <ArrowRight size={14} />
            </Link>
          </>
        )}

        {/* ── Erro ── */}
        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-5" />
            <h1 className="text-xl font-black text-white mb-2">Link inválido</h1>
            <p className="text-slate-400 text-sm mb-6">{message || 'Este link de convite não é válido ou expirou.'}</p>
            <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
              Voltar ao início <ArrowRight size={14} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function PromoActivatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <PromoActivateContent />
    </Suspense>
  );
}
