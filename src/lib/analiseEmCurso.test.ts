/**
 * O marcador da análise em curso — o canal que deixa a tela perder a análise
 * de vista sem perder a análise (ver o cabeçalho de `analiseEmCurso.ts`).
 *
 * ⚠️ O que mais importa aqui é a GUARDA POR TOKEN: duas abas, ou uma análise
 * iniciada logo depois de outra, dividem a mesma chave. Atualizar ou apagar o
 * marcador sem conferir de quem ele é mataria a retomada da outra análise.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CHAVE_ANALISE_EM_CURSO,
  EVENTO_ANALISE_EM_CURSO,
  IDADE_MAXIMA_MARCADOR_MS,
  atualizarMarcadorAnalise,
  gravarMarcadorAnalise,
  lerMarcadorAnalise,
  removerMarcadorAnalise,
} from './analiseEmCurso';

// Ambiente `node`: um localStorage e um window mínimos, só o que o módulo usa.
let armazenado: Record<string, string> = {};
let avisos = 0;
const g = globalThis as unknown as Record<string, unknown>;

beforeEach(() => {
  armazenado = {};
  avisos = 0;
  g.localStorage = {
    getItem: (k: string) => (k in armazenado ? armazenado[k] : null),
    setItem: (k: string, v: string) => { armazenado[k] = String(v); },
    removeItem: (k: string) => { delete armazenado[k]; },
  };
  g.window = {
    dispatchEvent: (e: Event) => { if (e.type === EVENTO_ANALISE_EM_CURSO) avisos += 1; return true; },
  };
});

afterEach(() => {
  delete g.localStorage;
  delete g.window;
});

const AGORA = 1_790_000_000_000;

describe('marcador da análise em curso', () => {
  it('grava e lê de volta, com status "rodando" por padrão', () => {
    gravarMarcadorAnalise({ progressToken: 'A', startedAt: AGORA, motor: 'claude', estimateSeconds: 300 });
    expect(lerMarcadorAnalise(AGORA + 1000)).toEqual({
      progressToken: 'A', startedAt: AGORA, motor: 'claude', estimateSeconds: 300,
      status: 'rodando', resultadoId: null, erro: null,
    });
    expect(avisos).toBe(1); // a mesma aba precisa saber (o `storage` não dispara nela)
  });

  it('marcador velho (> 20 min) é lixo: some na leitura', () => {
    gravarMarcadorAnalise({ progressToken: 'A', startedAt: AGORA, motor: 'openai' });
    expect(lerMarcadorAnalise(AGORA + IDADE_MAXIMA_MARCADOR_MS + 1)).toBeNull();
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();
  });

  it('marcador ilegível some na leitura', () => {
    armazenado[CHAVE_ANALISE_EM_CURSO] = '{isto não é json';
    expect(lerMarcadorAnalise(AGORA)).toBeNull();
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();
  });

  it('remover só apaga o marcador DA MESMA análise', () => {
    gravarMarcadorAnalise({ progressToken: 'B', startedAt: Date.now(), motor: 'openai' });
    removerMarcadorAnalise('A');
    expect(lerMarcadorAnalise()?.progressToken).toBe('B');
    removerMarcadorAnalise('B');
    expect(lerMarcadorAnalise()).toBeNull();
  });

  it('a órfã anota o desfecho só no marcador dela', () => {
    gravarMarcadorAnalise({ progressToken: 'B', startedAt: Date.now(), motor: 'openai' });
    atualizarMarcadorAnalise('A', { status: 'concluida', resultadoId: 'laudo-A' });
    expect(lerMarcadorAnalise()?.status).toBe('rodando');
    atualizarMarcadorAnalise('B', { status: 'concluida', resultadoId: 'laudo-B' });
    expect(lerMarcadorAnalise()).toMatchObject({ progressToken: 'B', status: 'concluida', resultadoId: 'laudo-B' });
  });

  it('sem storage, nada quebra', () => {
    g.localStorage = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
      removeItem: () => { throw new Error('bloqueado'); },
    };
    expect(() => gravarMarcadorAnalise({ progressToken: 'A', startedAt: AGORA, motor: 'openai' })).not.toThrow();
    expect(lerMarcadorAnalise()).toBeNull();
    expect(() => removerMarcadorAnalise('A')).not.toThrow();
    expect(() => atualizarMarcadorAnalise('A', { status: 'erro' })).not.toThrow();
  });
});
