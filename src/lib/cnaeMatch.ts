/**
 * cnaeMatch.ts — Checagem leve (client-side) de aderência entre o objeto
 * de um edital e o CNAE/negócio da empresa ativa, usada ANTES de disparar
 * uma análise (que consome créditos). Espelha, de forma simplificada, a
 * heurística de tokens por radical usada no backend em
 * `_normalizar_aderencia_negocio` (router_analyses.py) — sem acento,
 * por palavra (nunca substring) e ignorando termos genéricos demais para
 * servirem de evidência de match.
 *
 * Isto NÃO substitui a análise real: é só um alerta preventivo para o
 * usuário confirmar antes de gastar uma análise num edital que, à primeira
 * vista, não parece ter relação com o CNAE cadastrado.
 */

import type { Empresa } from './types';

const GENERICOS_CNAE = new Set([
  'comercio', 'atacadista', 'varejista', 'distribuicao', 'distribuidora',
  'representantes', 'importacao', 'exportacao', 'fabricacao', 'industria',
  'produtos', 'artigos', 'materiais', 'equipamentos', 'maquinas',
  'servicos', 'atividades', 'gerais', 'geral', 'outros', 'outras',
  'especificados', 'especificadas', 'anteriormente', 'partes', 'pecas',
  'acessorios', 'novos', 'usados', 'aluguel', 'locacao', 'manutencao',
  'humano', 'humanos', 'animal', 'animais', 'veterinario', 'veterinaria',
  // ⚠️ 15/09/2026: sincronizado com fit_negocio.GENERICOS_CNAE (backend) e
  // com router_analyses._GENERICOS_CNAE, que já tinham estas 58 palavras e
  // este arquivo não. Três rodadas de correção (10/09: número por extenso e
  // burocracia de prazo; 13/09: "termo"/"condições"/"atender"; 15/09:
  // conjugação de "ser") corrigiam falso alerta de "fora do ramo" no Radar,
  // mas nunca vieram aqui -- mesma classe de bug: palavra de FORMATO de
  // texto contando como se fosse vocabulário de CNAE.
  'zero', 'um', 'uma', 'dois', 'duas', 'tres', 'quatro', 'cinco', 'seis',
  'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze',
  'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
  'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta',
  'oitenta', 'noventa', 'cem', 'cento', 'duzentos', 'trezentos', 'mil',
  'meses', 'dias', 'anos', 'horas', 'semanas', 'diversos', 'diversas',
  'estabelecidas', 'estabelecido', 'estabelecer', 'conforme', 'mediante',
  'referencia', 'referente',
  'termo', 'termos', 'condicoes', 'condicao', 'atender', 'atendendo',
  'serem', 'sendo', 'sejam',
  // ⚠️ 18/09/2026: sincronizado com router_analyses._GENERICOS_CNAE e
  // fit_negocio.GENERICOS_CNAE (backend) — a própria descrição oficial do
  // CNAE de software ("Desenvolvimento de programas de computador sob
  // encomenda", 6201-5/01) tinha três palavras genéricas demais para
  // provarem ramo sozinhas. Ver o comentário datado nos arquivos Python
  // para o caso real que motivou (laudo PNCP 26/2026, Viana/ES).
  'desenvolvimento', 'programas', 'encomenda',
]);

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Radical por PREFIXO (truncation stemming): em vez de só tirar o "s" do
// plural, compara os 5 primeiros caracteres da palavra. Isso cobre, sem
// precisar de regras gramaticais, os plurais irregulares do português que
// quebravam a comparação por sufixo — "solução"/"soluções" (divergem só
// depois do "soluc"), "animal"/"animais" (divergem só depois do "anima"),
// "equipamento"/"equipamentos". Palavras menores que o prefixo usam a
// palavra inteira.
const PREFIXO_LEN = 5;

function radicais(texto: string, minLen = 5): Set<string> {
  return new Set(
    normalizar(texto)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= minLen)
      .map((p) => p.slice(0, PREFIXO_LEN))
  );
}

const GENERICOS_CNAE_PREFIXOS = new Set([...GENERICOS_CNAE].map((g) => g.slice(0, PREFIXO_LEN)));

