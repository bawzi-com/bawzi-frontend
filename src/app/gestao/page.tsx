// app/gestao/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardList, FileText, LockKeyhole, Sparkles } from 'lucide-react';
import DecisionManagementTab from '../../components/DecisionManagementTab';
import AuthModal from '../../components/AuthModal';
import type { BawziUpdateEvent } from '@/lib/types';
import { getAuthToken, initSession } from '@/lib/apiClient';

export default function GestaoPage() {
  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const sessionToken = getAuthToken() || await initSession();
      if (!mounted) return;

      setToken(sessionToken);
      const tier = Number(localStorage.getItem('bawzi_tier') || 1);
      setUserTier(Number.isFinite(tier) ? tier : 1);
    };

    void syncSession();

    const handleOpenAuth = (event: Event) => {
      const mode = (event as CustomEvent<'login' | 'register'>).detail || 'login';
      setAuthMode(mode);
      setShowAuthModal(true);
    };

    const handleGlobalUpdate = (event: Event) => {
      const { detail } = event as BawziUpdateEvent;
      if (detail?.tier) setUserTier(Number(detail.tier));
    };

    window.addEventListener('bawzi_open_auth', handleOpenAuth);
    window.addEventListener('bawzi_update', handleGlobalUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('bawzi_open_auth', handleOpenAuth);
      window.removeEventListener('bawzi_update', handleGlobalUpdate);
    };
  }, []);

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:py-10">
      {token ? (
        <DecisionManagementTab token={token} userTier={userTier} />
      ) : (
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_-36px_rgba(15,23,42,0.34)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_410px]">
            <section className="relative bg-gradient-to-br from-white via-emerald-50/45 to-slate-50 p-6 sm:p-8 lg:p-10">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/85 px-3.5 py-2 text-[11px] font-black uppercase text-emerald-700 shadow-sm">
                <ClipboardList size={13} />
                Gestão de editais
              </div>

              <div className="max-w-2xl">
                <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
                  Acompanhe cada edital da análise até o resultado.
                </h1>
                <p className="mt-5 max-w-xl text-base font-medium leading-7 text-slate-600">
                  Entre na sua conta para controlar etapas, responsáveis, prazos, revisões de decisão e aprendizado de vitórias ou perdas.
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
                  'Pipeline completo',
                  'Filtros operacionais',
                  'Laudo e próxima ação',
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
                  <h2 className="mt-1 text-lg font-black text-slate-950">O que a gestão organiza</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                  <LockKeyhole size={18} />
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { title: 'Novo edital em triagem', meta: 'validar decisão e risco' },
                  { title: 'Pedido de esclarecimento', meta: 'responsável e prazo ativo' },
                  { title: 'Proposta enviada', meta: 'resultado e aprendizado' },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-sm font-black text-slate-800">{item.title}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">{item.meta}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-emerald-700">
                  <Sparkles size={15} />
                  <p className="text-[11px] font-black uppercase">Menos fila solta</p>
                </div>
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  A gestão transforma análises salvas em um fluxo de trabalho filtrável para a equipe decidir, executar e aprender.
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
          setToken(getAuthToken());
          const tier = Number(localStorage.getItem('bawzi_tier') || 1);
          setUserTier(Number.isFinite(tier) ? tier : 1);
          setShowAuthModal(false);
        }}
      />
    </div>
  );
}
