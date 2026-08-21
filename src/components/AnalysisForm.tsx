'use client';

/**
 * AnalysisForm.tsx
 * Card de submissão do edital: textarea, drag-and-drop de ficheiros,
 * seletor de modo (rápida | profunda) e botões de análise.
 */

import React, { useEffect, useState } from 'react';
import {
  Zap, FolderOpen, FileText, ScanSearch, BrainCircuit,
  AlertTriangle, CheckCircle2, UploadCloud, ShieldCheck, Clock3,
  RefreshCw, Coins, ArrowRight,
} from 'lucide-react';
import { formatMB } from './analysis-types';

import ResumoCreditos, { BOTAO_PRIMARIO } from './ResumoCreditos';
import Tooltip from './Tooltip';
import { useTierConfig } from '../Contexts/TierContext';

export interface QuotaInfo {
  tier: number;
  ilimitado: boolean;
  limite: number;
  usado: number;
  restante: number | null;
  reseta_em: string;       // "YYYY-MM-DD"
  dias_para_reset: number;
  /** Bônus do plano no ciclo. Já vem SOMADO em `saldo` e descontado em
   *  `usado` — exibir como carteira separada conta o mesmo crédito duas
   *  vezes. É consumido ANTES do crédito do plano e expira no reset. */
  bonus?: number;
  bonus_usado?: number;
  bonus_restante?: number;
  /** Quanto uma auditoria profunda debita. 1 = os dois modos custam igual
   *  neste plano (Explorador e Gratuito usam o mesmo par de modelos). */
  peso_profunda?: number;
  /** Caracteres que valem 1 crédito. A cobrança é contínua:
   *  `teto(caracteres ÷ unidade) × multiplicador`. */
  caracteres_por_credito?: number;
  /** Maior edital que o plano aceita — define quantos créditos uma análise
   *  pode chegar a custar naquele plano. */
  max_chars?: number;
  /** `creditos` quando o crédito pode diferir de 1 por análise — por peso de
   *  modo OU por faixa de tamanho. Opcional porque a cota de convidado é
   *  montada no cliente e não passa pelo endpoint. */
  unidade?: 'creditos' | 'analises';
  /** Coeficientes de custo vindos do backend. A tela avalia uma soma; os
   *  PREÇOS e os MODELOS ficam no servidor. Ausente = régua antiga. */
  precificacao?: {
    credito_usd: number;
    chars_por_bloco: number;
    sobreposicao_bloco: number;
    rapida: { fixo_usd: number; por_char_usd: number; por_bloco_usd: number };
    profunda: { fixo_usd: number; por_char_usd: number; por_bloco_usd: number };
  } | null;
  /** Sublimite de auditorias profundas do período (null = plano sem
   *  sublimite, o caso comum). Vem da MESMA conta do portão que degrada a
   *  profunda para o motor gratuito — existe para o card avisar ANTES do
   *  clique, em vez de o cliente descobrir no banner minutos depois. */
  sublimite_profunda?: {
    limite: number;
    usadas: number;
    restantes: number;
    atingido: boolean;
  } | null;
  /** Cota do plano + pacotes avulsos comprados. É contra ISTO que o portão
   *  decide, não contra `limite`. */
  saldo?: number;
  /** Créditos avulsos comprados no período. */
  creditos_extras?: number;
  /** Até onde a cortesia vai antes de qualquer degradação. */
  teto_cortesia?: number | null;
  /** Já passou do saldo, mas ainda dentro da cortesia — tudo funciona. */
  em_cortesia?: boolean;
  /** Créditos que a casa serviu ACIMA do saldo neste período. Não debitam
   *  nada — nem agora, nem quando o cliente comprar um pacote. Existe para
   *  medir o quanto da cortesia já foi usada (e para poder dizer isso na tela,
   *  em vez de a folga sumir sem explicação). */
  cortesia_usada?: number;
  /** Tudo que rodou no período, cobrado ou não. `usado` + `cortesia_usada`. */
  consumo_total?: number;
  /** Passou da cortesia: a análise ainda RODA, mas no motor do plano
   *  gratuito e sem auditoria. Nada é bloqueado em momento nenhum. */
  profunda_pausada?: boolean;
}

