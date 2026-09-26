'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// A régua de créditos anunciada na landing sai da mesma fonte que o portão
// aplica (`/api/tiers/config`), não de texto digitado. Ver `SavingsCalculator`.
import { useTierConfig, type ReguaInfo } from '../Contexts/TierContext';
import { unidadeCota } from '@/lib/unidadeCota';
import Link from 'next/link';
// HeroFeed/HeroCards saíram: eram importados e nunca renderizados nesta
// página (feature construída e órfã). Os componentes continuam no repo;
// se voltarem à landing, o import volta junto — com um ponto de montagem.
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Calculator,
  Check,
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
import { API_URL, getAuthToken } from '@/lib/apiClient';
// A coluna direita do herói: a chamada para a conta gratuita, no lugar da
// análise sem cadastro (que saiu em 26/09/2026). A campanha entra lá dentro.
import ChamadaDeCadastro, { cotaDoGratuito } from '@/components/ChamadaDeCadastro';
import { usePrecos, type TabelaDePrecos } from '@/lib/precos';
import { LAUNCH_FLAGS } from '@/lib/launchFlags';

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


// ⚠️ OS `preco` AQUI SÃO TEXTO DE RESERVA. O valor cobrado mora no Stripe e
// chega por `/api/tiers/precos-publicos` (ver `lib/precos.ts`). O literal ficou
// para trás nesta tela e na PricingSection — as duas públicas — enquanto as
// telas de dentro já liam o servidor: mudar o preço no Stripe mudava a fatura
// e não mudava a vitrine. O literal segue aqui porque a seção de planos não
// pode pintar sem preço enquanto a resposta não chega, nem se ela falhar.
const PLANOS = [
  {
    // ⚠️ Faltava. Os cards começavam em "Nível 2" — e o herói chama para a
    // conta gratuita (`ChamadaDeCadastro` lê a lista `itens` DESTE card), e
    // quem descia para ver preço não encontrava a opção que acabou de ver. O
    // limite vem do mesmo endpoint público que a home já consulta: número em
    // dois lugares diverge, e foi assim que o "5 análises por mês" da tela de
    // cota virou mentira.
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
    preco: 'R$ 149',
    nivel: 'Nível 2',
    cor: 'from-sky-500 to-indigo-500',
    destaque: false,
    // ⚠️ DOIS ITENS DAQUI JÁ ERAM DO GRATUITO, E UM ESTAVA NO PLANO ERRADO.
    // "Radar PNCP e central de decisões" e "Priorização entre editais" são do
    // nível 1 (a barra lateral marca os dois como "sem nível", e o
    // PricingSection lista "Central de decisões, priorização e gestão do
    // fluxo" no Gratuito). Vendê-los aqui inflava o degrau do Essencial com
    // coisas que a conta grátis já tem — e escondia o que ele de fato
    // acrescenta, que é a EMPRESA: a vaga de CNPJ e tudo que depende dela.
    //
    // "Sugestões por CNAE" estava no Profissional. Ela precisa de empresa
    // cadastrada (`/feed-cnae` lê o CNAE da primeira empresa do workspace), e
    // a primeira vaga de CNPJ é DESTE plano — mesma correção feita no
    // PricingSection, onde a linha saiu do Gratuito por não caber lá.
    //
    // Cada item abaixo espelha o `tiers[2].features` do PricingSection, que é
    // a lista revisada. Duas listas com fatos diferentes é como a vitrine
    // volta a discordar da tabela de preços.
    itens: ['Cadastro da empresa (CNPJ) — 1 empresa',
            'Sugestões por CNAE e contratos a vencer no mercado',
            'Agente de mercado no laudo — concorrentes e preços',
            '30 dossiês de concorrente por dia'],
  },
  {
    nome: 'Profissional',
    publico: 'Para operação recorrente',
    preco: 'R$ 299',
    nivel: 'Nível 3',
    cor: 'from-emerald-500 to-teal-500',
    destaque: true,
    // ⚠️ DOIS ITENS DESTE CARD NÃO EXISTIAM COMO ANUNCIADOS.
    // 1) "Fôlego financeiro da disputa" é a aba Capital, e
    //    `LAUNCH_FLAGS.capital` está em `false`: sem item na sidebar, sem
    //    render e sem o deeplink `?tab=capital`. Fica atrelado à flag para
    //    voltar sozinho quando ela for religada.
    // 2) Eram "4 agentes de IA em paralelo" para um teto real de 3:
    //    `tier_config.py` define `agent_count: 3` nos níveis 3 e 4, e
    //    `router_analyses.py` fecha em `max(agent_count, 3)` para tier >= 3.
    //    O card de preços (PricingSection) já dizia "terceiro agente" — eram
    //    duas contagens da mesma coisa, e esta era a errada.
    // "Sugestões por CNAE" desceu para o Essencial (ver comentário lá). O que
    // este nível acrescenta é o terceiro agente e os alertas — e "3 agentes"
    // passa a dizer QUAL é o terceiro, que é a informação que vende.
    itens: ['Parecer jurídico no laudo — terceiro agente',
            'Alertas do PNCP (e-mail + sino)',
            ...(LAUNCH_FLAGS.capital ? ['Fôlego financeiro da disputa'] : []),
            '2 empresas cadastradas · 100 dossiês por dia'],
  },
  {
    nome: 'Avançado',
    publico: 'Para times de alta disputa',
    preco: 'R$ 699',
    nivel: 'Nível 4',
    cor: 'from-amber-500 to-orange-500',
    destaque: false,
    // ⚠️ "Pipeline de renovações" e "War Room" NÃO SÃO DESTE NÍVEL.
    // O pipeline (Próximas disputas) abre para quem tem empresa cadastrada —
    // Essencial em diante. O War Room é o dossiê de concorrente, que até o
    // Gratuito tem (5 por dia). Como diferenciais do plano mais caro, os dois
    // eram promessa de coisa que o cliente já tinha dois degraus abaixo. O
    // que o Avançado acrescenta de verdade é o simulador, o volume de
    // dossiês, a terceira empresa e o suporte — como no PricingSection.
    itens: ['Simulador tático de preços na proposta',
            '500 dossiês de concorrente por dia',
            '3 empresas cadastradas',
            'Suporte prioritário'],
  },
];

