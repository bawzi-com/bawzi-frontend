// app/history/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, FileText, LockKeyhole, Sparkles } from 'lucide-react';
import HistoryTab from '../../components/HistoryTab';
import AuthModal from '../../components/AuthModal';

export default function HistoryPage() {
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    setToken(localStorage.getItem('bawzi_token'));

    const handleOpenAuth = (event: Event) => {
      const mode = (event as CustomEvent<'login' | 'register'>).detail || 'login';
      setAuthMode(mode);
      setShowAuthModal(true);
    };

    window.addEventListener('bawzi_open_auth', handleOpenAuth);
    return () => window.removeEventListener('bawzi_open_auth', handleOpenAuth);
  }, []);

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-10 sm:px-6 lg:py-12">
      {token ? (
        <HistoryTab token={token} />
      ) : (
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_-36px_rgba(15,23,42,0.34)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_390px]">
            <section className="relative bg-gradient-to-br from-white via-emerald-50/45 to-sky-50/45 p-6 sm:p-8 lg:p-10">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/85 px-3.5 py-2 text-[11px] font-black uppercase text-emerald-700 shadow-sm">
                <BookOpen size={13} />
                Central de decisões
              </div>

              <div className="max-w-2xl">
                <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
                  Suas análises ficam organizadas para voltar na decisão certa.
                </h1>
                <p className="mt-5 max-w-xl text-base font-medium leading-7 text-slate-600">
                  Entre na sua conta para rever vereditos Go/No-Go, riscos, scores e oportunidades que ainda podem fazer sentido para sua empresa.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => openAuth('login')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white shadow-[0_18px_35px_-18px_rgba(5,150,105,0.65)] transition-all hover:bg-emerald-700 active:scale-[0.98]"
                >
                  Entrar na conta
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => openAuth('register')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  Criar conta grátis
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  'Veredito e score',
                  'Riscos e prazos',
                  'Concorrência e margem',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <aside className="border-t border-slate-200 bg-white p-5 sm:p-6 lg:border-l lg:border-t-0">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase text-slate-400">Prévia protegida</p>
                  <h2 className="mt-1 text-lg font-black text-slate-950">O que aparece aqui</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                  <LockKeyhole size={18} />
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { title: 'Edital PNCP analisado', score: '82', tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                  { title: 'Pregão com atenção jurídica', score: '58', tone: 'text-amber-700 bg-amber-50 border-amber-100' },
                  { title: 'Oportunidade descartada', score: '31', tone: 'text-red-700 bg-red-50 border-red-100' },
                ].map((item) => (
                  <div key={item.title} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-black ${item.tone}`}>
                      {item.score}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">{item.title}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-400">Detalhes disponíveis após login</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sky-700">
                  <Sparkles size={15} />
                  <p className="text-[11px] font-black uppercase">Continuidade</p>
                </div>
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  O histórico usa a mesma visão do detalhe da análise para você não reaprender a tela toda vez.
                </p>
              </div>

              <Link
                href="/workspace"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-all hover:bg-slate-50"
              >
                <FileText size={16} />
                Fazer nova análise
              </Link>
            </aside>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultView={authMode}
        onSuccess={() => {
          setToken(localStorage.getItem('bawzi_token'));
          setShowAuthModal(false);
        }}
      />
    </div>
  );
}
