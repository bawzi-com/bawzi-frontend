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
 * ⚠️ ORDEM: análise PRIMEIRO, empresa DEPOIS.
 * A versão anterior abria pedindo o cadastro da empresa — exatamente o
 * formulário que a landing acabou de poupar com o taster sem cadastro.
 * O "aha" do produto é o veredito; a empresa personaliza, não destrava.
 * Quem já tem empresa nem vê o último passo.
 *
 * 3 passos:
 *   1. Boas-vindas + buscar/analisar no Radar (o caminho mais curto ao valor)
 *   2. O que o veredito devolve
 *   3. Cadastrar empresa para personalizar (pulável; oculto se já tem)
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
    emoji: '🔍',
    titulo: (nome: string) => `Bem-vindo à Bawzi, ${nome}!`,
    subtitulo: 'Comece pelo que importa: descubra se um edital merece sua energia.',
    descricao: 'Digite um termo do seu segmento (ex: "limpeza", "TI", "obras") no Radar PNCP e clique em "Analisar" em qualquer edital. Não precisa configurar nada antes — a primeira resposta vem em minutos.',
    cta: 'Buscar e analisar um edital',
    skip: 'Ver o tour completo',
    cor: 'from-violet-500 to-indigo-500',
    bg: 'bg-violet-50',
    borda: 'border-violet-100',
  },
  {
    emoji: '🏆',
    titulo: () => 'A resposta é sempre uma decisão',
    subtitulo: 'GO, GO condicionado ou NO-GO — com as evidências ao lado.',
    descricao: 'O laudo abre pelo veredito e pelo motivo. Depois vêm score auditável, semáforo de viabilidade, red flags e o checklist de habilitação — tudo rastreável ao trecho do edital que sustenta cada afirmação.',
    cta: 'Entendi, próximo passo',
    skip: 'Pular',
    cor: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
    borda: 'border-amber-100',
  },
  {
    emoji: '🏢',
    titulo: () => 'Quando quiser, cadastre sua empresa',
    subtitulo: 'Não é obrigatório para analisar — personaliza o que você já viu.',
    descricao: 'Com o CNPJ cadastrado, o Radar detecta sua UF, o feed de oportunidades filtra pelo seu CNAE e os alertas passam a trabalhar para o seu segmento. Dá para fazer isso a qualquer momento no perfil.',
    cta: 'Cadastrar minha empresa',
    skip: 'Agora não — quero analisar',
    cor: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50',
    borda: 'border-emerald-100',
  },
];

export default function OnboardingModal({ userName, hasCompany, onClose, onGoToProfile, onGoToRadar }: OnboardingModalProps) {
  // Quem já tem empresa não precisa do passo de cadastro — o tour encolhe.
  const passos = hasCompany ? PASSOS.slice(0, 2) : PASSOS;
  const [passo, setPasso] = useState(0);

  const step = passos[passo];
  const isUltimo = passo === passos.length - 1;

  const concluir = () => {
    localStorage.setItem('bawzi_onboarding_done', '1');
    onClose();
  };

  const handleCta = () => {
    if (passo === 0) {
      // O CTA principal do primeiro passo É o produto: leva direto ao Radar.
      concluir();
      onGoToRadar();
    } else if (!isUltimo) {
      setPasso(passo + 1);
    } else if (hasCompany) {
      concluir();
      onGoToRadar();
    } else {
      concluir();
      onGoToProfile();
    }
  };

  const handleSkip = () => {
    if (passo < passos.length - 1) {
      setPasso(passo + 1);
    } else {
      // Último passo é o da empresa: "Agora não" respeita a escolha e
      // devolve a pessoa ao Radar, que é onde o valor está.
      concluir();
      onGoToRadar();
    }
  };

  const handleClose = () => {
    concluir();
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Barra de progresso */}
        <div className="h-1.5 bg-slate-100">
          <div
            className={`h-full bg-gradient-to-r ${step.cor} transition-all duration-500`}
            style={{ width: `${((passo + 1) / passos.length) * 100}%` }}
          />
        </div>

        {/* Conteúdo */}
        <div className="p-8 flex-1 overflow-y-auto">
          {/* Fechar */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-1.5">
              {passos.map((_, i) => (
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
              {passo === 0 ? '🚀 ' : ''}{step.cta}
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
