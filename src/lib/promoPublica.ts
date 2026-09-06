'use client';

/**
 * A promoção pública, buscada UMA vez por carregamento de página.
 *
 * ⚠️ POR QUE ISTO SAIU DE DENTRO DO `PromoBanner`. O banner era o único
 * consumidor de `/api/admin/promo-banner/public` — até o resultado do taster
 * passar a precisar da MESMA oferta. Com dois `useEffect` independentes, a
 * home dispararia duas requisições idênticas no primeiro paint e, pior, os
 * dois componentes poderiam ficar por um instante anunciando estados
 * diferentes da mesma campanha (um com o número de vagas antigo, o outro com
 * o novo) se a resposta variasse entre as chamadas.
 *
 * A promessa fica no módulo, não num contexto do React, porque não há nada
 * para reagir: o dado é do servidor, não muda durante a visita, e um provider
 * só para isso obrigaria a mexer no layout raiz.
 */
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/apiClient';
import type { DadosPromo } from '@/lib/promo';

let emVoo: Promise<DadosPromo | null> | null = null;

/** Busca (ou reaproveita) a promoção ativa. Nunca rejeita. */
export function carregarPromoPublica(): Promise<DadosPromo | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!emVoo) {
    emVoo = fetch(`${API_URL}/api/admin/promo-banner/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DadosPromo | null) => (d?.active ? d : null))
      .catch(() => null);
  }
  return emVoo;
}

/**
 * A promoção ativa como estado de componente. `null` enquanto não sabemos E
 * quando não há promoção — quem precisar distinguir os dois casos deve usar
 * `carregarPromoPublica` direto; nenhuma tela precisa hoje, e um terceiro
 * estado aqui seria um `undefined` que todo chamador teria de tratar à toa.
 */
export function usePromoPublica(): DadosPromo | null {
  const [promo, setPromo] = useState<DadosPromo | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarPromoPublica().then((d) => { if (vivo) setPromo(d); });
    return () => { vivo = false; };
  }, []);
  return promo;
}
