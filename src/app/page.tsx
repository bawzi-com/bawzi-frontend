'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Calculator,
  Check,
  Clock3,
  ClipboardCheck,
  FileSearch,
  Gauge,
  LineChart,
  PiggyBank,
  Radar,
  Scale,
  SearchCheck,
  UsersRound,
} from 'lucide-react';

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
    title: 'Execute',
    desc: 'Se for Go, siga checklist, próximos passos, preço limite, pontos jurídicos e plano de ataque.',
    Icon: ClipboardCheck,
  },
];

const ANALYSIS_STEPS = [
  { Icon: FileSearch, title: 'Edital capturado', desc: 'PNCP, anexos e prazos' },
  { Icon: SearchCheck, title: 'Objeto lido', desc: 'CNAE, escopo e aderência' },
  { Icon: Scale, title: 'Riscos mapeados', desc: 'Habilitação, multas e cláusulas' },
  { Icon: Calculator, title: 'Preço simulado', desc: 'Margem, deságio e limite' },
  { Icon: Gauge, title: 'Decisão gerada', desc: 'Go/No-Go com próximos passos' },
];

const ANALYSIS_SIGNALS = [
  { label: 'CNAE', value: 'Match parcial', fill: '0.72', tone: 'bg-sky-400' },
  { label: 'Jurídico', value: 'Atenção', fill: '0.58', tone: 'bg-amber-400' },
  { label: 'Preço', value: 'Margem pressionada', fill: '0.64', tone: 'bg-emerald-400' },
];

const ANALYSIS_LOGS = [
  'Lendo objeto e itens do edital',
  'Comparando CNAE com escopo contratado',
  'Extraindo exigências eliminatórias',
  'Estimando pressão competitiva',
  'Montando recomendação executiva',
];

