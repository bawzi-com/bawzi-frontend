/**
 * datasCriticas.ts — régua única para as datas do cronograma do edital.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OS DOIS DEFEITOS QUE ESTE ARQUIVO EXISTE PARA MATAR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── 1. O DIA A MENOS (e o "Edital encerrado" 27 h cedo demais) ─────────────
 *
 * O prompt de extração manda, textualmente:
 *
 *     "Se não for possível determinar o horário, use T00:00:00Z."
 *
 * — ou seja, o caso SEM hora é o caso COMUM, não a exceção. A tela então fazia:
 *
 *     new Date(dc.data_iso).toLocaleDateString('pt-BR', {...})
 *
 * sem `timeZone`. Medido, com TZ=America/Sao_Paulo:
 *
 *     '2026-09-15T00:00:00Z'  →  "14 de set. de 2026"
 *
 * Um prazo de 15/09 impresso como 14/09. Pior que o rótulo errado: a mesma
 * data alimentava `new Date(iso) < new Date()`, que vira true às 21h00 do dia
 * 14 — então o banner preto "EDITAL ENCERRADO · Análise disponível apenas para
 * referência e estudo de mercado" cobria a análise com 27 horas de janela real
 * ainda por vencer, e `CronogramaSection` escondia o cronograma inteiro junto.
 *
 * Este é o único defeito desta varredura que erra para o lado PESSIMISTA — e
 * é justamente por isso que é o mais caro: o usuário descarta sozinho um
 * edital vivo, e nada na tela sugere que ele deveria conferir.
 *
 * ── 2. O "URGENTE" QUE NUNCA ACENDE ───────────────────────────────────────
 *
 * `urgente` é calculado UMA VEZ, no backend, no instante da análise
 * (`analysis_quality.py`, `validar_congruencia`) e gravado no documento. A
 * tela recomputava `expirado` ao vivo mas lia `dc.urgente` do registro.
 * Resultado: um laudo gerado com 20 dias de antecedência guarda
 * `urgente: false` para sempre. Na véspera da sessão o item aparece com pino
 * cinza, sem selo vermelho — a fase de urgência simplesmente não existe. A
 * data só muda de aparência quando já é tarde.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * O MODELO ADOTADO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A data de calendário sai do TEXTO ISO (regex nos 10 primeiros caracteres),
 * nunca de `new Date(...)` — assim nenhum fuso pode deslocá-la. A hora, quando
 * existe, é lida como a hora ESCRITA NO EDITAL, que num edital brasileiro é
 * horário de Brasília. Sem hora, o prazo vence no FIM do dia, não no começo.
 *
 * E `urgente` é recomputado a cada render, espelhando `_dias_uteis_ate` do
 * backend (mesma janela de 5 dias úteis, mesmo teto de 30 iterações).
 */

/** Brasília é UTC−03:00 fixo: o horário de verão foi extinto em 2019 (Dec. 9.772).
 *  Editais do Acre/Amazonas ficam 1–2 h deslocados — diferença sem efeito
 *  prático aqui, porque o que decidimos é dia de calendário, não minuto. */
const OFFSET_BRASILIA = '-03:00';

const _RE_DATA = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

export interface DataCriticaPartes {
  /** 'YYYY-MM-DD' exatamente como o backend gravou. */
  dia: string;
  ano: number;
  mes: number;
  diaDoMes: number;
  /** 'HH:MM' quando o edital trazia horário; null quando veio o T00:00:00Z
   *  que o prompt manda usar para "horário desconhecido". */
  hora: string | null;
}

