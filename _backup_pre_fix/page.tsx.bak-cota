'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HeroFeed from '@/components/HeroFeed';
import HeroCards from '@/components/HeroCards';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Calculator,
  Check,
  Zap,
  Clock3,
  ClipboardCheck,
  Gauge,
  LineChart,
  PiggyBank,
  Radar,
  Scale,
  SearchCheck,
  UsersRound,
} from 'lucide-react';
import { getAuthToken } from '@/lib/apiClient';

const DECISION_SIGNALS = [
  {
    Icon: SearchCheck,
    title: 'Radar PNCP',
    desc: 'Busca oportunidades abertas em fonte oficial e traz o edital para análise sem trabalho manual.',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  {
    Icon: BadgeCheck,
    title: 'Match CNAE',
    desc: 'Compara o objeto do edital com o perfil da empresa antes de gastar tempo em proposta ruim.',
    tone: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  {
    Icon: Scale,
    title: 'Risco jurídico',
    desc: 'Aponta exigências, documentos, prazos, penalidades e pontos que podem eliminar a empresa.',
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  {
    Icon: LineChart,
    title: 'Preço e margem',
    desc: 'Estima pressão competitiva, deságio provável e limite de lance para preservar margem.',
    tone: 'bg-teal-50 text-teal-700 border-teal-100',
  },
  {
    Icon: UsersRound,
    title: 'Concorrência',
    desc: 'Organiza sinais de fornecedores recorrentes, histórico semelhante e ameaças na disputa.',
    tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  },
  {
    Icon: BellRing,
    title: 'Alertas e renovações',
    desc: 'Monitora novas oportunidades e contratos a vencer para sua equipe chegar antes.',
    tone: 'bg-rose-50 text-rose-700 border-rose-100',
  },
];

const FLOW = [
  {
    n: '01',
    title: 'Encontre',
    desc: 'Pesquise no PNCP por segmento, UF, cidade, órgão ou palavra-chave e salve oportunidades relevantes.',
    Icon: Radar,
  },
  {
    n: '02',
    title: 'Decida',
    desc: 'A Bawzi cruza edital, CNAE, documentação, preço, concorrência e riscos para gerar um Go/No-Go claro.',
    Icon: Gauge,
  },
  {
    n: '03',
    title: 'Aja com segurança',
    desc: 'Se for Go, você já sabe o que fazer: checklist, preço-limite e pontos jurídicos vêm junto da decisão — sem chute.',
    Icon: ClipboardCheck,
  },
];


const PLANOS = [
  {
    nome: 'Essencial',
    publico: 'Para começar com controle',
    preco: 'R$ 79',
    nivel: 'Nível 2',
    cor: 'from-sky-500 to-indigo-500',
    destaque: false,
    itens: ['Radar PNCP e central de decisões', 'Plano de ação pós-decisão', 'Perfil da empresa por CNPJ/UF', 'Priorização entre editais'],
  },
  {
    nome: 'Profissional',
    publico: 'Para operação recorrente',
    preco: 'R$ 197',
    nivel: 'Nível 3',
    cor: 'from-emerald-500 to-teal-500',
    destaque: true,
    itens: ['Oportunidades com fit CNAE', 'Monitor inteligente PNCP', 'Fôlego financeiro da disputa', '4 agentes de IA em paralelo'],
  },
  {
    nome: 'Avançado',
    publico: 'Para times de alta disputa',
    preco: 'R$ 497',
    nivel: 'Nível 4',
    cor: 'from-amber-500 to-orange-500',
    destaque: false,
    itens: ['Pipeline de renovações', 'War Room de concorrentes', 'Simulador tático de preços', 'Suporte prioritário'],
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  // Mesmo limite exibido na seção de degustação lá embaixo — buscado aqui
  // também para o selo do hero mostrar o número real sem duplicar estado.
  const [heroGuestLimit, setHeroGuestLimit] = useState(1);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      router.replace('/workspace');
    } else {
      setChecked(true);
    }
  }, [router]);

  useEffect(() => {
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
    fetch(`${API_URL}/api/tiers/guest-limit`)
      .then(r => r.json())
      .then(data => { if (data?.daily_limit > 0) setHeroGuestLimit(data.daily_limit); })
      .catch(() => {});
  }, []);

  if (!checked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-900 overflow-x-hidden">
      <section className="relative overflow-hidden bg-slate-950">
        {/* Dark grid */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:42px_42px]" />
        {/* Glow blobs */}
        <div className="pointer-events-none absolute -right-56 -top-56 h-[750px] w-[750px] rounded-full bg-emerald-500/[0.07] blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-[450px] w-[600px] rounded-full bg-indigo-500/[0.05] blur-[110px]" />

        <div className="relative mx-auto max-w-[1280px] px-6 pt-12 pb-14 md:pt-16 md:pb-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12 xl:gap-16">

            {/* Left — headline + CTAs */}
            <div className="shrink-0 lg:w-[440px] xl:w-[480px] lg:pt-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Decisão Go/No-Go para licitações
              </div>

              <h1 className="mt-5 text-4xl font-black leading-[1.04] tracking-tight text-white md:text-5xl lg:text-[52px]">
                Saiba em minutos se vale disputar uma licitação.
              </h1>

              <p className="mt-4 max-w-[420px] text-base font-medium leading-7 text-slate-400 md:text-lg">
                A Bawzi cruza edital, CNAE, riscos jurídicos, margem provável e concorrência para entregar um veredito claro, com próximos passos para sua equipe agir.
              </p>

              <p className="mt-3 max-w-[420px] text-[13px] font-bold leading-6 text-slate-500">
                Não fazemos a gestão do processo. Agimos na decisão — participar ou não — antes da execução.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/login" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 text-sm font-black text-white shadow-[0_20px_50px_-16px_rgba(16,185,129,0.7)] transition-all hover:bg-emerald-400">
                  Testar com um edital <ArrowRight size={17} />
                </Link>
                <Link href="/plans" className="inline-flex h-14 items-center justify-center rounded-2xl bg-white px-7 text-sm font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-100">
                  Ver planos e preços
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                {['PNCP oficial', 'Sem cartão', 'Veredito em minutos'].map((label) => (
                  <span key={label} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
                    <Check size={12} className="text-emerald-500" />
                    {label}
                  </span>
                ))}
              </div>

              {/* Mobile — live feed */}
              <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.1] bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] lg:hidden">
                <div className="p-4">
                  <HeroFeed />
                </div>
              </div>

              <a
                href="#degustacao"
                className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-emerald-500/[0.14] lg:hidden"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-black uppercase tracking-widest text-emerald-300">
                    {heroGuestLimit} análise{heroGuestLimit !== 1 ? 's' : ''} grátis por dia · sem cadastro
                  </span>
                  <span className="mt-0.5 block text-[12.5px] font-semibold leading-snug text-emerald-200/70">
                    Cole um trecho do edital e veja o veredito Go/No-Go em segundos ↓
                  </span>
                </span>
              </a>
            </div>

            {/* Right — card stack com análise */}
            <div className="hidden lg:flex flex-1 min-w-0 flex-col justify-center pt-6">
              {/* Label ao vivo */}
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Editais abertos agora — PNCP
                </span>
              </div>
              <HeroCards />

              <a
                href="#degustacao"
                className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-emerald-500/[0.14]"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-black uppercase tracking-widest text-emerald-300">
                    {heroGuestLimit} análise{heroGuestLimit !== 1 ? 's' : ''} grátis por dia · sem cadastro
                  </span>
                  <span className="mt-0.5 block text-[12.5px] font-semibold leading-snug text-emerald-200/70">
                    Cole um trecho do edital e veja o veredito Go/No-Go em segundos ↓
                  </span>
                </span>
              </a>
            </div>

          </div>
        </div>
      </section>

      <TrustBar />

      {/* Simulação — análise de exemplo */}
      <section className="bg-white pb-16 pt-14 md:pb-20 md:pt-16">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="mb-10 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Do edital ao veredito</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Veja uma análise em ação.
            </h2>
            <p className="mt-3 mx-auto max-w-xl text-base font-medium leading-8 text-slate-500">
              Em minutos, 4 agentes cruzam edital, CNAE, risco jurídico e concorrência — e entregam um veredito com próximos passos.
            </p>
          </div>
          <div className="mx-auto max-w-5xl">
            <OutputCard />
          </div>
        </div>
      </section>

      <section id="problema" className="scroll-mt-24 bg-white py-16 md:py-20">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-6 lg:grid-cols-[0.78fr_1fr] lg:items-center">
          <div className="max-w-xl">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">O problema que a Bawzi resolve</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              A disputa errada custa mais que uma assinatura.
            </h2>
            <p className="mt-4 text-base font-medium leading-8 text-slate-600">
              Licitação boa não é só edital aberto. Ela precisa fazer sentido para o CNAE, para a capacidade operacional, para a margem e para o risco que sua empresa aceita assumir.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                ['Risco', 'antes da leitura longa'],
                ['Fit', 'antes da proposta'],
                ['Preço', 'antes do lance'],
              ].map(([value, label]) => (
                <div key={value} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-sm font-black text-slate-950">{value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Triagem operacional</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">O que normalmente passa despercebido</h3>
                </div>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                  antes do protocolo
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ['Edital incompatível', 'Evita gastar equipe em objeto sem aderência ao negócio.', 'bg-sky-50 text-sky-700 border-sky-100'],
                ['Documento faltando', 'Mostra impedimentos e condições antes do protocolo.', 'bg-amber-50 text-amber-700 border-amber-100'],
                ['Margem pressionada', 'Ajuda a enxergar limite de preço e deságio provável.', 'bg-emerald-50 text-emerald-700 border-emerald-100'],
                ['Concorrente recorrente', 'Revela contexto competitivo antes da decisão.', 'bg-indigo-50 text-indigo-700 border-indigo-100'],
              ].map(([title, desc, tone]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl border ${tone}`}>
                    <AlertTriangle size={17} />
                  </div>
                  <h3 className="text-sm font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 bg-white py-16 md:py-20">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Como a plataforma trabalha</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Encontre. Decida com precisão.</h2>
            <p className="mt-4 text-base font-medium leading-8 text-slate-600">
              O Radar é a entrada. A decisão é o produto — e ela vem pronta para agir, porque errar a escolha custa muito mais do que qualquer assinatura.
            </p>
            </div>
            <Link href="/login" className="inline-flex h-12 w-fit items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-black text-slate-900 transition-all hover:bg-slate-100">
              Testar fluxo <ArrowRight size={16} />
            </Link>
          </div>

          <div className="relative grid gap-4 md:grid-cols-3">
            <div className="absolute left-[16%] right-[16%] top-12 hidden h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent md:block" />
            {FLOW.map(({ n, title, desc, Icon }) => (
              <div key={title} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-4xl font-black leading-none text-slate-100">{n}</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm">
                    <Icon size={21} />
                  </div>
                </div>
                <h3 className="text-xl font-black text-slate-950">{title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="veredito" className="scroll-mt-24 bg-slate-50 py-16 md:py-20">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600">O que entra no veredito</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Mais que análise de texto. Uma decisão operacional.</h2>
              <p className="mt-4 text-base font-medium leading-8 text-slate-600">
                Cada módulo alimenta uma pergunta simples: sua empresa deve entrar, condicionar a entrada ou abandonar agora?
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Go', 'Go condicionado', 'No-Go'].map((label) => (
                <span key={label} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm">
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DECISION_SIGNALS.map(({ Icon, title, desc, tone }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border ${tone}`}>
                  <Icon size={21} />
                </div>
                <h3 className="text-base font-black text-slate-950">{title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <TasterSection />

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Antes do balcão</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Você não perde no balcão por falta de agilidade.
              </h2>
              <p className="mt-1 text-3xl font-black tracking-tight text-slate-400 md:text-4xl">
                Perde por ter entrado na licitação errada.
              </p>
              <p className="mt-6 text-base font-medium leading-8 text-slate-600">
                Robôs trabalham nos lances. Nós trabalhamos antes: analisamos preços praticados, histórico de vencedores e nível de concorrência para que cada decisão sua seja baseada em dados reais — não em estimativa.
              </p>
              <Link href="/login" className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white shadow-md transition-all hover:bg-emerald-500">
                Analisar um edital agora <ArrowRight size={16} />
              </Link>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl bg-slate-950 p-6 text-white">
                <p className="text-2xl font-black leading-snug">🏆 A vitória começa antes do balcão.</p>
                <p className="mt-3 text-base font-medium leading-7 text-slate-300">
                  Preços reais. Concorrência real. Decisão certa.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Preços', 'praticados no mercado'],
                  ['Vencedores', 'histórico real PNCP'],
                  ['Concorrência', 'nível por segmento'],
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-black text-slate-950">{title}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-16 text-white md:py-20">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-6 lg:grid-cols-[0.88fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Quem usa a Bawzi</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Cada área recebe o que precisa para agir.</h2>
            <p className="mt-4 text-base font-medium leading-8 text-slate-300">
              A decisão é uma, mas o que cada papel precisa para agir é diferente. A Bawzi entrega tudo junto, sem precisar distribuir manualmente.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ['Decisão', 'Go/No-Go com justificativa'],
                ['Evidências', 'riscos, fit e preço'],
                ['Ação recomendada', 'checklist e próximos passos'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <p className="text-sm font-black text-white">{title}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Diretoria', 'Veredito claro, nível de confiança e justificativa para aprovar ou recusar sem precisar ler o edital inteiro.'],
              ['Licitações', 'Checklist de habilitação, documentos críticos, prazos e ações prioritárias antes do protocolo.'],
              ['Jurídico', 'Cláusulas sensíveis, penalidades elevadas, pontos de esclarecimento e riscos contratuais mapeados.'],
              ['Financeiro', 'Preço limite estimado, margem provável, deságio esperado e pressão competitiva do histórico PNCP.'],
            ].map(([title, desc], index) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 transition-colors hover:bg-white/[0.09]">
                <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-[10px] font-black text-emerald-200">
                  {index + 1}
                </span>
                <h3 className="text-sm font-black text-white">{title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SavingsCalculator />

      <section className="scroll-mt-24 bg-white py-16 md:py-20" id="vantagens">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Por que a Bawzi</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              A diferença entre dados reais e achismo.
            </h2>
            <p className="mt-4 mx-auto max-w-2xl text-base font-medium leading-8 text-slate-500">
              Qualquer planilha organiza editais. A Bawzi decide junto com você — com dados do PNCP oficial, histórico de vencedores e inteligência de preço baseada em contratos fechados.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                numero: '01',
                titulo: 'Preço vem de contrato, não de estimativa',
                desc: 'O valor estimado pelo órgão raramente é o valor de mercado. A Bawzi usa preços de contratos fechados no PNCP para calcular deságio real e limite de lance.',
                cor: 'text-emerald-600',
                borda: 'border-emerald-100',
                bg: 'bg-emerald-50',
              },
              {
                numero: '02',
                titulo: 'Go/No-Go em minutos, não em dias',
                desc: '4 agentes de IA analisam CNAE, jurídico, preço e concorrência em paralelo. O veredito chega antes de você terminar de ler o edital.',
                cor: 'text-sky-600',
                borda: 'border-sky-100',
                bg: 'bg-sky-50',
              },
              {
                numero: '03',
                titulo: 'Você sabe quem compete antes de entrar',
                desc: 'Histórico de fornecedores recorrentes, perfil de vencedores e nível de concorrência por segmento — tudo antes de mobilizar equipe e proposta.',
                cor: 'text-indigo-600',
                borda: 'border-indigo-100',
                bg: 'bg-indigo-50',
              },
              {
                numero: '04',
                titulo: 'Risco jurídico antes do protocolo',
                desc: 'Cláusulas eliminatórias, documentos críticos e penalidades mapeadas antes de qualquer comprometimento. Sua equipe jurídica atua onde importa.',
                cor: 'text-amber-600',
                borda: 'border-amber-100',
                bg: 'bg-amber-50',
              },
              {
                numero: '05',
                titulo: 'Decisão com rastreabilidade',
                desc: 'Cada Go ou No-Go vem com justificativa documentada, score de confiança e próximos passos — para a diretoria aprovar sem precisar ler o edital.',
                cor: 'text-teal-600',
                borda: 'border-teal-100',
                bg: 'bg-teal-50',
              },
              {
                numero: '06',
                titulo: 'Conectado ao PNCP em tempo real',
                desc: 'Editais, contratos e resultados direto da API oficial do governo. Sem raspar HTML, sem dado defasado, sem intermediário.',
                cor: 'text-rose-600',
                borda: 'border-rose-100',
                bg: 'bg-rose-50',
              },
            ].map(({ numero, titulo, desc, cor, borda, bg }) => (
              <div key={numero} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className={`mb-5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${borda} ${bg}`}>
                  <span className={`text-xs font-black ${cor}`}>{numero}</span>
                </div>
                <h3 className="text-base font-black leading-snug text-slate-950">{titulo}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-500">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Resumindo</p>
                <p className="mt-2 text-xl font-black leading-snug text-slate-950 md:text-2xl">
                  Robôs trabalham nos lances. Nós trabalhamos antes — para que você entre apenas nas disputas que vale ganhar.
                </p>
              </div>
              <Link href="/login" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white shadow-md transition-all hover:bg-emerald-500">
                Testar grátis <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="scroll-mt-24 bg-white py-16 md:py-20" id="planos">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-10 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Planos e preços</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Comece pequeno. Escale quando disputar em volume.</h2>
            <p className="mt-4 text-slate-500 font-medium">Teste grátis, sem cartão. Depois escolha o plano pelo ritmo da sua operação.</p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
            {PLANOS.map(({ nome, publico, preco, nivel, cor, destaque, itens }) => (
              <div key={nome} className={`relative flex flex-col overflow-hidden rounded-[1.5rem] border bg-white p-5 ${destaque ? 'border-emerald-300 shadow-xl shadow-emerald-100 ring-2 ring-emerald-300' : 'border-slate-200 shadow-sm'}`}>
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${cor}`} />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{nivel}</span>
                  {destaque && (
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">Mais escolhido</span>
                  )}
                </div>
                <div className={`mb-5 h-10 w-10 rounded-2xl bg-gradient-to-br ${cor}`} />
                <h3 className="text-xl font-black text-slate-950">{nome}</h3>
                <p className="mt-1 text-sm font-bold text-slate-500">{publico}</p>
                <div className="my-5">
                  <span className="text-3xl font-black text-slate-950">{preco}</span>
                  <span className="text-sm font-medium text-slate-400">/mês</span>
                </div>
                <ul className="mb-6 flex-1 space-y-3">
                  {itens.map(item => (
                    <li key={item} className="flex gap-2 text-sm font-medium leading-6 text-slate-600">
                      <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className={`w-full rounded-xl py-3 text-center text-sm font-black transition-all ${destaque ? `bg-gradient-to-r ${cor} text-white shadow-md` : 'border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'}`}>
                  Escolher {nome}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-400">
            Precisa comparar todos os limites?{' '}
            <Link href="/plans" className="font-bold text-emerald-600 hover:underline">Ver tabela completa</Link>
          </p>
        </div>
      </section>

      <FAQ />

      <section className="bg-white px-6 pb-16 md:pb-20">
        <div className="mx-auto grid max-w-[1180px] gap-8 rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-200 md:p-10 lg:grid-cols-[1fr_0.78fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Próximo edital</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Leve um edital real para a Bawzi decidir.</h2>
            <p className="mt-4 max-w-2xl text-base font-medium leading-8 text-slate-300">
              Em vez de ler tudo primeiro, descubra se a oportunidade merece sua equipe, seu preço e seu risco.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 text-sm font-black text-white shadow-lg shadow-emerald-950/25 transition-all hover:bg-emerald-400">
                Criar conta gratuitamente <ArrowRight size={17} />
              </Link>
              <Link href="/#como-funciona" className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-7 text-sm font-bold text-white transition-all hover:bg-white/15">
                Rever como funciona
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Antes de mobilizar proposta</p>
            <div className="mt-4 space-y-3">
              {[
                'Confirme se o objeto conversa com seu CNAE.',
                'Veja documentos eliminatórios e cláusulas sensíveis.',
                'Defina margem mínima antes de entrar no pregão.',
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                  <p className="text-sm font-semibold leading-6 text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Seção de degustação gratuita ────────────────────────────────────────────

type SemaforoSinal = 'verde' | 'amarelo' | 'vermelho' | 'cinza';
interface TasterResult {
  title?: string;
  score?: number;
  classification?: string;
  decisao?: {
    veredito?: string;
    resumo_decisao?: string;
    motivos?: string[];
  };
  semaforo?: {
    tecnica?:      SemaforoSinal;
    financeira?:   SemaforoSinal;
    juridica?:     SemaforoSinal;
    documentacao?: SemaforoSinal;
  };
  vantagens?: string[];
  desvantagens?: string[];
}

const SEMAFORO_LABELS: Record<string, string> = {
  tecnica:      'Técnica',
  financeira:   'Financeira',
  juridica:     'Jurídica',
  documentacao: 'Docs',
};

const SEMAFORO_COLOR: Record<SemaforoSinal | string, string> = {
  verde:    'bg-emerald-500',
  amarelo:  'bg-amber-400',
  vermelho: 'bg-red-500',
  cinza:    'bg-slate-400',
};

const LOADING_MSGS = [
  'Lendo o edital…',
  'Extraindo pontos críticos…',
  'Avaliando viabilidade…',
  'Calculando score…',
  'Preparando veredito…',
];

function TasterSection() {
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState(LOADING_MSGS[0]);
  const [result, setResult]   = useState<TasterResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [guestLimit, setGuestLimit] = useState(1);

  useEffect(() => {
    fetch(`${API_URL}/api/tiers/guest-limit`)
      .then(r => r.json())
      .then(data => { if (data?.daily_limit > 0) setGuestLimit(data.daily_limit); })
      .catch(() => {});
  }, [API_URL]);

  const [exhausted, setExhausted] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem('bawzi_guest_quota');
      if (!raw) return false;
      const { date, used } = JSON.parse(raw);
      return date === new Date().toISOString().split('T')[0] && used > 0;
    } catch { return false; }
  });

  const handleAnalyze = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 80) {
      setError('Cole um trecho maior (mínimo 80 caracteres).');
      return;
    }
    setError(null);
    setLoading(true);
    // Rotaciona mensagens de loading
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % LOADING_MSGS.length;
      setLoadMsg(LOADING_MSGS[idx]);
    }, 4500);

    try {
      const form = new FormData();
      form.append('raw_text', trimmed.slice(0, 10000));
      form.append('uf', 'BR');
      form.append('provider', 'openai');

      const res = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err?.detail || {};
        if (detail?.codigo === 'GUEST_DAILY_LIMIT') {
          const today = new Date().toISOString().split('T')[0];
          localStorage.setItem('bawzi_guest_quota', JSON.stringify({ date: today, used: 1 }));
          setExhausted(true);
          return;
        }
        throw new Error(detail?.mensagem || `Erro ${res.status}`);
      }
      const data: TasterResult = await res.json();
      setResult(data);
      // Marca uso no localStorage
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('bawzi_guest_quota', JSON.stringify({ date: today, used: 1 }));
      setExhausted(true);
    } catch (e: unknown) {
      setError((e as Error).message || 'Erro ao analisar. Tente novamente.');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  // Helpers de veredito
  const rawVeredito  = (result?.decisao?.veredito || result?.classification || '').toUpperCase();
  const isGo         = rawVeredito.startsWith('GO') && !rawVeredito.includes('NO');
  const isNoGo       = rawVeredito.includes('NO') || rawVeredito.includes('NÃO');
  const vBg          = isNoGo ? 'bg-red-500' : isGo && rawVeredito === 'GO' ? 'bg-emerald-500' : 'bg-amber-500';
  const vLabel       = isNoGo ? 'NO-GO' : rawVeredito === 'GO' ? 'GO' : rawVeredito || 'GO CONDICIONADO';
  const score        = result?.score ?? 0;

  const motivos: string[] = result?.decisao?.motivos?.length
    ? result.decisao.motivos
    : result?.vantagens?.length
      ? result.vantagens
      : [];

  // ── Estado: resultado ──
  if (result) {
    return (
      <section id="degustacao" className="scroll-mt-24 py-16 md:py-20" style={{ background: '#0f172a' }}>
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-4">Resultado da sua análise gratuita</p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
              <span className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-base font-black text-white ${vBg}`}>
                {vLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-black" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                Score {score}/100
              </span>
            </div>
            {result.title && (
              <p className="text-slate-300 font-semibold text-sm max-w-2xl mx-auto">{result.title}</p>
            )}
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            {/* Semáforo */}
            {result.semaforo && (
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(result.semaforo) as [string, SemaforoSinal][]).map(([key, val]) => (
                  <div key={key} className="rounded-2xl px-3 py-3 text-center" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                    <div className={`w-3 h-3 rounded-full mx-auto mb-1.5 ${SEMAFORO_COLOR[val] || 'bg-slate-500'}`} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {SEMAFORO_LABELS[key] || key}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Motivos — 2 visíveis, restante desfocado */}
            {motivos.length > 0 && (
              <div className="space-y-2">
                {motivos.slice(0, 2).map((m, i) => (
                  <div key={i} className="rounded-xl px-4 py-3 text-sm text-slate-200 font-medium leading-relaxed" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                    {m}
                  </div>
                ))}
                {motivos.length > 2 && (
                  <div className="relative">
                    <div className="rounded-xl px-4 py-3 text-sm text-slate-200 font-medium leading-relaxed blur-sm select-none pointer-events-none" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                      {motivos[2]}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: '#0f172a', border: '1px solid #475569' }}>
                        🔒 Mais na conta gratuita
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
              <Link
                href="/login"
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg transition-all"
              >
                Ver análise completa <ArrowRight size={15} />
              </Link>
              <Link
                href="/plans"
                className="w-full sm:w-auto flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-sm transition-all text-slate-300 hover:text-white"
                style={{ background: '#1e293b', border: '1px solid #475569' }}
              >
                Ver planos
              </Link>
            </div>
            <p className="text-center text-slate-500 text-xs">Crie uma conta gratuita — sem cartão · 5 análises/mês</p>
          </div>
        </div>
      </section>
    );
  }

  // ── Estado: cota esgotada ──
  if (exhausted) {
    return (
      <section id="degustacao" className="scroll-mt-24 py-16 md:py-20" style={{ background: '#0f172a' }}>
        <div className="mx-auto max-w-xl px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-5" style={{ background: '#052e16', border: '1px solid #166534' }}>
            Degustação gratuita
          </span>
          <h2 className="text-3xl font-black text-white mb-3">Análise gratuita já usada hoje.</h2>
          <p className="text-slate-400 font-medium mb-8 leading-relaxed">
            Crie uma conta gratuita e ganhe <strong className="text-white">5 análises por mês</strong> — sem cartão, sem prazo de expiração.
          </p>
          <Link href="/login" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-8 text-sm font-black text-white shadow-lg hover:bg-emerald-500 transition-all">
            Criar conta gratuita <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-slate-500 text-xs">Sua análise gratuita volta amanhã.</p>
        </div>
      </section>
    );
  }

  // ── Estado: formulário ──
  const canSubmit = !loading && text.trim().length >= 80;
  return (
    <section id="degustacao" className="scroll-mt-24 py-16 md:py-20" style={{ background: '#0f172a' }}>
      <div className="mx-auto max-w-[1180px] px-6">

        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-5" style={{ background: '#052e16', border: '1px solid #166534' }}>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {guestLimit} análise{guestLimit !== 1 ? 's' : ''} gratuita{guestLimit !== 1 ? 's' : ''} por dia · sem cadastro
          </span>
          <h2 className="text-3xl font-black text-white md:text-4xl mb-3">Experimente agora.</h2>
          <p className="text-slate-400 font-medium max-w-lg mx-auto leading-relaxed">
            Cole um trecho do edital e veja o veredito Go/No-Go em segundos — sem criar conta.
          </p>
        </div>

        {/* Card branco */}
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 shadow-2xl">

          {/* Textarea */}
          <div className="relative mb-4">
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setError(null); }}
              maxLength={10000}
              rows={7}
              className="w-full rounded-2xl border-2 p-4 text-slate-800 placeholder:text-slate-400 font-medium text-sm resize-none transition-all leading-relaxed focus:outline-none"
              style={{
                background: '#f8fafc',
                borderColor: text.length > 0 ? '#059669' : '#e2e8f0',
              }}
              placeholder="Cole aqui o texto do edital, objeto da contratação ou termo de referência..."
            />
            <div className="absolute bottom-3 right-3 text-[10px] font-bold rounded-lg px-2 py-1" style={{ background: '#f1f5f9', color: '#94a3b8' }}>
              {text.length.toLocaleString('pt-BR')}&nbsp;/&nbsp;10.000
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
              {error}
            </div>
          )}

          {/* Botão principal */}
          <button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl text-white font-black text-sm transition-all"
            style={{
              background: canSubmit ? '#059669' : '#d1fae5',
              color: canSubmit ? '#ffffff' : '#6ee7b7',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 4px 16px rgba(5,150,105,0.35)' : 'none',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 rounded-full animate-spin shrink-0" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                {loadMsg}
              </>
            ) : (
              <>
                <Zap size={16} />
                Analisar gratuitamente
                <ArrowRight size={14} className="ml-0.5" />
              </>
            )}
          </button>

          {/* Link secundário */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">Análise com IA · sem salvar histórico</p>
            <Link
              href="/login"
              className="flex items-center gap-1 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors whitespace-nowrap"
            >
              Criar conta grátis <ArrowRight size={13} />
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    { Icon: SearchCheck, text: 'Conectado ao PNCP oficial' },
    { Icon: BadgeCheck, text: 'Edital nunca sai do seu ambiente' },
    { Icon: Clock3, text: 'Análise em minutos' },
    { Icon: Check, text: 'Cancele quando quiser' },
  ];
  return (
    <div className="border-b border-slate-100 bg-white">
      <div className="mx-auto grid max-w-[1180px] gap-2 px-6 py-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ Icon, text }) => (
          <span key={text} className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-500">
            <Icon size={14} className="text-emerald-600" />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

function FAQ() {
  const items = [
    {
      q: 'A análise substitui um advogado ou especialista em licitações?',
      a: 'Não. A Bawzi faz triagem — mapeia riscos, aponta cláusulas sensíveis e organiza documentos críticos. Decisões contratuais complexas ainda exigem revisão jurídica especializada. O objetivo é eliminar o trabalho repetitivo e dar à sua equipe um ponto de partida qualificado.',
    },
    {
      q: 'Preciso enviar documentos internos ou sigilosos?',
      a: 'Não. A análise é feita sobre o edital público e os dados do PNCP, que são fontes abertas do governo federal. Nenhum documento interno da empresa precisa ser enviado.',
    },
    {
      q: 'Funciona com qualquer modalidade de licitação?',
      a: 'Funciona melhor com pregão eletrônico e RDC, que são os mais estruturados no PNCP. Também analisa dispensa, concorrência e outros formatos quando o edital é enviado diretamente.',
    },
    {
      q: 'Os dados do PNCP estão sempre atualizados?',
      a: 'Sim. O Radar PNCP consulta a API oficial do governo em tempo real. Editais abertos, prazos e histórico de resultados refletem o estado atual do portal.',
    },
    {
      q: 'Posso cancelar a assinatura a qualquer momento?',
      a: 'Sim, sem fidelidade e sem multa. O cancelamento pode ser feito pelo painel de conta com efeito imediato no ciclo de faturamento.',
    },
    {
      q: 'O que acontece com os meus editais e análises se eu cancelar?',
      a: 'Você mantém acesso de leitura ao histórico de análises por 30 dias após o cancelamento, com opção de exportar em PDF.',
    },
  ];

  return (
    <section className="bg-slate-50 py-16 md:py-20">
      <div className="mx-auto max-w-[780px] px-6">
        <div className="mb-10 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Dúvidas frequentes</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Perguntas antes de assinar.</h2>
        </div>
        <div className="divide-y divide-slate-200 rounded-[1.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm">
          {items.map(({ q, a }) => (
            <details key={q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-sm font-black text-slate-900">{q}</span>
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 p-1 text-slate-400 transition-transform group-open:rotate-45">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-500">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function SavingsCalculator() {
  const [editais, setEditais] = useState(12);
  const [horas, setHoras] = useState(3);
  const [custoHora, setCustoHora] = useState(85);

  const horasMes = editais * horas;
  const economiaMes = horasMes * custoHora;
  const economiaAno = economiaMes * 12;
  const analysesPerDay = Math.max(1, Math.ceil(editais / 22));

  const setClampedValue = (
    setter: (value: number) => void,
    min: number,
    max: number,
  ) => (value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setter(Math.max(min, Math.min(max, Math.round(numeric))));
  };

  return (
    <section id="economia" className="scroll-mt-24 bg-slate-50 py-16 md:py-20">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-6 lg:grid-cols-[0.82fr_1fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-700 shadow-sm">
            <Calculator size={14} />
            Calculadora de economia
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            Coloque preço no tempo que sua equipe perde lendo edital errado.
          </h2>
          <p className="mt-4 text-base font-medium leading-8 text-slate-600">
            A conta é simples: se cada edital consome horas de análise e boa parte vira No-Go, a Bawzi precisa se pagar evitando leitura improdutiva e acelerando a decisão.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              [Clock3, `${horasMes}h`, 'potencialmente poupadas/mês'],
              [PiggyBank, formatCurrency(economiaMes), 'valor mensal estimado'],
              [LineChart, formatCurrency(economiaAno), 'impacto anual estimado'],
            ].map(([Icon, value, label]) => {
              const StatIcon = Icon as typeof Clock3;
              return (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <StatIcon size={17} className="mb-3 text-emerald-600" />
                  <p className="text-xl font-black text-slate-950">{String(value)}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{String(label)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 md:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Simulação rápida</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Simule com a rotina do seu time</h3>
            </div>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              {analysesPerDay}/dia
            </span>
          </div>

          <div className="space-y-5">
            <CalculatorField
              label="Editais analisados por mês"
              value={editais}
              min={1}
              max={80}
              suffix="editais"
              onChange={setClampedValue(setEditais, 1, 80)}
            />
            <CalculatorField
              label="Horas gastas por edital"
              value={horas}
              min={1}
              max={12}
              suffix="horas"
              onChange={setClampedValue(setHoras, 1, 12)}
            />
            <CalculatorField
              label="Custo médio por hora da equipe"
              value={custoHora}
              min={30}
              max={300}
              suffix="R$/h"
              onChange={setClampedValue(setCustoHora, 30, 300)}
            />
          </div>

          <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Resultado estimado</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-3xl font-black">{formatCurrency(economiaMes)}</p>
                <p className="mt-1 text-xs font-medium text-slate-400">de tempo operacional por mês</p>
              </div>
              <div>
                <p className="text-3xl font-black">{horasMes}h</p>
                <p className="mt-1 text-xs font-medium text-slate-400">liberadas para proposta, preço e follow-up</p>
              </div>
            </div>
            <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-semibold leading-6 text-slate-300">
              Com {editais} editais por mês, cada hora poupada vira folga para preço, documentação e follow-up. A estimativa ajuda a comparar assinatura com custo operacional.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalculatorField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-end justify-between gap-4">
        <span className="text-sm font-black text-slate-800">{label}</span>
        <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
          {value} {suffix}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_92px] sm:items-center">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-2 w-full cursor-pointer accent-emerald-600"
        />
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-black text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        />
      </div>
    </label>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}


function OutputCard({ className = '' }: { className?: string }) {
  const agents = [
    { Icon: BadgeCheck, label: 'CNAE', value: 'Match parcial', tone: 'text-sky-600', bar: 'w-[68%]' },
    { Icon: Scale, label: 'Jurídico', value: '2 cláusulas críticas', tone: 'text-amber-600', bar: 'w-[56%]' },
    { Icon: Calculator, label: 'Preço', value: 'Margem pressionada', tone: 'text-rose-600', bar: 'w-[62%]' },
    { Icon: UsersRound, label: 'Concorrência', value: '3 recorrentes', tone: 'text-indigo-600', bar: 'w-[74%]' },
  ];
  const nextSteps = ['Validar documentos', 'Definir preço mínimo', 'Revisar antes do lance'];

  return (
    <div className={`w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-left shadow-[0_34px_90px_-48px_rgba(15,23,42,0.45)] ${className}`}>
      <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden border-b border-slate-100 bg-slate-50 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-400" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Simulação de análise</p>
                <h3 className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">Do edital ao veredito</h3>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                PNCP oficial
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <SearchCheck size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Edital detectado</p>
                  <p className="mt-1 text-base font-black leading-snug text-slate-950">Pregão eletrônico · serviços terceirizados</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Município de São Paulo · análise fictícia para demonstração</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {agents.map(({ Icon, label, value, tone, bar }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-black text-slate-800">
                      <Icon size={15} className={tone} />
                      {label}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">{value}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`${bar} h-full rounded-full bg-emerald-400`} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {['4 agentes', '84% confiança', 'minutos'].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <p className="text-sm font-black text-slate-950">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 text-slate-950 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Veredito · exemplo fictício</p>
              <h4 className="mt-2 text-3xl font-black leading-none text-slate-950">Go condicionado</h4>
              <p className="mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-500">
                Vale avançar, desde que a equipe confirme documentação e proteja a margem antes de propor.
              </p>
            </div>
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={{ background: 'conic-gradient(#10b981 0 68%, #e2e8f0 68% 100%)' }}>
              <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <span className="text-2xl font-black leading-none text-slate-950">68</span>
                <span className="text-[8px] font-black uppercase text-slate-400">score</span>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Por que condicionado?</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
              O objeto tem aderência parcial ao CNAE e a disputa pode ser interessante, mas há risco jurídico e pressão de preço.
            </p>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Próximos passos</p>
            <div className="mt-3 grid gap-2">
              {nextSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-500 shadow-sm">{index + 1}</span>
                  <span className="text-sm font-black text-slate-700">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              ['CNAE', 'parcial'],
              ['Preço', 'atenção'],
              ['Jurídico', 'validar'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-1 text-xs font-black text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