interface AnalysisFormProps {
  text: string;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  files: File[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (idx: number) => void;
  currentCharLimit: number;
  currentFileLimitMB: number;
  isAnalyzing: boolean;
  token: string | null;
  userTier: number;
  error: string | null;
  successMsg: string | null;
  provider: string;
  onProviderChange: (p: string) => void;
  onAnalyze: (motor: 'openai' | 'claude') => void;
  onShowAuthModal: (mode: 'login' | 'register') => void;
  quota?: QuotaInfo | null;
  onUpgradeClick?: () => void;
  /** Abre a compra de pacote avulso de créditos. */
  onComprarPacote?: () => void;
  /** ETA MEDIDO por modo (mediana das últimas análises do mesmo perfil, do
   *  useAnalysis). Presente, substitui os rótulos genéricos ("vários
   *  minutos") pelo número real — recalcula a cada tecla, porque o perfil
   *  inclui o tamanho do texto. */
  estimarSegundos?: (motor: 'openai' | 'claude') => number;
  /** Há um edital do PNCP selecionado. O servidor vai BAIXAR os anexos
   *  oficiais (edital + termo de referência + …) e cobrar sobre o texto
   *  completo, que é bem maior que o colado na tela. Sem isto o selo
   *  anunciava um preço fechado e o portão debitava outro — foi o que
   *  aconteceu num edital de 325 mil caracteres: tela "2 créditos",
   *  cobrança 21. Com a flag, o preço vira "a partir de N". */
  origemPncp?: boolean;
}

/** 95 → "~2 min" · 40 → "~40 s". Arredonda para cima no minuto: prometer
 *  menos e entregar antes é a direção certa da surpresa. */
function fmtETA(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return '';
  if (segundos < 100) return `~${Math.round(segundos)} s`;
  return `~${Math.ceil(segundos / 60)} min`;
}

// ─── Tempo estimado honesto ───────────────────────────────────────────────────
// ANTES o card prometia "triagem em segundos". O próprio estimador do
// useAnalysis (getEstimateSeconds) calcula 30-45s sem agentes de mercado e
// 55-130s com eles — ou seja, a promessa era desmentida pela primeira execução,
// no primeiro minuto de uma demonstração. "Normalmente" mantém a afirmação
// verdadeira mesmo quando o PNCP está lento.
function tempoEstimadoLabel(token: string | null, userTier: number): string {
  const comAgentesDeMercado = Boolean(token) && userTier >= 2;
  return comAgentesDeMercado
    ? 'normalmente de 1 a 2 minutos'
    : 'normalmente menos de 1 minuto';
}

/** Créditos que ESTA análise vai debitar.
 *
 *  Espelha `custo_em_creditos` em `backend/app/core/modos.py`:
 *      teto(caracteres ÷ unidade) × multiplicador,  mínimo 1
 *
 *  ⚠️ São duas implementações da mesma conta, e isso é uma dívida consciente:
 *  o número precisa recalcular a cada tecla, e uma chamada por tecla ao
 *  servidor seria pior. Se a fórmula do backend mudar, esta muda junto — é a
 *  única função do front que precisa disso, e por isso ela está sozinha aqui
 *  em vez de espalhada pelos dois botões.
 *
 *  Devolve `null` quando a quota ainda não chegou: melhor não dizer preço
 *  nenhum do que dizer um preço errado numa cotação que é firme.
 */
function creditosDe(caracteres: number, modo: 'rapida' | 'profunda',
                    quota?: QuotaInfo | null): number | null {
  // ── Caminho novo: o crédito mede CUSTO ────────────────────────────────
  // O backend manda coeficientes; aqui só se avalia a soma. Nada de modelo
  // nem de tabela de preços no frontend — se um preço mudar no Admin, este
  // número muda junto no próximo carregamento, sem release.
  const pr = quota?.precificacao;
  if (pr && pr.credito_usd > 0) {
    const c = modo === 'profunda' ? pr.profunda : pr.rapida;
    let usd = c.fixo_usd + c.por_char_usd * Math.max(0, caracteres);
    if (modo === 'profunda' && c.por_bloco_usd > 0) {
      // Espelha `auditoria.segmentar`: blocos com sobreposição.
      const passo = Math.max(1, pr.chars_por_bloco - pr.sobreposicao_bloco);
      const blocos = caracteres > 0
        ? Math.max(1, Math.ceil(Math.max(0, caracteres - pr.sobreposicao_bloco) / passo))
        : 0;
      usd += c.por_bloco_usd * blocos;
    }
    return Math.max(1, Math.ceil(usd / pr.credito_usd));
  }

  // ── Fallback: régua antiga por tamanho ───────────────────────────────
  // Vale enquanto o backend não devolver `precificacao` (deploy em andamento,
  // ou falha na estimativa). Mostrar o preço velho é melhor do que não
  // mostrar preço nenhum numa cotação que é firme.
  const unidade = quota?.caracteres_por_credito;
  if (!unidade || unidade <= 0) return null;
  const base = Math.max(1, Math.ceil(caracteres / unidade));
  return modo === 'profunda' ? base * (quota?.peso_profunda ?? 1) : base;
}

// ─── Indicador de quota mensal ────────────────────────────────────────────────

/** Convite para o próximo degrau — com os números do degrau, não com adjetivos.
 *
 *  "Faça upgrade e tenha mais benefícios" não move ninguém: não diz o que muda.
 *  Aqui a promessa é aritmética e sai da MESMA configuração que o backend
 *  aplica (`/api/tiers/config` → TierContext). Escrever "80.000 caracteres" à
 *  mão aqui faria a promessa envelhecer sozinha no dia em que o Admin mexesse
 *  no plano — e prometer um limite que o produto não entrega é pior do que
 *  não prometer nada.
 *
 *  O visitante é a exceção do destino: mandá-lo direto ao plano de topo pula
 *  o degrau que não custa nada e é o que ele consegue dar agora. Dos demais
 *  para cima, o convite é para o topo.
 */
/** Existe degrau acima do plano de agora? Uma fonte só.
 *
 *  ⚠️ ESTA PERGUNTA PRECISA SER RESPONDIDA EM DOIS LUGARES: quem DESENHA o
 *  convite (`EscadaDePlanos`) e quem decide se a barra de cota inteira sequer
 *  aparece (`quotaPedeAtencao`). Copiar a conta para o segundo lugar é como o
 *  filtro de UF acabou espalhado por sete campos: no dia em que o topo deixar
 *  de ser o nível 4, um dos dois continua certo e o outro passa a esconder um
 *  convite que existe — ou a reservar espaço para um que não existe.
 */
function useProximoDegrau(isGuest: boolean, tierAtual: number, habilitado: boolean) {
  const { tierLimits, tierCredits, tierNames } = useTierConfig();
  const niveis = Object.keys(tierLimits).map(Number).filter(t => t >= 1).sort((a, b) => a - b);
  const topo = niveis.length ? niveis[niveis.length - 1] : 4;
  const atual = isGuest ? -1 : tierAtual;
  if (!habilitado || atual >= topo) return null;   // já está no topo: nada a oferecer
  return { destino: isGuest ? (niveis[0] ?? 1) : topo, atual, tierLimits, tierCredits, tierNames };
}

function EscadaDePlanos({ isGuest, tierAtual, onUpgradeClick }: {
  isGuest: boolean;
  tierAtual: number;
  onUpgradeClick?: (tier?: number) => void;
}) {
  const degrau = useProximoDegrau(isGuest, tierAtual, !!onUpgradeClick);
  if (!degrau || !onUpgradeClick) return null;
  const { destino, atual, tierLimits, tierCredits, tierNames } = degrau;

  const num = (v: number | undefined) => Number(v || 0).toLocaleString('pt-BR');
  const nome = tierNames[destino] || (isGuest ? 'Gratuito' : 'Avançado');

  // Só entra na lista o que MELHORA de verdade em relação ao plano de agora.
  const ganhos: string[] = [];
  const creditosDestino = tierCredits[destino];
  if (creditosDestino === 0) ganhos.push('créditos ilimitados');
  else if (creditosDestino) {
    // "créditos" também para o convidado: a plataforma inteira fala UMA moeda
    // (o card do taster e a tela de cota já dizem "crédito") — misturar
    // "análises" aqui reintroduzia a segunda moeda que a página de planos
    // acabou de eliminar.
    ganhos.push(isGuest
      ? `${num(creditosDestino)} créditos grátis por mês (hoje é 1 por dia)`
      : `${num(creditosDestino)} créditos por mês`);
  }
  if (tierLimits[destino] > (tierLimits[atual] ?? 0)) {
    ganhos.push(`editais até ${num(tierLimits[destino])} caracteres`);
  }
  ganhos.push(isGuest ? 'histórico salvo e Matchmaker por CNAE' : 'auditoria profunda sem sublimite');

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black text-emerald-900">
          {isGuest ? 'Crie sua conta gratuita' : `Suba para o ${nome}`}
        </p>
        <p className="mt-0.5 text-[10px] leading-4 text-emerald-800/80">
          {ganhos.join(' · ')}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onUpgradeClick(destino)}
        className={BOTAO_PRIMARIO}
      >
        {isGuest ? 'Criar conta' : `Ir para o ${nome}`}
        <ArrowRight size={12} />
      </button>
    </div>
  );
}

/** A régua da cobrança — como um crédito vira dinheiro.
 *
 * ⚠️ ERA UM PARÁGRAFO FIXO NO MEIO DO CAMINHO. Ficava dentro da `QuotaBar`,
 * entre o campo de anexo e os cartões de modo, e portanto entre "colei o
 * edital" e "analisar". Mas é uma fórmula: não muda de uma análise para a
 * outra, e quem usa a ferramenta todo dia já a conhece na terceira vez. O
 * número que de fato importa na hora de decidir — o custo DESTE pedido — já
 * está no `SeloCusto`, dentro de cada cartão de modo, calculado sobre o texto
 * que está na tela.
 *
 * Então a fórmula virou sob demanda, atrás do mesmo `Tooltip` usado na "Busca
 * exata" do Radar. Continua inteira, continua a um clique, e parou de cobrar
 * duas linhas de leitura de quem já sabe.
 */
