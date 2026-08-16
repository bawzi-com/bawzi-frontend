'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Lock, Check, RefreshCw, Sparkles, CalendarClock, ChevronRight } from 'lucide-react';
import UpgradeModal from './UpgradeModal';
import { useTier } from '@/hooks/useTier';
import { getAuthToken, mensagemDeErro } from '@/lib/apiClient';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

interface PricingSectionProps {
  onRegister?: () => void;
  onUpgrade?: (tier: number) => void;
  onChangePlan?: (tier: number) => void;   // Abre o modal de troca de plano (para assinantes pagos)
  currentTier?: number;
  /** Modo compacto: mostra só o resumo do plano atual + link para /plans, sem a grade completa dos 5 planos. Usado no workspace, onde a tabela inteira é ruído repetido a cada visita. */
  compact?: boolean;
}

// Dados dos tiers: features são o DELTA de cada nível (o que é exclusivo deste tier).
// O campo `inherits` indica qual tier anterior está incluso (para exibir "Tudo do Nível N +").
//
// ⚠️ OS NÚMEROS NÃO MORAM MAIS AQUI.
// Os três grupos numéricos — quantidade de análises, limite de caracteres e
// limite de MB — vêm de `/api/tiers/limites-publicos`, que lê o mesmo
// `get_tier_config()` que a rota de análise usa para liberar ou bloquear. Os
// campos `quantidade` e `limites` abaixo são o TEXTO DE RESERVA, usado só
// enquanto a rota não responde.
//
// Estavam escritos à mão, e dois já divergiam: a tela de cota esgotada diz
// "3 análises" (tier -1) e "30 por mês" (tier 1), enquanto esta tabela dizia
// "1 análise por dia" e "5 análises/mês". Reescrever à mão consertaria hoje e
// recriaria o defeito — o mesmo "5 análises/mês" já apareceu em três arquivos
// diferentes neste projeto.
//
// As frases qualitativas continuam aqui de propósito: são descrição de
// funcionalidade, não configuração, e não têm como divergir sozinhas.
const tiers = [
  {
    name: 'Teste', badge: 'NÍVEL 0', price: 'Grátis', period: '',
    inherits: null,
    quantidade: '1 crédito grátis por dia · sem cadastro',
    features: [
      'Nova Análise — score Go/No-Go',
      'Resumo executivo do edital',
      'Semáforo de viabilidade',
    ],
    limites: ['Editais até 10.000 caracteres', 'PDF até 3 MB'],
    mbSufixo: '',
    buttonText: 'Testar agora', tierLevel: -1, popular: false, label: null,
  },
  {
    name: 'Gratuito', badge: 'NÍVEL 1', price: 'Grátis', period: '',
    inherits: null,
    quantidade: '5 créditos grátis por mês',   // reserva; o servidor manda
    features: [
      'Análise completa com matriz de riscos e exigências críticas',
      'Auditoria profunda — contradições entre o edital e o cadastro do PNCP',
      'Central de decisões, priorização e gestão do fluxo',
      'Oportunidades com fit CNAE e renovações a vencer',
      'Dossiê de concorrente — motivo de inabilitação e minuta de recurso · 5 por dia',
      // ⚠️ AQUI DIZIA "1 empresa cadastrada". O backend dá ZERO:
      // `TIER_COMPANY_LIMITS[1] = 0` (config.py:95), e cadastrar a primeira
      // empresa devolve 403 em router_workspaces.py:564.
      //
      // A correção anterior virou a linha em "Cadastro de empresa (CNPJ) a
      // partir do Essencial" — verdadeira lida no cartão, e FALSA na tabela
      // comparativa, que a marcava com ✓ na coluna do Gratuito. Frase-aviso não
      // é recurso: ela não sobrevive a ser exibida como célula de uma matriz.
      // O fato agora é declarado onde ele existe (Essencial, logo abaixo), e a
      // ausência no Gratuito aparece sozinha, como travessão na tabela.
    ],
    limites: ['Editais até 25.000 caracteres', 'PDF até 5 MB'],
    mbSufixo: '',
    buttonText: 'Criar conta', tierLevel: 1, popular: false, label: null,
  },
  {
    name: 'Essencial', badge: 'NÍVEL 2', price: 'R$ 79', period: '/mês',
    inherits: 1,
    quantidade: '90 créditos por mês',   // reserva; espelha LIMIT_TIER_2 — o servidor manda
    // ⚠️ NADA DE QUANTIDADE DERIVADA DE CONFIGURAÇÃO AQUI.
    // "16 auditorias profundas por mês" saiu daqui: eu tinha calculado a
    // partir do `.env` (130 créditos) e o servidor serve o override do banco
    // (350), então o card mentia por um fator de quase três. Quantidade que
    // depende de tier vem em `quantidade`/`limites`, montadas pelo servidor.
    // O teto de dossiês pode ficar: está fixo em router_competitors.py,
    // num dicionário literal — não é configurável por tier nem sobreposto
    // pelo banco, então não corre o risco das quantidades derivadas.
    features: [
      'Agentes de mercado no laudo — concorrentes e preços',
      'Cadastro de empresa (CNPJ) · 1 empresa',
      '30 dossiês de concorrente por dia',
    ],
    limites: ['Editais até 80.000 caracteres', 'PDF até 15 MB'],
    mbSufixo: '',
    buttonText: 'Assinar Essencial', tierLevel: 2, popular: false, label: null,
  },
  {
    name: 'Profissional', badge: 'NÍVEL 3', price: 'R$ 197', period: '/mês',
    inherits: 2,
    quantidade: '250 créditos por mês',   // reserva; espelha LIMIT_TIER_3 — o servidor manda
    features: [
      'Parecer jurídico no laudo — terceiro agente',
      'Monitor inteligente PNCP (e-mail + sino)',
      'Fôlego financeiro e capital de execução',
      '100 dossiês por dia · 2 empresas',
    ],
    limites: ['Editais até 180.000 caracteres', 'PDF até 20 MB'],
    mbSufixo: '',
    buttonText: 'Assinar Profissional', tierLevel: 3, popular: true, label: 'Mais popular',
  },
  {
    name: 'Avançado', badge: 'NÍVEL 4', price: 'R$ 497', period: '/mês',
    inherits: 3,
    quantidade: '650 créditos por mês',   // reserva; espelha LIMIT_TIER_4 e a âncora do billing_config (R$ 497 ÷ 650)
    // O tamanho do edital saiu daqui: a linha de limites, montada pelo
    // servidor, já diz "Editais até 500.000 caracteres" — o card exibia duas
    // vezes. O suporte prioritário também aparecia duas vezes, porque o
    // `mbSufixo` o colava no fim da linha do PDF. Fica só como item.
    features: [
      'Simulador tático de preços na proposta',
      '500 dossiês por dia · 3 empresas',
      'Suporte prioritário',
    ],
    limites: ['Editais até 500.000 caracteres', 'PDF até 20 MB'],
    mbSufixo: '',
    // ⚠️ O selo dizia 'Elite'. "Elite" é um nome de plano que a Bawzi teve e
    // aposentou — ele sobrevivia em mensagens de erro do backend e aqui, no
    // card do plano mais caro, ao lado do nome atual. Quem lia via dois nomes
    // para a mesma coisa e não sabia qual estava comprando. O selo agora diz o
    // que o plano é, não como ele se chamava.
    buttonText: 'Assinar Avançado', tierLevel: 4, popular: false, label: 'Completo',
  },
] as const;

interface LimitePublico {
  monthly_limit: number;
  ilimitado: boolean;
  max_chars: number | null;
  max_mb: number | null;
  /** `true` quando um crédito PODE diferir de uma análise neste plano — por
   *  multiplicador de modo ou por edital maior que a unidade. O servidor decide,
   *  porque a regra depende de dois campos que ele já tem. */
  em_creditos?: boolean;
  caracteres_por_credito?: number;
  peso_profunda?: number;
}

