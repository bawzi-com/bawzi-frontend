'use client';

/**
 * As peças do sino (Radar Estratégico) (25/09/2026): os chips de tipo, o card de um
 * grupo de alertas e a seção dos vencidos. Nenhuma usa hook: recebem o que
 * `lib/radar` calculou e chamam de volta o painel, que é quem grava. Assim
 * renderizam no servidor dos testes e são clicadas sem navegador.
 */
import React from 'react';
import {
  ArrowRight, BellRing, CheckCircle2, ChevronRight, Clock3, FileWarning, RefreshCw, ShieldAlert, Sparkles, Trophy, X, Zap,
} from 'lucide-react';
import {
  diasDoAlerta, fraseDoVencimento, mensagemViva, resumoDoGrupo, tempoAtras, tituloVivo,
  type ContagemDoTipo, type GrupoDeAlertas, type TipoDeAlerta,
} from '@/lib/radar';

export const CONFIG_DO_TIPO: Record<TipoDeAlerta, { accent: string; iconBg: string; cta: string; ctaHover: string; chip: string }> = {
  compliance:      { accent: 'border-red-400',     iconBg: 'bg-red-500',     cta: 'bg-red-50 border-red-200 text-red-700',             ctaHover: 'hover:bg-red-100 hover:border-red-400',         chip: 'bg-red-100 text-red-700' },
  prazo:           { accent: 'border-red-400',     iconBg: 'bg-red-500',     cta: 'bg-red-50 border-red-200 text-red-700',             ctaHover: 'hover:bg-red-100 hover:border-red-400',         chip: 'bg-red-100 text-red-700' },
  pncp_mudanca:    { accent: 'border-sky-400',     iconBg: 'bg-sky-500',     cta: 'bg-sky-50 border-sky-200 text-sky-700',             ctaHover: 'hover:bg-sky-100 hover:border-sky-400',         chip: 'bg-sky-100 text-sky-700' },
  decisao:         { accent: 'border-sky-400',     iconBg: 'bg-sky-500',     cta: 'bg-sky-50 border-sky-200 text-sky-700',             ctaHover: 'hover:bg-sky-100 hover:border-sky-400',         chip: 'bg-sky-100 text-sky-700' },
  disputa_abrindo: { accent: 'border-amber-400',   iconBg: 'bg-amber-500',   cta: 'bg-amber-50 border-amber-200 text-amber-700',       ctaHover: 'hover:bg-amber-100 hover:border-amber-400',     chip: 'bg-amber-100 text-amber-700' },
  renovacao:       { accent: 'border-amber-400',   iconBg: 'bg-amber-500',   cta: 'bg-amber-50 border-amber-200 text-amber-700',       ctaHover: 'hover:bg-amber-100 hover:border-amber-400',     chip: 'bg-amber-100 text-amber-700' },
  matchmaker:      { accent: 'border-indigo-400',  iconBg: 'bg-indigo-500',  cta: 'bg-indigo-50 border-indigo-200 text-indigo-700',    ctaHover: 'hover:bg-indigo-100 hover:border-indigo-400',   chip: 'bg-indigo-100 text-indigo-700' },
  radar_alerta:    { accent: 'border-indigo-400',  iconBg: 'bg-indigo-500',  cta: 'bg-indigo-50 border-indigo-200 text-indigo-700',    ctaHover: 'hover:bg-indigo-100 hover:border-indigo-400',   chip: 'bg-indigo-100 text-indigo-700' },
  oportunidade:    { accent: 'border-emerald-400', iconBg: 'bg-emerald-500', cta: 'bg-emerald-50 border-emerald-200 text-emerald-700', ctaHover: 'hover:bg-emerald-100 hover:border-emerald-400', chip: 'bg-emerald-100 text-emerald-700' },
  pncp_resultado:  { accent: 'border-emerald-400', iconBg: 'bg-emerald-500', cta: 'bg-emerald-50 border-emerald-200 text-emerald-700', ctaHover: 'hover:bg-emerald-100 hover:border-emerald-400', chip: 'bg-emerald-100 text-emerald-700' },
};

