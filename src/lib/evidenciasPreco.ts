/**
 * Evidências de preço unitário: o que a seção da aba Disputa mostra.
 *
 * 24/09/2026, pedido do dono: "que a análise de evidências de preço unitário
 * busque apenas os itens do edital analisado e [tenha] mais três colunas:
 * preço médio, preço mínimo e preço máximo". O caso que motivou: num edital de
 * fábrica de software (um item, preço por UST), a lista mostrava manta, TNT,
 * licença de Office, bolsa de massagista e fogão industrial. Era a busca geral
 * pelo objeto, cortada nos 12 preços mais baratos, exibida ao lado de um bloco
 * por item que dizia "sem comparável".
 *
 * A regra agora:
 *  - Edital com itens do PNCP → um bloco por item, só com as evidências daquele
 *    item (o backend filtra cada evidência pela régua do item). A lista da
 *    busca geral NÃO aparece, nem vazia de itens.
 *  - Sem itens (texto colado, PDF) → a busca pelo objeto do edital, com o
 *    rótulo dizendo que é isso.
 *  - Nada → a seção some.
 *
 * O cartão "Preço Unitário Mediano", que fica logo acima, segue a mesma regra
 * (`resumoDaMediana`): uma mediana que mistura objetos diferentes contradiria a
 * seção que ele resume.
 */

export type NivelSelo = 'forte' | 'bom' | 'parcial' | 'fraco';

export interface Selo {
  nivel: NivelSelo;
  texto: string;
  detalhe?: string;
}

export interface EvidenciaDePreco {
  valor: number;
  descricao?: string;
  fornecedor?: string;
  orgao?: string;
  uf?: string;
  data?: string;
  fonte?: string;
  unidade?: string;
  /** Objeto do contrato de onde a linha saiu. Em serviço, a linha costuma dizer
   *  só "Unidade de Serviço Técnico"; quem diz do que se trata é o objeto. */
  objeto?: string;
  linhas?: number;
}

export interface BlocoDeEvidencias {
  chave: string;
  /** "Item 1 · 400000 UNIDADE DE SERVICO TECNICO · por descrição: “fábrica de software”" */
  rotulo: string;
  descricao: string;
  estimativaUnitaria: number | null;
  estimativaTotal: number | null;
  /** Unidade em que os preços estão, quando ela é estrita ("UST", "PF", "HORA", "MES"). */
  unidadeDoPreco: string | null;
  media: number | null;
  minimo: number | null;
  maximo: number | null;
  mediana: number | null;
  /** Contratos distintos. */
  amostra: number;
  /** Linhas de contrato antes do agrupamento. */
  linhas: number;
  selo: Selo | null;
  avisoCoerencia: string | null;
  /** (mediana / estimativa do órgão − 1) × 100. */
  deltaPct: number | null;
  semComparavel: string | null;
  evidencias: EvidenciaDePreco[];
}

export interface SecaoDeEvidencias {
  modo: 'itens' | 'objeto' | 'vazio';
  blocos: BlocoDeEvidencias[];
  itensComEvidencia: number;
  totalItens: number;
  naoComparados: number;
}

export interface ResumoDaMediana {
  /** item: o edital tem um item só; varia: vários itens; geral: sem itens (busca pelo objeto). */
  modo: 'item' | 'varia' | 'geral';
  valor: number | null;
  minimo: number | null;
  amostra: number;
  selo: Selo | null;
}

/** O pedaço de `pricing_intelligence` que interessa. Tipado frouxo de
 *  propósito: laudos antigos têm campos a menos, e alguns vêm do cache. */
export interface EntradaDePreco {
  itensComparados?: unknown;
  itensNaoComparados?: unknown;
  evidenciasPrecosUnitarios?: unknown;
  estatisticasPrecosUnitarios?: unknown;
  valorMedioUnitarioMercado?: unknown;
  valorMinimoUnitarioMercado?: unknown;
  amostraPrecosUnitarios?: unknown;
  linhasPrecosUnitarios?: unknown;
  seloVerificacao?: unknown;
  coerenciaAmostra?: unknown;
  coletaIncompleta?: unknown;
}

type Registro = Record<string, unknown>;

const ehRegistro = (v: unknown): v is Registro => typeof v === 'object' && v !== null && !Array.isArray(v);

