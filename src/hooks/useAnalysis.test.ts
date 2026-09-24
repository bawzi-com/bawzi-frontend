/**
 * useAnalysis — o ciclo de vida da análise quando a TELA morre antes dela.
 *
 * ⚠️ POR QUE UM "MINI REACT" AQUI. O projeto não tem jsdom nem Testing
 * Library, e o que precisa de prova é justamente o ciclo de vida: montar,
 * desmontar no meio de uma requisição, remontar, efeitos rodando duas vezes
 * (StrictMode). O `MiniReact` abaixo implementa só os quatro hooks que o
 * useAnalysis usa (useState, useRef, useCallback, useEffect), com a mesma
 * semântica que importa: setState em tela desmontada é ignorado, efeitos rodam
 * depois do render e limpam antes de rodar de novo, closures são as do render
 * em que nasceram. O código testado é o hook REAL.
 *
 * O que estes casos seguram (ver "Retomada" e o `finally` em useAnalysis.ts):
 *   1. Requisição órfã (troca de rota) anota o desfecho no marcador, e a
 *      próxima montagem abre o laudo — antes ela apagava o marcador e o laudo
 *      sumia da tela.
 *   2. Análise ainda rodando é retomada no overlay, na etapa real.
 *   3. Uma análise por vez.
 *   4. 409 EDITAL_ENCERRADO vira aviso, e "Analisar mesmo assim" reenvia.
 *   5. Sem sinal do servidor, a retomada desiste com mensagem honesta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { MiniReact } = vi.hoisted(() => {
  type Slot = Record<string, unknown> & { v?: unknown };
  class MiniReact {
    static atual: MiniReact | null = null;
    slots: Slot[] = [];
    i = 0;
    pendentes: { i: number; fn: () => unknown; deps?: unknown[] }[] = [];
    sujo = false;
    vivo = true;
    saida: any;
    constructor(private componente: () => any) {}

    private static iguais(a?: unknown[], b?: unknown[]) {
      return !!a && !!b && a.length === b.length && a.every((x, k) => Object.is(x, b[k]));
    }
    useState(inicial: unknown) {
      const i = this.i++;
      if (!this.slots[i]) {
        const slot: Slot = { v: typeof inicial === 'function' ? (inicial as () => unknown)() : inicial };
        slot.set = (nv: unknown) => {
          if (!this.vivo) return; // tela desmontada: ignorado, como no React
          const prox = typeof nv === 'function' ? (nv as (p: unknown) => unknown)(slot.v) : nv;
          if (!Object.is(prox, slot.v)) { slot.v = prox; this.sujo = true; }
        };
        this.slots[i] = slot;
      }
      return [this.slots[i].v, this.slots[i].set];
    }
    useRef(inicial: unknown) {
      const i = this.i++;
      if (!this.slots[i]) this.slots[i] = { current: inicial };
      return this.slots[i];
    }
    useCallback(fn: unknown, deps: unknown[]) {
      const i = this.i++;
      const s = this.slots[i];
      if (s && MiniReact.iguais(s.deps as unknown[], deps)) return s.fn;
      this.slots[i] = { fn, deps };
      return fn;
    }
    useEffect(fn: () => unknown, deps?: unknown[]) {
      const i = this.i++;
      const s = this.slots[i];
      if (!s || !deps || !MiniReact.iguais(s.deps as unknown[], deps)) this.pendentes.push({ i, fn, deps });
      if (!s) this.slots[i] = { efeito: true };
    }
    renderizar() {
      let voltas = 0;
      do {
        this.sujo = false;
        this.i = 0;
        MiniReact.atual = this;
        try { this.saida = this.componente(); } finally { MiniReact.atual = null; }
        const pend = this.pendentes;
        this.pendentes = [];
        for (const e of pend) {
          const s = this.slots[e.i];
          if (typeof s.limpar === 'function') (s.limpar as () => void)();
          const r = e.fn();
          s.limpar = typeof r === 'function' ? r : undefined;
          s.deps = e.deps;
          s.fn = e.fn;
        }
        if (++voltas > 100) throw new Error('render em laço');
      } while (this.sujo && this.vivo);
      return this.saida;
    }
    /** StrictMode (dev): todos os efeitos limpam e rodam de novo, uma vez. */
    strictMode() {
      const efeitos = this.slots.filter((s) => s?.efeito);
      for (const s of efeitos) if (typeof s.limpar === 'function') (s.limpar as () => void)();
      for (const s of efeitos) {
        const r = (s.fn as () => unknown)();
        s.limpar = typeof r === 'function' ? r : undefined;
      }
      if (this.sujo) this.renderizar();
    }
    desmontar() {
      this.vivo = false;
      for (const s of this.slots) if (s?.efeito && typeof s.limpar === 'function') (s.limpar as () => void)();
    }
  }
  return { MiniReact };
});

