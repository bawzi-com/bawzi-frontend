/**
 * O que a busca de empresa consegue alcançar — e a frase certa quando não acha.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ O CAMPO PROMETIA BUSCA POR NOME, E O SERVIDOR NÃO FAZ ISSO DESDE 30/08/2026
 * ═══════════════════════════════════════════════════════════════════════════
 * A busca por nome varria as empresas de TODOS os clientes, sem login: um
 * `curl` iterando trigramas montava a carteira de clientes da Bawzi. O backend
 * fechou isso (`router_company.discover_companies`, commit bce30214). Por nome,
 * a rota só procura entre as empresas do PRÓPRIO workspace, e só para quem está
 * logado. Sem login sobram o CNPJ (Receita Federal) e a sugestão por domínio.
 *
 * A tela não acompanhou. O exemplo do campo era literalmente "Bawzi", o
 * cadastro sugeria "Nome, CNPJ ou domínio", e a resposta a um nome era
 * "Nenhuma empresa encontrada" — como se a empresa não existisse. Em
 * 13/10/2026 o próprio dono digitou "bawzi" no cadastro e concluiu que a busca
 * estava quebrada.
 *
 * E o caminho que sobrou para nome nunca era alcançado: o componente chamava a
 * rota com `fetch` puro, sem o token, então nem quem estava logado tinha o
 * próprio workspace consultado.
 */

export type TipoDeBusca = 'cnpj' | 'cnpj_incompleto' | 'dominio' | 'nome';

export function tipoDaBusca(texto: string): TipoDeBusca {
  const t = (texto || '').trim();
  // Antes do domínio: "00.000.000/0001-00" tem pontos e não é um site.
  if (/^[\d.\-/\s]+$/.test(t)) {
    return t.replace(/\D/g, '').length === 14 ? 'cnpj' : 'cnpj_incompleto';
  }
  if (t.includes('.') || t.includes('@')) return 'dominio';
  return 'nome';
}

/** Dito antes de ir ao servidor: um CNPJ com dígitos de menos ou de mais. */
export function avisoDeCnpjIncompleto(texto: string): string {
  const n = (texto || '').replace(/\D/g, '').length;
  return `O CNPJ tem 14 dígitos — aqui há ${n}.`;
}

/**
 * A frase de "não achei", conforme o que a busca alcançou.
 *
 * Para um nome, "nenhuma empresa encontrada" é falso: a busca nem procurou na
 * Receita. A frase diz o que procurou e qual é o caminho que funciona.
 */
export function mensagemSemResultado(tipo: TipoDeBusca, comSessao: boolean): string {
  if (tipo === 'nome') {
    return comSessao
      ? 'Nenhuma empresa do seu workspace com esse nome. Para buscar na Receita Federal, digite o CNPJ.'
      : 'A busca por nome não está disponível no cadastro. Digite o CNPJ: os dados vêm da Receita Federal.';
  }
  return 'Nenhuma empresa encontrada. Você ainda pode preencher manualmente.';
}
