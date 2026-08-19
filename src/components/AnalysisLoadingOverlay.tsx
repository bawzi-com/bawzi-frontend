'use client';

/**
 * AnalysisLoadingOverlay.tsx
 * Painel de espera enquanto os agentes leem o edital.
 *
 * ⚠️ UM SINAL POR FATO. A versão anterior respondia "onde estamos?" cinco
 * vezes na mesma tela: régua no topo, "ETAPA 2 DE 5", "PROGRESSO 21%", uma
 * SEGUNDA barra logo abaixo, e a fila lateral com "EM LEITURA". Mais quatro
 * "NA SEQUÊNCIA", que não informam nada — é evidente que o que está abaixo
 * vem depois. Cinco vozes dizendo a mesma coisa é o que fazia a tela parecer
 * agitada, não carregada de informação. Agora cada fato tem um lugar só:
 *
 *   quanto falta ......... o anel, com o número no meio (a barra do corpo saiu)
 *   qual etapa ........... a fila lateral — só ela numera, no cabeçalho dela
 *   o que a etapa faz .... o título e UMA linha de descrição
 *
 * A régua de 4px no topo do cartão ficou porque não disputa: é cromo de borda,
 * o que se percebe de canto de olho sem olhar para o painel.
 *
 * ⚠️ O TEXTO SOLTO ("Estamos cruzando o edital com critérios jurídicos...")
 * saiu porque repetia, com outras palavras, a descrição da própria etapa que
 * estava três linhas acima. A variante dele que era informação de verdade —
 * a espera por consultas externas depois da última etapa — virou a descrição
 * naquele momento, em vez de um parágrafo a mais.
 *
 * ⚠️ SEM CAIXAS NA FILA. Cinco cartões com borda, fundo e rótulo em caixa
 * alta pesavam mais que o conteúdo. Viraram uma linha do tempo: um trilho de
 * 1px ligando cinco pontos, o que a lista de caixas nem sequer mostrava — que
 * as etapas são uma sequência. O ativo se distingue pelo ponto cheio com halo,
 * não por mais uma moldura.
 */

import React from 'react';
import Image from 'next/image';
import { CheckCircle2, FileSearch, Gauge, Loader2, Radar, Scale, X } from 'lucide-react';

interface LoadingMessage {
  title: string;
  desc: string;
}

interface AnalysisLoadingOverlayProps {
  loadingStep: number;
  loadingMessages: LoadingMessage[];
  loadingProgress: number;
  remainingSeconds: number;
  estimatedSeconds: number;
  /** true = etapas reportadas ao vivo pelo backend; false = estimativa local */
  isLive?: boolean;
  /** Sub-progresso da AUDITORIA (só na profunda): o trabalho pelo qual ela
   *  cobra 4× — releitura em blocos e revisão adversarial — deixando de ser
   *  invisível durante os minutos de espera. Vem do mesmo polling. */
  progressoAuditoria?: {
    fase?: string; blocos_concluidos?: number; blocos_total?: number; achados?: number;
  } | null;
  onCancel: () => void;
}

// Ordem REAL do pipeline (reportada pelo backend etapa a etapa)
const STEPS = [
  { label: 'Documento', icon: FileSearch },
  { label: 'Analista IA', icon: Gauge },
  { label: 'Mercado & Financeiro', icon: Radar },
  { label: 'Jurídico', icon: Scale },
  { label: 'Veredito', icon: CheckCircle2 },
];

