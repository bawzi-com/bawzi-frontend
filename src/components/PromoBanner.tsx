'use client';

/**
 * A promoção, nas duas formas: pop-up na chegada, barra depois.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * QUEM APARECE, ONDE E QUANDO
 * ═══════════════════════════════════════════════════════════════════════════
 * O backend decide QUAL promoção existe (campanha tem precedência sobre cupom
 * — ver `/api/admin/promo-banner/public`). Este componente decide COMO ela
 * entra na tela:
 *
 *   campanha, público bate com a sessão  →  pop-up uma vez por acesso, depois barra
 *   campanha, público não bate           →  nada: nem pop-up, nem barra
 *   cupom                                →  só a barra, para todo mundo, como sempre foi
 *
 * ⚠️ QUEM VÊ É `exibir_para`, E ELE MANDA NA BARRA TAMBÉM — ISSO É NOVO. Antes
 * só o pop-up olhava a sessão e a barra aparecia para todo mundo: uma faixa de
 * "crie sua conta e ganhe créditos" em cima de quem já é cliente é ruído puro,
 * porque o bônus é concedido no CADASTRO e não há nada a resgatar ali. O
 * default do backend é `deslogado`, que é justamente essa correção; `logado` e
 * `ambos` existem para campanha que não dependa de conta nova. O cupom não tem
 * esse campo e continua para todo mundo (ver `publicoDaPromo`).
 *
 * ⚠️ O POP-UP CONTINUA SENDO SÓ DA CAMPANHA. O cupom fica de fora por outro
 * motivo — ele é texto livre de um Promotion Code que nada valida, então não
 * há escassez real que justifique tomar a tela.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * "TODO NOVO ACESSO DEVE APARECER" — POR QUE `sessionStorage`
 * ═══════════════════════════════════════════════════════════════════════════
 * O pop-up volta a cada nova sessão do navegador e NÃO volta ao navegar entre
 * páginas nem ao dar F5. `localStorage` seria "uma vez e nunca mais" — a
 * campanha ficaria invisível para quem voltasse na semana seguinte. Nenhuma
 * marca seria "toda página", que ensina a fechar sem ler em dois minutos.
 *
 * A barra da campanha segue a mesma regra: fechar vale para a sessão, não para
 * sempre. Manter o fechamento permanente aqui daria o resultado esquisito de o
 * pop-up voltar no dia seguinte e, ao ser fechado, "virar" uma barra que nunca
 * mais aparece. O cupom mantém o fechamento permanente que já tinha.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, Copy, Check, ArrowRight, Tag } from 'lucide-react';
import { campanhaAtual } from '@/lib/campanha';
import { getAuthToken, initSession } from '@/lib/apiClient';
import { type DadosPromo, paletaPromo } from '@/lib/promo';
import { carregarPromoPublica } from '@/lib/promoPublica';
import PromoModal, { ctaDaPromo, publicoDaPromo, urlDeLogin } from './PromoModal';

const CHAVE_CONSENTIMENTO = 'bawzi_consent_accepted';

/** Leitura de storage que nunca derruba a página (janela anônima, cota, etc.). */
function leu(store: 'local' | 'session', chave: string): string | null {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(chave);
  } catch { return null; }
}
function gravou(store: 'local' | 'session', chave: string, valor: string): void {
  try {
    (store === 'local' ? localStorage : sessionStorage).setItem(chave, valor);
  } catch { /* sem persistência: reaparece, o que é melhor que quebrar */ }
}