const numeroBr = (n: number) => n.toLocaleString('pt-BR');

/* ═══════════════════════════════════════════════════════════════════════════
 * SIMULADOR DE PLANO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * POR QUE ELE PODE EXISTIR AGORA, DEPOIS DE TRÊS RECUSAS
 * ──────────────────────────────────────────────────────
 * Esta página já tentou traduzir cota em análises três vezes e recusou as três
 * (ver `quantidadeTexto` e `linhasLimites`). O motivo era sempre o mesmo: para
 * dizer "cabem N análises" é preciso saber o TAMANHO de um edital, e o número
 * que existia vinha de cinco medições. A recusa estava certa.
 *
 * O que muda aqui não é a confiança na média — é de quem é a premissa. O
 * tamanho deixa de ser um número que NÓS inventamos e escondemos numa
 * multiplicação, e passa a ser uma ESCOLHA DO LEITOR, com a faixa em
 * caracteres impressa ao lado de cada opção. Ele valida a premissa antes de
 * ver o resultado. Uma medição da base (2026-08-13) confirmou que estimar por
 * nós seria chute: 48% das análises estavam represadas nos tetos de plano, o
 * que descreve os nossos limites e não o mercado.
 *
 * E o resultado é FAIXA, nunca ponto: cada categoria de tamanho tem mínimo e
 * máximo, e a recomendação cobre o MÁXIMO. Recomendar um plano que atende a
 * mediana é garantir um mês ruim no primeiro edital grande.
 *
 * ⚠️ TODOS os números vêm de `/api/tiers/limites-publicos` — cota,
 * `max_chars`, `caracteres_por_credito` e `peso_profunda`. Nada de constante
 * de preço nesta tela: a régua da simulação é a MESMA que o portão aplica, e
 * se ela mudar no Admin a simulação muda junto, sem release. Foi uma segunda
 * fórmula no frontend que produziu o "+2 créditos" enquanto o portão debitava
 * 21 — este componente não repete isso.
 *
 * ⚠️ E o TAMANHO é uma barreira dura, não só preço: um plano com `max_chars`
 * de 25.000 não analisa um edital de 200.000 — ele corta. Isso desqualifica um
 * plano por motivo diferente de quantidade, e é a informação que o comprador
 * mais precisa e que nenhuma tabela de preços dá. */

type FaixaTamanho = {
  chave: string;
  rotulo: string;
  descricao: string;
  min: number;
  max: number;
};

/** As categorias que o leitor escolhe. A faixa em caracteres aparece na tela
 *  justamente para ele poder discordar — é premissa dele, não nossa. */
const FAIXAS_TAMANHO: readonly FaixaTamanho[] = [
  { chave: 'enxuto', rotulo: 'Enxuto', descricao: 'só o edital, poucos anexos', min: 20_000, max: 60_000 },
  { chave: 'comum', rotulo: 'Comum', descricao: 'edital + anexos usuais', min: 60_000, max: 180_000 },
  { chave: 'grande', rotulo: 'Grande', descricao: 'muitos anexos e planilhas', min: 180_000, max: 400_000 },
];

/** A régua fixa, com os coeficientes que o SERVIDOR mandou.
 *  `teto(caracteres ÷ unidade) × peso`, mínimo 1 — igual a `modos.custo_em_creditos`. */
function creditosDoEdital(chars: number, unidade: number, peso: number, profunda: boolean): number {
  const base = Math.max(1, Math.ceil(chars / Math.max(1, unidade)));
  return base * (profunda ? Math.max(1, peso) : 1);
}

/** Teto do slider de volume. 60 era baixo demais: uma assessoria de licitações
 *  passa disso com folga, e slider que satura faz o comprador concluir que o
 *  produto não é para ele — quando é justamente o cliente que mais paga.
 *  Acima deste número a resposta honesta deixa de ser "assine o Avançado" e
 *  passa a ser "fale com a gente", que é o que a simulação diz. */
const MAX_EDITAIS = 200;

/** Slider + campo numérico. Só slider perde precisão num intervalo de 200;
 *  só campo perde a noção de escala. Mesmo par usado na calculadora de
 *  economia da landing. */
function CampoVolume({ label, valor, min, max, ajuda, cor, onChange }: {
  label: string; valor: number; min: number; max: number;
  ajuda?: string; cor: string; onChange: (v: number) => void;
}) {
  // Clamp SEMPRE, inclusive no digitado: o campo aceita colar "9999" e sem
  // isto a simulação renderizaria uma rotina que nenhum plano do mundo atende,
  // com números que não querem dizer nada.
  const aplicar = (bruto: string) => {
    const n = Number(bruto);
    if (!Number.isFinite(n)) return;
    onChange(Math.max(min, Math.min(max, Math.round(n))));
  };
  return (
    <label className="block">
      <div className="mb-2 flex items-end justify-between gap-3">
        <span className="text-sm font-black text-slate-800">{label}</span>
        <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black tabular-nums text-slate-700">
          {valor}
        </span>
      </div>
      <div className="grid gap-2 @min-[20rem]:grid-cols-[1fr_74px] @min-[20rem]:items-center">
        <input
          type="range" min={min} max={max} value={valor}
          onChange={(e) => aplicar(e.target.value)}
          className={`h-2 w-full cursor-pointer ${cor}`}
        />
        <input
          type="number" min={min} max={max} value={valor}
          onChange={(e) => aplicar(e.target.value)}
          onBlur={(e) => aplicar(e.target.value || String(min))}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-black tabular-nums text-slate-700 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/10"
        />
      </div>
      {ajuda && <p className="mt-1.5 text-[11px] font-medium text-slate-400">{ajuda}</p>}
    </label>
  );
}

type Veredito = 'folga' | 'limite' | 'corta' | 'estoura' | 'tamanho';

