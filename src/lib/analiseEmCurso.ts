/**
 * analiseEmCurso.ts — o marcador da análise que está rodando no servidor.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 * Uma análise roda no servidor de 30 s a 15 min (auditoria profunda), e o
 * servidor termina e grava o laudo mesmo que ninguém esteja olhando. A TELA é
 * que se perdia: o estado vivia no `useAnalysis`, e qualquer troca de ROTA
 * (Gestão, Planos, Documentação e o logo, no cabeçalho; "Conta e equipe", na
 * barra) desmontava o app inteiro. A volta mostrava o formulário vazio, e um
 * novo "Analisar" disparava uma SEGUNDA análise em paralelo — IA em dobro.
 *
 * O marcador já existia para sobreviver ao F5. Agora ele é o canal único de
 * "tem análise rodando": o `useAnalysis` grava ao iniciar e REANEXA ao montar
 * (overlay na etapa real + laudo aberto ao concluir); a requisição que ficou
 * órfã anota aqui como terminou; o cabeçalho lê para o chip "Analisando…".
 *
 * Estados:
 *   rodando   — a requisição está no ar (nesta tela ou numa que já morreu);
 *   concluida — terminou com a tela desmontada; `resultadoId` abre o laudo;
 *   erro      — terminou mal com a tela desmontada; `erro` diz o porquê.
 *
 * Só para quem tem conta: laudo de convidado não persiste, então não haveria
 * o que reencontrar.
 */

export const CHAVE_ANALISE_EM_CURSO = 'bawzi_analise_em_curso';

/** Mesma aba: `storage` só dispara nas OUTRAS abas, então quem grava avisa. */
export const EVENTO_ANALISE_EM_CURSO = 'bawzi_analise_em_curso';

/** 20 min cobre a pior auditoria (15) + folga; mais velho que isso é lixo. */
export const IDADE_MAXIMA_MARCADOR_MS = 20 * 60 * 1000;

export type MotorAnalise = 'openai' | 'claude';

export interface MarcadorAnalise {
  progressToken: string;
  startedAt: number;
  motor: MotorAnalise;
  /** ETA desta análise — a retomada anda a barra na mesma régua do início. */
  estimateSeconds?: number;
  status?: 'rodando' | 'concluida' | 'erro';
  resultadoId?: string | null;
  erro?: string | null;
}

function avisar(): void {
  try { window.dispatchEvent(new Event(EVENTO_ANALISE_EM_CURSO)); } catch { /* SSR */ }
}

/** O marcador válido, ou `null`. Marcador ilegível ou velho é apagado aqui. */
export function lerMarcadorAnalise(agora: number = Date.now()): MarcadorAnalise | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(CHAVE_ANALISE_EM_CURSO); } catch { return null; }
  if (!raw) return null;
  let m: Partial<MarcadorAnalise> | null = null;
  try { m = JSON.parse(raw); } catch { m = null; }
  const idade = agora - Number(m?.startedAt || 0);
  if (!m || typeof m.progressToken !== 'string' || !m.progressToken || !(idade >= 0) || idade > IDADE_MAXIMA_MARCADOR_MS) {
    try { localStorage.removeItem(CHAVE_ANALISE_EM_CURSO); } catch { /* sem storage */ }
    avisar();
    return null;
  }
  return {
    progressToken: m.progressToken,
    startedAt: Number(m.startedAt),
    motor: m.motor === 'claude' ? 'claude' : 'openai',
    estimateSeconds: typeof m.estimateSeconds === 'number' ? m.estimateSeconds : undefined,
    status: m.status === 'concluida' || m.status === 'erro' ? m.status : 'rodando',
    resultadoId: m.resultadoId ?? null,
    erro: m.erro ?? null,
  };
}

export function gravarMarcadorAnalise(m: MarcadorAnalise): void {
  try { localStorage.setItem(CHAVE_ANALISE_EM_CURSO, JSON.stringify(m)); } catch { return; }
  avisar();
}

/** Atualiza o marcador SÓ se ele ainda for desta análise (outra pode ter
 *  começado depois, em outra aba — e a anotação dela não pode ser pisada). */
export function atualizarMarcadorAnalise(progressToken: string, campos: Partial<MarcadorAnalise>): void {
  const atual = lerMarcadorAnalise();
  if (!atual || atual.progressToken !== progressToken) return;
  gravarMarcadorAnalise({ ...atual, ...campos, progressToken });
}

/** Remove o marcador SÓ se ele ainda for desta análise — pelo mesmo motivo. */
export function removerMarcadorAnalise(progressToken: string): void {
  try {
    const raw = localStorage.getItem(CHAVE_ANALISE_EM_CURSO);
    if (raw && JSON.parse(raw)?.progressToken === progressToken) {
      localStorage.removeItem(CHAVE_ANALISE_EM_CURSO);
      avisar();
    }
  } catch { /* sem storage ou marcador ilegível: nada a preservar */ }
}
