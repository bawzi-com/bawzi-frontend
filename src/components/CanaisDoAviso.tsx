'use client';

/**
 * Os canais de um aviso na tela de Alertas (26/09/2026). Marcelo: "se quero ou
 * não enviar e-mail não deveria ficar aqui?". A tela dizia que o interruptor
 * de cada aviso "vale para o sino, o push e o e-mail" — e só 3 dos 10 avisos
 * mandam e-mail, 4 mandam push. Agora cada aviso mostra por onde chega: o sino
 * (que segue o interruptor do aviso) e, só onde existem, o push e o e-mail,
 * cada um com o seu liga/desliga.
 *
 * Sem hook: recebe o estado e chama de volta quem grava.
 */
import React from 'react';
import { Bell, Loader2, Mail, Smartphone } from 'lucide-react';
import { ROTULO_DO_CANAL, type CanalExtra } from '@/lib/alertas';

const ICONE: Record<CanalExtra, typeof Mail> = { push: Smartphone, email: Mail };

export function CanaisDoAviso({ ligado, canais, ativos, salvando = null, onAlternar }: {
  /** O interruptor do aviso — o sino e tudo o mais. */
  ligado: boolean;
  /** Os canais que o aviso usa além do sino. */
  canais: CanalExtra[];
  /** A escolha de cada canal; ausência é ligado. */
  ativos: Partial<Record<CanalExtra, boolean>>;
  salvando?: CanalExtra | null;
  onAlternar: (canal: CanalExtra) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium text-slate-500">Chega por:</span>
      <span
        title="O sino segue o interruptor do aviso."
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
          ligado ? 'border-amber-200 bg-white text-slate-700' : 'border-slate-200 bg-slate-50 text-slate-400'
        }`}
      >
        <Bell size={11} />
        Sino
      </span>
      {canais.map((canal) => {
        const Icone = ICONE[canal];
        const ativo = ativos[canal] !== false;
        const nome = ROTULO_DO_CANAL[canal];
        return (
          <button
            key={canal}
            type="button"
            role="switch"
            aria-checked={ativo}
            aria-label={`${nome} deste aviso`}
            disabled={!ligado || salvando === canal}
            onClick={() => onAlternar(canal)}
            title={
              !ligado
                ? `Ligue o aviso para escolher o ${nome.toLowerCase()}.`
                : ativo
                  ? `Chega por ${nome.toLowerCase()} — clique para desligar só este canal.`
                  : `Não chega por ${nome.toLowerCase()} — clique para ligar.`
            }
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed ${
              ativo
                ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200'
                : 'border-slate-200 bg-white text-slate-400 line-through decoration-slate-300 hover:text-slate-600'
            } ${ligado ? '' : 'opacity-50'}`}
          >
            {salvando === canal ? <Loader2 size={11} className="animate-spin" /> : <Icone size={11} />}
            {nome}
          </button>
        );
      })}
    </div>
  );
}
