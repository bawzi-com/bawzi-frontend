import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EnderecoDasAcoes } from './AnalysisResults';
import type { AnalysisResult } from './analysis-types';

/* A seção "Sobre o que impugnar ou pedir esclarecimento", renderizada no
 * servidor (sem navegador). Caso real de 25/09/2026: um laudo com duas
 * cláusulas ESCLARECER mostrava a seção, o prazo e o aviso de minuta, e
 * nenhum botão. */

const ESCLARECER = [
  { tipo: 'exigencia_fabricante', descricao: 'O requisito de Government Specialization Adobe restringe a disputa.',
    gravidade: 'media', trecho: 'detentora da especialização “Government Specialization”', acao_sugerida: 'esclarecer' },
  { tipo: 'divergencia_objeto', descricao: 'Há divergência entre a composição do lance e o detalhamento do objeto.',
    gravidade: 'media', acao_sugerida: 'esclarecer' },
];
const IMPUGNAR = [
  { tipo: 'atestado_excessivo', descricao: 'Atestado com quantitativo acima de 50%.', gravidade: 'alta',
    acao_sugerida: 'impugnar' },
];

const nada = () => {};

function renderizar(flags: unknown[], extra: Partial<AnalysisResult> = {}, comTexto = true) {
  const result = { red_flags: flags, ...extra } as unknown as AnalysisResult;
  return renderToStaticMarkup(createElement(EnderecoDasAcoes, {
    result,
    onGerarPeca: comTexto ? nada : undefined,
    gerandoPeca: null,
  }));
}

describe('EnderecoDasAcoes — uma peça por ação', () => {
  it('só pontos a esclarecer: oferece o pedido de esclarecimento, e não a impugnação', () => {
    const html = renderizar(ESCLARECER);
    expect(html).toContain('Gerar pedido de esclarecimento');
    expect(html).not.toContain('Gerar peça de impugnação');
  });

  it('com os dois tipos, os dois botões', () => {
    const html = renderizar([...IMPUGNAR, ...ESCLARECER]);
    expect(html).toContain('Gerar peça de impugnação');
    expect(html).toContain('Gerar pedido de esclarecimento');
  });

  it('só impugnar: só a impugnação', () => {
    const html = renderizar(IMPUGNAR);
    expect(html).toContain('Gerar peça de impugnação');
    expect(html).not.toContain('Gerar pedido de esclarecimento');
  });

  it('laudo sem o texto do edital explica por que não redige, também só com esclarecimentos', () => {
    const html = renderizar(ESCLARECER, {}, false);
    expect(html).not.toContain('Gerar pedido de esclarecimento');
    expect(html).toContain('sem o texto carregado');
  });
});

describe('EnderecoDasAcoes — o prazo', () => {
  const prazo = (data_iso: string, referencia?: object) => ({
    prazo_impugnacao_calculado: {
      data_iso, base_legal: 'Lei 14.133/2021, art. 164', origem: 'calculado', mensagem: '', referencia,
    },
  } as unknown as Partial<AnalysisResult>);

  it('diz de onde a conta partiu', () => {
    const html = renderizar(ESCLARECER, prazo('2099-10-01T08:00:00+00:00', {
      label: 'Fim do recebimento de propostas', data_iso: '2099-10-06T08:00:00+00:00', fonte: 'pncp', ambigua: false,
    }));
    expect(html).toContain('Abertura usada na conta: Fim do recebimento de propostas');
    expect(html).toContain('data oficial do PNCP');
    expect(html).not.toContain('já passou');
  });

  it('referência ambígua pede conferência', () => {
    const html = renderizar(ESCLARECER, prazo('2099-10-01T08:00:00+00:00', {
      label: 'Abertura das Propostas', data_iso: '2099-10-06T08:00:00+00:00', fonte: 'edital', ambigua: true,
    }));
    expect(html).toContain('Confira no edital se esta é a data da sessão pública');
  });

  it('prazo vencido é dito, e os botões continuam lá', () => {
    const html = renderizar(ESCLARECER, prazo('2020-09-21T08:00:00+00:00'));
    expect(html).toContain('esse prazo já passou');
    expect(html).toContain('Gerar pedido de esclarecimento');
  });
});

/** Os botões da árvore que o componente devolve, sem DOM: o componente não usa
 *  hooks, então dá para chamá-lo como função e seguir os `children`. */
function botoes(no: ReactNode): Array<{ texto: string; onClick: () => void }> {
  if (Array.isArray(no)) return no.flatMap(botoes);
  if (!isValidElement(no)) return [];
  const props = no.props as { children?: ReactNode; onClick?: () => void };
  if (no.type === 'button') {
    const texto = (function juntar(n: ReactNode): string {
      if (typeof n === 'string') return n;
      if (Array.isArray(n)) return n.map(juntar).join('');
      return isValidElement(n) ? juntar((n.props as { children?: ReactNode }).children) : '';
    })(props.children);
    return [{ texto, onClick: props.onClick ?? (() => {}) }];
  }
  return botoes(props.children);
}

describe('EnderecoDasAcoes — o que cada botão manda', () => {
  it('o pedido de esclarecimento leva só as cláusulas ESCLARECER', () => {
    const onGerarPeca = vi.fn();
    const arvore = EnderecoDasAcoes({
      result: { red_flags: [...IMPUGNAR, ...ESCLARECER] } as unknown as AnalysisResult,
      onGerarPeca,
      gerandoPeca: null,
    });
    const alvo = botoes(arvore).find((b) => b.texto.includes('pedido de esclarecimento'));
    expect(alvo).toBeDefined();
    alvo!.onClick();
    expect(onGerarPeca).toHaveBeenCalledTimes(1);
    const [tipo, riscos] = onGerarPeca.mock.calls[0];
    expect(tipo).toBe('esclarecimento');
    expect(riscos.map((r: { titulo: string }) => r.titulo)).toEqual(['exigencia_fabricante', 'divergencia_objeto']);
  });

  it('a impugnação leva só as cláusulas IMPUGNAR', () => {
    const onGerarPeca = vi.fn();
    const arvore = EnderecoDasAcoes({
      result: { red_flags: [...IMPUGNAR, ...ESCLARECER] } as unknown as AnalysisResult,
      onGerarPeca,
      gerandoPeca: null,
    });
    botoes(arvore).find((b) => b.texto.includes('impugnação'))!.onClick();
    const [tipo, riscos] = onGerarPeca.mock.calls[0];
    expect(tipo).toBe('impugnacao');
    expect(riscos).toHaveLength(1);
  });
});

