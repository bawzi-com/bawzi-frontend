'use client';

/**
 * ResumoCreditos — o estado da carteira, contado do mesmo jeito em toda tela.
 *
 * Existia um lugar só onde o cliente entendia o próprio saldo: a tela de
 * Assinatura. No Radar do PNCP e na barra de créditos ele via um número seco
 * ("9 / 60") que não explica de onde saiu — e a parte que mais gera dúvida,
 * a cortesia, não aparecia em lugar nenhum.
 *
 * O componente existe para que a explicação seja UMA. Três telas montando a
 * mesma frase à mão foi como o app acabou com quatro vocabulários para os
 * mesmos cinco planos; a diferença é que estes números são dinheiro, e duas
 * telas discordando sobre o saldo é pior que duas discordando sobre um nome.
 */
import React from 'react';
import { Coins, Plus } from 'lucide-react';
import Tooltip from './Tooltip';

export interface QuotaResumo {
  ilimitado?: boolean;
  limite: number;
  usado: number;
  saldo?: number;
  creditos_extras?: number;
  /** Bônus do plano no ciclo. Já vem SOMADO em `saldo` e descontado em `usado`
   *  — não é uma carteira paralela. Somar de novo conta o mesmo crédito duas
   *  vezes e mostra ao cliente um saldo que o portão não vai honrar. */
  bonus?: number;
  bonus_usado?: number;
  bonus_restante?: number;
  /** Bônus de campanha. Também já somado em `saldo`. Diferente do de plano em
   *  duas coisas que a tela precisa dizer: tem prazo próprio (contado do
   *  cadastro, não do ciclo) e não volta no mês seguinte. */
  bonus_campanha?: number;
  bonus_campanha_usado?: number;
  bonus_campanha_restante?: number;
  bonus_campanha_dias?: number | null;
  bonus_campanha_nome?: string | null;
  /** Bônus de campanha RECORRENTE: renova todo ciclo, como o do plano, mas
   *  acaba na data do contrato. `bonus_recorrente_meses = null` com valor > 0
   *  significa "enquanto for cliente" — sem data de fim. */
  bonus_recorrente?: number;
  bonus_recorrente_usado?: number;
  bonus_recorrente_restante?: number;
  bonus_recorrente_meses?: number | null;
  /** Tinha recorrente, mas o workspace não é pagante agora. */
  bonus_recorrente_suspenso?: boolean;
  /** Servido acima do saldo. Não debita — nem agora, nem na próxima recarga. */
  cortesia_usada?: number;
  teto_cortesia?: number | null;
  em_cortesia?: boolean;
  profunda_pausada?: boolean;
  dias_para_reset?: number;
}

/** Métricas dos botões de ação da carteira, num lugar só.
 *
 *  Nasceram em telas diferentes e ficaram com altura, raio, fonte e caixa
 *  distintos — lado a lado pareciam de produtos diferentes. Geometria idêntica;
 *  o que separa a ação secundária da primária é PESO (contorno x preenchimento),
 *  não tamanho. Exportado em vez de copiado, porque foi copiar que os fez
 *  divergir da primeira vez.
 */
export const BOTAO_BASE =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[11px] ' +
  'font-black shadow-sm transition-all hover:-translate-y-px hover:shadow active:translate-y-0';
export const BOTAO_SECUNDARIO =
  `${BOTAO_BASE} border border-violet-200 bg-white text-violet-700 hover:border-violet-300 hover:bg-violet-50`;
export const BOTAO_PRIMARIO =
  `${BOTAO_BASE} bg-emerald-600 text-white hover:bg-emerald-700`;

const n = (v: number | null | undefined) => Number(v || 0).toLocaleString('pt-BR');

