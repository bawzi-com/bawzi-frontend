import { describe, expect, it } from 'vitest';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ajudasDaCarteira } from './ResumoCreditos';

/* O "?" dos Adicionais (26/09/2026): dizia "créditos avulsos que você comprou"
 * — e uma conta nova, sem compra nenhuma, via "+50" ali (concedidos no Admin,
 * ou comprados por outra pessoa do workspace). */

const ajuda = (extras: number) => renderToStaticMarkup(
  createElement(Fragment, null, ajudasDaCarteira({ limite: 5, usado: 0, creditos_extras: extras }).adicionais));

describe('ajudasDaCarteira · adicionais', () => {
  it('diz de onde o saldo vem e de quem ele é', () => {
    const h = ajuda(50);
    expect(h).toContain('Créditos avulsos do workspace, fora do plano: os comprados em pacote e os concedidos');
    expect(h).toContain('pela Bawzi. Valem para todos do workspace.');
    expect(h).toMatch(/Hoje: <strong[^>]*>50<\/strong>/);
    expect(h).not.toContain('você comprou');
    expect(h).toContain('não expiram');
  });

  it('sem saldo, sem o "Hoje"', () => {
    expect(ajuda(0)).not.toContain('Hoje:');
  });
});
