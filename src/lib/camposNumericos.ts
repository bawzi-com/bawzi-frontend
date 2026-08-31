/* Guardas dos campos numéricos da tela de admin.
 *
 * Vivem aqui, e não dentro da página, porque são a única coisa entre um campo
 * de formulário e a configuração de plano de TODOS os clientes — e porque
 * função dentro de um componente de 6.000 linhas não tem como ser testada.
 */

/* Célula de preço vazia ou ilegível mantém o valor atual, em vez de virar 0.
   Aceita vírgula decimal pelo mesmo motivo do `cortesia_fator`. */
export function precoOuAtual(bruto: unknown, atual: number): number {
  const n = parseFloat(String(bruto ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : atual;
}

/* ⚠️ `parseInt(e.target.value) || 0` ERA O CAMINHO MAIS CURTO PARA UMA COTA
   ILIMITADA. Esvaziar o campo para redigitar dá `""`; `parseInt("")` é `NaN`;
   o `|| 0` transforma isso em zero. E zero não é "nenhum" nestes campos:
   `monthly_limit: 0` significa ILIMITADO em toda a plataforma
   (`router_analyses`: `if limite_atual > 0`), enquanto `max_chars: 0` recusa
   qualquer texto e `max_mb: 0` recusa todo upload — para TODOS os clientes do
   plano, no instante do Salvar.

   Os dois campos vizinhos que dividem e multiplicam cobrança já tinham essa
   guarda (`caracteres_por_credito` com `Math.max(1000, …)` e `peso_profunda`
   com `Math.min(50, Math.max(1, …))`). Estes três ficaram de fora.

   Campo vazio ou ilegível volta ao valor ATUAL do plano — não a zero, não ao
   piso — porque quem apagou quer redigitar, não zerar. */
export function inteiroOuPadrao(bruto: string, atual: number, piso: number): number {
  const n = parseInt(bruto, 10);
  if (!Number.isFinite(n)) return atual;
  return Math.max(piso, n);
}