/** O rodapé da carteira: só o que os números acima NÃO dizem sozinhos.
 *
 *  ⚠️ ESTA FRASE JÁ FOI QUATRO VEZES MAIOR, E ERA O SINTOMA DE OUTRO PROBLEMA.
 *  Ela dizia, de uma vez: o que foi usado, o que era cortesia, quanto de bônus
 *  de campanha resta e até quando, o mesmo para o recorrente, o mesmo para o
 *  bônus do plano, que os adicionais não expiram, e quando a cota reseta —
 *  sete regras diferentes em texto corrido de 10px, embaixo dos números a que
 *  cada uma se referia. Ninguém lê um parágrafo desses; ele existia porque os
 *  números em cima não se explicavam.
 *
 *  Agora cada número tem o seu `?` (ver `ajudasDaCarteira`), que é onde a regra
 *  cabe inteira, com exemplo e a conta escrita. Repetir a mesma explicação aqui
 *  não reforça — dilui, e ainda cria duas redações da mesma regra para
 *  divergirem no primeiro ajuste.
 *
 *  Sobrou o que não cabe num número da linha de cima e o que não pode esperar
 *  um toque:
 *    · o consumido, que não tem coluna própria;
 *    · prazo de campanha CURTO — urgência que exige ação hoje não pode estar
 *      escondida atrás de um clique;
 *    · o recorrente suspenso, porque a coluna dele simplesmente some quando o
 *      plano deixa de ser pago, e sumiço sem explicação vira chamado;
 *    · quando a cota renova.
 */
export function detalhesDeCreditos(
  q: QuotaResumo,
  /** `semReset` para telas que já dizem a data do ciclo com mais contexto.
   *
   *  ⚠️ A TELA DE ASSINATURA É O CASO. Logo abaixo desta frase ela mostra
   *  "Ciclo: 02/08 → 02/09 · Cobra de novo em 12 dias" — a mesma contagem, a
   *  46px de distância, agora que os dois números finalmente concordam. Dizer
   *  duas vezes não reforça: faz procurar a diferença entre as duas frases. */
  opcoes: { semReset?: boolean } = {},
): string[] {
  const partes: string[] = [`${n(q.usado)} usados`];

  // ⚠️ SÓ QUANDO FALTAM POUCOS DIAS. O prazo completo mora no `?` da coluna
  // "Campanha", e o sufixo dela já mostra "3d". Repetir aqui todo mês seria
  // ruído; a três dias do fim é aviso, e aviso não se esconde atrás de toque.
  const campRest = q.bonus_campanha_restante ?? 0;
  const dias = q.bonus_campanha_dias;
  if (campRest > 0 && dias != null && dias <= 3) {
    partes.push(
      dias === 0 ? `${n(campRest)} de bônus da campanha expiram HOJE`
      : dias === 1 ? `${n(campRest)} de bônus da campanha expiram amanhã`
      : `${n(campRest)} de bônus da campanha expiram em ${dias} dias`);
  }
  // A coluna "Campanha /mês" desaparece quando o workspace deixa de pagar.
  // Sem esta linha, o cliente vê um benefício sumir e não sabe se voltou atrás
  // um bug, um fim de promoção, ou o próprio downgrade.
  if ((q.bonus_recorrente ?? 0) <= 0 && q.bonus_recorrente_suspenso) {
    partes.push('bônus da campanha pausado no plano gratuito');
  }
  if (q.dias_para_reset != null && !opcoes.semReset) {
    partes.push(`a cota renova em ${q.dias_para_reset} dia${q.dias_para_reset === 1 ? '' : 's'}`);
  }
  return partes;
}

/** A cor de cada pedaço do rodapé.
 *
 *  ⚠️ EXPORTADA, e não copiada nas duas telas. Era um `? :` encadeado escrito à
 *  mão no perfil e outro no componente, e eles JÁ tinham divergido: o perfil
 *  pintava cortesia e adicionais, mas não tratava o prazo curto de campanha —
 *  ou seja, o aviso mais urgente da carteira saía cinza justamente lá.
 */
