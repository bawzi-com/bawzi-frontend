import { describe, expect, it } from 'vitest';
import { montarSecaoDeEvidencias, resumoDaMediana } from './evidenciasPreco';

// A lista geral que a tela mostrava no edital de fábrica de software.
const LISTA_GERAL_DO_LAUDO = [
  { valor: 1.01, descricao: 'Manta', orgao: 'MINISTERIO DA JUSTICA E SEGURANCA PUBLICA', uf: 'DF', fonte: 'DB_ESTRUTURADO' },
  { valor: 42.77, descricao: 'SUBSCRICAO DE LICENCA DE SOFTWARE OFFICE 365 ENTERPRISE E1', uf: 'MG', fonte: 'DB_ESTRUTURADO' },
  { valor: 684.98, descricao: 'FOGÃO INDUSTRIAL 2 BOCAS', uf: 'GO', fonte: 'PNCP_HOMOLOGADO' },
];

const ITEM_TI = {
  numero_item: 1,
  descricao: 'Serviços em Tecnologia da informação, Serviço de desenvolvimento, manutenção, migração, evolução e criação de sistemas de informação - fábrica de software.',
  quantidade: 400000,
  unidade: 'UNIDADE DE SERVICO TECNICO',
  valor_estimado: 91.95,
  valor_total_estimado: 36780000,
  metodo: 'descricao',
  consulta: 'fábrica de software',
  familia_unidade: 'UST',
  linhas: 3,
  amostra: 3,
  media: 101.17,
  mediana: 98.5,
  minimo: 85,
  maximo: 120,
  delta_vs_estimado_pct: 7.1,
  coerencia: { veredito: 'coerente', razao: 1.41, amostra: 3, motivo: '' },
  selo: { nivel: 'bom', texto: 'Preço homologado · objeto compatível', detalhe: 'Descrições compatíveis.' },
  evidencias: [
    { valor: 85, descricao: 'Unidade de Serviço Técnico - UST', orgao: 'TRT', uf: 'DF', fonte: 'DB_ESTRUTURADO', unidade: 'UST',
      objeto: 'Contratação de serviços de fábrica de software mensurados em UST' },
    { valor: 98.5, descricao: 'SERVIÇOS DE FÁBRICA DE SOFTWARE', orgao: 'ME', uf: 'DF', fonte: 'DB_ESTRUTURADO' },
    { valor: 120, descricao: 'Fábrica de software', orgao: 'SEFAZ', uf: 'GO', fonte: 'PNCP_HOMOLOGADO' },
  ],
};

const BOLO = {
  evidenciasPrecosUnitarios: LISTA_GERAL_DO_LAUDO,
  valorMedioUnitarioMercado: 504.75,
  valorMinimoUnitarioMercado: 1.01,
  amostraPrecosUnitarios: 12,
  seloVerificacao: { nivel: 'fraco', texto: 'Origem PNCP · objetos divergentes', detalhe: 'variam 784×' },
};

