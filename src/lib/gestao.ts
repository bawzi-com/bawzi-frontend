/**
 * Gestão de execução: o que as abas calculam sem tocar na rede (25/09/2026).
 *
 * A tela era só o quadro de colunas. As abas novas — Agenda, Tabela,
 * Desempenho e Responsáveis — leem os mesmos editais em acompanhamento e
 * respondem perguntas que o quadro não responde: o que vence quando, tudo
 * numa linha só, quanto se ganhou e onde, e quem está com o quê. Tudo aqui é
 * função pura, para ser testado sem navegador.
 */
import type { SavedAnalysis } from '@/lib/types';
import {
  decisionQueueOrder,
  decisionQueueStages,
  getNextDecisionQueueStage,
  inferDecisionVerdict,
  scoreOuNulo,
  type DecisionCockpitStatusMap,
  type DecisionQueueKey,
  type DecisionQueueTask,
} from '@/lib/decisionQueue';

export type AbaDaGestao = 'quadro' | 'agenda' | 'tabela' | 'desempenho' | 'responsaveis';

export const ABAS_DA_GESTAO: Array<{ chave: AbaDaGestao; rotulo: string; descricao: string }> = [
  { chave: 'quadro', rotulo: 'Quadro', descricao: 'Os editais por etapa' },
  { chave: 'agenda', rotulo: 'Agenda', descricao: 'Os prazos, dia a dia' },
  { chave: 'tabela', rotulo: 'Tabela', descricao: 'Uma linha por edital' },
  { chave: 'desempenho', rotulo: 'Desempenho', descricao: 'Funil, valores e vitórias' },
  { chave: 'responsaveis', rotulo: 'Responsáveis', descricao: 'Quem está com o quê' },
];

export const ETAPAS_FINAIS: DecisionQueueKey[] = ['won', 'lost', 'abandoned', 'executed'];

/** O que cada aba precisa saber de um edital — é o modelo do cartão do
 *  quadro, sem o que é só do quadro. */
export interface CartaoDaGestao {
  analysis: SavedAnalysis;
  tasks: DecisionQueueTask[];
  statusMap: DecisionCockpitStatusMap;
  done: number;
  total: number;
  nextTask: DecisionQueueTask | null;
  stage: DecisionQueueKey;
}

// ─────────────────────────────────────────────────────────────────────────
// Leitura de campos soltos do laudo
// ─────────────────────────────────────────────────────────────────────────

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