export function corDoDetalhe(parte: string): string {
  // Prazo curto pinta de vermelho: é aviso, não decoração.
  if (parte.includes('campanha')) {
    return /HOJE|amanhã/.test(parte) ? 'font-bold text-rose-600' : 'text-amber-600';
  }
  return '';
}

/** Um número da carteira, com o `?` que o explica.
 *
 *  ⚠️ EXPORTADO PARA A TELA DE PERFIL USAR O MESMO. Aquela tela tinha o painel
 *  inteiro copiado à mão — a duplicação que o docstring deste arquivo existe
 *  para impedir, e que já custou três correções feitas em dobro nesta sessão.
 *  A diferença entre as duas era só de tamanho, então virou um `prop`.
 */
export function Numero({ rotulo, valor, cor, sufixo, ajuda, tamanho = 'md' }: {
  rotulo: string; valor: string; cor: string; sufixo?: string;
  tamanho?: 'md' | 'lg';
  /** Explicação do `?` ao lado do rótulo.
   *
   *  ⚠️ CADA NÚMERO AQUI PRECISA DE UM. "650/mês", "+50 de 50" e "590 de 750"
   *  são três coisas que se comportam de formas DIFERENTES — um renova, outro
   *  expira, outro não expira nunca — e nada na tela diz isso. A frase de
   *  rodapé tentava explicar os quatro de uma vez e virava uma linha de texto
   *  corrido que ninguém lê. */
  ajuda?: React.ReactNode;
}) {
  // ⚠️ A GEOMETRIA É RESPONSIVA PORQUE A LINHA TEM DE CABER EM UMA SÓ.
  // Medido a 390px na tela de perfil: quatro colunas, três divisórias e quatro
  // `?` exigiam 351px contra 316px úteis, e a linha quebrava em 2×2 — o que faz
  // "DISPONÍVEL" descolar de "DO PLANO" e a carteira parecer duas informações
  // separadas em vez de uma conta só (que é justamente a dúvida que os `?`
  // vieram matar).
  //
  // O corte é todo em espaço vazio, nunca em texto: `tracking` zerado no
  // celular (o de 0.14em custava ~10% da linha), respiro entre rótulo e `?`,
  // e o valor um degrau menor. Os rótulos continuam a 9px e nenhuma palavra foi
  // abreviada. Resultado medido: 307px. A partir de `sm:` tudo volta ao normal.
  //
  // ⚠️ E O `tracking` DO DESKTOP TAMBÉM CAIU (0.16em → 0.08em). Não é gosto:
  // a 10px, 0.16em custa 1,6px POR LETRA, e os quatro rótulos somam ~36 letras
  // — 58px só de ar entre caracteres, mais que o botão inteiro de comprar. Era
  // o que empurrava "Comprar créditos" para a segunda linha em toda largura
  // intermediária (medido: a linha pedia 666px e o cartão dava 646px a 1024).
  // A 0.08em o rótulo continua espaçado, só que sem pagar por isso.
  const g = tamanho === 'lg'
    ? { rot: 'text-[9px] tracking-normal sm:text-[10px] sm:tracking-[0.08em]',
        val: 'text-sm sm:text-base', suf: 'text-[10px] sm:text-[11px]' }
    : { rot: 'text-[9px] tracking-normal sm:tracking-[0.08em]',
        val: 'text-sm leading-none sm:text-[15px]', suf: 'text-[10px]' };
  return (
    // `min-w-0` + `whitespace-nowrap`: a coluna encolhe se precisar, mas o
    // texto dentro dela nunca parte no meio ("+50 de 50" virando duas linhas
    // é pior que a linha inteira ser um pouco menor).
    <div className="min-w-0">
      <p className={`flex items-center gap-0 whitespace-nowrap font-black uppercase text-slate-400 sm:gap-1 ${g.rot}`}>
        {rotulo}
        {ajuda && <Tooltip rotulo={rotulo} tamanho="sm">{ajuda}</Tooltip>}
      </p>
      <p className={`mt-0.5 whitespace-nowrap font-black ${g.val} ${cor}`}>
        {valor}
        {sufixo && <span className={`ml-1 font-bold text-slate-400 ${g.suf}`}>{sufixo}</span>}
      </p>
    </div>
  );
}