const RAIO = 54;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export default function AnalysisLoadingOverlay({
  loadingStep,
  loadingMessages,
  loadingProgress,
  remainingSeconds,
  estimatedSeconds,
  isLive = false,
  progressoAuditoria = null,
  onCancel,
}: AnalysisLoadingOverlayProps) {
  const totalSteps = Math.max(loadingMessages.length, 1);
  const safeStep = Math.min(Math.max(loadingStep, 0), totalSteps - 1);
  const currentMessage = loadingMessages[safeStep] ?? {
    title: 'Preparando análise',
    desc: 'Organizando os dados do edital para iniciar a leitura multiagente.',
  };
  // ⚠️ As duas listas vivem em arquivos diferentes (`STEPS` aqui,
  // `LOADING_MESSAGES` no hook). Hoje têm o mesmo tamanho; se um dia
  // divergirem, a fila continua acesa em vez de apagar por inteiro.
  const queueStep = Math.min(safeStep, STEPS.length - 1);

  const progress = Math.min(99, Math.max(4, Math.round(loadingProgress)));

  const formatSeconds = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
  };

  // ⚠️ TRÊS ESTADOS, NÃO DOIS. O rótulo antes só perguntava se ainda havia
  // segundos no relógio e, sem eles, anunciava "Conferindo dados externos" —
  // mesmo na etapa 3 de 5, que não confere nada externo. O cronômetro zera
  // quando a ESTIMATIVA acaba, o que pode acontecer muito antes do fim.
  const isExternalFinalizing = remainingSeconds <= 0 && progress >= 94;
  const remainingLabel = remainingSeconds > 0
    ? `~${formatSeconds(remainingSeconds)} restantes`
    : isExternalFinalizing
      ? 'Conferindo dados externos'
      : 'Ainda processando';

  // ⚠️ `isLive` e `estimatedSeconds` chegavam e não eram usados. Não valem um
  // aviso na tela — valem o tooltip: quem passar o mouse descobre se o número
  // é medido ou chutado, e ninguém é interrompido por causa disso.
  const dicaTempo = [
    isLive
      ? 'O servidor está reportando cada etapa em tempo real.'
      : 'Tempo estimado aqui no navegador — o servidor ainda não reportou esta etapa.',
    estimatedSeconds > 0 ? `Estimativa total: ~${formatSeconds(estimatedSeconds)}.` : '',
  ].filter(Boolean).join(' ');

  const descricao = isExternalFinalizing
    ? 'Finalizando as consultas oficiais e consolidando os sinais do radar.'
    : currentMessage.desc;

  return (
    <div
      id="area-loading"
      className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-emerald-50/30 to-sky-50/50 shadow-sm animate-in fade-in duration-700"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-slate-100">
        <div
          className="h-full rounded-r-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ⚠️ `espera-2col` É CONTAINER QUERY, NÃO `lg:`. O `lg:` do Tailwind
          mede a JANELA: a 1024px ele abria duas colunas sem saber que o menu
          de 288px já tinha levado a metade, e sobravam ~278px para um anel de
          128px mais o título. Quem decide aqui é a largura da COLUNA — ver
          `styles/layout.css`, que já declara `coluna-conteudo` como container. */}
      <div className="grid gap-6 p-6 md:gap-8 md:p-10 espera-2col">

        {/* ── FOCO: uma coisa acontecendo, um número ─────────────────────── */}
        {/* ⚠️ SEM ALTURA MÍNIMA. Em duas colunas o grid já iguala as duas pela
            mais alta — a fila — e as duas se equivalem. Um piso fixo aqui só
            aparecia quando o painel EMPILHA: abria uns 200px de vazio entre a
            descrição e a fila, um buraco no meio da tela. */}
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Image
              src="/logo-bawzi.png"
              alt="Bawzi Logo"
              width={112}
              height={32}
              className="object-contain"
              priority
            />
            <span
              title={dicaTempo}
              className="inline-flex cursor-default items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 shadow-sm backdrop-blur"
            >
              <span
                className={`h-1.5 w-1.5 animate-pulse rounded-full ${isLive ? 'bg-emerald-500' : 'bg-slate-300'}`}
              />
              {remainingLabel}
            </span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">

            {/* ⚠️ O ANEL SUBSTITUI A BARRA, não decora. O giro de antes não
                dizia nada; o arco é o próprio progresso. O anel pontilhado de
                fora existe só por vivacidade: a porcentagem muda a cada
                dezenas de segundos e, parada, um anel estático parece travado. */}
            <div className="relative mb-8 h-32 w-32">
              <span
                aria-hidden
                className="absolute -inset-2 animate-spin rounded-full border border-dashed border-emerald-200/70 [animation-duration:9s]"
              />
              <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
                <defs>
                  {/* ⚠️ O EIXO SEGUE O ARCO, e por isso não é o diagonal
                      óbvio. O <svg> está girado -90°, então o arco começa no
                      TOPO da tela — que, nas coordenadas de dentro, é a
                      direita. Com o eixo padrão (canto sup. esq. → inf. dir.)
                      o começo do arco caía já no fim do degradê e o anel
                      nascia azul: a 21% não havia um pixel de verde. */}
                  <linearGradient id="bawzi-anel-progresso" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
                <circle cx="64" cy="64" r={RAIO} fill="none" stroke="#eef2f6" strokeWidth="8" />
                <circle
                  cx="64" cy="64" r={RAIO} fill="none"
                  stroke="url(#bawzi-anel-progresso)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUNFERENCIA}
                  strokeDashoffset={CIRCUNFERENCIA * (1 - progress / 100)}
                  className="transition-[stroke-dashoffset] duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {/* tabular-nums: o número não muda de largura ao passar de 9 para 10 */}
                <span className="text-[2rem] font-black leading-none tracking-tight text-slate-950 tabular-nums">
                  {progress}
                  <span className="text-base font-black text-slate-300">%</span>
                </span>
                <span className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  concluído
                </span>
              </div>
            </div>

            <div
              key={safeStep}
              className="animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              <h3 className="text-2xl font-black tracking-tight text-slate-950 md:text-[1.7rem]">
                {currentMessage.title}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-slate-600">
                {descricao}
              </p>

              {/* A auditoria roda em PARALELO com as etapas da fila — linha
                  própria, não uma etapa, para os dois textos não brigarem. */}
              {progressoAuditoria && (progressoAuditoria.blocos_total ?? 0) > 0 && (
                <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/80 px-3.5 py-1.5 text-[11px] font-semibold text-sky-700">
                  <Loader2 size={12} className="animate-spin" />
                  {progressoAuditoria.fase === 'refutacao'
                    ? <>Auditoria: revisão adversarial de {progressoAuditoria.achados ?? 0} achados…</>
                    : <>Auditoria em paralelo · {progressoAuditoria.blocos_concluidos ?? 0} de {progressoAuditoria.blocos_total} blocos · {progressoAuditoria.achados ?? 0} achados</>}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── FILA: linha do tempo, não lista de caixas ──────────────────── */}
        <aside className="flex flex-col rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-2 px-1.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                Fila dos agentes
              </p>
              <h4 className="mt-1.5 text-base font-black tracking-tight text-slate-950">
                O que está sendo lido
              </h4>
            </div>
            {/* o "N de M" mora aqui, e só aqui */}
            <span className="mt-0.5 shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-500 tabular-nums">
              {safeStep + 1}/{totalSteps}
            </span>
          </div>

          <ol>
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isDone = index < queueStep;
              const isActive = index === queueStep;

              return (
                <li key={step.label} className="relative flex items-center gap-3 px-1.5 py-2">
                  {/* Trilho: sai da base deste ponto e encosta no próximo.
                      left-5 = px-1.5 (6px) + metade do ponto de 28px. */}
                  {index < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={`absolute left-5 top-9 -bottom-2 w-px ${isDone ? 'bg-emerald-200' : 'bg-slate-200'}`}
                    />
                  )}

                  <span
                    className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                        : isDone
                          ? 'bg-white text-emerald-600 ring-1 ring-emerald-200'
                          : 'bg-white text-slate-300 ring-1 ring-slate-200'
                    }`}
                  >
                    {isActive && (
                      <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-emerald-500/25" />
                    )}
                    {isDone ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                  </span>

                  {/* ⚠️ O "EM CURSO" ANDA COLADO NO NOME, não encostado na
                      borda. Empilhado, a fila ocupa a largura toda e um rótulo
                      alinhado à direita ficava a meia tela do nome que ele
                      qualifica. O nome toma a largura natural (e trunca se
                      faltar espaço) e o rótulo vem logo em seguida. */}
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span
                      title={step.label}
                      className={`min-w-0 truncate text-[13px] ${
                        isActive
                          ? 'font-black text-emerald-900'
                          : isDone
                            ? 'font-semibold text-slate-500'
                            : 'font-semibold text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>

                    {/* Só o ativo tem rótulo. "Na sequência" em quatro linhas
                        era ruído: a posição na lista já diz isso.
                        "Em curso" e não "lendo": o último agente consolida o
                        veredito, não lê nada — um rótulo só serve se servir aos
                        cinco. */}
                    {isActive && (
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-600">
                        em curso
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Empurra o cancelar para o rodapé quando a coluna estica, e garante
              um respiro mínimo quando ela não estica (empilhado, no celular). */}
          <div aria-hidden className="min-h-4 flex-1" />

          <button
            onClick={onCancel}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98]"
          >
            <X size={13} />
            Cancelar análise
          </button>
        </aside>
      </div>
    </div>
  );
}
