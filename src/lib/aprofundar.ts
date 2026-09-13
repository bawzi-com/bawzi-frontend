/** O preço de "Aprofundar este laudo" — UMA conta, para as três telas que a
 *  mostram (banner e faixa do laudo, botão do histórico) e para o botão da
 *  profunda no formulário, que cota o preço cheio.
 *
 *  ⚠️ AS TRÊS TELAS DIZIAM "1 CRÉDITO" E O PORTÃO DEBITAVA 9. Medido em
 *  13/09/2026 num laudo do plano Avançado: a faixa dizia "Aprofundar por 1
 *  crédito", o banner "Auditoria profunda · 1 crédito", o histórico
 *  "Aprofundar 1 créditos". O backend (`modos.custo_em_creditos`, desde
 *  07/09/2026) cobra 1 na rápida e `peso_profunda` na profunda — 4, 7 ou 10
 *  conforme o plano — e o aprofundamento abate o que a rápida debitou:
 *  `max(1, peso − pago)`, em `router_analyses`. Dez menos um: nove.
 *
 *  A origem do erro: por algumas horas em 07/09 a régua devolveu 1 para
 *  tudo (o docstring de `custo_em_creditos` conta). O backend voltou ao
 *  multiplicador; o frontend ficou na versão de algumas horas, em três
 *  cópias da mesma conta. Por isso ela agora mora aqui, uma vez, com teste.
 */

export type Unidade = 'creditos' | 'analises' | null | undefined;

export interface PrecoAprofundar {
  /** Preço cheio da auditoria profunda. `null` enquanto não há como saber. */
  cheio: number | null;
  /** O que a rápida debitou e será abatido. `null` quando não há abatimento. */
  pago: number | null;
  /** O que a pessoa paga. `null` enquanto o preço não pode ser calculado. */
  diferenca: number | null;
}

/** O que a leitura rápida DEBITOU do saldo — a MESMA cascata que o backend
 *  usa para abater (`router_analyses`, "Aprofundar este laudo"):
 *
 *    1. `creditos_cobrados` — o valor medido, presente e zero É zero;
 *    2. `em_cortesia` — o laudo afirma que nada saiu do saldo;
 *    3. `creditos` — o preço do pedido, única informação nos laudos antigos.
 *
 *  ⚠️ Abater `creditos` direto dava desconto por uma rápida servida em
 *  cortesia: a casa dava o mesmo crédito duas vezes. O backend já não faz
 *  isso; a tela tem de mostrar a conta que ele vai fazer, não outra. */
export function debitadoNaLeitura(laudo: {
  creditos_cobrados?: number | null;
  em_cortesia?: boolean | null;
  creditos?: number | null;
}): number | null {
  if (typeof laudo.creditos_cobrados === 'number' && Number.isFinite(laudo.creditos_cobrados)) {
    return Math.max(0, laudo.creditos_cobrados);
  }
  if (laudo.em_cortesia) return 0;
  if (typeof laudo.creditos === 'number' && Number.isFinite(laudo.creditos)) {
    return Math.max(0, laudo.creditos);
  }
  return null;
}

/** Preço cheio de UMA auditoria profunda na régua fixa: `peso_profunda`,
 *  mínimo 1. `null` enquanto o peso não chegou — melhor preço nenhum do que
 *  preço errado numa cotação que é firme. */
export function precoProfundaCheio(pesoProfunda: number | null | undefined): number | null {
  const peso = Number(pesoProfunda);
  if (!Number.isFinite(peso) || peso <= 0) return null;
  return Math.max(1, Math.floor(peso));
}

export function precoAprofundar(
  jaPago: number | null | undefined,
  pesoProfunda: number | null | undefined,
  unidade?: Unidade,
): PrecoAprofundar {
  // ── Régua FIXA (por análise): rápida 1, profunda `peso`, abate o pago ──
  if (unidade === 'analises') {
    const cheio = precoProfundaCheio(pesoProfunda);
    if (cheio === null) return { cheio: null, pago: null, diferenca: null };
    // Peso 1 (planos de entrada): profunda e rápida custam o mesmo, e
    // "completa 1 − já pago 1 = você paga 1" seria uma subtração que não
    // subtrai. Uma linha só, com o mínimo que o portão cobra.
    if (cheio <= 1) return { cheio: 1, pago: null, diferenca: 1 };
    const pago = typeof jaPago === 'number' && jaPago > 0 ? jaPago : null;
    return { cheio, pago, diferenca: Math.max(1, cheio - (pago ?? 0)) };
  }

  // ── Régua por CUSTO: profunda = pago × peso, diferença = pago × (peso − 1) ──
  // Sai do que o laudo JÁ custou, não de estimativa sobre texto: o texto
  // salvo é truncado e a estimativa daria um número menor que o cobrado.
  const pago = typeof jaPago === 'number' && jaPago > 0 ? jaPago : null;
  const peso = Math.max(1, Number(pesoProfunda) || 0);
  if (pago === null || peso <= 1) return { cheio: null, pago, diferenca: null };
  return { cheio: pago * peso, pago, diferenca: pago * (peso - 1) };
}