function numero(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function positivo(v: unknown): number | null {
  const n = numero(v);
  return n !== null && n > 0 ? n : null;
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

const NIVEIS: readonly NivelSelo[] = ['forte', 'bom', 'parcial', 'fraco'];

function comoSelo(v: unknown): Selo | null {
  if (!ehRegistro(v)) return null;
  const nivel = texto(v.nivel) as NivelSelo;
  const t = texto(v.texto);
  if (!NIVEIS.includes(nivel) || !t) return null;
  const detalhe = texto(v.detalhe);
  return detalhe ? { nivel, texto: t, detalhe } : { nivel, texto: t };
}

function comoEvidencias(v: unknown): EvidenciaDePreco[] {
  if (!Array.isArray(v)) return [];
  const saida: EvidenciaDePreco[] = [];
  for (const e of v) {
    if (!ehRegistro(e)) continue;
    const valor = positivo(e.valor);
    if (valor === null) continue;
    saida.push({
      valor,
      descricao: texto(e.descricao) || undefined,
      fornecedor: texto(e.fornecedor) || undefined,
      orgao: texto(e.orgao) || undefined,
      uf: texto(e.uf) || undefined,
      data: texto(e.data) || undefined,
      fonte: texto(e.fonte) || undefined,
      unidade: texto(e.unidade) || undefined,
      objeto: texto(e.objeto) || undefined,
      linhas: numero(e.linhas) ?? undefined,
    });
  }
  return saida;
}

function avisoDeCoerencia(coerencia: unknown, amostra: number): string | null {
  if (!ehRegistro(coerencia) || amostra <= 0) return null;
  if (texto(coerencia.veredito) === 'coerente') return null;
  return texto(coerencia.motivo) || null;
}

function formatarQuantidade(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function blocoDoItem(it: Registro, idx: number): BlocoDeEvidencias {
  const amostra = Math.max(0, Math.trunc(numero(it.amostra) ?? 0));
  const selo = comoSelo(it.selo);
  const quantidade = positivo(it.quantidade);
  const unidade = texto(it.unidade);
  const metodo = texto(it.metodo);
  const consulta = texto(it.consulta);
  const metodoTxt = metodo === 'catmat'
    ? `CATMAT ${texto(it.catmat_codigo)}`.trim()
    : metodo === 'descricao'
      ? (consulta ? `por descrição: “${consulta}”` : 'por descrição')
      : 'sem busca';
  const numeroItem = texto(it.numero_item) || String(idx + 1);
  const partes = [`Item ${numeroItem}`];
  if (quantidade !== null) partes.push([formatarQuantidade(quantidade), unidade].filter(Boolean).join(' '));
  partes.push(metodoTxt);

  return {
    chave: `item-${numeroItem}-${idx}`,
    rotulo: partes.join(' · '),
    descricao: texto(it.descricao),
    estimativaUnitaria: positivo(it.valor_estimado),
    estimativaTotal: positivo(it.valor_total_estimado),
    unidadeDoPreco: texto(it.familia_unidade) || null,
    media: positivo(it.media),
    minimo: positivo(it.minimo),
    maximo: positivo(it.maximo),
    mediana: positivo(it.mediana),
    amostra,
    linhas: Math.max(amostra, Math.trunc(numero(it.linhas) ?? amostra)),
    selo,
    avisoCoerencia: avisoDeCoerencia(it.coerencia, amostra),
    deltaPct: numero(it.delta_vs_estimado_pct),
    semComparavel: amostra === 0
      ? (selo?.detalhe || 'Nenhum preço comparável foi localizado para este item.')
      : null,
    evidencias: comoEvidencias(it.evidencias),
  };
}

export function montarSecaoDeEvidencias(pricing: EntradaDePreco | null | undefined): SecaoDeEvidencias {
  const vazio: SecaoDeEvidencias = { modo: 'vazio', blocos: [], itensComEvidencia: 0, totalItens: 0, naoComparados: 0 };
  if (!pricing) return vazio;

  const itens = Array.isArray(pricing.itensComparados) ? pricing.itensComparados.filter(ehRegistro) : [];
  if (itens.length > 0) {
    const blocos = itens.map(blocoDoItem);
    return {
      modo: 'itens',
      blocos,
      itensComEvidencia: blocos.filter(b => b.amostra > 0).length,
      totalItens: blocos.length,
      naoComparados: Math.max(0, Math.trunc(numero(pricing.itensNaoComparados) ?? 0)),
    };
  }

  const evidencias = comoEvidencias(pricing.evidenciasPrecosUnitarios);
  if (evidencias.length === 0) return vazio;

  // Laudos anteriores a 24/09/2026 não trazem `estatisticasPrecosUnitarios`:
  // média e máximo ficam em branco em vez de saírem dos 12 exibidos, que
  // naquela época eram os 12 mais baratos.
  const est = ehRegistro(pricing.estatisticasPrecosUnitarios) ? pricing.estatisticasPrecosUnitarios : {};
  const amostra = Math.max(0, Math.trunc(
    numero(est.amostra) ?? numero(pricing.amostraPrecosUnitarios) ?? evidencias.length));
  const selo = comoSelo(pricing.seloVerificacao);
  return {
    modo: 'objeto',
    blocos: [{
      chave: 'objeto',
      rotulo: 'Pelo objeto do edital',
      descricao: '',
      estimativaUnitaria: null,
      estimativaTotal: null,
      unidadeDoPreco: null,
      media: positivo(est.media),
      minimo: positivo(est.minimo) ?? positivo(pricing.valorMinimoUnitarioMercado),
      maximo: positivo(est.maximo),
      mediana: positivo(est.mediana) ?? positivo(pricing.valorMedioUnitarioMercado),
      amostra,
      linhas: Math.max(amostra, Math.trunc(numero(est.linhas) ?? numero(pricing.linhasPrecosUnitarios) ?? amostra)),
      selo,
      avisoCoerencia: avisoDeCoerencia(pricing.coerenciaAmostra, amostra),
      deltaPct: null,
      semComparavel: null,
      evidencias,
    }],
    itensComEvidencia: 0,
    totalItens: 0,
    naoComparados: 0,
  };
}

export function resumoDaMediana(pricing: EntradaDePreco | null | undefined): ResumoDaMediana {
  const secao = montarSecaoDeEvidencias(pricing);
  if (secao.modo === 'itens') {
    if (secao.blocos.length === 1) {
      const b = secao.blocos[0];
      return { modo: 'item', valor: b.mediana, minimo: b.minimo, amostra: b.amostra, selo: b.selo };
    }
    return { modo: 'varia', valor: null, minimo: null, amostra: 0, selo: null };
  }
  return {
    modo: 'geral',
    valor: positivo(pricing?.valorMedioUnitarioMercado),
    minimo: positivo(pricing?.valorMinimoUnitarioMercado),
    amostra: Math.max(0, Math.trunc(numero(pricing?.amostraPrecosUnitarios) ?? 0)),
    selo: comoSelo(pricing?.seloVerificacao),
  };
}

/** Nome de cada fonte na frase do aviso. As chaves vêm do backend
 *  (`coletaIncompleta`, pricing.py); chave nova sem nome aqui aparece crua. */
const NOMES_DAS_FONTES: Record<string, string> = {
  itens_edital: 'lista de itens do edital no PNCP',
  busca_por_item: 'busca de preço por item do edital',
  homologados: 'preços homologados do PNCP',
  painel: 'Painel de Preços',
  catmat: 'preços pelo código CATMAT',
  base_local: 'base estruturada de contratos',
  base_local_uf: 'base estruturada de contratos da UF',
  complemento_desagio: 'contratos do PNCP para o deságio',
};

export interface FontesSemResposta {
  /** Frase pronta para a tela, ou null quando nada faltou. */
  aviso: string | null;
  /** A lista de itens do edital não chegou: a seção caiu na busca pelo objeto
   *  por falta de resposta, não porque o edital não tem itens. */
  faltouListaDeItens: boolean;
  /** O complemento do deságio pelo PNCP não chegou. */
  faltouComplementoDoDesagio: boolean;
}

/**
 * 25/09/2026: o war room passou a ter orçamento de tempo próprio. A fonte que
 * não responde nele é cortada e o laudo sai com o resto, onde antes saía sem
 * nada. O corte precisa aparecer na tela: sem o aviso, "não chegou" ficaria
 * igual a "não existe preço", e o cartão sem base recomendaria "um termo mais
 * específico".
 */
export function fontesSemResposta(pricing: EntradaDePreco | null | undefined): FontesSemResposta {
  const bruto = pricing?.coletaIncompleta;
  const chaves = Array.isArray(bruto) ? Array.from(new Set(bruto.map(texto).filter(Boolean))) : [];
  if (chaves.length === 0) {
    return { aviso: null, faltouListaDeItens: false, faltouComplementoDoDesagio: false };
  }
  const nomes = chaves.map(c => NOMES_DAS_FONTES[c] ?? c);
  const lista = nomes.length === 1
    ? nomes[0]
    : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
  return {
    aviso: `Ficaram sem resposta nesta análise: ${lista}. Os números desta aba usam só o que chegou. `
      + 'Refazer a análise pode completar, e o laudo refeito não reaproveita este.',
    faltouListaDeItens: chaves.includes('itens_edital'),
    faltouComplementoDoDesagio: chaves.includes('complemento_desagio'),
  };
}