function SimuladorDePlano({
  limites,
  onEscolher,
  activeTier,
  onRecomendado,
}: {
  limites: Record<string, LimitePublico> | null;
  onEscolher: (tierLevel: number) => void;
  activeTier: number;
  /** Publica o nível recomendado para o resto da página destacar o MESMO
   *  plano. Sem isto, o simulador respondia "qual é o meu" e logo abaixo os
   *  cartões, indistintos entre si, faziam a pessoa recomeçar a decisão — a
   *  resposta morria na altura em que era dada. */
  onRecomendado?: (nivel: number | null) => void;
}) {
  const [editais, setEditais] = useState(10);
  const [profundas, setProfundas] = useState(2);
  const [faixaChave, setFaixaChave] = useState('comum');
  const faixa = FAIXAS_TAMANHO.find((f) => f.chave === faixaChave) ?? FAIXAS_TAMANHO[1];

  const profundasReais = Math.min(profundas, editais);
  const rapidas = Math.max(0, editais - profundasReais);

  // ⚠️ O CÁLCULO SUBIU PARA ANTES DO `return null` por regra de hooks: o
  // `useEffect` que publica a recomendação não pode ficar depois de um return
  // condicional. Como o corpo desreferencia `limites`, ele passa a ser guardado.
  const planos = !limites ? [] : [2, 3, 4].map((nivel) => {
    const lim = limites[String(nivel)];
    const meta = tiers.find((t) => t.tierLevel === nivel);
    const unidade = lim?.caracteres_por_credito || 50_000;
    const peso = lim?.peso_profunda || 1;
    const cota = Number(lim?.monthly_limit || 0);
    const maxChars = Number(lim?.max_chars || 0);

    const custo = (chars: number) =>
      rapidas * creditosDoEdital(chars, unidade, peso, false)
      + profundasReais * creditosDoEdital(chars, unidade, peso, true);

    // O teto do plano também limita o custo: o que passa dele é cortado, não
    // cobrado. Simular 400 mil num plano de 80 mil e cobrar por 400 mil
    // mentiria para os dois lados — no preço e na capacidade.
    const cMin = custo(Math.min(faixa.min, maxChars || faixa.min));
    const cMax = custo(Math.min(faixa.max, maxChars || faixa.max));

    const semCota = Boolean(lim?.ilimitado) || cota === 0;
    const cortaEdital = maxChars > 0 && maxChars < faixa.max;

    // ⚠️ TRUNCAR DESQUALIFICA — não é "atende com folga".
    //
    // A primeira versão desta lógica olhava só o volume, e por isso recomendava
    // o Essencial (teto de 80.000) para quem marcou "edital comum" (60 a 180
    // mil): sobra crédito, mas MAIS DA METADE dos editais chegaria cortado.
    // E o corte tira o fim do documento, que é onde ficam termo de referência,
    // sanções e matriz de risco (item 19). Vender folga de crédito sobre laudo
    // cego é pior do que dizer que o plano não serve.
    let veredito: Veredito;
    if (maxChars > 0 && maxChars < faixa.min) veredito = 'tamanho';
    else if (!semCota && cMin > cota) veredito = 'estoura';
    else if (cortaEdital) veredito = 'corta';
    else if (!semCota && cMax > cota) veredito = 'limite';
    else veredito = 'folga';

    return { nivel, meta, lim, cota, maxChars, cMin, cMax, veredito, unidade, cortaEdital };
  });

  // O recomendado é o MAIS BARATO que atende com folga — o que agora exige
  // também não recortar. Se nenhum atende, não empurra o topo como se
  // coubesse: diz a verdade e manda falar com a gente.
  const recomendado = planos.find((p) => p.veredito === 'folga') ?? null;

  const nivelRecomendado = recomendado?.nivel ?? null;
  useEffect(() => { onRecomendado?.(nivelRecomendado); }, [nivelRecomendado, onRecomendado]);

  // Sem os limites do servidor não há simulação honesta possível — e inventar
  // um fallback aqui seria exatamente a fórmula paralela que este componente
  // existe para evitar. Some da tela até o dado chegar.
  if (!limites) return null;

  const CORES: Record<Veredito, { chip: string; texto: string }> = {
    folga:   { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', texto: 'Atende com folga' },
    limite:  { chip: 'bg-amber-50 text-amber-700 border-amber-200',       texto: 'No limite' },
    corta:   { chip: 'bg-amber-50 text-amber-700 border-amber-200',       texto: 'Recorta os maiores' },
    estoura: { chip: 'bg-red-50 text-red-700 border-red-200',             texto: 'Não atende o volume' },
    tamanho: { chip: 'bg-red-50 text-red-700 border-red-200',             texto: 'Não comporta o tamanho' },
  };

  return (
    <div className="@container mb-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 md:px-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Qual plano é o seu
        </p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
          Descreva sua rotina e veja o que cabe
        </h3>
        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
          A conta usa a régua real de cobrança do servidor, não uma média nossa.
          O tamanho do edital é escolha sua — a faixa em caracteres está ao lado
          de cada opção.
        </p>
      </div>

      <div className="grid gap-6 p-5 md:p-6 @min-[52rem]:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* ── Entradas ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          <CampoVolume
            label="Editais por mês"
            valor={editais}
            min={1}
            max={MAX_EDITAIS}
            cor="accent-emerald-600"
            ajuda={editais >= MAX_EDITAIS
              ? 'No teto da simulação — nesse volume a conversa é de condição própria.'
              : undefined}
            onChange={(v) => {
              setEditais(v);
              // O número de profundas nunca pode ultrapassar o total. Sem esta
              // linha, baixar o volume deixava um resíduo maior que o todo e a
              // conta passava a cobrar profundas que não existem.
              if (profundas > v) setProfundas(v);
            }}
          />

          <CampoVolume
            label="Destes, em auditoria profunda"
            valor={profundasReais}
            min={0}
            max={editais}
            cor="accent-sky-600"
            ajuda="A auditoria profunda relê o edital inteiro em blocos e custa mais por isso."
            onChange={setProfundas}
          />

          <div>
            <span className="mb-2 block text-sm font-black text-slate-800">Tamanho típico do edital</span>
            <div className="grid gap-2">
              {FAIXAS_TAMANHO.map((f) => (
                <button
                  key={f.chave}
                  type="button"
                  onClick={() => setFaixaChave(f.chave)}
                  className={`flex items-baseline justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                    f.chave === faixaChave
                      ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block text-xs font-black ${f.chave === faixaChave ? 'text-emerald-800' : 'text-slate-700'}`}>
                      {f.rotulo}
                    </span>
                    <span className="block text-[11px] font-medium text-slate-500">{f.descricao}</span>
                  </span>
                  {/* A premissa, à vista. É o que separa isto de uma média inventada. */}
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">
                    {numeroBr(f.min / 1000)}–{numeroBr(f.max / 1000)} mil car.
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Resultado ────────────────────────────────────────────── */}
        <div>
          <div className="space-y-2.5">
            {planos.map((p) => {
              const c = CORES[p.veredito];
              const ehRecomendado = recomendado?.nivel === p.nivel;
              return (
                <div
                  key={p.nivel}
                  className={`rounded-2xl border p-3.5 transition-all ${
                    ehRecomendado ? 'border-emerald-300 bg-emerald-50/40 shadow-sm' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-900">
                        {p.meta?.name}
                        <span className="text-xs font-bold text-slate-400">{p.meta?.price}{p.meta?.period}</span>
                        {ehRecomendado && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                            Recomendado
                          </span>
                        )}
                        {activeTier === p.nivel && (
                          <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                            Seu plano
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500 tabular-nums">
                        {p.veredito === 'tamanho'
                          ? `Analisa até ${numeroBr(p.maxChars)} caracteres — menos que o seu edital típico`
                          : `Usaria ${p.cMin === p.cMax ? p.cMin : `${p.cMin} a ${p.cMax}`} de ${numeroBr(p.cota)} créditos`}
                      </p>
                      {/* Corte silencioso jamais: se o plano atende o volume mas
                          corta os editais maiores, isso é dito aqui. Um plano que
                          "cabe" entregando laudo sobre documento truncado não cabe. */}
                      {p.veredito !== 'tamanho' && p.cortaEdital && (
                        <p className="mt-1 text-[11px] font-bold text-amber-700">
                          ⚠ Editais acima de {numeroBr(p.maxChars)} caracteres seriam recortados
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${c.chip}`}>
                        {c.texto}
                      </span>
                      {activeTier !== p.nivel && (
                        <button
                          type="button"
                          onClick={() => onEscolher(p.nivel)}
                          className={`rounded-xl px-3 py-1.5 text-[11px] font-black transition-all ${
                            ehRecomendado
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Assinar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ⚠️ O QUE ACONTECE AO EXCEDER, dito por inteiro.
              A versão anterior dizia só "passar da cota não bloqueia — entra na
              margem de cortesia". É meia verdade: a cortesia TEM teto
              (`_teto_de_cortesia`), e depois dele a análise não para, ela
              DEGRADA — cai no motor gratuito e a auditoria profunda é
              suspensa. Vender "não bloqueia" e entregar laudo mais fraco é a
              mesma família do 14f. E existe uma terceira saída que a frase
              omitia: pacote de créditos avulso, que não expira no reset. */}
          <div className="mt-3.5 space-y-2">
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-medium leading-5 text-slate-500">
              {recomendado
                ? <>Estimativa, não promessa: o consumo real depende do tamanho de cada edital.
                    A régua é <strong className="text-slate-700">1 crédito a cada {numeroBr(recomendado.unidade)} caracteres
                    analisados</strong> (texto + PDFs), e a auditoria profunda multiplica.</>
                : <>Nenhum plano cobre essa rotina inteira. Assinar o maior sabendo que vai
                    faltar não resolve o seu problema — <strong className="text-slate-700">fale
                    com a gente</strong>: volume assim costuma pedir condição própria.</>}
            </p>
            <p className="rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-2.5 text-[11px] font-medium leading-5 text-amber-900">
              <strong>Se a cota acabar antes do fim do mês:</strong> as análises não param
              imediatamente — há uma margem de cortesia por nossa conta. Passada ela, elas
              continuam saindo num motor mais simples e <strong>sem auditoria profunda</strong>,
              até a renovação. Para não chegar lá, dá para comprar um pacote avulso a qualquer
              momento — créditos de pacote não expiram no reset.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Primeira linha do cartão: a quantidade de análises.
 *
 *  O tier -1 usa `monthly_limit` como cota DIÁRIA — o nome do campo no backend
 *  é herdado dos tiers pagos, mas a reposição do convidado é por dia (a tela de
 *  cota esgotada diz "volta amanhã"). Por isso o texto muda de "/mês" para
 *  "por dia" só nesse nível. `monthly_limit === 0` é ilimitado, mesma regra do
 *  `router_analyses.py`. */
function linhaQuantidade(
  tier: { tierLevel: number; quantidade: string; price: string },
  lim: LimitePublico | undefined,
): string {
  if (!lim) return tier.quantidade;
  if (lim.ilimitado) return 'Créditos ilimitados';
  const n = lim.monthly_limit;

  // CRÉDITO EM TODOS OS PLANOS, inclusive nos gratuitos.
  //
  // Eu tinha feito o substantivo depender de `em_creditos` — nos tiers -1 e 1
  // uma análise custa sempre 1 crédito, e escrevi "análises" achando que ensinar
  // o conceito não acrescentaria. O efeito colateral é que a página ficava com
  // DUAS moedas: "100 análises/mês" no Gratuito contra "540 créditos/mês" no
  // Avançado leem como sistemas diferentes, e o degrau entre eles fica
  // incomparável — o oposto do que a escada de planos precisa comunicar.
  //
  // O portão daqueles tiers debita crédito como todos os outros, então dizer
  // crédito é igualmente verdadeiro. E quem sobe de plano não aprende unidade
  // nova: recebe mais da mesma.
  const palavra = n === 1 ? 'crédito' : 'créditos';
  // "grátis" faz trabalho que "/mês" não faz num plano cujo preço já é Grátis:
  // diz que aqueles créditos são presente, não cota comprada.
  const gratis = tier.price === 'Grátis' ? ' grátis' : '';

  if (tier.tierLevel === -1) {
    return `${numeroBr(n)} ${palavra}${gratis} por dia · sem cadastro`;
  }
  // A régua junto do número. "540 créditos" sozinho não significa nada para
  // quem lê; com "edital comum usa 2 a 3" o leitor faz a conta sozinho — e a
  // conta favorece o plano de cima, que é onde ela deveria ter sido feita
  // desde o começo.
  //
  // Deliberadamente NÃO diz "≈ 180 análises": seria mais convincente e seria
  // chute, porque a média que eu usaria vem de cinco análises medidas.
  // `em_creditos` deixou de decidir o SUBSTANTIVO e passou a decidir só a
  // régua: onde o crédito varia com o tamanho, o leitor precisa saber a faixa;
  // onde é fixo, saber que é fixo vale mais que silêncio — diz que ali não há
  // surpresa de tamanho.
  // ⚠️ SEM RÉGUA AQUI — e isso é deliberado, não esquecimento.
  //
  // Esta linha já teve duas versões erradas pelo mesmo motivo: tentar explicar
  // o preço do crédito de novo, depois de `linhasLimites` já ter explicado.
  // Primeiro foi o texto fixo "edital comum usa 2 a 3", falso em quase todo
  // plano. Depois foi a faixa calculada "1 a 8 na rápida, 4 a 32 na profunda",
  // correta e ilegível — os dois números saem de "1 crédito a cada 50.000
  // caracteres · auditoria profunda ×4" cruzado com o teto do plano, ambos
  // impressos duas linhas acima.
  //
  // O cartão lê regra → capacidade → cota. Quem quer a conta tem os fatores
  // ali; quem não quer, lê três frases curtas em vez de uma longa.
  //
  // Traduzir para "20 auditorias profundas por mês" foi considerado e recusado:
  // o número cai conforme o plano sobe (43 · 31 · 20), porque cada plano é
  // medido pelo próprio edital máximo. Verdadeiro, e engana lado a lado.
  return `${numeroBr(n)} ${palavra}${gratis} por mês`;
}


/** As duas últimas linhas: caracteres e MB. Se qualquer um dos dois vier nulo,
 *  usa o par de reserva inteiro — meio número do servidor e meio escrito à mão
 *  seria pior que os dois de reserva, porque ninguém saberia qual é qual. */
function linhasLimites(
  tier: { limites: readonly string[]; mbSufixo: string },
  lim: LimitePublico | undefined,
): readonly string[] {
  if (!lim || typeof lim.max_chars !== 'number' || typeof lim.max_mb !== 'number') {
    return tier.limites;
  }
  return [
    ...(lim.em_creditos && lim.caracteres_por_credito
      // A regra completa, uma vez só. A frase curta que acompanha o número da
      // cota ("edital comum usa 2 a 3") é o resumo; esta é a definição.
      // "analisados": mesma palavra da linha de créditos do formulário —
      // texto + PDFs contam juntos. Dois lugares imprimindo a régua com
      // vocabulários diferentes é como o app acabou com quatro nomes de plano.
      ? [`1 crédito a cada ${numeroBr(lim.caracteres_por_credito)} caracteres analisados`
         + ((lim.peso_profunda ?? 1) > 1 ? ` · auditoria profunda ×${lim.peso_profunda}` : '')]
      : []),
    `Editais até ${numeroBr(lim.max_chars)} caracteres`,
    `PDF até ${numeroBr(lim.max_mb)} MB${tier.mbSufixo}`,
  ];
}

// Paleta visual por tier
const tierStyle: Record<string, Record<string, string>> = {
  '-1': {
    strip:       'bg-slate-200',
    card:        'bg-white border border-slate-200 hover:shadow-md hover:-translate-y-0.5',
    badge:       'text-slate-400',
    name:        'text-slate-700',
    price:       'text-slate-800',
    period:      'text-slate-400',
    feature:     'text-slate-500',
    check:       'text-slate-400',
    inherit:     'text-slate-400 bg-slate-50 border-slate-200',
    btn:         'bg-slate-800 text-white hover:bg-slate-700',
    btnActive:   'bg-slate-200 text-slate-500 cursor-default',
    btnOther:    'bg-slate-100 text-slate-500 hover:bg-slate-200',
    divider:     'bg-slate-100',
  },
  '1': {
    strip:       'bg-slate-300',
    card:        'bg-white border border-slate-200 hover:shadow-md hover:-translate-y-0.5',
    badge:       'text-slate-400',
    name:        'text-slate-800',
    price:       'text-slate-900',
    period:      'text-slate-400',
    feature:     'text-slate-500',
    check:       'text-slate-400',
    inherit:     'text-slate-400 bg-slate-50 border-slate-200',
    btn:         'bg-slate-900 text-white hover:bg-slate-700',
    btnActive:   'bg-emerald-100 text-emerald-700 cursor-default',
    btnOther:    'bg-slate-100 text-slate-500 hover:bg-slate-200',
    divider:     'bg-slate-100',
  },
  '2': {
    strip:       'bg-sky-500',
    card:        'bg-white border border-slate-200 hover:shadow-md hover:-translate-y-0.5',
    badge:       'text-sky-500',
    name:        'text-slate-900',
    price:       'text-slate-900',
    period:      'text-slate-400',
    feature:     'text-slate-600',
    check:       'text-sky-500',
    inherit:     'text-sky-600 bg-sky-50 border-sky-100',
    btn:         'bg-sky-600 text-white hover:bg-sky-700',
    btnActive:   'bg-emerald-100 text-emerald-700 cursor-default',
    btnOther:    'bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200',
    divider:     'bg-slate-100',
  },
  '3': {
    strip:       'bg-emerald-500',
    card:        'bg-white border border-emerald-200 shadow-xl lg:-translate-y-4 hover:shadow-2xl hover:-translate-y-5 z-10 relative',
    badge:       'text-emerald-600',
    name:        'text-slate-900',
    price:       'text-slate-900',
    period:      'text-slate-400',
    feature:     'text-slate-600',
    check:       'text-emerald-500',
    inherit:     'text-emerald-700 bg-emerald-50 border-emerald-100',
    btn:         'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200',
    btnActive:   'bg-emerald-100 text-emerald-700 cursor-default',
    btnOther:    'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200',
    divider:     'bg-emerald-100',
  },
  '4': {
    strip:       'bg-gradient-to-r from-violet-600 to-indigo-600',
    card:        'bg-slate-950 border border-slate-800 hover:shadow-xl hover:-translate-y-0.5',
    badge:       'text-violet-400',
    name:        'text-white',
    price:       'text-white',
    period:      'text-slate-400',
    feature:     'text-slate-400',
    check:       'text-violet-400',
    inherit:     'text-violet-400 bg-violet-950/50 border-violet-800',
    btn:         'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-900/40',
    btnActive:   'bg-violet-900/50 text-violet-300 cursor-default',
    btnOther:    'bg-violet-950/50 text-violet-400 hover:bg-violet-900/50 border border-violet-800',
    divider:     'bg-slate-800',
  },
};

// Nome curto dos tiers para o label "Inclui tudo do Nível N +"
const TIER_SHORT: Record<number, string> = { 1: 'Gratuito', 2: 'Essencial', 3: 'Profissional' };

/* ═══════════════════════════════════════════════════════════════════════════
 * TABELA COMPARATIVA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * O PROBLEMA QUE ELA RESOLVE
 * ──────────────────────────
 * Os cartões usam herança — "Tudo do Essencial +" — e isso é ótimo para quem
 * ESCREVE e hostil para quem LÊ. Para responder "o Profissional tem simulador
 * de preços?", a pessoa precisa abrir o cartão do Profissional, ler que ele
 * herda do Essencial, abrir o Essencial, ver que herda do Gratuito, e somar
 * três listas de cabeça enquanto rola a página. Ninguém faz isso: desiste, ou
 * chuta. Aqui cada recurso aparece uma vez, com uma coluna por plano.
 *
 * Nada foi removido dos cartões — esta seção é ADITIVA. Os cartões continuam
 * sendo a leitura rápida; a tabela é para quem precisa conferir um item
 * específico antes de pagar.
 *
 * ⚠️ O NÍVEL 0 É A BASE DE TODO MUNDO, e isso precisa de explicação.
 * No array `tiers`, o Teste tem `inherits: null` e o Gratuito TAMBÉM tem
 * `inherits: null` — a cadeia de herança só começa no Essencial. Se a tabela
 * lesse isso ao pé da letra, "Semáforo de viabilidade" apareceria com ✓ apenas
 * no Teste e com — no Avançado de R$ 497, o que é grosseiramente falso: o
 * semáforo é saída de toda análise em qualquer nível. O `null` do Gratuito
 * significa "não repita o óbvio no cartão", não "não tem". Por isso o que o
 * Teste lista entra como piso universal.
 */

/** Recursos de um nível, já somando os herdados. Ordem: do mais básico ao
 *  específico daquele plano, que é a ordem em que fazem sentido lidos juntos. */
function featuresAcumuladas(nivel: number): string[] {
  const t = tiers.find((x) => x.tierLevel === nivel);
  if (!t) return [];
  const base =
    nivel > -1
      ? [...(tiers.find((x) => x.tierLevel === -1)?.features ?? [])]
      : [];
  const herdadas = t.inherits !== null ? featuresAcumuladas(t.inherits) : [];
  const juntas = [...base, ...herdadas, ...t.features];
  return juntas.filter((f, i) => juntas.indexOf(f) === i);
}

/** Recursos que SUBSTITUEM outros ao subir de plano, em vez de somar.
 *
 *  ⚠️ SEM ISTO A TABELA MENTE POR ACÚMULO — e o render mostrou exatamente
 *  isso: como o Avançado herda tudo, a coluna dele marcava ✓ ao mesmo tempo em
 *  "5 por dia", "30 dossiês por dia", "100 dossiês por dia" e "500 dossiês por
 *  dia". Quatro tetos diários simultâneos e contraditórios para o mesmo
 *  recurso. Quantidade não se acumula: ela troca.
 *
 *  Cada cadeia lista o recurso do nível mais baixo primeiro. Quando um plano
 *  tem dois elos da mesma cadeia, só o ÚLTIMO conta como dele.
 *
 *  Lista explícita, e não heurística por texto: adivinhar "isto parece uma
 *  quantidade" erraria em silêncio no dia em que alguém escrevesse um recurso
 *  novo com número no nome. */
const CADEIAS_QUE_SUBSTITUEM: readonly (readonly string[])[] = [
  [
    'Dossiê de concorrente — motivo de inabilitação e minuta de recurso · 5 por dia',
    '30 dossiês de concorrente por dia',
    '100 dossiês por dia · 2 empresas',
    '500 dossiês por dia · 3 empresas',
  ],
  [
    'Cadastro de empresa (CNPJ) · 1 empresa',
    '100 dossiês por dia · 2 empresas',
    '500 dossiês por dia · 3 empresas',
  ],
];

/** O plano tem este recurso E ele ainda é o vigente (não foi substituído por um
 *  elo posterior da mesma cadeia que o plano também possua). */
function temRecursoVigente(nivel: number, recurso: string): boolean {
  const acumuladas = featuresAcumuladas(nivel);
  if (!acumuladas.includes(recurso)) return false;
  for (const cadeia of CADEIAS_QUE_SUBSTITUEM) {
    const i = cadeia.indexOf(recurso);
    if (i === -1) continue;
    // Existe um elo mais alto da mesma cadeia neste plano? Então este já não vale.
    if (cadeia.slice(i + 1).some((mais) => acumuladas.includes(mais))) return false;
  }
  return true;
}

/** Em que nível cada recurso APARECE pela primeira vez — é isso que decide
 *  onde a coluna ganha ✓ e onde ganha travessão. */
function mapaDeRecursos(): { recurso: string; desde: number }[] {
  const ordem = [-1, 1, 2, 3, 4];
  const visto = new Map<string, number>();
  for (const nivel of ordem) {
    for (const f of tiers.find((t) => t.tierLevel === nivel)?.features ?? []) {
      if (!visto.has(f)) visto.set(f, nivel);
    }
  }
  return [...visto.entries()].map(([recurso, desde]) => ({ recurso, desde }));
}

const NIVEIS_TABELA = [-1, 1, 2, 3, 4] as const;

function CelulaTem({ tem, escuro }: { tem: boolean; escuro?: boolean }) {
  return tem ? (
    <Check
      className={`mx-auto h-4 w-4 ${escuro ? "text-violet-400" : "text-emerald-500"}`}
      strokeWidth={3}
    />
  ) : (
    // Travessão, não X. "Não incluído" é ausência, e um X vermelho em cinco
    // linhas seguidas faz o plano de entrada parecer defeituoso em vez de menor.
    <span className="text-slate-300" aria-label="não incluído">
      —
    </span>
  );
}

function TabelaComparativa({
  limites,
  activeTier,
  recomendado,
  onEscolher,
}: {
  limites: Record<string, LimitePublico> | null;
  activeTier: number;
  recomendado: number | null;
  onEscolher: (tierLevel: number) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const recursos = mapaDeRecursos();

  const linhasDeLimite = [
    {
      rotulo: "Créditos por mês",
      valor: (n: number) => {
        const l = limites?.[String(n)];
        if (!l) return "—";
        if (l.ilimitado) return "Ilimitado";
        return n === -1
          ? `${numeroBr(l.monthly_limit)} por dia`
          : numeroBr(l.monthly_limit);
      },
    },
    {
      rotulo: "Tamanho máximo do edital",
      valor: (n: number) => {
        const l = limites?.[String(n)];
        return l?.max_chars ? `${numeroBr(l.max_chars)} car.` : "—";
      },
    },
    {
      rotulo: "PDF por envio",
      valor: (n: number) => {
        const l = limites?.[String(n)];
        return l?.max_mb ? `${numeroBr(l.max_mb)} MB` : "—";
      },
    },
    {
      rotulo: "Custo da auditoria profunda",
      valor: (n: number) => {
        const l = limites?.[String(n)];
        if (!l) return "—";
        const peso = l.peso_profunda ?? 1;
        // O peso existe no config de todo nível, mas só é acionável onde há
        // botão de modo (conta criada). Anunciar "×4" no Teste ensinaria uma
        // regra que aquele nível não tem como usar.
        return peso > 1 && n >= 1 ? `×${peso}` : "—";
      },
    },
  ];

  return (
    <section className="mb-16">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition-all hover:border-slate-300 hover:shadow-sm"
      >
        <span className="min-w-0">
          <span className="block text-sm font-black text-slate-900">
            Comparar os 5 planos lado a lado
          </span>
          <span className="mt-0.5 block text-xs font-medium text-slate-500">
            Cada recurso uma vez só, com uma coluna por plano — sem precisar
            somar “tudo do nível anterior”.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-700">
          {aberta ? "Fechar" : "Abrir"}
          <ChevronRight
            className={`h-4 w-4 transition-transform ${aberta ? "rotate-90" : ""}`}
          />
        </span>
      </button>

      {aberta && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* `overflow-x-auto` + primeira coluna `sticky`: a 360px cinco colunas
              não cabem de jeito nenhum, e empilhar a tabela destruiria a única
              coisa que ela faz de útil, que é comparar na horizontal. Rolando,
              o nome do recurso fica preso à esquerda e o dado nunca perde o
              rótulo. */}
          {/* ⚠️ `relative` NÃO É DECORATIVO. Sem ele, este contêiner é
              `position: static` e portanto NÃO é bloco de contenção dos
              descendentes absolutos — e as legendas `sr-only` de cada célula
              (que o Tailwind posiciona com `absolute`) escapavam do recorte,
              esticando a PÁGINA INTEIRA em 311px a 390px de largura. A tabela
              rolava por dentro certinho e mesmo assim o site inteiro deslizava
              na horizontal. */}
          <div className="relative overflow-x-auto">
            {/* `border-separate border-spacing-0` e não `border-collapse`:
                no Chromium, `position: sticky` em `th`/`td` é IGNORADO quando a
                tabela usa `border-collapse: collapse`. Medido — a primeira
                coluna acompanhava a rolagem em vez de ficar presa, e aí a
                pessoa via ✓ e — sem saber de que recurso eram. */}
            <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="bg-slate-50 [&>th]:border-b [&>th]:border-slate-200">
                  <th
                    scope="col"
                    className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    Recurso
                  </th>
                  {NIVEIS_TABELA.map((n) => {
                    const t = tiers.find((x) => x.tierLevel === n);
                    const ehRecomendado = recomendado === n;
                    return (
                      <th
                        key={n}
                        scope="col"
                        className={`min-w-[7.5rem] px-3 py-3 text-center align-bottom ${
                          ehRecomendado ? "bg-emerald-50" : ""
                        }`}
                      >
                        <span className="block text-xs font-black text-slate-900">
                          {t?.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                          {t?.price}
                          {t?.period}
                        </span>
                        {activeTier === n && (
                          <span className="mt-1 inline-block rounded-full border border-slate-300 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-slate-500">
                            Seu plano
                          </span>
                        )}
                        {ehRecomendado && activeTier !== n && (
                          <span className="mt-1 inline-block rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">
                            Sugerido
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                <tr className="bg-white [&>th]:border-b [&>th]:border-slate-100">
                  <th
                    colSpan={6}
                    scope="colgroup"
                    /* Sem `sticky` aqui, ao contrário das linhas de recurso:
                       esta célula tem colSpan={6} e portanto já ocupa a largura
                       inteira da tabela — não sobra deslocamento para ela
                       "grudar". A classe daria a impressão de fazer algo e não
                       faria nada. */
                    className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    O que está incluído
                  </th>
                </tr>
                {recursos.map(({ recurso, desde }) => (
                  <tr
                    key={recurso}
                    className="hover:bg-slate-50/60 [&>*]:border-b [&>*]:border-slate-50 last:[&>*]:border-0"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 max-w-[18rem] bg-white px-4 py-2.5 text-[11px] font-medium leading-snug text-slate-600"
                    >
                      {recurso}
                    </th>
                    {NIVEIS_TABELA.map((n) => (
                      <td
                        key={n}
                        className={`px-3 py-2.5 text-center text-[11px] font-bold ${
                          recomendado === n ? "bg-emerald-50/60" : ""
                        }`}
                      >
                        <CelulaTem
                          tem={temRecursoVigente(n, recurso)}
                          escuro={n === 4}
                        />
                        <span className="sr-only">
                          {temRecursoVigente(n, recurso)
                            ? `incluído${desde === n ? " (novo neste plano)" : ""}`
                            : "não incluído"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}

                <tr className="bg-white [&>th]:border-y [&>th]:border-slate-100">
                  <th
                    colSpan={6}
                    scope="colgroup"
                    /* Sem `sticky` aqui, ao contrário das linhas de recurso:
                       esta célula tem colSpan={6} e portanto já ocupa a largura
                       inteira da tabela — não sobra deslocamento para ela
                       "grudar". A classe daria a impressão de fazer algo e não
                       faria nada. */
                    className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    Limites
                  </th>
                </tr>
                {linhasDeLimite.map(({ rotulo, valor }) => (
                  <tr
                    key={rotulo}
                    className="hover:bg-slate-50/60 [&>*]:border-b [&>*]:border-slate-50 last:[&>*]:border-0"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white px-4 py-2.5 text-[11px] font-medium leading-snug text-slate-600"
                    >
                      {rotulo}
                    </th>
                    {NIVEIS_TABELA.map((n) => (
                      <td
                        key={n}
                        className={`px-3 py-2.5 text-center text-[11px] font-bold tabular-nums text-slate-700 ${
                          recomendado === n ? "bg-emerald-50/60" : ""
                        }`}
                      >
                        {valor(n)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-slate-50/70 [&>*]:border-t [&>*]:border-slate-200">
                  <td className="sticky left-0 z-10 bg-slate-50/70 px-4 py-3" />
                  {NIVEIS_TABELA.map((n) => (
                    <td
                      key={n}
                      className={`px-3 py-3 text-center ${recomendado === n ? "bg-emerald-50" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => onEscolher(n)}
                        disabled={activeTier === n}
                        className={`w-full rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all disabled:cursor-default ${
                          activeTier === n
                            ? "bg-emerald-100 text-emerald-700"
                            : recomendado === n
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {activeTier === n
                          ? "Atual"
                          : n <= 1
                            ? "Começar"
                            : "Assinar"}
                      </button>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[11px] font-medium leading-relaxed text-slate-500">
            Os limites vêm da mesma fonte que o sistema aplica na hora de
            cobrar. O que o Teste oferece é a base de todos os planos — os
            cartões acima só não repetem esses itens para não ficarem longos.
          </p>
        </div>
      )}
    </section>
  );
}


export default function PricingSection({ onRegister, onUpgrade, onChangePlan, currentTier: propCurrentTier, compact = false }: PricingSectionProps) {
  const router = useRouter();

  const { tier: hookTier, isPromo, promoExpiresAt, refresh: refreshTier } = useTier();
  const activeTier = propCurrentTier && propCurrentTier > 0 ? propCurrentTier : hookTier;

  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isSyncing, setIsSyncing]                 = useState(false);
  const [showUpgradeModal, setShowUpgradeModal]   = useState(false);
  const [selectedTier, setSelectedTier]           = useState<number>(1);
  const [stripeSecret, setStripeSecret]           = useState<string | null>(null);
  const [checkoutError, setCheckoutError]         = useState<string | null>(null);
  // `null` = ainda não sei. Enquanto não souber, cada cartão exibe o texto de
  // reserva — nunca um número pela metade.
  const [limitesPublicos, setLimitesPublicos] = useState<Record<string, LimitePublico> | null>(null);
  // Nível que o simulador recomendou. Mora aqui, e não dentro dele, porque o
  // destaque precisa alcançar os cartões e a tabela — irmãos, não filhos, do
  // simulador.
  const [nivelSugerido, setNivelSugerido] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/tiers/limites-publicos`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.tiers) setLimitesPublicos(d.tiers); })
      .catch(() => { /* servidor fora: os textos de reserva seguem valendo */ });
  }, []);

  const showCheckoutError = (msg: string) => {
    setCheckoutError(msg);
    setTimeout(() => setCheckoutError(null), 5000);
  };

  const forceManualSync = async () => {
    const token = getAuthToken();
    if (!token) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/sync?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache, no-store' },
      });
      const data = await res.json();
      if (res.ok && data.tier !== undefined) {
        localStorage.setItem('bawzi_tier', String(data.tier));
        localStorage.setItem('bawzi_tier_ts', String(Date.now()));
        window.location.reload();
      }
    } catch { /* silencioso */ } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem('returning_from_portal') === 'true') {
      sessionStorage.removeItem('returning_from_portal');
      forceManualSync();
    } else if (!propCurrentTier) {
      refreshTier();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegisterClick = () => {
    if (onRegister) onRegister();
    else router.push('/login');
  };

  const handleManageSubscription = () => {
    sessionStorage.setItem('goto_section', 'sec-assinatura');
    router.push('/profile');
  };

  // Inicia checkout para usuário não-assinante
  const handleUpgradeClick = async (tier: number) => {
    if (onUpgrade) { onUpgrade(tier); return; }

    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }

    setSelectedTier(tier);
    setIsCheckoutLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.updated) {
          await forceManualSync();
        } else if (data.url) {
          sessionStorage.setItem('returning_from_portal', 'true');
          const navTimeout = setTimeout(() => {
            setIsCheckoutLoading(false);
            showCheckoutError('Redirecionamento demorou. Tente novamente ou acesse o portal pelo perfil.');
          }, 8000);
          window.addEventListener('beforeunload', () => clearTimeout(navTimeout), { once: true });
          window.location.href = data.url;
        } else if (data.client_secret) {
          setStripeSecret(data.client_secret);
          setShowUpgradeModal(true);
          setIsCheckoutLoading(false);
        } else {
          setIsCheckoutLoading(false);
          showCheckoutError(data.detail || 'Erro inesperado ao processar o pagamento. Tente novamente.');
        }
      } else {
        throw new Error(mensagemDeErro(data.detail, 'Erro no processamento'));
      }
    } catch {
      setIsCheckoutLoading(false);
      showCheckoutError('Erro de ligação ao servidor. Tente novamente.');
    }
  };

  // Decide a ação do botão de cada card
  const handleCardButton = (tierLevel: number) => {
    if (tierLevel === -1) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (tierLevel === 1)  { handleRegisterClick(); return; }

    // Plano atual do assinante pago
    if (!isPromo && tierLevel === activeTier) { handleManageSubscription(); return; }

    // Assinante pago clicando em outro plano pago → modal de troca
    if (!isPromo && activeTier > 1 && tierLevel > 1) {
      if (onChangePlan) { onChangePlan(tierLevel); return; }
      // Fallback: redireciona para o perfil quando não há modal disponível
      handleManageSubscription();
      return;
    }

    // Usuário gratuito clicando em plano pago
    handleUpgradeClick(tierLevel);
  };

  // Texto do botão de cada card
  const buttonLabel = (tier: typeof tiers[number], isActivePaid: boolean, isPromoActive: boolean): string => {
    if (isPromoActive)  return 'Assinar e manter acesso';
    if (isActivePaid)   return '✓ Plano Atual';
    if (!isPromo && activeTier > 1 && tier.tierLevel > 1 && tier.tierLevel !== activeTier) {
      return tier.tierLevel > activeTier ? '↑ Fazer upgrade' : '↓ Fazer downgrade';
    }
    return tier.buttonText;
  };

  /** UM cartão de plano.
   *
   *  Extraído para função porque a grade passou a ter DOIS grupos (entrada e
   *  pagos). Duplicar ~120 linhas de JSX entre eles garantiria que um dia
   *  divergissem — mexe-se num, esquece o outro, e a página passa a mostrar
   *  dois desenhos de cartão lado a lado. O conteúdo aqui é exatamente o que
   *  já existia; nada foi retirado. */
  const renderCartao = (tier: (typeof tiers)[number]) => {
          const s            = tierStyle[String(tier.tierLevel)];
          const isActivePaid = !isPromo && tier.tierLevel === activeTier;
          const isPromoActive= isPromo  && tier.tierLevel === activeTier;
          const isOtherPaid  = !isPromo && activeTier > 1 && tier.tierLevel > 1 && tier.tierLevel !== activeTier;

          return (
            <div
              key={tier.tierLevel}
              className={`rounded-2xl flex flex-col transition-all duration-300 overflow-hidden ${s.card}
                ${isActivePaid  ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}
                ${isPromoActive ? 'ring-2 ring-violet-400 ring-offset-2'  : ''}`}
            >
              {/* Faixa colorida */}
              <div className={`h-1 w-full ${s.strip}`} />

              {/* Cabeçalho */}
              <div className="px-5 pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${s.badge}`}>
                    {tier.badge}
                  </span>
                  {tier.label && (
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border
                      ${tier.tierLevel === 3
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                      {tier.label}
                    </span>
                  )}
                </div>
                <h3 className={`text-[18px] font-black leading-tight ${s.name}`}>{tier.name}</h3>
                <div className="flex items-baseline gap-0.5 mt-2">
                  <span className={`text-[24px] font-black leading-none ${s.price}`}>{tier.price}</span>
                  {tier.period && (
                    <span className={`text-[12px] font-medium ${s.period}`}>{tier.period}</span>
                  )}
                </div>
              </div>

              {/* Separador */}
              <div className={`h-px mx-5 ${s.divider}`} />

              {/* Features */}
              <ul className="px-5 py-4 space-y-2 flex-1">
                {/* Tag de progressão — "Tudo do Nível N +" */}
                {tier.inherits !== null && (
                  <li className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide rounded-lg px-2 py-1.5 border mb-1 ${s.inherit}`}>
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    Tudo do {TIER_SHORT[tier.inherits]} +
                  </li>
                )}

                {/* ⚠️ ORDEM IMPORTA, e eu tinha errado.
                    A quantidade era o PRIMEIRO item de todo cartão — ou seja, a
                    página abria cada plano pelo número que cresce mais devagar
                    que o preço (1,65 crédito por real no Essencial contra 1,09
                    nos de cima). Lido primeiro, o degrau parece um downgrade.

                    O que faz alguém pagar R$ 497 em vez de R$ 197 é War Room,
                    pipeline e simulador — não cota. Capacidade em cima, cota e
                    limites técnicos no fim, onde eles são referência e não
                    argumento. */}
                {[
                  ...tier.features,
                  ...linhasLimites(tier, limitesPublicos?.[String(tier.tierLevel)]),
                  linhaQuantidade(tier, limitesPublicos?.[String(tier.tierLevel)]),
                ].map((feature, i) => (
                  <li key={i} className={`flex items-start gap-2 text-[11px] font-medium leading-snug ${s.feature}`}>
                    <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${s.check}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Botão */}
              <div className="px-5 pb-5 pt-1 space-y-2">
                {isPromoActive && (
                  <div className="flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg">
                    <Sparkles className="w-2.5 h-2.5" />
                    Acesso via convite ativo
                  </div>
                )}
                <button
                  onClick={() => handleCardButton(tier.tierLevel)}
                  disabled={isActivePaid && !onChangePlan}
                  className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.98]
                    ${isActivePaid
                      ? s.btnActive
                      : isPromoActive
                        ? 'bg-violet-600 text-white hover:bg-violet-700'
                        : isOtherPaid
                          ? s.btnOther
                          : s.btn}`}
                >
                  {buttonLabel(tier, isActivePaid, isPromoActive)}
                </button>
              </div>
            </div>
          );
  };

  return (
    <>
      {checkoutError && (
        <div className="fixed bottom-5 right-5 z-[200] max-w-sm rounded-2xl border bg-red-50 border-red-200 text-red-800 px-4 py-3 text-sm font-semibold shadow-xl">
          {checkoutError}
        </div>
      )}

      {/* Banner: Convite Promocional */}
      {isPromo && (
        <div className="flex flex-wrap items-center gap-3 bg-violet-50 border border-violet-200 px-5 py-4 rounded-2xl mb-6">
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-violet-700 bg-violet-100 border border-violet-200 px-2.5 py-1 rounded-lg">
              Convite Promocional
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-violet-900">
              Você tem acesso completo ao plano <strong>Avançado</strong> via convite.
            </p>
            {promoExpiresAt && (
              <p className="flex items-center gap-1 text-[11px] text-violet-500 font-medium mt-0.5">
                <CalendarClock className="w-3 h-3" />
                Expira em {new Date(promoExpiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                {' '}— assine abaixo para manter o acesso.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Banner: Assinatura Paga Ativa
          ⚠️ `!compact`: NO WORKSPACE ELE VINHA COLADO NO RESUMO LOGO ABAIXO, e
          os dois diziam a mesma coisa. "Assinatura Ativa · Nível 4 — acesso
          total aos recursos premium" seguido de "Seu plano · Nível 4 —
          Avançado", um encostado no outro, com três botões repartidos entre
          eles. Contando a página inteira, o nível do plano aparecia QUATRO
          vezes: o selo do hero, o crachá da barra lateral, e estes dois.
          Na página /plans (fora do modo compacto) o banner continua — lá ele é
          a única coisa que diz que a assinatura está em dia, e a grade abaixo
          é de venda, não de estado. */}
      {activeTier > 1 && !isPromo && !compact && (
        <div className="flex flex-wrap items-center gap-3 bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-2xl mb-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
            Assinatura Ativa
          </span>
          <p className="text-[12px] font-semibold text-emerald-800 flex-1 min-w-0">
            Nível {activeTier} — acesso total aos recursos premium.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={forceManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded-xl hover:bg-emerald-50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando…' : 'Atualizar'}
            </button>
            <button
              onClick={handleManageSubscription}
              className="px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-black rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
            >
              Gerenciar ↗
            </button>
          </div>
        </div>
      )}

      {/* Resumo compacto — usado no workspace, sem repetir a grade completa a
          cada visita. Recebeu os dois botões do banner de assinatura acima:
          UMA linha, o nível dito UMA vez, e as três ações que existiam
          continuam existindo, agora lado a lado. */}
      {compact && (
        <div className="mb-10 flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Seu plano
              {activeTier > 1 && !isPromo && (
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700">
                  Assinatura ativa
                </span>
              )}
            </p>
            <p className="mt-0.5 text-sm font-black text-slate-900">
              {activeTier > 0
                ? `Nível ${activeTier} — ${tiers.find((t) => t.tierLevel === activeTier)?.name || ''}`
                : 'Nível 0 — Teste gratuito'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeTier > 1 && !isPromo && (
              <>
                <button
                  onClick={forceManualSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-bold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando…' : 'Atualizar'}
                </button>
                <button
                  onClick={handleManageSubscription}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-bold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
                >
                  Gerenciar ↗
                </button>
              </>
            )}
            <Link
              href="/plans"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700"
            >
              Ver todos os planos <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Simulador ANTES dos cartões, e não depois: a pergunta que trava a
          decisão é "qual deles é o meu", e cinco colunas de recurso não
          respondem isso. Fica fora do modo `compact` (o resumo dentro do app,
          onde a pessoa já assinou e a pergunta é outra). */}
      {!compact && (
        <SimuladorDePlano
          limites={limitesPublicos}
          activeTier={activeTier}
          onEscolher={handleCardButton}
          onRecomendado={setNivelSugerido}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          GRADE DE PLANOS — AGRUPADA, NÃO MAIS CINCO COLUNAS IGUAIS
          ═══════════════════════════════════════════════════════════════════

          ⚠️ NENHUM CARTÃO FOI REMOVIDO. Os cinco continuam, com exatamente o
          mesmo conteúdo — mudou a diagramação.

          `lg:grid-cols-5` num contêiner de 1400px dava ~253px por cartão para
          ler recurso em `text-[11px]`, e punha lado a lado duas coisas que não
          competem entre si: dois níveis de EXPERIMENTAÇÃO (Teste, sem cadastro;
          Gratuito) e três de ASSINATURA. Cinco opções paralelas para uma decisão
          que na prática é binária — "eu testo ou eu compro?" — só adicionam
          trabalho, e o cartão mais popular acabava com a mesma largura do teste
          sem cadastro.

          Agora são dois grupos, na mesma ordem crescente de sempre: a dupla de
          entrada num par estreito, e os três pagos em colunas largas, onde a
          lista de recursos cabe sem espremer. */}
      {!compact && (
      <div className="mb-6">
        <div className="mb-3 flex items-baseline gap-2">
          <h3 className="text-sm font-black text-slate-900">Conhecer sem pagar</h3>
          <span className="text-xs font-medium text-slate-500">
            para validar com um edital real antes de decidir
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-[46rem]">
          {tiers.filter((t) => t.tierLevel <= 1).map(renderCartao)}
        </div>
      </div>
      )}

      {/* Planos com assinatura — três colunas largas.
          Sem o antigo `items-end`: alinhados pelo rodapé, os cabeçalhos ficavam
          em alturas diferentes conforme o número de recursos, e comparar preço
          exigia caçar o preço de cada cartão em vez de correr o olho por uma
          linha só. */}
      {!compact && (
      <div className="mb-10">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h3 className="text-sm font-black text-slate-900">Planos com assinatura</h3>
          <span className="text-xs font-medium text-slate-500">
            cancelamento a qualquer momento, pelo próprio painel
          </span>
          {/* Fecha o ciclo do simulador: ele responde "qual é o meu" lá em cima,
              e aqui o mesmo plano aparece nomeado, na hora de clicar. */}
          {nivelSugerido && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              <Check className="h-3 w-3" />
              Simulação sugere: {tiers.find((t) => t.tierLevel === nivelSugerido)?.name}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5">
          {tiers.filter((t) => t.tierLevel >= 2).map(renderCartao)}
        </div>
      </div>
      )}

      {!compact && (
        <TabelaComparativa
          limites={limitesPublicos}
          activeTier={activeTier}
          recomendado={nivelSugerido}
          onEscolher={handleCardButton}
        />
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false);
          setStripeSecret(null);
          forceManualSync();
        }}
        tier={selectedTier}
        clientSecret={stripeSecret}
      />

      {isCheckoutLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-[90%] mx-auto text-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-violet-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-violet-600 rounded-full border-t-transparent animate-spin" />
              <Lock className="absolute inset-0 m-auto text-violet-600" size={24} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Ambiente Seguro</h3>
            <p className="text-slate-500 font-medium leading-relaxed">A Sincronizar com o Stripe...</p>
          </div>
        </div>
      )}
    </>
  );
}