/** Preço do card: o do Stripe quando ele responde, o literal enquanto não.
 *
 *  ⚠️ O SUFIXO SÓ É "/mês" NA RESERVA. Quando o servidor responde, o sufixo é
 *  o `por` dele — cravar "/mês" ao lado de um valor anual foi o defeito que
 *  escreveu "R$ 4.970,00 /MÊS ANUAL" na tela da assinatura. */
function precoDoCard(
  plano: { preco: string; nivel: string },
  precos: TabelaDePrecos | null,
): { valor: string; sufixo: string } {
  const p = precos?.[plano.nivel.replace(/\D/g, '')];
  if (!p?.valor) return { valor: plano.preco, sufixo: '/mês' };
  return { valor: p.valor, sufixo: p.por ? `/${p.por}` : '' };
}

export default function LandingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  // Preço dos cards: vem do Stripe, com o literal de PLANOS como reserva.
  const precos = usePrecos();

  // ⚠️ OS CARDS DA HOME NÃO DIZIAM QUANTAS ANÁLISES CADA PLANO DÁ.
  // Quatro colunas de funcionalidades e nenhum número de volume — sendo que
  // os planos se distinguem, antes de tudo, por volume (5 → 60 → 130 → 320).
  // Quem lia via quatro pacotes de recursos e tinha de abrir /plans para
  // descobrir a única coisa que decide qual deles cabe na rotina dele.
  //
  // Mesma fonte da tabela de preços: `/api/tiers/limites-publicos`, que lê o
  // `get_tier_config()` que o portão usa. Número em dois lugares diverge; aqui
  // ele vem do mesmo lugar. Sem resposta, a linha simplesmente não aparece —
  // reserva escrita à mão é como o "5 análises por mês" virou mentira.
  const [limitesHome, setLimitesHome] = useState<Record<string, {
    monthly_limit: number; ilimitado: boolean; peso_profunda?: number;
  }> | null>(null);
  const { regua: reguaHome } = useTierConfig();
  useEffect(() => {
    fetch(`${API_URL}/api/tiers/limites-publicos`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.tiers) setLimitesHome(d.tiers); })
      .catch(() => { /* servidor fora: os cards ficam sem a linha de cota */ });
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      router.replace('/workspace');
    } else {
      setChecked(true);
    }
  }, [router]);

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
          Papel em vez de azul-marinho, tipografia editorial, e na coluna
          direita a chamada para a conta gratuita. Ali morou a caixa de
          análise sem cadastro, que saiu em 26/09/2026 (da tela e do
          servidor: sem conta, o servidor não analisa); antes dela, o painel
          de editais, que dependia de um portal que recusa consultas. */}
      <section style={{ background: '#FBFAF7' }}>
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

            {/* Sem o `lg:pt-2` de antes: o sobretítulo da chamada fica na
                mesma linha do da esquerda, e o cartão na mesma do H1. */}
            <div>
              <ChamadaDeCadastro
                cota={cotaDoGratuito(limitesHome?.['1'], reguaHome)}
                itens={PLANOS[0].itens}
              />
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

              É o único ponto acima da dobra que mostra a SAÍDA do produto:
              quando o primeiro laudo da conta nova voltar "GO condicionado",
              a pessoa já sabe o que isso é. */}
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

      {/* Depois do herói, evidência — não mais afirmações sobre nós
          mesmos. A <TrustBar /> saiu daqui: as quatro marcas dela repetiam, com
          outras palavras, as que agora estão no herói. O componente continua
          definido logo abaixo; devolvê-lo à página é uma linha. */}
      <ProvaReal />

      {/* ⚠️ A SIMULAÇÃO FICTÍCIA SAIU DAQUI (10/09/2026).
          Era o `<OutputCard />` — "Go condicionado · 68 · Município de São
          Paulo · exemplo fictício" — sob o título "É isto que você recebe".
          Enquanto o taster do herói devolvia só um selo e dois motivos, ela
          fazia sentido: era o único lugar da página mostrando o formato do
          laudo. O taster passou a renderizar o veredito REAL no formato do
          laudo real, com o porquê, o score, exigências, riscos e datas. A
          partir daí, um exemplo inventado 800px abaixo de um resultado
          verdadeiro enfraquecia os dois: o real parecia recorte, o fictício
          parecia o produto.
          O componente continua definido lá embaixo, como a TrustBar;
          devolvê-lo à página é uma linha.
          ⚠️ E o taster saiu em 26/09/2026: hoje nada na home mostra o formato
          do laudo. Se isso fizer falta, é este o componente. */}

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
            {PLANOS.map(({ nome, publico, preco, nivel, cor, destaque, itens }) => {
              const p = precoDoCard({ preco, nivel }, precos);
              return (
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
                  <span className="text-3xl font-black text-slate-950">{p.valor}</span>
                  {p.sufixo && (
                    <span className="text-sm font-medium text-slate-400">{p.sufixo}</span>
                  )}
                  {(() => {
                    const n = Number(nivel.replace(/\D/g, '')) || 1;
                    const l = limitesHome?.[String(n)];
                    if (!l) return null;
                    if (l.ilimitado) {
                      return <p className="mt-1.5 text-[12.5px] font-bold text-slate-600">Análises ilimitadas</p>;
                    }
                    // A mesma palavra da tabela de preços, decidida pela
                    // mesma função: "análise rápida" quando há multiplicador
                    // de profunda, "crédito" quando a régua por custo está
                    // ligada. Escrever "análises" aqui à mão recriaria as
                    // duas moedas que `unidadeCota` existe para evitar.
                    const reguaDoNivel: ReguaInfo = {
                      tipo: reguaHome?.tipo ?? 'fixa',
                      caracteres_por_credito: reguaHome?.caracteres_por_credito ?? null,
                      peso_profunda: l.peso_profunda ?? null,
                      peso_por_plano: [],
                    };
                    const peso = l.peso_profunda ?? 1;
                    return (
                      <p className="mt-1.5 text-[12.5px] font-bold text-slate-600">
                        {l.monthly_limit.toLocaleString('pt-BR')} {unidadeCota(reguaDoNivel, l.monthly_limit)}
                        {n === 1 ? ' grátis' : ''} por mês
                        {/* Como em /plans: o Gratuito também faz profunda
                            (peso 4 numa cota de 5 = uma). */}
                        {peso > 1 && n >= 1 && (
                          <span className="block text-[11px] font-medium text-slate-400">
                            cada auditoria profunda consome {peso}
                          </span>
                        )}
                      </p>
                    );
                  })()}
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
              );
            })}
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
    const API = API_URL;
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
      // Motor: backend/app/services/pncp/juridico.py (guarda contra
      // confundir 8.666/93 com 14.133/2021) + models.py (fundamentacao_legal
      // obrigatoria) + analysis_quality.py (valida formato da citacao TCU).
      q: 'O motor está atualizado com a Lei 14.133/2021 e a jurisprudência do TCU?',
      a: 'Sim. O motor jurídico da Bawzi é parametrizado especificamente pela Nova Lei de Licitações (Lei 14.133/2021), com validação para não confundir com a lei antiga (8.666/93), e cita o artigo ou acórdão do TCU que fundamenta cada risco apontado.',
    },
    {
      q: 'Preciso enviar documentos internos ou sigilosos?',
      a: 'Não. A análise é feita sobre o edital público e os dados do PNCP, que são fontes abertas do governo federal. Nenhum documento interno da empresa precisa ser enviado.',
    },
    {
      // Mesma politica ja publicada em /docs e /privacidade -- so faltava
      // aparecer aqui, que e onde o visitante cetico realmente le.
      q: 'Meus editais e dados de qualificação são usados para treinar alguma IA?',
      a: 'Não. A Bawzi não usa documentos de clientes para treinar modelo público próprio, nem vende dados a terceiros. Provedores externos de IA, quando usados, seguem contratos e configurações compatíveis com uso empresarial e restrição de treinamento — os mesmos termos detalhados na nossa página de privacidade.',
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
/** Reserva do plano pago mais barato, para o "já se paga?" enquanto o Stripe
 *  não responde. ⚠️ ERA 79, CRAVADO — e a escada foi para 149 em 07/09/2026.
 *  A calculadora seguiu dizendo "cobre 16× o plano mais barato (R$ 79/mês)"
 *  quando a conta real era 8× de R$ 149: o retorno prometido estava DOBRADO,
 *  na seção que existe para o comprador fazer a conta. E a 400px dali os
 *  cards já mostravam R$ 149, lidos do Stripe. Dois preços na mesma página,
 *  e o errado era o que multiplicava. Agora o valor vem de `usePrecos()`, a
 *  mesma leitura dos cards; este número só serve enquanto ela não chega. */
const PLANO_MAIS_BARATO_RESERVA = 149;

function SavingsCalculator() {
  // A régua vem do backend porque ela é uma chave no Admin. Escrita à mão
  // aqui, a frase "1 crédito a cada 50.000 caracteres" continuaria na landing
  // depois de a cobrança ter mudado — e é a primeira conta que um comprador
  // faz antes de assinar. Ver `TierContext.regua`.
  //
  // ⚠️ E FOI EXATAMENTE ISSO QUE ACONTECEU, PELA PORTA QUE O COMENTÁRIO ACIMA
  // NÃO VIGIAVA. A guarda distinguia régua POR CUSTO de régua FIXA — e a fixa
  // deixou de depender de tamanho em 07/09/2026 (1 análise = 1 da cota,
  // `modos.custo_em_creditos`). O ramo "fixa" continuou imprimindo "1 crédito
  // a cada 50.000 caracteres" porque `caracteres_por_credito` continua
  // existindo no config, só não cobra mais nada. O texto abaixo descreve a
  // régua que de fato debita, e aponta para os cards, onde a cota de cada
  // plano agora aparece.
  const { regua } = useTierConfig();
  const precosCalc = usePrecos();
  const planoMaisBarato = (() => {
    const pagos = [2, 3, 4]
      .map(n => precosCalc?.[String(n)]?.centavos)
      .filter((c): c is number => typeof c === 'number' && c > 0);
    return pagos.length ? Math.min(...pagos) / 100 : PLANO_MAIS_BARATO_RESERVA;
  })();
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
  const jaSePaga = economiaMes >= planoMaisBarato;

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
                  {Math.floor(economiaMes / planoMaisBarato)}× o plano mais barato
                </strong>{' '}
                (R$ {planoMaisBarato.toLocaleString('pt-BR')}/mês).{' '}
                {regua.tipo === 'custo'
                  ? 'Qual plano atende o seu volume depende do tamanho dos editais: cada análise custa os créditos que ela consome, e o número aparece antes de você enviar.'
                  : 'Qual plano atende o seu volume depende de quantos editais você analisa por mês: cada análise rápida consome 1 da cota, a auditoria profunda consome mais — a cota de cada plano está nos cards abaixo.'}
              </p>
            ) : (
              <p className="mt-4 rounded-xl px-4 py-3 text-xs font-semibold leading-6"
                 style={{ background: '#F6F5F2', border: '1px solid #E7E4DE', color: '#57534E' }}>
                Nesse volume a economia estimada ({formatCurrency(economiaMes)}/mês) ainda fica
                abaixo do plano mais barato (R$ {planoMaisBarato.toLocaleString('pt-BR')}/mês). Vale começar pelo{' '}
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
              {/* ⚠️ ERA "4 agentes". O card do Profissional já tinha sido
                  corrigido de 4 para 3 ("eram duas contagens da mesma coisa,
                  e esta era a errada") — esta era a TERCEIRA cópia do mesmo
                  número, e ficou. `agent_count` máximo é 3 (tier_config.py). */}
              {['3 agentes', '84% confiança', 'minutos'].map((item) => (
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