/** As explicações dos números, num lugar só.
 *
 *  ⚠️ NÃO PODEM VIVER NO JSX DE CADA TELA. São a definição do produto — o que
 *  expira, o que acumula, o que é dívida e o que não é. Duas telas com textos
 *  ligeiramente diferentes sobre a mesma regra é como esta base acabou com
 *  quatro vocabulários para os mesmos cinco planos; a diferença é que aqui o
 *  assunto é dinheiro.
 */
export function ajudasDaCarteira(q: QuotaResumo) {
  const saldo = q.saldo ?? q.limite;
  const disponivel = Math.max(0, saldo - q.usado);
  const bonus = q.bonus ?? 0;
  const bonusRest = q.bonus_restante ?? 0;
  const camp = q.bonus_campanha ?? 0;
  const campRest = q.bonus_campanha_restante ?? 0;
  const campDias = q.bonus_campanha_dias;
  const rec = q.bonus_recorrente ?? 0;
  const recRest = q.bonus_recorrente_restante ?? 0;
  const recMeses = q.bonus_recorrente_meses;
  const extras = q.creditos_extras ?? 0;
  const cortesia = q.cortesia_usada ?? 0;

  return {
    doPlano: (
      <>
        <strong className="text-white">{n(q.limite)} créditos</strong> por ciclo, incluídos na sua
        assinatura.
        <br /><br />
        Renovam sozinhos na data de renovação{q.dias_para_reset != null
          ? ` — faltam ${q.dias_para_reset} dia${q.dias_para_reset === 1 ? '' : 's'}`
          : ''}. O que sobrar <strong className="text-white">não</strong> passa para o próximo ciclo.
      </>
    ),
    campanha: (
      <>
        Bônus que você ganhou ao criar a conta
        {q.bonus_campanha_nome ? <> pela campanha{' '}
          <strong className="text-white">{q.bonus_campanha_nome}</strong></> : null}:{' '}
        <strong className="text-white">{n(camp)} créditos</strong>, dos quais restam{' '}
        <strong className="text-white">{n(campRest)}</strong>.
        <br /><br />
        É o primeiro a ser gasto, porque é o único que{' '}
        <strong className="text-white">não volta</strong>: quando o prazo acaba, acabou.
        {campDias != null && (
          <> Você tem <strong className="text-white">
            {campDias === 0 ? 'até hoje' : `${campDias} dia${campDias === 1 ? '' : 's'}`}
          </strong> para usar.</>
        )}
      </>
    ),
    recorrente: (
      <>
        <strong className="text-white">{n(rec)} créditos a mais por mês</strong>, além da cota do
        plano, por ter entrado
        {q.bonus_campanha_nome ? <> pela campanha{' '}
          <strong className="text-white">{q.bonus_campanha_nome}</strong></> : ' numa campanha'}.
        {' '}Restam <strong className="text-white">{n(recRest)}</strong> neste mês.
        <br /><br />
        {/* O prazo aqui é do BENEFÍCIO, não do crédito — o crédito volta todo
            mês. Confundir os dois faria a pessoa correr para gastar algo que
            ela teria de novo na semana que vem. */}
        Ele <strong className="text-white">renova todo ciclo</strong>, junto com a cota.
        {recMeses == null
          ? <> Vale enquanto sua assinatura estiver ativa.</>
          : recMeses <= 1
            ? <> Este é o <strong className="text-white">último mês</strong> do benefício.</>
            : <> Ainda vale por mais <strong className="text-white">{recMeses} meses</strong>.</>}
      </>
    ),
    bonus: (
      <>
        <strong className="text-white">{n(bonus)} créditos</strong> que o seu plano dá além da cota,
        todo ciclo. Restam <strong className="text-white">{n(bonusRest)}</strong>.
        <br /><br />
        São gastos <strong className="text-white">antes</strong> dos créditos do plano, e{' '}
        <strong className="text-white">expiram no reset</strong> — o que sobrar não acumula. Por isso
        saem primeiro: é o lado que você perde se não usar.
      </>
    ),
    adicionais: (
      <>
        Créditos avulsos que você comprou fora do plano.
        {extras > 0 && <> Hoje: <strong className="text-white">{n(extras)}</strong>.</>}
        <br /><br />
        {/* É a única linha da carteira que sobrevive ao reset, e é justamente a
            dúvida que aparece: "comprei 50, por que continuam aí depois da
            renovação?" */}
        Diferente de tudo o mais aqui, eles <strong className="text-white">não expiram</strong>:
        ficam no saldo até serem usados, inclusive depois da renovação. São os últimos a serem
        gastos, para não sumirem antes do que expira.
      </>
    ),
    disponivel: (
      <>
        O que dá para usar agora. É a soma de tudo à esquerda, menos o que já foi consumido neste
        ciclo.
        {/* ⚠️ A CONTA ESCRITA, com os números DESTA conta. "Disponível 590 de
            750" com 650 no plano ao lado não fecha de cabeça — e a pessoa
            conclui que o sistema errou. Mostrar as parcelas responde a pergunta
            antes de ela virar chamado. */}
        <br /><br />
        <span className="block rounded-lg bg-slate-800 px-2.5 py-2 font-mono text-[11px] leading-5">
          {n(q.limite)} do plano
          {camp > 0 && <> {'+ '}{n(camp)} da campanha</>}
          {rec > 0 && <> {'+ '}{n(rec)} da campanha/mês</>}
          {bonus > 0 && <> {'+ '}{n(bonus)} de bônus</>}
          {extras > 0 && <> {'+ '}{n(extras)} adicionais</>}
          <br />= {n(saldo)} no ciclo
          <br />− {n(q.usado)} usados
          <br /><strong className="text-emerald-400">= {n(disponivel)} disponíveis</strong>
        </span>
        {cortesia > 0 && (
          <>
            <br />
            As {n(cortesia)} análises por nossa conta não entram nesta conta — não foram cobradas de
            nada.
          </>
        )}
      </>
    ),
    cortesia: (
      <>
        <strong className="text-white">{n(cortesia)} créditos</strong> de análises que rodaram depois
        de o seu saldo acabar, e que a Bawzi não cobrou.
        <br /><br />
        {/* A dúvida real é sempre a mesma: "isso vai ser descontado quando eu
            comprar crédito?". Responder antes de perguntarem é o que separa um
            presente de uma dívida escondida. */}
        <strong className="text-white">Não é dívida.</strong> Comprar créditos depois não desconta
        este número — ele fica aqui só para você saber o que foi servido além do plano.
      </>
    ),
  };
}

