'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
 * TOOLTIP EXPLICATIVO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ NÃO É `title=""`. O projeto usava o atributo nativo em cinco lugares só no
 * Radar, e ele falha justamente para quem mais precisa da explicação:
 *   · em celular não existe hover, então o texto NUNCA aparece;
 *   · o atraso do navegador (~1s) é longo o bastante para a pessoa desistir;
 *   · não aceita formatação, então explicação com exemplo vira parede de texto;
 *   · alguns leitores de tela ignoram `title` quando o elemento já tem rótulo.
 *
 * Abre por CLIQUE (toque funciona), e também por hover e por foco de teclado.
 * Fecha com Escape, clique fora, ou rolagem.
 *
 * ⚠️ POR QUE `position: fixed` E NÃO `absolute`.
 * A primeira versão usava `absolute bottom-full`, e uma medição com Playwright
 * mostrou que ela era inutilizável nos dois tamanhos testados: o painel de
 * busca que hospeda o gatilho tem `overflow-hidden`, e o balão (357px de
 * altura) nascia 222px ACIMA do topo desse painel — dois terços do texto
 * simplesmente recortados. A 390px ele ainda vazava 274px pela direita.
 * Nenhum ajuste de `bottom-full` para `top-full` resolve, porque o espaço
 * disponível depende do que mais está renderizado no painel naquele momento.
 *
 * `fixed` sai do fluxo de recorte do ancestral, e aí a posição é calculada em
 * relação à viewport: acima do gatilho se couber, abaixo se não couber, e
 * sempre preso dentro das bordas laterais da tela.
 *
 * ⚠️ O GATILHO É UM <button> IRMÃO, NUNCA FILHO DE UM <label>. Dentro do rótulo
 * de um checkbox, clicar na interrogação alterna o próprio controle que ela
 * explica — a pessoa pede ajuda sobre a "Busca exata" e liga a busca exata.
 */

const MARGEM = 12;   // respiro mínimo até a borda da viewport
const DISTANCIA = 8; // espaço entre o gatilho e o balão

interface TooltipProps {
  /** Descreve o QUE será explicado — vira o rótulo acessível do gatilho. */
  rotulo: string;
  children: React.ReactNode;
  className?: string;
}

export default function Tooltip({ rotulo, children, className = '' }: TooltipProps) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const id = useId();

  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const balaoRef = useRef<HTMLSpanElement>(null);
  // Hover e clique disputam o mesmo estado: sem separar, tirar o mouse fecharia
  // um balão que a pessoa abriu no clique justamente para poder ler com calma.
  const fixadoRef = useRef(false);

  const fechar = useCallback(() => {
    fixadoRef.current = false;
    setAberto(false);
    setPos(null);
  }, []);

  // useLayoutEffect: posiciona ANTES da pintura. Com useEffect, o balão
  // aparece um quadro no canto errado e "pula" para o lugar.
  useLayoutEffect(() => {
    if (!aberto) return;
    const g = gatilhoRef.current?.getBoundingClientRect();
    const b = balaoRef.current?.getBoundingClientRect();
    if (!g || !b) return;

    const larguraTela = document.documentElement.clientWidth;
    const alturaTela = document.documentElement.clientHeight;

    const left = Math.max(MARGEM, Math.min(g.left, larguraTela - b.width - MARGEM));

    // Acima por padrão; abaixo só quando não cabe — assim o balão não tapa o
    // próprio controle que está explicando, a menos que não haja escolha.
    const cabeAcima = g.top >= b.height + DISTANCIA + MARGEM;
    let top = cabeAcima ? g.top - b.height - DISTANCIA : g.bottom + DISTANCIA;

    // ⚠️ TELA BAIXA: nem acima nem abaixo cabe.
    // Medido num viewport de 390×420 (celular pequeno com o teclado aberto — que
    // é exatamente quando alguém está mexendo neste campo): o balão de 303px ia
    // parar em `bottom: 634`, ou seja, 214px abaixo da borda inferior, sem
    // nenhuma forma de rolar até ele. Prender dentro da tela é o que garante
    // que a explicação sempre possa ser lida; o `maxHeight` no elemento cuida
    // do caso em que ela é mais alta que a própria tela.
    top = Math.max(MARGEM, Math.min(top, alturaTela - b.height - MARGEM));
    setPos({ top, left });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const onDown = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!gatilhoRef.current?.contains(alvo) && !balaoRef.current?.contains(alvo)) fechar();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    // Rolar move o gatilho e deixa o balão para trás — `fixed` não acompanha.
    // Fechar é mais honesto que exibir um balão apontando para o nada.
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [aberto, fechar]);

  return (
    <span className="inline-flex shrink-0 items-center">
      <button
        ref={gatilhoRef}
        type="button"
        aria-label={`O que significa: ${rotulo}`}
        aria-expanded={aberto}
        aria-describedby={aberto ? id : undefined}
        onClick={(e) => {
          // O gatilho vive ao lado de rótulos e dentro de um <form>. Sem isto,
          // um ancestral clicável come o clique, ou o formulário dá submit.
          e.preventDefault();
          e.stopPropagation();
          if (aberto && fixadoRef.current) { fechar(); return; }
          fixadoRef.current = true;
          setAberto(true);
        }}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => { if (!fixadoRef.current) setAberto(false); }}
        onFocus={() => setAberto(true)}
        onBlur={() => { if (!fixadoRef.current) setAberto(false); }}
        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        <HelpCircle size={14} strokeWidth={2.5} />
      </button>

      {aberto && (
        <span
          ref={balaoRef}
          id={id}
          role="tooltip"
          style={{
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            // Invisível até ter posição medida: sem isto o balão pisca no
            // canto superior esquerdo antes de assumir o lugar certo.
            visibility: pos ? 'visible' : 'hidden',
          }}
          className={`fixed z-[9999] w-[min(21rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-left text-[11px] font-medium leading-relaxed text-slate-200 shadow-2xl ${className}`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
