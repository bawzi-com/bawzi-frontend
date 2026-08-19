// app/gestao/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardList, FileText, LockKeyhole, Sparkles } from 'lucide-react';
import AuthModal from '../../components/AuthModal';
import { getAuthToken, initSession } from '@/lib/apiClient';

/** Manda para a aba de Gestão dentro do app, preservando a querystring.
 *
 *  ⚠️ PRESERVAR A QUERYSTRING NÃO É DETALHE: as notificações apontam para
 *  `?tab=gestao` e alguns links carregam `?analysis=<id>`. Redirecionar para
 *  uma URL limpa abriria a Gestão na análise errada — ou em nenhuma. */
function RedirecionaParaAba() {
  const router = useRouter();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set('tab', 'gestao');
    router.replace(`/workspace?${q.toString()}`);
  }, [router]);
  // O `replace` acontece no efeito, então existe um quadro antes do salto.
  // Tela branca sem explicação parece travamento; esta linha ocupa o intervalo.
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm font-semibold text-slate-400">Abrindo a Gestão…</p>
    </div>
  );
}

export default function GestaoPage() {
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const sessionToken = getAuthToken() || await initSession();
      if (!mounted) return;

      setToken(sessionToken);
    };

    void syncSession();

    const handleOpenAuth = (event: Event) => {
      const mode = (event as CustomEvent<'login' | 'register'>).detail || 'login';
      setAuthMode(mode);
      setShowAuthModal(true);
    };

    window.addEventListener('bawzi_open_auth', handleOpenAuth);
    return () => {
      mounted = false;
      window.removeEventListener('bawzi_open_auth', handleOpenAuth);
    };
  }, []);

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:py-10">
      {token ? (
        // ⚠️ QUEM ESTÁ LOGADO VAI PARA A ABA, NÃO FICA AQUI.
        // Esta página renderizava a Gestão sozinha, sem a `AppSidebar` — e o
        // item "Gestão" do menu apontava para cá com `router.push`, o único do
        // menu que trocava de ROTA em vez de trocar de aba. O efeito era o menu
        // inteiro sumir: sem navegação, sem marcação de aba ativa, sem volta a
        // não ser pelo botão do navegador.
        //
        // A aba interna já entrega o que esta página dava por acidente — o
        // botão "Ocultar menu", que libera os 288px da lateral para as colunas
        // do fluxo. Espaço vira escolha reversível em vez de consequência da
        // navegação.
        //
        // ⚠️ A ROTA NÃO FOI APAGADA, POR DOIS MOTIVOS. O deslogado continua
        // vendo a apresentação abaixo, que é conteúdo de entrada e não erro de
        // arquitetura. E o link já circula em notificação e favorito: devolver
        // 404 para quem chega por eles seria trocar um menu sumido por uma
        // página inexistente.
        <RedirecionaParaAba />
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
          // Basta o token: com ele o `RedirecionaParaAba` assume e o app shell
          // resolve o tier. Ler `bawzi_tier` aqui era manter uma segunda cópia
          // do nível do plano numa página que não usa mais esse dado.
          setToken(getAuthToken());
          setShowAuthModal(false);
        }}
      />
    </div>
  );
}
