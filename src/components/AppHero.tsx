'use client';

/**
 * AppHero.tsx
 * Secção hero do painel de análise Bawzi.
 *
 * - Versão autenticada: nav bar com tier + dots + passos + proof bar
 * - Versão anônima: headline de marketing + animação de 4 agentes IA
 */

import React from 'react';
import {
  ScanSearch, ChevronRight, Crown, Sparkles, MapPin,
  BookOpen, Scale, Cpu,
  Banknote, Shield, Lightbulb, UploadCloud, CheckCircle2,
} from 'lucide-react';

interface AppHeroProps {
  token: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: any | null;
  isCheckingAuth: boolean;
  currentTier: number;
  onGoToWorkspace: () => void;
  onGoToHistory: () => void;
}

export default function AppHero({
  token,
  userData,
  isCheckingAuth,
  currentTier,
  onGoToWorkspace,
  onGoToHistory,
}: AppHeroProps) {

  // ─── Versão autenticada ────────────────────────────────────────────────────
  if (token && userData && !isCheckingAuth) {
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

    const focusRadar = () => {
      onGoToWorkspace();
      setTimeout(() => {
        const target = document.getElementById('radar-pncp-section');
        if (target) {
          const y = target.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: 'smooth' });
          const input = target.querySelector<HTMLInputElement>('input[type="text"], input:not([type])');
          input?.focus();
        }
      }, 80);
    };

    const focusAnalise = () => {
      onGoToWorkspace();
      setTimeout(() => {
        const target = document.getElementById('area-submissao');
        if (target) {
          const y = target.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: 'smooth' });
          target.querySelector<HTMLTextAreaElement>('textarea')?.focus();
        }
      }, 80);
    };

    const guideSteps = [
      {
        Icon: ScanSearch,
        step: '1',
        title: 'Busque no Radar PNCP',
        desc: 'Encontre oportunidades por palavra-chave, UF, órgão ou segmento.',
      },
      {
        Icon: UploadCloud,
        step: '2',
        title: 'Envie ou cole o edital',
        desc: 'Use PDF, texto extraído ou uma oportunidade escolhida no radar.',
      },
      {
        Icon: CheckCircle2,
        step: '3',
        title: 'Receba um veredito claro',
        desc: 'Veja score, riscos, pontos críticos e próximos passos em linguagem direta.',
      },
    ];

    const focusAreas = [
      {
        Icon: Scale,
        title: 'Jurídico',
        desc: 'Exigências, riscos fiscais, habilitação e pontos que podem eliminar sua empresa.',
        shell: 'border-amber-100 bg-amber-50',
        icon: 'text-amber-600',
      },
      {
        Icon: CheckCircle2,
        title: 'Viabilidade',
        desc: 'Aderência ao perfil da empresa, complexidade, prazo e capacidade de execução.',
        shell: 'border-emerald-100 bg-emerald-50',
        icon: 'text-emerald-600',
      },
      {
        Icon: ScanSearch,
        title: 'Concorrência',
        desc: 'Sinais de fornecedores recorrentes, histórico semelhante e contexto competitivo.',
        shell: 'border-sky-100 bg-sky-50',
        icon: 'text-sky-600',
      },
      {
        Icon: Cpu,
        title: 'Decisão',
        desc: 'Score Go/No-Go, semáforo de risco e recomendação objetiva.',
        shell: 'border-sky-100 bg-sky-50',
        icon: 'text-sky-600',
      },
    ];

    const proofItems = [
      'Score de viabilidade da oportunidade',
      'Sinais de risco jurídico, fiscal e documental',
      'Radar de concorrentes e fornecedores recorrentes',
      'Estimativa de pressão por preço e deságio',
      'Alertas de oportunidades compatíveis com seu perfil',
    ];

    return (
      <div className="w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_-36px_rgba(15,23,42,0.32)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-white via-emerald-50/35 to-sky-50/45 text-slate-900">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />

          <div className="relative z-10 flex flex-col gap-3 border-b border-slate-200/70 bg-white/70 px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-[13px] font-black text-emerald-800 shadow-sm select-none">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black leading-none text-slate-950">Olá, {firstName}</p>
                <p className="mt-1 hidden text-[11px] leading-none text-slate-500 sm:block">Sessão pronta para encontrar oportunidades</p>
              </div>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${tierClass}`}>
                {currentTier >= 4 ? <Crown size={12} className="text-amber-600" /> : <Sparkles size={12} />}
                {tierLabel}
              </div>
              {userData?.company?.uf && (
                <span className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:flex">
                  <MapPin size={11} /> {userData.company.uf}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-45"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                PNCP ativo
              </div>
              <button
                onClick={onGoToHistory}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:text-slate-950"
              >
                <BookOpen size={13} /> Histórico
              </button>
            </div>
          </div>

          <div className="relative z-10 grid gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.72fr)] lg:items-start lg:px-10 lg:py-12">
            <div className="min-w-0 max-w-2xl pt-2">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/85 px-3.5 py-2 shadow-sm">
                <Sparkles size={13} className="text-emerald-600" />
                <span className="text-[11px] font-black uppercase text-slate-500">
                  Inteligência para licitações públicas
                </span>
              </div>

              <h2 className="text-4xl font-black leading-[1.04] text-slate-950 sm:text-5xl lg:text-[3.2rem]">
                Analise editais.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600">
                  Decida se vale participar.
                </span>
              </h2>

              <p className="mt-5 text-[15px] font-medium leading-7 text-slate-600">
                Comece pelo Radar PNCP ou envie um PDF. A Bawzi transforma editais e oportunidades públicas em uma análise clara de viabilidade, riscos, concorrência e próximos passos.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={focusRadar}
                  className="inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white shadow-[0_18px_35px_-18px_rgba(5,150,105,0.65)] transition-all hover:bg-emerald-500 active:scale-[0.98] sm:px-6"
                >
                  <ScanSearch size={17} />
                  Buscar editais no Radar PNCP
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={focusAnalise}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700 active:scale-[0.98]"
                >
                  <UploadCloud size={15} className="text-slate-400" />
                  Enviar PDF ou colar edital
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <aside className="relative">
              <div className="rounded-[1.6rem] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.36)] backdrop-blur-md sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase text-emerald-600">Por onde começar</p>
                    <h3 className="mt-1 text-lg font-black text-slate-950">Um caminho simples para decidir</h3>
                  </div>
                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                    pronto
                  </span>
                </div>

                <div className="space-y-4">
                  {guideSteps.map(({ Icon, step, title, desc }) => (
                    <div key={title} className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-[12px] font-black text-emerald-700">
                        {step}
                      </div>
                      <div className="min-w-0 pb-4 last:pb-0">
                        <div className="flex items-center gap-2">
                          <Icon size={15} className="text-slate-500" />
                          <p className="text-sm font-black text-slate-900">{title}</p>
                        </div>
                        <p className="mt-1 text-[12px] font-medium leading-relaxed text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          <div className="relative z-10 border-t border-emerald-100/70 bg-white/70 px-5 py-5 backdrop-blur-sm sm:px-8 lg:px-10">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase text-emerald-700">Mapa de decisão</p>
                    <h3 className="text-base font-black text-slate-950">A análise separa o edital em quatro perguntas</h3>
                  </div>
                  <span className="w-max rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">
                    visão única
                  </span>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {focusAreas.map(({ Icon, title, desc, shell, icon }) => (
                    <div key={title} className={`rounded-xl border p-3 ${shell}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <Icon size={15} className={icon} />
                        <p className="text-sm font-black text-slate-900">{title}</p>
                      </div>
                      <p className="text-[12px] font-medium leading-relaxed text-slate-600">{desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-400">Sinais monitorados</p>
                    <h3 className="text-sm font-black text-slate-900">A Bawzi observa por você</h3>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                    <CheckCircle2 size={17} />
                  </div>
                </div>
                <div className="grid gap-2">
                  {proofItems.map((label) => (
                    <div key={label} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span className="text-[12px] font-semibold leading-relaxed text-slate-600">{label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Versão anônima ────────────────────────────────────────────────────────
  return (
    <>
      <div className="xl:w-2/3 bg-gradient-to-br from-white via-emerald-50/35 to-sky-50/45 rounded-[2rem] border border-slate-100 p-8 md:p-12 flex flex-col lg:flex-row items-center gap-10 relative overflow-hidden">

        <div className="flex-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm mb-6 w-max">
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
