/**
 * O código da campanha, do link até o cadastro.
 *
 * ⚠️ O PROBLEMA QUE ISTO RESOLVE: a pessoa clica em
 * `bawzi.com/?campanha=LANCAMENTO`, lê a home, navega para /plans, volta,
 * abre o modal e só então cria a conta. Nesse caminho a query string some na
 * primeira navegação — ler `window.location.search` na hora do submit acha
 * nada, e a campanha não credita ninguém que tenha olhado o site antes de se
 * cadastrar. Que é praticamente todo mundo.
 *
 * Por isso o código é capturado assim que aparece e guardado. `localStorage`,
 * e não `sessionStorage`: quem abre o link no celular, fecha e volta à noite
 * pelo desktop já é outra sessão de qualquer jeito, mas quem volta no MESMO
 * navegador dois dias depois continua sendo a mesma pessoa que a campanha
 * trouxe.
 *
 * O servidor decide se o código vale. Aqui nada é validado além do formato —
 * o frontend não sabe se a campanha está ativa, na janela ou com vaga, e
 * fingir que sabe só criaria uma segunda regra para divergir da primeira.
 */
const CHAVE = 'bawzi_campanha';
const FORMATO = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

function normalizar(v: string | null | undefined): string {
  if (!v) return '';
  const limpo = String(v).trim().toUpperCase();
  return FORMATO.test(limpo) ? limpo : '';
}

/**
 * Captura o `?campanha=` da URL, se houver, e devolve o código conhecido.
 *
 * Idempotente e seguro em SSR. Chame de qualquer componente cliente que monte
 * em toda página — hoje é o `PromoBanner`, que vive no layout raiz.
 */
export function campanhaAtual(): string {
  if (typeof window === 'undefined') return '';
  try {
    const daUrl = normalizar(new URLSearchParams(window.location.search).get('campanha'));
    if (daUrl) {
      // ⚠️ A URL SEMPRE VENCE O QUE ESTAVA GUARDADO. Quem chega por um link
      // novo está numa campanha nova; manter a antiga daria o bônus errado a
      // quem clicou no certo.
      localStorage.setItem(CHAVE, daUrl);
      return daUrl;
    }
    return normalizar(localStorage.getItem(CHAVE));
  } catch {
    // localStorage bloqueado (janela anônima com cookies de terceiros
    // travados). Sem persistência, mas o cadastro na mesma página ainda pega.
    try {
      return normalizar(new URLSearchParams(window.location.search).get('campanha'));
    } catch {
      return '';
    }
  }
}

/** Esquece o código depois do cadastro — ele já foi resgatado ou recusado. */
export function limparCampanha(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}
