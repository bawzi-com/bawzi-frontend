/**
 * Radar Estratégico: o que o sino calcula sem tocar na rede (25/09/2026).
 *
 * O painel mostrava o alerta como nasceu: "vence hoje" seis dias depois,
 * três "Edital mudou" iguais para o mesmo edital, "Início das Propostas
 * vence", título partido no meio da palavra. Tudo aqui é função pura: a data
 * que o alerta vigia, os dias até ela, o título e a mensagem recalculados, o
 * agrupamento dos repetidos, a separação dos vencidos e as contagens dos
 * chips. Testado sem navegador.
 */
import { diasAte, tituloAmigavel } from '@/lib/gestao';

export type TipoDeAlerta =
  | 'compliance' | 'matchmaker' | 'renovacao' | 'oportunidade' | 'prazo'
  | 'decisao' | 'pncp_mudanca' | 'disputa_abrindo' | 'pncp_resultado' | 'radar_alerta';

export interface Notificacao {
  _id: string;
  tipo: TipoDeAlerta;
  prioridade: 1 | 2 | 3;
  icone: string;
  titulo: string;
  mensagem: string;
  url: string;
  lida: boolean;
  criada_em?: string;
  /** O que o servidor grava junto. Os alertas de prazo passaram a trazer a
   *  data (`data_iso`), o tipo da data (`tipo_prazo`) e o título do edital;
   *  os de disputa, o fim do contrato (`vence_em`); os de mudança, os
   *  arquivos novos. Os antigos não têm nada disso — e a tela se vira. */
  dados?: {
    analysis_id?: string;
    ncp?: string;
    prazo?: string;
    data_iso?: string;
    tipo_prazo?: TipoDePrazo;
    titulo_edital?: string;
    vence_em?: string;
    dias?: number;
    marco?: number;
    arquivos_novos?: string[];
    [k: string]: unknown;
  };
}

export type TipoDePrazo = 'fim' | 'inicio' | 'sessao' | 'impugnacao' | 'esclarecimento';

export const ROTULO_DO_TIPO: Record<TipoDeAlerta, string> = {
  prazo: 'Prazos',
  pncp_mudanca: 'Editais que mudaram',
  disputa_abrindo: 'Disputas',
  decisao: 'Decisões',
  compliance: 'Compliance',
  renovacao: 'Renovações',
  matchmaker: 'Editais novos',
  oportunidade: 'Oportunidades',
  pncp_resultado: 'Resultados',
  radar_alerta: 'Radar',
};

const ORDEM_DOS_TIPOS = Object.keys(ROTULO_DO_TIPO) as TipoDeAlerta[];

// ─────────────────────────────────────────────────────────────────────────
// Datas
// ─────────────────────────────────────────────────────────────────────────

