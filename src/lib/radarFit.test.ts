import { describe, expect, it } from 'vitest';
import { descricaoFitBase, ordenarRadar, pesoDoFit, rotuloFit, type FitNegocio } from './radarFit';

const fit = (nivel: FitNegocio['nivel'], score: number | null, termos: string[] = []): FitNegocio =>
  ({ nivel, score, termos, fonte: 'cadastro' });

describe('ordenarRadar', () => {
  it('sem fit e sem UF, devolve a ordem recebida (comportamento anterior)', () => {
    const lista = [{ id: 'a', uf: 'SP' }, { id: 'b', uf: 'RJ' }, { id: 'c', uf: 'SP' }];
    expect(ordenarRadar(lista, '').map(e => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('sem fit e com UF, locais primeiro mantendo a ordem interna (a "ordenação militar" de antes)', () => {
    const lista = [{ id: 'a', uf: 'SP' }, { id: 'b', uf: 'RJ' }, { id: 'c', uf: 'sp ' }, { id: 'd', uf: 'MG' }];
    expect(ordenarRadar(lista, 'RJ').map(e => e.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(ordenarRadar(lista, 'sp').map(e => e.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('a regionalidade manda antes do fit: um local baixo fica acima de um alto de fora', () => {
    const lista = [
      { id: 'fora-alto', uf: 'RJ', fit_negocio: fit('alto', 100) },
      { id: 'local-baixo', uf: 'SP', fit_negocio: fit('baixo', 0) },
    ];
    expect(ordenarRadar(lista, 'SP').map(e => e.id)).toEqual(['local-baixo', 'fora-alto']);
  });

  it('dentro do grupo, o nível manda, o score desempata, e a data (ordem recebida) fecha', () => {
    const lista = [
      { id: 'baixo-1', uf: 'SP', fit_negocio: fit('baixo', 0) },
      { id: 'medio-35', uf: 'SP', fit_negocio: fit('medio', 35) },
      { id: 'sem-fit', uf: 'SP' },
      { id: 'alto-70', uf: 'SP', fit_negocio: fit('alto', 70) },
      { id: 'medio-50', uf: 'SP', fit_negocio: fit('medio', 50) },
      { id: 'alto-100', uf: 'SP', fit_negocio: fit('alto', 100) },
      { id: 'baixo-2', uf: 'SP', fit_negocio: fit('baixo', 0) },
    ];
    expect(ordenarRadar(lista, 'SP').map(e => e.id)).toEqual([
      'alto-100', 'alto-70', 'medio-50', 'medio-35', 'baixo-1', 'sem-fit', 'baixo-2',
    ]);
  });

  it('um "alto" da carteira com score menor ainda vem antes de um "medio" com score maior', () => {
    // Na carteira, `no_seu_ramo` faz o nível ser alto mesmo com aderência
    // modesta; o selo diz "do seu ramo" e a ordem precisa concordar com o selo.
    const lista = [
      { id: 'medio-45', uf: 'SP', fit_negocio: fit('medio', 45) },
      { id: 'alto-30', uf: 'SP', fit_negocio: fit('alto', 30) },
    ];
    expect(ordenarRadar(lista, '').map(e => e.id)).toEqual(['alto-30', 'medio-45']);
  });

  it('não muta a lista original', () => {
    const lista = [{ id: 'a', uf: 'RJ' }, { id: 'b', uf: 'SP' }];
    ordenarRadar(lista, 'SP');
    expect(lista.map(e => e.id)).toEqual(['a', 'b']);
  });
});

describe('pesoDoFit', () => {
  it('sem fit, indeterminado e baixo pesam zero — não sobem nem descem', () => {
    expect(pesoDoFit(undefined)).toEqual([0, 0]);
    expect(pesoDoFit(null)).toEqual([0, 0]);
    expect(pesoDoFit(fit('indeterminado', null))).toEqual([0, 0]);
    expect(pesoDoFit(fit('baixo', 0))).toEqual([0, 0]);
  });
  it('alto pesa mais que medio, e o score vai junto', () => {
    expect(pesoDoFit(fit('alto', 88))).toEqual([2, 88]);
    expect(pesoDoFit(fit('medio', 20))).toEqual([1, 20]);
  });
});

describe('rotuloFit', () => {
  it('só alto e medio ganham selo; os termos vão até 3', () => {
    expect(rotuloFit(fit('alto', 100, ['site', 'sistemas', 'portal', 'web']))).toEqual({
      texto: 'Do seu ramo', termos: 'site, sistemas, portal', tom: 'alto',
    });
    expect(rotuloFit(fit('medio', 35, ['site']))).toEqual({ texto: 'Perto do seu ramo', termos: 'site', tom: 'medio' });
    expect(rotuloFit(fit('baixo', 0))).toBeNull();
    expect(rotuloFit(fit('indeterminado', null))).toBeNull();
    expect(rotuloFit(undefined)).toBeNull();
  });
});

describe('descricaoFitBase', () => {
  it('diz de onde veio a ordem — carteira ou cadastro', () => {
    expect(descricaoFitBase(null)).toBe('');
    expect(descricaoFitBase({ fonte: null, carteira: 0, vocabulario: 0, empresa: '', cnae: '' })).toBe('');
    expect(descricaoFitBase({ fonte: 'carteira', carteira: 45, vocabulario: 9, empresa: 'Stefanini', cnae: '6201-5/01' }))
      .toContain('45 contratos');
    expect(descricaoFitBase({ fonte: 'carteira', carteira: 1, vocabulario: 9, empresa: 'X', cnae: '' }))
      .toContain('1 contrato que');
    expect(descricaoFitBase({ fonte: 'cadastro', carteira: 0, vocabulario: 9, empresa: 'Stefanini', cnae: '6201-5/01' }))
      .toContain('cadastro (CNAE 6201-5/01');
  });
});
