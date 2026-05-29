'use client';

/**
 * OnboardingModal.tsx
 * ─────────────────────────────────────────────────────────────────
 * Modal de boas-vindas guiado para novos usuários.
 * Aparece automaticamente quando:
 *   - Usuário está autenticado
 *   - Ainda não tem empresa cadastrada OU não tem análises
 *   - Não fechou o onboarding antes (localStorage)
 *
 * 3 passos:
 *   1. Boas-vindas + cadastrar empresa
 *   2. Buscar no Radar PNCP
 *   3. Analisar primeiro edital
 */

import { useState } from 'react';

interface OnboardingModalProps {
  userName: string;
  hasCompany: boolean;
  onClose: () => void;
  onGoToProfile: () => void;
  onGoToRadar: () => void;
}

const PASSOS = [
  {
    emoji: '👋',
    titulo: (nome: string) => `Bem-vindo à Bawzi, ${nome}!`,
    subtitulo: 'Antes de começar, cadastre a sua empresa para personalizar a experiência.',
    descricao: 'Com o CNPJ cadastrado, o Radar detecta automaticamente a sua UF, o feed CNAE exibe oportunidades do seu segmento e o Capital de Giro usa os dados reais da sua empresa.',
    cta: 'Cadastrar empresa agora',
    skip: 'Pular por enquanto',
    cor: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50',
    borda: 'border-emerald-100',
  },
  {
    emoji: '🔍',
    titulo: () => 'Busque editais no Radar PNCP',
    subtitulo: 'Encontre licitações abertas em todo o Brasil em tempo real.',
    descricao: 'Digite um termo do seu segmento (ex: "limpeza", "TI", "obras") no campo de busca. A Bawzi usa IA para otimizar o termo e retorna os editais mais relevantes.',
    cta: 'Ir para o Radar',
    skip: 'Continuar depois',
    cor: 'from-violet-500 to-indigo-500',
    bg: 'bg-violet-50',
    borda: 'border-violet-100',
  },
  {
    emoji: '🏆',
    titulo: () => 'Analise e tome a decisão',
    subtitulo: 'Clique em "Analisar" em qualquer edital para receber o parecer completo.',
    descricao: '4 agentes de IA analisam o edital em paralelo: jurídico, financeiro, de mercado e um auditor de riscos. Em segundos você recebe score Go/No-Go, alertas e estratégia de precificação.',
    cta: 'Entendi, vamos começar!',
    skip: null,
    cor: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
    borda: 'border-amber-100',
  },
];

export default function OnboardingModal({ userName, hasCompany, onClose, onGoToProfile, onGoToRadar }: OnboardingModalProps) {
  // Se já tem empresa, pula para o passo 2
  const [passo, setPasso] = useState(hasCompany ? 1 : 0);

  const step = PASSOS[passo];
  const isUltimo = passo === PASSOS.length - 1;

  const handleCta = () => {
    if (passo === 0) {
      localStorage.setItem('bawzi_onboarding_done', '1');
      onGoToProfile();
      onClose();
    } else if (passo === 1) {
      setPasso(2);
    } else {
      localStorage.setItem('bawzi_onboarding_done', '1');
      onGoToRadar();
      onClose();
    }
  };

  const handleSkip = () => {
    if (passo < PASSOS.length - 1) {
      setPasso(passo + 1);
    } else {
      localStorage.setItem('bawzi_onboarding_done', '1');
      onClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem('bawzi_onboarding_done', '1');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Barra de progresso */}
        <div className="h-1.5 bg-slate-100">
          <div
            className={`h-full bg-gradient-to-r ${step.cor} transition-all duration-500`}
            style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }}
          />
        </div>

        {/* Conteúdo */}
        <div className="p-8">
          {/* Fechar */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-1.5">
              {PASSOS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === passo ? 'w-6 bg-slate-800' : i < passo ? 'w-3 bg-slate-300' : 'w-3 bg-slate-100'}`} />
              ))}
            </div>
            <button
              onClick={handleClose}
              className="text-slate-300 hover:text-slate-600 transition-colors text-lg leading-none"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          {/* Emoji */}
          <div className={`w-16 h-16 rounded-2xl ${step.bg} border ${step.borda} flex items-center justify-center text-3xl mb-6`}>
            {step.emoji}
          </div>

          {/* Texto */}
          <h2 className="text-xl font-black text-slate-900 mb-2 leading-tight">
            {step.titulo(userName.split(' ')[0] || 'usuário')}
          </h2>
          <p className="text-sm font-bold text-slate-700 mb-3">{step.subtitulo}</p>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">{step.descricao}</p>

          {/* Botões */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCta}
              className={`w-full py-3.5 bg-gradient-to-r ${step.cor} text-white font-black rounded-xl transition-all text-sm shadow-md hover:opacity-90`}
            >
              {isUltimo ? '🚀 ' : ''}{step.cta}
            </button>
            {step.skip && (
              <button
                onClick={handleSkip}
                className="w-full py-2.5 text-slate-400 hover:text-slate-600 font-medium text-sm transition-colors"
              >
                {step.skip}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