/** "2026-09-25" ou ISO com hora → meia-noite local daquele dia. */
export function lerDia(texto: unknown): Date | null {
  const t = String(texto || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function diaDe(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** A mesma régua do servidor: o tipo da data pelo rótulo. */
export function tipoDePrazo(label: string): TipoDePrazo {
  const l = String(label || '');
  if (/impugna/i.test(l)) return 'impugnacao';
  if (/esclarec/i.test(l)) return 'esclarecimento';
  if (/sess[aã]o|lances|disputa/i.test(l)) return 'sessao';
  if (/in[ií]cio|abertura/i.test(l)) return 'inicio';
  return 'fim';
}

/** A data que o alerta vigia. Nos alertas antigos de prazo, sem `data_iso`,
 *  ela é inferida do dia em que nasceu: "hoje" era aquele dia, "amanhã" o
 *  seguinte — é o que faz o "vence hoje" de seis dias atrás virar "venceu há
 *  6 dias" também para o que já estava no sino. */
export function dataDoAlerta(n: Notificacao): Date | null {
  if (n.tipo === 'prazo') {
    const gravada = lerDia(n.dados?.data_iso);
    if (gravada) return gravada;
    const nascimento = diaDe(n.criada_em);
    if (!nascimento) return null;
    // Sem `\b` depois do "ã": a fronteira de palavra do JS é ASCII e não vê o acento.
    if (/amanh[ãa]/i.test(n.mensagem)) return new Date(nascimento.getFullYear(), nascimento.getMonth(), nascimento.getDate() + 1);
    if (/\bhoje\b/i.test(n.mensagem)) return nascimento;
    return null;
  }
  if (n.tipo === 'disputa_abrindo') {
    const gravada = lerDia(n.dados?.vence_em);
    if (gravada) return gravada;
    const nascimento = diaDe(n.criada_em);
    const dias = Number(n.dados?.dias);
    if (!nascimento || !Number.isFinite(dias)) return null;
    return new Date(nascimento.getFullYear(), nascimento.getMonth(), nascimento.getDate() + dias);
  }
  return null;
}

export function diasDoAlerta(n: Notificacao, hoje: Date = new Date()): number | null {
  const data = dataDoAlerta(n);
  return data ? diasAte(data, hoje) : null;
}

/** Vencido = a data que ele vigia já passou. Só prazos e disputas têm data. */
export function alertaVencido(n: Notificacao, hoje: Date = new Date()): boolean {
  const dias = diasDoAlerta(n, hoje);
  return dias !== null && dias < 0;
}

// ──────────────────────────────────────────────────────────────────────────
// Texto vivo
// ──────────────────────────────────────────────────────────────────────────

/** "vence hoje", "vence amanhã", "vence em 12 dias", "venceu ontem",
 *  "venceu há 6 dias". Para o que começa (abertura, sessão): "é hoje",
 *  "foi há 2 dias". */
export function fraseDoVencimento(dias: number, tipo: TipoDePrazo = 'fim'): string {
  const comeca = tipo === 'inicio' || tipo === 'sessao';
  if (dias < 0) {
    const quando = dias === -1 ? 'ontem' : `há ${-dias} dias`;
    return `${comeca ? 'foi' : 'venceu'} ${quando}`;
  }
  const presente = comeca ? 'é' : 'vence';
  if (dias === 0) return `${presente} hoje`;
  if (dias === 1) return `${presente} amanhã`;
  return `${presente} em ${dias} dias`;
}

const BOILERPLATE = / ?Decida, esclareça ou abandone antes de mobilizar proposta\.?/g;

/** O título do edital como a mensagem cita: em frase, e com reticências
 *  quando o corte antigo (120 letras, no meio da palavra) o deixou sem. */
export function tituloCitado(titulo: string): string {
  const t = tituloAmigavel(titulo);
  if (!t) return t;
  const parecesCortado = t.length >= 118 && !/[.…!?)]$/.test(t);
  return parecesCortado ? `${t}…` : t;
}

function tipoDoAlertaDePrazo(n: Notificacao): TipoDePrazo {
  return n.dados?.tipo_prazo || tipoDePrazo(n.dados?.prazo || n.mensagem.split(' do edital')[0] || '');
}

/** O título recalculado hoje. Prazo: "Prazo venceu há 6 dias", "Propostas
 *  abrem amanhã", "Sessão hoje". Disputa: "Disputa em 6 dias: ÓRGÃO" com a
 *  conta de hoje, "Contrato venceu há 2 dias: ÓRGÃO" quando passou. */
export function tituloVivo(n: Notificacao, hoje: Date = new Date()): string {
  const dias = diasDoAlerta(n, hoje);
  if (n.tipo === 'prazo' && dias !== null) {
    const tipo = tipoDoAlertaDePrazo(n);
    // "é hoje" / "foi há 2 dias" viram o complemento: "hoje", "há 2 dias".
    const quando = fraseDoVencimento(dias, tipo).replace(/^(é|foi|vence|venceu) /, '');
    if (tipo === 'inicio') return dias < 0 ? `Propostas abriram ${quando}` : `Propostas abrem ${quando}`;
    if (tipo === 'sessao') return dias < 0 ? `Sessão foi ${quando}` : `Sessão ${quando}`;
    const sujeito = tipo === 'impugnacao' ? 'Impugnação' : tipo === 'esclarecimento' ? 'Esclarecimento' : 'Prazo';
    return `${sujeito} ${dias < 0 ? 'venceu' : 'vence'} ${quando}`;
  }
  if (n.tipo === 'disputa_abrindo' && dias !== null) {
    const orgao = n.titulo.includes(':') ? n.titulo.slice(n.titulo.indexOf(':') + 1).trim() : '';
    const sufixo = orgao ? `: ${tituloAmigavel(orgao)}` : '';
    if (dias < 0) return `Contrato ${fraseDoVencimento(dias)}${sufixo}`;
    if (dias === 0) return `Disputa: contrato vence hoje${sufixo}`;
    return `Disputa em ${dias} dia${dias === 1 ? '' : 's'}${sufixo}`;
  }
  return n.titulo;
}

/** A mensagem recalculada hoje, sem a frase repetida e com o título do
 *  edital em frase. */
export function mensagemViva(n: Notificacao, hoje: Date = new Date()): string {
  const dias = diasDoAlerta(n, hoje);
  const d = n.dados || {};
  if (n.tipo === 'prazo') {
    if (d.titulo_edital && d.prazo && dias !== null) {
      return `${d.prazo} do edital "${tituloCitado(d.titulo_edital)}" ${fraseDoVencimento(dias, tipoDoAlertaDePrazo(n))}.`;
    }
    let m = n.mensagem.replace(BOILERPLATE, '').trim();
    m = m.replace(/"([^"]+)"/, (_, t: string) => `"${tituloCitado(t)}"`);
    if (dias !== null) m = m.replace(/ (vence|é) (hoje|amanhã)\./, ` ${fraseDoVencimento(dias, tipoDoAlertaDePrazo(n))}.`);
    return m;
  }
  if (n.tipo === 'disputa_abrindo' && dias !== null) {
    return n.mensagem.replace(/vence em \d+ dias\./, `${fraseDoVencimento(dias)}.`);
  }
  if (n.tipo === 'pncp_mudanca') {
    if (d.titulo_edital && n.mensagem.startsWith(d.titulo_edital)) {
      return `${tituloCitado(d.titulo_edital)}${n.mensagem.slice(d.titulo_edital.length)}`;
    }
    // Alerta antigo: "TÍTULO recebeu novo documento ou alteração oficial. ..."
    const corte = n.mensagem.indexOf(' recebeu ');
    if (corte > 0) return `${tituloCitado(n.mensagem.slice(0, corte))}${n.mensagem.slice(corte)}`;
  }
  return n.mensagem;
}

// ─────────────────────────────────────────────────────────────────────────
// Grupos, seções e chips
// ─────────────────────────────────────────────────────────────────────────

export interface GrupoDeAlertas {
  chave: string;
  tipo: TipoDeAlerta;
  /** O mais recente do grupo: é o que dá título, mensagem e destino. */
  principal: Notificacao;
  /** Todos, do mais recente ao mais antigo. */
  itens: Notificacao[];
  ids: string[];
}

function instante(n: Notificacao): number {
  const t = n.criada_em ? new Date(n.criada_em).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

/** O que faz dois alertas serem "o mesmo": o mesmo edital para prazo (com o
 *  mesmo rótulo), decisão e mudança; o mesmo contrato para disputa; o mesmo
 *  texto para os demais (o lembrete de certidões, os diários de mercado). */
export function chaveDoGrupo(n: Notificacao): string {
  const d = n.dados || {};
  const id = String(d.analysis_id || '');
  if (n.tipo === 'prazo' && id) return `prazo|${id}|${String(d.prazo || '').toLowerCase()}`;
  if ((n.tipo === 'pncp_mudanca' || n.tipo === 'decisao' || n.tipo === 'pncp_resultado') && id) return `${n.tipo}|${id}`;
  if (n.tipo === 'disputa_abrindo' && d.ncp) return `disputa|${String(d.ncp)}`;
  return `${n.tipo}|${n.mensagem.trim()}`;
}

export function agruparAlertas(notifs: Notificacao[]): GrupoDeAlertas[] {
  const grupos = new Map<string, GrupoDeAlertas>();
  for (const n of notifs) {
    const chave = chaveDoGrupo(n);
    const g = grupos.get(chave);
    if (g) {
      g.itens.push(n);
    } else {
      grupos.set(chave, { chave, tipo: n.tipo, principal: n, itens: [n], ids: [] });
    }
  }
  const lista = [...grupos.values()];
  for (const g of lista) {
    g.itens.sort((a, b) => instante(b) - instante(a));
    g.principal = g.itens[0];
    g.ids = g.itens.map((i) => i._id);
  }
  return lista;
}

/** A ordem: o que vence nesta semana (data a até 7 dias, a mais próxima na
 *  frente); depois o que não tem data (mudanças, lembretes), por prioridade
 *  e idade; por fim as datas mais longe, também da mais próxima à mais
 *  distante. Os vencidos ficam no fim, do mais recente ao mais antigo. */
export function ordenarGrupos(grupos: GrupoDeAlertas[], hoje: Date = new Date()): GrupoDeAlertas[] {
  const faixa = (dias: number | null) => (dias === null ? 1 : dias < 0 ? 3 : dias <= 7 ? 0 : 2);
  return [...grupos]
    .map((g) => ({ g, dias: diasDoAlerta(g.principal, hoje) }))
    .sort((a, b) => {
      const fa = faixa(a.dias);
      const fb = faixa(b.dias);
      if (fa !== fb) return fa - fb;
      if (a.dias !== null && b.dias !== null && a.dias !== b.dias) return fa === 3 ? b.dias - a.dias : a.dias - b.dias;
      return (a.g.principal.prioridade - b.g.principal.prioridade) || (instante(b.g.principal) - instante(a.g.principal));
    })
    .map(({ g }) => g);
}

export interface SecoesDoRadar {
  ativos: GrupoDeAlertas[];
  vencidos: GrupoDeAlertas[];
}

export function secoesDoRadar(notifs: Notificacao[], hoje: Date = new Date()): SecoesDoRadar {
  const grupos = ordenarGrupos(agruparAlertas(notifs), hoje);
  return {
    ativos: grupos.filter((g) => !alertaVencido(g.principal, hoje)),
    vencidos: grupos.filter((g) => alertaVencido(g.principal, hoje)),
  };
}

/** O número do sino: grupos ativos com algo por ler — não documentos. Três
 *  "Edital mudou" do mesmo edital são um aviso; oito "vence hoje" de semanas
 *  atrás não são aviso nenhum. */
export function contagemDoSino(notifs: Notificacao[], hoje: Date = new Date()): number {
  return secoesDoRadar(notifs, hoje).ativos.filter((g) => g.itens.some((n) => !n.lida)).length;
}

export interface ContagemDoTipo { tipo: TipoDeAlerta; rotulo: string; n: number }

/** Os chips do topo: um por tipo presente, na ordem fixa do catálogo. */
export function contagensPorTipo(grupos: GrupoDeAlertas[]): ContagemDoTipo[] {
  const n = new Map<TipoDeAlerta, number>();
  for (const g of grupos) n.set(g.tipo, (n.get(g.tipo) || 0) + 1);
  return ORDEM_DOS_TIPOS
    .filter((t) => n.has(t))
    .map((t) => ({ tipo: t, rotulo: ROTULO_DO_TIPO[t], n: n.get(t)! }));
}

export function filtrarPorTipo(grupos: GrupoDeAlertas[], tipo: TipoDeAlerta | null): GrupoDeAlertas[] {
  return tipo ? grupos.filter((g) => g.tipo === tipo) : grupos;
}

/** "3 alterações, a última há 12 dias" — o que o card de um grupo diz. */
export function resumoDoGrupo(g: GrupoDeAlertas, agora: Date = new Date()): string | null {
  if (g.itens.length < 2) return null;
  const nomes: Partial<Record<TipoDeAlerta, [string, string]>> = {
    pncp_mudanca: ['alteração', 'alterações'],
    prazo: ['aviso', 'avisos'],
    disputa_abrindo: ['aviso', 'avisos'],
    compliance: ['lembrete', 'lembretes'],
  };
  const [, plural] = nomes[g.tipo] || ['alerta', 'alertas'];
  return `${g.itens.length} ${plural}, ${g.tipo === 'pncp_mudanca' ? 'a última' : 'o último'} ${tempoAtras(g.principal.criada_em, agora)}`;
}

/** "agora", "há 5 min", "há 3 h", "há 12 dias". */
export function tempoAtras(iso: string | undefined, agora: Date = new Date()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.floor((agora.getTime() - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? '' : 's'}`;
}

/** O rodapé: quando o sino conferiu pela última vez, e de quanto em quanto. */
export function rodapeDoRadar(ultimaVerificacao: Date | null, agora: Date = new Date()): string {
  if (!ultimaVerificacao) return 'Ainda não verificado';
  const quando = tempoAtras(ultimaVerificacao.toISOString(), agora);
  return `Atualizado ${quando} · confere a cada 2 min`;
}

/** O subtítulo do cabeçalho: "12 alertas · 8 vencidos", "Tudo em dia".
 *  `noTeto` avisa quando a lista bateu no limite do servidor. */
export function subtituloDoRadar(ativos: number, vencidos: number, noTeto = false): string {
  if (ativos === 0 && vencidos === 0) return 'Tudo em dia';
  const partes: string[] = [];
  if (ativos > 0) partes.push(`${ativos}${noTeto ? '+' : ''} alerta${ativos === 1 ? '' : 's'}`);
  if (vencidos > 0) partes.push(`${vencidos} vencido${vencidos === 1 ? '' : 's'}`);
  return partes.join(' · ');
}
