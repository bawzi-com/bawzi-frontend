'use client';

/**
 * AnalysisForm.tsx
 * Card de submissão do edital: textarea, drag-and-drop de ficheiros,
 * seletor de provider (tier 4) e botões de análise.
 */

import React from 'react';
import {
  Zap, FolderOpen, FileText, ScanSearch, BrainCircuit,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { formatMB } from './analysis-types';

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
}: AnalysisFormProps) {
  return (
    <div id="area-submissao" className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 md:p-10 relative z-20 w-full">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
          <Zap size={22} />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Analisar Edital</h2>
          <p className="text-sm font-medium text-slate-400">Cole o texto completo ou envie o PDF — os agentes cuidam do resto</p>
        </div>
      </div>

      {/* Modo anónimo */}
      {!token && (
        <div className="mb-8 p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <ScanSearch size={22} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Modo Anónimo Ativo</h4>
              <p className="text-xs text-slate-500 font-medium mt-1">Inicie sessão para guardar histórico e ativar o Matchmaker.</p>
            </div>
          </div>
          <button
            onClick={() => onShowAuthModal('login')}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors shrink-0"
          >
            Entrar na Conta
          </button>
        </div>
      )}

      {/* Banners de erro/sucesso */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium leading-relaxed">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium leading-relaxed">{successMsg}</p>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); onAnalyze('openai'); }} className="space-y-6 w-full">
        {/* Textarea */}
        <div className="relative group w-full">
          <textarea
            value={text}
            onChange={onTextChange}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 focus:ring-4 focus:ring-slate-400/10 focus:border-slate-300 transition-all resize-none min-h-[180px] text-slate-700 font-medium placeholder:text-slate-400/70 outline-none leading-relaxed"
            placeholder="Cole o texto do edital aqui para uma análise profunda..."
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
        <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-slate-300 hover:bg-slate-50 transition-all group flex flex-col items-center justify-center gap-3 overflow-hidden w-full bg-slate-50/50">
          <input
            type="file"
            multiple
            accept=".pdf,.txt"
            onChange={onFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="w-14 h-14 bg-white shadow-sm border border-slate-100 group-hover:border-slate-200 group-hover:bg-slate-100 group-hover:text-slate-700 text-slate-400 rounded-full flex items-center justify-center transition-colors">
            <FolderOpen size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-700 group-hover:text-slate-800">Arraste documentos ou clique aqui</h4>
            <p className="text-xs text-slate-400 font-medium mt-1">Suporta PDF ou TXT até {currentFileLimitMB}MB.</p>
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
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              <Zap size={24} className="relative z-10" />
              <div className="flex flex-col items-start text-left relative z-10">
                <span className="block leading-tight text-base font-black">Iniciar Análise Estratégica</span>
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
        {/* Análise Rápida — OpenAI */}
        <div
          onClick={() => onProviderChange('openai')}
          className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col gap-3 group cursor-pointer ${
            provider === 'openai'
              ? 'border-slate-900 bg-slate-50 shadow-[0_0_20px_rgba(0,0,0,0.08)]'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Zap size={22} className="text-slate-900" />
              <span className="text-xl font-black text-slate-900 tracking-tight">Análise Rápida</span>
            </div>
            {provider === 'openai' && <span className="w-3 h-3 rounded-full bg-slate-900 animate-pulse"></span>}
          </div>
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Foco em velocidade e extração de dados estruturados do edital. Entrega em ~5 segundos.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-slate-200">
              <ScanSearch size={10} /> GPT-4o
            </span>
            <span className="text-slate-300 font-bold">+</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-slate-200">
              <BrainCircuit size={10} /> GPT-4o
            </span>
          </div>
          {provider === 'openai' && (
            <button
              type="button"
              onClick={() => onAnalyze('openai')}
              className="mt-4 w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors shadow-md flex justify-center items-center gap-2 animate-fade-in-up"
            >
              <span>Iniciar Análise Rápida</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </div>

        {/* Auditoria Profunda — Claude */}
        <div
          onClick={() => onProviderChange('claude')}
          className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col gap-3 group overflow-hidden cursor-pointer ${
            provider === 'claude'
              ? 'border-indigo-500 bg-slate-900 shadow-[0_0_30px_rgba(99,102,241,0.2)] ring-4 ring-indigo-500/10'
              : 'border-slate-800 bg-slate-950 hover:border-indigo-500/50 hover:bg-slate-900'
          }`}
        >
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
          <div className="flex items-center justify-between w-full relative z-10">
            <div className="flex items-center gap-2">
              <BrainCircuit size={22} className="text-indigo-300" />
              <span className="text-xl font-black text-white tracking-tight">Auditoria Profunda</span>
            </div>
            {provider === 'claude' && <span className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_10px_rgba(129,140,248,0.8)]"></span>}
          </div>
          <p className="text-sm font-medium text-indigo-200/60 leading-relaxed relative z-10">
            Motor de raciocínio para cruzamento de leis e redação jurídica cirúrgica. Entrega em ~30 seg.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-black text-indigo-300 uppercase tracking-wider shadow-inner">
              <ScanSearch size={10} /> O3-MINI
            </span>
            <span className="text-indigo-500/50 font-bold">+</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-black text-indigo-300 uppercase tracking-wider shadow-inner">
              <BrainCircuit size={10} /> CLAUDE 3.5
            </span>
          </div>
          {provider === 'claude' && (
            <button
              type="button"
              onClick={() => onAnalyze('claude')}
              className="mt-4 w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border border-white/20 flex justify-center items-center gap-2 relative z-10 animate-fade-in-up"
            >
              <span>Executar Auditoria Profunda</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