const PLANOS = [
  {
    nome: 'Essencial',
    publico: 'Para começar com controle',
    preco: 'R$ 79',
    nivel: 'Nível 2',
    cor: 'from-sky-500 to-indigo-500',
    destaque: false,
    itens: ['Radar PNCP e central de decisões', 'Gestão de execução', 'Perfil da empresa por CNPJ/UF', 'Priorização entre editais'],
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
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 pointer-events-none opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative mx-auto flex max-w-[1180px] flex-col items-center px-6 pb-12 pt-14 text-center md:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Decisão Go/No-Go para licitações
          </div>

          <h1 className="mt-5 max-w-5xl text-4xl font-black leading-[1.04] tracking-tight md:text-5xl lg:text-6xl">
            Saiba em minutos se vale disputar uma licitação.
          </h1>

          <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-slate-300 md:text-lg">
            A Bawzi cruza edital, CNAE, riscos jurídicos, margem provável e concorrência para entregar um veredito claro, com próximos passos para sua equipe agir.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 text-sm font-black text-white shadow-[0_18px_35px_-18px_rgba(16,185,129,0.85)] transition-all hover:bg-emerald-400">
              Testar com um edital <ArrowRight size={17} />
            </Link>
            <Link href="/plans" className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-7 text-sm font-bold text-white transition-all hover:bg-white/15">
              Ver planos e preços
            </Link>
          </div>

          <DecisionPreview />

          <div className="mt-5 grid w-full max-w-4xl gap-3 text-left sm:grid-cols-3">
            {[
              ['2-4h', 'economizadas por edital analisado'],
              ['CNAE + PNCP', 'match antes da proposta'],
              ['Go/No-Go', 'decisão explicável para diretoria'],
            ].map(([value, label]) => (
              <div key={value} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
              </div>
            ))}
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

      <SavingsCalculator />

      <section id="como-funciona" className="scroll-mt-24 bg-white py-16 md:py-20">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Como a plataforma trabalha</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Encontre, decida e execute.</h2>
            <p className="mt-4 text-base font-medium leading-8 text-slate-600">
              O Radar é a entrada. A decisão é o produto. A execução vem com checklist, riscos, preço e próximos passos.
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

      <section className="bg-slate-950 py-20 text-white md:py-24">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-6 lg:grid-cols-[0.9fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Para diretoria, licitações e financeiro</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Uma resposta que vira ação.</h2>
            <p className="mt-4 text-base font-medium leading-8 text-slate-300">
              A Bawzi não para no resumo do edital. Ela organiza os sinais em decisão, explica por que chegou nela e indica o que fazer em seguida.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Diretoria', 'Go/No-Go, confiança e justificativa executiva.'],
              ['Licitações', 'Checklist de habilitação, prazos e documentos críticos.'],
              ['Jurídico', 'Cláusulas sensíveis, riscos e pontos de esclarecimento.'],
              ['Financeiro', 'Preço limite, margem provável e capital de giro.'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <h3 className="text-sm font-black text-white">{title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 md:py-24" id="planos">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-14 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Planos e preços</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Comece pequeno. Escale quando disputar em volume.</h2>
            <p className="mt-4 text-slate-500 font-medium">Teste grátis, sem cartão. Depois escolha o plano pelo ritmo da sua operação.</p>
          </div>
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
            {PLANOS.map(({ nome, publico, preco, nivel, cor, destaque, itens }) => (
              <div key={nome} className={`flex flex-col rounded-2xl border p-6 ${destaque ? 'border-emerald-300 shadow-xl shadow-emerald-100 ring-2 ring-emerald-300' : 'border-slate-200 shadow-sm'}`}>
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
                  Começar agora
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

      <section className="bg-emerald-600 py-20 text-white">
        <div className="mx-auto max-w-[820px] px-6 text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">Leve um edital real para a Bawzi decidir.</h2>
          <p className="mt-4 text-base font-medium leading-8 text-emerald-50">
            Em vez de ler tudo primeiro, descubra se a oportunidade merece sua equipe, seu preço e seu risco.
          </p>
          <Link href="/login" className="mt-9 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-8 text-sm font-black text-white shadow-lg shadow-emerald-950/25 transition-all hover:bg-slate-900">
            Criar conta gratuitamente <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
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

function DecisionPreview() {
  return (
    <div className="mt-8 w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/15 bg-white text-left shadow-2xl shadow-emerald-950/30 md:mt-10">
      <style>{`
        @keyframes bawzi-scan {
          0% { transform: translateY(-70%); opacity: 0; }
          14% { opacity: 1; }
          72% { opacity: 1; }
          100% { transform: translateY(310%); opacity: 0; }
        }
        @keyframes bawzi-flow {
          0%, 100% { transform: translateX(-16%); opacity: .2; }
          45%, 70% { opacity: 1; }
          100% { transform: translateX(112%); }
        }
        @keyframes bawzi-fill {
          0% { transform: scaleX(.12); }
          48%, 78% { transform: scaleX(var(--fill)); }
          100% { transform: scaleX(.12); }
        }
        @keyframes bawzi-log {
          0%, 12% { transform: translateY(0); }
          20%, 32% { transform: translateY(-2.25rem); }
          40%, 52% { transform: translateY(-4.5rem); }
          60%, 72% { transform: translateY(-6.75rem); }
          80%, 92% { transform: translateY(-9rem); }
          100% { transform: translateY(0); }
        }
        @keyframes bawzi-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, .34); }
          50% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
        }
        @keyframes bawzi-step {
          0%, 100% { opacity: .42; transform: scale(.96); }
          45%, 72% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3.5 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300">
              <FileSearch size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Demonstração visual</p>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700">
                  exemplo fictício
                </span>
              </div>
              <p className="mt-1 text-base font-black text-slate-950">Como a Bawzi transforma um edital em decisão</p>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-500">
                Esta animação simula o fluxo de análise. Os dados e percentuais abaixo são ilustrativos.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            simulação em movimento
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,.92fr)]">
        <div className="border-b border-slate-200 bg-slate-950 p-4 md:p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Edital de exemplo</p>
              <p className="mt-1 text-sm font-black text-white">Pregão eletrônico - serviços terceirizados</p>
            </div>
            <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-sky-200">
              etapa 2 de 5
            </span>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
            <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-300/0 via-emerald-300/25 to-emerald-300/0 blur-sm [animation:bawzi-scan_3.4s_ease-in-out_infinite]" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Leitura simulada em progresso</p>
                <p className="mt-1 text-base font-black text-white sm:text-lg">Objeto, prazos e anexos sendo cruzados</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 [animation:bawzi-glow_2.2s_ease-in-out_infinite]">
                <SearchCheck size={19} />
              </div>
            </div>

            <div className="relative mt-4 hidden space-y-2 sm:block">
              {[84, 62, 92, 48, 74, 58].map((width, index) => (
                <div key={index} className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-500 via-emerald-300 to-sky-300"
                    style={{ width: `${width}%`, opacity: index % 2 ? 0.42 : 0.74 }}
                  />
                </div>
              ))}
            </div>

            <div className="relative mt-4 hidden gap-2 sm:grid sm:grid-cols-3">
              {['CNAE', 'Documentos', 'Preço'].map((label, index) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full origin-left rounded-full bg-emerald-300 [animation:bawzi-fill_4.2s_ease-in-out_infinite]"
                      style={{
                        '--fill': `${0.56 + index * 0.14}`,
                        animationDelay: `${index * 0.34}s`,
                      } as CSSProperties}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-4 grid gap-2 sm:hidden">
              {[
                ['Captura PNCP', 'Edital e anexos'],
                ['Riscos', 'Documentos e cláusulas'],
                ['Veredito', 'Ação recomendada'],
              ].map(([title, desc], index) => (
                <div key={title} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-slate-950">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-black text-white">{title}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-3 sm:p-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fluxo simulado</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">análise contínua</p>
            </div>
            <div className="absolute left-0 top-[4.55rem] h-px w-full bg-white/10" />
            <div className="relative flex items-center justify-between gap-3">
              {ANALYSIS_STEPS.map(({ Icon, title, desc }, index) => (
                <div
                  key={title}
                  className="relative flex min-w-0 flex-1 flex-col items-center text-center"
                  style={{ animationDelay: `${index * 0.28}s` }}
                >
                  {index < ANALYSIS_STEPS.length - 1 && (
                    <span className="absolute left-1/2 top-5 h-px w-full overflow-hidden bg-white/10">
                      <span
                        className="block h-full w-1/2 bg-gradient-to-r from-transparent via-emerald-300 to-transparent [animation:bawzi-flow_3.2s_linear_infinite]"
                        style={{ animationDelay: `${index * 0.42}s` }}
                      />
                    </span>
                  )}
                  <span
                    className="relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300/20 bg-slate-900 text-emerald-200 [animation:bawzi-step_3.8s_ease-in-out_infinite]"
                    style={{ animationDelay: `${index * 0.28}s` }}
                  >
                    <Icon size={17} />
                  </span>
                  <p className="mt-3 text-[10px] font-black leading-4 text-white sm:text-[11px]">{title}</p>
                  <p className="mt-1 hidden text-[10px] font-semibold leading-4 text-slate-500 sm:block">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="bg-white p-4 text-slate-950 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resultado de exemplo</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">Go condicionado</h3>
              <p className="mt-2 hidden text-sm font-semibold leading-6 text-slate-500 sm:block">
                A decisão aparece junto das evidências que levaram ao veredito.
              </p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
              simulado
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ['Score', '68/100'],
              ['Confiança', '84%'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center shadow-sm sm:p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {ANALYSIS_SIGNALS.map((signal, index) => (
              <div key={signal.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{signal.label}</p>
                  <p className="text-xs font-black text-slate-700">{signal.value}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full origin-left rounded-full ${signal.tone} [animation:bawzi-fill_4.4s_ease-in-out_infinite]`}
                    style={{
                      '--fill': signal.fill,
                      animationDelay: `${index * 0.45}s`,
                    } as CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:block">
            <div className="flex items-center gap-2">
              <Clock3 size={14} className="text-emerald-700" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agentes em execução</p>
            </div>
            <div className="mt-3 h-9 overflow-hidden">
              <div className="[animation:bawzi-log_7s_ease-in-out_infinite]">
                {ANALYSIS_LOGS.map((log) => (
                  <p key={log} className="flex h-9 items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {log}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 hidden gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-1">
            {[
              { Icon: AlertTriangle, text: 'Confirmar documentos eliminatórios', tone: 'text-amber-700 bg-amber-50 border-amber-100' },
              { Icon: Calculator, text: 'Calcular preço mínimo com margem', tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
              { Icon: Check, text: 'Reprocessar antes do lance', tone: 'text-sky-700 bg-sky-50 border-sky-100' },
            ].map(({ Icon, text, tone }) => (
              <div key={text} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${tone}`}>
                <Icon size={15} />
                <p className="text-xs font-black leading-5">{text}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
