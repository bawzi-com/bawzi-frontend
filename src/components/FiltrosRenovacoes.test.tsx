import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FiltrosDaBusca, NomeFiltravel, PainelDeFiltros } from './ContratosVencendo';

/* Filtros de órgão e fornecedor do Pipeline de renovações (25/09/2026),
 * renderizados no servidor e clicados sem navegador: os três componentes não
 * usam hooks, então dá para chamá-los como função e seguir os `children`. */

function todos(no: ReactNode, quer: (e: ReactElement) => boolean): ReactElement[] {
  if (Array.isArray(no)) return no.flatMap((n) => todos(n, quer));
  if (!isValidElement(no)) return [];
  const filhos = todos((no.props as { children?: ReactNode }).children, quer);
  return quer(no) ? [no, ...filhos] : filhos;
}

const nada = () => {};

describe('NomeFiltravel — o clique no cartão', () => {
  it('filtra o órgão pelo CNPJ, com o nome junto para o chip', () => {
    const onFiltrar = vi.fn();
    const el = NomeFiltravel({ campo: 'orgao', nome: 'PREFEITURA X', documento: '01612092000123', onFiltrar });
    const props = el.props as { role?: string; title?: string; onClick: () => void };
    expect(props.role).toBe('button');
    expect(props.title).toBe('Ver só os contratos deste órgão');
    props.onClick();
    expect(onFiltrar).toHaveBeenCalledWith('orgao', '01.612.092/0001-23', 'PREFEITURA X');
  });

  it('Enter também filtra; sem documento, vai o nome', () => {
    const onFiltrar = vi.fn();
    const el = NomeFiltravel({ campo: 'fornecedor', nome: 'STEFANINI S.A.', onFiltrar });
    (el.props as { onKeyDown: (e: unknown) => void }).onKeyDown({ key: 'Enter', preventDefault: nada });
    expect(onFiltrar).toHaveBeenCalledWith('fornecedor', 'STEFANINI S.A.', 'STEFANINI S.A.');
  });

  it('sem nome nem documento, é só texto', () => {
    const el = NomeFiltravel({ campo: 'orgao', nome: null, rotulo: 'Órgão não identificado', onFiltrar: vi.fn() });
    expect((el.props as { role?: string }).role).toBeUndefined();
    expect(renderToStaticMarkup(el)).toContain('Órgão não identificado');
  });
});

describe('PainelDeFiltros — atrás do "+ Filtros"', () => {
  it('órgão e fornecedor, e a regra do termo opcional', () => {
    const html = renderToStaticMarkup(createElement(PainelDeFiltros, {
      filtros: { orgao: '', fornecedor: '' }, onMudar: nada, onEnter: nada, onLimpar: nada }));
    expect(html).toContain('Órgão contratante');
    expect(html).toContain('Fornecedor atual');
    expect(html).toContain('Nome, CNPJ ou CPF de quem tem o contrato');
    expect(html).toContain('o termo pode ficar vazio');
    expect(html).not.toContain('Limpar filtros');
  });

  it('com filtro preenchido, oferece limpar; digitar e Enter chegam a quem chama', () => {
    const onMudar = vi.fn();
    const onEnter = vi.fn();
    const onLimpar = vi.fn();
    const arvore = PainelDeFiltros({ filtros: { orgao: 'UFG', fornecedor: '' }, onMudar, onEnter, onLimpar });
    const inputs = todos(arvore, (e) => e.type === 'input');
    expect(inputs).toHaveLength(2);
    const [orgao] = inputs;
    (orgao.props as { onChange: (e: unknown) => void }).onChange({ target: { value: 'Prefeitura de Goiânia' } });
    expect(onMudar).toHaveBeenCalledWith('orgao', 'Prefeitura de Goiânia');
    (orgao.props as { onKeyDown: (e: unknown) => void }).onKeyDown({ key: 'Enter' });
    expect(onEnter).toHaveBeenCalledTimes(1);
    const limpar = todos(arvore, (e) => e.type === 'button');
    expect(limpar).toHaveLength(1);
    (limpar[0].props as { onClick: () => void }).onClick();
    expect(onLimpar).toHaveBeenCalledTimes(1);
  });
});

describe('FiltrosDaBusca — o que valeu na última busca', () => {
  const base = { nomes: {}, ignorados: [], naoConferidos: 0, onTirar: nada };

  it('chip com o nome clicado e o CNPJ com máscara, e o × tira o filtro certo', () => {
    const onTirar = vi.fn();
    const props = { ...base, onTirar,
      aplicados: { orgao: { tipo: 'documento', valor: '01612092000123' }, fornecedor: { tipo: 'nome', valor: 'Stefanini' } },
      nomes: { orgao: 'PREFEITURA X' } };
    const html = renderToStaticMarkup(createElement(FiltrosDaBusca, props));
    expect(html).toContain('PREFEITURA X · 01.612.092/0001-23');
    expect(html).toContain('Stefanini');
    const botoes = todos(FiltrosDaBusca(props), (e) => e.type === 'button');
    expect(botoes).toHaveLength(2);
    (botoes[1].props as { onClick: () => void }).onClick();
    expect(onTirar).toHaveBeenCalledWith('fornecedor');
  });

  it('avisa o filtro que o servidor não aplicou e os contratos sem fornecedor conferido', () => {
    const html = renderToStaticMarkup(createElement(FiltrosDaBusca, { ...base,
      aplicados: { orgao: null, fornecedor: { tipo: 'nome', valor: 'Stefanini' } },
      ignorados: ['orgao'], naoConferidos: 3 }));
    expect(html).toContain('O filtro de órgão não foi aplicado');
    expect(html).toContain('3 contratos achados no PNCP ficaram de fora');
  });

  it('sem filtro de fornecedor, a conta de não conferidos não aparece; sem nada, não há bloco', () => {
    const html = renderToStaticMarkup(createElement(FiltrosDaBusca, { ...base,
      aplicados: { orgao: { tipo: 'nome', valor: 'UFG' }, fornecedor: null }, naoConferidos: 3 }));
    expect(html).not.toContain('ficaram de fora');
    expect(FiltrosDaBusca({ ...base, aplicados: null })).toBeNull();
  });
});