describe('montarSecaoDeEvidencias — edital com itens do PNCP', () => {
  it('mostra só as evidências do item, nunca a lista da busca geral', () => {
    const secao = montarSecaoDeEvidencias({ ...BOLO, itensComparados: [ITEM_TI] });
    expect(secao.modo).toBe('itens');
    expect(secao.blocos).toHaveLength(1);
    const todas = secao.blocos.flatMap(b => b.evidencias.map(e => e.descricao));
    expect(todas).not.toContain('Manta');
    expect(todas).not.toContain('FOGÃO INDUSTRIAL 2 BOCAS');
    expect(todas).toEqual(['Unidade de Serviço Técnico - UST', 'SERVIÇOS DE FÁBRICA DE SOFTWARE', 'Fábrica de software']);
    // a linha seca de serviço leva junto o objeto do contrato, que diz do que se trata
    expect(secao.blocos[0].evidencias[0].objeto).toBe('Contratação de serviços de fábrica de software mensurados em UST');
  });

  it('traz as três colunas pedidas: médio, mínimo e máximo', () => {
    const [b] = montarSecaoDeEvidencias({ itensComparados: [ITEM_TI] }).blocos;
    expect([b.media, b.minimo, b.maximo]).toEqual([101.17, 85, 120]);
    expect(b.mediana).toBe(98.5);
    expect(b.unidadeDoPreco).toBe('UST');
    expect(b.estimativaUnitaria).toBe(91.95);
    expect(b.estimativaTotal).toBe(36780000);
  });

  it('diz o que foi procurado no rótulo do item', () => {
    const [b] = montarSecaoDeEvidencias({ itensComparados: [ITEM_TI] }).blocos;
    expect(b.rotulo).toBe('Item 1 · 400000 UNIDADE DE SERVICO TECNICO · por descrição: “fábrica de software”');
  });

  it('laudo anterior à mudança, sem média: a coluna fica em branco, não inventada', () => {
    const { media: _media, ...antigo } = ITEM_TI;
    const [b] = montarSecaoDeEvidencias({ itensComparados: [antigo] }).blocos;
    expect(b.media).toBeNull();
    expect([b.minimo, b.maximo]).toEqual([85, 120]);
  });

  it('item sem comparável explica o porquê e não conta como item com preço', () => {
    const sem = {
      ...ITEM_TI, amostra: 0, linhas: 0, media: null, mediana: null, minimo: null, maximo: null, evidencias: [],
      coerencia: { veredito: 'amostra_insuficiente', razao: null, amostra: 0, motivo: 'Nenhum preço comparável foi localizado.' },
      selo: { nivel: 'fraco', texto: 'Sem comparável localizado', detalhe: 'Nenhum preço por UST comparável foi localizado para este item pela descrição (“fábrica de software”).' },
    };
    const secao = montarSecaoDeEvidencias({ itensComparados: [sem, ITEM_TI] });
    expect(secao.itensComEvidencia).toBe(1);
    expect(secao.totalItens).toBe(2);
    expect(secao.blocos[0].semComparavel).toContain('por UST');
    expect(secao.blocos[0].avisoCoerencia).toBeNull();
  });

  it('avisa quando os preços do item não formam referência', () => {
    const disperso = { ...ITEM_TI, coerencia: { veredito: 'incomparavel', razao: 9, amostra: 3, motivo: 'Os preços variam 9× entre si.' } };
    const [b] = montarSecaoDeEvidencias({ itensComparados: [disperso] }).blocos;
    expect(b.avisoCoerencia).toBe('Os preços variam 9× entre si.');
  });

  it('descarta evidência sem valor e aceita número vindo como texto', () => {
    const it2 = { ...ITEM_TI, evidencias: [{ valor: 0, descricao: 'zero' }, { valor: '77.5', descricao: 'texto' }, 'lixo'] };
    const [b] = montarSecaoDeEvidencias({ itensComparados: [it2] }).blocos;
    expect(b.evidencias.map(e => [e.valor, e.descricao])).toEqual([[77.5, 'texto']]);
  });
});

describe('montarSecaoDeEvidencias — sem lista de itens', () => {
  it('cai para a busca pelo objeto, com as colunas sobre todos os contratos', () => {
    const secao = montarSecaoDeEvidencias({
      ...BOLO,
      estatisticasPrecosUnitarios: { media: 150, mediana: 140, minimo: 50, maximo: 240, amostra: 20, linhas: 26 },
      coerenciaAmostra: { veredito: 'coerente', razao: 4.8, amostra: 20, motivo: '' },
    });
    expect(secao.modo).toBe('objeto');
    const [b] = secao.blocos;
    expect(b.rotulo).toBe('Pelo objeto do edital');
    expect([b.media, b.minimo, b.maximo, b.mediana]).toEqual([150, 50, 240, 140]);
    expect([b.amostra, b.linhas]).toEqual([20, 26]);
    expect(b.evidencias).toHaveLength(3);
  });

  it('laudo antigo sem estatísticas: mínimo e mediana do laudo, média e máximo em branco', () => {
    const [b] = montarSecaoDeEvidencias(BOLO).blocos;
    expect(b.minimo).toBe(1.01);
    expect(b.mediana).toBe(504.75);
    expect(b.media).toBeNull();
    expect(b.maximo).toBeNull();
    expect(b.amostra).toBe(12);
  });

  it('some quando não há nada para mostrar', () => {
    expect(montarSecaoDeEvidencias({}).modo).toBe('vazio');
    expect(montarSecaoDeEvidencias(null).modo).toBe('vazio');
    expect(montarSecaoDeEvidencias({ itensComparados: [], evidenciasPrecosUnitarios: [] }).modo).toBe('vazio');
  });
});

describe('resumoDaMediana — o cartão acima da seção segue a mesma regra', () => {
  it('com um item, é a mediana do item, não a da busca geral', () => {
    const r = resumoDaMediana({ ...BOLO, itensComparados: [ITEM_TI] });
    expect(r.modo).toBe('item');
    expect(r.valor).toBe(98.5);
    expect(r.minimo).toBe(85);
    expect(r.selo?.texto).toBe('Preço homologado · objeto compatível');
  });

  it('com vários itens, não há uma mediana só', () => {
    const r = resumoDaMediana({ ...BOLO, itensComparados: [ITEM_TI, { ...ITEM_TI, numero_item: 2 }] });
    expect(r.modo).toBe('varia');
    expect(r.valor).toBeNull();
  });

  it('sem itens, continua a mediana da busca pelo objeto', () => {
    const r = resumoDaMediana(BOLO);
    expect(r.modo).toBe('geral');
    expect([r.valor, r.minimo, r.amostra]).toEqual([504.75, 1.01, 12]);
    expect(r.selo?.nivel).toBe('fraco');
  });
});
