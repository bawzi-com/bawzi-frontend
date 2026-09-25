import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CompetitorWarRoom, { type PricingIntelligenceData } from './CompetitorWarRoom';

/* A aba Disputa renderizada no servidor (sem navegador): confere que o que
 * `fontesSemResposta` decide chega de fato à tela. 25/09/2026. */

const renderizar = (pricing: PricingIntelligenceData) =>
  renderToStaticMarkup(createElement(CompetitorWarRoom, { pricing }));

const EVIDENCIA_GERAL = [{ valor: 98.5, descricao: 'SERVIÇOS DE FÁBRICA DE SOFTWARE', orgao: 'ME', uf: 'DF' }];

describe('CompetitorWarRoom — fontes que ficaram sem resposta', () => {
  it('lista de itens que não chegou: aviso no topo e a seção não diz que o edital não tem itens', () => {
    const html = renderizar({
      coletaIncompleta: ['itens_edital'],
      evidenciasPrecosUnitarios: EVIDENCIA_GERAL,
    } as PricingIntelligenceData);
    expect(html).toContain('Ficaram sem resposta nesta análise: lista de itens do edital no PNCP.');
    expect(html).toContain('A lista de itens do edital no PNCP não chegou nesta análise');
    expect(html).not.toContain('O edital não trouxe a lista de itens do PNCP');
  });

  it('sem corte: nenhum aviso, e o texto de sempre para edital sem itens', () => {
    const html = renderizar({ evidenciasPrecosUnitarios: EVIDENCIA_GERAL } as PricingIntelligenceData);
    expect(html).not.toContain('Ficaram sem resposta');
    expect(html).toContain('O edital não trouxe a lista de itens do PNCP');
  });

  it('complemento do deságio sem resposta: o cartão sem base não manda buscar "termo mais específico"', () => {
    const html = renderizar({ coletaIncompleta: ['complemento_desagio'] } as PricingIntelligenceData);
    expect(html).toContain('A consulta de contratos no PNCP que completaria a amostra ficou sem resposta');
    expect(html).not.toContain('termo mais específico');
  });

  it('sem histórico de verdade, o conselho do termo continua', () => {
    const html = renderizar({} as PricingIntelligenceData);
    expect(html).toContain('termo mais específico');
    expect(html).not.toContain('Ficaram sem resposta');
  });
});
