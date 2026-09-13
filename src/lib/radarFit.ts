/**
 * Fit de negócio no Radar — ordem e rótulos.
 *
 * O backend (`/api/pncp/buscar?empresa_cnpj=…`, com sessão) devolve em cada
 * edital um `fit_negocio` medido contra a empresa ativa: a carteira dela no
 * PNCP quando existe, senão o cadastro (CNAE, produtos/serviços). A tela usa
 * isso para ORDENAR, nunca para esconder: a regionalidade continua mandando
 * primeiro, o ramo desempata dentro de cada grupo, e a ordem recebida (data)
 * fica por último. Sem fit — visitante, empresa sem cadastro, falha no
 * serviço — tudo aqui degrada para a ordem anterior a 13/09/2026.
 */

export type FitNivel = 'alto' | 'medio' | 'baixo' | 'indeterminado';
export type FitFonte = 'carteira' | 'cadastro' | null;

export interface FitNegocio {
  /** 0..100; `null` quando não houve base para medir. */
  score: number | null;
  nivel: FitNivel;
  /** Palavras do objeto que casaram com o ramo (até 6). */
  termos: string[];
  fonte: FitFonte;
}

export interface FitBase {
  fonte: FitFonte;
  /** Contratos da empresa lidos do índice local do PNCP. */
  carteira: number;
  /** Palavras distintas extraídas do cadastro. */
  vocabulario: number;
  empresa: string;
  cnae: string;
}

const PESO_NIVEL: Record<FitNivel, number> = { alto: 2, medio: 1, baixo: 0, indeterminado: 0 };

/** [peso do nível, score] — o nível manda, o score desempata. Sem fit = zero
 *  nos dois: um edital sem medida não sobe nem desce. */
export function pesoDoFit(fit?: FitNegocio | null): [number, number] {
  if (!fit) return [0, 0];
  const nivel = PESO_NIVEL[fit.nivel] ?? 0;
  const score = typeof fit.score === 'number' && Number.isFinite(fit.score) ? fit.score : 0;
  return [nivel, score];
}

/**
 * Local primeiro (quando há `ufAtiva`), depois nível do fit, depois score.
 * Empate devolve 0 — `sort` é estável, então a ordem recebida (data) é o
 * último critério. Não muta a lista.
 */
export function ordenarRadar<T extends { uf?: string; fit_negocio?: FitNegocio | null }>(
  lista: T[],
  ufAtiva: string,
): T[] {
  const uf = (ufAtiva || '').trim().toUpperCase();
  return [...lista].sort((a, b) => {
    if (uf) {
      const localA = String(a.uf || '').trim().toUpperCase() === uf;
      const localB = String(b.uf || '').trim().toUpperCase() === uf;
      if (localA !== localB) return localA ? -1 : 1;
    }
    const [nivelA, scoreA] = pesoDoFit(a.fit_negocio);
    const [nivelB, scoreB] = pesoDoFit(b.fit_negocio);
    if (nivelA !== nivelB) return nivelB - nivelA;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return 0;
  });
}

/** Rótulo do selo no card. `null` = sem selo (baixo, indeterminado, sem fit):
 *  um selo "fora do seu ramo" em 80% dos cards seria ruído, não informação. */
export function rotuloFit(fit?: FitNegocio | null): { texto: string; termos: string; tom: 'alto' | 'medio' } | null {
  if (!fit) return null;
  const termos = (fit.termos || []).filter(Boolean).slice(0, 3).join(', ');
  if (fit.nivel === 'alto') return { texto: 'Do seu ramo', termos, tom: 'alto' };
  if (fit.nivel === 'medio') return { texto: 'Perto do seu ramo', termos, tom: 'medio' };
  return null;
}

/** Frase do tooltip que explica DE ONDE veio a ordem — o usuário precisa
 *  saber se foi a carteira real ou só o cadastro, porque a cura é diferente
 *  (a carteira ele não muda; o cadastro, sim). */
export function descricaoFitBase(base?: FitBase | null): string {
  if (!base || !base.fonte) return '';
  if (base.fonte === 'carteira') {
    const n = base.carteira || 0;
    return `Ordem pelo ramo de ${base.empresa || 'sua empresa'}: medida contra ${n} contrato${n === 1 ? '' : 's'} que ela já entregou no PNCP, com o cadastro (CNAE${base.cnae ? ` ${base.cnae}` : ''}, produtos e serviços) como reforço.`;
  }
  return `Ordem pelo ramo de ${base.empresa || 'sua empresa'}: medida contra o cadastro (CNAE${base.cnae ? ` ${base.cnae}` : ''}, produtos e serviços). Quanto mais completo o campo "produtos e serviços" da empresa, mais fina a ordem.`;
}
