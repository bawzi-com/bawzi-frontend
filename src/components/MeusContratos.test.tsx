import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AtalhoPipeline, LinhaDoTempo } from './MeusContratos';
import { faixaDeVencimentos } from '@/lib/meusContratos';

/* Meus contratos (25/09/2026): a faixa mensal de vencimentos e os atalhos
 * para o Pipeline, renderizados no servidor e clicados sem navegador. Os
 * dois componentes não usam hooks, então dá para chamá-los como função. */

function todos(no: ReactNode, quer: (e: ReactElement) => boolean): ReactElement[] {
  if (Array.isArray(no)) return no.flatMap((n) => todos(n, quer));
  if (!isValidElement(no)) return [];
  const filhos = todos((no.props as { children?: ReactNode }).children, quer);
  return quer(no) ? [no, ...filhos] : filhos;
}

const hoje = new Date(2026, 8, 25);
const faixa = faixaDeVencimentos([
  { data_vigencia_fim: '2026-11-15', valor: 2_500_000, situacao: 'vencendo' },
  { data_vigencia_fim: '2026-11-20', valor: 500_000, situacao: 'vencendo' },
  { data_vigencia_fim: '2027-03-01', valor: 80_000, situacao: 'vigente' },
], hoje);

describe('LinhaDoTempo — quanto vence em cada mês', () => {
  it('12 meses, com contagem, valor e o total no cabeçalho', () => {
    const html = renderToStaticMarkup(createElement(LinhaDoTempo, { faixa, selecionado: null, onSelecionar: () => {} }));
    expect(html).toContain('Vencimentos nos próximos 12 meses');
    expect(html).toContain('3 contratos');
    expect(html).toContain('nov/26: 2 contratos');
    expect(html).toContain('R$ 3 mi');
    expect(html).toContain('R$ 80 mil');
    expect(html).toContain('set/26: nenhum vencimento');
    expect(html).not.toContain('ver todos os meses');
  });

  it('clicar num mês seleciona; clicar de novo desfaz; mês vazio não clica', () => {
    const onSelecionar = vi.fn();
    const botoes = todos(LinhaDoTempo({ faixa, selecionado: null, onSelecionar }), (e) => e.type === 'button');
    const nov = botoes.find((b) => (b.props as { title?: string }).title?.startsWith('nov/26'))!;
    (nov.props as { onClick: () => void }).onClick();
    expect(onSelecionar).toHaveBeenCalledWith('2026-11');
    const set = botoes.find((b) => (b.props as { title?: string }).title?.startsWith('set/26'))!;
    expect((set.props as { disabled?: boolean }).disabled).toBe(true);

    const selecionado = todos(LinhaDoTempo({ faixa, selecionado: '2026-11', onSelecionar }), (e) => e.type === 'button');
    const novAtivo = selecionado.find((b) => (b.props as { title?: string }).title?.startsWith('nov/26'))!;
    expect((novAtivo.props as { 'aria-pressed'?: boolean })['aria-pressed']).toBe(true);
    (novAtivo.props as { onClick: () => void }).onClick();
    expect(onSelecionar).toHaveBeenLastCalledWith(null);
    expect(renderToStaticMarkup(createElement(LinhaDoTempo, { faixa, selecionado: '2026-11', onSelecionar })))
      .toContain('ver todos os meses');
  });

  it('sem vencimento nenhum, não há faixa', () => {
    expect(LinhaDoTempo({ faixa: faixaDeVencimentos([], hoje), selecionado: null, onSelecionar: () => {} })).toBeNull();
  });
});

describe('AtalhoPipeline — o Pipeline já filtrado', () => {
  it('manda o CNPJ com máscara e o nome; sem quem chame ou sem alvo, não aparece', () => {
    const onAbrir = vi.fn();
    const el = AtalhoPipeline({ campo: 'orgao', nome: 'MINISTÉRIO X', cnpj: '01612092000123', onAbrir })!;
    (el.props as { onClick: () => void }).onClick();
    expect(onAbrir).toHaveBeenCalledWith({ campo: 'orgao', valor: '01.612.092/0001-23', nome: 'MINISTÉRIO X' });
    expect(renderToStaticMarkup(el)).toContain('Pipeline');
    expect(AtalhoPipeline({ campo: 'orgao', nome: 'MINISTÉRIO X', cnpj: '01612092000123' })).toBeNull();
    expect(AtalhoPipeline({ campo: 'fornecedor', nome: '', cnpj: '', onAbrir })).toBeNull();
  });

  it('o rótulo e o title dizem o que abre', () => {
    const html = renderToStaticMarkup(createElement(AtalhoPipeline, {
      campo: 'fornecedor', nome: 'STEFANINI', onAbrir: () => {}, rotulo: 'outros contratos dele' }));
    expect(html).toContain('outros contratos dele');
    expect(html).toContain('contratos deste fornecedor');
  });
});