function ReguaDeCobranca({ quota, isGuest = false }: { quota: QuotaInfo; isGuest?: boolean }) {
  // Só quando o peso muda alguma coisa. Nos planos em que os dois modos usam o
  // mesmo par de modelos o backend devolve `unidade: "analises"`, e não há
  // conceito novo para ensinar.
  if (isGuest || quota.unidade !== 'creditos') return null;

  return (
    <>
      {/* `?.credito_usd` e não só truthiness: com a régua FIXA ativa o backend
          manda `{}` em `precificacao`, que é truthy — e a frase da régua
          dinâmica apareceria descrevendo uma cobrança que não está valendo.
          A régua fixa é a do lançamento. */}
      {quota.precificacao?.credito_usd ? (
        /* Régua NOVA: o crédito mede custo, não caracteres. A frase antiga
           ("1 crédito a cada 50.000 caracteres · profunda multiplica por 4")
           descrevia uma fórmula que não existe mais — e uma explicação errada
           da cobrança é pior do que nenhuma. */
        <>
          O crédito acompanha o custo real da análise: edital maior e
          auditoria profunda consomem mais. O preço exato aparece em cada
          botão antes de você enviar.
        </>
      ) : (
        <>
          {/* "analisados (texto + PDFs)" e não só "caracteres": a cobrança
              soma texto colado + PDFs anexados + arquivos do PNCP, mas o
              contador da caixa só mede o que foi digitado. Sem dizer a base de
              cálculo, quem cola 20 mil caracteres lê "1 crédito", anexa um PDF
              grande e é debitado em 4× — a régua certa com a frase incompleta
              produz a mesma surpresa que uma régua errada (foi exatamente o
              mecanismo do bug do "+2 créditos"). */}
          {!!quota.caracteres_por_credito && (
            <>1 crédito a cada {quota.caracteres_por_credito.toLocaleString('pt-BR')} caracteres analisados (texto + PDFs contam juntos){' · '}</>
          )}
          {(quota.peso_profunda ?? 1) > 1
            ? <>auditoria profunda multiplica por {quota.peso_profunda}</>
            : <>os dois modos custam igual neste plano</>}
        </>
      )}
    </>
  );
}