function useCountdown(expiresAt: string | null | undefined) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining(''); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (d > 0) setRemaining(`${d}d ${h.toString().padStart(2, '0')}h`);
      else setRemaining(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

export default function PromoBanner() {
  const pathname = usePathname();
  const [banner, setBanner] = useState<DadosPromo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  /** `null` = ainda não sabemos se há sessão. Não decidir nada até saber. */
  const [deslogado, setDeslogado] = useState<boolean | null>(null);
  const [consentimentoResolvido, setConsentimentoResolvido] = useState(false);
  const countdown = useCountdown(banner?.expires_at);

  const codigo = banner?.coupon_code || 'global';
  const chavePopup = `bawzi_promo_popup_${codigo}`;
  const chaveBarra = `bawzi_promo_barra_${codigo}`;
  const chaveCupom = `promo_dismissed_${codigo}`;   // a de sempre, do cupom

  // ── 1. Os dados da promoção ───────────────────────────────────────────────
  useEffect(() => {
    // ⚠️ A CAPTURA DO CÓDIGO MORA AQUI PORQUE ESTE COMPONENTE ESTÁ NO LAYOUT
    // RAIZ — monta em toda página, logado ou não, e mesmo quando o banner não
    // aparece. Vem antes do fetch de propósito: quem chega por `?campanha=X`
    // numa página sem banner precisa ter o código guardado do mesmo jeito,
    // senão o cadastro não sabe de onde a pessoa veio.
    campanhaAtual();

    // ⚠️ O FETCH SAIU DAQUI PARA `lib/promoPublica`. O resultado do taster
    // passou a mostrar a MESMA oferta no CTA, e dois componentes buscando a
    // mesma rota no primeiro paint são duas requisições e duas verdades
    // possíveis sobre o número de vagas. A promessa é compartilhada; quem
    // chegar depois reaproveita.
    carregarPromoPublica().then((data) => { if (data) setBanner(data); });
  }, []);

  // ── 2. Tem sessão? ────────────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;

    // ⚠️ A LEITURA BARATA PRIMEIRO — E NÃO É ECONOMIA DE REDE, É O QUE IMPEDE
    // ESTE BANNER DE DERRUBAR A PÁGINA QUE VEM DEPOIS DELE.
    //
    // `initSession()` é de USO ÚNICO quando o cookie de refresh não resolve:
    // ele lê o `bawzi_token` legado do localStorage, adota o valor e APAGA a
    // chave ("lemos mas nunca mais escrevemos", diz o apiClient) — quem chamar
    // em seguida recebe `null`. E no `layout.tsx` este componente fica ANTES de
    // `{children}`, então o efeito dele roda antes do efeito da página.
    //
    // A primeira versão chamava `initSession()` direto e o `/admin`, que faz
    // `await initSession()` para se autorizar, parou de renderizar. O
    // `ChatWidget` faz a mesma chamada e nunca causou isso porque está DEPOIS
    // de `{children}`: a página pega o token primeiro. Medido em A/B com uma
    // linha de diferença — `tests/verifica_campanha.mjs` vai de 17 falhas para
    // zero — e é esse teste que guarda a regressão.
    const emMaos = getAuthToken();
    if (emMaos) { setDeslogado(false); return; }

    // ⚠️ E O `initSession()` CONTINUA NECESSÁRIO AQUI. Sem ele, quem fechou o
    // navegador ontem e voltou hoje tem só o cookie HttpOnly — o token de
    // acesso morreu com a aba — e `getAuthToken()` devolveria `null`. Ou seja,
    // exatamente o caso "novo acesso", o único em que o pop-up abre, é o caso
    // em que a leitura rápida sozinha erraria e mostraria o modal a um
    // cliente. `renewToken` tem trava de chamada única, então isto aproveita o
    // refresh que o `Header` já disparou em vez de fazer um segundo.
    initSession()
      .then((t) => { if (vivo) setDeslogado(!t); })
      .catch(() => { if (vivo) setDeslogado(true); });
    return () => { vivo = false; };
  }, []);

  // ── 3. O consentimento já foi resolvido? ──────────────────────────────────
  useEffect(() => {
    // ⚠️ DOIS AVISOS AO MESMO TEMPO NÃO SÃO DOIS AVISOS — SÃO ZERO. Numa
    // primeira visita o `ConsentBanner` já ocupa o rodapé; abrir o modal por
    // cima faz a pessoa fechar os dois no reflexo, sem ler nenhum. O pop-up
    // espera o "Entendi" e entra logo em seguida, com a tela só para ele.
    if (leu('local', CHAVE_CONSENTIMENTO)) { setConsentimentoResolvido(true); return; }
    const aoAceitar = () => setConsentimentoResolvido(true);
    window.addEventListener('bawzi_lgpd_accepted', aoAceitar);
    return () => window.removeEventListener('bawzi_lgpd_accepted', aoAceitar);
  }, []);

  // ── 4. A decisão ──────────────────────────────────────────────────────────
  const eCampanha = banner?.origem === 'campanha';

  /**
   * Esta sessão é do público desta promoção? `null` = ainda não dá para dizer.
   *
   * ⚠️ O TERCEIRO ESTADO É DE PROPÓSITO, E AGORA VALE PARA A BARRA. Enquanto
   * `deslogado` for `null` não sabemos se há sessão; chutar "pode ver" mostra
   * a barra e a esconde meio segundo depois, na cara de quem nem era o
   * público. Melhor atrasar do que piscar — regra que o pop-up já seguia.
   */
  const podeVer = useMemo<boolean | null>(() => {
    if (!banner || deslogado === null) return null;
    const publico = publicoDaPromo(banner);
    if (publico === 'ambos') return true;
    return publico === 'logado' ? !deslogado : deslogado;
  }, [banner, deslogado]);

  // ⚠️ O POP-UP NÃO ABRE MAIS SOZINHO (10/09/2026).
  //
  // Ele abria na primeira visita, por cima do herói, antes de a pessoa ler uma
  // linha sobre o produto. Para quem chega de anúncio, a primeira imagem da
  // Bawzi era um cupom de um produto que ela ainda não conhecia — e o reflexo
  // é fechar sem ler. O próprio `page.tsx` já dizia onde a campanha vale
  // alguma coisa: "DEPOIS do veredito: ali a pessoa já tem a prova na mão e
  // está decidindo se cria conta". O CTA daquela tela carrega o bônus e as
  // vagas restantes. O pop-up competia com esse gancho, e chegava antes.
  //
  // A barra fica. O modal continua montado abaixo e `setModalAberto` continua
  // existindo, para que abri-lo por um clique (e não por chegada) seja uma
  // linha; o que saiu foi só o gatilho automático. Se for religar, o gatilho
  // era: `podeVer === true && consentimentoResolvido &&
  // rotaAceitaPopup(pathname) && !leu('session', chavePopup)` — e
  // `rotaAceitaPopup` (lib/promo.ts) documenta, rota a rota, os momentos em
  // que interromper é errado. Vale ler antes.

  // A barra some se já tiver sido fechada — por sessão na campanha, para
  // sempre no cupom.
  useEffect(() => {
    if (!banner) return;
    const fechada = eCampanha ? leu('session', chaveBarra) : leu('local', chaveCupom);
    if (fechada) setDismissed(true);
  }, [banner, eCampanha, chaveBarra, chaveCupom]);

  const fecharModal = useCallback(() => {
    gravou('session', chavePopup, '1');
    setModalAberto(false);
  }, [chavePopup]);

  const handleDismiss = useCallback(() => {
    if (!banner) return;
    if (eCampanha) gravou('session', chaveBarra, '1');
    else gravou('local', chaveCupom, '1');
    setDismissed(true);
  }, [banner, eCampanha, chaveBarra, chaveCupom]);

  const handleCopy = useCallback(async () => {
    if (!banner?.coupon_code) return;
    try {
      await navigator.clipboard.writeText(banner.coupon_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso
    }
  }, [banner?.coupon_code]);

  const c = useMemo(() => paletaPromo(banner?.color), [banner?.color]);

  if (!banner || !banner.active) return null;

  // ⚠️ A BARRA TEM CTA PRÓPRIO, ENTÃO TEM OS TRÊS CASOS DO POP-UP. `cadastro`
  // é o link que o backend mandou, como sempre foi; `login` troca destino e
  // rótulo; `ambos` põe os dois, e aí o de entrar vira contorno em vez de um
  // segundo botão branco competindo com o primeiro.
  const cta = ctaDaPromo(banner);
  const linkCadastro =
    cta !== 'login' && banner.link_url && banner.link_text ? banner.link_url : null;
  const mostraLogin = cta === 'login' || cta === 'ambos';

  return (
    <>
      {modalAberto && (
        <PromoModal dados={banner} countdown={countdown} onClose={fecharModal} />
      )}

      {podeVer === true && !dismissed && (
        <div className={`relative w-full ${c.bar} print:hidden`} role="banner" aria-label="Oferta promocional">
          <div className="max-w-[1400px] mx-auto pl-4 pr-11 py-2.5 flex max-sm:flex-nowrap max-sm:gap-x-2.5 flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-center">

            {/* Etiqueta de desconto */}
            {banner.discount_label && (
              <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black tracking-wide ${c.badge}`}>
                <Tag size={10} />
                {banner.discount_label}
              </span>
            )}

            {/* Título + descrição.
                ⚠️ `max-sm:hidden` EM TUDO QUE NÃO É SELO, CÓDIGO OU BOTÃO.
                No celular a barra quebrava em quatro linhas e ficava fixa;
                agora é uma linha — "BONUS · BAWZI50 · Criar conta →" — que
                rola com a página. A oferta inteira (o que dá, quantas vagas,
                até quando) continua aparecendo onde pesa: no CTA logo depois
                do veredito da degustação. */}
            <span className={`max-sm:hidden text-[13px] font-bold leading-tight ${c.text}`}>
              {banner.title}
              {banner.description && (
                <span className={`ml-1.5 font-medium ${c.subtext}`}>{banner.description}</span>
              )}
            </span>

            {/* Código do cupom com botão de cópia */}
            {banner.coupon_code && (
              <button
                onClick={handleCopy}
                title={copied ? 'Copiado!' : banner.origem === 'campanha'
                  ? 'Clique para copiar o código da campanha'
                  : 'Clique para copiar o cupom'}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-[12px] font-black tracking-widest transition-all ${c.copy}`}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {banner.coupon_code}
              </button>
            )}

            {/* Vagas restantes — só a campanha tem esse número.
                ⚠️ VEM DO CONTADOR ATÔMICO, não de um texto que alguém digitou. É
                escassez verdadeira: quando chega a zero o backend para de servir a
                campanha e o banner some sozinho, em vez de continuar anunciando um
                bônus que o cadastro vai negar depois da conta criada. */}
            {banner.origem === 'campanha' && typeof banner.vagas_restantes === 'number' && (
              <span className={`max-sm:hidden shrink-0 text-[11px] font-black tabular-nums ${c.subtext}`}>
                {banner.vagas_restantes === 1
                  ? 'última vaga'
                  : `${banner.vagas_restantes.toLocaleString('pt-BR')} vagas restantes`}
                {banner.vagas_total ? ` de ${banner.vagas_total.toLocaleString('pt-BR')}` : ''}
              </span>
            )}

            {/* Countdown */}
            {countdown && (
              <span className={`max-sm:hidden shrink-0 text-[11px] font-black tabular-nums ${c.subtext}`}>
                expira em {countdown}
              </span>
            )}

            {/* CTA — ver `ctaDaPromo` logo acima do return. O rótulo de
                entrar é fixo: `link_text` é o texto do cadastro e o backend o
                preenche sozinho, então não serve para um botão que leva ao
                login. */}
            {linkCadastro && (
              <a
                href={linkCadastro}
                className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[12px] font-black transition-all ${c.btn}`}
              >
                {banner.link_text}
                <ArrowRight size={12} />
              </a>
            )}

            {mostraLogin && (linkCadastro ? (
              <a
                href={urlDeLogin(banner)}
                className={`max-sm:hidden shrink-0 inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-[12px] font-bold transition-all ${c.copy}`}
              >
                Já tenho conta
              </a>
            ) : (
              <a
                href={urlDeLogin(banner)}
                className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[12px] font-black transition-all ${c.btn}`}
              >
                Entrar
                <ArrowRight size={12} />
              </a>
            ))}
          </div>

          {/* Botão fechar */}
          {banner.dismissible !== false && (
            <button
              onClick={handleDismiss}
              aria-label="Fechar banner"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg opacity-70 hover:opacity-100 transition-opacity text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
