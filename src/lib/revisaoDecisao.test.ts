import { afterEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('@/lib/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/apiClient')>();
  return { ...real, API_URL: 'http://api.teste', apiFetch: (...a: unknown[]) => apiFetch(...a) };
});

import { SessionExpiredError } from '@/lib/apiClient';
import { pedirRevisaoDaDecisao, TempoEsgotadoError, TEMPO_MAXIMO_REVISAO_MS } from './revisaoDecisao';

const PEDIDO = { tipo: 'alteracao_edital', titulo: 'Errata publicada', conteudo: 'O prazo mudou para 10/10.' };

afterEach(() => apiFetch.mockReset());

describe('pedirRevisaoDaDecisao', () => {
  it('manda um signal próprio — sem ele o apiFetch corta a revisão em 20 s', async () => {
    apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ analysis: { score: 70 } }) });
    const r = await pedirRevisaoDaDecisao('abc123', PEDIDO);
    const [url, opcoes] = apiFetch.mock.calls[0];
    expect(url).toBe('http://api.teste/api/analyses/abc123/review');
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(opcoes.body)).toEqual(PEDIDO);
    expect(TEMPO_MAXIMO_REVISAO_MS).toBeGreaterThan(20_000);
    expect(r).toEqual({ ok: true, status: 200, dados: { analysis: { score: 70 } } });
  });

  it('resposta de erro volta com o corpo, para a tela mostrar o detalhe', async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: 'Análise não encontrada.' }) });
    await expect(pedirRevisaoDaDecisao('x', PEDIDO)).resolves.toEqual({
      ok: false, status: 404, dados: { detail: 'Análise não encontrada.' } });
  });

  it('estourar o teto vira TempoEsgotadoError com uma frase', async () => {
    apiFetch.mockImplementation((_url: string, opcoes: RequestInit) => new Promise((_ok, falha) => {
      opcoes.signal?.addEventListener('abort', () => falha(new DOMException('signal is aborted without reason', 'AbortError')));
    }));
    const erro = await pedirRevisaoDaDecisao('x', PEDIDO, 30).catch((e) => e);
    expect(erro).toBeInstanceOf(TempoEsgotadoError);
    expect(erro.message).toMatch(/foi interrompida/);
  });

  it('sessão expirada segue adiante como está — quem chama já sabe tratá-la', async () => {
    apiFetch.mockRejectedValue(new SessionExpiredError());
    await expect(pedirRevisaoDaDecisao('x', PEDIDO)).rejects.toBeInstanceOf(SessionExpiredError);
  });
});
