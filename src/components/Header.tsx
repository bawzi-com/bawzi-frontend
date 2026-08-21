'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';
import { apiFetch, SessionExpiredError, encerrarSessao, API_URL, getAuthToken, initSession } from '@/lib/apiClient';
import { useTierConfig } from '@/Contexts/TierContext';
import type { BawziUpdateEvent } from '@/lib/types';
import PromoBanner from './PromoBanner';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const isLanding = pathname === '/';

  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>('1');
  const [userData, setUserData] = useState<{name?: string, email?: string, avatar_url?: string | null} | null>(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [promo, setPromo] = useState<{is_promo: boolean; promo_expires_at: string} | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Nome do plano da MESMA fonte que a tela de planos usa. O menu mostrava só
  // "Nível 4" — um número que não diz nada sozinho e que obriga a pessoa a
  // lembrar a tabela. O nome é o que ela reconhece.
  const { tierNames } = useTierConfig();

  useEffect(() => {

    // Sincronismo imediato: usa o cache para a UI não piscar.
    const syncFromCache = () => {
      const savedToken = getAuthToken();
      const savedTier = localStorage.getItem('bawzi_tier');
      const savedName = localStorage.getItem('user_name') || localStorage.getItem('nome');
      const savedEmail = localStorage.getItem('user_email');
      // ⚠️ A FOTO TAMBÉM VEM DO CACHE. Sem isto, toda navegação mostrava a
      // inicial colorida por uns instantes até `/users/me` responder, e só
      // então trocava pelo rosto — um piscar em cada página. O cache é limpo
      // no logout junto com nome e e-mail (`clearSession` só preserva a
      // allowlist de consentimento/tema).
      const savedAvatar = localStorage.getItem('user_avatar');

      if (savedToken) setToken(savedToken);
      if (savedTier) setUserTier(savedTier);
      if (savedName || savedEmail) {
        setUserData({ name: savedName || '', email: savedEmail || '', avatar_url: savedAvatar || null });
      }
      return savedToken;
    };

    // Validação silenciosa no servidor.
    const validateTierSilently = async (_token: string) => {
      try {
        // Fazemos as mesmas chamadas que o Perfil faz para garantir consistência
        const [userRes, wsRes] = await Promise.all([
          apiFetch(`${API_URL}/api/users/me`),
          apiFetch(`${API_URL}/api/workspace/details`)
        ]);

        if (userRes.ok) {
          const uData = await userRes.json();
          const wData = wsRes.ok ? await wsRes.json() : {};

          // O maior nível entre usuário e empresa vence.
          const nivelReal = Math.max(uData.tier || 1, wData.tier || 1);
          const nivelString = String(nivelReal);

          // Se o servidor sinalizou que o tier mudou (ex: promo expirou),
          // invalida o cache local independentemente do valor armazenado.
          const tierResetAt = uData.tier_reset_at ? new Date(uData.tier_reset_at).getTime() : 0;
          const tierSetAt   = Number(localStorage.getItem('bawzi_tier_ts') || 0);
          if (tierResetAt > tierSetAt) {
            localStorage.setItem('bawzi_tier', nivelString);
            localStorage.setItem('bawzi_tier_ts', String(Date.now()));
            window.dispatchEvent(new CustomEvent('bawzi_update', { detail: { tier: nivelReal } }));
          }

          setUserTier(nivelString);
          setUserData({ name: uData.name || uData.nome || '', email: uData.email, avatar_url: uData.avatar_url || null });
          setIsGlobalAdmin(Boolean(uData.is_admin));

          // Promo
          if (uData.promo_expires_at) {
            setPromo({ is_promo: uData.is_promo ?? false, promo_expires_at: uData.promo_expires_at });
          } else {
            setPromo(null);
          }

          localStorage.setItem('bawzi_tier', nivelString);
          localStorage.setItem('bawzi_tier_ts', String(Date.now()));
          localStorage.setItem('user_name', uData.name || uData.nome || '');
          localStorage.setItem('user_email', uData.email || '');
          // `removeItem` quando não há foto: quem remove o avatar não pode
          // continuar vendo o rosto antigo vindo do cache a cada navegação.
          if (uData.avatar_url) localStorage.setItem('user_avatar', uData.avatar_url);
          else localStorage.removeItem('user_avatar');
        }
      } catch (err) {
        if (err instanceof SessionExpiredError) return;
        console.error("Erro na sincronização silenciosa do Header:", err);
      }
    };

    const hydrateSession = async () => {
      const tokenAtivo = syncFromCache() || await initSession();

      if (tokenAtivo) {
        setToken(tokenAtivo);
        await validateTierSilently(tokenAtivo);
      } else {
        setIsGlobalAdmin(false);
      }
    };

    hydrateSession();

    // Escuta atualizações vindas de outras telas.
    const handleGlobalUpdate = (e: Event) => {
      const { detail } = e as BawziUpdateEvent;
      if (detail?.tier) setUserTier(String(detail.tier));
      if (detail?.name) setUserData(prev => ({ ...prev, name: detail.name }));
      // ⚠️ `!== undefined`, NÃO truthy. Remover a foto manda `null`, e um
      // `if (detail.avatar_url)` descartaria justamente essa notificação — o
      // avatar sumia do perfil e continuava no cabeçalho até recarregar.
      if (detail?.avatar_url !== undefined) {
        setUserData(prev => ({ ...prev, avatar_url: detail.avatar_url }));
      }
    };

    window.addEventListener('bawzi_update', handleGlobalUpdate);
    return () => window.removeEventListener('bawzi_update', handleGlobalUpdate);
  }, [pathname]);

  // Sessão expirada em qualquer lugar do app (token não renovável, refresh
  // cookie inválido/expirado etc.) → apiClient já limpou tudo em memória e
  // no localStorage; aqui só precisamos refletir isso na UI. Sem este
  // listener, o Header (montado globalmente em app/layout.tsx) continuava
  // mostrando avatar/tier/links como se o usuário ainda estivesse logado,
  // mesmo depois de qualquer outra chamada já ter derrubado a sessão —
  // dava a impressão de que "o sistema não desloga" depois de muito tempo
  // parado.
  useEffect(() => {
    const handleSessionExpired = () => {
      setToken(null);
      setUserData(null);
      setIsGlobalAdmin(false);
      setUserTier('1');
      setPromo(null);
    };
    window.addEventListener('bawzi_session_expired', handleSessionExpired);
    return () => window.removeEventListener('bawzi_session_expired', handleSessionExpired);
  }, []);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Fecha o menu ao navegar
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // ⚠️ ESCAPE FECHAVA NADA. Só clique fora e navegação fechavam o menu — quem
  // usa teclado abria e ficava preso, tendo de clicar em algum lugar neutro
  // para sair. Escape é o gesto universal de "cancelar" num popover.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        // Devolve o foco a quem abriu, senão ele fica no vazio depois do
        // menu sumir e a próxima tabulação recomeça do topo da página.
        (menuRef.current?.querySelector('button[aria-haspopup]') as HTMLElement | null)?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogout = async () => {
    // `encerrarSessao` faz as duas coisas na ordem certa: revoga o cookie no
    // servidor e só então limpa a memória. Estava escrito à mão aqui, em outro
    // lugar no perfil, e em nenhum dos caminhos automáticos — foi essa dispersão
    // que deixou o logout por inatividade sem revogar nada.
    await encerrarSessao({ notifyExpired: false });
    setToken(null);
    setIsGlobalAdmin(false);
    router.push('/');
    window.location.reload();
  };

  const promoStrip = promo?.promo_expires_at ? (() => {
    const exp     = new Date(promo.promo_expires_at);
    const dias    = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
    const urgente = dias <= 1;

    if (promo.is_promo) {
      return (
        <div className={`flex items-center justify-center gap-2 px-4 py-1.5 text-[11px] font-medium border-b ${
          urgente
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
        }`}>
          <span>🎁</span>
          <span>
            Acesso promocional —{' '}
            {urgente
              ? <strong>expira hoje!</strong>
              : `expira em ${dias} ${dias === 1 ? 'dia' : 'dias'} · ${exp.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
          </span>
          <Link
            href="/plans"
            className={`ml-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black transition-colors ${
              urgente ? 'border-amber-300 hover:bg-amber-100' : 'border-emerald-300 hover:bg-emerald-100'
            }`}
          >
            Ver planos
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-medium">
        <span>⏰</span>
        <span>Acesso promocional encerrou em {exp.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <Link href="/plans" className="ml-1 rounded-full border border-slate-300 px-2.5 py-0.5 text-[10px] font-black text-slate-600 hover:bg-slate-100 transition-colors">
          Resgatar plano
        </Link>
      </div>
    );
  })() : null;

  const landingLinks = [
    { href: '/#problema', label: 'Problema' },
    { href: '/#como-funciona', label: 'Como funciona' },
    { href: '/#economia', label: 'Economia' },
    { href: '/#planos', label: 'Planos' },
  ];

  return (
    <div className="sticky top-0 z-50 print:hidden">
      {/* ⚠️ A BARRA DE PROMOÇÃO MORA AQUI DENTRO, E NÃO NO `layout.tsx`.
          Ela ficava como irmã DEPOIS deste bloco, com `z-index: auto` — e este
          bloco é `sticky z-50`. Medido no navegador: com 34px de rolagem, a
          barra ia para o topo 39 enquanto o cabeçalho ocupa 0–73, ou seja,
          sobravam 14 dos 48px dela. A promoção virava uma tira colorida
          espremida embaixo do menu, e sumia de vez logo depois.
          Aumentar só o `z-index` deixaria a barra passar POR CIMA do cabeçalho
          enquanto rola embora, que é pior. Aqui ela fica presa junto com o
          menu — sempre visível, sempre na frente do conteúdo — que é o mesmo
          tratamento que o `promoStrip` logo abaixo já recebia.
          O pop-up dela não é afetado: ele vai para `document.body` por portal,
          então não fica preso neste contexto de empilhamento. */}
      <PromoBanner />
      {promoStrip}
    <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-sm transition-all">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
        
        {/* LOGÓTIPO */}
        <Link href="/" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
          <Image src="/logo-bawzi.png" alt="Bawzi" width={120} height={40} className="h-10 w-auto" priority unoptimized />
        </Link>

        {/* NAVEGAÇÃO CENTRAL */}
        <nav className="hidden md:flex items-center gap-5 lg:gap-7 mr-4 lg:mr-8">
          {isLanding && !token ? (
            landingLinks.map(({ href, label }) => (
              <Link key={href} href={href} className="text-sm font-bold pb-1 border-b-2 border-transparent text-slate-500 transition-all hover:text-slate-900">
                {label}
              </Link>
            ))
          ) : (
            <>
              <Link href="/workspace" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/workspace' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
                Área de trabalho
              </Link>
              {token && (
                <Link href="/gestao" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/gestao' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
                  Gestão
                </Link>
              )}
              <Link href="/plans" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/plans' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
                Planos
              </Link>
              <Link href="/docs" className={`text-sm font-bold pb-1 border-b-2 transition-all ${pathname === '/docs' ? 'text-emerald-700 border-emerald-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}>
                Documentação
              </Link>
            </>
          )}
        </nav>

        {/* ÁREA DO UTILIZADOR */}
        <div>
          {token ? (
            <div className="flex items-center gap-3 sm:gap-4">
              {isGlobalAdmin && (
                <Link
                  href="/admin"
                  className={`inline-flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-black uppercase tracking-wider transition-colors ${
                    pathname === '/admin'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  Admin
                </Link>
              )}
              
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(prev => !prev)}
                  aria-label="Menu do usuário"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className={`h-10 w-10 overflow-hidden rounded-full bg-gradient-to-tr from-emerald-600 to-sky-600 flex items-center justify-center text-white font-bold shadow-md transition-all duration-200 ${menuOpen ? 'ring-4 ring-emerald-500/20' : 'hover:ring-4 hover:ring-emerald-500/15'}`}
                >
                  {userData?.avatar_url
                    ? <img src={`${API_URL}${userData.avatar_url}`} alt="" className="h-full w-full object-cover" />
                    : (userData?.name ? userData.name.charAt(0).toUpperCase() : 'B')}
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    aria-label="Conta"
                    className="absolute right-0 z-50 mt-2 w-64 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    {/* ⚠️ A SETINHA SAIU, E NÃO É PERDA. Havia um `rotate-45`
                        aqui que nunca apareceu: ele nascia 11px ACIMA do topo
                        do cartão, e o cartão é `overflow-hidden` — ou seja,
                        recortado. Medido no navegador. Reintroduzi-la exigiria
                        tirá-la do recorte e depois costurar a borda para o
                        triângulo não cortar a linha do cartão; o menu fica
                        ancorado no avatar de qualquer forma, a 8px dele. */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {/* Cabeçalho: quem é, e em que plano.
                          ⚠️ O AVATAR SE REPETE AQUI DE PROPÓSITO. O menu abre
                          longe do canto e o cartão é branco sobre branco; sem
                          a mesma inicial em cima, ele não parece a continuação
                          do que foi clicado. */}
                      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-emerald-600 to-sky-600 text-sm font-black text-white">
                          {userData?.avatar_url
                            ? <img src={`${API_URL}${userData.avatar_url}`} alt="" className="h-full w-full object-cover" />
                            : (userData?.name ? userData.name.charAt(0).toUpperCase() : 'B')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black leading-tight text-slate-900">
                            {userData?.name || 'Usuário Bawzi'}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-slate-500">
                            {userData?.email || ''}
                          </p>
                        </div>
                      </div>

                      {/* ⚠️ NOME + NÍVEL, não só o nível. "NÍVEL 4" sozinho
                          obriga a pessoa a decorar a tabela de planos para
                          saber o que tem. O nome é o que ela reconhece da
                          página de preços e da fatura — o número fica como
                          referência secundária. */}
                      {/* ⚠️ ESTE BLOCO É ESTADO, NÃO AÇÃO — e por isso não é
                          link. Ele já foi um `<Link href="/plans">`, e aí o
                          menu tinha DOIS caminhos para a mesma página a 60px de
                          distância: este e a linha "Planos e créditos" logo
                          abaixo. Dois alvos para o mesmo destino fazem a pessoa
                          parar para escolher entre coisas idênticas. A ação
                          fica na linha rotulada, que é onde ela é procurada. */}
                      <div className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                        <span className="min-w-0">
                          <span className="block text-[9px] font-black uppercase tracking-widest text-emerald-600/70">
                            Seu plano
                          </span>
                          <span className="block truncate text-xs font-black text-emerald-900">
                            {tierNames[Number(userTier)] || `Nível ${userTier}`}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                          N{userTier}
                        </span>
                      </div>

                      <div className="border-t border-slate-100 py-1">
                        <Link
                          href="/profile"
                          role="menuitem"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          <UserRound size={16} className="shrink-0 text-slate-400" />
                          Meu perfil
                        </Link>
                        {/* Equipe leva à mesma tela, na secção certa — é onde
                            moram convites, vagas e permissões, e não havia
                            nenhum caminho para lá a partir do cabeçalho. */}
                        <Link
                          href="/profile#sec-equipe"
                          role="menuitem"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Users size={16} className="shrink-0 text-slate-400" />
                          Equipe
                        </Link>
                        <Link
                          href="/plans"
                          role="menuitem"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Sparkles size={16} className="shrink-0 text-slate-400" />
                          Planos e créditos
                        </Link>
                        {/* ⚠️ ADMIN TAMBÉM AQUI. Fora, ele é um botão que só
                            aparece de `sm:` para cima; no celular o acesso
                            simplesmente não existia. */}
                        {isGlobalAdmin && (
                          <Link
                            href="/admin"
                            role="menuitem"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:hidden"
                          >
                            <ShieldCheck size={16} className="shrink-0 text-slate-400" />
                            Admin
                          </Link>
                        )}
                      </div>

                      <div className="border-t border-slate-100 py-1">
                        <button
                          onClick={handleLogout}
                          role="menuitem"
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                        >
                          <LogOut size={16} className="shrink-0" />
                          Sair
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isLanding && (
                <Link href="/#planos" className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50 sm:inline-flex md:hidden">
                  Planos
                </Link>
              )}
	             <button
	              onClick={() => {
	                // Só /workspace abre o modal inline (AnalysisApp está montado lá).
	                // Em / (landing) e em qualquer outra página → navega para /login.
	                if (pathname === '/workspace') {
	                  window.dispatchEvent(new CustomEvent('bawzi_open_auth', { detail: 'login' }));
	                } else {
	                  router.push('/login');
	                }
	              }}
	              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm transition-colors shadow-sm"
	            >
	              Entrar
	            </button>
            </div>
          )}
        </div>
      </div>
    </header>
    </div>
  );
}
