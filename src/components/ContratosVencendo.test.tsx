import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ContratosVencendo from './ContratosVencendo';

/* O primeiro quadro da tela, renderizado no servidor (sem navegador). Os
 * efeitos (termos do setor e busca automática) não rodam aqui; o que se
 * confere é o que a tela promete antes deles. 25/09/2026. */

const html = renderToStaticMarkup(createElement(ContratosVencendo, {
  token: 't',
  companies: [{ cnpj: '12345678000195', cnae_principal: '6201501',
    cnae_descricao: 'Desenvolvimento de programas de computador sob encomenda' }],
}));

describe('ContratosVencendo — o que a tela abre', () => {
  it('abre na janela de 90 dias, não na de 30', () => {
    const selecionado = (rotulo: string) =>
      new RegExp(`class="[^"]*bg-white text-slate-800[^"]*"[^>]*>${rotulo}<`).test(html);
    expect(selecionado('90d')).toBe(true);
    expect(selecionado('30d')).toBe(false);
  });

  it('"Todas as UFs", no feminino', () => {
    expect(html).toContain('Todas as UFs');
    expect(html).not.toContain('Todos UFs');
  });

  it('não deriva mais o termo da descrição do CNAE no navegador', () => {
    expect(html).not.toContain('programas computador encomenda');
  });

  it('"+ Filtros" começa fechado, sem esconder filtro nenhum', () => {
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*?Filtros/);
    expect(html).not.toContain('Órgão contratante');
  });

  it('explica a régua da busca', () => {
    expect(html).toContain('Um contrato entra quando o objeto traz todas as palavras de um dos termos');
  });
});