// Grupos de sinônimos de setor — espelham `_GRUPOS_SINONIMOS_ADERENCIA` do
// backend (router_analyses.py). Sem isso, radicais diferentes para o MESMO
// mercado (ex.: CNAE "instrumentos médico-hospitalares" × edital
// "materiais de fisioterapia") não batem por prefixo puro e disparam um
// alerta de "fora do CNAE" que é falso alarme. Aqui usamos os grupos de
// saúde já UNIFICADOS (sem a distinção farma × saúde geral do backend) —
// essa checagem é só um alerta preventivo antes de gastar crédito, não o
// veredito final; a nuance regulatória mais fina fica pro guardrail do
// backend, que roda depois com mais contexto.
const GRUPOS_SINONIMOS: string[][] = [
  ['hospi', 'saude', 'clini', 'enfer', 'ambul', 'cirur', 'odont', 'labor', 'medic', 'farma', 'remed', 'fisio', 'terap', 'reabi', 'ortop', 'fonoa'],
  ['alime', 'comes', 'nutri', 'meren', 'hortf', 'refei', 'gener'],
  ['limpe', 'higie', 'sanea', 'desin'],
  ['infor', 'tecno', 'softw', 'hardw', 'siste', 'digit', 'compu'],
  ['const', 'engen', 'obras', 'refor', 'predi'],
  ['veicu', 'autom', 'transp', 'frota', 'combu'],
  ['educa', 'escol', 'ensin', 'pedag', 'didat'],
  ['segur', 'vigil', 'monit', 'alarm'],
];
const RADICAL_PARA_GRUPO = new Map<string, string[]>();
for (const grupo of GRUPOS_SINONIMOS) {
  for (const radical of grupo) RADICAL_PARA_GRUPO.set(radical, grupo);
}

// ⚠️ 18/09/2026: sincronizado com radicais.py (backend). "siste"
// (sistema/sistemas) abria a ponte sozinho, e "sistema" não é palavra de
// TI — é o substantivo genérico para qualquer conjunto de partes que
// funcionam juntas (sistema hidráulico, elétrico, de filtragem...). Continua
// DENTRO do grupo (cobre "sistema de gestão" ao lado de vocabulário de TI
// genuíno), só não abre mais a ponte sozinho. Ver o comentário completo em
// radicais.py (`_RADICAIS_AMBIGUOS_COMO_FONTE`) para o caso real.
const RADICAIS_AMBIGUOS_COMO_FONTE = new Set(['siste']);

/** Devolve o próprio radical + sinônimos de setor conhecidos (ou só ele, se não houver grupo). */
function radicaisEquivalentes(radical: string): string[] {
  if (RADICAIS_AMBIGUOS_COMO_FONTE.has(radical)) return [radical];
  return RADICAL_PARA_GRUPO.get(radical) ?? [radical];
}

export interface CnaeMatchResult {
  /** true = há sinal textual de aderência entre o CNAE/negócio e o objeto do edital */
  compativel: boolean;
  /** true = não há dado suficiente para avaliar (empresa sem CNAE/descrição cadastrados) */
  indeterminado: boolean;
  /** termos que bateram entre o negócio da empresa e o objeto do edital (para exibir ao usuário) */
  termosEncontrados: string[];
}

/**
 * Compara o objeto de um edital com o CNAE principal + descrição + core_business
 * da empresa ativa. Retorna `indeterminado: true` quando a empresa não tem dados
 * de negócio cadastrados o suficiente para o alerta fazer sentido — nesse caso
 * não se deve bloquear/confirmar nada.
 */
export function checarAderenciaObjetoEmpresa(objeto: string, empresa: Empresa | null | undefined): CnaeMatchResult {
  const baseNegocio = [
    empresa?.cnae_descricao,
    empresa?.core_business,
    ...(Array.isArray(empresa?.produtos_servicos) ? empresa.produtos_servicos : []),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!empresa || !baseNegocio || !objeto?.trim()) {
    return { compativel: true, indeterminado: true, termosEncontrados: [] };
  }

  const palavrasEdital = radicais(objeto);
  const tokensNegocio = [...radicais(baseNegocio)].filter((t) => !GENERICOS_CNAE_PREFIXOS.has(t));

  if (tokensNegocio.length === 0) {
    return { compativel: true, indeterminado: true, termosEncontrados: [] };
  }

  // Radicais do edital já expandidos com sinônimos de setor — cobre casos
  // onde o CNAE e o edital usam palavras diferentes para o mesmo mercado
  // (ex.: "médico-hospitalar" × "fisioterapia").
  const palavrasEditalExpandido = new Set<string>();
  for (const p of palavrasEdital) {
    for (const equiv of radicaisEquivalentes(p)) palavrasEditalExpandido.add(equiv);
  }

  const termosEncontrados = tokensNegocio.filter(
    (t) => palavrasEdital.has(t) || palavrasEditalExpandido.has(t),
  );

  return {
    compativel: termosEncontrados.length > 0,
    indeterminado: false,
    termosEncontrados,
  };
}
