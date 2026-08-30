'use client';

import { Lock } from 'lucide-react';
import React from 'react';

/**
 * PremiumLock — o ÚNICO cadeado do laudo.
 *
 * ⚠️ HAVIA TRÊS MECANISMOS DE BLOQUEIO NA MESMA TELA: este (Radar de
 * Concorrentes), este outra vez com regra diferente (PDF, que lia só
 * `currentTier` e esquecia o `Math.max(getCachedTier(...))` que o primeiro
 * usa) e um terceiro feito à mão dentro de `PareceSection` — com barras de
 * esqueleto falsas, um cartão preto próprio e um vocabulário só dele. Três
 * desenhos e três regras para dizer a mesma coisa: "isto é de um plano
 * acima". Agora é um.
 *
 * ⚠️ O CADEADO NÃO É O ASSUNTO DA TELA. A versão anterior tinha título em
 * `text-2xl font-black`, botão esmeralda com halo de 20px e "Desbloquear
 * Agora ⚡" — mais saturado do que o próprio veredito, que é a razão de a
 * pessoa estar ali. O convite continua claro; deixou de gritar mais alto do
 * que a decisão.
 */
interface PremiumLockProps {
  isLocked: boolean;
  featureTitle: string;
  requiredTierName: string;
  onUpgradeClick: () => void;
  /** Ressalva específica do recurso — some quando não há. Existe porque o
   *  parecer jurídico precisa dizer que a auditoria profunda NÃO o desbloqueia,
   *  e essa dúvida não se aplica ao Radar nem ao PDF. */
  nota?: React.ReactNode;
  children: React.ReactNode;
}

export default function PremiumLock({
  isLocked,
  featureTitle,
  requiredTierName,
  onUpgradeClick,
  nota,
  children,
}: PremiumLockProps) {
  if (!isLocked) {
    return <div className="mt-4">{children}</div>;
  }

  /* ⚠️ `min-h` NÃO É ESTÉTICA — é o conserto do cadeado a transbordar.
     O overlay é `absolute inset-0`, ou seja, a altura dele vem do filho
     desfocado. Quando o conteúdo bloqueado é curto (o parecer jurídico
     bloqueado é um parágrafo), o cartão do cadeado ficava mais alto do que a
     caixa e derramava por cima do divisor de capítulo acima e da secção
     abaixo. Uma altura mínima garante que a caixa sempre cabe o cadeado;
     conteúdo mais alto do que isto continua a mandar na altura — até ao teto.

     ⚠️ O TETO EXISTE PELA RAZÃO OPOSTA. O Radar de Concorrentes bloqueado
     mede uns três mil pixels; com o overlay centrado nessa altura, o cadeado
     e o convite ficavam a meio de uma parede de borrão, e era preciso rolar
     muito para descobrir POR QUE a secção estava assim. Um teaser é uma
     amostra: mostra o formato do que existe do outro lado e diz o preço, não
     obriga a percorrer o recurso inteiro desfocado. */
  return (
    <div className="relative mt-4 max-h-[30rem] min-h-[18rem] overflow-hidden rounded-2xl">
      {/* O conteúdo real, desfocado — não um esqueleto inventado. Quem olha
          vê a forma do que existe do outro lado. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none opacity-40 blur-[6px] grayscale"
      >
        {children}
      </div>

      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto bg-white/70 p-8 text-center backdrop-blur-[3px]">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm">
          <Lock size={18} />
        </div>
        <h4 className="text-[17px] font-semibold tracking-tight text-slate-900">{featureTitle}</h4>
        <p className="mt-1.5 max-w-sm text-sm font-medium leading-relaxed text-slate-600">
          Disponível a partir do <strong className="font-semibold text-slate-900">{requiredTierName}</strong>.
        </p>
        {nota && (
          <p className="mt-1.5 max-w-sm text-[11px] font-medium leading-relaxed text-slate-400">{nota}</p>
        )}
        <button
          onClick={onUpgradeClick}
          className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.98]"
        >
          Ver planos
        </button>
      </div>
    </div>
  );
}
