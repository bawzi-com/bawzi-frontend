'use client';

/**
 * AppHero.tsx
 * Secção hero do painel de análise Bawzi.
 *
 * - Versão autenticada: UMA LINHA de cumprimento (nome · nível · UF)
 * - Versão anônima: headline de marketing + animação de 4 agentes IA
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ O QUE SAIU DAQUI, E POR QUÊ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. O SELO "PNCP ATIVO" ERA FALSO. Verde, com ponto pulsando, escrito à mão
 *    neste arquivo — não lia rota nenhuma. Duzentos pixels abaixo, o
 *    `PncpStatusBadge` consulta `/api/pncp/status` a cada dois minutos e
 *    mostrava "PNCP OFFLINE" em vermelho. Os dois na mesma tela, ao mesmo
 *    tempo, sobre o mesmo fato, com respostas opostas — e o falso ganhava por
 *    estar mais acima. Um indicador que não está ligado em nada é pior que
 *    indicador nenhum: ele treina a pessoa a ignorar TAMBÉM o que é verdade.
 *
 * 2. OS TRÊS BOTÕES ERAM NAVEGAÇÃO PARA O QUE JÁ ESTAVA NA TELA. "Radar PNCP"
 *    dava `scrollIntoView` na seção logo abaixo dele; "Enviar edital", na
 *    seguinte. Numa página de duas seções, os dois rolavam para coisas já
 *    visíveis. E "Histórico" abria exatamente a aba que a barra lateral chama
 *    de "Decisões" — mesmo destino, dois nomes, ambos na tela ao mesmo tempo.
 *
 * 3. ERA UM CARTÃO DENTRO DE UM CARTÃO. O `analysis-app` já envolve o hero num
 *    painel branco com borda, sombra e `rounded-[2.5rem]`; aqui dentro havia
 *    OUTRO painel branco com borda e `rounded-[2rem]`. Seis camadas de padding
 *    aninhadas para exibir um cumprimento. Agora esta metade devolve só a
 *    linha, e quem decide a moldura é quem monta a página.
 */

import React from 'react';
import {
  ScanSearch, Crown, Sparkles, MapPin, Scale,
  Banknote, Shield, CheckCircle2,
} from 'lucide-react';

interface AppHeroProps {
  token: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: any | null;
  isCheckingAuth: boolean;
  currentTier: number;
}

