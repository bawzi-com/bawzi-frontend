'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
 * ⚠️ E POR QUE, MESMO ASSIM, O BALÃO VAI PARA O `document.body` VIA PORTAL.
 * `fixed` + `z-[9999]` não bastam: `z-index` só compete DENTRO do contexto de
 * empilhamento em que o elemento nasce. Medido na tela de análise, a cadeia
 * acima do gatilho era `section.relative z-10` → `div.relative z-20`, então os
 * 9999 do balão valiam apenas dentro daquele `z-10` — e o trilho do menu, que
 * é `fixed z-30` na raiz, passava por cima e cortava a explicação ao meio.
 * Subir o número não resolveria nada: 99999 dentro de um `z-10` continua
 * abaixo de um `z-30` de fora.
 *
 * ⚠️ E O DEFEITO NÃO APARECE NO `elementFromPoint`. O trilho é
 * `pointer-events-none`: ele PINTA por cima mas é invisível para o teste de
 * clique, então toda sondagem por hit-test dizia que o balão estava no topo
 * enquanto a tela mostrava o contrário. O que o teste checa, por isso, é
 * estrutural: o balão precisa ser filho do `body`, sem nenhum contexto de
 * empilhamento no caminho.
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
  /** `sm` para rótulos miúdos, como os da carteira de créditos (9-10px).
   *
   *  ⚠️ O ALVO DE TOQUE NÃO ENCOLHE JUNTO. O botão fica 12px visualmente, mas
   *  o `before:` estende a área clicável para 36px. Encolher o alvo de verdade
   *  tornaria a ajuda inalcançável no celular — que é exatamente onde `title=""`
   *  já falhava e este componente veio resolver.
   *
   *  ⚠️ POR QUE 12px E NÃO 16px. Na carteira são QUATRO gatilhos numa linha só;
   *  a 16px eles sozinhos custavam 72px dos ~316px úteis de um celular — 23% da
   *  linha para quatro ícones — e era o que fazia a carteira quebrar em 2×2,
   *  descolando "Disponível" de "Do plano". Medido: 351px exigidos contra 316
   *  disponíveis. Só a área VISÍVEL encolheu. */
  tamanho?: 'sm' | 'md';
}

export default function Tooltip({ rotulo, children, className = '', tamanho = 'md' }: TooltipProps) {
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
        className={`relative flex items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
          tamanho === 'sm'
            // `before:` amplia o alvo de toque sem ocupar espaço no layout —
            // 12px de ícone com ~36px de área clicável.
            ? 'h-3 w-3 before:absolute before:-inset-3 before:content-[""]'
            : 'h-6 w-6'
        }`}
      >
        <HelpCircle size={tamanho === 'sm' ? 10 : 14} strokeWidth={2.5} />
      </button>

      {aberto && typeof document !== 'undefined' && createPortal(
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
          // ⚠️ `normal-case`, `tracking-normal`, `font-medium` E
          // `whitespace-normal` FICAM, MESMO COM O PORTAL. Enquanto o balão era
          // filho do gatilho ele herdava a tipografia do rótulo hospedeiro, e
          // isso já quebrou a explicação DUAS vezes:
          //   · ao lado de um rótulo `uppercase tracking-[0.14em] font-black`
          //     — que é como todo rótulo da carteira é escrito — o parágrafo
          //     inteiro saía em CAIXA ALTA, espaçado e em negrito;
          //   · quando a carteira precisou caber em uma linha e o rótulo ganhou
          //     `whitespace-nowrap`, o texto virou UMA linha só e o
          //     `overflow-y-auto` recortou tudo à direita — a ajuda aparecia
          //     como "...É a soma de tudo à esquerda, r" e 228px de explicação
          //     simplesmente não existiam na tela.
          // O portal corta a herança na raiz, mas as anulações continuam aqui
          // de propósito: elas custam nada e são a rede se o balão um dia
          // voltar a renderizar em linha. Os dois defeitos só aparecem no
          // navegador — o JSX estava certo nas duas vezes, o CSS herdado é que
          // não.
          className={`fixed z-[9999] w-[min(21rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain whitespace-normal rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-left text-[11px] font-medium normal-case tracking-normal leading-relaxed text-slate-200 shadow-2xl ${className}`}
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
