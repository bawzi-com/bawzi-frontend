'use client';

/**
 * Quando um aviso chega, na tela de Alertas (26/09/2026). Marcelo, olhando
 * "Todo dia, 07h00" no card: "pode ser parametrizável?". Nos três resumos
 * diários — palavra-chave, disputas e contratos vencendo — a linha vira dois
 * seletores: os dias (todo dia ou só dias úteis) e a hora, das 06h às 22h.
 * Nos outros avisos ela continua dizendo o que é: horário fixo do sistema
 * ("todo dia, 06h30") ou "ao abrir o sino", que não tem hora.
 *
 * As horas vêm do servidor (`GET /api/alertas/catalogo`): uma hora que a tela
 * oferecesse e o servidor recusasse seria um aviso que nunca sai. Sem a lista
 * (servidor anterior a isso), fica o texto — melhor que um seletor vazio.
 *
 * Sem hook: recebe o estado e chama de volta quem grava.
 */
import React from 'react';
import { ChevronDown, Clock, Loader2 } from 'lucide-react';
import { horario, ROTULO_DA_FREQUENCIA, type AgendaDoAviso, type Frequencia } from '@/lib/alertas';

const FREQUENCIAS: Frequencia[] = ['todo_dia', 'dias_uteis'];

type Mudanca = Partial<Pick<AgendaDoAviso, 'hora' | 'frequencia'>>;

export function HorarioDoAviso({ ligado, quando, agenda, padrao, tambem, horas, salvando = false, onTrocar }: {
  /** O interruptor do aviso: desligado, não há hora a escolher. */
  ligado: boolean;
  /** O texto do catálogo — é o que aparece quando o aviso não tem hora própria. */
  quando: string;
  agenda?: AgendaDoAviso;
  padrao?: AgendaDoAviso;
  /** O que mais faz o aviso sair além da hora ("e ao abrir o sino"). */
  tambem?: string;
  horas: number[];
  salvando?: boolean;
  onTrocar: (mudanca: Mudanca) => void;
}) {
  if (!agenda || horas.length === 0) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        <Clock size={11} className="shrink-0 text-slate-400" />
        <span>Quando:</span>
        <span className="text-slate-600">{quando.charAt(0).toUpperCase() + quando.slice(1)}</span>
      </p>
    );
  }
  const desligado = 'Ligue o aviso para escolher quando ele chega.';
  // O padrão fica no title, não na opção: "07h00 (padrão)" alargava o seletor
  // inteiro — a largura de um <select> é a da opção mais comprida.
  const tituloDaHora = !ligado ? desligado : padrao ? `Padrão: ${horario(padrao.hora, agenda.minuto)}` : undefined;
  return (
    <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500 ${ligado ? '' : 'opacity-50'}`}>
      <Clock size={11} className="shrink-0 text-slate-400" />
      <span>Quando:</span>
      <Seletor
        rotulo="Dias deste aviso"
        valor={agenda.frequencia}
        titulo={ligado ? undefined : desligado}
        desabilitado={!ligado || salvando}
        opcoes={FREQUENCIAS.map((f) => ({ valor: f, texto: ROTULO_DA_FREQUENCIA[f] }))}
        onEscolher={(v) => onTrocar({ frequencia: v as Frequencia })}
      />
      {/* "às" e a hora quebram juntos: numa tela estreita, "às" sozinho no
          fim da linha e a hora embaixo liam como duas coisas. */}
      <span className="inline-flex items-center gap-1.5">
        às
        <Seletor
          rotulo="Horário deste aviso"
          valor={String(agenda.hora)}
          titulo={tituloDaHora}
          desabilitado={!ligado || salvando}
          opcoes={horas.map((h) => ({ valor: String(h), texto: horario(h, agenda.minuto) }))}
          onEscolher={(v) => onTrocar({ hora: Number(v) })}
        />
      </span>
      {salvando && <Loader2 size={11} className="animate-spin text-amber-500" />}
      {tambem && <span className="text-slate-400">{tambem}</span>}
    </div>
  );
}

function Seletor({ rotulo, valor, titulo, desabilitado, opcoes, onEscolher }: {
  rotulo: string;
  valor: string;
  titulo?: string;
  desabilitado: boolean;
  opcoes: { valor: string; texto: string }[];
  onEscolher: (valor: string) => void;
}) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={rotulo}
        title={titulo}
        value={valor}
        disabled={desabilitado}
        onChange={(e) => onEscolher(e.target.value)}
        className="appearance-none rounded-full border border-slate-200 bg-white py-0.5 pl-2 pr-5 text-[11px] font-medium text-slate-700 transition-colors hover:border-amber-300 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:hover:border-slate-200"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>{o.texto}</option>
        ))}
      </select>
      <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </span>
  );
}
