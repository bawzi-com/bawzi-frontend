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

  const termosEncontrados = tokensNegocio.filter((t) => palavrasEdital.has(t));

  return {
    compativel: termosEncontrados.length > 0,
    indeterminado: false,
    termosEncontrados,
  };
}
