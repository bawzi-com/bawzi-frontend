/**
 * O preço de cada plano, de uma fonte só: o Stripe.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O QUE ISTO SUBSTITUI
 * ═══════════════════════════════════════════════════════════════════════════
 * `price: 'R$ 79/mês'` escrito à mão em CINCO arquivos — `profile/page.tsx`,
 * `ChangePlanModal.tsx`, `UpgradeModal.tsx`, `PricingSection.tsx` e
 * `app/page.tsx` — enquanto o valor que o cartão vai pagar mora só no Stripe.
 *
 * ⚠️ NÃO É HIPÓTESE: A TELA JÁ SE CONTRADIZIA. Na aba Assinatura, o topo
 * mostra `subscription-details.amount`, que vem do Stripe, e a grade "Trocar
 * plano" logo abaixo mostrava o literal. Numa assinatura anual isso rendia
 * "R$ 4.970,00" no cabeçalho e "R$ 497/mês" no cartão do MESMO plano, a 200px
 * de distância. O número errado é o que a pessoa lê no segundo anterior a
 * autorizar uma cobrança.
 *
 * ⚠️ E O MESMO ERRO JÁ TINHA ACONTECIDO COM A COTA. O docstring do
 * `ChangePlanModal` conta: "1.000 análises/mês" num plano de 90 créditos,
 * porque a capacidade estava escrita em dois lugares. A correção foi tirá-la
 * de lá — hoje vem de `/api/tiers/limites-publicos`. O preço ficou. Agora vem
 * de `/api/tiers/precos-publicos`, que lê o `unit_amount` do próprio `Price`
 * que será cobrado; não há como divergir do que é faturado, porque é ele.
 *
 * ⚠️ QUANDO NÃO HÁ PREÇO, NÃO SE INVENTA UM. Se o Stripe não responder, o
 * campo volta `null` e quem chama não mostra preço nenhum. Um valor de
 * reserva aqui seria o defeito de novo, só que mais escondido.
 */
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface PrecoDoPlano {
  nome: string | null;
  /** Já formatado em BRL pelo servidor ("R$ 4.970,00"). `null` = indisponível. */
  valor: string | null;
  centavos: number | null;
  /** Rótulo do ciclo: "Mensal", "Anual"… */
  intervalo: string | null;
  /** Sufixo para colar no valor: "mês", "ano"… */
  por: string | null;
}

export type TabelaDePrecos = Record<string, PrecoDoPlano>;

/** Uma requisição por sessão, compartilhada por todas as telas.
 *
 *  A grade de planos, o modal de troca e o de upgrade podem estar montados ao
 *  mesmo tempo; sem isto seriam três chamadas idênticas. */
let emVoo: Promise<TabelaDePrecos | null> | null = null;
let cache: TabelaDePrecos | null = null;

export function buscarPrecos(): Promise<TabelaDePrecos | null> {
  if (cache) return Promise.resolve(cache);
  if (!emVoo) {
    emVoo = fetch(`${API_URL}/api/tiers/precos-publicos`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { cache = d?.planos ?? null; return cache; })
      .catch(() => null)
      .finally(() => { emVoo = null; });
  }
  return emVoo;
}

export function usePrecos(): TabelaDePrecos | null {
  const [precos, setPrecos] = useState<TabelaDePrecos | null>(cache);
  useEffect(() => {
    let vivo = true;
    buscarPrecos().then((p) => { if (vivo) setPrecos(p); });
    return () => { vivo = false; };
  }, []);
  return precos;
}

/** "R$ 497,00/mês" — valor e periodicidade REAIS, juntos.
 *
 *  ⚠️ O SUFIXO VEM DO SERVIDOR, NÃO É "/mês" CRAVADO. O cabeçalho da assinatura
 *  montava `{amount}` + `/mês` + um selo com o intervalo verdadeiro ao lado, e
 *  numa assinatura anual escrevia, literalmente, "R$ 4.970,00 /MÊS ANUAL" — o
 *  preço errado por 12× e desmentido pelo próprio selo um espaço depois.
 */
export function precoPorCiclo(p?: PrecoDoPlano | null): string | null {
  if (!p?.valor) return null;
  return p.por ? `${p.valor}/${p.por}` : p.valor;
}
