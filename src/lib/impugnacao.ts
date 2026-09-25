/**
 * Pedido das peças do art. 164 ao backend (`POST /api/gerar-impugnacao`): a
 * impugnação e, desde 25/09/2026, o pedido de esclarecimento.
 *
 * ⚠️ O CORTE DE 20 SEGUNDOS (25/09/2026). `apiFetch` aborta qualquer pedido
 * em 20 s quando quem chama não passa um `signal` próprio — o padrão existe
 * para aba esquecida aberta não pendurar a tela. A peça é redigida pelo modelo
 * sênior e sai inteira de uma vez: leva bem mais que isso. Resultado relatado
 * pelo dono: "Redigindo a peça…" e o botão voltava, sem peça. Pior: o servidor
 * não percebe o abandono (medido em 24/09, ver `services/cancelamento.py`),
 * terminava a redação e descontava a cota diária — duas por dia no plano
 * gratuito — por um documento que ninguém recebia.
 *
 * Mesmo remédio que o chat (`ChatWidget`) já usava: um `AbortController`
 * próprio, com teto de tempo compatível com a tarefa.
 */
import { API_URL, apiFetch, mensagemDeErro } from '@/lib/apiClient';

/** Teto do pedido. Folgado de propósito: abortar cedo é pagar a peça e
 *  jogá-la fora, e o servidor não para quando o navegador desiste. */
export const TEMPO_MAXIMO_IMPUGNACAO_MS = 240_000;

export interface RiscoParaImpugnar {
  titulo: string;
  descricao: string;
}

/** "impugnacao" pede que o órgão MUDE a cláusula; "esclarecimento" pede que a
 *  EXPLIQUE. O laudo marca cada cláusula com uma das duas ações
 *  (`acao_sugerida`). Até 25/09/2026 só existia a impugnação, e um laudo só com
 *  pontos a esclarecer ficava sem botão, sem aviso. */
export type TipoDePeca = 'impugnacao' | 'esclarecimento';

export const TITULO_DA_PECA: Record<TipoDePeca, string> = {
  impugnacao: 'Peça de Impugnação',
  esclarecimento: 'Pedido de Esclarecimento',
};

const FALHA_DA_PECA: Record<TipoDePeca, string> = {
  impugnacao: 'Não foi possível gerar a peça de impugnação.',
  esclarecimento: 'Não foi possível gerar o pedido de esclarecimento.',
};

/** O pedaço de `red_flags` que a peça usa. */
export interface ClausulaMarcada {
  tipo?: string;
  tipo_label?: string;
  descricao?: string;
  trecho?: string;
  acao_sugerida?: string;
}

/** As cláusulas de UMA ação, no formato que a rota espera. Impugnação leva só
 *  as marcadas para impugnar; esclarecimento, só as marcadas para esclarecer. */
export function riscosDaPeca(flags: ReadonlyArray<ClausulaMarcada>, tipo: TipoDePeca): RiscoParaImpugnar[] {
  const acao = tipo === 'impugnacao' ? 'impugnar' : 'esclarecer';
  return flags
    .filter((f) => f.acao_sugerida === acao)
    .map((f) => ({
      titulo: f.tipo_label || f.tipo || (tipo === 'impugnacao' ? 'Cláusula restritiva' : 'Ponto a esclarecer'),
      descricao: [f.descricao, f.trecho ? `Trecho do edital: "${f.trecho}"` : '']
        .filter(Boolean)
        .join(' '),
    }));
}

export async function pedirPeca(
  tipo: TipoDePeca,
  editalTexto: string,
  riscos: RiscoParaImpugnar[],
  tempoMaximoMs: number = TEMPO_MAXIMO_IMPUGNACAO_MS,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), tempoMaximoMs);
  try {
    const res = await apiFetch(`${API_URL}/api/gerar-impugnacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // ⚠️ `provedor` NÃO viaja daqui. O corpo do pedido aceita esse campo, e
      // deixar o cliente escolher o provedor de um modelo caro é o defeito
      // que o teto diário existe para conter. Sem o campo, o backend usa o
      // seu default.
      body: JSON.stringify({ edital_texto: editalTexto, riscos_identificados: riscos, tipo }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const erro = await res.json().catch(() => null);
      // O 429 da cota diária traz `{codigo, titulo, mensagem, uso_atual,
      // limite}` — `mensagemDeErro` já lê `mensagem` de dentro do objeto, e é
      // ela que diz "o contador zera amanhã", que é o que a pessoa precisa
      // saber.
      throw new Error(mensagemDeErro(erro?.detail, FALHA_DA_PECA[tipo]));
    }
    const dados = await res.json().catch(() => null);
    const documento = String(dados?.documento_markdown || '').trim();
    if (!documento) throw new Error('A peça voltou vazia. Tente novamente em instantes.');
    return documento;
  } catch (err) {
    // Sem isto, a tela mostraria "signal is aborted without reason".
    if (err instanceof DOMException && err.name === 'AbortError') {
      const minutos = Math.max(1, Math.round(tempoMaximoMs / 60_000));
      throw new Error(
        `A redação passou de ${minutos} minuto${minutos > 1 ? 's' : ''} e foi interrompida. Tente de novo em instantes.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
