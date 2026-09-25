/**
 * Pedido de revisão da decisão (`POST /api/analyses/{id}/review`).
 *
 * ⚠️ O MESMO CORTE DE 20 SEGUNDOS DA IMPUGNAÇÃO (25/09/2026). A revisão roda o
 * motor de análise de novo (`AILlmRouter.analyze`) com a informação nova:
 * leva minutos, não segundos. Sem `signal` próprio, o `apiFetch` abortava o
 * pedido em 20 s; a tela dizia "Erro de conexão ao revisar a decisão" enquanto
 * o servidor, que não percebe o abandono, seguia reprocessando o laudo.
 * Mesmo remédio de `lib/impugnacao.ts`.
 */
import { API_URL, apiFetch } from '@/lib/apiClient';

/** Folgado de propósito: a revisão é uma análise inteira de novo. */
export const TEMPO_MAXIMO_REVISAO_MS = 600_000;

export class TempoEsgotadoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'TempoEsgotadoError';
  }
}

export interface PedidoDeRevisao {
  tipo: string;
  titulo: string;
  conteudo: string;
}

export interface RespostaDaRevisao {
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: any;
}

export async function pedirRevisaoDaDecisao(
  analysisId: string,
  pedido: PedidoDeRevisao,
  tempoMaximoMs: number = TEMPO_MAXIMO_REVISAO_MS,
): Promise<RespostaDaRevisao> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), tempoMaximoMs);
  try {
    const res = await apiFetch(`${API_URL}/api/analyses/${analysisId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido),
      signal: controller.signal,
    });
    const dados = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, dados };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const minutos = Math.max(1, Math.round(tempoMaximoMs / 60_000));
      throw new TempoEsgotadoError(
        `A revisão passou de ${minutos} minuto${minutos > 1 ? 's' : ''} e foi interrompida. Tente de novo em instantes.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
