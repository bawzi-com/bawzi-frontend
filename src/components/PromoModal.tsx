'use client';

/**
 * O pop-up da campanha — a primeira coisa que quem chega vê, uma vez por acesso.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE UM MODAL, SE JÁ EXISTE UM BANNER
 * ═══════════════════════════════════════════════════════════════════════════
 * A barra no topo é fácil de não ver: fica acima da dobra, tem 13px de fonte e
 * compete com o cabeçalho. Para uma campanha com VAGA CONTADA e prazo, isso é
 * caro — o benefício acaba e quem passou pelo site nunca soube que existia.
 *
 * Interromper a tela só se justifica quando há algo real a perder, e é por
 * isso que este componente exige os dois números do backend: as vagas
 * restantes (contador atômico, não texto digitado) e o prazo. Sem escassez
 * verdadeira, o modal seria só ruído com um X.
 *
 * ⚠️ E POR ISSO ELE NÃO É PARA QUEM JÁ TEM CONTA. A campanha dá bônus no
 * CADASTRO. Um modal no meio da tela oferecendo a alguém logado uma coisa que
 * ela não pode resgatar é interrupção pura. Quem decide isso é o `PromoBanner`,
 * que conhece a sessão; aqui só se desenha o que já foi decidido.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Sparkles, X } from 'lucide-react';
import { type DadosPromo, ofertaDaCampanha, paletaPromo } from '@/lib/promo';

interface Props {
  dados: DadosPromo;
  /** Contagem regressiva já formatada — o mesmo relógio que o banner usa. */
  countdown?: string;
  onClose: () => void;
}

const FOCAVEIS = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

