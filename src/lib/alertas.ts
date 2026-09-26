/**
 * A tela de Alertas: o que se manda para o servidor e o que muda na lista
 * quando alguém liga ou desliga um aviso ou um canal, ou troca a hora de um
 * resumo diário (26/09/2026).
 *
 * Funções puras, testadas sem navegador.
 */

/** Os canais além do sino. O sino é o próprio aviso: ligado, ele aparece lá. */
export type CanalExtra = 'push' | 'email';

/** Os dias de um resumo diário. Dia útil é segunda a sexta (feriado conta). */
export type Frequencia = 'todo_dia' | 'dias_uteis';

/** O horário de um resumo diário. `minuto` é do job, não da pessoa: as
 *  disputas saem aos 20 de cada hora, depois do radar das horas cheias. */
export interface AgendaDoAviso {
  hora: number;
  minuto: number;
  frequencia: Frequencia;
}

export interface TipoAlerta {
  tipo: string;
  nome: string;
  descricao: string;
  porque: string;
  quando: string;
  origem: string;
  grupo: string;
  configuravel?: boolean;
  ativo: boolean;
  /** Os canais que este aviso usa de verdade — só onde algum job manda. */
  canais?: CanalExtra[];
  /** A escolha de cada canal; ausência é ligado. */
  canais_ativos?: Partial<Record<CanalExtra, boolean>>;
  /** Só nos três resumos diários (palavra-chave, disputas, contratos
   *  vencendo): a hora e os dias escolhidos, ou o padrão. */
  agenda?: AgendaDoAviso;
  agenda_padrao?: AgendaDoAviso;
  /** O que mais faz o aviso sair além da hora ("e ao abrir o sino"). */
  quando_tambem?: string;
}

export const ROTULO_DO_CANAL: Record<CanalExtra, string> = { push: 'Push', email: 'E-mail' };

export const ROTULO_DA_FREQUENCIA: Record<Frequencia, string> = { todo_dia: 'Todo dia', dias_uteis: 'Dias úteis' };

/** "07h00", "09h20" — a grafia do catálogo (`descrever_agenda`). */
export function horario(hora: number, minuto = 0): string {
  return `${String(hora).padStart(2, '0')}h${String(minuto).padStart(2, '0')}`;
}

/** O canal está ligado (a escolha, não o efeito: o aviso desligado cala tudo). */
export function canalLigado(t: TipoAlerta, canal: CanalExtra): boolean {
  return t.canais_ativos?.[canal] !== false;
}

/** O corpo do `PUT /api/alertas/preferencias`: os mapas COMPLETOS.
 *  O servidor não aceita delta — ausência lá significa ligado, e um
 *  desligamento que não viesse no mapa voltaria ligado. Aviso sem canal além
 *  do sino não entra em `canais`.
 *
 *  `agenda` leva a hora e os dias de cada resumo diário. Sem nenhum aviso com
 *  horário na lista (servidor anterior a isso), o campo nem vai: um mapa
 *  vazio mandaria o servidor apagar as horas escolhidas. */
export function corpoDasPreferencias(tipos: TipoAlerta[]): {
  tipos: Record<string, boolean>;
  canais: Record<string, Partial<Record<CanalExtra, boolean>>>;
  agenda?: Record<string, { hora: number; frequencia: Frequencia }>;
} {
  const comHorario = tipos.filter((t) => t.agenda);
  return {
    tipos: Object.fromEntries(tipos.map((t) => [t.tipo, t.ativo])),
    canais: Object.fromEntries(
      tipos
        .filter((t) => (t.canais || []).length > 0)
        .map((t) => [t.tipo, Object.fromEntries((t.canais || []).map((c) => [c, canalLigado(t, c)]))]),
    ),
    ...(comHorario.length > 0 && {
      agenda: Object.fromEntries(
        comHorario.map((t) => [t.tipo, { hora: t.agenda!.hora, frequencia: t.agenda!.frequencia }]),
      ),
    }),
  };
}

/** A lista com a hora ou os dias de um resumo trocados. Aviso sem horário
 *  próprio não é tocado — não existe seletor para ele. */
export function trocarAgenda(
  tipos: TipoAlerta[],
  tipo: string,
  mudanca: Partial<Pick<AgendaDoAviso, 'hora' | 'frequencia'>>,
): TipoAlerta[] {
  return tipos.map((t) => (t.tipo === tipo && t.agenda ? { ...t, agenda: { ...t.agenda, ...mudanca } } : t));
}

/** A lista com o aviso ligado/desligado. */
export function alternarAviso(tipos: TipoAlerta[], tipo: string): TipoAlerta[] {
  return tipos.map((t) => (t.tipo === tipo ? { ...t, ativo: !t.ativo } : t));
}

/** A lista com um canal de um aviso ligado/desligado. Canal que o aviso não
 *  usa não é tocado — não existe interruptor para ele. */
export function alternarCanal(tipos: TipoAlerta[], tipo: string, canal: CanalExtra): TipoAlerta[] {
  return tipos.map((t) => {
    if (t.tipo !== tipo || !(t.canais || []).includes(canal)) return t;
    return { ...t, canais_ativos: { ...(t.canais_ativos || {}), [canal]: !canalLigado(t, canal) } };
  });
}

/** Como o aviso chega, em uma frase: "Sino, push e e-mail", "Só no sino". */
export function fraseDosCanais(t: TipoAlerta): string {
  if (!t.ativo) return 'Desligado';
  const extras = (t.canais || []).filter((c) => canalLigado(t, c)).map((c) => ROTULO_DO_CANAL[c].toLowerCase());
  if (extras.length === 0) return 'Só no sino';
  if (extras.length === 1) return `Sino e ${extras[0]}`;
  return `Sino, ${extras.slice(0, -1).join(', ')} e ${extras[extras.length - 1]}`;
}