export default function ResumoCreditos({
  quota, onComprarPacote, className = '', semAviso = false, semBorda = false, acessorio,
}: {
  quota: QuotaResumo | null | undefined;
  onComprarPacote?: () => void;
  className?: string;
  /** Encaixe para um controle extra na linha das ações — hoje o `Tooltip` que
   *  explica a régua de cobrança.
   *
   *  ⚠️ ELE PRECISA ENTRAR AQUI DENTRO, e não ao lado do componente. Posto como
   *  irmão, o gatilho de ajuda ficava pendurado FORA da moldura, no canto
   *  superior direito, apontando para um cartão inteiro em vez de para o número
   *  que gera a dúvida. No celular a distância virava meia largura de tela. */
  acessorio?: React.ReactNode;
  /** Esconde o aviso de cortesia. Dentro da barra de créditos da análise ele
   *  seria o TERCEIRO aviso sobre o mesmo assunto — lá já existem os blocos de
   *  cortesia e motor gratuito, com botão de ação. Repetir a mesma informação
   *  em três alturas não reforça, dilui. */
  semAviso?: boolean;
  /** Remove a moldura própria quando o componente já está dentro de uma caixa
   *  que muda de cor com o estado (âmbar na cortesia, violeta no motor
   *  gratuito). Borda dentro de borda faz a caixa externa parecer erro. */
  semBorda?: boolean;
}) {
  // Plano ilimitado não tem saldo para explicar, e um painel de zeros só ocupa
  // espaço e faz duvidar. Convidado idem: ele não tem carteira.
  if (!quota || quota.ilimitado) return null;

  const saldo = quota.saldo ?? quota.limite;
  if (!saldo) return null;

  const disponivel = Math.max(0, saldo - quota.usado);
  const pct = saldo > 0 ? Math.min(100, (quota.usado / saldo) * 100) : 0;
  const extras = quota.creditos_extras ?? 0;
  const cortesia = quota.cortesia_usada ?? 0;
  const bonus = quota.bonus ?? 0;
  const bonusRestante = quota.bonus_restante ?? 0;
  const bonusCamp = quota.bonus_campanha ?? 0;
  const bonusCampRestante = quota.bonus_campanha_restante ?? 0;
  const bonusCampDias = quota.bonus_campanha_dias;
  const bonusRec = quota.bonus_recorrente ?? 0;
  const bonusRecRestante = quota.bonus_recorrente_restante ?? 0;
  const bonusRecMeses = quota.bonus_recorrente_meses;
  const aj = ajudasDaCarteira(quota);

  return (
    <div className={semBorda
      ? className
      // `px-2` no celular: cada 8px de moldura sai da linha de números, que é
      // onde o espaço faltava. A partir de `sm:` volta aos 16px.
      : `rounded-xl border border-slate-200 bg-white px-2 py-3 sm:px-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        {/* ⚠️ O `flex-wrap` FICA, mas o caso comum tem de caber em UMA linha.
            Quebrar em 2×2 descola "Disponível" de "Do plano" e a carteira deixa
            de parecer uma conta — vira dois blocos soltos de números que não
            fecham entre si, que é exatamente a dúvida que os `?` vieram matar.
            O que faz caber é o respiro menor no celular (gap-x-1 em vez de 5) +
            a geometria reduzida do `Numero`; a partir de `sm:` volta ao normal.
            O gap pode ser apertado porque quem separa as colunas é a DIVISÓRIA,
            não o vazio — sem ela, "+50 de 50" e "+50" lado a lado viram um
            borrão só ("+50 de 50 +50"), que foi como ficou na versão testada
            sem as barrinhas.
            Tirar o `flex-wrap` seria pior: com campanha + recorrente + bônus +
            cortesia são SETE colunas, que não cabem em 390px de jeito nenhum, e
            aí a linha vazaria o cartão em vez de quebrar. */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2 sm:gap-x-5">
          <Numero
            rotulo="Do plano"
            valor={n(quota.limite)}
            cor="text-slate-900"
            sufixo="/mês"
            ajuda={aj.doPlano}
          />
          {/* ⚠️ SÓ APARECE QUANDO O PLANO TEM BÔNUS — ao contrário de
              "Adicionais", que fica visível zerado de propósito (quem acabou de
              comprar precisa ver a compra entrar). Aqui é o oposto: um campo
              "Bônus 0" em todo plano sem campanha só ocupa espaço e ensina o
              cliente a ignorar a linha justamente quando ela passar a valer. */}
          {/* Campanha antes do bônus do plano: é o que vence primeiro e o que
              é gasto primeiro. A ordem visual acompanha a ordem de consumo. */}
          {bonusCamp > 0 && (
            <>
              <div className="h-6 w-px shrink-0 bg-slate-200 sm:h-7" />
              <Numero
                rotulo="Campanha"
                valor={`${bonusCampRestante > 0 ? '+' : ''}${n(bonusCampRestante)}`}
                cor={bonusCampRestante > 0
                  ? (bonusCampDias != null && bonusCampDias <= 3 ? 'text-rose-600' : 'text-amber-600')
                  : 'text-slate-300'}
                sufixo={bonusCampRestante > 0 && bonusCampDias != null
                  ? (bonusCampDias === 0 ? 'expira hoje' : `${bonusCampDias}d`)
                  : `de ${n(bonusCamp)}`}
                ajuda={aj.campanha}
              />
            </>
          )}
          {/* Recorrente: o sufixo conta o que sobra do BENEFÍCIO (meses), não
              do crédito — este volta cheio no mês que vem. */}
          {bonusRec > 0 && (
            <>
              <div className="h-6 w-px shrink-0 bg-slate-200 sm:h-7" />
              <Numero
                rotulo="Campanha /mês"
                valor={`${bonusRecRestante > 0 ? '+' : ''}${n(bonusRecRestante)}`}
                cor={bonusRecRestante > 0 ? 'text-amber-600' : 'text-slate-300'}
                sufixo={bonusRecMeses == null ? 'de assinante'
                  : bonusRecMeses <= 1 ? 'último mês' : `+${bonusRecMeses} meses`}
                ajuda={aj.recorrente}
              />
            </>
          )}
          {bonus > 0 && (
            <>
              <div className="h-6 w-px shrink-0 bg-slate-200 sm:h-7" />
              <Numero
                rotulo="Bônus"
                valor={`${bonusRestante > 0 ? '+' : ''}${n(bonusRestante)}`}
                cor={bonusRestante > 0 ? 'text-amber-600' : 'text-slate-300'}
                sufixo={`de ${n(bonus)}`}
                ajuda={aj.bonus}
              />
            </>
          )}
          <div className="h-6 w-px shrink-0 bg-slate-200 sm:h-7" />
          {/* Aparece mesmo zerado: um campo que some quando vale zero faz quem
              acabou de comprar achar que a compra não entrou. */}
          <Numero
            rotulo="Adicionais"
            valor={`${extras > 0 ? '+' : ''}${n(extras)}`}
            cor={extras > 0 ? 'text-violet-600' : 'text-slate-300'}
            ajuda={aj.adicionais}
          />
          <div className="h-6 w-px shrink-0 bg-slate-200 sm:h-7" />
          <Numero
            rotulo="Disponível"
            valor={n(disponivel)}
            cor={disponivel > 0 ? 'text-emerald-600' : 'text-amber-600'}
            sufixo={`de ${n(saldo)}`}
            ajuda={aj.disponivel}
          />
          {cortesia > 0 && (
            <>
              <div className="h-6 w-px shrink-0 bg-slate-200 sm:h-7" />
              <Numero
                rotulo="Por nossa conta"
                valor={n(cortesia)}
                cor="text-emerald-600"
                ajuda={aj.cortesia}
              />
            </>
          )}
        </div>

        {(onComprarPacote || acessorio) && (
          <div className="flex shrink-0 items-center gap-1">
            {onComprarPacote && (
              <button
                type="button"
                onClick={onComprarPacote}
                className={BOTAO_SECUNDARIO}
              >
                <Plus size={12} />
                Comprar créditos
              </button>
            )}
            {acessorio}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
        {detalhesDeCreditos(quota).map((parte, i) => (
          <React.Fragment key={parte}>
            {i > 0 && ' · '}
            <span className={corDoDetalhe(parte)}>{parte}</span>
          </React.Fragment>
        ))}
      </p>

      {quota.em_cortesia && !semAviso && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold leading-4 text-amber-800">
          <Coins size={12} className="mt-px shrink-0" />
          <span>
            O saldo acabou — as análises continuam,
            {quota.profunda_pausada
              ? ' agora no motor gratuito e sem auditoria profunda.'
              : ' e a auditoria profunda segue disponível dentro da cortesia.'}
          </span>
        </p>
      )}
    </div>
  );
}
