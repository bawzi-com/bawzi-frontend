'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Ícones SVG inline ────────────────────────────────────────────────────────
const IconRadar = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="2" /><circle cx="12" cy="12" r="6" strokeDasharray="4 2" /><circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
  </svg>
);
const IconBrain = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);
const IconShield = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const IconBell = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const IconBanknote = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2" y="7" width="20" height="14" rx="2" /><circle cx="12" cy="14" r="3" /><path strokeLinecap="round" d="M6 10h.01M18 10h.01" />
  </svg>
);
const IconTarget = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconArrow = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

// ─── Dados ────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <IconRadar />, bg: 'bg-emerald-50', texto: 'text-emerald-700', titulo: 'Radar PNCP', desc: 'Encontre editais abertos em todo o Brasil em segundos. Filtre por segmento, UF ou cidade antes de qualquer concorrente.' },
  { icon: <IconBrain />, bg: 'bg-violet-50', texto: 'text-violet-700', titulo: 'Análise IA — Go/No-Go', desc: 'Score de viabilidade, alertas jurídicos, estimativa de deságio e parecer estratégico por 4 agentes de IA especializados.' },
  { icon: <IconShield />, bg: 'bg-sky-50', texto: 'text-sky-700', titulo: 'War Room Concorrentes', desc: 'Capital social, sócios, histórico de vitórias e margem de lucro estimada dos seus principais rivais em cada licitação.' },
  { icon: <IconBell />, bg: 'bg-amber-50', texto: 'text-amber-700', titulo: 'Alertas de Renovação', desc: 'Monitora contratos a vencer nos próximos 90 dias e avisa por e-mail antes que a janela de oportunidade se feche.' },
  { icon: <IconBanknote />, bg: 'bg-teal-50', texto: 'text-teal-700', titulo: 'Capital de Giro', desc: 'Pré-qualificação de crédito em 4 instituições parceiras com base nos dados do CNPJ e valor do contrato almejado.' },
  { icon: <IconTarget />, bg: 'bg-rose-50', texto: 'text-rose-700', titulo: 'Para Você (CNAE)', desc: 'Feed personalizado de oportunidades compatíveis com o CNAE da sua empresa, atualizado diariamente.' },
];

const STEPS = [
  { n: '01', titulo: 'Busque no Radar', desc: 'Pesquise por segmento, órgão ou palavra-chave e encontre editais ativos em tempo real via PNCP.' },
  { n: '02', titulo: 'Analise com IA', desc: 'Cole o edital ou deixe a Bawzi extraí-lo automaticamente. 4 agentes entregam score, riscos e estratégia em segundos.' },
  { n: '03', titulo: 'Decida e Execute', desc: 'Go ou No-Go com fundamentação. Se for Go, acesse o War Room, o capital de giro e o checklist de habilitação.' },
];

const PLANOS = [
  { nome: 'Essencial', preco: 'R$ 97', cor: 'from-sky-500 to-indigo-500', destaque: false, itens: ['Radar PNCP', 'Análise IA — 100/mês', '1 empresa monitorada', 'Histórico de análises'] },
  { nome: 'Pro', preco: 'R$ 197', cor: 'from-emerald-500 to-teal-500', destaque: true, itens: ['Tudo do Essencial', 'Análise IA — 300/mês', '2 empresas monitoradas', 'War Room Concorrentes', 'Alertas de Renovação'] },
  { nome: 'Elite', preco: 'R$ 397', cor: 'from-amber-500 to-orange-500', destaque: false, itens: ['Tudo do Pro', 'Análise IA ilimitada', '3 empresas', 'Capital de Giro IA', 'Suporte prioritário'] },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('bawzi_token');
    if (token) {
      router.replace('/workspace');
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-900 overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-emerald-500/6 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-teal-500/6 blur-3xl" />
        </div>

        <div className="relative max-w-[1200px] mx-auto px-6 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-widest mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Inteligência Artificial para Licitações
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight mb-6">
            Analise editais em segundos.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              Ganhe as licitações certas.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
            4 agentes de IA especializados analisam editais do PNCP e entregam score Go/No-Go, riscos jurídicos, estratégia de precificação e checklist de habilitação — em segundos.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/30 text-sm">
              Começar gratuitamente <IconArrow />
            </Link>
            <Link href="/plans" className="flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/15 text-white border border-white/10 font-bold rounded-2xl transition-all text-sm">
              Ver planos e preços
            </Link>
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16">
            {[
              { valor: '50.000+', label: 'Análises geradas' },
              { valor: '4 Agentes', label: 'IA especializados' },
              { valor: 'PNCP', label: 'Integração oficial' },
              { valor: '100%', label: 'Digital e seguro' },
            ].map(({ valor, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-black text-white">{valor}</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ── */}
      <section className="bg-white py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3">Plataforma completa</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Tudo que você precisa para vencer licitações</h2>
            <p className="mt-4 text-slate-500 font-medium max-w-xl mx-auto">Da busca ao contrato, a Bawzi centraliza inteligência de mercado, análise jurídica e financiamento em um único lugar.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, bg, texto, titulo, desc }) => (
              <div key={titulo} className="rounded-2xl border border-slate-100 p-6 hover:shadow-md transition-shadow">
                <div className={`w-11 h-11 rounded-xl ${bg} ${texto} flex items-center justify-center mb-4`}>{icon}</div>
                <h3 className="font-black text-slate-900 mb-2">{titulo}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3">Simples e rápido</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Da busca à decisão em 3 passos</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map(({ n, titulo, desc }) => (
              <div key={n}>
                <div className="text-7xl font-black text-slate-100 leading-none mb-4 select-none">{n}</div>
                <h3 className="text-xl font-black text-slate-900 mb-3">{titulo}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PREÇOS ── */}
      <section className="bg-white py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3">Planos e preços</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Escolha o seu nível</h2>
            <p className="mt-4 text-slate-500 font-medium">Comece grátis com 5 análises. Cancele quando quiser.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PLANOS.map(({ nome, preco, cor, destaque, itens }) => (
              <div key={nome} className={`rounded-3xl border p-6 flex flex-col ${destaque ? 'border-emerald-300 shadow-xl shadow-emerald-100 ring-2 ring-emerald-300' : 'border-slate-200'}`}>
                {destaque && (
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 self-start mb-3">Mais popular</div>
                )}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cor} mb-4`} />
                <h3 className="text-lg font-black text-slate-900">{nome}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-black text-slate-900">{preco}</span>
                  <span className="text-slate-400 font-medium text-sm">/mês</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {itens.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="text-emerald-500 flex-shrink-0"><IconCheck /></span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className={`w-full py-3 text-center rounded-xl font-black text-sm transition-all ${destaque ? `bg-gradient-to-r ${cor} text-white shadow-md` : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200'}`}>
                  Começar agora
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-sm text-slate-400">
            Precisa de mais detalhes?{' '}
            <Link href="/plans" className="text-emerald-600 font-bold hover:underline">Ver todos os planos →</Link>
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="bg-gradient-to-br from-slate-950 to-emerald-950 text-white py-24">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Pronto para ganhar mais contratos?</h2>
          <p className="text-slate-400 font-medium mb-10 text-lg">Junte-se a centenas de empresas que já usam a Bawzi para tomar decisões mais rápidas e inteligentes.</p>
          <Link href="/login" className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/30">
            Criar conta gratuitamente <IconArrow />
          </Link>
        </div>
      </section>

    </div>
  );
}