// ⚠️ O RÓTULO PROMETE O QUE O CLIQUE FAZ. "Abrir gestão" era literal — e era o
// problema: levava à lista e deixava a pessoa procurar o edital cujo nome
// estava escrito na própria notificação. O clique abre o edital (ou o laudo,
// quando ele não está na Gestão), então o rótulo diz isso.
export const CTA_DO_TIPO: Record<TipoDeAlerta, string> = {
  compliance:      'Verificar certidões',
  matchmaker:      'Ver editais',
  renovacao:       'Ver contratos',
  oportunidade:    'Ver oportunidade',
  prazo:           'Abrir este edital',
  decisao:         'Revisar decisão',
  pncp_mudanca:    'Abrir este edital',
  pncp_resultado:  'Ver o resultado',
  disputa_abrindo: 'Ver contrato',
  radar_alerta:    'Ver editais',
};

export function IconeDoTipo({ tipo }: { tipo: TipoDeAlerta }) {
  const cls = 'text-white';
  const sz = 17;
  if (tipo === 'compliance') return <ShieldAlert size={sz} className={cls} />;
  if (tipo === 'matchmaker' || tipo === 'radar_alerta') return <Zap size={sz} className={cls} />;
  if (tipo === 'renovacao') return <RefreshCw size={sz} className={cls} />;
  if (tipo === 'oportunidade') return <Sparkles size={sz} className={cls} />;
  if (tipo === 'prazo') return <BellRing size={sz} className={cls} />;
  if (tipo === 'decisao') return <CheckCircle2 size={sz} className={cls} />;
  if (tipo === 'pncp_mudanca') return <FileWarning size={sz} className={cls} />;
  if (tipo === 'pncp_resultado') return <Trophy size={sz} className={cls} />;
  return <Clock3 size={sz} className={cls} />;
}

/** Os chips do topo: "Todos" e um por tipo presente, com a contagem; clicar
 *  filtra a lista. */
