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

/** "análise"/"análises" com a régua fixa; "crédito"/"créditos" com a por custo. */
export function unidadeCota(regua: ReguaInfo | null | undefined, n: number): string {
  const porCusto = regua?.tipo === 'custo';
  if (porCusto) return n === 1 ? 'crédito' : 'créditos';
  return n === 1 ? 'análise' : 'análises';
}

/** "320 análises/mês", já formatado em pt-BR. */
export function cotaMensal(regua: ReguaInfo | null | undefined, n: number): string {
  return `${n.toLocaleString('pt-BR')} ${unidadeCota(regua, n)}/mês`;
}
