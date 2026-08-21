'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// A régua de créditos anunciada na landing sai da mesma fonte que o portão
// aplica (`/api/tiers/config`), não de texto digitado. Ver `SavingsCalculator`.
import { useTierConfig } from '../Contexts/TierContext';
import Link from 'next/link';
// HeroFeed/HeroCards saíram: eram importados e nunca renderizados nesta
// página (feature construída e órfã). Os componentes continuam no repo;
// se voltarem à landing, o import volta junto — com um ponto de montagem.
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
    // ⚠️ Faltava. Os cards começavam em "Nível 2" — e o herói promete análises
    // grátis, o taster entrega, e quem descia para ver preço não encontrava a
    // opção que acabou de usar. O limite vem do mesmo endpoint público que a
    // home já consulta: número em dois lugares diverge, e foi assim que o
    // "5 análises por mês" da tela de cota virou mentira.
    nome: 'Gratuito',
    publico: 'Para experimentar sem cartão',
    preco: 'R$ 0',
    nivel: 'Nível 1',
    cor: 'from-slate-400 to-slate-500',
    destaque: false,
    gratuito: true,
    itens: ['Análise completa de edital', 'Veredito Go/No-Go com justificativa',
            'Histórico de análises salvo', 'Sem cartão de crédito'],
  },
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
    itens: ['Sugestões por CNAE', 'Alertas do PNCP', 'Fôlego financeiro da disputa', '4 agentes de IA em paralelo'],
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
  // `null` até o servidor responder. O padrão de 1 fazia o herói anunciar
  // "1 análise grátis por dia" enquanto o taster, na mesma página, dizia 10 —
  // duas cópias do mesmo número, só uma corrigida.
  const [heroGuestLimit, setHeroGuestLimit] = useState<number | null>(null);

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
      <div className="min-h-[60dvh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="font-sans text-slate-900 overflow-x-hidden">
      {/* ── Herói · direção D ────────────────────────────────────────────
          Papel em vez de azul-marinho, tipografia editorial, e a caixa de
          análise REAL na coluna direita — no lugar do painel de editais, que
          ocupava metade da primeira tela e depende de um portal que recusa
          consultas. Trocamos um elemento que falha sozinho por um que sempre
          funciona e que é o próprio produto. */}
      <section className="scroll-mt-24" id="degustacao" style={{ background: '#FBFAF7' }}>
        <div className="mx-auto max-w-[1180px] px-6 pt-16 pb-14 md:pt-20 md:pb-16">
          {/* 452px no lg, 512px no xl. Entre 1024 e 1279px a coluna esquerda
                media 468px e "Robôs trabalham" precisa de 476px a 52px — a
                manchete partia ao meio nessa faixa inteira. */}
          <div className="grid items-start gap-10 lg:gap-12 lg:grid-cols-[1fr_452px] xl:gap-14 xl:grid-cols-[1fr_512px]">

            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>
                Decisão Go / No-Go para licitações
              </p>

              <h1 className="mt-5 text-[34px] font-black leading-[1.02] tracking-[-0.03em] sm:text-[40px] md:text-[46px] xl:text-[52px] xl:leading-[1.0]" style={{ color: '#111827' }}>
                Robôs trabalham<br />nos lances.<br />
                <span style={{ color: '#047857' }}>Nós trabalhamos antes.</span>
              </h1>

              <p className="mt-7 max-w-[440px] text-[16.5px] font-medium leading-[1.6]" style={{ color: '#4B5563' }}>
                A Bawzi lê o edital inteiro — objeto, habilitação, prazos, penalidades —
                e devolve um veredito antes de você gastar equipe, preço e risco na
                disputa errada.
              </p>

              {/* O caminho para preço voltou aqui — e como LINK, não como
                  botão. Quando o herói virou direção D, os dois botões saíram
                  junto e a página perdeu qualquer rota para preço acima da
                  dobra. Um segundo botão devolveria o problema que a direção D
                  resolveu: dois blocos disputando a mesma decisão ao lado de
                  uma caixa que já é a ação. */}
              {/* `#9CA3AF` a 13px sobre `#FBFAF7` dá 2,4:1 — e é aqui que
                  está o único caminho para preço acima da dobra. `#756F63` dá 4,78:1. */}
              <p className="mt-7 max-w-[520px] text-[13px] font-medium leading-[1.7]" style={{ color: '#756F63' }}>
                Não fazemos a gestão do processo. Agimos na decisão — participar ou não — antes da execução.{' '}
                <a
                  href="#planos"
                  className="font-bold underline decoration-emerald-300 underline-offset-4 transition-colors hover:decoration-emerald-600"
                  style={{ color: '#047857' }}
                >
                  Ver planos e preços
                </a>
              </p>

            </div>

            <div className="lg:pt-2">
              <TasterSection modo="heroi" />
            </div>

          </div>

          {/* ── Pé do herói ──────────────────────────────────────────────
              O VEREDITO, mostrado em vez de descrito.

              O parágrafo da esquerda gastava uma linha e meia enumerando
              "entrar, entrar com ressalvas, ou não entrar" em prosa, que é
              onde ninguém retém enumeração. Aqui as três saídas aparecem como
              são no produto, com as mesmas palavras que a faixa de prova usa
              mais abaixo ("Participar", "Participar após validações", "Não
              participar"). Nada foi inventado para a home: se o vocabulário
              mudar, ou muda nos dois lugares ou a divergência fica visível.

              Três colunas, não três linhas: os vereditos são PARALELOS —
              saídas mutuamente exclusivas do mesmo processo. Empilhados, o de
              cima herda uma primazia que não existe.

              As cores seguem os HUES do laudo, escurecidos até passarem em
              texto de 10px sobre papel — que é o pior caso de legibilidade da
              página. Contra `#FBFAF7`, medido na página rodando: o `#eab308`
              do semáforo dá 1,84:1 e o `#199e70`, 3,26:1; ambos reprovam.
              Entram `#047857` (5,25:1 — o mesmo verde do sobretítulo e do link
              acima, não havia motivo para um segundo), `#96601A` (5,05:1) e
              `#C2410C` (4,96:1).

              É o único ponto acima da dobra que mostra a SAÍDA do produto — e
              prepara o resultado do taster ao lado: quando voltar "GO
              condicionado", a pessoa já sabe o que isso é. */}
          <div className="mt-12 md:mt-14">
            <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: '#A8A49B' }}>
              A resposta é sempre uma destas três
            </p>
            <div className="mt-5 grid gap-px sm:grid-cols-3" style={{ background: '#E5E2DC' }}>
              {[
                ['GO', '#047857', 'Participar', 'O edital cabe na sua empresa.'],
                ['GO condicionado', '#96601A', 'Participar após validações', 'Cabe, resolvendo o que apontamos.'],
                ['NO-GO', '#C2410C', 'Não participar', 'O custo de disputar supera o retorno.'],
              ].map(([sigla, cor, acao, porque]) => (
                <div key={sigla} className="pr-6 pt-5 pb-5 sm:pl-6 sm:first:pl-0" style={{ background: '#FBFAF7' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: cor }}>{sigla}</p>
                  <p className="mt-2.5 text-[16px] font-black leading-tight" style={{ color: '#1F2937' }}>{acao}</p>
                  <p className="mt-1.5 text-[13.5px] font-medium leading-[1.55]" style={{ color: '#787266' }}>{porque}</p>
                </div>
              ))}
            </div>
          </div>

          {/* As credenciais viram UMA LINHA.

              Elas eram uma segunda grade de filete, de 4 colunas, logo abaixo
              de outra de 3 — dois ritmos de divisória que não se alinham, o que
              vira ruído estrutural. E a grade de 4 nunca resolveu o que a
              largura inteira devia ter resolvido: no 1440 as células medem
              282px e DUAS das quatro ainda quebram em duas linhas, deixando
              alturas irregulares (medido: 2/1/2/1 linhas).

              Credencial é a coisa mais quieta do herói e agora tem o peso
              correspondente: 77px de caixas viram ~40px de texto, e não há mais
              célula para quebrar torto. */}
          <div className="mt-10 border-t pt-5" style={{ borderColor: '#E5E2DC' }}>
            <p className="flex flex-wrap items-center gap-y-1 text-[12.5px] font-semibold" style={{ color: '#787266' }}>
              {['PNCP oficial', 'O edital não sai do seu ambiente',
                'Veredito em minutos', 'Sem cartão, cancele quando quiser'].map((t, i) => (
                <span key={t} className="flex items-center">
                  {/* A margem fica no PONTO, não nos vizinhos: com `gap` no
                      contêiner o espaço saía só de um lado dele. */}
                  {i > 0 && <span aria-hidden className="mx-2.5" style={{ color: '#D6D3CD' }}>·</span>}
                  {t}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* Segunda posição da página, e colado no herói de propósito: os dois são
          escuros, então o topo inteiro é um bloco só. Antes a TrustBar branca
          entrava no meio e a sequência virava escuro/branco/escuro/branco em
          três rolagens — foi isso que deixou a página estranha quando subi o
          taster. Credencial e prova vêm DEPOIS de a pessoa ver funcionar, que
          é quando elas pesam. */}

      {/* Depois de experimentar, evidência — não mais afirmações sobre nós
          mesmos. A <TrustBar /> saiu daqui: as quatro marcas dela repetiam, com
          outras palavras, as que agora estão no herói. O componente continua
          definido logo abaixo; devolvê-lo à página é uma linha. */}
      <ProvaReal />

      {/* Simulação — análise de exemplo */}
      {/* ── Prova · direção D ────────────────────────────────────────────
          Continua o papel do herói, com a mesma escala tipográfica. O título
          deixa de descrever a peça ("veja uma análise em ação") e passa a dizer
          o que a pessoa recebe — o laudo abaixo já mostra o resto, e legenda
          que explica o que está logo ali embaixo é texto que ninguém lê. */}
      <section style={{ background: '#F3F2EE', borderTop: '1px solid #EAE7E1' }}>
        <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-20">
          <div className="mb-9 max-w-[620px]">
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>
              É isto que você recebe
            </p>
            <h2 className="mt-4 text-[30px] font-black leading-[1.1] tracking-[-0.02em] md:text-[34px]" style={{ color: '#111827' }}>
              Um veredito, com o motivo e o que fazer em seguida.
            </h2>
          </div>
          <div className="mx-auto max-w-5xl">
            <OutputCard />
          </div>
        </div>
      </section>

      <section id="problema" className="scroll-mt-24 py-16 md:py-20" style={{ background: '#FBFAF7', borderTop: '1px solid #EAE7E1' }}>
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="max-w-[640px]">
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>O problema que a Bawzi resolve</p>
            <h2 className="mt-4 text-[30px] font-black leading-[1.1] tracking-[-0.02em] md:text-[34px]" style={{ color: '#111827' }}>
              A disputa errada custa mais que uma assinatura.
            </h2>
            <p className="mt-4 text-base font-medium leading-8 text-slate-600">
              Licitação boa não é só edital aberto. Ela precisa fazer sentido para o CNAE, para a capacidade operacional, para a margem e para o risco que sua empresa aceita assumir.
            </p>
          </div>

          {/* Linha do tempo, não etiquetas. "Risco antes da leitura longa",
              "Fit antes da proposta", "Preço antes do lance" são TRÊS MOMENTOS
              do ciclo — o único lugar da página que sustenta a manchete do
              herói mostrando antes de quê, exatamente. Estavam em três caixinhas
              cinza de 60px encostadas na esquerda; o material era bom, faltava
              desenho. O eixo aqui é TEMPO, não capacidade: por isso não colide
              com o laudo nem com "O que entra no veredito". */}
          <div className="mt-12">
            <div className="hidden h-px w-full md:block" style={{ background: '#E5E2DC' }} />
            <div className="grid gap-8 md:mt-[-9px] md:grid-cols-3 md:gap-10">
              {[
                ['Risco', 'Antes da leitura longa',
                 'A cláusula eliminatória que só aparece na página 40.',
                 'Custa as horas que sua equipe gastou lendo até chegar lá.'],
                ['Fit', 'Antes da proposta',
                 'O objeto que não conversa com o seu CNAE.',
                 'Custa a proposta inteira — montada para uma disputa que não era sua.'],
                ['Preço', 'Antes do lance',
                 'A margem que não fecha depois do deságio provável.',
                 'Custa ganhar a licitação errada, que é o pior dos desfechos.'],
              ].map(([eixo, momento, achado, custo]) => (
                <div key={eixo}>
                  <div className="mb-5 hidden md:block">
                    <span className="inline-block h-[17px] w-[17px] rounded-full border-[5px]"
                          style={{ background: '#FBFAF7', borderColor: '#047857' }} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: '#A8A49B' }}>
                    {momento}
                  </p>
                  <p className="mt-2 text-[22px] font-black leading-none" style={{ color: '#047857' }}>{eixo}</p>
                  <p className="mt-3 text-[15px] font-bold leading-[1.5]" style={{ color: '#1F2937' }}>{achado}</p>
                  <p className="mt-2 text-[13.5px] font-medium leading-[1.6]" style={{ color: '#6B7280' }}>{custo}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 py-16 md:py-20" style={{ background: '#F3F2EE', borderTop: '1px solid #EAE7E1' }}>
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>Como a plataforma trabalha</p>
            <h2 className="mt-4 text-[30px] font-black leading-[1.1] tracking-[-0.02em] md:text-[34px]" style={{ color: '#111827' }}>Encontre. Decida com precisão.</h2>
            <p className="mt-4 text-base font-medium leading-8 text-slate-600">
              {/* Cortada a segunda metade: "errar a escolha custa muito mais que
                  qualquer assinatura" é a manchete do bloco 'O problema', duas
                  seções acima. Argumento bom aparece uma vez. */}
              O Radar é a entrada. A decisão é o produto — e ela vem pronta para agir.
            </p>
            </div>
            <Link href="/login?view=register" className="inline-flex h-12 w-fit items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-black text-slate-900 transition-all hover:bg-slate-100">
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

      <section id="veredito" className="scroll-mt-24 py-16 md:py-20" style={{ background: '#FBFAF7', borderTop: '1px solid #EAE7E1' }}>
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>O que entra no veredito</p>
              <h2 className="mt-4 text-[30px] font-black leading-[1.1] tracking-[-0.02em] md:text-[34px]" style={{ color: '#111827' }}>Mais que análise de texto. Uma decisão operacional.</h2>
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

      {/* Era a única escura do trecho: sozinha entre seções claras, refazia mais abaixo o mesmo pisca-pisca de fundo que tiramos do topo. */}
      <section className="py-16 md:py-20" style={{ background: '#F3F2EE', borderTop: '1px solid #EAE7E1' }}>
        <div className="mx-auto grid max-w-[1180px] gap-8 px-6 lg:grid-cols-[0.88fr_1fr] lg:items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>Quem usa a Bawzi</p>
            <h2 className="mt-4 text-[30px] font-black leading-[1.1] tracking-[-0.02em] md:text-[34px]" style={{ color: '#111827' }}>Cada área recebe o que precisa para agir.</h2>
            <p className="mt-4 text-base font-medium leading-8 text-slate-600">
              A decisão é uma, mas o que cada papel precisa para agir é diferente. A Bawzi entrega tudo junto, sem precisar distribuir manualmente.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ['Decisão', 'Go/No-Go com justificativa'],
                ['Evidências', 'riscos, fit e preço'],
                ['Ação recomendada', 'checklist e próximos passos'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-2xl border border-[#EAE7E1] bg-white px-4 py-3">
                  <p className="text-sm font-black text-slate-900">{title}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{desc}</p>
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
              <div key={title} className="rounded-2xl border border-[#EAE7E1] bg-white p-5 transition-colors hover:bg-slate-50">
                <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-[10px] font-black text-emerald-700">
                  {index + 1}
                </span>
                <h3 className="text-sm font-black text-slate-900">{title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SavingsCalculator />

      <section className="scroll-mt-24 bg-white py-16 md:py-20" id="planos">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>Planos e preços</p>
            <h2 className="mt-4 text-[30px] font-black leading-[1.1] tracking-[-0.02em] md:text-[34px]" style={{ color: '#111827' }}>Comece pequeno. Escale quando disputar em volume.</h2>
            <p className="mt-4 text-slate-500 font-medium">Teste grátis, sem cartão. Depois escolha o plano pelo ritmo da sua operação.</p>
          </div>
          {/* Quatro colunas agora: com o gratuito, a grade de três deixava
              o Avançado sozinho numa segunda fila. */}
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                {/* Intenção preservada: quem escolhe um plano pago cai no cadastro
                    e, autenticado, o workspace abre direto o checkout daquele
                    tier (?upgrade=N). Antes todos os quatro botões largavam a
                    pessoa num /login seco e a escolha se perdia. */}
                <Link
                  href={(() => {
                    const tierEscolhido = Number(nivel.replace(/\D/g, '')) || 1;
                    return tierEscolhido > 1
                      ? `/login?view=register&redirect=${encodeURIComponent(`/workspace?upgrade=${tierEscolhido}`)}`
                      : '/login?view=register';
                  })()}
                  className={`w-full rounded-xl py-3 text-center text-sm font-black transition-all ${destaque ? `bg-gradient-to-r ${cor} text-white shadow-md` : 'border border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'}`}
                >
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

      {/* Último bloco azul-marinho da página. Com ele, o partido fecha:
          do herói ao fechamento é uma linguagem só. */}
      <div style={{ background: '#F3F2EE', borderTop: '1px solid #EAE7E1' }}>
        <FAQ />
      </div>

      <section className="bg-white px-6 pb-16 md:pb-20">
        <div className="mx-auto grid max-w-[1180px] gap-8 rounded-[2rem] p-6 md:p-10 lg:grid-cols-[1fr_0.78fr] lg:items-center" style={{ background: '#FBFAF7', border: '1px solid #EAE7E1' }}>
          {/* ⚠️ Este bloco ERA azul-marinho e virou claro (#FBFAF7), mas as
              cores de texto ficaram do tema escuro: emerald-300 e slate-300
              sobre papel são quase invisíveis — no último pedido de conversão
              da página. Tudo abaixo foi trazido para o vocabulário claro. */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Próximo edital</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Leve um edital real para a Bawzi decidir.</h2>
            <p className="mt-4 max-w-2xl text-base font-medium leading-8 text-slate-600">
              Em vez de ler tudo primeiro, descubra se a oportunidade merece sua equipe, seu preço e seu risco.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?view=register" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-7 text-sm font-black text-white shadow-lg shadow-emerald-950/25 transition-all hover:bg-emerald-500">
                Criar conta gratuitamente <ArrowRight size={17} />
              </Link>
              <Link href="/#como-funciona" className="inline-flex h-14 items-center justify-center rounded-2xl border border-slate-200 bg-white px-7 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50">
                Rever como funciona
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-[#EAE7E1] bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Antes de mobilizar proposta</p>
            <div className="mt-4 space-y-3">
              {[
                'Confirme se o objeto conversa com seu CNAE.',
                'Veja documentos eliminatórios e cláusulas sensíveis.',
                'Defina margem mínima antes de entrar no pregão.',
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-[#EAE7E1] bg-[#F8F7F4] px-3 py-3">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <p className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
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

/**
 * Trecho de edital para quem chega sem um em mãos.
 *
 * Caixa vazia pede trabalho antes de dar valor: quem vem de anúncio não tem
 * edital aberto em outra aba, e vai embora sem ver o produto funcionar.
 *
 * É um texto COMPOSTO e rotulado como exemplo. Não atribuí cláusula inventada a
 * órgão real — mesma linha que traçamos ao tirar o veredito sorteado do herói.
 *
 * Foi escrito para exercitar o que a Bawzi faz de diferente: exigência de
 * atestado em percentual restritivo, índices contábeis altos, prazo de entrega
 * curto, garantia contratual — e uma contradição de prazo entre dois artigos
 * ("corridos" x "úteis"), que é o tipo de coisa que passa despercebido numa
 * leitura rápida e que o detector de contradições existe para pegar.
 */
const EDITAL_EXEMPLO = `[TRECHO DE EDITAL — EXEMPLO PARA DEMONSTRAÇÃO]

PREGÃO ELETRÔNICO — REGISTRO DE PREÇOS
OBJETO: Registro de preços para eventual aquisição de medicamentos de uso
hospitalar (antibióticos, analgésicos e soluções parenterais), conforme
quantitativos e especificações do Termo de Referência — Anexo I.

VALOR TOTAL ESTIMADO: R$ 2.480.000,00 (dois milhões, quatrocentos e oitenta mil reais).

DA HABILITAÇÃO TÉCNICA
7.1. A licitante deverá apresentar atestado(s) de capacidade técnica, fornecido(s)
por pessoa jurídica de direito público ou privado, comprovando o fornecimento
anterior de medicamentos em quantidade não inferior a 50% (cinquenta por cento)
do quantitativo total previsto neste certame.
7.2. Autorização de Funcionamento de Empresa (AFE) emitida pela ANVISA, vigente.
7.3. Licença sanitária estadual ou municipal da sede da licitante.

DA QUALIFICAÇÃO ECONÔMICO-FINANCEIRA
8.1. Balanço patrimonial do último exercício social, vedada a substituição por
balancetes, demonstrando índices de Liquidez Geral, Liquidez Corrente e
Solvência Geral iguais ou superiores a 1,5 (um vírgula cinco).
8.2. Capital social integralizado equivalente a, no mínimo, 10% (dez por cento)
do valor total estimado da contratação.
8.3. Certidão negativa de falência e recuperação judicial.

DA ENTREGA
9.1. O prazo de entrega será de 5 (cinco) dias úteis, contados do recebimento da
Nota de Empenho, na unidade indicada pela Administração, sem custo adicional de
frete.
9.2. Os itens entregues em desacordo com a especificação deverão ser substituídos
no prazo de 30 (trinta) dias corridos, contados da notificação.

DAS SANÇÕES E GARANTIAS
10.1. Será exigida garantia contratual de 5% (cinco por cento) do valor
adjudicado, em uma das modalidades do art. 96 da Lei 14.133/2021.
10.2. O atraso na substituição de itens recusados, findo o prazo de
30 (trinta) dias úteis previsto no item 9.2, sujeitará a contratada a multa
diária de 0,5% sobre o valor do lote.
10.3. A recusa injustificada em assinar a ata de registro de preços caracteriza
descumprimento total da obrigação assumida.

DA PARTICIPAÇÃO
11.1. Os itens de valor unitário estimado até R$ 80.000,00 são de participação
exclusiva de microempresas e empresas de pequeno porte, nos termos da LC 123/2006.`

const LOADING_MSGS = [
  'Lendo o edital…',
  'Extraindo pontos críticos…',
  'Avaliando viabilidade…',
  'Calculando score…',
  'Preparando veredito…',
];

function TasterSection({ modo = 'secao' }: { modo?: 'secao' | 'heroi' }) {
  // Envelope: em `heroi` o componente devolve só o miolo, sem seção e sem fundo
  // escuro, para caber na coluna direita do topo. Os três estados — formulário,
  // resultado e cota esgotada — passam por aqui, então nenhum deles precisou ser
  // duplicado para a nova posição.
  const Envelope = ({ largura, children }: { largura: string; children: React.ReactNode }) =>
    modo === 'heroi' ? (
      <div className="w-full min-w-0">{children}</div>
    ) : (
      <section id="degustacao" className="scroll-mt-24 py-16 md:py-20" style={{ background: '#0f172a' }}>
        <div className={`mx-auto ${largura} px-6`}>{children}</div>
      </section>
    );

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState(LOADING_MSGS[0]);
  const [result, setResult]   = useState<TasterResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  // `null` = ainda não sei. Enquanto não souber, o selo não exibe número e
  // nada é considerado esgotado — melhor não dizer do que dizer errado, que é
  // exatamente o defeito que este trecho tinha.
  const [guestLimit, setGuestLimit] = useState<number | null>(null);
  const [freeMonthly, setFreeMonthly] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/tiers/guest-limit`)
      .then(r => r.json())
      .then(data => {
        if (data?.daily_limit > 0) setGuestLimit(data.daily_limit);
        if (data?.free_monthly > 0) setFreeMonthly(data.free_monthly);
      })
      .catch(() => {});
  }, [API_URL]);

  // CONTAGEM, não booleano. Antes isto era um `exhausted` gravado à parte, e o
  // gravador escrevia `used: 1` literal — nunca incrementava. Resultado: travava
  // na primeira análise enquanto o selo logo acima anunciava dez. Dois estados
  // para o mesmo fato é como eles divergem; agora há um só, e o resto é derivado.
  //
  // ⚠️ E a leitura fica no `useEffect`, não no inicializador do `useState`.
  // Ler localStorage no inicializador com guarda `typeof window` quebra a
  // hidratação: servidor devolve 0, cliente devolve o valor gravado, o HTML
  // não bate e o React descarta a árvore. Aqui isso ainda não tinha estourado
  // por SORTE — o selo só olha `usadas` depois que `guestLimit` chega do
  // servidor, e no primeiro paint ele é `null`. Depender de outro estado ser
  // nulo por acaso não é garantia: bastava mudar o texto do selo.
  const [usadas, setUsadas] = useState<number>(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('bawzi_guest_quota');
      if (!raw) return;
      const { date, used } = JSON.parse(raw);
      if (date === new Date().toISOString().split('T')[0]) setUsadas(Number(used) || 0);
    } catch { /* navegador sem storage: a contagem do servidor continua valendo */ }
  }, []);

  const registrarUso = (n: number) => {
    setUsadas(n);
    try {
      localStorage.setItem('bawzi_guest_quota', JSON.stringify({
        date: new Date().toISOString().split('T')[0], used: n,
      }));
    } catch { /* navegador sem storage: a contagem do servidor continua valendo */ }
  };

  // O servidor conta por IP e é a autoridade; o localStorage é conveniência de
  // tela e pode estar limpo, ser outro navegador ou um IP compartilhado.
  const exhausted = guestLimit !== null && usadas >= guestLimit;

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
          // O servidor tem a palavra final: ele conta por IP. Se ele disse que
          // acabou, o contador local está atrasado — alinha nele, não o contrário.
          registrarUso(detail?.limite ?? guestLimit ?? 1);
          return;
        }
        throw new Error(detail?.mensagem || `Erro ${res.status}`);
      }
      const data: TasterResult = await res.json();
      setResult(data);
      registrarUso(usadas + 1);   // ⚠️ incremento — antes gravava `1` literal
      // Guarda o trecho analisado para o workspace retomar após o cadastro.
      // Sem isto, o texto que a pessoa colou — o momento de maior intenção do
      // funil — morria na tela de login e ela recomeçava do zero lá dentro.
      try {
        localStorage.setItem('bawzi_taster_handoff', JSON.stringify({
          text: trimmed.slice(0, 10000),
          ts: Date.now(),
        }));
      } catch { /* sem storage: o CTA continua levando ao cadastro, só sem retomada */ }
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
      <Envelope largura="max-w-[1180px]">
          <div className="text-center mb-10">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-4">Resultado da sua análise gratuita</p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
              <span className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-base font-black text-white ${vBg}`}>
                {vLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-slate-900 text-sm font-black" style={{ background: '#FFFFFF', border: '1px solid #E5E2DC' }}>
                Score {score}/100
              </span>
            </div>
            {result.title && (
              <p className="text-slate-600 font-semibold text-sm max-w-2xl mx-auto">{result.title}</p>
            )}
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            {/* Semáforo */}
            {result.semaforo && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.entries(result.semaforo) as [string, SemaforoSinal][]).map(([key, val]) => (
                  <div key={key} className="rounded-2xl px-3 py-3 text-center" style={{ background: '#FFFFFF', border: '1px solid #E5E2DC' }}>
                    <div className={`w-3 h-3 rounded-full mx-auto mb-1.5 ${SEMAFORO_COLOR[val] || 'bg-slate-500'}`} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                  <div key={i} className="rounded-xl px-4 py-3 text-sm text-slate-700 font-medium leading-relaxed" style={{ background: '#FFFFFF', border: '1px solid #E5E2DC' }}>
                    {m}
                  </div>
                ))}
                {motivos.length > 2 && (
                  <div className="relative">
                    <div className="rounded-xl px-4 py-3 text-sm text-slate-700 font-medium leading-relaxed blur-sm select-none pointer-events-none" style={{ background: '#FFFFFF', border: '1px solid #E5E2DC' }}>
                      {motivos[2]}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: '#0f172a', border: '1px solid #475569' }}>
                        🔒 Mais na conta gratuita
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CTAs — cadastro direto (não login) e com retomada: o texto que a
                pessoa acabou de analisar espera por ela no workspace. */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
              <Link
                href={`/login?view=register&redirect=${encodeURIComponent('/workspace?from=taster')}`}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg transition-all"
              >
                Ver análise completa <ArrowRight size={15} />
              </Link>
              <Link
                href="/plans"
                className="w-full sm:w-auto flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-sm transition-all text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                style={{ background: '#FFFFFF', border: '1px solid #D6D3CD' }}
              >
                Ver planos
              </Link>
            </div>
            <p className="text-center text-slate-500 text-xs">Crie uma conta gratuita para ver a análise completa — sem cartão</p>
          </div>
      </Envelope>
    );
  }

  // ── Estado: cota esgotada ──
  if (exhausted) {
    return (
      <Envelope largura="max-w-xl text-center">
          {/* Selo no mesmo slot e no mesmo tom do estado de formulário. Antes
              era a pílula verde-escura do modo seção (#052e16), que sobre papel
              vira uma mancha — o mesmo defeito que já corrigi no selo do
              formulário e nas superfícies do resultado. Este era o terceiro
              estado, e o único que eu nunca tinha visto renderizado: ele só
              aparece depois de a cota do dia acabar. */}
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-widest ${
              modo === 'heroi' ? 'mb-3 text-emerald-800' : 'mb-5 text-emerald-400'}`}
            style={modo === 'heroi'
              ? { background: '#ECFDF5', border: '1px solid #A7F3D0' }
              : { background: '#052e16', border: '1px solid #166534' }}
          >
            Degustação gratuita
          </span>

          {/* Este estado desenhava direto sobre o envelope, sem cartão. No
              fundo escuro funcionava; no herói a coluna direita esvaziava — o
              cartão sumia e sobrava texto solto. Mesmo cartão dos outros dois
              estados, para a troca de estado não mudar a geometria da coluna. */}
          <div
            className={`bg-white rounded-3xl ${modo === 'heroi'
              ? 'w-full p-6 border border-[#EAE7E1]'
              : 'max-w-2xl mx-auto p-8 shadow-2xl'}`}
            style={modo === 'heroi'
              ? { boxShadow: '0 1px 2px rgba(31,41,55,0.04), 0 14px 30px -16px rgba(31,41,55,0.18)' }
              : undefined}
          >
            {/* Estava `text-white` sobre papel: 1,04:1. A manchete desta tela e
                o número que ela vende — o `strong` logo abaixo — estavam os
                dois invisíveis, justamente na tela que pede o cadastro. 28px e
                não 30: a manchete do herói ao lado tem 52px, e este bloco não
                disputa com ela. */}
            <h2 className="mb-3 text-[26px] font-black leading-tight md:text-[28px]" style={{ color: '#111827' }}>
              {guestLimit === 1
                ? 'Seu crédito gratuito de hoje acabou.'
                : `Seus ${guestLimit} créditos gratuitos de hoje acabaram.`}
            </h2>
            <p className="mb-7 text-[15px] font-medium leading-[1.6]" style={{ color: '#4B5563' }}>
              {/* O número vem do servidor. Estava escrito "5 análises por mês" na
                  mão, e a configuração já dizia outro valor há tempos. */}
              Crie uma conta gratuita e ganhe{' '}
              <strong className="font-black" style={{ color: '#111827' }}>
                {freeMonthly ? `${freeMonthly} créditos grátis por mês` : 'mais créditos por mês'}
              </strong>{' '}
              — sem cartão, sem prazo de expiração.
            </p>
            <Link
              href="/login?view=register"
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-8 text-sm font-black text-white transition-all hover:bg-emerald-500"
              style={{ background: '#059669', boxShadow: '0 4px 16px rgba(5,150,105,0.35)' }}
            >
              Criar conta gratuita <ArrowRight size={16} />
            </Link>
            <p className="mt-4 text-xs font-medium" style={{ color: '#787266' }}>Seus créditos gratuitos voltam amanhã.</p>

            {/* A escada de modelos, dita sem vender o que a conta gratuita não
                entrega.

                Conferi `tier_config.py` antes de escrever: o tier -1
                (convidado) e o tier 1 (conta gratuita) têm os QUATRO slots de
                modelo idênticos e o mesmo `agent_count` de 1. De -1 para 1 muda
                volume, não motor. Prometer "modelos melhores" ao criar a conta
                seria mentira no ponto exato onde a pessoa decide — e a primeira
                análise dela desmentiria a home.

                A escada real começa no Essencial (redator no modelo avançado,
                2 agentes) e vai até o Elite (investigador com raciocínio,
                3 agentes). É isso que a frase diz.

                "Análise completa" é literal: o par de modelos RÁPIDO é
                `gpt-4o-mini` em todos os tiers, do 1 ao 4. Só o modo profundo
                escala.

                ⚠️ `get_tier_config()` lê o banco antes dos defaults do código.
                Quem mexer em tier_configs precisa saber que esta linha depende
                deles. */}
            <div className="mt-6 border-t pt-5" style={{ borderColor: '#EAE7E1' }}>
              <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: '#A8A49B' }}>
                A profundidade acompanha o plano
              </p>
              <p className="mt-2.5 text-[13px] font-medium leading-[1.6]" style={{ color: '#6B6559' }}>
                A conta gratuita usa o mesmo motor da degustação — o que muda é o
                volume. A partir do Essencial, a análise completa passa a rodar
                com modelos mais fortes e mais agentes lendo o edital.{' '}
                <a
                  href="#planos"
                  className="font-bold underline decoration-emerald-300 underline-offset-4 transition-colors hover:decoration-emerald-600"
                  style={{ color: '#047857' }}
                >
                  Ver a escada
                </a>
              </p>
            </div>
          </div>
      </Envelope>
    );
  }

  // ── Estado: formulário ──
  const canSubmit = !loading && text.trim().length >= 80;
  return (
    <Envelope largura="max-w-[1180px]">

        {/* Header */}
        <div className={modo === 'heroi' ? 'mb-4' : 'text-center mb-10'}>
          {/* No herói o fundo é papel: a pílula verde-escura do modo seção
              ficaria uma mancha solta acima do cartão. Mesmo conteúdo, tom
              adequado ao fundo de cada contexto. */}
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-widest ${modo === 'heroi' ? 'mb-3' : 'mb-5'} ${
              modo === 'heroi' ? 'text-emerald-800' : 'text-emerald-400'}`}
            style={modo === 'heroi'
              ? { background: '#ECFDF5', border: '1px solid #A7F3D0' }
              : { background: '#052e16', border: '1px solid #166534' }}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {guestLimit === null
              ? 'Análise gratuita · sem cadastro'
              : usadas > 0
                ? `${guestLimit - usadas} de ${guestLimit} créditos restantes hoje · sem cadastro`
                : `${guestLimit} crédito${guestLimit !== 1 ? 's' : ''} grátis por dia · sem cadastro`}
          </span>
          {modo === 'secao' && (
            <>
              <h2 className="text-3xl font-black text-white md:text-4xl mb-3">Experimente agora.</h2>
              <p className="text-slate-400 font-medium max-w-lg mx-auto leading-relaxed">
                Cole um trecho do edital e veja o veredito Go/No-Go em segundos — sem criar conta.
              </p>
            </>
          )}
        </div>

        {/* Card branco */}
        <div
            className={`bg-white rounded-3xl ${modo === 'heroi'
              ? 'w-full p-6 border border-[#EAE7E1]'
              : 'max-w-2xl mx-auto p-8 shadow-2xl'}`}
            /* `shadow-2xl` é um borrão de 40px herdado do fundo azul-marinho.
               Sobre papel ele lê como sujeira. Sombra curta, de objeto
               apoiado, não de objeto flutuando. */
            style={modo === 'heroi'
              ? { boxShadow: '0 1px 2px rgba(31,41,55,0.04), 0 14px 30px -16px rgba(31,41,55,0.18)' }
              : undefined}
          >

          {/* Textarea */}
          <div className="relative mb-4">
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setError(null); }}
              maxLength={10000}
              rows={7}
              className="w-full rounded-2xl border-2 p-4 text-slate-800 placeholder:text-slate-400 font-medium text-sm resize-none transition-all leading-relaxed focus:outline-none"
              /* Era `#f8fafc` sobre borda `#e2e8f0`: família slate, cinza
                 FRIO, herdada de quando o fundo da seção era azul-marinho.
                 Sobre papel quente ela lê como peça de outro projeto — e é o
                 elemento central do cartão. */
              style={{
                background: '#FAF9F5',
                borderColor: text.length > 0 ? '#059669' : '#E5E2DC',
              }}
              placeholder="Cole aqui o texto do edital, objeto da contratação ou termo de referência..."
            />
            {/* "0 / 10.000" dentro de uma caixa vazia é ruído — e caixa vazia
                é o estado que 100% das visitas veem primeiro. */}
            {text.length > 0 && (
              <div className="absolute bottom-3 right-3 text-[10px] font-bold rounded-lg px-2 py-1" style={{ background: '#F1EFE9', color: '#A8A49B' }}>
                {text.length.toLocaleString('pt-BR')}&nbsp;/&nbsp;10.000
              </div>
            )}
          </div>

          {/* Só enquanto a caixa está vazia — depois de colado, vira ruído.
              Este botão existe porque a caixa vazia é a maior barreira do
              taster: quem chega de anúncio não tem edital em outra aba. */}
          {text.length === 0 && (
            /* Era uma caixa tracejada de largura inteira, texto centralizado,
               colada em cima do botão verde: dois blocos de mesmo peso e mesma
               largura disputando o mesmo papel. Agora é linha de ajuda —
               alinhada à esquerda, sem borda, com o link sublinhado carregando
               a ação. Continua sendo a saída para quem chega de anúncio e não
               tem edital em outra aba, que é a maior barreira do taster. */
            <p className="mb-4 text-[12.5px] font-medium leading-6 text-slate-500">
              Sem um edital à mão?{' '}
              <button
                type="button"
                onClick={() => { setText(EDITAL_EXEMPLO); setError(null); }}
                className="font-bold text-emerald-700 underline decoration-emerald-300 underline-offset-4 transition-colors hover:decoration-emerald-600"
              >
                Use um trecho de exemplo
              </button>
            </p>
          )}

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
            /* Desabilitado, este botão era `#d1fae5` com texto `#6ee7b7`:
               contraste 1,34:1 — ilegível. E é o estado que TODA visita vê,
               porque a caixa começa vazia: o elemento mais importante da tela
               nascia como uma mancha. Agora é papel com texto a 5,03:1, e o
               rótulo diz o que falta em vez de repetir uma promessa que o
               botão ainda não pode cumprir. */
            style={{
              background: canSubmit ? '#059669' : modo === 'heroi' ? '#F1EFE9' : '#d1fae5',
              color: canSubmit ? '#ffffff' : modo === 'heroi' ? '#6B6559' : '#6ee7b7',
              border: canSubmit || modo !== 'heroi' ? '1px solid transparent' : '1px solid #E3DFD8',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 4px 16px rgba(5,150,105,0.35)' : 'none',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 rounded-full animate-spin shrink-0" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                {loadMsg}
              </>
            ) : canSubmit ? (
              <>
                <Zap size={16} />
                Analisar gratuitamente
                <ArrowRight size={14} className="ml-0.5" />
              </>
            ) : text.trim().length === 0 ? (
              'Cole o edital acima para analisar'
            ) : (
              `Faltam ${80 - text.trim().length} caracteres`
            )}
          </button>

          {/* Link secundário */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">Análise com IA · sem salvar histórico</p>
            <Link
              href="/login?view=register"
              className="flex items-center gap-1 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors whitespace-nowrap"
            >
              Criar conta grátis <ArrowRight size={13} />
            </Link>
          </div>
        </div>

    </Envelope>
  );
}

/**
 * A única coisa desta página que um concorrente não copia: o que de fato
 * aconteceu nas análises. O texto, os preços, os prints e a lista de
 * funcionalidades são todos copiáveis; a distribuição de vereditos da base, não.
 *
 * Distribuição inteira em vez de um número escolhido. Três percentuais que
 * somam 100 são visivelmente não-editados, e o comprador daqui — gente que lê
 * edital atrás de inconsistência — reconhece a diferença entre um dado e uma
 * peça de marketing.
 *
 * Se o servidor disser que ainda não há amostra suficiente, isto não renderiza
 * nada. Sem buraco no layout e sem número fraco: ausência custa menos
 * credibilidade que uma porcentagem sobre vinte análises.
 */
function ProvaReal() {
  const [dados, setDados] = useState<{
    disponivel: boolean;
    total?: number;
    distribuicao?: { NO_GO: number; GO_CONDICIONADO: number; GO: number };
  } | null>(null);

  useEffect(() => {
    const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
    fetch(`${API}/api/estatisticas-publicas`)
      .then(r => r.json())
      .then(setDados)
      .catch(() => {});
  }, []);

  if (!dados?.disponivel || !dados.distribuicao || !dados.total) return null;
  const d = dados.distribuicao;
  const faixas = [
    { rotulo: 'Não participar', valor: d.NO_GO, cor: '#d95926' },
    { rotulo: 'Participar após validações', valor: d.GO_CONDICIONADO, cor: '#eab308' },
    { rotulo: 'Participar', valor: d.GO, cor: '#199e70' },
  ];
  const naoEntrarComoEsta = Math.round(d.NO_GO + d.GO_CONDICIONADO);

  return (
    <div className="border-b border-slate-100 bg-white">
      <div className="mx-auto max-w-[1180px] px-6 py-7">
        <p className="text-center text-[13px] font-medium leading-6 text-slate-500">
          Em <strong className="font-black text-slate-900">
            {dados.total.toLocaleString('pt-BR')} análises
          </strong>{' '}
          já feitas na Bawzi,{' '}
          <strong className="font-black text-slate-900">{naoEntrarComoEsta}%</strong>{' '}
          terminaram com motivo para não entrar na disputa como ela estava.
        </p>

        <div className="mx-auto mt-4 flex h-2.5 max-w-2xl overflow-hidden rounded-full">
          {faixas.map(f => (
            <div key={f.rotulo} style={{ width: `${f.valor}%`, background: f.cor }}
                 title={`${f.rotulo}: ${f.valor}%`} className="min-w-[2px]" />
          ))}
        </div>

        <div className="mx-auto mt-3 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          {faixas.map(f => (
            <span key={f.rotulo} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <span className="h-2 w-2 rounded-sm" style={{ background: f.cor }} />
              {f.rotulo} <span className="tabular-nums text-slate-900">{f.valor}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
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
      // 90 dias — mesma política da /docs. Eram 30 aqui e 90 lá; padronizado
      // no mais generoso (decisão de 12/08/2026).
      a: 'Você mantém acesso de leitura ao histórico de análises por 90 dias após o cancelamento, com opção de exportar em PDF.',
    },
  ];

  return (
    <section className="py-16 md:py-20" style={{ background: '#FBFAF7', borderTop: '1px solid #EAE7E1' }}>
      <div className="mx-auto max-w-[780px] px-6">
        <div className="mb-10 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: '#047857' }}>Dúvidas frequentes</p>
          <h2 className="mt-4 text-[30px] font-black leading-[1.1] tracking-[-0.02em] md:text-[34px]" style={{ color: '#111827' }}>Perguntas antes de assinar.</h2>
        </div>
        <div className="divide-y divide-slate-200 rounded-[1.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm">
          {items.map(({ q, a }, i) => (
            /* A primeira abre por padrão: seis perguntas fechadas ocupam meia
               tela sem comunicar nada, e as respostas — que são a melhor quebra
               de objeção da página — ficavam atrás de um clique que quase
               ninguém dá numa landing. Com uma aberta, as outras cinco passam a
               parecer clicáveis em vez de decorativas. */
            <details key={q} open={i === 0} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-[15.5px] font-black leading-snug text-slate-900">{q}</span>
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 p-1 text-slate-400 transition-transform group-open:rotate-45">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-[14.5px] font-medium leading-[1.75] text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Tempo para ler o LAUDO em vez do edital. Não é slider de propósito: quatro
 * controles já é o limite antes de a simulação virar formulário, e este é o
 * único cujo valor o comprador não tem opinião formada. Meia hora é generoso
 * contra nós — reduz a economia que estamos alegando. */
const HORAS_PARA_LER_LAUDO = 0.5;
/** Plano mais barato pago. Serve de referência do "já se paga?". */
const PLANO_MAIS_BARATO = 79;

function SavingsCalculator() {
  // A régua vem do backend porque ela é uma chave no Admin. Escrita à mão
  // aqui, a frase "1 crédito a cada 50.000 caracteres" continuaria na landing
  // depois de a cobrança ter mudado — e é a primeira conta que um comprador
  // faz antes de assinar. Ver `TierContext.regua`.
  const { regua } = useTierConfig();
  const [editais, setEditais] = useState(12);
  const [horas, setHoras] = useState(3);
  const [custoHora, setCustoHora] = useState(85);
  // A premissa que o texto de abertura sempre anunciou ("boa parte vira
  // No-Go") e que a simulação não tinha. 50% é conservador e é chute
  // declarado — vira slider justamente para o comprador colocar o número
  // DELE, que é o único que ele acredita.
  const [noGo, setNoGo] = useState(50);

  // ⚠️ ANTES: `horasMes = editais * horas` — TODAS as horas contavam como
  // poupadas, ou seja, a página alegava que a Bawzi elimina 100% da leitura.
  // Isso contradizia o próprio parágrafo de abertura, que promete economia na
  // leitura IMPRODUTIVA (os No-Go), não em toda leitura. Quem compra edital
  // sabe que vai continuar lendo por inteiro aquilo em que decidir entrar —
  // e calculadora que alega 100% é descontada mentalmente para zero, levando
  // junto a economia real, que é grande.
  //
  // O modelo agora tem piso duplo:
  //   · só os No-Go entram (nos Go, economia contada = ZERO, embora exista);
  //   · e mesmo neles desconta-se o tempo de ler o laudo.
  // Subestima de propósito. Número que sobrevive ao ceticismo do comprador
  // vale mais do que número grande.
  const horasPorNoGo = Math.max(0, horas - HORAS_PARA_LER_LAUDO);
  const editaisNoGo = editais * (noGo / 100);
  const horasMes = Math.round(editaisNoGo * horasPorNoGo);
  const economiaMes = Math.round(horasMes * custoHora);
  const economiaAno = economiaMes * 12;
  const analysesPerDay = Math.max(1, Math.ceil(editais / 22));
  const jaSePaga = economiaMes >= PLANO_MAIS_BARATO;

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
    <section id="economia" className="scroll-mt-24 py-16 md:py-20" style={{ background: '#F3F2EE', borderTop: '1px solid #EAE7E1' }}>
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
          {/* A premissa do cálculo, à vista. Estava implícita e a matemática a
              ignorava; agora está escrita e a matemática a obedece. Dizer o que
              NÃO foi contado é o que separa estimativa de propaganda. */}
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
            Contamos só os editais que viram <strong className="text-slate-700">No-Go</strong> — e
            mesmo neles descontamos o tempo de ler o laudo. O ganho de velocidade
            naqueles em que você <em>decide entrar</em> fica de fora da conta, embora exista.
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
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{String(label)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 md:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Simulação rápida</p>
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
            {/* O slider que faltava — e é o que a tese inteira depende. */}
            <CalculatorField
              label="Quantos viram No-Go depois de lidos"
              value={noGo}
              min={10}
              max={90}
              suffix="%"
              onChange={setClampedValue(setNoGo, 10, 90)}
            />
          </div>

          <div className="mt-6 rounded-2xl p-5" style={{ background: '#F3F2EE', border: '1px solid #EAE7E1' }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Resultado estimado</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-3xl font-black text-slate-900">{formatCurrency(economiaMes)}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">de tempo operacional por mês</p>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900">{horasMes}h</p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  liberadas dos {Math.round(editaisNoGo)} editais que você descartaria depois de ler
                </p>
              </div>
            </div>
            {/* A conta fechada, na frente de quem acabou de configurá-la. A
                página mostrava a economia aqui e o preço mil pixels abaixo,
                deixando a multiplicação por conta do leitor.

                ⚠️ DUAS CORREÇÕES AQUI, e as duas eram promessa que o produto
                não honra:

                1. O divisor era `79` cravado, qualquer que fosse o volume. O
                   slider de editais vai até 80/mês — rotina que consome uns
                   400 créditos e NÃO cabe nos 90 do plano de R$ 79. A página
                   dizia "258× o plano mais barato" para uma rotina que aquele
                   plano não atende. É o mesmo defeito do "+2 créditos" (a tela
                   prometendo o que o portão não cumpre), só que no topo do
                   funil, onde custa estorno e churn em vez de ticket.
                   Não dá para dizer QUAL plano cabe sem saber o tamanho médio
                   dos editais do cliente — e a medição da base mostrou que
                   esse número ainda não existe (48% da amostra represada em
                   teto). Então a frase para de fingir capacidade e aponta a
                   régua, que é verificável.
                2. `Math.max(1, ...)` garantia "1×" mesmo quando a economia era
                   MENOR que o plano — a tela afirmando que se paga quando não
                   se paga. Agora esse caso tem texto próprio. */}
            {jaSePaga ? (
              <p className="mt-4 rounded-xl px-4 py-3 text-xs font-semibold leading-6"
                 style={{ background: '#FFFCF2', border: '1px solid #F0E9D8', color: '#57534E' }}>
                Com {editais} editais por mês, essa estimativa cobre{' '}
                <strong style={{ color: '#B45309' }}>
                  {Math.floor(economiaMes / PLANO_MAIS_BARATO)}× o plano mais barato
                </strong>{' '}
                (R$ {PLANO_MAIS_BARATO}/mês). Qual plano atende o seu volume depende do
                tamanho dos editais —{' '}
                {regua.tipo === 'custo'
                  ? 'cada análise custa os créditos que ela consome, e o número aparece antes de você enviar.'
                  : `a régua é 1 crédito a cada ${(regua.caracteres_por_credito ?? 50000).toLocaleString('pt-BR')} caracteres analisados.`}
              </p>
            ) : (
              <p className="mt-4 rounded-xl px-4 py-3 text-xs font-semibold leading-6"
                 style={{ background: '#F6F5F2', border: '1px solid #E7E4DE', color: '#57534E' }}>
                Nesse volume a economia estimada ({formatCurrency(economiaMes)}/mês) ainda fica
                abaixo do plano mais barato (R$ {PLANO_MAIS_BARATO}/mês). Vale começar pelo{' '}
                <strong style={{ color: '#166534' }}>plano gratuito</strong> e voltar aqui quando
                o volume subir.
              </p>
            )}
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
