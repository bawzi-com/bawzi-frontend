/**
 * Pipeline de renovações: os termos da busca e o sinal de prorrogação.
 *
 * 25/09/2026. A tela derivava o termo da descrição do CNAE ("Desenvolvimento
 * de programas de computador sob encomenda" → "programas computador
 * encomenda") e o servidor aceitava o contrato com UMA palavra dessas no
 * objeto. Agora os termos vêm da tabela do setor (a mesma das Sugestões), cada
 * termo é uma frase inteira, e cada contrato traz se ainda pode ser
 * prorrogado em vez de ir a nova disputa.
 */

/** O mesmo teto do servidor (`_MAX_TERMOS` em contratos_vencendo.py). */
export const MAX_TERMOS = 6;

/** Termos separados por vírgula ou ponto e vírgula, sem repetição. */
export function separarTermos(texto: string | null | undefined): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of String(texto ?? '').split(/[;,]/)) {
    const termo = bruto.trim().replace(/\s+/g, ' ');
    const chave = termo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (termo.length >= 2 && !vistos.has(chave)) {
      vistos.add(chave);
      saida.push(termo);
    }
  }
  return saida.slice(0, MAX_TERMOS);
}

export interface SinalDeProrrogacao {
  situacao: 'volta_a_licitacao' | 'no_limite' | 'incerto' | 'pode_prorrogar' | string;
  texto: string;
  /** "Em vigor desde 03/2024 (2 anos)". */
  resumo?: string;
  meses_em_vigor?: number;
  desde?: string;
}

export interface EstiloDaProrrogacao {
  rotulo: string;
  tom: 'verde' | 'ambar' | 'neutro';
  /** O que o cartão mostra. No caso comum, só o resumo: a explicação da lei
   *  se repetiria em todo cartão e esconderia os que mudam alguma coisa. */
  texto: string;
}

/** Rótulo curto e cor do sinal. Verde é oportunidade: o contrato tende a
 *  voltar a licitação. Neutro é o caso comum — pode ser prorrogado, e vencer
 *  não garante disputa. Situação desconhecida não ganha rótulo inventado. */
