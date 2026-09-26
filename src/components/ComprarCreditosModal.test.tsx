import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CorpoDaCompra, valorInicial, type PacoteInfo } from './ComprarCreditosModal';

/* A compra avulsa com o crédito a R$ 4,90 (26/09/2026): o que o valor compra,
 * o que se paga e o que o botão manda — renderizado no servidor e clicado sem
 * navegador. */

const INFO: PacoteInfo = {
  preco_credito_brl: 4.9, minimo_brl: 24.5, maximo_brl: 5000,
  sugestoes_brl: [49, 98, 245, 490], creditos_por_auditoria: 8, creditos_por_rapida: 2,
};

type Props = Parameters<typeof CorpoDaCompra>[0];

function props(o: Partial<Props> = {}): Props {
  return { info: INFO, valor: '50', onValor: () => {}, enviando: false, onConfirmar: () => {}, ...o };
}

const html = (o: Partial<Props> = {}) => renderToStaticMarkup(createElement(CorpoDaCompra, props(o)));

function elementos(no: ReactNode, tipo: string): ReactElement[] {
  if (Array.isArray(no)) return no.flatMap((n) => elementos(n, tipo));
  if (!isValidElement(no)) return [];
  const filhos = elementos((no.props as { children?: ReactNode }).children, tipo);
  return no.type === tipo ? [no, ...filhos] : filhos;
}

const botaoPagar = (o: Partial<Props> = {}) => elementos(CorpoDaCompra(props(o)), 'button').at(-1)!;

describe('valorInicial', () => {
  it('a segunda sugestão, ou o mínimo — sempre em pt-BR', () => {
    expect(valorInicial(INFO)).toBe('98,00');
    expect(valorInicial({ ...INFO, sugestoes_brl: [] })).toBe('24,50');
  });
});

describe('CorpoDaCompra', () => {
  it('o campo tem máscara: o que se digita passa por ela antes de virar valor', () => {
    const onValor = vi.fn();
    const [campo] = elementos(CorpoDaCompra(props({ valor: '', onValor })), 'input');
    (campo.props as { onChange: (e: unknown) => void }).onChange({ target: { value: '2500' } });
    (campo.props as { onChange: (e: unknown) => void }).onChange({ target: { value: '25,001' } });
    expect(onValor.mock.calls).toEqual([['25,00'], ['250,01']]);
    const h = html({ valor: '' });
    expect(h).toContain('inputMode="numeric"');
    expect(h).toContain('placeholder="0,00"');
    expect(html({ valor: '25,00' })).toMatch(/Você recebe<\/span><span[^>]*>5<span/);
  });

  it('R$ 50 a R$ 4,90: 10 créditos, e paga-se R$ 49 — a tela diz, o botão manda', () => {
    const h = html();
    expect(h).toMatch(/Você recebe<\/span><span[^>]*>10<span[^>]*>créditos/);
    expect(h).toMatch(/R\$\s50,00 não fecham em créditos inteiros: você paga <strong[^>]*>R\$\s49,00<\/strong> pelos 10 créditos\./);
    expect(h).toMatch(/Pagar R\$\s49,00/);
    const onConfirmar = vi.fn();
    (botaoPagar({ onConfirmar }).props as { onClick: () => void }).onClick();
    const [campo] = elementos(CorpoDaCompra(props({ onConfirmar })), 'input');
    (campo.props as { onKeyDown: (e: unknown) => void }).onKeyDown({ key: 'Enter' });
    expect(onConfirmar.mock.calls).toEqual([[49], [49]]);
  });

  it('valor que fecha: créditos exatos (o float dava 49) e nenhuma ressalva', () => {
    const h = html({ valor: '245' });
    expect(h).toMatch(/Você recebe<\/span><span[^>]*>50<span/);
    expect(h).toMatch(/Pagar R\$\s245,00/);
    expect(h).not.toContain('não fecham');
    expect(html({ valor: '24,50' })).toMatch(/>5<span[^>]*>créditos[^]*Pagar R\$\s24,50/);
  });

  it('as sugestões são múltiplos do preço, em pt-BR, e marcam a escolhida', () => {
    const onValor = vi.fn();
    const h = html({ valor: '98' });
    for (const [v, cr] of [['49', 10], ['98', 20], ['245', 50], ['490', 100]]) {
      expect(h).toMatch(new RegExp(`>${v}</span><span[^>]*>${cr} cr<`));
    }
    expect(h).toMatch(/border-violet-400[^>]*><span[^>]*>98</);
    expect(h.match(/border-violet-400/g)).toHaveLength(1);
    const sugestoes = elementos(CorpoDaCompra(props({ onValor })), 'button').slice(0, 4);
    (sugestoes[2].props as { onClick: () => void }).onClick();
    expect(onValor).toHaveBeenCalledWith('245,00');
    // Preço que não dá múltiplo inteiro: o campo recebe vírgula, não ponto
    // (o campo lê ponto como milhar — "49.5" viraria R$ 495).
    const quebrado = { ...INFO, preco_credito_brl: 4.95, sugestoes_brl: [49.5] };
    const [s] = elementos(CorpoDaCompra(props({ info: quebrado, onValor })), 'button');
    (s.props as { onClick: () => void }).onClick();
    expect(onValor).toHaveBeenLastCalledWith('49,50');
  });

  it('fora da faixa: aviso vermelho, sem ressalva, botão travado', () => {
    const h = html({ valor: '20' });
    expect(h).toMatch(/Valor entre R\$\s24,50 e R\$\s5\.000,00\./);
    expect(h).not.toContain('não fecham');
    expect((botaoPagar({ valor: '20' }).props as { disabled: boolean }).disabled).toBe(true);
    expect((botaoPagar({ valor: '24,49' }).props as { disabled: boolean }).disabled).toBe(true);
    expect((botaoPagar({ valor: '5.000,01' }).props as { disabled: boolean }).disabled).toBe(true);
    expect((botaoPagar({ valor: '5.000' }).props as { disabled: boolean }).disabled).toBe(false);
    expect(html({ valor: '24,50' })).not.toContain('Valor entre');
  });

  it('abrindo o pagamento, ou sem crédito nenhum: travado', () => {
    expect((botaoPagar({ enviando: true }).props as { disabled: boolean }).disabled).toBe(true);
    expect(html({ enviando: true })).toContain('Abrindo pagamento…');
    expect((botaoPagar({ valor: '' }).props as { disabled: boolean }).disabled).toBe(true);
    expect(html({ valor: '' })).not.toContain('Valor entre');      // campo vazio não é erro
    const semPreco = { ...INFO, preco_credito_brl: 0 };
    expect((botaoPagar({ info: semPreco, valor: '100' }).props as { disabled: boolean }).disabled).toBe(true);
  });
});
