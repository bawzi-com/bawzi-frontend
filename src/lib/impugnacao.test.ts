import { afterEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('@/lib/apiClient', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/apiClient')>();
  return { ...real, API_URL: 'http://api.teste', apiFetch: (...a: unknown[]) => apiFetch(...a) };
});

import { pedirPeca, riscosDaPeca, TEMPO_MAXIMO_IMPUGNACAO_MS } from './impugnacao';

const RISCOS = [{ titulo: 'Exigência restritiva', descricao: 'Atestado com quantitativo excessivo.' }];

function resposta(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

afterEach(() => apiFetch.mockReset());

describe('pedirPeca', () => {
  it('manda um signal próprio — sem ele o apiFetch corta o pedido em 20 s', async () => {
    apiFetch.mockResolvedValue(resposta(200, { documento_markdown: '# Peça' }));
    await pedirPeca('impugnacao', 'texto do edital', RISCOS);
    const [url, opcoes] = apiFetch.mock.calls[0];
    expect(url).toBe('http://api.teste/api/gerar-impugnacao');
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
    expect(TEMPO_MAXIMO_IMPUGNACAO_MS).toBeGreaterThan(20_000);
  });

  it('não deixa o cliente escolher o provedor do modelo', async () => {
    apiFetch.mockResolvedValue(resposta(200, { documento_markdown: '# Peça' }));
    await pedirPeca('impugnacao', 'texto do edital', RISCOS);
    const corpo = JSON.parse(apiFetch.mock.calls[0][1].body);
    expect(corpo).toEqual({ edital_texto: 'texto do edital', riscos_identificados: RISCOS, tipo: 'impugnacao' });
  });

  it('devolve a peça', async () => {
    apiFetch.mockResolvedValue(resposta(200, { documento_markdown: '  # Peça de impugnação  ' }));
    await expect(pedirPeca('impugnacao', 'texto', RISCOS)).resolves.toBe('# Peça de impugnação');
  });

  it('estourar o teto vira uma frase, não "signal is aborted without reason"', async () => {
    apiFetch.mockImplementation((_url: string, opcoes: RequestInit) => new Promise((_ok, falha) => {
      opcoes.signal?.addEventListener('abort', () => falha(new DOMException('signal is aborted without reason', 'AbortError')));
    }));
    await expect(pedirPeca('impugnacao', 'texto', RISCOS, 30)).rejects.toThrow(/foi interrompida/);
  });

  it('o limite diário chega com a mensagem do servidor', async () => {
    apiFetch.mockResolvedValue(resposta(429, { detail: {
      codigo: 'LIMITE_DIARIO_IMPUGNACAO', titulo: 'Limite diário de impugnações atingido',
      mensagem: 'Sua conta já gerou as 2 peças de impugnação de hoje. O contador zera amanhã.' } }));
    await expect(pedirPeca('impugnacao', 'texto', RISCOS)).rejects.toThrow('O contador zera amanhã');
  });

  it('peça vazia é erro, não um modal em branco', async () => {
    apiFetch.mockResolvedValue(resposta(200, { documento_markdown: '   ' }));
    await expect(pedirPeca('impugnacao', 'texto', RISCOS)).rejects.toThrow('A peça voltou vazia');
  });
});

describe('pedido de esclarecimento (25/09/2026)', () => {
  it('viaja com o tipo, para o servidor redigir a peça certa', async () => {
    apiFetch.mockResolvedValue(resposta(200, { documento_markdown: '# Pedido' }));
    await pedirPeca('esclarecimento', 'texto do edital', RISCOS);
    expect(JSON.parse(apiFetch.mock.calls[0][1].body).tipo).toBe('esclarecimento');
  });

  it('a falha fala do documento que foi pedido', async () => {
    apiFetch.mockResolvedValue(resposta(500, null));
    await expect(pedirPeca('esclarecimento', 'texto', RISCOS)).rejects.toThrow(
      'Não foi possível gerar o pedido de esclarecimento.');
  });
});

describe('riscosDaPeca', () => {
  const FLAGS = [
    { tipo: 'exigencia_restritiva', tipo_label: 'Exigência restritiva', descricao: 'Atestado excessivo.',
      trecho: 'mínimo de 50%', acao_sugerida: 'impugnar' },
    { tipo: 'ambiguidade', descricao: 'Lance pelo total do item diverge do detalhamento.',
      trecho: 'O lance deverá ser ofertado pelo valor total', acao_sugerida: 'esclarecer' },
    { tipo: 'prazo', descricao: 'Prazo apertado.', acao_sugerida: 'monitorar' },
  ];

  it('cada peça leva só as cláusulas da sua ação', () => {
    expect(riscosDaPeca(FLAGS, 'impugnacao').map((r) => r.titulo)).toEqual(['Exigência restritiva']);
    expect(riscosDaPeca(FLAGS, 'esclarecimento')).toEqual([{
      titulo: 'ambiguidade',
      descricao: 'Lance pelo total do item diverge do detalhamento. '
        + 'Trecho do edital: "O lance deverá ser ofertado pelo valor total"',
    }]);
  });

  it('sem cláusula da ação, lista vazia', () => {
    expect(riscosDaPeca([FLAGS[2]], 'esclarecimento')).toEqual([]);
  });
});