/** "25/09/2026", "25/09/2026 08:00" ou ISO. Sem data legível, null. */
export function lerData(value: unknown): Date | null {
  const text = firstText(value);
  if (!text) return null;
  const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const [, day, month, year, hour = '0', minute = '0'] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

/** "R$ 1.234.567,89", "1234567.89", 1234567 → número; sem valor, null.
 *
 *  ⚠️ NÃO CHUTA. "1.234" pode ser mil e duzentos e trinta e quatro (BR) ou
 *  um vírgula dois (EN). Com vírgula no texto, o ponto é milhar; sem vírgula,
 *  um ponto seguido de três dígitos é milhar e de outra coisa é decimal. */
export function lerValorBrl(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  const text = firstText(value);
  if (!text || /não informado|nao informado|sigiloso/i.test(text)) return null;
  const limpo = text.replace(/[^\d.,]/g, '');
  if (!limpo) return null;
  let normalizado: string;
  if (limpo.includes(',')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{3}(\.|$)/.test(limpo) && !/\.\d{1,2}$/.test(limpo)) {
    normalizado = limpo.replace(/\./g, '');
  } else {
    normalizado = limpo;
  }
  const n = Number(normalizado);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function dataCurta(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
}

export function dataIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dias inteiros de `hoje` até `data`, pelo calendário (não por 24 h). */
export function diasAte(data: Date, hoje: Date): number {
  const a = new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
  const b = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function orgaoDaAnalise(analysis: SavedAnalysis): string {
  const record = asRecord(analysis);
  return firstText(
    record.orgao_nome, record.orgao, record.nomeOrgao, record.orgaoComprador,
    asRecord(record.orgaoEntidade).razaoSocial, asRecord(record.unidadeOrgao).nomeUnidade,
    asRecord(record.orgao_risk).nome, asRecord(record.orgao_risk).orgao,
  );
}

export function ufDaAnalise(analysis: SavedAnalysis): string {
  const record = asRecord(analysis);
  return firstText(analysis.uf, analysis.estado, record.orgao_uf, record.uf_disputa,
    asRecord(record.unidadeOrgao).ufSigla).toUpperCase();
}

export function valorDaAnalise(analysis: SavedAnalysis): number | null {
  const record = asRecord(analysis);
  const pricing = asRecord(record.pricing_intelligence);
  for (const v of [analysis.estimated_value, pricing.valor_estimado_raw, record.valor_total_estimado,
    record.valorTotalEstimado, record.valor_global, record.valor]) {
    const n = lerValorBrl(v);
    if (n !== null) return n;
  }
  return null;
}

export function tituloDaAnalise(analysis: SavedAnalysis): string {
  return firstText(analysis.title, analysis.termo_busca_pncp, 'Edital sem título');
}

// ─────────────────────────────────────────────────────────────────────────
// Prazos
// ─────────────────────────────────────────────────────────────────────────

export interface PrazoDoEdital {
  rotulo: string;
  data: Date | null;
  bruto: string;
  /** Prazo de verdade (proposta, sessão, impugnação, esclarecimento) ou
   *  marco informativo (publicação, visita). */
  decisivo: boolean;
}

const RE_DECISIVO = /encerramento|recebimento|proposta|limite|impugna|esclarec|sess[aã]o|abertura|disputa|lances/i;

/** Todas as datas críticas do laudo, as estruturadas e as legadas. */
export function prazosDaAnalise(analysis: SavedAnalysis): PrazoDoEdital[] {
  const record = asRecord(analysis);
  const lista = Array.isArray(record.datas_criticas) ? record.datas_criticas : [];
  const prazos: PrazoDoEdital[] = lista.map((item) => {
    const d = asRecord(item);
    const rotulo = firstText(d.label, d.tipo, d.nome) || 'Prazo crítico';
    const bruto = firstText(d.data_iso, d.data, d.valor);
    return { rotulo, data: lerData(bruto), bruto, decisivo: RE_DECISIVO.test(rotulo) };
  }).filter((p) => p.data || p.bruto);
  const legado = asRecord(record.datas_criticas_extraidas);
  for (const [rotulo, valor] of [['Prazo de propostas', legado.data_limite_propostas],
    ['Limite impugnação', legado.data_impugnacao]] as Array<[string, unknown]>) {
    const bruto = firstText(valor);
    if (bruto) prazos.push({ rotulo, data: lerData(bruto), bruto, decisivo: true });
  }
  return prazos;
}

/** O prazo que manda: o próximo decisivo no futuro; sem futuro, o decisivo
 *  mais recente; sem nada, o prazo da próxima ação. É a mesma régua do
 *  cartão do quadro (`getCriticalDeadline`). */
export function prazoCritico(
  analysis: SavedAnalysis,
  nextTask: DecisionQueueTask | null,
  agora: Date = new Date(),
): { rotulo: string; data: Date | null } {
  const candidatos = prazosDaAnalise(analysis)
    .map((p) => ({ ...p, prioridade: p.decisivo ? 0 : 1 }));
  const futuros = candidatos
    .filter((p) => p.data && p.data.getTime() >= agora.getTime())
    .sort((a, b) => (a.prioridade - b.prioridade) || ((a.data!.getTime()) - (b.data!.getTime())));
  const escolhido = futuros[0] || [...candidatos].sort((a, b) => a.prioridade - b.prioridade)[0];
  if (escolhido) {
    return { rotulo: `${escolhido.rotulo}: ${escolhido.data ? dataCurta(escolhido.data) : escolhido.bruto}`, data: escolhido.data };
  }
  return { rotulo: nextTask?.prazo || 'Sem prazo identificado', data: null };
}

// ─────────────────────────────────────────────────────────────────────────
// Agenda
// ─────────────────────────────────────────────────────────────────────────

export type GrupoDaAgenda = 'vencidos' | 'hoje' | 'amanha' | 'semana' | 'depois';

export const ROTULO_DO_GRUPO: Record<GrupoDaAgenda, string> = {
  vencidos: 'Vencidos',
  hoje: 'Hoje',
  amanha: 'Amanhã',
  semana: 'Próximos 7 dias',
  depois: 'Depois',
};

export interface ItemDaAgenda {
  analysisId: string;
  titulo: string;
  orgao: string;
  stage: DecisionQueueKey;
  rotulo: string;
  data: Date;
  dias: number;
  decisivo: boolean;
  proximaAcao: string;
}

export interface DiaDaAgenda {
  chave: string;
  data: Date;
  itens: ItemDaAgenda[];
}

export interface BlocoDaAgenda {
  grupo: GrupoDaAgenda;
  rotulo: string;
  dias: DiaDaAgenda[];
  total: number;
}

/** Quantos dias para trás um prazo vencido ainda aparece. Um edital cujo
 *  prazo passou há três meses e continua "em triagem" foi abandonado sem
 *  registro; listá-lo como vencido todo dia só enche a agenda. */
export const DIAS_DE_VENCIDO_NA_AGENDA = 60;

function grupoDe(dias: number): GrupoDaAgenda {
  if (dias < 0) return 'vencidos';
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanha';
  if (dias <= 7) return 'semana';
  return 'depois';
}

/** Os itens da agenda: cada data crítica de um edital ativo, no seu dia.
 *  Datas informativas (publicação, visita técnica) só entram no futuro, e
 *  saem inteiras com `soDecisivos`; no passado só os prazos decisivos, e por
 *  até 60 dias. Ordenados por data. */
export function itensDaAgenda(cartoes: CartaoDaGestao[], hoje: Date = new Date(), soDecisivos = false): ItemDaAgenda[] {
  const itens: ItemDaAgenda[] = [];
  for (const c of cartoes) {
    if (ETAPAS_FINAIS.includes(c.stage)) continue;
    const id = String(c.analysis.id || '');
    for (const p of prazosDaAnalise(c.analysis)) {
      if (!p.data) continue;
      if (soDecisivos && !p.decisivo) continue;
      const dias = diasAte(p.data, hoje);
      if (dias < 0 && (!p.decisivo || dias < -DIAS_DE_VENCIDO_NA_AGENDA)) continue;
      itens.push({
        analysisId: id,
        titulo: tituloDaAnalise(c.analysis),
        orgao: orgaoDaAnalise(c.analysis),
        stage: c.stage,
        rotulo: p.rotulo,
        data: p.data,
        dias,
        decisivo: p.decisivo,
        proximaAcao: c.nextTask?.acao || '',
      });
    }
  }
  return itens.sort((a, b) => a.data.getTime() - b.data.getTime() || a.titulo.localeCompare(b.titulo));
}

/** Os itens em blocos (vencidos, hoje, amanhã, semana, depois), cada bloco
 *  por dia. É o que o painel ao lado do calendário lista. */
export function agruparAgenda(itens: ItemDaAgenda[]): BlocoDaAgenda[] {
  const blocos = new Map<GrupoDaAgenda, Map<string, DiaDaAgenda>>();
  for (const item of itens) {
    const g = grupoDe(item.dias);
    const dias = blocos.get(g) || new Map<string, DiaDaAgenda>();
    const chave = dataIso(item.data);
    const dia = dias.get(chave) || { chave, data: new Date(item.data.getFullYear(), item.data.getMonth(), item.data.getDate()), itens: [] };
    dia.itens.push(item);
    dias.set(chave, dia);
    blocos.set(g, dias);
  }
  const ordem: GrupoDaAgenda[] = ['vencidos', 'hoje', 'amanha', 'semana', 'depois'];
  return ordem
    .filter((g) => blocos.has(g))
    .map((g) => {
      const dias = [...blocos.get(g)!.values()];
      return { grupo: g, rotulo: ROTULO_DO_GRUPO[g], dias, total: dias.reduce((s, d) => s + d.itens.length, 0) };
    });
}

/** A agenda inteira, em blocos. */
export function agendaDePrazos(cartoes: CartaoDaGestao[], hoje: Date = new Date(), soDecisivos = false): BlocoDaAgenda[] {
  return agruparAgenda(itensDaAgenda(cartoes, hoje, soDecisivos));
}

// ── O calendário ─────────────────────────────────────────────────────────
// A lista corrida não dava para analisar (25/09/2026): cada edital tem
// várias datas, e sete editais viravam trinta linhas. O calendário do mês
// mostra ONDE os prazos se concentram, e o painel ao lado lista só o dia
// clicado, os vencidos ou os próximos sete dias.

export type TipoDoPrazo = 'propostas' | 'sessao' | 'impugnacao' | 'esclarecimento' | 'outro';

/** Um nome curto para caber na célula do calendário, e a família do prazo. */
export function tipoDoPrazo(rotulo: string): { curto: string; tipo: TipoDoPrazo } {
  const r = rotulo.toLowerCase();
  if (/impugna/.test(r)) return { curto: 'Impugnação', tipo: 'impugnacao' };
  if (/esclarec/.test(r)) return { curto: 'Esclarecimento', tipo: 'esclarecimento' };
  if (/sess[aã]o|disputa|lances/.test(r)) return { curto: 'Sessão', tipo: 'sessao' };
  if (/proposta|recebimento|encerramento|abertura/.test(r)) return { curto: 'Propostas', tipo: 'propostas' };
  return { curto: rotulo.length > 18 ? `${rotulo.slice(0, 17)}…` : rotulo, tipo: 'outro' };
}

export interface DiaDoCalendario {
  chave: string;
  data: Date;
  dia: number;
  foraDoMes: boolean;
  hoje: boolean;
  passado: boolean;
  itens: ItemDaAgenda[];
}

/** O primeiro dia do mês de `d`. */
export function inicioDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function mesSeguinte(mes: Date, passos = 1): Date {
  return new Date(mes.getFullYear(), mes.getMonth() + passos, 1);
}

const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "Setembro de 2026" — só a inicial do mês em maiúscula (o `capitalize` do
 *  CSS fazia "Setembro De 2026"). */
export function rotuloDoMesLongo(mes: Date): string {
  const nome = MESES_LONGOS[mes.getMonth()];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${mes.getFullYear()}`;
}

// Duas ou três letras (TI, SUS, UF), ou qualquer coisa com dígito (CRBIO-01, 5G).
const SIGLAS_QUE_FICAM = /^(?:[A-Z]{2,3}|(?=.*\d)[A-Z0-9][A-Z0-9./-]*)$/;
const PALAVRAS_MIUDAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'A', 'O', 'AS', 'OS', 'EM', 'NO', 'NA', 'NOS', 'NAS', 'COM', 'SEM', 'POR', 'AO', 'AOS', 'UM', 'UMA', 'OU']);

/** O título do edital vem em caixa alta ("REGISTRO DE PREÇOS PARA EVENTUAL
 *  AQUISIÇÃO DE HORTIFRUTIGRANJEIROS"), e em caixa alta tudo grita igual.
 *  Numa célula de calendário isso não se lê. Aqui vira frase: inicial
 *  maiúscula, o resto minúsculo, mas as siglas curtas (TI, SUS, CRBio-01)
 *  ficam como estão. Um título que já tem minúsculas passa intacto. */
export function tituloAmigavel(titulo: string): string {
  const texto = String(titulo || '').replace(/\s+/g, ' ').trim();
  const letras = texto.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letras || letras !== letras.toUpperCase()) return texto;
  const palavras = texto.split(' ').map((palavra) => {
    if (SIGLAS_QUE_FICAM.test(palavra) && !PALAVRAS_MIUDAS.has(palavra)) return palavra;
    return palavra.toLowerCase();
  });
  const frase = palavras.join(' ');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** As semanas do mês, de domingo a sábado, com os dias vizinhos que completam
 *  a primeira e a última semana marcados como fora do mês. Cada dia leva os
 *  itens que caem nele. */
export function gradeDoMes(mes: Date, itens: ItemDaAgenda[], hoje: Date = new Date()): DiaDoCalendario[][] {
  const porDia = new Map<string, ItemDaAgenda[]>();
  for (const item of itens) {
    const chave = dataIso(item.data);
    porDia.set(chave, [...(porDia.get(chave) || []), item]);
  }
  const primeiro = inicioDoMes(mes);
  const inicio = new Date(primeiro.getFullYear(), primeiro.getMonth(), 1 - primeiro.getDay());
  const fimDoMes = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0);
  const chaveHoje = dataIso(hoje);
  const semanas: DiaDoCalendario[][] = [];
  const cursor = new Date(inicio);
  while (cursor <= fimDoMes || cursor.getDay() !== 0) {
    if (cursor.getDay() === 0) semanas.push([]);
    const chave = dataIso(cursor);
    semanas[semanas.length - 1].push({
      chave,
      data: new Date(cursor),
      dia: cursor.getDate(),
      foraDoMes: cursor.getMonth() !== primeiro.getMonth(),
      hoje: chave === chaveHoje,
      passado: chave < chaveHoje,
      itens: porDia.get(chave) || [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return semanas;
}

/** O filtro da legenda (25/09/2026): os tipos são uma soma (Propostas ou
 *  Sessão), e "vencido" é um recorte por cima (só o que já passou). Nada
 *  marcado = tudo. */
export interface FiltroDaAgenda {
  tipos: Set<TipoDoPrazo>;
  soVencidos: boolean;
}

export const FILTRO_DA_AGENDA_VAZIO: FiltroDaAgenda = { tipos: new Set(), soVencidos: false };

export function filtrarItensDaAgenda(itens: ItemDaAgenda[], filtro: FiltroDaAgenda): ItemDaAgenda[] {
  return itens.filter((item) => {
    if (filtro.tipos.size > 0 && !filtro.tipos.has(tipoDoPrazo(item.rotulo).tipo)) return false;
    if (filtro.soVencidos && !(item.dias < 0 && item.decisivo)) return false;
    return true;
  });
}

/** Liga ou desliga um tipo, sem mexer no filtro recebido. */
export function alternarTipoDaAgenda(filtro: FiltroDaAgenda, tipo: TipoDoPrazo): FiltroDaAgenda {
  const tipos = new Set(filtro.tipos);
  if (tipos.has(tipo)) tipos.delete(tipo); else tipos.add(tipo);
  return { ...filtro, tipos };
}

export function filtroDaAgendaAtivo(filtro: FiltroDaAgenda): boolean {
  return filtro.tipos.size > 0 || filtro.soVencidos;
}

/** O que o painel mostra: os vencidos, os próximos 7 dias (com hoje) ou um dia. */
export type SelecaoDaAgenda = 'proximos' | 'vencidos' | string;

export function itensDaSelecao(itens: ItemDaAgenda[], selecao: SelecaoDaAgenda): ItemDaAgenda[] {
  if (selecao === 'vencidos') return itens.filter((i) => i.dias < 0);
  if (selecao === 'proximos') return itens.filter((i) => i.dias >= 0 && i.dias <= 7);
  return itens.filter((i) => dataIso(i.data) === selecao);
}

// ─────────────────────────────────────────────────────────────────────────
// Tabela
// ─────────────────────────────────────────────────────────────────────────

export interface LinhaDaTabela {
  id: string;
  titulo: string;
  orgao: string;
  uf: string;
  valor: number | null;
  score: number | null;
  veredito: 'GO' | 'GO_CONDICIONADO' | 'NO_GO';
  etapa: DecisionQueueKey;
  etapaRotulo: string;
  prazo: Date | null;
  prazoRotulo: string;
  proximaAcao: string;
  responsavel: string;
  feitas: number;
  total: number;
  atualizadoEm: Date | null;
  resultado: string;
}

export type ColunaDaTabela = 'titulo' | 'orgao' | 'uf' | 'valor' | 'score' | 'etapa' | 'prazo' | 'progresso' | 'atualizado';
export type DirecaoDaOrdem = 'asc' | 'desc';

export const COLUNAS_DA_TABELA: Array<{ chave: ColunaDaTabela; rotulo: string; numerica: boolean }> = [
  { chave: 'titulo', rotulo: 'Edital', numerica: false },
  { chave: 'orgao', rotulo: 'Órgão', numerica: false },
  { chave: 'uf', rotulo: 'UF', numerica: false },
  { chave: 'valor', rotulo: 'Valor', numerica: true },
  { chave: 'score', rotulo: 'Score', numerica: true },
  { chave: 'etapa', rotulo: 'Etapa', numerica: false },
  { chave: 'prazo', rotulo: 'Prazo', numerica: true },
  { chave: 'progresso', rotulo: 'Ações', numerica: true },
  { chave: 'atualizado', rotulo: 'Atualizado', numerica: true },
];

export function atualizadoEm(analysis: SavedAnalysis): Date | null {
  return lerData(firstText(
    analysis.workflow_updated_at, analysis.reviewed_at, analysis.cockpit_updated_at,
    asRecord(analysis.decision_learning).updated_at, asRecord(analysis).updated_at, analysis.created_at,
  ));
}

export function linhasDaTabela(cartoes: CartaoDaGestao[], agora: Date = new Date()): LinhaDaTabela[] {
  return cartoes.map((c) => {
    const prazo = prazoCritico(c.analysis, c.nextTask, agora);
    const estado = c.nextTask ? c.statusMap[c.nextTask.id] : undefined;
    const learning = asRecord(c.analysis.decision_learning);
    const resultados: Record<string, string> = {
      won: 'Ganho', lost: 'Perdido', abandoned: 'Abandonado', not_participated: 'Não participou',
    };
    return {
      id: String(c.analysis.id || ''),
      titulo: tituloDaAnalise(c.analysis),
      orgao: orgaoDaAnalise(c.analysis),
      uf: ufDaAnalise(c.analysis),
      valor: valorDaAnalise(c.analysis),
      score: scoreOuNulo(c.analysis.score),
      veredito: inferDecisionVerdict(c.analysis),
      etapa: c.stage,
      etapaRotulo: decisionQueueStages[c.stage].label,
      prazo: prazo.data,
      prazoRotulo: prazo.rotulo,
      proximaAcao: c.nextTask?.acao || '',
      responsavel: firstText(estado?.responsavel, c.nextTask?.responsavel),
      feitas: c.done,
      total: c.total,
      atualizadoEm: atualizadoEm(c.analysis),
      resultado: resultados[firstText(learning.resultado)] || '',
    };
  });
}

/** Ordena sem mexer na lista de entrada. Quem não tem o valor (sem prazo,
 *  sem score, sem valor) vai para o fim nas duas direções. */
export function ordenarLinhas(linhas: LinhaDaTabela[], coluna: ColunaDaTabela, direcao: DirecaoDaOrdem): LinhaDaTabela[] {
  const sinal = direcao === 'asc' ? 1 : -1;
  const chave = (l: LinhaDaTabela): number | string | null => {
    switch (coluna) {
      case 'titulo': return l.titulo.toLowerCase();
      case 'orgao': return l.orgao.toLowerCase() || null;
      case 'uf': return l.uf || null;
      case 'valor': return l.valor;
      case 'score': return l.score;
      case 'etapa': return decisionQueueOrder.indexOf(l.etapa);
      case 'prazo': return l.prazo ? l.prazo.getTime() : null;
      case 'progresso': return l.total ? l.feitas / l.total : null;
      case 'atualizado': return l.atualizadoEm ? l.atualizadoEm.getTime() : null;
      default: return null;
    }
  };
  return [...linhas].sort((a, b) => {
    const ka = chave(a);
    const kb = chave(b);
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;
    if (kb === null) return -1;
    if (typeof ka === 'string' && typeof kb === 'string') return ka.localeCompare(kb, 'pt-BR') * sinal;
    return ((ka as number) - (kb as number)) * sinal;
  });
}

/** CSV com `;` e vírgula decimal: é o que o Excel em português abre certo.
 *  O BOM vai na frente por causa dos acentos. */
export function csvDaTabela(linhas: LinhaDaTabela[]): string {
  const escapar = (v: string | number) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cabecalho = ['Edital', 'Órgão', 'UF', 'Valor estimado (R$)', 'Score', 'Veredito', 'Etapa', 'Prazo',
    'Próxima ação', 'Responsável', 'Ações feitas', 'Ações', 'Atualizado em', 'Resultado'];
  const corpo = linhas.map((l) => [
    l.titulo, l.orgao, l.uf,
    l.valor != null ? l.valor.toFixed(2).replace('.', ',') : '',
    l.score ?? '', l.veredito, l.etapaRotulo,
    l.prazo ? l.prazo.toLocaleDateString('pt-BR') : l.prazoRotulo,
    l.proximaAcao, l.responsavel, l.feitas, l.total,
    l.atualizadoEm ? l.atualizadoEm.toLocaleDateString('pt-BR') : '',
    l.resultado,
  ]);
  return '\ufeff' + [cabecalho, ...corpo].map((linha) => linha.map(escapar).join(';')).join('\r\n');
}

// ─────────────────────────────────────────────────────────────────────────
// Desempenho
// ─────────────────────────────────────────────────────────────────────────

export interface EtapaDoFunil {
  chave: DecisionQueueKey;
  rotulo: string;
  quantidade: number;
  valor: number;
  /** Quantos não tinham valor legível: o "valor" soma só os outros. */
  semValor: number;
}

export interface DesempenhoPorOrgao {
  orgao: string;
  disputas: number;
  ganhos: number;
  taxa: number;
  valorGanho: number;
}

export interface DesempenhoPorMes {
  chave: string;
  rotulo: string;
  ganhos: number;
  perdidos: number;
  valorGanho: number;
}

export interface PrecoDaDisputa {
  analysisId: string;
  titulo: string;
  orgao: string;
  resultado: 'won' | 'lost';
  vencedor: string;
  estimado: number | null;
  precoFinal: number | null;
  /** (final − estimado) / estimado, em %; negativo é deságio. */
  desagioPct: number | null;
}

export interface Desempenho {
  funil: EtapaDoFunil[];
  emDisputa: { quantidade: number; valor: number };
  ganhos: { quantidade: number; valor: number };
  perdidos: { quantidade: number; valor: number };
  abandonados: number;
  taxaVitoria: number | null;
  porOrgao: DesempenhoPorOrgao[];
  porMes: DesempenhoPorMes[];
  precos: PrecoDaDisputa[];
  desagioMedioPct: number | null;
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function dataDoResultado(analysis: SavedAnalysis): Date | null {
  const learning = asRecord(analysis.decision_learning);
  return lerData(firstText(learning.updated_at, learning.auto_registrado_em, analysis.workflow_updated_at, analysis.created_at));
}

export function desempenhoDaGestao(cartoes: CartaoDaGestao[], hoje: Date = new Date(), meses = 12): Desempenho {
  const funil: EtapaDoFunil[] = decisionQueueOrder.map((chave) => ({
    chave, rotulo: decisionQueueStages[chave].label, quantidade: 0, valor: 0, semValor: 0,
  }));
  const porChave = new Map(funil.map((f) => [f.chave, f]));
  const porOrgao = new Map<string, DesempenhoPorOrgao>();
  const porMes = new Map<string, DesempenhoPorMes>();
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    porMes.set(chave, { chave, rotulo: `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, ganhos: 0, perdidos: 0, valorGanho: 0 });
  }
  const precos: PrecoDaDisputa[] = [];

  for (const c of cartoes) {
    const etapa = porChave.get(c.stage)!;
    const valor = valorDaAnalise(c.analysis);
    etapa.quantidade += 1;
    if (valor === null) etapa.semValor += 1; else etapa.valor += valor;

    if (c.stage !== 'won' && c.stage !== 'lost') continue;
    const learning = asRecord(c.analysis.decision_learning);
    const orgao = orgaoDaAnalise(c.analysis) || 'Órgão não identificado';
    const o = porOrgao.get(orgao) || { orgao, disputas: 0, ganhos: 0, taxa: 0, valorGanho: 0 };
    o.disputas += 1;
    if (c.stage === 'won') { o.ganhos += 1; o.valorGanho += valor || 0; }
    porOrgao.set(orgao, o);

    const quando = dataDoResultado(c.analysis);
    if (quando) {
      const m = porMes.get(`${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}`);
      if (m) {
        if (c.stage === 'won') { m.ganhos += 1; m.valorGanho += valor || 0; } else m.perdidos += 1;
      }
    }

    const precoFinal = lerValorBrl(learning.preco_final);
    if (precoFinal !== null || valor !== null) {
      precos.push({
        analysisId: String(c.analysis.id || ''),
        titulo: tituloDaAnalise(c.analysis),
        orgao,
        resultado: c.stage,
        vencedor: firstText(learning.vencedor),
        estimado: valor,
        precoFinal,
        desagioPct: precoFinal !== null && valor !== null ? Math.round(((precoFinal - valor) / valor) * 1000) / 10 : null,
      });
    }
  }

  for (const o of porOrgao.values()) o.taxa = Math.round((o.ganhos / o.disputas) * 100);
  const ganhos = porChave.get('won')!;
  const perdidos = porChave.get('lost')!;
  const disputas = ganhos.quantidade + perdidos.quantidade;
  const comDesagio = precos.filter((p) => p.desagioPct !== null);
  return {
    funil,
    emDisputa: {
      quantidade: porChave.get('proposal')!.quantidade + porChave.get('submitted')!.quantidade,
      valor: porChave.get('proposal')!.valor + porChave.get('submitted')!.valor,
    },
    ganhos: { quantidade: ganhos.quantidade, valor: ganhos.valor },
    perdidos: { quantidade: perdidos.quantidade, valor: perdidos.valor },
    abandonados: porChave.get('abandoned')!.quantidade,
    taxaVitoria: disputas ? Math.round((ganhos.quantidade / disputas) * 100) : null,
    porOrgao: [...porOrgao.values()].sort((a, b) => b.disputas - a.disputas || b.valorGanho - a.valorGanho),
    porMes: [...porMes.values()],
    precos: precos.sort((a, b) => (b.estimado || 0) - (a.estimado || 0)),
    desagioMedioPct: comDesagio.length
      ? Math.round((comDesagio.reduce((s, p) => s + (p.desagioPct as number), 0) / comDesagio.length) * 10) / 10
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Responsáveis
// ─────────────────────────────────────────────────────────────────────────

/** O responsável que o laudo põe quando ninguém foi definido. */
export const RESPONSAVEL_PADRAO = 'Licitações';

export interface AcaoPendente {
  analysisId: string;
  taskId: string;
  titulo: string;
  stage: DecisionQueueKey;
  acao: string;
  prazoTexto: string;
  prazo: Date | null;
  vencida: boolean;
  prioridade: DecisionQueueTask['prioridade'];
}

export interface CargaDoResponsavel {
  responsavel: string;
  /** Ninguém definiu: é o padrão do laudo. */
  padrao: boolean;
  pendentes: AcaoPendente[];
  vencidas: number;
  concluidas: number;
  editais: number;
}

export function acoesPorResponsavel(cartoes: CartaoDaGestao[], hoje: Date = new Date()): CargaDoResponsavel[] {
  const cargas = new Map<string, CargaDoResponsavel & { _editais: Set<string> }>();
  for (const c of cartoes) {
    if (ETAPAS_FINAIS.includes(c.stage)) continue;
    const id = String(c.analysis.id || '');
    for (const task of c.tasks) {
      const estado = c.statusMap[task.id] || {};
      const definido = firstText(estado.responsavel);
      const nome = definido || firstText(task.responsavel) || RESPONSAVEL_PADRAO;
      const chave = nome.toLowerCase();
      const carga = cargas.get(chave) || {
        responsavel: nome, padrao: !definido && nome === RESPONSAVEL_PADRAO,
        pendentes: [], vencidas: 0, concluidas: 0, editais: 0, _editais: new Set<string>(),
      };
      if (definido) carga.padrao = false;
      carga._editais.add(id);
      if (estado.done) {
        carga.concluidas += 1;
      } else {
        const prazoTexto = firstText(estado.prazo, task.prazo);
        const prazo = lerData(prazoTexto);
        const vencida = !!prazo && diasAte(prazo, hoje) < 0;
        if (vencida) carga.vencidas += 1;
        carga.pendentes.push({
          analysisId: id, taskId: task.id, titulo: tituloDaAnalise(c.analysis), stage: c.stage,
          acao: task.acao, prazoTexto, prazo, vencida, prioridade: task.prioridade,
        });
      }
      cargas.set(chave, carga);
    }
  }
  const peso = { Alta: 0, 'Média': 1, Normal: 2 } as const;
  return [...cargas.values()].map((carga) => {
    // Data primeiro (a vencida é a mais antiga, então sobe sozinha); sem
    // data, a prioridade.
    carga.pendentes.sort((a, b) => {
      if (a.prazo && b.prazo) return a.prazo.getTime() - b.prazo.getTime();
      if (a.prazo || b.prazo) return a.prazo ? -1 : 1;
      return peso[a.prioridade] - peso[b.prioridade];
    });
    const { _editais, ...resto } = carga;
    return { ...resto, editais: _editais.size };
  }).sort((a, b) => b.pendentes.length - a.pendentes.length || a.responsavel.localeCompare(b.responsavel, 'pt-BR'));
}

// ─────────────────────────────────────────────────────────────────────────
// O resumo do edital (25/09/2026)
// ─────────────────────────────────────────────────────────────────────────
// O modal listava dez campos com o mesmo peso — "Motivo do status" repetia a
// próxima ação, "UF / Resultado" juntava duas coisas, "Progresso do cockpit"
// era jargão. Aqui sai o que o modal passa a dizer primeiro: a situação, em
// uma frase, com o que fazer.

export type SugestaoDaSituacao = 'registrar_resultado' | 'concluir_acao' | 'avancar' | 'conferir_prazo' | null;

export interface SituacaoDoEdital {
  tom: 'vermelho' | 'ambar' | 'azul' | 'verde' | 'neutro';
  titulo: string;
  texto: string;
  sugestao: SugestaoDaSituacao;
}

const ROTULO_DO_RESULTADO: Record<string, string> = {
  won: 'Ganho', lost: 'Perdido', abandoned: 'Abandonado', not_participated: 'Não participou',
};

export function situacaoDoEdital(c: CartaoDaGestao, hoje: Date = new Date()): SituacaoDoEdital {
  const learning = asRecord(c.analysis.decision_learning);
  const pendentes = c.total - c.done;
  const plano = c.total === 0
    ? 'O laudo não trouxe plano de ações.'
    : pendentes === 0
      ? `As ${c.total} ações do plano estão concluídas.`
      : c.done === 0
        ? `Nenhuma das ${c.total} ações do plano foi feita.`
        : `${c.done} de ${c.total} ações do plano feitas.`;

  const preco = firstText(learning.preco_final);
  const vencedor = firstText(learning.vencedor);
  if (c.stage === 'won') {
    return {
      tom: 'verde', titulo: 'Ganho',
      texto: `${preco ? `Preço final ${preco}. ` : ''}Acompanhe a vigência em Meus contratos.`,
      sugestao: null,
    };
  }
  if (c.stage === 'lost') {
    const quem = vencedor ? `Venceu ${vencedor}` : 'Vencedor não registrado';
    return {
      tom: 'neutro', titulo: 'Perdido',
      texto: `${quem}${preco ? ` por ${preco}` : ''}. O preço final alimenta a régua de Desempenho.`,
      sugestao: null,
    };
  }
  if (c.stage === 'abandoned') {
    return { tom: 'neutro', titulo: ROTULO_DO_RESULTADO[firstText(learning.resultado)] || 'Abandonado',
      texto: 'A decisão ficou registrada para as próximas disputas.', sugestao: null };
  }
  if (c.stage === 'executed') {
    return { tom: 'neutro', titulo: 'Fluxo encerrado', texto: 'Nada mais a fazer aqui.', sugestao: null };
  }

  const veredito = inferDecisionVerdict(c.analysis);
  const score = scoreOuNulo(c.analysis.score);
  const alerta = veredito === 'NO_GO' && ['not_started', 'triage', 'pending'].includes(c.stage)
    ? ` O laudo recomendou não participar${score !== null ? ` (score ${score})` : ''}.`
    : '';
  const prazo = prazoCritico(c.analysis, c.nextTask, hoje);
  const dias = prazo.data ? diasAte(prazo.data, hoje) : null;
  const quando = prazo.data ? dataCurta(prazo.data) : '';

  if (c.stage === 'submitted') {
    return {
      tom: 'azul', titulo: 'Proposta enviada',
      texto: (dias !== null && dias < 0 ? `A sessão foi em ${quando}. ` : dias !== null ? `Sessão em ${quando}. ` : '')
        + 'Registre o resultado assim que sair: é ele que alimenta a taxa de vitória.',
      sugestao: 'registrar_resultado',
    };
  }
  if (dias !== null && dias < 0) {
    return {
      tom: 'vermelho',
      titulo: `Prazo venceu há ${-dias} dia${dias === -1 ? '' : 's'}`,
      texto: `${plano}${alerta} Registre o desfecho (não participou ou abandonado) ou tire o edital da Gestão.`,
      sugestao: 'registrar_resultado',
    };
  }
  if (dias === 0) {
    return { tom: 'vermelho', titulo: 'Vence hoje', texto: `${plano}${alerta}`, sugestao: pendentes ? 'concluir_acao' : 'avancar' };
  }
  if (dias !== null && dias <= 3) {
    return { tom: 'ambar', titulo: `Vence em ${dias} dia${dias === 1 ? '' : 's'}`, texto: `${quando}. ${plano}${alerta}`, sugestao: pendentes ? 'concluir_acao' : 'avancar' };
  }
  if (dias !== null && dias <= 7) {
    return { tom: 'azul', titulo: `Vence esta semana, em ${dias} dias`, texto: `${quando}. ${plano}${alerta}`, sugestao: pendentes ? 'concluir_acao' : 'avancar' };
  }
  if (dias !== null) {
    return { tom: 'verde', titulo: `No prazo: vence em ${dias} dias`, texto: `${quando}. ${plano}${alerta}`, sugestao: pendentes ? 'concluir_acao' : 'avancar' };
  }
  return {
    tom: 'neutro', titulo: 'Sem prazo identificado',
    texto: `O laudo não trouxe data de abertura ou sessão: confira no PNCP. ${plano}${alerta}`,
    sugestao: 'conferir_prazo',
  };
}

/** O que o botão da situação faz — ou `null`, quando não há com o que
 *  fazer: "Ver no PNCP" precisa da origem no laudo, "Concluir" de uma ação
 *  pendente, "Avançar" de uma etapa seguinte. Sem ação, o botão some. */
export type AcaoDaSugestao =
  | { tipo: 'registrar_resultado' }
  | { tipo: 'concluir_acao'; tarefa: DecisionQueueTask }
  | { tipo: 'avancar'; etapa: DecisionQueueKey }
  | { tipo: 'abrir_pncp'; url: string };

export function acaoDaSugestao(sugestao: SugestaoDaSituacao, c: CartaoDaGestao): AcaoDaSugestao | null {
  if (sugestao === 'registrar_resultado') return { tipo: 'registrar_resultado' };
  if (sugestao === 'concluir_acao') return c.nextTask ? { tipo: 'concluir_acao', tarefa: c.nextTask } : null;
  if (sugestao === 'avancar') {
    const etapa = getNextDecisionQueueStage(c.stage);
    return etapa ? { tipo: 'avancar', etapa } : null;
  }
  if (sugestao === 'conferir_prazo') {
    const url = linkDoPncp(c.analysis);
    return url ? { tipo: 'abrir_pncp', url } : null;
  }
  return null;
}

/** O edital no portal, quando o laudo veio de lá. */
export function linkDoPncp(analysis: SavedAnalysis): string | null {
  const ref = asRecord(analysis.pncp_ref);
  const cnpj = String(ref.cnpj || analysis.pncp_cnpj || '').replace(/\D/g, '');
  const ano = String(ref.ano || analysis.pncp_ano || '').trim();
  const sequencial = parseInt(String(ref.sequencial || analysis.pncp_sequencial || '').trim(), 10);
  if (cnpj.length !== 14 || !/^\d{4}$/.test(ano) || !Number.isFinite(sequencial)) return null;
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`;
}

export interface DataDoEdital {
  rotulo: string;
  data: Date | null;
  bruto: string;
  dias: number | null;
  decisivo: boolean;
}

/** Todas as datas do edital, as com data primeiro (em ordem), depois as que
 *  só têm texto. */
export function datasDoEdital(analysis: SavedAnalysis, hoje: Date = new Date()): DataDoEdital[] {
  const todas = prazosDaAnalise(analysis).map((p) => ({
    rotulo: p.rotulo, data: p.data, bruto: p.bruto, decisivo: p.decisivo,
    dias: p.data ? diasAte(p.data, hoje) : null,
  }));
  return [
    ...todas.filter((d) => d.data).sort((a, b) => a.data!.getTime() - b.data!.getTime()),
    ...todas.filter((d) => !d.data),
  ];
}

/** "venceu há 3 dias", "hoje", "amanhã", "em 12 dias". */
export function fraseDosDias(dias: number): string {
  if (dias < 0) return `venceu há ${-dias} dia${dias === -1 ? '' : 's'}`;
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

/** As cinco etapas do fluxo, na ordem; os desfechos ficam fora da linha. */
export const ETAPAS_DO_FLUXO: DecisionQueueKey[] = ['not_started', 'triage', 'pending', 'proposal', 'submitted'];