export default function PromoModal({ dados, countdown, onClose }: Props) {
  const [copiado, setCopiado] = useState(false);
  const cartaoRef = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<Element | null>(null);

  const c = paletaPromo(dados.color);
  const oferta = ofertaDaCampanha(dados);

  const total = Number(dados.vagas_total) || 0;
  const restantes = typeof dados.vagas_restantes === 'number' ? dados.vagas_restantes : null;
  const usadas = restantes !== null && total > 0 ? Math.max(0, total - restantes) : 0;
  const pctUsado = total > 0 ? Math.min(100, Math.round((usadas / total) * 100)) : 0;

  // ── Foco, teclado e rolagem ───────────────────────────────────────────────
  useEffect(() => {
    focoAnterior.current = document.activeElement;

    // ⚠️ A ROLAGEM DO FUNDO TRAVA ENQUANTO O MODAL ESTÁ ABERTO. Sem isto, rolar
    // com o dedo sobre o overlay move a página atrás — a pessoa fecha o modal e
    // está num lugar diferente de onde parou. Guardamos o valor original em vez
    // de assumir `''`, porque outra tela pode já ter travado a rolagem.
    const rolagemOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Foco no cartão, não no primeiro botão: quem usa leitor de tela precisa
    // ouvir o título antes de ouvir "Fechar".
    cartaoRef.current?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      // ⚠️ ARMADILHA DE FOCO. Sem ela, a tabulação sai do modal e vai para os
      // links do cabeçalho ATRÁS do overlay: o cursor de teclado fica em cima
      // de coisas que o mouse não alcança, e quem navega por Tab se perde numa
      // página que visualmente está bloqueada.
      const alvos = cartaoRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS);
      if (!alvos?.length) return;
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || ativo === cartaoRef.current)) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault(); primeiro.focus();
      }
    };

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = rolagemOriginal;
      // Devolve o foco a quem o tinha, se esse elemento ainda existir. O modal
      // abre sozinho, então quase sempre isso é o `<body>` — e aí não há nada
      // a restaurar, o que é diferente de deixar o foco em um nó removido.
      const antes = focoAnterior.current;
      if (antes instanceof HTMLElement && antes.isConnected) antes.focus();
    };
  }, [onClose]);

  const copiar = useCallback(async () => {
    if (!dados.coupon_code) return;
    try {
      await navigator.clipboard.writeText(dados.coupon_code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard bloqueado: o código continua visível para copiar à mão */
    }
  }, [dados.coupon_code]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      // Clicar no fundo fecha — mas só no fundo: sem o `currentTarget`, um
      // clique que começa dentro do cartão e termina fora fecharia o modal no
      // meio de uma seleção de texto.
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={cartaoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-modal-titulo"
        tabIndex={-1}
        className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none animate-in fade-in slide-in-from-bottom-4 duration-200 sm:rounded-3xl sm:slide-in-from-bottom-0 sm:zoom-in-95"
      >
        {/* Faixa colorida: é o que amarra o modal ao banner que fica depois. */}
        <div className={`relative ${c.bar} px-5 pb-4 pt-5 text-white sm:px-6`}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X size={17} />
          </button>

          {dados.discount_label && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black tracking-wide ${c.badge}`}>
              <Sparkles size={10} />
              {dados.discount_label}
            </span>
          )}

          <h2 id="promo-modal-titulo" className="mt-2 pr-8 text-lg font-black leading-tight sm:text-xl">
            {dados.title || 'Oferta por tempo limitado'}
          </h2>
          {dados.description && (
            <p className={`mt-1 text-[13px] font-medium leading-5 ${c.subtext}`}>{dados.description}</p>
          )}
        </div>

        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          {/* ── O que a conta REALMENTE recebe ──────────────────────────────
              ⚠️ Derivado dos campos que o backend lê para creditar, não do
              texto que alguém digitou no admin. Se os dois discordarem, este
              bloco é o que vale — e é por isso que ele existe. */}
          {oferta && (
            <div className={`rounded-2xl border px-4 py-3 ${c.suave}`}>
              <p className={`text-xl font-black leading-none ${c.tinta}`}>{oferta.valor}</p>
              <p className="mt-1.5 text-[12px] font-bold leading-4 text-slate-700">{oferta.cadencia}</p>
              <p className="text-[12px] font-medium leading-4 text-slate-500">{oferta.prazo}</p>
            </div>
          )}

          {/* ── Escassez, com o número do contador atômico ─────────────────── */}
          {restantes !== null && total > 0 && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-black text-slate-900">
                  {restantes === 0
                    ? 'vagas esgotadas'
                    : restantes === 1
                      ? 'última vaga'
                      : `${restantes.toLocaleString('pt-BR')} vagas restantes`}
                </span>
                <span className="text-[11px] font-bold tabular-nums text-slate-400">
                  de {total.toLocaleString('pt-BR')}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={usadas}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label="Vagas já resgatadas"
              >
                <div className={`h-full rounded-full transition-all ${c.trilho}`} style={{ width: `${pctUsado}%` }} />
              </div>
            </div>
          )}

          {countdown && (
            <p className="mt-3 text-center text-[12px] font-black tabular-nums text-slate-500">
              expira em <span className="text-slate-900">{countdown}</span>
            </p>
          )}

          {/* ── Ação ────────────────────────────────────────────────────────
              O link já leva o código na URL; copiar é o caminho secundário,
              para quem prefere colar no cadastro. */}
          <div className="mt-4 flex flex-col gap-2">
            {dados.link_url && (
              <a
                href={dados.link_url}
                onClick={onClose}
                className={`flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black text-white transition-colors ${c.forte}`}
              >
                {dados.link_text || 'Criar conta e resgatar'}
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl text-[12px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              Agora não
            </button>
          </div>

          {dados.coupon_code && (
            <button
              type="button"
              onClick={copiar}
              className="mt-1 flex w-full items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:text-slate-600"
            >
              {copiado ? <Check size={11} /> : <Copy size={11} />}
              {copiado ? 'código copiado' : <>ou use o código <span className="font-black tracking-widest text-slate-600">{dados.coupon_code}</span></>}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