vi.mock('react', () => ({
  useState: (i: unknown) => MiniReact.atual!.useState(i),
  useRef: (i: unknown) => MiniReact.atual!.useRef(i),
  useCallback: (f: unknown, d: unknown[]) => MiniReact.atual!.useCallback(f, d),
  useEffect: (f: () => unknown, d?: unknown[]) => MiniReact.atual!.useEffect(f, d),
}));

const api = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({
  apiFetch: api.apiFetch,
  ensureSessionFor: async () => null,
  mensagemDeErro: (d: unknown, padrao: string) =>
    (d && typeof d === 'object' && 'mensagem' in d ? String((d as { mensagem: unknown }).mensagem) : padrao),
}));

import { useAnalysis } from './useAnalysis';
import { CHAVE_ANALISE_EM_CURSO, gravarMarcadorAnalise, lerMarcadorAnalise } from '@/lib/analiseEmCurso';

// ── Ambiente mínimo do navegador ─────────────────────────────────────────────
const g = globalThis as unknown as Record<string, unknown>;
let armazenado: Record<string, string> = {};
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-24T15:00:00Z'));
  armazenado = {};
  g.localStorage = {
    getItem: (k: string) => (k in armazenado ? armazenado[k] : null),
    setItem: (k: string, v: string) => { armazenado[k] = String(v); },
    removeItem: (k: string) => { delete armazenado[k]; },
  };
  g.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  g.window = { dispatchEvent: () => true, scrollTo: () => {}, scrollY: 0 };
  g.document = { getElementById: () => null };
  g.fetch = fetchMock;
  fetchMock.mockReset();
  api.apiFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  for (const k of ['localStorage', 'sessionStorage', 'window', 'document', 'fetch']) delete g[k];
});

const resp = (status: number, corpo: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => corpo });

type Entrada = Parameters<typeof useAnalysis>[0];
function montar(extra: Partial<Entrada> = {}) {
  const entrada: Entrada = {
    token: 'T', text: 'Pregão Eletrônico nº 1/2026 — edital de teste.', files: [], uf: 'MG',
    forceExact: false, pncpData: null, activeCnpj: '', userTier: 3, isOverLimit: false,
    apiUrl: 'https://api.teste', onUpgradeNeeded: vi.fn(), onUpsellNeeded: vi.fn(),
    onFreeTrialUsed: vi.fn(), ...extra,
  };
  const tela = new MiniReact(() => useAnalysis(entrada));
  tela.renderizar();
  return tela;
}

async function passar(tela: InstanceType<typeof MiniReact>, ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  if (tela.vivo) tela.renderizar();
}

const chamadasAnalyze = () => api.apiFetch.mock.calls.filter(([u]) => String(u).endsWith('/api/analyze'));

// ─────────────────────────────────────────────────────────────────────────────