export function estiloDaProrrogacao(sinal: SinalDeProrrogacao | null | undefined): EstiloDaProrrogacao | null {
  if (!sinal || !sinal.texto) return null;
  switch (sinal.situacao) {
    case 'volta_a_licitacao':
      return { rotulo: 'Tende a voltar a licitação', tom: 'verde', texto: sinal.texto };
    case 'no_limite':
      return { rotulo: 'No limite da prorrogação', tom: 'verde', texto: sinal.texto };
    case 'incerto':
      return { rotulo: 'Pode voltar a licitação', tom: 'ambar', texto: sinal.texto };
    case 'pode_prorrogar':
      return { rotulo: 'Pode ser prorrogado', tom: 'neutro', texto: sinal.resumo || sinal.texto };
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Filtros de órgão e fornecedor (25/09/2026)
// ─────────────────────────────────────────────────────────────────────────
// Atrás do "+ Filtros". Com um deles, o termo do setor fica opcional: tudo o
// que vence na Prefeitura X, ou todo contrato do concorrente Y. Quem decide o
// que filtra é o servidor (nome ou documento, as regras do filtro de órgão do
// Radar); a tela mostra o eco dele, e não o que foi digitado.

export type CampoDoFiltro = 'orgao' | 'fornecedor';

export interface FiltrosDeEntidade {
  orgao: string;
  fornecedor: string;
}

export const FILTROS_VAZIOS: FiltrosDeEntidade = { orgao: '', fornecedor: '' };

/** O que o servidor entendeu de um campo: documento (só dígitos) ou nome. */
export interface FiltroAplicado {
  tipo: 'documento' | 'nome' | string;
  valor: string;
}

export type FiltrosAplicados = Partial<Record<CampoDoFiltro, FiltroAplicado | null>>;

export const NOME_DO_CAMPO: Record<CampoDoFiltro, string> = { orgao: 'órgão', fornecedor: 'fornecedor' };

/** Vale mandar ao servidor? Espaço em branco e letra solta, não. */
export function filtroPreenchido(texto: string | null | undefined): boolean {
  return String(texto ?? '').trim().length >= 2;
}

export function contarFiltros(f: FiltrosDeEntidade): number {
  return (filtroPreenchido(f.orgao) ? 1 : 0) + (filtroPreenchido(f.fornecedor) ? 1 : 0);
}

/** Com órgão ou fornecedor, o termo é opcional. */
export function podeBuscar(termo: string | null | undefined, f: FiltrosDeEntidade): boolean {
  return separarTermos(termo).length > 0 || contarFiltros(f) > 0;
}

/** CNPJ (14 dígitos) ou CPF (11) com máscara; outra coisa volta como veio. */
export function formatarDocumento(valor: string | number | null | undefined): string {
  const d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return String(valor ?? '');
}

/** O que um clique no cartão põe no filtro. O documento, quando o contrato
 *  traz um: nome se repete entre compradores (há Santa Luzia em MG e na PB).
 *  Sem documento, o nome. Fornecedor aceita CPF; órgão, só CNPJ. */
export function valorParaFiltrar(
  campo: CampoDoFiltro,
  nome: string | null | undefined,
  documento: string | number | null | undefined,
): string {
  const d = String(documento ?? '').replace(/\D/g, '');
  const tamanhos = campo === 'fornecedor' ? [11, 14] : [14];
  if (tamanhos.includes(d.length) && /[1-9]/.test(d)) return formatarDocumento(d);
  return String(nome ?? '').trim();
}

/** O chip do filtro aplicado. Com documento, o nome de quem foi clicado vem junto. */
export function rotuloDoFiltro(f: FiltroAplicado | null | undefined, nome?: string | null): string | null {
  if (!f || !f.valor) return null;
  if (f.tipo === 'documento') {
    const doc = formatarDocumento(f.valor);
    return nome ? `${nome} · ${doc}` : doc;
  }
  return f.valor;
}

/** Campos mandados que o servidor não aplicou (só palavras genéricas). */
export function filtrosIgnorados(
  enviados: FiltrosDeEntidade,
  aplicados: FiltrosAplicados | null | undefined,
): CampoDoFiltro[] {
  if (!aplicados) return [];
  return (['orgao', 'fornecedor'] as CampoDoFiltro[]).filter(
    (campo) => filtroPreenchido(enviados[campo]) && !aplicados[campo],
  );
}

export function avisoFiltrosIgnorados(campos: CampoDoFiltro[]): string | null {
  if (!campos.length) return null;
  const nomes = campos.map((c) => NOME_DO_CAMPO[c]).join(' e de ');
  const inicio = campos.length === 1
    ? `O filtro de ${nomes} não foi aplicado`
    : `Os filtros de ${nomes} não foram aplicados`;
  return `${inicio}: escreva o nome, e não só palavras como "de" ou "Ltda", ou o CNPJ.`;
}

/** Contratos achados no portal que saíram do filtro de fornecedor sem conferência. */
export function avisoNaoConferidos(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null;
  const um = n === 1;
  return `${n} contrato${um ? '' : 's'} achado${um ? '' : 's'} no PNCP ${um ? 'ficou' : 'ficaram'} de fora `
    + `porque não deu para conferir o fornecedor ${um ? 'dele' : 'deles'}: a busca do portal não informa `
    + 'o fornecedor. Escolher uma UF ou um termo mais estreito ajuda a conferir mais.';
}

/** Os parâmetros de `/api/pncp/contratos-vencendo`. Um por termo (cada termo é
 *  uma frase); órgão e fornecedor só quando preenchidos. */
export function parametrosDaBusca(o: {
  termos: string[];
  dias: number;
  uf?: string;
  homeUf?: string;
  municipioId?: string;
  municipioNome?: string;
  filtros: FiltrosDeEntidade;
}): URLSearchParams {
  const params = new URLSearchParams({ dias: String(o.dias) });
  o.termos.forEach((t) => params.append('termos', t));
  if (o.uf && o.uf !== 'BR') params.set('uf', o.uf);
  if (o.homeUf) params.set('home_uf', o.homeUf);
  if (o.municipioId) params.set('municipio_id', o.municipioId);
  if (o.municipioNome) params.set('municipio_nome', o.municipioNome);
  if (filtroPreenchido(o.filtros.orgao)) params.set('orgao', o.filtros.orgao.trim());
  if (filtroPreenchido(o.filtros.fornecedor)) params.set('fornecedor', o.filtros.fornecedor.trim());
  return params;
}

/** O que dizer quando a busca volta vazia. */
export function dicaSemResultado(temTermo: boolean, temFiltro: boolean): string {
  if (temFiltro && temTermo) return 'Apague o termo para ver todos os contratos do filtro na janela, ou amplie a janela de dias.';
  if (temFiltro) return 'Amplie a janela de dias ou confira o nome ou o CNPJ do filtro.';
  return 'Tente outro termo de busca ou ampliar a janela de dias.';
}

// ─────────────────────────────────────────────────────────────────────────
// "Analisar edital de origem": o prompt da análise de renovação
// ─────────────────────────────────────────────────────────────────────────
// Morava dentro do cartão do Pipeline. Subiu para cá (25/09/2026) porque as
// disputas de "Meus contratos" abrem a mesma análise, e um segundo prompt
// divergiria do primeiro na primeira correção.

export interface DadosDoPromptDeRenovacao {
  diasRestantes?: number | null;
  /** Datas já formatadas (dd/mm/aaaa ou "—"). */
  fimVigencia: string;
  orgao?: string | null;
  uf?: string | null;
  municipio?: string | null;
  fornecedor?: string | null;
  fornecedorCnpj?: string | null;
  objeto?: string | null;
  /** Valores já formatados ("R$ 1.2M"). */
  valor: string;
  valorMensal?: string | null;
  inicioVigencia?: string | null;
  duracaoMeses?: number | null;
  assinatura?: string | null;
  teveAditivo?: boolean;
  textoDoEdital?: string | null;
  historicoPrecos: string;
}

export function promptDeRenovacao(d: DadosDoPromptDeRenovacao): string {
  return `
  DOCUMENTO OFICIAL PARA ANÁLISE DE RISCO E ESTRATÉGIA DE LICITAÇÃO
  ===================================================================
  ▸ CONTEXTO: RENOVAÇÃO DE CONTRATO — o contrato vigente vence em ${d.diasRestantes ?? '?'} dia(s)
  (${d.fimVigencia}). O órgão tende a abrir nova disputa em breve.
  A IA deve analisar o EDITAL DE ORIGEM abaixo como referência do que será exigido
  na provável relicitação, e orientar o cliente sobre como competir.
  ===================================================================

  [1. CONTRATO VIGENTE (INTELIGÊNCIA DE RENOVAÇÃO)]
  • Órgão: ${d.orgao || 'N/D'} (${d.uf || ''}${d.municipio ? ` / ${d.municipio}` : ''})
  • Fornecedor atual (incumbente): ${d.fornecedor || 'Não identificado'}${d.fornecedorCnpj ? ` — CNPJ ${d.fornecedorCnpj}` : ''}
  • Objeto do contrato: ${d.objeto || 'N/D'}
  • Valor do contrato: ${d.valor}${d.valorMensal ? ` (~${d.valorMensal}/mês)` : ''}
  • Vigência: ${d.inicioVigencia || 'N/D'} → ${d.fimVigencia}${d.duracaoMeses ? ` (${d.duracaoMeses} meses)` : ''}
  • Assinatura: ${d.assinatura || 'N/D'}${d.teveAditivo ? ' | ⚠️ contrato já ADITIVADO (valor global > inicial)' : ''}

  [2. EDITAL DE ORIGEM (ÍNTEGRA DA CONSULTA PNCP)]
  ${d.textoDoEdital || 'Detalhes não fornecidos pela API.'}

  [3. INTELIGÊNCIA DE MERCADO E HISTÓRICO (PNCP)]
  ${d.historicoPrecos}

  ===================================================================
  INSTRUÇÃO AO AVALIADOR: além da análise padrão, responda objetivamente —
  o que o edital anterior exigiu (habilitação, atestados, prazos), qual preço
  venceu, e o que a empresa do cliente precisa para bater o fornecedor atual
  na renovação.
  `;
}