export default function AppHero({
  token,
  userData,
  isCheckingAuth,
  currentTier,
}: AppHeroProps) {

  // ─── Enquanto a sessão está sendo verificada ───────────────────────────────
  /* ⚠️ ESTE TERCEIRO ESTADO FALTAVA, E A FALTA DELE MOSTRAVA MARKETING A QUEM
   *  JÁ É CLIENTE.
   *
   *  Só havia dois caminhos: "logado" e "anônimo". Como `isCheckingAuth` começa
   *  em `true` e `token`/`userData` começam vazios (têm de começar — o valor
   *  inicial precisa bater com o que o servidor renderizou, senão a hidratação
   *  quebra), a primeira renderização caía SEMPRE no anônimo. Ou seja: quem
   *  abria a área de trabalho já logado via a peça de marketing inteira —
   *  "Modelos líderes em orquestração", a animação dos 4 agentes e o laudo de
   *  exemplo, 380px — e só depois ela sumia dando lugar a "Olá, Marcelo".
   *
   *  E não era um piscar de um quadro: a sessão vive em cookie HttpOnly e se
   *  restaura por `renewToken()`, que é ida e volta de rede. O anúncio ficava
   *  na tela o tempo todo dessa requisição, em toda abertura da /workspace.
   *
   *  ⚠️ ISTO NÃO CUSTA NADA À LANDING. Este componente só é montado em
   *  `/workspace` (a home de marketing é `src/app/page.tsx`, outro caminho).
   *  Aqui, quem não tem sessão é exceção — não é o público do anúncio.
   *
   *  O esqueleto tem a altura da linha autenticada, que é o desfecho provável:
   *  assim a página não pula quando a resposta chega. */
  if (isCheckingAuth) {
    return (
      <div
        className="flex w-full items-center gap-2.5"
        aria-busy="true"
        aria-label="Verificando sua sessão"
      >
        <span className="h-5 w-44 animate-pulse rounded-md bg-slate-200/70" />
        <span className="h-4 w-20 animate-pulse rounded-full bg-slate-100" />
      </div>
    );
  }

  // ─── Versão autenticada ────────────────────────────────────────────────────
  if (token && userData) {
    const displayName = userData.name || userData.nome || 'Estrategista';
    const firstName = displayName.split(' ')[0] || 'Estrategista';
    const tierLabel = currentTier >= 4
      ? 'Avançado'
      : currentTier >= 3
        ? 'Profissional'
        : currentTier >= 2
          ? 'Essencial'
          : 'Gratuito';
    const tierClass = currentTier >= 4
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : currentTier >= 3
        ? 'border-sky-200 bg-sky-50 text-sky-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800';

    return (
      <div className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <h1 className="text-lg font-black leading-none tracking-tight text-slate-950 md:text-xl">
          Olá, {firstName}
        </h1>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tierClass}`}>
          {currentTier >= 4 ? <Crown size={10} className="text-amber-600" /> : <Sparkles size={10} />}
          {tierLabel}
        </span>
        {userData?.company?.uf && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
            <MapPin size={9} />{userData.company.uf}
          </span>
        )}
      </div>
    );
  }

  // ─── Versão anônima ────────────────────────────────────────────────────────
  return (
    <>
      <div className="xl:w-2/3 bg-gradient-to-br from-white via-emerald-50/35 to-sky-50/45 rounded-[2rem] border border-slate-100 p-5 sm:p-8 md:p-12 flex flex-col lg:flex-row items-center gap-10 relative overflow-hidden">

        <div className="flex-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Modelos líderes em orquestração</span>
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-5xl font-black text-slate-900 leading-[1.1] mb-5 tracking-tight">
            As maiores IAs trabalhando juntas <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-sky-600">
              para decidir se vale disputar.
            </span>
          </h2>
          <p className="text-slate-500 text-base md:text-lg leading-relaxed font-medium mb-8 max-w-md">
            A Bawzi combina modelos líderes de IA com regras de licitação, PNCP, CNAE, risco jurídico, preço, mercado e compliance para entregar um veredito defensável: participar, condicionar ou não participar.
          </p>
        </div>

        <div className="flex-1 w-full relative h-[380px] hidden lg:flex items-center justify-center z-10">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-32 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-col items-center justify-center gap-2 z-20">
            <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
            <div className="w-16 h-1 bg-slate-200 rounded-full"></div>
            <div className="w-10 h-1 bg-slate-200 rounded-full"></div>
            <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]" style={{ animation: 'scan-laser 2.5s ease-in-out infinite' }}></div>
          </div>

          <svg className="absolute left-24 w-[calc(100%-11rem)] h-full z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path d="M 0 50 C 30 50, 50 10, 100 10" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
            <path d="M 0 50 C 30 50, 50 10, 100 10" fill="none" stroke="#059669" strokeWidth="2" className="path-routing" />
            <path d="M 0 50 C 35 50, 55 35, 100 35" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
            <path d="M 0 50 C 35 50, 55 35, 100 35" fill="none" stroke="#0284c7" strokeWidth="2" className="path-routing" />
            <path d="M 0 50 C 35 50, 55 65, 100 65" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
            <path d="M 0 50 C 35 50, 55 65, 100 65" fill="none" stroke="#10b981" strokeWidth="2" className="path-routing" />
            <path d="M 0 50 C 30 50, 50 90, 100 90" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
            <path d="M 0 50 C 30 50, 50 90, 100 90" fill="none" stroke="#f59e0b" strokeWidth="2" className="path-routing" />
          </svg>

          {[
            { top: '0%',  color: 'emerald', Icon: Scale,     label: 'Jurídico',    signal: 'Cláusulas e impugnação', delay: '' },
            { top: '26%', color: 'sky',     Icon: ScanSearch, label: 'Auditoria',   signal: 'Evidências e lacunas',   delay: '0.2s' },
            { top: '52%', color: 'emerald', Icon: Banknote,  label: 'Financeiro',  signal: 'Margem e deságio',       delay: '0.5s' },
            { top: '78%', color: 'amber',   Icon: Shield,    label: 'Compliance',  signal: 'Habilitação e CNAE',     delay: '1s' },
          ].map(({ top, color, Icon, label, signal, delay }) => (
            <div
              key={label}
              className="absolute right-0 flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm z-20"
              style={{ top, animation: `float-agent 4.5s infinite ${delay}` }}
            >
              <div className={`w-8 h-8 rounded-lg bg-${color}-50 flex items-center justify-center border border-${color}-100 shrink-0`}>
                <Icon size={14} className={`text-${color}-500`} />
              </div>
              <div>
                <span className={`block text-[9px] font-black text-${color}-500 uppercase tracking-widest leading-none mb-1`}>{label}</span>
                <span className="block text-xs font-bold text-slate-700 leading-none">{signal}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column — executive decision brief (anonymous view) */}
      <div className="xl:w-1/3">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_-35px_rgba(15,23,42,0.45)]">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-400" />

          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white">
                <Sparkles size={11} className="text-emerald-300" />
                Laudo multiagente
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                Go condicionado
              </span>
            </div>

            <h3 className="mt-4 text-xl font-black leading-tight tracking-tight text-slate-950">
              Entrar só depois de sanar 3 pontos críticos.
            </h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              Quatro agentes cruzam edital, PNCP, preço, jurídico e compliance para entregar uma decisão defensável.
            </p>

            <div className="mt-5">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Confiança da decisão</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Base documental + sinais de mercado</p>
                </div>
                <p className="text-3xl font-black leading-none text-emerald-700">98%</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[98%] rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {[
              {
                Icon: ScanSearch,
                tone: 'text-amber-700 bg-amber-50 ring-amber-100',
                badge: 'Auditoria',
                title: 'Risco jurídico',
                body: 'Item 9.2 exige condição potencialmente restritiva.',
                action: 'Validar impugnação antes da proposta',
              },
              {
                Icon: Banknote,
                tone: 'text-sky-700 bg-sky-50 ring-sky-100',
                badge: 'Financeiro',
                title: 'Condição financeira',
                body: 'Reajuste sem índice-base claro no edital.',
                action: 'Simular margem e pedir esclarecimento',
              },
              {
                Icon: Scale,
                tone: 'text-rose-700 bg-rose-50 ring-rose-100',
                badge: 'Jurídico',
                title: 'Risco contratual',
                body: 'Multa rescisória unilateral elevada no Item 7.4.',
                action: 'Revisão jurídica antes do envio',
              },
            ].map(({ Icon, tone, badge, title, body, action }) => (
              <div key={title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70">
                <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ring-1 ${tone}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{badge}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Ação sugerida</span>
                  </div>
                  <h5 className="text-sm font-black leading-tight text-slate-950">{title}</h5>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{body}</p>
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] font-black uppercase leading-snug tracking-wide text-emerald-700">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                    {action}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