describe('análise que sobrevive à tela', () => {
  it('órfã (troca de rota) anota o desfecho, e a próxima montagem abre o laudo', async () => {
    let responder!: (r: unknown) => void;
    api.apiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/analyze')) return new Promise((r) => { responder = r; });
      if (url.endsWith('/api/analyses/L1')) return Promise.resolve(resp(200, { analysis: { id: 'L1', score: 81 } }));
      throw new Error(`inesperado: ${url}`);
    });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5 }));

    const tela1 = montar();
    const pedido = tela1.saida.handleAnalyze('claude');
    await passar(tela1);
    expect(tela1.saida.isAnalyzing).toBe(true);
    expect(lerMarcadorAnalise()?.status).toBe('rodando');

    tela1.desmontar();                                    // Planos, Documentação…
    responder(resp(200, { id: 'L1', score: 81 }));        // o servidor terminou
    await pedido;
    expect(lerMarcadorAnalise()).toMatchObject({ status: 'concluida', resultadoId: 'L1' });

    const tela2 = montar();                               // voltou ao workspace
    await passar(tela2);
    expect(tela2.saida.result).toMatchObject({ id: 'L1', score: 81 });
    expect(tela2.saida.isAnalyzing).toBe(false);
    expect(tela2.saida.analysisId).toBe('L1');
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();
  });

  it('ainda rodando: retoma no overlay, na etapa real, e abre o laudo ao concluir', async () => {
    gravarMarcadorAnalise({
      progressToken: 'P2', startedAt: Date.now() - 30_000, motor: 'claude', estimateSeconds: 300, status: 'rodando',
    });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 2, total: 5 }));
    api.apiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/analyses/L2')) return Promise.resolve(resp(200, { analysis: { id: 'L2', score: 64 } }));
      throw new Error(`inesperado: ${url}`);
    });

    const tela = montar();
    expect(tela.saida.isAnalyzing).toBe(true);
    expect(tela.saida.analiseReanexada).toBe(true);
    expect(tela.saida.loadingEstimateSeconds).toBe(300);  // o ETA do marcador, não o recalculado
    await passar(tela);
    expect(tela.saida.progressoAoVivo).toBe(true);
    await passar(tela, 1000);
    expect(tela.saida.loadingStep).toBe(2);              // a etapa que o servidor disse

    fetchMock.mockResolvedValue(resp(200, { status: 'ok', done: true, resultado_id: 'L2', etapa: 5, total: 5 }));
    await passar(tela, 3000);
    expect(tela.saida.result).toMatchObject({ id: 'L2' });
    expect(tela.saida.isAnalyzing).toBe(false);
    expect(tela.saida.analiseReanexada).toBe(false);
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();
  });

  it('StrictMode (efeitos em dobro) não deixa a retomada sem polling', async () => {
    gravarMarcadorAnalise({ progressToken: 'P3', startedAt: Date.now(), motor: 'openai', status: 'rodando' });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5 }));
    const tela = montar();
    tela.strictMode();
    await passar(tela);
    const antes = fetchMock.mock.calls.length;
    await passar(tela, 3000);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(antes);
    expect(tela.saida.isAnalyzing).toBe(true);
  });

  it('uma análise por vez: com uma retomada rodando, não dispara outra', async () => {
    gravarMarcadorAnalise({ progressToken: 'P4', startedAt: Date.now(), motor: 'openai', status: 'rodando' });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5 }));
    const tela = montar();
    await tela.saida.handleAnalyze('openai');
    await passar(tela);
    expect(chamadasAnalyze()).toHaveLength(0);
    // A guarda da PRÓPRIA tela, não a do marcador de outra aba.
    expect(tela.saida.error).toMatch(/Já existe uma análise em andamento\. Aguarde/);
    expect(tela.saida.error).not.toMatch(/outra aba/);
  });

  it('clique duplo: a segunda chamada não dispara outra análise', async () => {
    // Servidor ainda sem progresso registrado ("desconhecido"): a guarda do
    // marcador deixaria passar — quem segura é a da tela.
    fetchMock.mockResolvedValue(resp(200, { status: 'desconhecido' }));
    api.apiFetch.mockImplementation(() => new Promise(() => {}));
    const tela = montar();
    void tela.saida.handleAnalyze('openai');
    await passar(tela);
    await tela.saida.handleAnalyze('openai');
    await passar(tela);
    expect(chamadasAnalyze()).toHaveLength(1);
    expect(tela.saida.error).toMatch(/Já existe uma análise em andamento\. Aguarde/);
  });

  it('marcador de outra aba que o servidor diz estar rodando também barra', async () => {
    const tela = montar();                                // montou antes do marcador existir
    gravarMarcadorAnalise({ progressToken: 'OUTRA', startedAt: Date.now(), motor: 'openai', status: 'rodando' });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5 }));
    await tela.saida.handleAnalyze('openai');
    await passar(tela);
    expect(chamadasAnalyze()).toHaveLength(0);
    expect(tela.saida.error).toMatch(/outra aba/);
  });

  it('marcador órfão (servidor não conhece) não trava ninguém', async () => {
    const tela = montar();
    gravarMarcadorAnalise({ progressToken: 'MORTO', startedAt: Date.now(), motor: 'openai', status: 'rodando' });
    fetchMock.mockResolvedValue(resp(200, { status: 'desconhecido' }));
    api.apiFetch.mockResolvedValue(resp(200, { id: 'L5', score: 70 }));
    await tela.saida.handleAnalyze('openai');
    await passar(tela);
    expect(chamadasAnalyze()).toHaveLength(1);
    expect(tela.saida.result).toMatchObject({ id: 'L5' });
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined(); // entregue a tela viva: sai
  });

  it('409 EDITAL_ENCERRADO vira aviso; "Analisar mesmo assim" reenvia com a flag', async () => {
    api.apiFetch.mockResolvedValueOnce(resp(409, { detail: {
      codigo: 'EDITAL_ENCERRADO', titulo: 'Este edital parece encerrado', mensagem: 'Pelo texto…',
      fonte: 'texto', trecho: 'Sessão pública: 10/03/2025', pode_prosseguir: true, data_fim: '2025-03-10',
    } }));
    const tela = montar();
    await tela.saida.handleAnalyze('claude');
    await passar(tela);
    expect(tela.saida.editalEncerrado).toMatchObject({
      podeProsseguir: true, fonte: 'texto', motor: 'claude', trecho: 'Sessão pública: 10/03/2025',
    });
    expect(tela.saida.isAnalyzing).toBe(false);
    expect(tela.saida.error).toBeNull();                  // não é erro: é aviso próprio
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();

    api.apiFetch.mockResolvedValueOnce(resp(200, { id: 'L6', score: 50 }));
    await tela.saida.handleAnalyze('claude', { ignorarPrazoEncerrado: true });
    await passar(tela);
    const corpo = chamadasAnalyze()[1][1].body as FormData;
    expect(corpo.get('ignorar_prazo_encerrado')).toBe('true');
    expect(tela.saida.editalEncerrado).toBeNull();
    expect(tela.saida.result).toMatchObject({ id: 'L6' });
  });

  it('sem sinal do servidor depois de ter visto a análise rodar: desiste com mensagem honesta', async () => {
    gravarMarcadorAnalise({ progressToken: 'P7', startedAt: Date.now(), motor: 'openai', status: 'rodando' });
    fetchMock.mockResolvedValueOnce(resp(200, { status: 'ok', etapa: 1, total: 5 }));
    fetchMock.mockResolvedValue(resp(200, { status: 'desconhecido' }));
    const tela = montar();
    await passar(tela);
    for (let k = 0; k < 5; k++) await passar(tela, 3000);
    expect(tela.saida.isAnalyzing).toBe(false);
    expect(tela.saida.error).toMatch(/Perdemos o rastro/);
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();
  });

  it('cancelar uma retomada pede ao servidor e para quando ele confirma', async () => {
    gravarMarcadorAnalise({ progressToken: 'P8', startedAt: Date.now(), motor: 'openai', status: 'rodando' });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5 }));
    api.apiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/analyze/cancel/P8')) return Promise.resolve(resp(200, { status: 'cancelando' }));
      throw new Error(`inesperado: ${url}`);
    });
    const tela = montar();
    await passar(tela);
    const pedido = tela.saida.handleCancelAnalysis();
    await passar(tela);
    await pedido;
    tela.renderizar();
    expect(tela.saida.cancelando).toBe(true);            // esperando o servidor parar
    expect(tela.saida.isAnalyzing).toBe(true);

    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5, cancelada: true }));
    await passar(tela, 3000);
    expect(tela.saida.isAnalyzing).toBe(false);
    expect(tela.saida.cancelando).toBe(false);
    expect(tela.saida.successMsg).toMatch(/Nada foi cobrado/);
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();
  });

  it('cancelar a análise viva: o veredito vem da própria requisição (409)', async () => {
    let responder!: (r: unknown) => void;
    let tokenEnviado = '';
    api.apiFetch.mockImplementation((url: string, init?: { body?: FormData }) => {
      if (url.endsWith('/api/analyze')) {
        tokenEnviado = String(init?.body?.get('progress_token') ?? '');
        return new Promise((r) => { responder = r; });
      }
      if (url.includes('/api/analyze/cancel/')) return Promise.resolve(resp(200, { status: 'cancelando' }));
      throw new Error(`inesperado: ${url}`);
    });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5 }));
    const tela = montar();
    const pedido = tela.saida.handleAnalyze('claude');
    await passar(tela);
    await tela.saida.handleCancelAnalysis();
    tela.renderizar();
    const chamadaCancelar = api.apiFetch.mock.calls.find(([u]) => String(u).includes('/api/analyze/cancel/'));
    expect(chamadaCancelar?.[0]).toBe(`https://api.teste/api/analyze/cancel/${tokenEnviado}`);
    expect(chamadaCancelar?.[1]).toMatchObject({ method: 'POST' });
    expect(tela.saida.cancelando).toBe(true);
    expect(tela.saida.isAnalyzing).toBe(true);           // ainda não parou: o servidor decide

    responder(resp(409, { detail: {
      codigo: 'ANALISE_CANCELADA', mensagem: 'Análise cancelada. Nada foi cobrado.', cobrado: false,
    } }));
    await pedido;
    await passar(tela);
    expect(tela.saida.isAnalyzing).toBe(false);
    expect(tela.saida.cancelando).toBe(false);
    expect(tela.saida.error).toBeNull();
    expect(tela.saida.successMsg).toBe('Análise cancelada. Nada foi cobrado.');
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();
  });

  it('cancelamento que perde a corrida: o laudo chega e a tela diz que terminou antes', async () => {
    let responder!: (r: unknown) => void;
    api.apiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/analyze')) return new Promise((r) => { responder = r; });
      if (url.includes('/api/analyze/cancel/')) return Promise.resolve(resp(200, { status: 'cancelando' }));
      throw new Error(`inesperado: ${url}`);
    });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 4, total: 5 }));
    const tela = montar();
    const pedido = tela.saida.handleAnalyze('openai');
    await passar(tela);
    await tela.saida.handleCancelAnalysis();
    responder(resp(200, { id: 'L9', score: 77 }));      // gravado antes de o pedido chegar
    await pedido;
    await passar(tela);
    expect(tela.saida.result).toMatchObject({ id: 'L9' });
    expect(tela.saida.successMsg).toMatch(/terminou antes/);
    expect(tela.saida.cancelando).toBe(false);
  });

  it('pedido de cancelar que não chega ao servidor não finge que parou', async () => {
    api.apiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/analyze')) return new Promise(() => {});
      if (url.includes('/api/analyze/cancel/')) return Promise.reject(new TypeError('Failed to fetch'));
      throw new Error(`inesperado: ${url}`);
    });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5 }));
    const tela = montar();
    void tela.saida.handleAnalyze('openai');
    await passar(tela);
    await tela.saida.handleCancelAnalysis();
    tela.renderizar();
    expect(tela.saida.isAnalyzing).toBe(true);
    expect(tela.saida.cancelando).toBe(false);
    expect(tela.saida.error).toMatch(/a análise continua/);
  });

  it('órfã cancelada (saiu da tela depois de cancelar) não deixa marcador para trás', async () => {
    let responder!: (r: unknown) => void;
    api.apiFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/analyze')) return new Promise((r) => { responder = r; });
      if (url.includes('/api/analyze/cancel/')) return Promise.resolve(resp(200, { status: 'cancelando' }));
      throw new Error(`inesperado: ${url}`);
    });
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5 }));
    const tela = montar();
    const pedido = tela.saida.handleAnalyze('openai');
    await passar(tela);
    await tela.saida.handleCancelAnalysis();
    tela.desmontar();
    responder(resp(409, { detail: { codigo: 'ANALISE_CANCELADA', mensagem: 'Análise cancelada. Nada foi cobrado.' } }));
    await pedido;
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();
  });

  it('erro com a tela desmontada vira desfecho "erro", mostrado na volta', async () => {
    let falhar!: (e: unknown) => void;
    api.apiFetch.mockImplementation(() => new Promise((_, rej) => { falhar = rej; }));
    fetchMock.mockResolvedValue(resp(200, { status: 'ok', etapa: 1, total: 5 }));
    const tela1 = montar();
    const pedido = tela1.saida.handleAnalyze('openai');
    await passar(tela1);
    tela1.desmontar();
    falhar(new Error('500 Internal Server Error'));
    await pedido;
    expect(lerMarcadorAnalise()?.status).toBe('erro');

    const tela2 = montar();
    await passar(tela2);
    expect(tela2.saida.isAnalyzing).toBe(false);
    expect(tela2.saida.error).toMatch(/sobrecarregado/);
    expect(armazenado[CHAVE_ANALISE_EM_CURSO]).toBeUndefined();
  });
});
