/**
 * launchFlags.ts — o escopo do LANÇAMENTO, num lugar só.
 *
 * Pré-lançamento (ago/2026): o produto acumulou mais superfície do que o
 * funil aguenta explicar. Cada flag abaixo esconde — não apaga — um módulo
 * que fica para depois do PMF. O código continua no repositório, testável e
 * pronto; religar é trocar `false` por `true` aqui, num commit de 1 linha.
 *
 * Por que um arquivo e não .env: essas decisões são de PRODUTO e precisam de
 * revisão de código para mudar (e aparecer no diff), não de um ambiente que
 * diverge entre dev e produção em silêncio.
 *
 * O que cada flag esconde:
 *  - capital: aba "Capital" (CapitalIntelligence) — integração de crédito
 *    BTG/Inter/Celcoin/Capital Empreendedor. É quase um produto fintech à
 *    parte, gateado em NÍV. 3-4, e não sustenta a proposta central
 *    (decidir participar de licitação) no dia 1.
 *  - minutaJuridicaOfensiva: botão "Gerar Estratégia Jurídica" + minuta no
 *    War Room. Depende de OSINT raro do concorrente e gera peça jurídica
 *    ofensiva — potente, mas arriscada como vitrine de lançamento.
 *  - compararNaSidebar: o item "Priorizar" da barra lateral. A comparação
 *    continua existindo como MODO do Histórico (botão "Comparar laudos"),
 *    que é onde os laudos já estão — uma aba a menos competindo pela
 *    atenção do primeiro acesso.
 */
export const LAUNCH_FLAGS = {
  capital: false,
  minutaJuridicaOfensiva: false,
  compararNaSidebar: false,
} as const;