function QuotaBar({
  quota,
  onUpgradeClick,
  onComprarPacote,
  isGuest = false,
  semCarteira = false,
}: {
  quota: QuotaInfo;
  /** Recebe o tier de destino. Sem o parâmetro, o chamador decide — era assim
   *  antes, e por isso o convite não conseguia apontar para o topo. */
  onUpgradeClick?: (tier?: number) => void;
  /** Abre a compra de pacote avulso. Substitui o "Fazer upgrade" no estouro:
   *  quem já está no plano de topo não tem upgrade para fazer, e quem está no
   *  meio prefere resolver o mês de hoje a mudar de assinatura. */
  onComprarPacote?: () => void;
  isGuest?: boolean;
  /** Os quatro números da carteira já estão no cabeçalho do formulário. Sem
   *  isto, um estado de alerta mostraria "650 / 0 / 500 de 650" duas vezes na
   *  mesma tela — e ninguém confere dois painéis idênticos, só desconfia. */
  semCarteira?: boolean;
}) {
  if (quota.ilimitado) return null;

  // A barra mede contra o SALDO (plano + pacotes), que é o número que o
  // portão usa. Medir contra `limite` mostraria 130% para quem comprou pacote.
  const saldoEfetivo = quota.saldo ?? quota.limite;
  const pct          = saldoEfetivo > 0 ? Math.min(100, Math.round((quota.usado / saldoEfetivo) * 100)) : 0;
  const emCortesia   = !!quota.em_cortesia;
  const motorGratis  = !!quota.profunda_pausada;
  // ⚠️ `esgotado` deixou de significar "bloqueado". Desde que o portão passou
  // a degradar em vez de barrar, ninguém fica sem produto: acima da cortesia
  // a análise roda no motor gratuito. O vermelho de "limite atingido" saiu de
  // cena — ele anunciava uma parede que não existe mais.
  const esgotado     = quota.restante === 0 && !emCortesia && !motorGratis;
  // Para guests (limite = 1), não mostrar estado "quase esgotado" — só verde ou vermelho
  const quaseEsgotado = !isGuest && !esgotado && quota.restante !== null && quota.restante <= 1;

  const barColor = motorGratis ? 'bg-violet-500' : (esgotado || emCortesia) ? 'bg-amber-500'
                 : quaseEsgotado ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = motorGratis ? 'text-violet-700' : (esgotado || emCortesia) ? 'text-amber-700'
                  : quaseEsgotado ? 'text-amber-700' : 'text-slate-600';
  const bgColor   = motorGratis
    ? 'bg-violet-50 border-violet-200'
    : (esgotado || emCortesia || quaseEsgotado)
      ? 'bg-amber-50 border-amber-200'
      : 'bg-slate-50 border-slate-200';

  // A barra tem que falar a mesma língua do bloqueio. O portão debita
  // créditos; se aqui dissesse "análises" contando cabeças, o cliente seria
  // barrado num número que esta tela nunca mostrou.
  // Espelha a regra do backend: crédito pode diferir de 1 por peso de modo
  // OU por faixa de tamanho. Antes olhava só o peso — e passaria a mentir no
  // dia em que um plano barato alcançasse a segunda faixa.
  const emCreditos     = !isGuest && quota.unidade === 'creditos';
  const labelEsgotado  = isGuest ? '⛔ Análise gratuita usada'
                       : emCreditos ? '⛔ Créditos do período esgotados'
                       : '⛔ Limite mensal atingido';
  const labelEstado    = motorGratis ? '🆓 Rodando no motor gratuito'
                       : emCortesia  ? '🎁 Usando crédito de cortesia'
                       : null;
  const labelAtivo     = isGuest ? 'Teste gratuito'
                       : emCreditos ? 'Créditos este mês'
                       : 'Análises este mês';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${bgColor}`}>
      {/* ── Cabeçalho de estado ────────────────────────────────────────────
          Fica sempre, porque é ele que muda de cor e nomeia a situação
          (cortesia, motor gratuito, esgotado). Os NÚMEROS saíram daqui. */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[11px] font-black uppercase tracking-wider ${textColor}`}>
          {labelEstado ?? (esgotado ? labelEsgotado : labelAtivo)}
        </span>
        {isGuest && (
          <span className={`text-[11px] font-bold ${textColor}`}>
            {quota.usado} / {saldoEfetivo} · reseta amanhã
          </span>
        )}
      </div>

      {/* Convidado não tem carteira: mostrar "do plano / adicionais /
          disponível" para quem tem 1 análise por dia seria um painel de
          zeros. Ele fica com a barra simples. */}
      {isGuest ? (
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      ) : semCarteira ? null : (
        /* ── MESMO componente do topo do Radar ────────────────────────────
           Os dois blocos conviviam na mesma página contando a mesma carteira
           com layouts diferentes — um com quatro números, outro com um "9 / 60"
           seco. Quem lê os dois em sequência checa se batem, e checagem é
           trabalho que a interface deveria ter poupado.

           `semBorda` porque esta caixa já muda de cor com o estado; moldura
           dentro de moldura faz a caixa externa parecer erro. `semAviso`
           porque os blocos de cortesia e motor gratuito, logo abaixo, já
           dizem a mesma coisa com botão de ação junto. */
        <ResumoCreditos
          quota={quota}
          onComprarPacote={!emCortesia && !motorGratis ? onComprarPacote : undefined}
          semBorda
          semAviso
          className="mb-2"
        />
      )}

      {/* A régua da cobrança saiu daqui — agora mora atrás do `Tooltip` que fica
          ao lado da carteira, no cabeçalho. Ver `ReguaDeCobranca`, acima. */}

      {/* Cortesia: passou do saldo, mas nada mudou para o cliente. */}
      {emCortesia && !motorGratis && (
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-[11px] font-medium text-amber-700">
            Você passou dos {saldoEfetivo} créditos e está na margem de cortesia — tudo
            segue funcionando normalmente até {quota.teto_cortesia ?? '—'}.
          </p>
          {onComprarPacote && (
            <button
              type="button"
              onClick={onComprarPacote}
              className="text-[11px] font-black text-white bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded-lg transition-colors shrink-0 whitespace-nowrap"
            >
              Adicionar créditos
            </button>
          )}
        </div>
      )}

      {/* Acima da cortesia: NADA bloqueia. Só o motor muda. A mensagem tem que
          deixar isso claro, senão o cliente lê "gratuito" como "parou". */}
      {motorGratis && (
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-[11px] font-medium text-violet-700">
            As análises continuam funcionando, agora no motor gratuito e sem auditoria
            profunda. Adicione créditos para voltar ao motor completo, ou aguarde
            {' '}{quota.dias_para_reset} dia{quota.dias_para_reset !== 1 ? 's' : ''} até a renovação.
          </p>
          {onComprarPacote && (
            <button
              type="button"
              onClick={onComprarPacote}
              className="text-[11px] font-black text-white bg-violet-600 hover:bg-violet-700 px-3 py-1 rounded-lg transition-colors shrink-0 whitespace-nowrap"
            >
              Adicionar créditos
            </button>
          )}
        </div>
      )}

      {/* ── Degrau seguinte ───────────────────────────────────────────────
          Some nos estados de cortesia e motor gratuito: lá já existe um botão
          de comprar créditos, que resolve HOJE. Empilhar um convite de troca
          de plano em cima disso divide a atenção no pior momento. */}
      {!emCortesia && !motorGratis && (
        <EscadaDePlanos
          isGuest={isGuest}
          tierAtual={quota.tier ?? 1}
          onUpgradeClick={onUpgradeClick}
        />
      )}

      {/* Convidado continua com a parede: ele não é cliente pago. */}
      {esgotado && isGuest && (
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] font-medium text-red-600">
            Crie uma conta gratuita para continuar analisando.
          </p>
          <a
            href="/login"
            className="text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg transition-colors shrink-0 ml-2 whitespace-nowrap"
          >
            Criar conta →
          </a>
        </div>
      )}

      {esgotado && !isGuest && (
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-[11px] font-medium text-amber-700">
            Créditos do período no fim — a partir daqui entra a margem de cortesia,
            sem interrupção. Reseta em {quota.reseta_em}.
          </p>
          {onComprarPacote && (
            <button
              type="button"
              onClick={onComprarPacote}
              className="text-[11px] font-black text-white bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded-lg transition-colors shrink-0 whitespace-nowrap"
            >
              Adicionar créditos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** O preço, ao lado do nome do modo.
 *
 *  `aproximado` liga quando há arquivo anexado: o texto do PDF só existe depois
 *  da extração, no servidor, então o número só pode crescer. Prometer firme um
 *  valor que vai subir seria pior que não prometer — vira "a partir de".
 */
/** O que acontece se este pedido passar do saldo.
 *
 *  Sem isto o cliente lê "6 créditos" ao lado de "9 / 10" e conclui sozinho
 *  que vai ser barrado — quando na verdade nada bloqueia. Deixar a pessoa
 *  hesitar diante de uma parede que não existe é desperdiçar justamente o
 *  trabalho de ter tirado a parede.
 */
type EstadoDoPedido = { texto: string; tom: 'cortesia' | 'gratuito'; restante: number };

function estadoDoPedido(creditos: number | null, quota?: QuotaInfo | null): EstadoDoPedido | null {
  if (creditos === null || !quota || quota.ilimitado) return null;
  const saldo = quota.saldo ?? quota.limite;
  if (!saldo) return null;
  const apos = quota.usado + creditos;
  if (apos <= saldo) return null;                      // dentro do saldo: nada a dizer
  // ⚠️ Contra o teto de cortesia entra TAMBÉM o que já foi servido de graça.
  // `usado` conta só o que saiu do saldo, então ele para de crescer quando o
  // saldo zera — comparar `usado + custo` com o teto diria "ainda é cortesia"
  // para sempre, e a tela prometeria auditoria profunda que o backend não vai
  // rodar. Mesma conta do portão, do outro lado do fio.
  const teto = quota.teto_cortesia ?? saldo;
  const aposTotal = quota.usado + (quota.cortesia_usada ?? 0) + creditos;
  if (aposTotal <= teto) {
    return { texto: 'passa do saldo e entra na cortesia — roda normalmente',
             tom: 'cortesia', restante: saldo - quota.usado };
  }
  return { texto: 'roda no motor gratuito, sem auditoria profunda',
           tom: 'gratuito', restante: saldo - quota.usado };
}

function SeloCusto({ creditos, aproximado, tom, estado, indisponivel }:
  { creditos: number | null; aproximado: boolean; tom: 'emerald' | 'sky';
    estado?: EstadoDoPedido | null; indisponivel?: boolean }) {
  if (creditos === null) return null;

  // ⚠️ NA AUDITORIA PROFUNDA, "motor gratuito" NÃO É UM MODO — É AUSÊNCIA.
  // A rápida realmente roda no motor gratuito e o selo descreve o que vai
  // acontecer. A profunda, não: acima da cortesia ela simplesmente não existe.
  // Anunciar "7 créditos · motor gratuito" ali dizia duas inverdades ao mesmo
  // tempo — que vai rodar, e que vai custar 7 créditos que nunca serão
  // debitados. Quando indisponível, o selo diz só isso.
  if (indisponivel) {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black whitespace-nowrap text-slate-500"
            title="Créditos do período esgotados — a auditoria profunda volta com créditos novos ou na renovação.">
        indisponível
      </span>
    );
  }
  const cores = estado
    ? (estado.tom === 'cortesia'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-violet-50 text-violet-800 border-violet-200')
    : tom === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : 'bg-sky-50 text-sky-800 border-sky-200';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black whitespace-nowrap ${cores}`}
          title={estado
            ? `Você tem ${estado.restante} crédito(s) — este pedido ${estado.texto}.`
            : aproximado
              ? 'O edital completo (anexos enviados e documentos oficiais baixados do PNCP) só é medido no servidor — o valor final pode subir bastante em editais grandes.'
              : 'Este é o valor que será debitado.'}>
      {aproximado ? 'a partir de ' : ''}{creditos} {creditos === 1 ? 'crédito' : 'créditos'}
      {estado && (estado.tom === 'cortesia' ? ' · cortesia' : ' · motor gratuito')}
    </span>
  );
}

export default function AnalysisForm({
  text,
  onTextChange,
  files,
  onFileUpload,
  onRemoveFile,
  currentCharLimit,
  currentFileLimitMB,
  isAnalyzing,
  token,
  userTier,
  error,
  successMsg,
  provider,
  onProviderChange,
  onAnalyze,
  onShowAuthModal,
  quota,
  onUpgradeClick,
  onComprarPacote,
  estimarSegundos,
  origemPncp = false,
}: AnalysisFormProps) {
  // Sem texto E sem arquivo não há o que precificar. A fórmula tem piso de 1,
  // então a caixa vazia anunciaria "1 crédito" — preço de uma análise que nem
  // pode ser enviada (o mínimo é 80 caracteres) e que muda no instante em que o
  // edital é colado. Numa cotação firme, o primeiro número tem que ser um que
  // vale. Com arquivo anexado o selo fica: "a partir de" é verdade.
  //
  // Mora aqui, e não junto das props, porque comentário JSX (`{/* */}`) na
  // posição de ATRIBUTO não é sintaxe válida — foi o que o tsc barrou.
  const temOQuePrecificar = text.length > 0 || files.length > 0;

  // ── A barra de cota tem algo a dizer? ──────────────────────────────────────
  // Espelha, uma a uma, as condições dos blocos que a `QuotaBar` renderiza.
  // Saudável e no topo do plano: ela não desenha nada além de números que agora
  // vivem no cabeçalho, então não vai para o meio do caminho.
  // Convidado é exceção — ele não tem carteira no cabeçalho, e o "0 de 1 ·
  // reseta amanhã" é a única forma de saber quanto resta do teste.
  const degrauDisponivel = !!useProximoDegrau(!token, quota?.tier ?? userTier, !!onUpgradeClick);
  const quotaPedeAtencao =
    !token
    || !!quota?.em_cortesia
    || !!quota?.profunda_pausada
    || (quota?.restante != null && quota.restante <= 1)
    || degrauDisponivel;

  // ⚠️ SEM ISTO A ANÁLISE DISPARAVA COM A CAIXA VAZIA.
  // O backend recusa abaixo de 80 caracteres, mas a recusa chegava depois de
  // já ter aberto o fluxo de análise — o usuário via a tela entrar em
  // processamento sem ter escolhido edital nenhum. A validação tem que estar
  // aqui, antes do clique valer alguma coisa.
  //
  // Arquivo anexado conta: o texto dele só existe depois da extração no
  // servidor, então exigir 80 caracteres colados barraria quem enviou só PDF.
  const podeAnalisar = text.trim().length >= 80 || files.length > 0;
  // ── Créditos esgotados: a profunda deixa de ser oferecida ──────────────
  // Acima do teto de cortesia a auditoria profunda não roda de verdade — ela
  // degrada para o motor gratuito, sem a varredura em blocos. Deixar o botão
  // clicável seria vender o que não se entrega: o cliente pediria auditoria,
  // esperaria vários minutos e receberia outra coisa. Melhor dizer antes.
  const _crProfunda = temOQuePrecificar ? creditosDe(text.length, 'profunda', quota) : null;
  const _crRapida = temOQuePrecificar ? creditosDe(text.length, 'rapida', quota) : null;
  const _estProfunda = estadoDoPedido(_crProfunda, quota);
  const _estRapida = estadoDoPedido(_crRapida, quota);
  // Sublimite de MODO estourado conta como indisponível pelo MESMO motivo da
  // cortesia esgotada: o servidor degradaria para o motor gratuito em
  // silêncio, e o card estaria vendendo uma auditoria que não vai rodar.
  const sublimiteProfunda = quota?.sublimite_profunda ?? null;
  const profundaIndisponivel = _estProfunda?.tom === 'gratuito' || !!sublimiteProfunda?.atingido;
  const rapidaNoModoGratuito = _estRapida?.tom === 'gratuito';

  // Se a profunda estava selecionada e deixou de estar disponível, volta o
  // seletor para a rápida — senão o card destacado é o que não funciona.
  useEffect(() => {
    if (profundaIndisponivel && provider === 'claude') onProviderChange('openai');
  }, [profundaIndisponivel, provider, onProviderChange]);

  const motivoBloqueio = files.length === 0 && text.trim().length === 0
    ? 'Cole o texto do edital ou anexe um PDF para começar.'
    : files.length === 0 && text.trim().length < 80
      ? `Texto muito curto (${text.trim().length} de 80 caracteres mínimos).`
      : '';

  return (
    <div id="area-submissao" className="bg-white rounded-[2rem] shadow-sm border border-slate-200 relative z-20 w-full overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          CABEÇALHO
          ═══════════════════════════════════════════════════════════════════
          ⚠️ O SUBTÍTULO ERA O MANUAL DO CAMPO QUE VEM LOGO ABAIXO. "Cole o
          texto ou envie o PDF" ficava a 60px de uma caixa cujo placeholder diz
          "Cole aqui o texto do edital…" e de um alvo de arraste que diz
          "Arraste documentos ou clique aqui". Três instruções para a mesma
          ação, sendo que duas estão DENTRO do controle.

          ⚠️ OS TRÊS SELOS (TEXTO/PDF · SCORE · RISCOS) PARECIAM ABAS. Caixas
          com borda, numa grade de três, encostadas na direita do cabeçalho —
          que é exatamente onde abas moram. Não eram clicáveis: eram um resumo
          do que entra e do que sai. Viraram a linha de subtítulo, que é o lugar
          onde essa frase não finge ser um controle.

          ⚠️ E A DIREITA GANHOU A CARTEIRA, que estava no meio do caminho.
          Ver o comentário do `ReguaDeCobranca` e o de `quotaPedeAtencao`.

          ⚠️ `p-3.5` NO CELULAR (era `p-5`) POR CAUSA DA CARTEIRA, que mora aqui
          dentro: cada 8px de moldura sai da linha dos quatro números. Medido a
          390px — 290px úteis para 307px de conteúdo, e a linha quebrava em 2×2,
          descolando "Disponível" de "Do plano". A partir de `sm:` volta a 20. */}
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50 to-sky-50/45 p-3.5 sm:p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-sky-700 shadow-sm">
              <UploadCloud size={13} />
              Enviar edital
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-950 tracking-tight">Analisar edital</h2>
            {/* ⚠️ FRASE CORRIDA, E NÃO UM `flex` DE PEDAÇOS. A primeira versão
                era um `flex-wrap` com um `<span>` por termo e ícone em cada um;
                com a carteira à direita a coluna encolhe, e a quebra caía entre
                os itens do flex — "De texto ou PDF para score e" numa linha,
                "mapa de riscos" na outra. Texto corrido quebra onde a frase
                permite, que é o que uma frase deve fazer. */}
            <p className="mt-1.5 max-w-md text-[13px] font-medium leading-relaxed text-slate-500">
              De texto ou PDF para <strong className="font-bold text-slate-700">score</strong>{' '}
              e <strong className="font-bold text-slate-700">mapa de riscos</strong>.
            </p>
          </div>

          {/* A carteira, no cabeçalho: é CONTEXTO da tarefa, não uma etapa dela.
              Antes ficava entre o campo de anexo e os cartões de modo — quem
              acabava de colar o edital batia num painel de faturamento com
              quatro números, barra de progresso, botão de compra e duas linhas
              de fórmula, e só depois encontrava o botão de analisar. */}
          {quota && !quota.ilimitado && token && (
            <ResumoCreditos
              quota={quota}
              onComprarPacote={onComprarPacote}
              /* ⚠️ ERA `shrink-0 md:w-auto md:max-w-[32rem]` — NEM CRESCIA NEM
                 ENCOLHIA. `w-auto` faz o bloco ter a largura do conteúdo e o
                 teto de 32rem só limitava; então, por mais larga que ficasse a
                 tela, ele mantinha o mesmo tamanho e os quatro números
                 continuavam quebrando em duas linhas enquanto sobrava espaço
                 vazio ao lado. `flex-1` faz ele acompanhar o cabeçalho; o teto
                 saiu: com teto de 46rem ele parava em 736px e ficava parado
                 enquanto a coluna ia a 1900px — o mesmo sintoma, só que mais
                 tarde. Medido em 1280/1600/1920: sem teto ele acompanha
                 (947 → 1267 → 1587px). */
              className="w-full shadow-sm md:flex-1"
              acessorio={quota.unidade === 'creditos'
                ? <Tooltip rotulo="como os créditos são cobrados"><ReguaDeCobranca quota={quota} /></Tooltip>
                : undefined}
            />
          )}
        </div>
      </div>

      {/* Modo anônimo */}
      {!token && (
        <div className="m-5 md:m-6 mb-0 p-5 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
              <ScanSearch size={22} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Modo anônimo ativo</h4>
              <p className="text-xs text-slate-500 font-medium mt-1">Entre para salvar histórico e ativar o Matchmaker por CNAE.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onShowAuthModal('login')}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-colors shrink-0"
          >
            Entrar na conta
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); if (podeAnalisar && !isAnalyzing) onAnalyze('openai'); }}
        className="space-y-5 w-full p-5 md:p-6"
      >
        {/* Banners de erro/sucesso */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-relaxed">{error}</p>
              {/* O texto/PDF continua carregado — a mensagem antiga mandava
                  "clicar em Iniciar Análise novamente" sem oferecer o botão.
                  Repete o ÚLTIMO motor pedido (gravado pelo useAnalysis);
                  sem registro, cai na rápida, que é a mais barata. */}
              {podeAnalisar && !isAnalyzing && (
                <button
                  type="button"
                  onClick={() => {
                    let motor: 'openai' | 'claude' = 'openai';
                    try {
                      if (sessionStorage.getItem('bawzi_ultimo_motor') === 'claude') motor = 'claude';
                    } catch { /* sem storage: rápida */ }
                    onAnalyze(motor);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-red-700"
                >
                  <RefreshCw size={12} /> Tentar novamente
                </button>
              )}
            </div>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-700 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-relaxed">{successMsg}</p>
          </div>
        )}

        {/* Textarea */}
        <div className="relative group w-full">
          <textarea
            value={text}
            onChange={onTextChange}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-300 transition-all resize-none min-h-[220px] text-slate-700 font-medium placeholder:text-slate-400/70 outline-none leading-relaxed"
            placeholder="Cole aqui o texto do edital, termo de referência ou objeto da contratação..."
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm text-xs font-bold text-slate-500">
              <span className={text.length >= currentCharLimit ? 'text-red-500' : 'text-slate-900'}>
                {text.length.toLocaleString('pt-BR')}
              </span>
              <span className="opacity-50"> / {currentCharLimit.toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* Drag-and-drop */}
        <div className="relative border-2 border-dashed border-sky-200 rounded-2xl p-7 text-center hover:border-sky-300 hover:bg-sky-50/50 transition-all group flex flex-col items-center justify-center gap-3 overflow-hidden w-full bg-sky-50/30">
          <input
            type="file"
            multiple
            accept=".pdf,.txt"
            onChange={onFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="w-14 h-14 bg-white shadow-sm border border-sky-100 group-hover:border-sky-200 group-hover:text-sky-700 text-sky-500 rounded-2xl flex items-center justify-center transition-colors">
            <FolderOpen size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-700 group-hover:text-slate-800">Arraste documentos ou clique aqui</h4>
            <p className="text-xs text-slate-400 font-medium mt-1">PDF ou TXT até {currentFileLimitMB}MB. A análise usa o conteúdo anexado junto com o texto colado.</p>
          </div>
        </div>

        {/* Lista de ficheiros */}
        {files.length > 0 && (
          <div className="space-y-2 w-full bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Documentos Anexos</h5>
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white text-slate-700 text-sm font-bold border border-slate-200 rounded-xl w-full hover:border-slate-300 transition-colors shadow-sm">
                <span className="truncate flex-1 pr-2 flex items-center gap-2">
                  <FileText size={14} className="text-slate-500 shrink-0" /> {file.name}
                </span>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-slate-400 text-xs font-medium whitespace-nowrap bg-slate-100 px-2 py-1 rounded-md">{formatMB(file.size)} MB</span>
                  <button type="button" onClick={() => onRemoveFile(idx)} className="text-slate-300 hover:text-red-500 text-lg transition-colors p-1">&times;</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botões de análise */}
        <div className="mt-6 w-full">
          {/* ⚠️ A BARRA DE COTA SÓ APARECE QUANDO PEDE UMA DECISÃO.
              Ela era incondicional, e no estado saudável — que é o estado da
              esmagadora maioria das sessões — dizia apenas "está tudo bem" em
              140px, bem no meio do caminho entre o edital colado e o botão de
              analisar. Os números saudáveis subiram para o cabeçalho, onde são
              contexto; aqui ficam só os estados que exigem AÇÃO: cortesia,
              motor gratuito, saldo no fim, e o convite de degrau de plano.
              Ver `quotaPedeAtencao`. */}
          {quota && !quota.ilimitado && quotaPedeAtencao && (
            <QuotaBar quota={quota} onUpgradeClick={onUpgradeClick}
                      onComprarPacote={onComprarPacote} isGuest={!token}
                      semCarteira={!!token} />
          )}

          {/* ⚠️ >= 1, não === 4. O seletor era exclusivo do Nível 4 e todo o
              resto recebia um botão único com 'openai' fixo no código — ou
              seja, ninguém abaixo do Nível 4 conseguia pedir auditoria
              profunda, mesmo a rota aceitando `provider=claude` de qualquer
              tier. O convidado (-1) continua fora: ele não tem conta, e uma
              profunda custa 4 créditos contra o 1 por dia que ele tem. */}
          {/* ⚠️ `token &&` NÃO É REDUNDANTE com `userTier >= 1`.
              Em analysis-app.tsx o estado nasce `useState<number>(1)` e volta a
              1 quando a sessão expira — no frontend, visitante sem conta É tier
              1, nunca -1. Mesma armadilha do `max(...)` do backend: o valor de
              "sem usuário" nasce igual ao de "usuário gratuito".
              Sem esta guarda o convidado via "Auditoria profunda · 4 créditos",
              clicava, e levava bloqueio na primeira visita (o backend recusa
              certo: 4 créditos contra o 1 por dia dele). O sinal confiável aqui
              é a sessão — o QuotaBar logo acima já usa `isGuest={!token}`. */}
          {token && userTier >= 1 ? (
            <SeletorDeModo
              provider={provider}
              onProviderChange={onProviderChange}
              onAnalyze={onAnalyze}
              error={error}
              successMsg={successMsg}
              token={token}
              userTier={userTier}
              creditosRapida={temOQuePrecificar ? creditosDe(text.length, 'rapida', quota) : null}
              creditosProfunda={temOQuePrecificar ? creditosDe(text.length, 'profunda', quota) : null}
              estadoRapida={estadoDoPedido(temOQuePrecificar ? creditosDe(text.length, 'rapida', quota) : null, quota)}
              estadoProfunda={estadoDoPedido(temOQuePrecificar ? creditosDe(text.length, 'profunda', quota) : null, quota)}
              podeAnalisar={podeAnalisar}
              motivoBloqueio={motivoBloqueio}
              isAnalyzing={isAnalyzing}
              profundaIndisponivel={profundaIndisponivel}
              rapidaNoModoGratuito={rapidaNoModoGratuito}
              // Arquivo anexado OU edital do PNCP: nos dois casos o texto
              // final só é medido no servidor, e ele é MAIOR que o da tela.
              custoAproximado={files.length > 0 || origemPncp}
              sublimiteProfunda={sublimiteProfunda}
              estimarSegundos={estimarSegundos}
            />
          ) : (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => onAnalyze('openai')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-200/70 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              <Zap size={24} className="relative z-10" />
              <div className="flex flex-col items-start text-left relative z-10">
                <span className="block leading-tight text-base font-black">Iniciar análise estratégica</span>
                {/* ⚠️ AQUI DIZIA "Multi-Agente · ~30 segundos" — as duas metades
                    falsas para quem lê ESTE botão. Este é o ramo do VISITANTE
                    (o `else` de `token && userTier >= 1`), que roda com
                    `agent_count = 1`: não há multi-agente nenhum. E "~30
                    segundos" contradizia `tempoEstimadoLabel`, 700 linhas
                    acima nesta mesma tela, que diz "menos de 1 minuto". Agora
                    sai do MESMO estimador do seletor de modo, para os dois
                    caminhos não poderem divergir outra vez. */}
                <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest">
                  {estimarSegundos
                    ? `Análise rápida · normalmente ${fmtETA(estimarSegundos('openai'))}`
                    : `Análise rápida · ${tempoEstimadoLabel(token, userTier)}`}
                </span>
              </div>
              <svg className="w-5 h-5 ml-auto relative z-10 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Sub-componente: seletor de modo (Nível 1 para cima) ─────────────────────

interface SeletorDeModoProps {
  provider: string;
  onProviderChange: (p: string) => void;
  onAnalyze: (motor: 'openai' | 'claude') => void;
  error: string | null;
  successMsg: string | null;
  // Necessários para a estimativa de tempo do card — o componente não os
  // recebia, e usá-los aqui sem passar quebrava a página em runtime.
  token: string | null;
  userTier: number;
  // Créditos JÁ CALCULADOS pelo componente de cima. Não recebem `text` e
  // `quota` crus de propósito: a fórmula precisa existir em um lugar só, senão
  // o botão mostra um número e a cota debita outro.
  creditosRapida: number | null;
  creditosProfunda: number | null;
  custoAproximado: boolean;
  // Mesmo motivo dos créditos: o ESTADO vem derivado de cima, não a quota
  // crua. Assim a decisão "isto entra na cortesia?" existe num lugar só.
  estadoRapida: EstadoDoPedido | null;
  estadoProfunda: EstadoDoPedido | null;
  podeAnalisar: boolean;
  motivoBloqueio: string;
  isAnalyzing: boolean;
  profundaIndisponivel: boolean;
  rapidaNoModoGratuito: boolean;
  /** Estado do sublimite de auditorias profundas do período (null = sem
   *  sublimite). Serve para avisar ANTES do clique — o servidor degradaria
   *  em silêncio e o cliente descobriria só no banner, minutos depois. */
  sublimiteProfunda?: { limite: number; usadas: number; restantes: number; atingido: boolean } | null;
  /** ETA medido por modo — ver AnalysisFormProps.estimarSegundos. */
  estimarSegundos?: (motor: 'openai' | 'claude') => number;
}

function SeletorDeModo({ provider, onProviderChange, onAnalyze, error, successMsg, token, userTier,
                        creditosRapida, creditosProfunda, custoAproximado,
                        estadoRapida, estadoProfunda,
                        podeAnalisar, motivoBloqueio, isAnalyzing,
                        profundaIndisponivel, rapidaNoModoGratuito,
                        sublimiteProfunda, estimarSegundos }: SeletorDeModoProps) {
  // Prova de valor no momento da escolha: o que a ÚLTIMA auditoria profunda
  // deste navegador acrescentou (gravado pelo laudo em AuditoriaDeltaDestaque).
  // Só aparece quando houve ganho (>0) — anunciar "+0" venderia contra.
  const [ultimoDelta, setUltimoDelta] = useState<{ exigencias: number; contradicoes: number } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bawzi_ultimo_delta_profunda');
      if (!raw) return;
      const d = JSON.parse(raw) as { exigencias?: number; contradicoes?: number; ts?: number };
      if (Date.now() - Number(d.ts || 0) > 90 * 24 * 3600 * 1000) return;
      const exigencias = Number(d.exigencias || 0);
      const contradicoes = Number(d.contradicoes || 0);
      if (exigencias + contradicoes > 0) setUltimoDelta({ exigencias, contradicoes });
    } catch { /* sem storage ou registro ilegível: card segue sem a prova */ }
  }, []);
  return (
    <>
      {/* O `title` só aparece no hover — e em botão desabilitado boa parte dos
          navegadores nem mostra. O motivo precisa estar escrito na tela. */}
      {!podeAnalisar && motivoBloqueio && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] font-bold text-slate-500">
          {motivoBloqueio}
        </div>
      )}

      {profundaIndisponivel && (
        <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-widest text-violet-700">
            Modo gratuito
          </p>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-violet-900">
            Os créditos deste período acabaram. A <strong>análise rápida continua
            disponível</strong>, sem limite, rodando no motor do plano gratuito.
            A auditoria profunda volta quando você adicionar créditos ou na
            renovação do período.
          </p>
        </div>
      )}
      {error && (
        <div className="mb-2 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-xl shadow-sm flex items-center gap-3 transition-all duration-500 animate-in fade-in slide-in-from-top-4">
          <AlertTriangle size={20} className="shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="mb-2 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded-r-xl shadow-sm flex items-center gap-3 transition-all duration-500 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={20} className="shrink-0" />
          <p className="text-sm font-bold">{successMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-8">

        {/* ── Análise Rápida — OpenAI ── */}
        <div
          onClick={() => onProviderChange('openai')}
          className={`relative p-5 rounded-2xl border transition-all duration-300 text-left flex flex-col gap-3 cursor-pointer group ${
            provider === 'openai'
              ? 'border-emerald-300 bg-emerald-50 shadow-md shadow-emerald-100/60 ring-1 ring-emerald-200'
              : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30 hover:shadow-sm'
          }`}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-colors ${
                provider === 'openai' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600'
              }`}>
                <Zap size={20} />
              </div>
              <div>
                <span className="flex items-baseline gap-2">
                  <span className="text-base font-black text-slate-900 tracking-tight">Análise rápida</span>
                  <SeloCusto creditos={creditosRapida} estado={estadoRapida}
                             aproximado={custoAproximado} tom="emerald" />
                  {rapidaNoModoGratuito && (
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-black whitespace-nowrap text-violet-800"
                          title="Créditos do período esgotados — esta análise roda no motor do plano gratuito.">
                      motor gratuito
                    </span>
                  )}
                </span>
                {/* ETA MEDIDO quando há função: mediana das últimas análises
                    deste perfil (tier + tamanho + PNCP), recalculada a cada
                    tecla. O rótulo genérico fica de reserva. */}
                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700">
                  <Clock3 size={11} /> {estimarSegundos
                    ? `normalmente ${fmtETA(estimarSegundos('openai'))}`
                    : tempoEstimadoLabel(token, userTier)}
                </span>
              </div>
            </div>
            {/* ⚠️ ERAM TRÊS AFORDÂNCIAS PARA UMA ESCOLHA BINÁRIA: o cartão
                inteiro é clicável, este canto dizia "Selecionar →", e o botão
                lá embaixo TAMBÉM só seleciona quando o cartão não está ativo
                ("Usar análise rápida"). Dois rótulos disputando o mesmo verbo,
                em alturas diferentes do mesmo cartão.
                Aqui fica o INDICADOR — anel vazio / preenchido, que é a forma
                que um par de opções exclusivas tem em qualquer interface — e o
                verbo fica só no botão, que é onde ele já estava escrito por
                extenso. O anel também deixa os dois cartões simétricos: antes,
                o selecionado mostrava um ponto e o outro mostrava um link. */}
            {provider === 'openai'
              ? <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 ring-4 ring-emerald-500/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              : <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 transition-colors group-hover:border-emerald-400" />
            }
          </div>

          {/* Descrição */}
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Melhor para primeira leitura, extração de campos e decisão preliminar de continuidade.
          </p>

          {/* Badges de motor — por PAPEL, não por versão de modelo.
              ANTES: "GPT-4o + GPT-4o". Dois problemas. (1) Era falso: o backend
              trata "gpt-4o"/"o3-mini" como RÓTULO DE ROTEAMENTO e resolve o
              modelo real via settings (hoje gpt-5-mini / gpt-5) — a tela ficou
              duas gerações atrás. (2) Versão em UI apodrece a cada troca de
              modelo e ninguém lembra de atualizar. Papel + provedor não muda. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-emerald-100">
              <ScanSearch size={10} /> OpenAI · extração
            </span>
            <span className="text-slate-300 font-bold">+</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-emerald-100">
              <BrainCircuit size={10} /> OpenAI · redação
            </span>
          </div>

          {/* Botão — sempre visível, muda de estilo conforme seleção */}
          <button
            type="button"
            disabled={!podeAnalisar || isAnalyzing}
            title={motivoBloqueio || undefined}
            onClick={(e) => { e.stopPropagation(); provider === 'openai' ? onAnalyze('openai') : onProviderChange('openai'); }}
            className={`mt-2 w-full py-3 px-4 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              provider === 'openai'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200/70'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {provider === 'openai' ? (
              <>
                <span>Iniciar análise rápida</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            ) : (
              <>
                <Zap size={14} />
                <span>Usar análise rápida</span>
              </>
            )}
          </button>
        </div>

        {/* ── Auditoria Profunda — Claude ── */}
        <div
          onClick={() => onProviderChange('claude')}
          className={`relative p-5 rounded-2xl border transition-all duration-300 text-left flex flex-col gap-3 cursor-pointer group overflow-hidden ${
            provider === 'claude'
              ? 'border-sky-300 bg-sky-50 shadow-md shadow-sky-100/60 ring-1 ring-sky-200'
              : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/30 hover:shadow-sm'
          }`}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between w-full relative z-10">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-colors ${
                provider === 'claude' ? 'bg-sky-600 text-white' : 'bg-white text-sky-600'
              }`}>
                <BrainCircuit size={20} />
              </div>
              <div>
                <span className="flex items-baseline gap-2">
                  <span className="text-base font-black text-slate-900 tracking-tight">Auditoria profunda</span>
                  <SeloCusto creditos={creditosProfunda}
                             estado={profundaIndisponivel ? null : estadoProfunda}
                             indisponivel={profundaIndisponivel}
                             aproximado={custoAproximado} tom="sky" />
                </span>
                {/* O tempo precisa estar no card, não só na barra de progresso.
                    A auditoria roda com raciocínio em profundidade máxima e leva
                    minutos; quem clica esperando "rápida" acha que travou. Dizer
                    antes transforma espera em expectativa. */}
                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-sky-700">
                  <ShieldCheck size={11} /> jurídica e concorrencial · {estimarSegundos
                    ? fmtETA(estimarSegundos('claude'))
                    : 'vários minutos'}
                </span>
              </div>
            </div>
            {/* Mesmo indicador do cartão da rápida — ver o comentário lá. */}
            {provider === 'claude'
              ? <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-600 ring-4 ring-sky-500/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              : <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 transition-colors group-hover:border-sky-400" />
            }
          </div>

          {/* Descrição */}
          <p className="text-sm font-medium text-slate-500 leading-relaxed relative z-10">
            Melhor para cruzar exigências, riscos legais, concorrentes prováveis e próximos passos.
          </p>

          {/* ── Sublimite de modo: a verdade ANTES do clique ────────────────
              O portão degrada a profunda para o motor gratuito quando o
              sublimite estoura — sem este aviso, o card vendia auditoria, o
              usuário esperava minutos e recebia outra coisa. */}
          {sublimiteProfunda?.atingido && (
            <p className="relative z-10 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800">
              Você usou as {sublimiteProfunda.limite} auditorias profundas deste período.
              Uma nova rodaria no motor do plano gratuito, sem a varredura em blocos —
              um pacote de créditos amplia o sublimite na mesma proporção.
            </p>
          )}
          {!sublimiteProfunda?.atingido && (sublimiteProfunda?.restantes ?? Infinity) <= 2 && (
            <p className="relative z-10 text-[10px] font-bold uppercase tracking-wider text-amber-600">
              {sublimiteProfunda!.restantes === 1
                ? 'Última auditoria profunda do período'
                : `Restam ${sublimiteProfunda!.restantes} auditorias profundas no período`}
            </p>
          )}

          {/* ⚠️ NÃO NOMEIE O PROVEDOR AQUI. Este card agora aparece do Nível 1
              para cima, e o par profundo só usa Anthropic a partir do Nível 3:
              nos Níveis 1 e 2 o redator é OpenAI. Dizer "Anthropic · parecer"
              para um cliente do Essencial é uma afirmação falsa sobre o que
              ele comprou — e o tipo de coisa que ele descobre sozinho.

              Os selos descrevem o TRABALHO que só a profunda faz, e isso é
              verdade em todos os níveis: ela roda a auditoria, que lê o edital
              inteiro sem truncar e confere cada fato contra o texto. */}
          <div className="flex flex-wrap items-center gap-2 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-sky-100 text-[10px] font-black text-sky-700 uppercase tracking-wider shadow-sm">
              <ScanSearch size={10} /> Leitura integral · sem corte
            </span>
            <span className="text-slate-300 font-bold">+</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-sky-100 text-[10px] font-black text-sky-700 uppercase tracking-wider shadow-sm">
              <ShieldCheck size={10} /> Contradições e fatos conferidos
            </span>
          </div>

          {/* Prova medida, do próprio usuário — não promessa de marketing. */}
          {ultimoDelta && (
            <p className="relative z-10 text-[11px] font-bold leading-relaxed text-sky-700">
              Na sua última auditoria: {[
                ultimoDelta.exigencias > 0 && `+${ultimoDelta.exigencias} exigência${ultimoDelta.exigencias > 1 ? 's' : ''}`,
                ultimoDelta.contradicoes > 0 && `${ultimoDelta.contradicoes} contradição${ultimoDelta.contradicoes > 1 ? 'ões' : ''}`,
              ].filter(Boolean).join(' e ')} que a leitura única não viu.
            </p>
          )}

          {/* Botão — sempre visível */}
          <button
            type="button"
            disabled={!podeAnalisar || isAnalyzing || profundaIndisponivel}
            title={profundaIndisponivel
              ? (sublimiteProfunda?.atingido
                  ? 'Sublimite de auditorias profundas do período atingido — um pacote de créditos amplia o teto.'
                  : 'Créditos esgotados — a auditoria profunda volta com créditos novos.')
              : motivoBloqueio || undefined}
            onClick={(e) => { e.stopPropagation(); provider === 'claude' ? onAnalyze('claude') : onProviderChange('claude'); }}
            className={`mt-2 w-full py-3 px-4 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-all relative z-10 disabled:opacity-40 disabled:cursor-not-allowed ${
              provider === 'claude'
                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-200/70'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50'
            }`}
          >
            {provider === 'claude' ? (
              <>
                <span>Executar auditoria profunda</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </>
            ) : (
              <>
                <BrainCircuit size={14} />
                <span>Usar auditoria profunda</span>
              </>
            )}
          </button>
        </div>

      </div>
    </>
  );
}
