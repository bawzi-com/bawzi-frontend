'use client';

/**
 * AnalysisLoadingOverlay.tsx
 * Painel de loading durante o processamento multi-agente.
 * Exibe tempo estimado, progresso monotônico, etapa atual e botão de cancelar.
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
  onCancel: () => void;
}

export default function AnalysisLoadingOverlay({
  loadingStep,
  loadingMessages,
  loadingProgress,
  remainingSeconds,
  estimatedSeconds,
  onCancel,
}: AnalysisLoadingOverlayProps) {
  const totalSteps = Math.max(loadingMessages.length, 1);
  const safeStep = Math.min(Math.max(loadingStep, 0), totalSteps - 1);
  const currentMessage = loadingMessages[safeStep] ?? {
    title: 'Preparando análise',
    desc: 'Organizando os dados do edital para iniciar a leitura multiagente.',
  };
  const progress = Math.min(99, Math.max(4, Math.round(loadingProgress)));
  const formatSeconds = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
  };
  const isExternalFinalizing = remainingSeconds <= 0 && progress >= 94;
  const remainingLabel = remainingSeconds > 0 ? `~${formatSeconds(remainingSeconds)} restantes` : 'Conferindo dados externos';
  const estimateLabel = isExternalFinalizing ? 'PNCP pode levar mais alguns segundos' : `Estimativa ${formatSeconds(estimatedSeconds)}`;
  const steps = [
    { label: 'Documento', icon: FileSearch },
    { label: 'Jurídico', icon: Scale },
    { label: 'Financeiro', icon: Gauge },
    { label: 'Mercado', icon: Radar },
    { label: 'Veredito', icon: CheckCircle2 },
  ];

  return (
    <div
      id="area-loading"
      className="min-h-[520px] bg-white rounded-[2rem] shadow-sm border border-slate-200 animate-in fade-in duration-700 relative overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-slate-100">
        <div
          className="h-full rounded-r-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="relative z-10 grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-[420px] flex-col justify-between rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-white via-emerald-50/35 to-sky-50/60 p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Image
              src="/logo-bawzi.png"
              alt="Bawzi Logo"
              width={118}
              height={34}
              className="object-contain"
              priority
            />
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {remainingLabel}
            </span>
          </div>

          <div className="py-10 text-center">
            <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-emerald-100 bg-white shadow-sm" />
              <div className="absolute inset-2 rounded-full border-2 border-slate-100" />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-emerald-500 border-r-sky-400 animate-spin" />
              <Loader2 className="relative h-8 w-8 animate-spin text-emerald-600" />
            </div>

            <div
              key={safeStep}
              className="mx-auto max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                Etapa {safeStep + 1} de {totalSteps}
              </p>
              <h3 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                {currentMessage.title}
              </h3>
              <p className="mx-auto mt-3 max-w-lg text-sm font-medium leading-relaxed text-slate-600 md:text-base">
                {currentMessage.desc}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              <span>{estimateLabel}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white border border-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs font-semibold leading-relaxed text-slate-500">
              {isExternalFinalizing
                ? 'Estamos finalizando consultas oficiais e consolidando os sinais do radar. Você pode cancelar a qualquer momento.'
                : 'Estamos cruzando o edital com critérios jurídicos, financeiros e de mercado. Você pode cancelar a qualquer momento.'}
            </p>
          </div>
        </div>

        <aside className="flex flex-col justify-between rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Fila dos agentes</p>
              <h4 className="mt-2 text-lg font-black tracking-tight text-slate-950">O que está sendo analisado</h4>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isDone = index < safeStep;
                const isActive = index === safeStep;

                return (
                  <div
                    key={step.label}
                    className={`flex items-center gap-3 rounded-2xl border p-3 transition-all ${
                      isActive
                        ? 'border-emerald-200 bg-emerald-50 shadow-sm'
                        : isDone
                          ? 'border-slate-100 bg-slate-50'
                          : 'border-slate-100 bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : isDone
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-50 text-slate-400'
                      }`}
                    >
                      {isDone ? <CheckCircle2 size={17} /> : <Icon size={17} className={isActive ? 'animate-pulse' : ''} />}
                    </span>
                    <div>
                      <p className={`text-sm font-black ${isActive ? 'text-emerald-900' : 'text-slate-800'}`}>{step.label}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        {isDone ? 'Concluído' : isActive ? 'Em leitura' : 'Na sequência'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={onCancel}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 shadow-sm transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98]"
          >
            <X size={14} />
            Cancelar análise
          </button>
        </aside>
      </div>
    </div>
  );
}
