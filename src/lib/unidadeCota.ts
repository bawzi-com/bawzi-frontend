/**
 * A palavra que nomeia a cota — "análise" ou "crédito" — de uma fonte só.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ ESTE ARQUIVO EXISTE PORQUE A PALAVRA ESTAVA CRAVADA EM CINCO TELAS.
 * ═══════════════════════════════════════════════════════════════════════════
 * `créditos/mês` literal em `profile`, `ChangePlanModal`, `PricingSection` e
 * mais — a mesma família do preço escrito à mão que `lib/precos.ts` resolveu,
 * e da capacidade que rendeu "1.000 análises/mês" num plano de 90.
 *
 * ⚠️ E A ESCOLHA DA PALAVRA SE INVERTEU EM 07/09/2026.
 * `PricingSection` decidira dizer "créditos" em TODOS os planos, de propósito:
 * nos tiers -1 e 1 uma análise já custava 1 crédito, e chamar aquilo de
 * "análises" enquanto o Avançado dizia "créditos" punha DUAS MOEDAS na mesma
 * página — "100 análises/mês" contra "540 créditos/mês" leem como sistemas
 * diferentes, e o degrau entre os planos fica incomparável.
 *
 * O raciocínio estava certo, e a premissa dele caiu: desde que a régua fixa
 * cobra 1 por análise (`modos.custo_em_creditos`), a unidade é a MESMA em
 * todos os planos. O problema das duas moedas some sozinho, e "análises" passa
 * a ser uniforme E concreto — "320 análises/mês" diz o que o cliente recebe;
 * "320 créditos/mês" ainda pede que ele pergunte quanto custa cada uma.
 *
 * Se a régua POR CUSTO for ligada no Admin, o crédito volta a variar com
 * tamanho e modelo, e a palavra volta a ser "crédito" — porque aí ela é a
 * verdade. Quem decide é `regua.tipo`, que vem do backend; não este arquivo.
 */
import type { ReguaInfo } from '@/Contexts/TierContext';

/** "crédito" quando um crédito pode diferir de uma análise; "análise" quando não.
 *
 *  ⚠️ A CONDIÇÃO É O MULTIPLICADOR, e ela já esteve errada nas duas pontas.
 *  Por algumas horas a régua fixa cobrou 1 por análise em qualquer modo, e
 *  então "análises" era a palavra certa em toda a escada. O multiplicador
 *  voltou — sem ele a cota não respondia à escolha do cliente — e com ele uma
 *  auditoria profunda custa `peso` créditos. Dizer "análises" ali faria a
 *  página prometer 320 análises num plano que entrega 320 rápidas OU 32
 *  profundas.
 *
 *  `tipo === 'custo'` também mantém crédito: lá o valor varia com tamanho e
 *  modelo, e a distância entre crédito e análise é ainda maior. */
export function unidadeCota(regua: ReguaInfo | null | undefined, n: number): string {
  // ⚠️ A COTA É DITA EM ANÁLISES RÁPIDAS, NÃO EM "CRÉDITOS".
  // Com o multiplicador, "320 análises" prometeria demais (o plano dá 320
  // rápidas OU 32 profundas) e "320 créditos" obrigaria o cliente a aprender
  // uma moeda para depois converter. Dizer a unidade que ele já usa, e cotar a
  // profunda NELA ("consome 10"), elimina a conversão inteira.
  //
  // Na régua POR CUSTO não há unidade estável — o valor varia com tamanho e
  // modelo —, e aí "crédito" volta a ser a palavra honesta.
  if (regua?.tipo === 'custo') return n === 1 ? 'crédito' : 'créditos';
  if ((regua?.peso_profunda ?? 1) > 1) {
    return n === 1 ? 'análise rápida' : 'análises rápidas';
  }
  return n === 1 ? 'análise' : 'análises';
}

/** "320 análises/mês", já formatado em pt-BR. */
export function cotaMensal(regua: ReguaInfo | null | undefined, n: number): string {
  return `${n.toLocaleString('pt-BR')} ${unidadeCota(regua, n)}/mês`;
}
