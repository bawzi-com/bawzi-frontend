'use client';

/**
 * AnalysisForm.tsx
 * Card de submissão do edital: textarea, drag-and-drop de ficheiros,
 * seletor de provider (tier 4) e botões de análise.
 */

import React from 'react';
import {
  Zap, FolderOpen, FileText, ScanSearch, BrainCircuit,
  AlertTriangle, CheckCircle2, UploadCloud, Gauge, ShieldCheck, Clock3,
  RefreshCw,
} from 'lucide-react';
import { formatMB } from './analysis-types';

export interface QuotaInfo {
  tier: number;
  ilimitado: boolean;
  limite: number;
  usado: number;
  restante: number | null;
  reseta_em: string;       // "YYYY-MM-DD"
  dias_para_reset: number;
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
}

// ─── Indicador de quota mensal ────────────────────────────────────────────────

function QuotaBar({
  quota,
  onUpgradeClick,
  isGuest = false,
}: {
  quota: QuotaInfo;
  onUpgradeClick?: () => void;
  isGuest?: boolean;
}) {
  if (quota.ilimitado) return null;

  const pct          = quota.limite > 0 ? Math.min(100, Math.round((quota.usado / quota.limite) * 100)) : 0;
  const esgotado     = quota.restante === 0;
  // Para guests (limite = 1), não mostrar estado "quase esgotado" — só verde ou vermelho
  const quaseEsgotado = !isGuest && !esgotado && quota.restante !== null && quota.restante <= 1;

  const barColor = esgotado ? 'bg-red-500' : quaseEsgotado ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = esgotado ? 'text-red-700' : quaseEsgotado ? 'text-amber-700' : 'text-slate-600';
  const bgColor   = esgotado
    ? 'bg-red-50 border-red-200'
    : quaseEsgotado
      ? 'bg-amber-50 border-amber-200'
      : 'bg-slate-50 border-slate-200';

  const labelEsgotado  = isGuest ? '⛔ Análise gratuita usada' : '⛔ Limite mensal atingido';
  const labelAtivo     = isGuest ? 'Teste gratuito' : 'Análises este mês';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[11px] font-black uppercase tracking-wider ${textColor}`}>
          {esgotado ? labelEsgotado : labelAtivo}
        </span>
        <span className={`text-[11px] font-bold ${textColor}`}>
          {quota.usado} / {quota.limite}
          {isGuest
            ? <>{' '}·{' '}reseta amanhã</>
            : <>{' '}·{' '}reseta em {quota.dias_para_reset} dia{quota.dias_para_reset !== 1 ? 's' : ''}</>
          }
        </span>
      </div>

      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      {esgotado && (
        <div className="flex items-center justify-between mt-1">
          <p className={`text-[11px] font-medium ${isGuest ? 'text-red-600' : 'text-red-600'}`}>
            {isGuest
              ? 'Crie uma conta gratuita para continuar analisando.'
              : `Reseta em ${quota.reseta_em} · Faça upgrade para continuar agora.`}
          </p>
          {isGuest ? (
            <a
              href="/login"
              className="text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg transition-colors shrink-0 ml-2 whitespace-nowrap"
            >
              Criar conta →
            </a>
          ) : onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="text-[11px] font-black text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg transition-colors shrink-0 ml-2"
            >
              Fazer upgrade
            </button>
          )}
        </div>
      )}
    </div>
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
}: AnalysisFormProps) {
  return (
    <div id="area-submissao" className="bg-white rounded-[2rem] shadow-sm border border-slate-200 relative z-20 w-full overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50 to-sky-50/45 p-5 md:p-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-sky-700 shadow-sm">
          <UploadCloud size={13} />
          Enviar edital
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-950 tracking-tight">Analisar edital</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              Cole o texto completo ou envie o PDF. Depois escolha entre uma triagem rápida ou uma auditoria jurídica mais profunda.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] font-black uppercase text-slate-500">
            {[
              { Icon: FileText, label: 'Texto/PDF' },
              { Icon: Gauge, label: 'Score' },
              { Icon: ShieldCheck, label: 'Riscos' },
            ].map(({ Icon, label }) => (
              <span key={label} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <Icon size={12} className="text-emerald-600" />
                {label}
              </span>
            ))}
          </div>
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
            onClick={() => onShowAuthModal('login')}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-colors shrink-0"
          >
            Entrar na conta
          </button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); onAnalyze('openai'); }} className="space-y-5 w-full p-5 md:p-6">
        {/* Banners de erro/sucesso */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-relaxed">{error}</p>
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

        {/* Strip antes do balcão */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-4">
          <p className="text-sm font-black text-emerald-800">🏆 A vitória começa antes do balcão.</p>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-600">
            Você não perde no balcão por falta de agilidade — perde por ter entrado na licitação errada. Robôs trabalham nos lances. Nós trabalhamos agora.
          </p>
        </div>

        {/* Botões de análise */}
        <div className="mt-6 w-full">
          {/* Indicador de quota — logado (tier 1-3) ou guest (tier -1) */}
          {quota && !quota.ilimitado && (
            <QuotaBar quota={quota} onUpgradeClick={onUpgradeClick} isGuest={!token} />
          )}

          {userTier === 4 ? (
            <TierFourButtons
              provider={provider}
              onProviderChange={onProviderChange}
              onAnalyze={onAnalyze}
              error={error}
              successMsg={successMsg}
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
                <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Multi-Agente · ~30 segundos</span>
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

// ─── Sub-componente: seletor de motor para tier 4 ─────────────────────────────

interface TierFourButtonsProps {
  provider: string;
  onProviderChange: (p: string) => void;
  onAnalyze: (motor: 'openai' | 'claude') => void;
  error: string | null;
  successMsg: string | null;
}

function TierFourButtons({ provider, onProviderChange, onAnalyze, error, successMsg }: TierFourButtonsProps) {
  return (
    <>
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
                <span className="block text-base font-black text-slate-900 tracking-tight">Análise rápida</span>
                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700">
                  <Clock3 size={11} /> triagem em segundos
                </span>
              </div>
            </div>
            {provider === 'openai'
              ? <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              : <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">Selecionar →</span>
            }
          </div>

          {/* Descrição */}
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Melhor para primeira leitura, extração de campos e decisão preliminar de continuidade.
          </p>

          {/* Badges de modelo */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-emerald-100">
              <ScanSearch size={10} /> GPT-4o
            </span>
            <span className="text-slate-300 font-bold">+</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-emerald-100">
              <BrainCircuit size={10} /> GPT-4o
            </span>
          </div>

          {/* Botão — sempre visível, muda de estilo conforme seleção */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); provider === 'openai' ? onAnalyze('openai') : onProviderChange('openai'); }}
            className={`mt-2 w-full py-3 px-4 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-all ${
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
                <span className="block text-base font-black text-slate-900 tracking-tight">Auditoria profunda</span>
                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-sky-700">
                  <ShieldCheck size={11} /> jurídica e concorrencial
                </span>
              </div>
            </div>
            {provider === 'claude'
              ? <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
              : <span className="text-[10px] font-bold text-slate-400 group-hover:text-sky-600 transition-colors">Selecionar →</span>
            }
          </div>

          {/* Descrição */}
          <p className="text-sm font-medium text-slate-500 leading-relaxed relative z-10">
            Melhor para cruzar exigências, riscos legais, concorrentes prováveis e próximos passos.
          </p>

          {/* Badges de modelo */}
          <div className="flex flex-wrap items-center gap-2 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-sky-100 text-[10px] font-black text-sky-700 uppercase tracking-wider shadow-sm">
              <ScanSearch size={10} /> O3-MINI
            </span>
            <span className="text-slate-300 font-bold">+</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-sky-100 text-[10px] font-black text-sky-700 uppercase tracking-wider shadow-sm">
              <BrainCircuit size={10} /> CLAUDE 3.5
            </span>
          </div>

          {/* Botão — sempre visível */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); provider === 'claude' ? onAnalyze('claude') : onProviderChange('claude'); }}
            className={`mt-2 w-full py-3 px-4 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-all relative z-10 ${
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