export function partesDaDataCritica(iso: string | null | undefined): DataCriticaPartes | null {
  if (!iso) return null;
  const m = _RE_DATA.exec(String(iso).trim());
  if (!m) return null;
  const [, ano, mes, diaDoMes, hh, mm] = m;
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠️ DATA QUE NÃO EXISTE VIRAVA OUTRA DATA, PLAUSÍVEL, NA TELA.
  // ═══════════════════════════════════════════════════════════════════════════
  // A regex confere o FORMATO, não o calendário. `Date.UTC(ano, mes-1, dia)`
  // não recusa nada: ele TRANSBORDA. Medido em node:
  //
  //     '2026-13-15'  → "15 de jan. de 2027"   (um ano à frente)
  //     '2026-09-31'  → "01 de out. de 2026"   (um dia depois do prazo)
  //     '2026-02-30'  → "02 de mar. de 2026"
  //
  // Estas datas vêm da EXTRAÇÃO do edital por modelo. Um "31 de setembro"
  // alucinado não aparecia como erro: aparecia como um prazo diferente, com a
  // mesma cara de fato apurado — e sempre para frente, que é a direção que
  // faz alguém perder a sessão. Pior ainda, os dois caminhos discordavam entre
  // si: `formatarDataCritica` exibia a data transbordada enquanto
  // `instanteLimite` devolvia `null` para o mês 13, de modo que a tela mostrava
  // um prazo que nunca expirava.
  //
  // Ausência é honesta; data inventada não. Não sabendo ler, devolve `null`, e
  // quem chama já trata `null` como "sem data".
  const aN = Number(ano);
  const mN = Number(mes);
  const dN = Number(diaDoMes);
  const conferencia = new Date(Date.UTC(aN, mN - 1, dN));
  if (
    conferencia.getUTCFullYear() !== aN
    || conferencia.getUTCMonth() + 1 !== mN
    || conferencia.getUTCDate() !== dN
  ) return null;
  // A hora também: 25:00 e 10:99 não existem.
  if (hh !== undefined && (Number(hh) > 23 || Number(mm) > 59)) return null;
  // ⚠️ 00:00 NÃO É MEIA-NOITE, É "NÃO SEI A HORA". É o sentinela que o próprio
  // prompt manda escrever. Tratá-lo como instante faria todo prazo sem horário
  // vencer no primeiro segundo do dia — o oposto do que "prazo do dia 15"
  // significa para quem vai protocolar.
  const temHora = Boolean(hh && mm) && !(hh === '00' && mm === '00');
  return {
    dia: `${ano}-${mes}-${diaDoMes}`,
    ano: Number(ano),
    mes: Number(mes),
    diaDoMes: Number(diaDoMes),
    hora: temHora ? `${hh}:${mm}` : null,
  };
}

/** O instante em que o prazo de fato vence, em horário de Brasília.
 *  Com hora conhecida, é ela. Sem hora, é o fim do dia — nunca o começo. */
