/**
 * Meus contratos: o que a tela calcula sem tocar na rede (25/09/2026).
 *
 * Três coisas moram aqui para serem testadas sem navegador: o sinal de
 * prorrogação lido do lado de quem TEM o contrato, a faixa mensal de
 * vencimentos e os filtros que os atalhos mandam para o Pipeline.
 */
import type { CampoDoFiltro } from './renovacoes';
import { formatarDocumento, type SinalDeProrrogacao } from './renovacoes';

// ─────────────────────────────────────────────────────────────────────────
// Prorrogação, do lado do fornecedor
// ─────────────────────────────────────────────────────────────────────────
// No Pipeline, "volta a licitação" é oportunidade e fica verde. Aqui é o
// contrário: quem tem o contrato precisa se preparar para a disputa. O texto
// da lei (`sinal.texto`, do servidor) vai no title; o cartão mostra a decisão.

export interface EstiloDaProrrogacaoPropria {
  rotulo: string;
  tom: 'vermelho' | 'ambar' | 'verde';
  texto: string;
}

export function estiloDaProrrogacaoPropria(
  sinal: SinalDeProrrogacao | null | undefined,
): EstiloDaProrrogacaoPropria | null {
  if (!sinal || !sinal.texto) return null;
  const desde = sinal.resumo || '';
  switch (sinal.situacao) {
    case 'volta_a_licitacao':
      return { rotulo: 'Teto legal atingido', tom: 'vermelho',
        texto: 'Não cabe mais prorrogação: a continuidade passa por nova licitação.' };
    case 'no_limite':
      return { rotulo: 'No limite dos 60 meses', tom: 'ambar',
        texto: 'Só cabe a prorrogação excepcional de até 12 meses (Lei 8.666). Vale abrir a conversa agora.' };
    case 'incerto':
      return { rotulo: 'Prorrogação incerta', tom: 'ambar',
        texto: 'Passou de 5 anos: pela Lei 8.666 chegou ao limite; pela 14.133 pode ir a 10 anos. Confira em qual lei o contrato foi firmado.' };
    case 'pode_prorrogar':
      return { rotulo: 'Cabe prorrogação', tom: 'verde', texto: desde || 'Ainda dentro do prazo da lei.' };
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// A faixa mensal de vencimentos
// ─────────────────────────────────────────────────────────────────────────

export interface ContratoParaFaixa {
  data_vigencia_fim?: string | null;
  valor: number;
  situacao: string;
}

export interface MesDaFaixa {
  /** "2026-10" */
  chave: string;
  /** "out/26" */
  rotulo: string;
  valor: number;
  quantidade: number;
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-10" da data ISO, ou null. */
export function mesDaData(iso?: string | null): string | null {
  if (!iso || iso.length < 7) return null;
  const m = iso.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
}

export function rotuloDoMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number);
  return `${MESES_CURTOS[(mes || 1) - 1]}/${String(ano).slice(2)}`;
}

/** Os próximos `meses` a partir de `hoje`, com quanto vence em cada um.
 *
 *  Só contrato vivo entra (o encerrado já venceu; o sem prazo não tem mês).
 *  O mês corrente é o primeiro: um contrato que vence daqui a 10 dias está
 *  nele. Um contrato de valor zero conta na quantidade e não na soma. */
export function faixaDeVencimentos(
  contratos: ContratoParaFaixa[],
  hoje: Date = new Date(),
  meses = 12,
): MesDaFaixa[] {
  const faixa: MesDaFaixa[] = [];
  const indice = new Map<string, MesDaFaixa>();
  for (let i = 0; i < meses; i++) {
    const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + i, 1));
    const chave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const mes = { chave, rotulo: rotuloDoMes(chave), valor: 0, quantidade: 0 };
    faixa.push(mes);
    indice.set(chave, mes);
  }
  for (const c of contratos) {
    if (!['vigente', 'renovar', 'vencendo'].includes(c.situacao)) continue;
    const mes = indice.get(mesDaData(c.data_vigencia_fim) || '');
    if (!mes) continue;
    mes.quantidade += 1;
    mes.valor += c.valor > 0 ? c.valor : 0;
  }
  return faixa;
}

/** "R$ 1,2 mi", "R$ 850 mil", "R$ 900" — para caber em cima de uma barra. */
export function valorCurto(v: number): string {
  if (!v || v <= 0) return '—';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`;
  return `R$ ${Math.round(v)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Atalhos para o Pipeline de renovações
// ─────────────────────────────────────────────────────────────────────────

export interface FiltroParaPipeline {
  campo: CampoDoFiltro;
  /** O que vai no campo do Pipeline: o CNPJ com máscara, ou o nome. */
  valor: string;
  /** O nome de quem foi clicado, para o chip. */
  nome: string;
}

/** O filtro que o atalho manda: pelo CNPJ quando existe (nome se repete
 *  entre órgãos e entre fornecedores), senão pelo nome. Sem nenhum dos
 *  dois, não há atalho. */
export function filtroParaPipeline(
  campo: CampoDoFiltro,
  nome: string | null | undefined,
  cnpj: string | null | undefined,
): FiltroParaPipeline | null {
  const d = String(cnpj ?? '').replace(/\D/g, '');
  const nomeLimpo = String(nome ?? '').trim();
  if (d.length === 14 && /[1-9]/.test(d)) return { campo, valor: formatarDocumento(d), nome: nomeLimpo };
  if (nomeLimpo.length >= 2) return { campo, valor: nomeLimpo, nome: nomeLimpo };
  return null;
}
