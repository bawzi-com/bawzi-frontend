/**
 * A conta da compra avulsa de créditos, em CENTAVOS (26/09/2026).
 *
 * O crédito passou de R$ 1,00 para R$ 4,90, e a divisão em ponto flutuante
 * deixou de fechar: `245 / 4.9` dá 49,999…, e o `Math.floor` mostrava 49
 * créditos a quem ia pagar por 50. Em centavos, 24.500 / 490 = 50 exatos — a
 * mesma conta do servidor (`_preco_credito_centavos`, em router_billing).
 *
 * Funções puras, testadas sem navegador.
 */

export const centavos = (reais: number): number => Math.round(reais * 100);

/** Quantos créditos INTEIROS o valor compra. */
export function creditosDoValor(valorBRL: number, precoBRL: number): number {
  const preco = centavos(precoBRL);
  return preco > 0 && valorBRL > 0 ? Math.floor(centavos(valorBRL) / preco) : 0;
}

/** O que se paga: só os créditos inteiros. Quem digita R$ 50 a R$ 4,90 leva
 *  10 créditos e paga R$ 49 — o servidor cobra exatamente isso. */
export function valorCobrado(valorBRL: number, precoBRL: number): number {
  return (creditosDoValor(valorBRL, precoBRL) * centavos(precoBRL)) / 100;
}

/** O texto do campo de valor, sempre com as duas casas: "98,00", "24,50",
 *  "1.225,00" — o mesmo formato que a máscara produz ao digitar, para a
 *  sugestão clicada e o valor inicial entrarem iguais ao que a pessoa digitaria.
 *
 *  ⚠️ `String(24.5)` DAVA "24.5", e o campo lê ponto como separador de
 *  milhar: virava R$ 245. */
export function paraOCampo(valor: number): string {
  return (centavos(valor) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** O rótulo curto de uma sugestão: "49", "122,50" — sem ",00" no que é redondo. */
export function rotuloDoValor(valor: number): string {
  return Number.isInteger(valor) ? valor.toLocaleString('pt-BR') : paraOCampo(valor);
}

/** Até R$ 9.999.999,99 — muito acima do teto da compra, que o aviso da faixa
 *  já recusa; o limite só impede o campo de crescer sem fim. */
export const MAX_DIGITOS = 9;

/** Máscara de moeda: só os dígitos contam, e os dois últimos são os centavos.
 *  "2500" → "25,00"; "7" → "0,07"; digitar mais um "1" em "25,00" → "250,01".
 *  Marcelo: "ao digitar, preencha automaticamente as duas casas decimais".
 *
 *  Sem dígitos (ou só zeros) o campo fica VAZIO, não "0,00": um "0,00" que o
 *  backspace não apaga prende o campo, e o vazio já mostra o placeholder. */
export function mascararValor(texto: string): string {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITOS);
  return digitos ? paraOCampo(Number(digitos) / 100) : '';
}

/** O número do campo: ponto é milhar, vírgula é decimal. Lixo vira 0. */
export function doCampo(texto: string): number {
  const limpo = texto.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}
