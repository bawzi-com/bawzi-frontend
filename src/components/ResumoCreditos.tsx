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

export interface QuotaResumo {
  ilimitado?: boolean;
  limite: number;
  usado: number;
  saldo?: number;
  creditos_extras?: number;
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

/** Os pedaços da frase que explica o número, na ordem em que fazem sentido:
 *  o que saiu, o que foi de graça, o que não expira, quando renova. */
export function detalhesDeCreditos(q: QuotaResumo): string[] {
  const partes: string[] = [`${n(q.usado)} usados`];
  // A cortesia vem logo depois do "usados" de propósito: é exatamente ali que
  // a pessoa faz a conta de cabeça e ela não fecha. Sem esta linha, a
  // conclusão é que o sistema errou — foi o que aconteceu.
  if ((q.cortesia_usada ?? 0) > 0) {
    partes.push(`${n(q.cortesia_usada)} por nossa conta (não descontam)`);
  }
  if ((q.creditos_extras ?? 0) > 0) {
    partes.push(`${n(q.creditos_extras)} adicionais não expiram no reset`);
  }
  if (q.dias_para_reset != null) {
    partes.push(`a cota do plano reseta em ${q.dias_para_reset} dia${q.dias_para_reset === 1 ? '' : 's'}`);
  }
  return partes;
}

function Numero({ rotulo, valor, cor, sufixo }: {
  rotulo: string; valor: string; cor: string; sufixo?: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{rotulo}</p>
      <p className={`mt-0.5 text-base font-black leading-none ${cor}`}>
        {valor}
        {sufixo && <span className="ml-1 text-[10px] font-bold text-slate-400">{sufixo}</span>}
      </p>
    </div>
  );
}

export default function ResumoCreditos({
  quota, onComprarPacote, className = '', semAviso = false, semBorda = false,
}: {
  quota: QuotaResumo | null | undefined;
  onComprarPacote?: () => void;
  className?: string;
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

  return (
    <div className={semBorda
      ? className
      : `rounded-xl border border-slate-200 bg-white px-4 py-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Numero rotulo="Do plano" valor={n(quota.limite)} cor="text-slate-900" sufixo="/mês" />
          <div className="h-7 w-px bg-slate-200" />
          {/* Aparece mesmo zerado: um campo que some quando vale zero faz quem
              acabou de comprar achar que a compra não entrou. */}
          <Numero
            rotulo="Adicionais"
            valor={`${extras > 0 ? '+' : ''}${n(extras)}`}
            cor={extras > 0 ? 'text-violet-600' : 'text-slate-300'}
          />
          <div className="h-7 w-px bg-slate-200" />
          <Numero
            rotulo="Disponível"
            valor={n(disponivel)}
            cor={disponivel > 0 ? 'text-emerald-600' : 'text-amber-600'}
            sufixo={`de ${n(saldo)}`}
          />
          {cortesia > 0 && (
            <>
              <div className="h-7 w-px bg-slate-200" />
              <Numero rotulo="Por nossa conta" valor={n(cortesia)} cor="text-emerald-600" />
            </>
          )}
        </div>

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
      </div>

      <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
        {detalhesDeCreditos(quota).map((parte, i) => (
          <React.Fragment key={parte}>
            {i > 0 && ' · '}
            <span className={
              parte.includes('nossa conta') ? 'text-emerald-600'
              : parte.includes('adicionais') ? 'text-violet-600' : ''
            }>{parte}</span>
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