export function ChipsDoRadar({ contagens, ativo, onEscolher }: {
  contagens: ContagemDoTipo[];
  ativo: TipoDeAlerta | null;
  onEscolher: (tipo: TipoDeAlerta | null) => void;
}) {
  if (contagens.length < 2) return null;
  const total = contagens.reduce((s, c) => s + c.n, 0);
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest transition-all';
  return (
    <div className="relative mt-4 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filtrar alertas por tipo">
      <button
        type="button"
        role="tab"
        aria-selected={ativo === null}
        onClick={() => onEscolher(null)}
        className={`${base} ${ativo === null ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
      >
        Todos <span className="opacity-70">{total}</span>
      </button>
      {contagens.map((c) => (
        <button
          key={c.tipo}
          type="button"
          role="tab"
          aria-selected={ativo === c.tipo}
          onClick={() => onEscolher(ativo === c.tipo ? null : c.tipo)}
          className={`${base} ${ativo === c.tipo ? `${CONFIG_DO_TIPO[c.tipo].chip} ring-2 ring-white/70` : `${CONFIG_DO_TIPO[c.tipo].chip} opacity-80 hover:opacity-100`}`}
        >
          {c.n} {c.rotulo}
        </button>
      ))}
    </div>
  );
}

export type EstadoDoCard = 'pendente' | 'lida' | 'aberto';

/** Um card por grupo: o título e a mensagem recalculados hoje, a idade, o
 *  "3 alterações, a última há 12 dias" quando é grupo, e o botão que leva ao
 *  destino. O selo "não lida" foi embora: a lista só tem não lidas, e um selo
 *  igual em todos os cards não distingue nada. */
export function CardDeAlerta({ grupo, estado = 'pendente', hoje = new Date(), onAbrir, onRemover }: {
  grupo: GrupoDeAlertas;
  estado?: EstadoDoCard;
  hoje?: Date;
  onAbrir: (grupo: GrupoDeAlertas) => void;
  onRemover: (grupo: GrupoDeAlertas) => void;
}) {
  const n = grupo.principal;
  const cfg = CONFIG_DO_TIPO[n.tipo] ?? CONFIG_DO_TIPO.compliance;
  const dias = diasDoAlerta(n, hoje);
  const vencido = dias !== null && dias < 0;
  const resumo = resumoDoGrupo(grupo, hoje);
  const idade = tempoAtras(n.criada_em, hoje);
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-l-4 border-slate-200/80 bg-white shadow-sm ${vencido ? 'border-l-slate-300' : cfg.accent} ${estado !== 'pendente' || vencido ? 'opacity-70' : ''}`}
      data-grupo={grupo.chave}
    >
      {/* Topo clicável. Não vira <button> porque há botão dentro (remover) —
          aninhar botão é HTML inválido e quebra o teclado. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onAbrir(grupo)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(grupo); }
        }}
        className="cursor-pointer px-4 pb-3 pt-4 transition-colors hover:bg-slate-50/70 focus:outline-none focus-visible:bg-slate-50"
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${vencido ? 'bg-slate-400' : cfg.iconBg}`}>
            <IconeDoTipo tipo={n.tipo} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-start justify-between gap-2">
              <span className="text-[11px] font-black uppercase leading-tight tracking-tight text-slate-900">
                {tituloVivo(n, hoje)}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                {idade && (
                  <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-400" title={`Alerta gerado ${idade}`}>
                    {idade}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemover(grupo); }}
                  className="rounded-md p-0.5 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500"
                  title={grupo.itens.length > 1 ? `Remover os ${grupo.itens.length} alertas` : 'Remover alerta'}
                  aria-label={grupo.itens.length > 1 ? `Remover os ${grupo.itens.length} alertas` : 'Remover alerta'}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            {(estado !== 'pendente' || resumo || dias !== null) && (
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                {dias !== null && (
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                    vencido ? 'border-slate-200 bg-slate-50 text-slate-500' : dias <= 1 ? 'border-red-100 bg-red-50 text-red-600' : dias <= 7 ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}>
                    {fraseDoVencimento(dias)}
                  </span>
                )}
                {resumo && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {resumo}
                  </span>
                )}
                {estado === 'aberto' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Aberto
                  </span>
                )}
                {estado === 'lida' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Lida
                  </span>
                )}
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-slate-600">{mensagemViva(n, hoje)}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-2.5">
        <button
          type="button"
          onClick={() => onAbrir(grupo)}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${cfg.cta} ${cfg.ctaHover}`}
        >
          <span>{CTA_DO_TIPO[n.tipo] ?? 'Ver detalhes'}</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

/** Os vencidos ficam recolhidos: "Vencidos (8)" abre a lista, e "Limpar"
 *  tira todos de uma vez. Um "vence hoje" de seis dias atrás não é alerta —
 *  é histórico, e histórico não deve competir com o que ainda dá para fazer. */
export function SecaoVencidos({ grupos, aberta, onAlternar, onLimpar, estadoDe, hoje = new Date(), onAbrir, onRemover }: {
  grupos: GrupoDeAlertas[];
  aberta: boolean;
  onAlternar: () => void;
  onLimpar: () => void;
  estadoDe: (grupo: GrupoDeAlertas) => EstadoDoCard;
  hoje?: Date;
  onAbrir: (grupo: GrupoDeAlertas) => void;
  onRemover: (grupo: GrupoDeAlertas) => void;
}) {
  if (!grupos.length) return null;
  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberta}
          className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-800"
        >
          <ChevronRight size={13} className={`transition-transform ${aberta ? 'rotate-90' : ''}`} />
          Vencidos <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-600">{grupos.length}</span>
        </button>
        <button
          type="button"
          onClick={onLimpar}
          className="rounded-lg px-1.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-red-500"
        >
          Limpar vencidos
        </button>
      </div>
      {aberta && (
        <div className="mt-2 space-y-2">
          {grupos.map((g) => (
            <CardDeAlerta key={g.chave} grupo={g} estado={estadoDe(g)} hoje={hoje} onAbrir={onAbrir} onRemover={onRemover} />
          ))}
        </div>
      )}
    </div>
  );
}

