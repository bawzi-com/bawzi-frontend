'use client';

/**
 * AppSidebar.tsx
 * Sidebar direita do painel de análise: navegação principal (Radar PNCP,
 * Decisões, Oportunidades, Renovações, Capital), identidade estratégica e motor de IA.
 *
 * Design: todos os nav items seguem o mesmo template —
 *   [ícone 36px] [label + subtitle] [badge]
 * Estado ativo: fundo sólido na cor da secção, texto branco, dot indicator.
 * Estado inactivo: hover subtil, ícone colorido, badge de feature.
 * Estado bloqueado: opacity-60, ícone lock, badge "NÍV. X".
 */

import React from 'react';
import {
  Zap, BookOpen, RefreshCw, Lock, DollarSign,
  Scale, GitCompare, TrendingDown, ShieldCheck, Cpu, ScanSearch, Target, Bell,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserProfileCard from './UserProfileCard';
import NotificationPanel from './NotificationPanel';
import type { UserData } from '@/lib/types';

interface AppSidebarProps {
  token: string | null;
  userData: UserData | null;
  currentTier: number;
  activeTab: string;
  onSetActiveTab: (tab: string) => void;
  renovacoesCount: number | null;
  onNotifCountChange: (n: number) => void;
  onShowAuthModal: (mode: 'login' | 'register') => void;
}

// ─── Componentes internos ──────────────────────────────────────────────────────

/** Badge padronizado de feature (estado inativo) */
function FeatureBadge({
  label,
  color = 'slate',
}: {
  label: string;
  color?: 'slate' | 'teal' | 'emerald' | 'amber' | 'blue' | 'sky' | 'violet';
}) {
  const styles: Record<string, string> = {
    slate:  'bg-slate-100  text-slate-600  border-slate-200',
    teal:   'bg-teal-50    text-teal-700   border-teal-200',
    emerald:'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber:  'bg-amber-50   text-amber-700  border-amber-200',
    blue:   'bg-blue-50    text-blue-700   border-blue-200',
    sky:    'bg-sky-50     text-sky-700    border-sky-200',
    violet: 'bg-violet-50  text-violet-700 border-violet-200',
  };
  return (
    <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${styles[color]}`}>
      {label}
    </span>
  );
}

/** Indicador de activo (dot branco) */
function ActiveDot() {
  return <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-white opacity-80" />;
}

/** Badge de contagem (ex: Renovações com N contratos) */
function CountBadge({ count, color = 'amber' }: { count: number; color?: 'amber' | 'teal' }) {
  const styles: Record<string, string> = {
    amber: 'bg-white text-amber-600',
    teal:  'bg-white text-teal-600',
  };
  return (
    <span className={`shrink-0 text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm ${styles[color]}`}>
      {count}
    </span>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function AppSidebar({
  token,
  userData,
  currentTier,
  activeTab,
  onSetActiveTab,
  renovacoesCount,
  onNotifCountChange,
  onShowAuthModal,
}: AppSidebarProps) {
  const router = useRouter();

  const isAnalise = activeTab === 'workspace' || activeTab === 'analise' || activeTab === 'concorrentes';

  return (
    <div className="flex flex-col gap-5 sticky top-28 print:hidden">

      {/* ── NAV PRINCIPAL ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 p-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm">

        {/* Perfil + sino */}
        {token && userData && (
          <>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                  {(userData.name || userData.nome || 'B').charAt(0).toUpperCase()}
                </div>
                <span className="text-[12px] font-black text-slate-700 truncate max-w-[100px]">
                  {(userData.name || userData.nome || '').split(' ')[0]}
                </span>
              </div>
              <NotificationPanel
                token={token ?? ''}
                onNavigate={(tab) => onSetActiveTab(tab)}
                onCountChange={onNotifCountChange}
              />
            </div>
            <div className="h-px bg-slate-100 mx-3 mb-0.5" />
          </>
        )}

        {/* ── Radar PNCP ────────────────────────────────── */}
        <button
          onClick={() => onSetActiveTab('workspace')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isAnalise ? 'bg-emerald-600' : 'hover:bg-emerald-50'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isAnalise ? 'bg-white/15' : 'bg-emerald-50 border border-emerald-100'
          }`}>
            <Zap size={16} className={isAnalise ? 'text-white fill-white' : 'text-emerald-600'} strokeWidth={2.5} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className={`text-[13px] font-black leading-none mb-1 ${isAnalise ? 'text-white' : 'text-slate-800'}`}>
              Radar PNCP
            </p>
            <p className={`text-[10px] font-medium leading-none ${isAnalise ? 'text-white/60' : 'text-slate-400'}`}>
              Encontrar e decidir
            </p>
          </div>
          {isAnalise ? <ActiveDot /> : <FeatureBadge label="IA" color="emerald" />}
        </button>

        {/* ── Histórico ──────────────────────────────────── */}
        {token && currentTier < 2 ? (
          <button
            onClick={() => router.push('/plans')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-sky-50 opacity-60 hover:opacity-80"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-sky-50 border border-sky-100">
              <Lock size={15} className="text-sky-600" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[13px] font-black leading-none mb-1 text-slate-800">Decisões</p>
              <p className="text-[10px] font-medium leading-none text-slate-400">Laudos e resultados salvos</p>
            </div>
            <FeatureBadge label="NÍV. 2" color="sky" />
          </button>
        ) : (
          <button
            onClick={() => onSetActiveTab('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'history' ? 'bg-sky-600' : 'hover:bg-sky-50'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              activeTab === 'history' ? 'bg-white/15' : 'bg-sky-50 border border-sky-100'
            }`}>
              <BookOpen size={16} className={activeTab === 'history' ? 'text-white' : 'text-sky-600'} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className={`text-[13px] font-black leading-none mb-1 ${activeTab === 'history' ? 'text-white' : 'text-slate-800'}`}>
                Decisões
              </p>
              <p className={`text-[10px] font-medium leading-none ${activeTab === 'history' ? 'text-white/60' : 'text-slate-400'}`}>
                Laudos e resultados salvos
              </p>
            </div>
            {activeTab === 'history' ? <ActiveDot /> : <FeatureBadge label="SALVO" color="sky" />}
          </button>
        )}

        {/* ── Comparar editais ───────────────────────────── */}
        {token && (
          currentTier < 2 ? (
            <button
              onClick={() => router.push('/plans')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-violet-50 opacity-60 hover:opacity-80"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-violet-50 border border-violet-100">
                <Lock size={15} className="text-violet-600" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-black leading-none mb-1 text-slate-800">Priorizar</p>
                <p className="text-[10px] font-medium leading-none text-slate-400">Escolha o melhor edital</p>
              </div>
              <FeatureBadge label="NÍV. 2" color="violet" />
            </button>
          ) : (
            <button
              onClick={() => onSetActiveTab('comparar')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'comparar' ? 'bg-violet-600' : 'hover:bg-violet-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'comparar' ? 'bg-white/15' : 'bg-violet-50 border border-violet-100'
              }`}>
                <GitCompare size={16} className={activeTab === 'comparar' ? 'text-white' : 'text-violet-600'} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-[13px] font-black leading-none mb-1 ${activeTab === 'comparar' ? 'text-white' : 'text-slate-800'}`}>
                  Priorizar
                </p>
                <p className={`text-[10px] font-medium leading-none ${activeTab === 'comparar' ? 'text-white/60' : 'text-slate-400'}`}>
                  Escolha o melhor edital
                </p>
              </div>
              {activeTab === 'comparar' ? <ActiveDot /> : <FeatureBadge label="NOVO" color="violet" />}
            </button>
          )
        )}

        {/* ── Oportunidades — Feed CNAE (autenticados) ────── */}
        {token && userData && (
          currentTier < 3 ? (
            <button
              onClick={() => router.push('/plans')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-teal-50 opacity-60 hover:opacity-80"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-teal-50 border border-teal-100">
                <Lock size={15} className="text-teal-600" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-black leading-none mb-1 text-slate-800">Oportunidades</p>
                <p className="text-[10px] font-medium leading-none text-slate-400">Match CNAE e perfil</p>
              </div>
              <FeatureBadge label="NÍV. 3" color="teal" />
            </button>
          ) : (
            <button
              onClick={() => onSetActiveTab('cnae')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'cnae' ? 'bg-teal-600' : 'hover:bg-teal-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'cnae' ? 'bg-white/15' : 'bg-teal-50 border border-teal-100'
              }`}>
                <Target size={16} className={activeTab === 'cnae' ? 'text-white' : 'text-teal-600'} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-[13px] font-black leading-none mb-1 ${activeTab === 'cnae' ? 'text-white' : 'text-slate-800'}`}>
                  Oportunidades
                </p>
                <p className={`text-[10px] font-medium leading-none ${activeTab === 'cnae' ? 'text-white/60' : 'text-slate-400'}`}>
                  Match CNAE e perfil
                </p>
              </div>
              {activeTab === 'cnae' ? <ActiveDot /> : <FeatureBadge label="CNAE" color="teal" />}
            </button>
          )
        )}

        {/* ── Monitor inteligente (NÍV. 3) ────────────────── */}
        {token && (
          currentTier < 3 ? (
            <button
              onClick={() => router.push('/plans')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-amber-50 opacity-60 hover:opacity-80"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 border border-amber-100">
                <Lock size={15} className="text-amber-600" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-black leading-none mb-1 text-slate-800">Monitor</p>
                <p className="text-[10px] font-medium leading-none text-slate-400">Sinais críticos PNCP</p>
              </div>
              <FeatureBadge label="NÍV. 3" color="amber" />
            </button>
          ) : (
            <button
              onClick={() => onSetActiveTab('alertas')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'alertas' ? 'bg-amber-600' : 'hover:bg-amber-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'alertas' ? 'bg-white/15' : 'bg-amber-50 border border-amber-100'
              }`}>
                <Bell size={16} className={activeTab === 'alertas' ? 'text-white' : 'text-amber-600'} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-[13px] font-black leading-none mb-1 ${activeTab === 'alertas' ? 'text-white' : 'text-slate-800'}`}>
                  Monitor
                </p>
                <p className={`text-[10px] font-medium leading-none ${activeTab === 'alertas' ? 'text-white/60' : 'text-slate-400'}`}>
                  Sinais críticos PNCP
                </p>
              </div>
              {activeTab !== 'alertas' && <FeatureBadge label="NOVO" color="amber" />}
            </button>
          )
        )}

        {/* ── Capital / fôlego financeiro (NÍV. 3) ────────── */}
        {token && (
          currentTier < 3 ? (
            /* Bloqueado */
            <button
              onClick={() => router.push('/plans')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-blue-50 opacity-60 hover:opacity-80"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 border border-blue-100">
                <Lock size={15} className="text-blue-600" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-black leading-none mb-1 text-slate-800">Capital</p>
                <p className="text-[10px] font-medium leading-none text-slate-400">
                  Fôlego para executar
                </p>
              </div>
              <FeatureBadge label="NÍV. 3" color="blue" />
            </button>
          ) : (
            /* Desbloqueado */
            <button
              onClick={() => onSetActiveTab('capital')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'capital' ? 'bg-sky-600' : 'hover:bg-sky-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'capital' ? 'bg-white/15' : 'bg-sky-50 border border-sky-100'
              }`}>
                <DollarSign size={16} className={activeTab === 'capital' ? 'text-white' : 'text-sky-600'} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-[13px] font-black leading-none mb-1 ${activeTab === 'capital' ? 'text-white' : 'text-slate-800'}`}>
                  Capital
                </p>
                <p className={`text-[10px] font-medium leading-none ${activeTab === 'capital' ? 'text-white/60' : 'text-slate-400'}`}>
                  Fôlego para executar
                </p>
              </div>
              {activeTab === 'capital' ? <ActiveDot /> : <FeatureBadge label="NOVO" color="sky" />}
            </button>
          )
        )}

        {/* ── Renovações (NÍV. 4) ─────────────────────────── */}
        {token && userData && (
          currentTier < 4 ? (
            /* Bloqueado */
            <button
              onClick={() => router.push('/plans')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-amber-50 opacity-60 hover:opacity-80"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 border border-amber-100">
                <Lock size={15} className="text-amber-600" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-black leading-none mb-1 text-slate-800">Renovações</p>
                <p className="text-[10px] font-medium leading-none text-slate-400">
                  Contratos vencendo
                </p>
              </div>
              <FeatureBadge label="NÍV. 4" color="amber" />
            </button>
          ) : (userData.companies?.length || userData.company) ? (
            /* Desbloqueado + empresa configurada */
            <button
              onClick={() => onSetActiveTab('renovacoes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'renovacoes' ? 'bg-amber-500' : 'hover:bg-amber-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeTab === 'renovacoes' ? 'bg-white/15' : 'bg-amber-50 border border-amber-100'
              }`}>
                <RefreshCw size={16} className={activeTab === 'renovacoes' ? 'text-white' : 'text-amber-600'} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`text-[13px] font-black leading-none mb-1 ${activeTab === 'renovacoes' ? 'text-white' : 'text-slate-800'}`}>
                  Renovações
                </p>
                <p className={`text-[10px] font-medium leading-none ${activeTab === 'renovacoes' ? 'text-white/60' : 'text-slate-400'}`}>
                  {renovacoesCount && renovacoesCount > 0
                    ? `${renovacoesCount} contrato${renovacoesCount > 1 ? 's' : ''} a vencer`
                    : 'Contratos vencendo'}
                </p>
              </div>
              {activeTab === 'renovacoes'
                ? <ActiveDot />
                : renovacoesCount && renovacoesCount > 0
                  ? <CountBadge count={renovacoesCount} color="amber" />
                  : <FeatureBadge label="ATIVO" color="amber" />}
            </button>
          ) : (
            /* Desbloqueado mas sem empresa */
            <button
              onClick={() => router.push('/profile')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-amber-50"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 border border-amber-100">
                <RefreshCw size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-black leading-none mb-1 text-slate-800">Renovações</p>
                <p className="text-[10px] font-medium leading-none text-slate-400">Configure a empresa primeiro</p>
              </div>
              <FeatureBadge label="CONFIG." color="amber" />
            </button>
          )
        )}
      </div>

      {/* ── IDENTIDADE ESTRATÉGICA ────────────────────────────────────────── */}
      {token && userData ? (
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            Identidade Estratégica
          </h3>
          <UserProfileCard user={userData} currentTier={currentTier} />
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-200 to-slate-300" />
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform shadow-inner">
            <ScanSearch size={28} />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">Modo anônimo</h3>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed font-medium">
            Inicie sessão para ativar o Matchmaker de CNAE e salvar análises.
          </p>
          <button
            onClick={() => onShowAuthModal('login')}
            className="w-full py-3.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition-colors active:scale-95 border border-emerald-600 shadow-sm"
          >
            Entrar na conta
          </button>
        </div>
      )}

      {/* ── MOTOR DE ANÁLISE — 4 agentes ─────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Motor de Análise</span>
          <span className="ml-auto text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold border border-slate-200">
            4 Agentes IA
          </span>
        </div>

        <div className="divide-y divide-slate-50">
          {[
            { bg: 'bg-amber-50',   border: 'border-amber-100',   Icon: Scale,        color: 'text-amber-500',  label: 'Agente Jurídico',   desc: 'Fundamentação legal · Impugnações · Lei 14.133/21' },
            { bg: 'bg-emerald-50', border: 'border-emerald-100', Icon: TrendingDown,  color: 'text-emerald-500',label: 'Agente Financeiro', desc: 'Score de deságio · Margens · Viabilidade real' },
            { bg: 'bg-sky-50',     border: 'border-sky-100',     Icon: ShieldCheck,   color: 'text-sky-500',    label: 'Agente Auditor',    desc: 'Armadilhas contratuais · Compliance · Riscos' },
            { bg: 'bg-sky-50',     border: 'border-sky-100',     Icon: Cpu,           color: 'text-sky-500',    label: 'Neural Matchmaker', desc: 'CNAE vs. edital · Capacidade técnica · Fit' },
          ].map(({ bg, border, Icon, color, label, desc }) => (
            <div key={label} className="flex items-start gap-3 px-5 py-4">
              <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
                <Icon size={18} className={color} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[13px] font-black text-slate-800 leading-none mb-1.5">{label}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap gap-1.5">
          {['Go/No-Go', 'Score Deságio', 'Radar Concorrentes', 'Parecer Jurídico', 'Capital de Giro'].map(item => (
            <span key={item} className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
              ✓ {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