export function instanteLimite(iso: string | null | undefined): Date | null {
  const p = partesDaDataCritica(iso);
  if (!p) return null;
  const alvo = p.hora
    ? `${p.dia}T${p.hora}:00${OFFSET_BRASILIA}`
    : `${p.dia}T23:59:59${OFFSET_BRASILIA}`;
  const d = new Date(alvo);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Data de calendário formatada exatamente como foi gravada.
 *  `timeZone: 'UTC'` é o que impede o fuso do navegador de recuar um dia. */
export function formatarDataCritica(
  iso: string | null | undefined,
  estilo: 'curto' | 'longo' | 'numerico' = 'curto',
): string | null {
  const p = partesDaDataCritica(iso);
  if (!p) return null;
  const base = new Date(Date.UTC(p.ano, p.mes - 1, p.diaDoMes));
  const opcoes: Intl.DateTimeFormatOptions =
    estilo === 'longo'
      ? { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }
      : estilo === 'numerico'
        ? { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }
        : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' };
  const data = base.toLocaleDateString('pt-BR', opcoes);
  // A hora só entra na tela quando o edital realmente a trouxe. Inventar
  // "00:00" seria transformar o sentinela de ignorância em informação.
  return p.hora ? `${data} · ${p.hora}` : data;
}

export function dataCriticaExpirada(
  iso: string | null | undefined,
  agora: Date = new Date(),
): boolean {
  const limite = instanteLimite(iso);
  return limite ? limite.getTime() < agora.getTime() : false;
}

/** Dias úteis até o prazo, na mesma contagem de `_dias_uteis_ate`
 *  (analysis_quality.py): exclui hoje, inclui o dia-alvo se for dia útil,
 *  teto de 30 iterações, −1 para o que já venceu. Os dois lados precisam
 *  concordar — o backend usa esta mesma janela para escrever os ajustes. */
export function diasUteisAteDataCritica(
  iso: string | null | undefined,
  agora: Date = new Date(),
): number | null {
  const p = partesDaDataCritica(iso);
  if (!p) return null;
  if (dataCriticaExpirada(iso, agora)) return -1;

  // "Hoje" em Brasília, não no fuso de quem abriu a tela: a contagem de dias
  // úteis de um prazo brasileiro é feita no calendário brasileiro.
  const agoraBr = new Date(agora.getTime() - 3 * 3600_000);
  let cursor = Date.UTC(agoraBr.getUTCFullYear(), agoraBr.getUTCMonth(), agoraBr.getUTCDate());
  const alvo = Date.UTC(p.ano, p.mes - 1, p.diaDoMes);

  let dias = 0;
  while (cursor < alvo && dias < 30) {
    cursor += 86_400_000;
    const semana = new Date(cursor).getUTCDay();
    if (semana >= 1 && semana <= 5) dias += 1;
  }
  return dias;
}

/** Recomputado a cada render — nunca lido do registro. Ver defeito 2 acima. */
export function dataCriticaUrgente(
  iso: string | null | undefined,
  agora: Date = new Date(),
): boolean {
  const dias = diasUteisAteDataCritica(iso, agora);
  return dias !== null && dias >= 0 && dias <= 5;
}

/** True quando o prazo vence hoje e ainda não passou — o estado que a tela
 *  antiga não sabia mostrar (ou já estava "expirado", ou era um pino cinza).
 *
 *  ⚠️ NÃO dá para derivar isto de `diasUteis === 0`: um prazo que cai no
 *  sábado de amanhã também devolve 0 (o loop anda um dia e não conta fim de
 *  semana). Comparação de dia de calendário, direto. */
export function venceHoje(
  iso: string | null | undefined,
  agora: Date = new Date(),
): boolean {
  const p = partesDaDataCritica(iso);
  if (!p || dataCriticaExpirada(iso, agora)) return false;
  const agoraBr = new Date(agora.getTime() - 3 * 3600_000);
  return (
    agoraBr.getUTCFullYear() === p.ano
    && agoraBr.getUTCMonth() + 1 === p.mes
    && agoraBr.getUTCDate() === p.diaDoMes
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// O PRAZO DE PROPOSTAS JÁ PASSOU? — a régua do banner "Edital encerrado"
// ═══════════════════════════════════════════════════════════════════════════
//
// ── 3. O "ENCERRADO" PELO INÍCIO DA JANELA (24/09/2026) ────────────────────
//
// A régua antiga (em AnalysisResults.tsx) aceitava qualquer rótulo com
// 'recebimento' e pegava a PRIMEIRA data vencida. "Início do Recebimento das
// Propostas" tem 'recebimento' — e início passado quer dizer que as propostas
// estão ABERTAS. Medido com o código de então: um edital com a janela de
// 21/09 a 02/10, aberto no dia 24/09, recebia o banner preto "EDITAL
// ENCERRADO · A Início do Recebimento das Propostas ocorreu em 21 de setembro"
// — o defeito pessimista do item 1, por outro caminho. E havia uma TERCEIRA
// cópia da régua, em exportPdf.ts, com outra lista de palavras ('proposta',
// 'abertura'…) e um comentário dizendo que era a mesma.
//
// Agora a régua é uma só, aqui, e usada pelas três telas (banner, impressão
// e PDF):
//   1. Data OFICIAL do PNCP (`pncp_prazo_propostas.fim`, gravada pelo backend
//      quando a análise vem do Radar) decide sozinha quando existe.
//   2. Sem ela, o cronograma extraído do edital — mas só marcos do FIM da
//      janela (ou de algo que só acontece depois dele: sessão, disputa),
//      nunca do início, e fica a data MAIS TARDIA: basta um marco no futuro
//      para o edital seguir vivo.

/** Rótulo sem acento e em minúsculas — "INÍCIO" e "inicio" são o mesmo marco. */
function _rotuloNormalizado(rotulo: string): string {
  return rotulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Marcas do FIM da janela de propostas, ou de um evento posterior a ele. */
const _MARCAS_FIM_DA_JANELA = /encerramento|recebimento|envio|limite|prazo|sessao|disputa|lance/;

/** Prazo de OUTRA coisa, mesmo contendo uma das marcas acima ("Prazo de
 *  impugnação", "Prazo de entrega", "Validade da proposta"). "Entrega" só
 *  sai quando não é das propostas. */
const _OUTRO_PRAZO =
  /impugna|esclarec|recurso|vigenc|pagamento|validade|assinatura|garantia|execuc|amostra|homologa|adjudica|visita|vistoria|publicac|entrega(?!\s+(d[ao]s?\s+)?(proposta|envelope|lance))/;

/** "Início do recebimento", "Abertura das propostas", "A partir de…": o COMEÇO
 *  da janela. ("Abertura das propostas" é ambígua — no PNCP é o início — e
 *  fica de fora por isso.) Não vale para sessão/disputa: "Início da sessão
 *  pública" acontece depois do prazo, e esse É um marco de encerramento. */
function _marcaInicioDaJanela(r: string): boolean {
  return /\b(inicio|abertura|a partir)\b/.test(r)
    && /(recebimento|envio|cadastr|acolhimento|proposta)/.test(r)
    && !/(sessao|disputa|lance)/.test(r);
}

function _ehMarcoDoFimDaJanela(rotulo: string): boolean {
  const r = _rotuloNormalizado(rotulo);
  return _MARCAS_FIM_DA_JANELA.test(r) && !_OUTRO_PRAZO.test(r) && !_marcaInicioDaJanela(r);
}

export interface PrazoDePropostas {
  /** Como a tela deve chamar a data ("Fim do recebimento de propostas"). */
  label: string;
  data_iso: string;
  /** 'pncp' = data oficial; 'edital' = extraída do texto pela IA. */
  fonte: 'pncp' | 'edital';
}

interface _ResultadoComPrazo {
  datas_criticas?: ReadonlyArray<{ label?: string | null; data_iso?: string | null } | null> | null;
  pncp_prazo_propostas?: { fim?: string | null } | null;
}

/** O prazo de propostas que PROVA que o edital encerrou, ou `null`.
 *
 *  `null` é "não dá para afirmar que encerrou" — inclusive sem data nenhuma.
 *  Na dúvida, o edital segue vivo: esconder um aviso custa menos do que
 *  fazer alguém desistir de uma disputa aberta. */
export function prazoDePropostasEncerrado(
  result: _ResultadoComPrazo | null | undefined,
  agora: Date = new Date(),
): PrazoDePropostas | null {
  if (!result) return null;

  const fimOficial = result.pncp_prazo_propostas?.fim;
  if (fimOficial && instanteLimite(fimOficial)) {
    return dataCriticaExpirada(fimOficial, agora)
      ? { label: 'Fim do recebimento de propostas', data_iso: fimOficial, fonte: 'pncp' }
      : null;
  }

  let maisTardio: { label: string; data_iso: string; instante: number } | null = null;
  for (const dc of result.datas_criticas ?? []) {
    const label = String(dc?.label ?? '').trim();
    const iso = dc?.data_iso;
    if (!label || !iso || !_ehMarcoDoFimDaJanela(label)) continue;
    const limite = instanteLimite(iso);
    if (!limite) continue;
    if (!maisTardio || limite.getTime() > maisTardio.instante) {
      maisTardio = { label, data_iso: iso, instante: limite.getTime() };
    }
  }
  if (!maisTardio || maisTardio.instante >= agora.getTime()) return null;
  return { label: maisTardio.label, data_iso: maisTardio.data_iso, fonte: 'edital' };
}
